import { registerAs } from '@nestjs/config';

export default registerAs('googleCredentials', () => ({
  clientId: String(process.env.GOOGLE_CLIENT_ID),
  clientSecret: String(process.env.GOOGLE_CLIENT_SECRET),
  callbackUrl: String(process.env.GOOGLE_CALLBACK_URL),
}));
