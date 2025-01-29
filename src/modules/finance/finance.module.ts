import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { DrizzleModule } from '@modules/drizzle';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PaymentController } from './payment.controller';

@Module({
  imports: [DrizzleModule, ConfigModule, EventEmitterModule],
  controllers: [FinanceController, PaymentController],
  providers: [FinanceService],
})
export class FinanceModule {}
