export class BaseCampaignEvent {
  constructor(readonly id: number) {}
}
export class CampaignDeletedEvent extends BaseCampaignEvent {}
export class CampaignCreatedEvent extends BaseCampaignEvent {}
export class CampaignUpdatedEvent extends BaseCampaignEvent {}
export class CampaignPublishedEvent extends BaseCampaignEvent {
  constructor(
    readonly campaign: number,
    readonly publication: number,
    readonly owner: number,
  ) {
    super(campaign);
  }
}

export class CampaignViewedEvent {
  constructor(
    readonly broadcast: string,
    readonly campaign?: number,
    readonly user?: number,
  ) {}
}

export class RewardGrantedEvent {
  constructor(
    readonly rewardId: string,
    readonly broadcast: string,
  ) {}
}
