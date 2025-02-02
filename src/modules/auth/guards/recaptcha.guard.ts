import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

@Injectable()
export class RecpatchaGuard implements CanActivate {
  private logger = new Logger(RecpatchaGuard.name);
  constructor(private cs: ConfigService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const headerValue = request.header('x-recaptcha');
    const ip = request.ip as string;
    if (!headerValue) throw new UnauthorizedException('Invalid captcha token');

    try {
      const { data } = await axios.post<{
        success: boolean;
        challenge_ts: Date;
        hostname: string;
        'error-codes': string[];
      }>('https://www.google.com/recaptcha/api/siteverify', {
        secret: this.cs.getOrThrow<string>('RECAPTCHA_SECRET'),
        remoteip: ip,
        response: headerValue,
      });

      const frontendHostname = new URL(
        this.cs.getOrThrow<string>('FRONT_END_ORIGIN'),
      ).host;
      if (data.success && data.hostname != frontendHostname)
        throw new UnauthorizedException();
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      else if (e instanceof AxiosError) {
        this.logger.warn(`axios error - ${e.status}`, {
          errorCodes: e.response?.data?.['error-codes']?.join(','),
        });
        throw new UnauthorizedException();
      }
      throw new InternalServerErrorException(e);
    }
  }
}
