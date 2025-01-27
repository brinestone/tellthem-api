export class WebhookEvent {
  constructor(
    readonly from: 'mesomb',
    readonly data: Record<string, unknown>,
  ) {}
}
