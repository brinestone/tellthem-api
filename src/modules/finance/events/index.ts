import { PaymentMethodProviderNames } from '../dto';

export class CollectPaymentRequestedEvent {
  constructor(
    readonly provider: PaymentMethodProviderNames,
    readonly amount: number,
    readonly currency: string,
    readonly user: number,
    readonly walletTransaction?: string,
  ) {}
}

export class PaymentUpdatedEvent {
  constructor(
    readonly transactionId: string,
    readonly walletTransaction?: string,
  ) {}
}
