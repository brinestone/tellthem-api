import { PREFS_UPDATED } from '@events/user';
import { User } from '@modules/auth/decorators';
import { UpdatePrefsDto } from '@modules/auth/dto';
import { UserPrefsUpdatedEvent } from '@modules/auth/events';
import { UserService } from '@modules/auth/services';
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { updatePrefSchema, UserInfo, UserPrefsSchema } from '@schemas/users';
import { zodToOpenAPI, ZodValidationPipe } from 'nestjs-zod';

@Controller('users')
export class UserController {
  @Patch('prefs')
  @ApiBody({
    description: 'Update user preferences',
    schema: zodToOpenAPI(updatePrefSchema),
    type: 'UpdatePrefsInput',
  })
  async updateprefs(
    @User() { id }: UserInfo,
    @Body(new ZodValidationPipe(updatePrefSchema)) input: UpdatePrefsDto,
  ) {
    await this.userService.updateUserPrefs(id, input);
    void this.eventEmitter.emitAsync(
      PREFS_UPDATED,
      new UserPrefsUpdatedEvent(id),
    );
  }
  @Get('prefs')
  @ApiResponse({ schema: zodToOpenAPI(UserPrefsSchema) })
  async getUserPrefs(@User() { id }: UserInfo) {
    const result = await this.userService.findUserPrefs(id);
    return UserPrefsSchema.parse(result);
  }

  constructor(
    private userService: UserService,
    private eventEmitter: EventEmitter2,
  ) {}
}
