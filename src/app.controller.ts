import { PREFS_UPDATED } from '@events/user';
import { BALANCE_UPDATED } from '@events/wallet';
import { Public, User } from '@modules/auth/decorators';
import { UserPrefsUpdatedEvent } from '@modules/auth/events';
import { WalletBalanceUpdatedEvent } from '@modules/wallet/events';
import { Controller, Get, Ip, Query, Req, Sse, UsePipes } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserInfo } from '@schemas/users';
import { Request } from 'express';
import { filter, from, Subject, toArray } from 'rxjs';
import * as CountryData from './assets/countries.json';
import { z } from 'zod';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';

export const GetCountryByIso2CodeSchema = z.object({
  alpha2Code: z
    .string()
    .length(2)
    .transform((val) => val.toUpperCase())
    .or(
      z
        .string()
        .transform((val) => val.toUpperCase().split(','))
        .pipe(z.string().length(2).array()),
    ),
});

class GetCountryByIsoCodeDto extends createZodDto(GetCountryByIso2CodeSchema) {}

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

  @Get('countries')
  @Public()
  @ApiOperation({
    summary: 'Get supported countries',
    description: 'Retrieve all supported countries',
  })
  @ApiTags('Public Api')
  findAllCountries() {
    return CountryData;
  }
  @Get('countries/find')
  @ApiTags('Public Api')
  @UsePipes(ZodValidationPipe)
  @ApiQuery({
    required: false,
    description: 'A comma-separated list of country ISO-2 codes',
    type: String,
  })
  findCountriesByIso2Code(@Query() input: GetCountryByIsoCodeDto) {
    return from(CountryData).pipe(
      filter(({ alpha2Code: code }) => {
        if (typeof input.alpha2Code == 'string') {
          return code == input.alpha2Code;
        } else {
          return input.alpha2Code.includes(code);
        }
      }),
      toArray(),
    );
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
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: 'Real-time updates',
    description: 'Rceive real-time update events for a user',
  })
  @ApiBearerAuth()
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
