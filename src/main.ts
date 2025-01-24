import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { concatMap, from } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { patchNestJsSwagger } from 'nestjs-zod';

const rootLogger = new Logger('ROOT');
from(NestFactory.create(AppModule))
  .pipe(
    concatMap((app) => {
      const configService = app.get(ConfigService);
      const port = configService.getOrThrow<number>('PORT');
      app.enableCors();
      const config = new DocumentBuilder()
        .setTitle('TellThem API')
        .setVersion('1.0')
        .addBearerAuth()
        .addOAuth2()
        .addTag('Public')
        .addServer(configService.getOrThrow<string>('ORIGIN'))
        .build();
      const document = SwaggerModule.createDocument(app, config);
      patchNestJsSwagger();
      SwaggerModule.setup('docs', app, document);

      app.use(
        '/docs-json',
        apiReference({
          spec: document,
          cdn: 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest',
        }),
      );
      return app.listen(port, () =>
        rootLogger.log('Server started on ' + port),
      );
    }),
  )
  .subscribe({
    error: (error: Error) =>
      rootLogger.error('error occured while starting server', error.stack),
  });
