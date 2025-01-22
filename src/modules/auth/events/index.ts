export class UserCreatedEvent {
  constructor(readonly userId: number) {}
}

export class UserDeletedEvent {
  constructor(readonly userId: number) {}
}
