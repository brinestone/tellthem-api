import { registerAs } from '@nestjs/config';

export default registerAs('telegrafConfig', () => ({
  botToken: String(process.env['TM_BOT_TOKEN']),
  tunnelToken: String(process.env['NGROK_TOKEN']),
  tunnelEnabled: Boolean(process.env['TUNNEL'] === 'true'),
  origin: String(process.env['ORIGIN']),
  tmSecretToken: String(process.env['TM_WEBHOOK_SECRET']),
  tunnelPort: Number(process.env['PORT']),
}));
