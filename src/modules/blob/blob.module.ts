import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import blobConfig from './config/blob.config';
import { BlobController } from './blob.controller';
import { DrizzleModule } from '@modules/drizzle';

@Module({
  imports: [ConfigModule.forFeature(blobConfig), DrizzleModule],
  controllers: [BlobController],
})
export class BlobModule {}
