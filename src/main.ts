import telegrafConfig from '@modules/webhook/config/telegraf.config';
import { Logger } from '@nestjs/common';
import { ConfigService, ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { patchNestJsSwagger } from 'nestjs-zod';
import { connect } from 'ngrok';
import { concatMap, from } from 'rxjs';
import { Telegraf } from 'telegraf';
import { AppModule } from './app.module';

async function setupTelegramWebhook() {
  const logger = this.logger;
  const webhook = {
    domain: this.config.origin,
    path: '/webhook/tm',
    secretToken: this.config.tmSecretToken,
  };
  if (this.config.tunnelEnabled) {
    logger.log('tunnel enabled');
    logger.log('starting tunnel');
    let isFirstTunnelling = true;
    const tunnel = await connect({
      authtoken: this.config.tunnelToken,
      port: this.config.tunnelPort,
      onStatusChange: (status) => {
        switch (status) {
          case 'closed':
            logger.log('tunnel closed');
            isFirstTunnelling = false;
            break;
          case 'connected':
            if (isFirstTunnelling) {
              logger.log('tunnel connected');
            } else {
              logger.log('tunnel re-connected');
            }
        }
      },
    });
    logger.log('tunnel started. updating bot launch configuration');
    webhook.domain = tunnel;
    this.app.use(await this.bot.createWebhook(webhook));
    logger.log('telegram bot launched successfully');
  } else {
    logger.log('tunnel disabled');
  }
  logger.log('launching telegram bot');
  this.bot.launch();
}

const rootLogger = new Logger('ROOT');
from(NestFactory.create(AppModule))
  .pipe(
    concatMap(async (app) => {
      const bot = app.get(Telegraf);
      const config = app.get<ConfigType<typeof telegrafConfig>>(
        telegrafConfig.KEY,
      );
      await setupTelegramWebhook.bind({
        bot,
        config,
        logger: rootLogger,
        app,
      })();

      return app as NestExpressApplication;
    }),
    concatMap((app) => {
      const configService = app.get(ConfigService);
      const port = configService.getOrThrow<number>('PORT');
      app.enableCors();
      const config = new DocumentBuilder()
        .setTitle('TellThem API')
        .setVersion('1.0')
        .addBearerAuth()
        .addOAuth2()
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
      app.set('trust proxy', true);
      return app.listen(port, () =>
        rootLogger.log('Server started on ' + port),
      );
    }),
  )
  .subscribe({
    error: (error: Error) => {
      rootLogger.error('error occured while starting server', error.stack);
      process.exit(1);
    },
  });
