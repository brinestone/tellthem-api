import { Logger } from '@nestjs/common';
import { LogWriter } from 'drizzle-orm/logger';

export class DefaultWriter implements LogWriter {
  private logger = new Logger('drizzle');

  write(message: string) {
    this.logger.verbose(message);
  }
}
