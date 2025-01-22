import { Logger } from '@nestjs/common';
import { TunnelInit } from './index';

type WebHookSetupResponse = {
  ok: boolean;
  result: boolean;
  description: string;
};

const logger = new Logger('tunnel.webhook.telegram');
const init: TunnelInit = async (url) => {
  logger.log('Registering telegram webhooks tunnel');

  // Remove existing integration
  await fetch(
    `https://api.telegram.org/bot${process.env['TM_BOT_TOKEN']}/setWebhook?url=`,
    { method: 'GET' },
  )
    .then((r) => r.json())
    .then(() => logger.log('webhook removed'))
    .catch((e: Error) => logger.error(e.message, e.stack));

  // Setup webhooks
  const response: WebHookSetupResponse = await fetch(
    `https://api.telegram.org/bot${process.env['TM_BOT_TOKEN']}/setWebhook?secret_token=${process.env['TM_WEBHOOK_SECRET']}&url=${encodeURIComponent(`${url}/api/webhooks/tm`)}`,
    { method: 'GET' },
  ).then((response) => response.json());

  if (!response.ok) throw new Error(response.description);
  logger.log(response.description);
};

export default init;
