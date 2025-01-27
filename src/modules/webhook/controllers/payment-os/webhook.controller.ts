import { WEBHOOK_EVENT } from '@events/webhook';
import { Public } from '@modules/auth/decorators';
import { WebhookEvent } from '@modules/webhook/events';
import { MesombGuard } from '@modules/webhook/guards/mesomb.guard';
import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiExcludeController } from '@nestjs/swagger';

@Public()
@ApiExcludeController()
@Controller('webhook')
export class WebhookController {
  @Post('mesomb')
  @UseGuards(MesombGuard)
  handleMesombEvent(@Body() event: Record<string, unknown>) {
    this.logger.log('handling mesomb webhook event');
    this.eventEmitter.emit(WEBHOOK_EVENT, new WebhookEvent('mesomb', event));
  }
  private logger = new Logger(WebhookController.name);
  constructor(private eventEmitter: EventEmitter2) {}
}
