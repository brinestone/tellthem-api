export class UserCreatedEvent {
  constructor(readonly userId: number) {}
}

export class UserDeletedEvent {
  constructor(readonly userId: number) {}
}

export class AccountConnectionCreatedEvent {
  constructor(
    readonly provider: 'telegram',
    readonly connectionId: string,
    readonly owner: number,
  ) {}
}

export class AccountConnectionDeletedEvent {
  constructor(
    readonly provider: 'telegram',
    readonly connectionId: string,
    readonly owner: number,
  ) {}
}
