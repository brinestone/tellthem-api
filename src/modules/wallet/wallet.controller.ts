import {
  PAYMENT_COLLECTION_REQUESTED,
  PAYMENT_STATUS_CHANGED,
} from '@events/finance';
import { USER_CREATED, USER_DELETED } from '@events/user';
import { BALANCE_UPDATED, NEW_WALLET, WALLET_DELETED } from '@events/wallet';
import { User } from '@modules/auth/decorators';
import { UserCreatedEvent, UserDeletedEvent } from '@modules/auth/events';
import {
  CollectPaymentRequestedEvent,
  PaymentUpdatedEvent,
} from '@modules/finance/events';
import { Body, Controller, Get, Logger, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { UserInfo } from '@schemas/users';
import {
  BalancesSchema,
  WalletTopupInput,
  WalletTopupInputValidationSchema,
  WalletTransfersInputValidationSchema,
  WalletTransfersResponseSchema,
} from './dto';
import {
  WalletBalanceUpdatedEvent,
  WalletCreatedEvent,
  WalletDeletedEvent,
} from './events';
import { WalletService } from './wallet.service';
import { Request } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';

@Controller('wallet')
export class WalletController {
  private logger = new Logger(WalletController.name);
  constructor(
    private readonly walletService: WalletService,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService,
  ) {}

  @Get('transfers')
  async onFindUserWalletTransfers(
    @Req() req: Request,
    @User() { id }: UserInfo,
  ) {
    const { page, size } = WalletTransfersInputValidationSchema.parse(
      req.query,
    );

    const transfers = await this.walletService.findWalletTransfers(
      id,
      page,
      size,
    );
    const total = await this.walletService.countWalletUserTransactions(id);

    return WalletTransfersResponseSchema.parse({ data: transfers, total });
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
        void this.eventEmitter.emitAsync(
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
