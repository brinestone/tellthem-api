import { BALANCE_UPDATED } from '@events/wallet';
import { Public, User } from '@modules/auth/decorators';
import { QueryUrlGuard } from '@modules/auth/guards';
import { WalletBalanceUpdatedEvent } from '@modules/wallet/events';
import { Controller, Get, Ip, Sse, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserInfo } from '@schemas/users';
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
  private notificationSubjects = new Map<number, Subject<MessageEvent>>();
  constructor() {}

  @Get('/countries')
  @Public()
  findAllCountries() {
    return CountryData;
  }

  @OnEvent(BALANCE_UPDATED)
  onWalletBalanceUpdated({ owner }: WalletBalanceUpdatedEvent) {
    const subject = this.notificationSubjects.get(owner);
    if (!subject) return;

    subject.next({
      data: { event: 'balance.update' },
    });
  }

  @Sse('updates')
  @Public()
  @UseGuards(QueryUrlGuard)
  getUpdates(@Ip() ip: string, @User() user: UserInfo) {
    let subject = this.notificationSubjects.get(user.id);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.notificationSubjects.set(user.id, subject);
    }

    return subject.asObservable();
  }
}
