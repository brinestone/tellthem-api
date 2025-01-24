export class CampaignDeletedEvent {
  constructor(readonly id: number) {}
}
export class CampaignCreatedEvent {
  constructor(readonly id: number) {}
}

export class CampaignPublishedEvent {
  constructor(
    readonly campaign: number,
    readonly publication: number,
  ) {}
}
