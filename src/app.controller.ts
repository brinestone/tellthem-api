import { PREFS_UPDATED } from '@events/user';
import { BALANCE_UPDATED } from '@events/wallet';
import { Public, User } from '@modules/auth/decorators';
import { UserPrefsUpdatedEvent } from '@modules/auth/events';
import { WalletBalanceUpdatedEvent } from '@modules/wallet/events';
import { Controller, Get, Ip, Req, Sse } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserInfo } from '@schemas/users';
import { Request } from 'express';
import { Subject } from 'rxjs';
import * as CountryData from './assets/countries.json';

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@Controller()
export class AppController {
  private notificationSubjects = new Map<
    number,
    Record<string, Subject<MessageEvent>>
  >();
  constructor() {}

  @Get('/countries')
  @Public()
  @ApiOperation({
    summary: 'Get supported countries',
    description: 'Retrieve all supported countries',
  })
  @ApiTags('Public')
  findAllCountries() {
    return CountryData;
  }

  @OnEvent(PREFS_UPDATED)
  onUserPrefsUpdated({ userId }: UserPrefsUpdatedEvent) {
    const dict = this.notificationSubjects.get(userId);
    if (!dict) return;

    Object.values(dict).forEach((s) =>
      s.next({ data: { event: 'prefs.update' } }),
    );
  }

  @OnEvent(BALANCE_UPDATED)
  onWalletBalanceUpdated({ owner }: WalletBalanceUpdatedEvent) {
    const dict = this.notificationSubjects.get(owner);
    if (!dict) return;

    Object.values(dict).forEach((s) =>
      s.next({
        data: { event: 'balance.update' },
      }),
    );
  }

  @Sse('updates')
  getUpdates(@Ip() ip: string, @Req() req: Request, @User() user: UserInfo) {
    let dict = this.notificationSubjects.get(user.id);
    if (!dict) {
      dict = { [ip]: new Subject<MessageEvent>() };
      this.notificationSubjects.set(user.id, dict);
    }
    req.on('finish', () => {
      if (!dict || Object.keys(dict).length == 0) {
        this.notificationSubjects.delete(user.id);
        return;
      }

      dict[ip].complete();
      delete dict[ip];

      if (Object.keys(dict).length == 0) {
        this.notificationSubjects.delete(user.id);
      }
    });
    return dict[ip].asObservable();
  }
}
