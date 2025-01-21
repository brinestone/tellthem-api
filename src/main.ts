import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { concatMap, from } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const rootLogger = new Logger('ROOT');
from(NestFactory.create(AppModule))
  .pipe(
    concatMap((app) => {
      const configService = app.get(ConfigService);
      const port = configService.getOrThrow<number>('PORT');
      app.enableCors();
      return app.listen(port, () =>
        rootLogger.log('Server started on ' + port),
      );
    }),
  )
  .subscribe({
    error: (error: Error) =>
      rootLogger.error('error occured while starting server', error.stack),
  });
