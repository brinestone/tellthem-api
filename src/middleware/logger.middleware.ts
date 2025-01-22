import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger(LoggerMiddleware.name);
  use(req: Request, res: Response, next: (error?: any) => void) {
    const start = Date.now();
    res.on('finish', () => {
      const now = Date.now();
      const diff = (now - start) / 1000;
      const message = `${req.ip} ${req.method} ${req.originalUrl} -> ${res.statusCode} | +${diff}s`;
      if (res.statusCode < 400) {
        this.logger.verbose(message);
      } else if (res.statusCode >= 400 && res.statusCode < 500) {
        this.logger.warn(message);
      } else {
        this.logger.error(message);
      }
    });
    next();
  }
}
