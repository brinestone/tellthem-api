import { BALANCE_UPDATED } from '@events/wallet';
import { Public, User } from '@modules/auth/decorators';
import { QueryUrlGuard } from '@modules/auth/guards';
import { WalletBalanceUpdatedEvent } from '@modules/wallet/events';
import { Controller, Req, Sse, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserInfo } from '@schemas/users';
import { Request } from 'express';
import { Subject } from 'rxjs';

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
  getUpdates(@Req() req: Request, @User() user: UserInfo) {
    let subject = this.notificationSubjects.get(user.id);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.notificationSubjects.set(user.id, subject);
    }

    return subject.asObservable();
  }
}
