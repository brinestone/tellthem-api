import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from '@modules/drizzle';

@Module({
  imports: [ConfigModule.forRoot(), DrizzleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
