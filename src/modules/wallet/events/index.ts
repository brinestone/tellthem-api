export class WalletCreatedEvent {
  constructor(readonly id: string) {}
}

export class WalletDeletedEvent {
  constructor(readonly id: string) {}
}

export class WalletBalanceUpdatedEvent {
  constructor(
    readonly id: string,
    readonly owner: number,
  ) {}
}

export class RewardTransferredEvent {
  constructor(
    readonly grant: string,
    readonly transaction: string,
  ) {}
}
