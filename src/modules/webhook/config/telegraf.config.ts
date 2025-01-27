import { registerAs } from '@nestjs/config';

export default registerAs('telegrafConfig', () => {
  // console.log(process.env);
  return {
    botToken: String(process.env['TM_BOT_TOKEN']),
    tunnelToken: String(process.env['NGROK_TOKEN']),
    tunnelEnabled:
      process.env.TUNNEL === undefined ? false : Boolean(process.env.TUNNEL),
    origin: String(process.env['ORIGIN']),
    tmSecretToken: String(process.env['TM_WEBHOOK_SECRET']),
    tunnelPort: Number(process.env['PORT']),
  };
});
