import { registerAs } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export default registerAs(
  'jwtConfig',
  (): JwtModuleOptions => ({
    secret: String(process.env.JWT_SECRET),
    signOptions: {
      expiresIn: String(process.env.JWT_LIFETIME),
    },
  }),
);
