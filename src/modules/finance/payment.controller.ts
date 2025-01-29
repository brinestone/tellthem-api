import {
  PAYMENT_COLLECTION_REQUESTED,
  PAYMENT_STATUS_CHANGED,
} from '@events/finance';
import { Public, User } from '@modules/auth/decorators';
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Patch,
  Query,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ApiBearerAuth, ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserInfo } from '@schemas/users';
import { zodToOpenAPI, ZodValidationPipe } from 'nestjs-zod';
import {
  PaymentMethodProviderNames,
  UpdatePaymentMethodDto,
  UpdatePaymentMethodSchema,
} from './dto';
import { CollectPaymentRequestedEvent, PaymentUpdatedEvent } from './events';
import { FinanceService } from './finance.service';

@Controller('/payment')
@ApiTags('Payments')
export class PaymentController {
  private logger = new Logger(PaymentController.name);
  constructor(
    private financeService: FinanceService,
    // private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  @Delete('method')
  @ApiQuery({
    name: 'provider',
    schema: zodToOpenAPI(UpdatePaymentMethodSchema.shape.provider),
    required: true,
  })
  async removePaymentMethod(
    @Query('provider') provider: PaymentMethodProviderNames,
    @User() { id }: UserInfo,
  ) {
    await this.financeService.removePaymentMethod(id, provider);
  }

  @Patch('method')
  @ApiBody({ schema: zodToOpenAPI(UpdatePaymentMethodSchema) })
  async updatePaymentMethod(
    @Body(new ZodValidationPipe()) input: UpdatePaymentMethodDto,
    @User() { id }: UserInfo,
  ) {
    await this.financeService.updatePaymentMethod(id, input);
  }

  @OnEvent(PAYMENT_COLLECTION_REQUESTED)
  async handlePaymentCollectionRequest({
    amount,
    currency,
    provider,
    user,
    walletTransaction,
  }: CollectPaymentRequestedEvent) {
    const paymentMethod =
      await this.financeService.findPaymentMethodParmsByOwner(user, provider);

    if (!paymentMethod) {
      this.logger.warn(
        'cannot collect payment funds due to an unregistered payment method provider specified ' +
          provider,
      );
      return;
    }

    switch (provider) {
      default:
        this.logger.warn(
          'cannot collect payment funds due to an unsupported payment method provider specified ' +
            provider,
        );
        return;
      case 'virtual': {
        try {
          const res = await this.financeService.collectVirtualFunds(
            currency,
            amount,
            walletTransaction,
          );

          void this.eventEmitter.emitAsync(
            PAYMENT_STATUS_CHANGED,
            new PaymentUpdatedEvent(res.id, res.walletTransaction ?? undefined),
          );
        } catch (e) {
          this.logger.error(e.message, e.stack);
        }
        break;
      }
    }
  }

  @Public()
  @ApiTags('Public Api')
  @Get('providers')
  getPaymentMethodProviders() {
    return this.financeService.getPaymentMethods();
  }

  @Get('methods')
  @ApiBearerAuth()
  async findUserPaymentMethods(@User() { id }: UserInfo) {
    return this.financeService.findUserPaymentMethods(id);
  }
}
