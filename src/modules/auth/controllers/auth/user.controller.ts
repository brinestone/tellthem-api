import { User } from '@modules/auth/decorators';
import { UserService } from '@modules/auth/services';
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ZodValidationPipe } from '@pipes/zod';
import { updatePrefSchema, UpdatePrefsInput, UserInfo } from '@schemas/users';

@Controller('users')
export class UserController {
  @Patch('prefs')
  async updateprefs(
    @User() { id }: UserInfo,
    @Body(new ZodValidationPipe(updatePrefSchema)) input: UpdatePrefsInput,
  ) {
    return await this.userService.updateUserPrefs(id, input);
  }
  @Get('prefs')
  async getUserPrefs(@User() { id }: UserInfo) {
    return await this.userService.findUserPrefs(id);
  }

  constructor(private userService: UserService) {}
}
