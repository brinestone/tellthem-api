import { USER_CREATED } from '@events/user';
import { Public } from '@modules/auth/decorators';
import { UserCreatedEvent } from '@modules/auth/events';
import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { fromZodError } from 'zod-validation-error';
import { ExchangerateQuerySchema } from './dto';
import { FinanceService } from './finance.service';

@Controller('finance')
@Public()
export class FinanceController {
  private logger = new Logger(FinanceController.name);
  constructor(
    private readonly financeService: FinanceService,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService,
  ) {}

  @Get('exchange_rates')
  async getExchangeRates(@Req() req: Request) {
    const { success, data, error } = ExchangerateQuerySchema.safeParse(
      req.query,
    );

    if (!success) {
      throw new BadRequestException(fromZodError(error).message);
    }

    const { src, dest } = data;
    return await this.financeService.getExchangeRate(src, ...dest);
  }

  @Get('currencies')
  @ApiTags('Public Api')
  getCurrencies() {
    return this.financeService.getCurrencies();
  }

  @OnEvent(USER_CREATED)
  async onUserCreated({ userId }: UserCreatedEvent) {
    if (this.configService.get<string>('NODE_ENV') === 'production') return;
    try {
      await this.financeService.registerPaymentMethod(userId, 'virtual', {
        userId,
      });
    } catch (e) {
      this.logger.error(e.message, e.stack);
    }
  }
}
