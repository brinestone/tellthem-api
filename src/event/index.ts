export class AnalyticsRequestReceivedEvent {
  constructor(
    readonly ip: string,
    readonly userAgent: string,
    readonly key: string,
    readonly type: string,
    readonly data: Record<string, unknown>,
    readonly user?: number,
  ) {}
}
