import { REWARD_GRANTED } from '@events/campaign';
import {
  PAYMENT_COLLECTION_REQUESTED,
  PAYMENT_STATUS_CHANGED,
} from '@events/finance';
import { USER_CREATED, USER_DELETED } from '@events/user';
import {
  BALANCE_UPDATED,
  NEW_WALLET,
  REWARD_TRANSFERRED,
  WALLET_DELETED,
} from '@events/wallet';
import { User } from '@modules/auth/decorators';
import { UserCreatedEvent, UserDeletedEvent } from '@modules/auth/events';
import { RewardGrantedEvent } from '@modules/campaign/events';
import {
  CollectPaymentRequestedEvent,
  PaymentUpdatedEvent,
} from '@modules/finance/events';
import { Body, Controller, Get, Logger, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { UserInfo } from '@schemas/users';
import { Request } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
import { forkJoin, map } from 'rxjs';
import {
  BalancesSchema,
  WalletTopupInput,
  WalletTopupInputValidationSchema,
  WalletTransfersInputValidationSchema,
  WalletTransfersResponseSchema,
} from './dto';
import {
  RewardTransferredEvent,
  WalletBalanceUpdatedEvent,
  WalletCreatedEvent,
  WalletDeletedEvent,
} from './events';
import {
  InsufficientFundsError,
  ParametersError,
  WalletService,
} from './wallet.service';

@Controller('wallet')
export class WalletController {
  private logger = new Logger(WalletController.name);
  constructor(
    private readonly walletService: WalletService,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService,
  ) {}

  @OnEvent(REWARD_GRANTED)
  async computeRewardsOnCampaignViewed(arg: RewardGrantedEvent) {
    try {
      const {
        broadcaster,
        campaignOwner,
        srcWallet,
        destWallet,
        transactionId,
      } = await this.walletService.transferRewards(arg.broadcast);

      this.logger.log('new wallet transaction recorded', { transactionId });

      await this.eventEmitter.emitAsync(
        BALANCE_UPDATED,
        new WalletBalanceUpdatedEvent(srcWallet, campaignOwner),
      );

      await this.eventEmitter.emitAsync(
        BALANCE_UPDATED,
        new WalletBalanceUpdatedEvent(destWallet, broadcaster),
      );

      await this.eventEmitter.emitAsync(
        REWARD_TRANSFERRED,
        new RewardTransferredEvent(arg.rewardId, transactionId),
      );
    } catch (e) {
      if (e instanceof ParametersError || e instanceof InsufficientFundsError)
        this.logger.warn(e.message);
      else this.logger.error(e.message, e.stack);
    }
  }

  @Get('transfers')
  onFindUserWalletTransfers(@Req() req: Request, @User() { id }: UserInfo) {
    const { page, size } = WalletTransfersInputValidationSchema.parse(
      req.query,
    );

    const transfers$ = this.walletService.findWalletTransfers(id, page, size);
    const total$ = this.walletService.countWalletUserTransactions(id);

    return forkJoin({
      groups: transfers$,
      total: total$,
    }).pipe(map((data) => WalletTransfersResponseSchema.parse(data)));
  }

  @OnEvent(PAYMENT_STATUS_CHANGED)
  async onPaymentStatusChanged(arg: PaymentUpdatedEvent) {
    if (!arg.walletTransaction) return;
    this.logger.log('updating wallet transaction from payment update');
    try {
      const affectedWallets = await this.walletService.updateWalletTransaction(
        arg.walletTransaction,
        arg.transactionId,
      );

      for (const { id, owner } of affectedWallets) {
        await this.eventEmitter.emitAsync(
          BALANCE_UPDATED,
          new WalletBalanceUpdatedEvent(id, owner),
        );
      }
    } catch (e) {
      this.logger.error(e.message, e.stack);
    }
  }

  @Post('top-up')
  async handleUserWalletTopup(
    @Body(new ZodValidationPipe(WalletTopupInputValidationSchema))
    req: WalletTopupInput,
    @User() { id }: UserInfo,
  ) {
    const walletTransaction = await this.walletService.topUpWallet(id);
    void this.eventEmitter.emitAsync(
      PAYMENT_COLLECTION_REQUESTED,
      new CollectPaymentRequestedEvent(
        req.paymentMethod,
        req.amount,
        req.currency,
        id,
        walletTransaction,
      ),
    );
  }

  @Get('balances')
  async handleGetUserWalletBalances(@User() { id }: UserInfo) {
    const result = await this.walletService.getBalances(id);
    return BalancesSchema.parse(result);
  }

  @OnEvent(USER_DELETED)
  async handleDeleteUserWallet(args: UserDeletedEvent) {
    try {
      const id = await this.walletService.createWallet(
        args.userId,
        this.configService.get<number>('USER_STARTING_BALANCE'),
      );
      this.eventEmitter.emit(WALLET_DELETED, new WalletDeletedEvent(id));
    } catch (e) {
      this.logger.error(e.message, e.stack);
    }
  }

  @OnEvent(USER_CREATED)
  async handleCreateUserWallet(args: UserCreatedEvent) {
    try {
      const id = await this.walletService.createWallet(
        args.userId,
        this.configService.get<number>('USER_STARTING_BALANCE'),
      );
      this.eventEmitter.emit(NEW_WALLET, new WalletCreatedEvent(id));
    } catch (e) {
      this.logger.error(e.message, e.stack);
    }
  }
}
