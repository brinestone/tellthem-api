import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import telegrafConfig from '../config/telegraf.config';

@Injectable()
export class TelegramWebhookGuard implements CanActivate {
  constructor(
    @Inject(telegrafConfig.KEY)
    private config: ConfigType<typeof telegrafConfig>,
  ) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const headerValue = request.header('x-telegram-bot-api-secret-token');
    return headerValue === this.config.tmSecretToken;
  }
}
