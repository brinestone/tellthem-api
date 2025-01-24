import {
  ACCOUNT_CONNECTION_DELETED,
  NEW_ACCOUNT_CONNECTION,
} from '@events/connection';
import { User } from '@modules/auth/decorators';
import {
  TelegramCodeVerificationInput,
  TelegramCodeVerificationSchema,
} from '@modules/auth/dto';
import {
  AccountConnectionCreatedEvent,
  AccountConnectionDeletedEvent,
} from '@modules/auth/events';
import { UserService } from '@modules/auth/services';
import { TelegramService } from '@modules/auth/services/telegram.service';
import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { AccountConnectionSchema, UserInfo } from '@schemas/users';
import { zodToOpenAPI, ZodValidationPipe } from 'nestjs-zod';
import { z } from 'zod';

@Controller('connections')
export class ConnectionController {
  constructor(
    private userService: UserService,
    private telegramService: TelegramService,
    private eventEmitter: EventEmitter2,
  ) {}

  @Get('disconnect/tm')
  @ApiOperation({
    description: "Remove a user's Telegram account connection",
    summary: 'Remove Telegram connection',
  })
  @ApiNotFoundResponse({
    description: 'No telegram account connection could be found',
  })
  @ApiOkResponse({
    description: 'The disconnection was successfull',
  })
  async removeTelegramAccountConnection(@User() user: UserInfo) {
    const id = await this.telegramService.removeConnection(user.id);
    if (!id) throw new NotFoundException('Connection not found');

    void this.eventEmitter.emitAsync(
      ACCOUNT_CONNECTION_DELETED,
      new AccountConnectionDeletedEvent('telegram', id, user.id),
    );
  }

  @Get('verify/tm')
  @ApiOperation({
    summary: 'Connect Telegram account',
    description:
      "Verify a verification code from Telegram and connect a user's account to their Telegram account",
  })
  @ApiBody({ schema: zodToOpenAPI(TelegramCodeVerificationSchema) })
  @ApiNotFoundResponse({
    description: 'The code has expired or does not exist',
  })
  @ApiOkResponse({
    description:
      'The verification code was valid and the account was connected succefully with Telegram',
  })
  async verifyTelegramVerificationCode(
    @Query(new ZodValidationPipe()) input: TelegramCodeVerificationInput,
    @User() { id }: UserInfo,
  ) {
    const connectionId = await this.telegramService.registerTelegramConnection(
      id,
      input.code,
    );

    void this.eventEmitter.emitAsync(
      NEW_ACCOUNT_CONNECTION,
      new AccountConnectionCreatedEvent('telegram', connectionId, id),
    );
  }

  @Get()
  @ApiOkResponse({
    schema: zodToOpenAPI(z.array(AccountConnectionSchema)),
  })
  @ApiOperation({
    summary: 'Get account connections',
    description: "Retrieves a user's account connections.",
  })
  async findUserConnections(@User() user: UserInfo) {
    return await this.userService.findUserConnections(user.id);
  }
}
