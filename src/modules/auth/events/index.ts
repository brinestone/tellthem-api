export class BaseUserEvent {
  constructor(readonly userId: number) {}
}

export class UserPrefsUpdatedEvent extends BaseUserEvent {}

export class UserCreatedEvent extends BaseUserEvent {}

export class UserDeletedEvent extends BaseUserEvent {}

export class AccountDeletionRequestedEvent extends UserDeletedEvent {}

export class AccountConnectionCreatedEvent extends BaseUserEvent {
  constructor(
    readonly provider: 'telegram',
    readonly connectionId: string,
    readonly userId: number,
  ) {
    super(userId);
  }
}

export class AccountConnectionDeletedEvent extends BaseUserEvent {
  constructor(
    readonly provider: 'telegram',
    readonly connectionId: string,
    readonly owner: number,
  ) {
    super(owner);
  }
}
