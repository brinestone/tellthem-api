import {
  PAYMENT_COLLECTION_REQUESTED,
  PAYMENT_STATUS_CHANGED,
} from '@events/finance';
import { Public, User } from '@modules/auth/decorators';
import { Controller, Get, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { UserInfo } from '@schemas/users';
import { CollectPaymentRequestedEvent, PaymentUpdatedEvent } from './events';
import { FinanceService } from './finance.service';

@Controller('/payment')
export class PaymentController {
  private logger = new Logger(PaymentController.name);
  constructor(
    private financeService: FinanceService,
    // private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(PAYMENT_COLLECTION_REQUESTED)
  async handlePaymentCollectionRequest({
    amount,
    currency,
    provider,
    user,
    walletTransaction,
  }: CollectPaymentRequestedEvent) {
    const paymentMethod =
      await this.financeService.findPaymentMethodParmsByOwner(user, provider);

    if (!paymentMethod) {
      this.logger.warn(
        'cannot collect payment funds due to an unregistered payment method provider specified ' +
          provider,
      );
      return;
    }

    switch (provider) {
      default:
        this.logger.warn(
          'cannot collect payment funds due to an unsupported payment method provider specified ' +
            provider,
        );
        return;
      case 'virtual': {
        try {
          const res = await this.financeService.collectVirtualFunds(
            currency,
            amount,
            walletTransaction,
          );

          void this.eventEmitter.emitAsync(
            PAYMENT_STATUS_CHANGED,
            new PaymentUpdatedEvent(res.id, res.walletTransaction ?? undefined),
          );
        } catch (e) {
          this.logger.error(e.message, e.stack);
        }
        break;
      }
    }
  }

  @Get('providers')
  @Public()
  getPaymentMethodProviders() {
    return this.financeService.getPaymentMethods();
  }

  @Get('methods')
  async findUserPaymentMethods(@User() { id }: UserInfo) {
    return this.financeService.findUserPaymentMethods(id);
  }
}
