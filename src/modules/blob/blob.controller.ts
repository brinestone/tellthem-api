import {
  CAMPAIGN_DELETED,
  CAMPAIGN_UPDATED,
  NEW_CAMPAIGN,
} from '@events/campaign';
import { Public } from '@modules/auth/decorators';
import {
  BaseCampaignEvent,
  CampaignDeletedEvent,
} from '@modules/campaign/events';
import { DRIZZLE, DrizzleDb } from '@modules/drizzle';
import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  ParseFilePipeBuilder,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService, ConfigType } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiConsumes,
  ApiProduces,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { campaignBlobs, vwCampaignBlobs } from '@schemas/campaigns';
import { createHash } from 'crypto';
import { eq, inArray, or } from 'drizzle-orm';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { Stream } from 'stream';
import blobConfig from './config/blob.config';

function computeStorageKey(buff: Buffer) {
  const cipher = createHash('md5');
  cipher.update(buff);
  return cipher.digest('hex');
}

const servingMimeTypes = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'video/x-flv',
  'video/webm',
  'video/x-matroska',
  'video/mpeg',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
  'image/webp',
  'image/tiff',
];

@Controller('blob')
export class BlobController {
  @OnEvent(CAMPAIGN_DELETED)
  private async removeCampaignFiles(arg: CampaignDeletedEvent) {
    this.logger.verbose('removing files linked to deleted campaign ' + arg.id);
    let deletedFiles = 0;
    try {
      const blobs = await this.db
        .select()
        .from(vwCampaignBlobs)
        .where(or(eq(vwCampaignBlobs.isStale, true)));

      if (blobs.length == 0) return;

      for (const blob of blobs) {
        await rm(blob.path, { recursive: true, force: true });
      }

      const { rowCount } = await this.db.transaction((t) =>
        t.delete(campaignBlobs).where(
          inArray(
            campaignBlobs.id,
            blobs.map((b) => b.id),
          ),
        ),
      );
      deletedFiles = rowCount ?? blobs.length;
    } catch (e) {
      this.logger.error(e.message, e.stack);
    } finally {
      this.logger.verbose(`Removed ${deletedFiles} file(s)`);
    }
  }

  @OnEvent(NEW_CAMPAIGN)
  @OnEvent(CAMPAIGN_UPDATED)
  private async linkCampaignToUploads(arg: BaseCampaignEvent) {
    this.logger.verbose(
      'moving files from temporary file from temporary storage',
    );
    let movedFiles = 0;
    try {
      const campaign = await this.db.query.campaigns.findFirst({
        columns: { media: true },
        where: (campaign, { eq }) => eq(campaign.id, arg.id),
      });

      if (!campaign?.media || campaign.media.length == 0) return;

      const keys = campaign.media
        .map((s) => s.substring(s.lastIndexOf('/') + 1))
        .map((file) => file.substring(0, file.lastIndexOf('.')));

      const { rowCount } = await this.db.transaction((t) =>
        t
          .update(campaignBlobs)
          .set({
            campaign: arg.id,
            storage: 'permanent',
          })
          .where(inArray(campaignBlobs.id, keys)),
      );
      movedFiles = rowCount ?? 0;
    } catch (e) {
      this.logger.error(e.message, e.stack);
    } finally {
      this.logger.verbose(`moved ${movedFiles} file(s) to permanent storage`);
    }
  }

  @Get(':file')
  @Public()
  @ApiProduces(...servingMimeTypes)
  serveFile(@Res() res: Response, @Param('file') file: string) {
    const key = file.substring(0, file.lastIndexOf('.'));
    const ext = file.substring(file.lastIndexOf('.'));
    const filename = join(this.config.uploadsLocation, key, `upload${ext}`);
    let stream: Stream;
    if (existsSync(filename)) {
      stream = createReadStream(filename);
    } else throw new NotFoundException('file not found');

    stream.pipe(res);
  }

  @Post()
  @ApiAcceptedResponse({ type: [String] })
  @ApiUnprocessableEntityResponse({ description: 'The file is not supported' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async handleUpload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: 6291456,
        })
        .addFileTypeValidator({
          fileType:
            /^(video\/(mp4|quicktime|x-msvideo|x-ms-wmv|x-flv|webm|x-matroska|mpeg)|image\/(jpeg|png|gif|bmp|svg\+xml|webp|tiff))$/i,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ) {
    const key = computeStorageKey(file.buffer);
    const dir = join(this.config.uploadsLocation, key);
    const ext = file.originalname.substring(file.originalname.lastIndexOf('.'));
    const filename = join(dir, `upload${ext}`);

    // Update db
    await this.db.transaction((t) =>
      t
        .insert(campaignBlobs)
        .values({
          id: key,
          path: dir,
          size: file.size,
          tempWindow: '24h',
          storage: 'temporary',
        })
        .onConflictDoUpdate({
          target: [campaignBlobs.id],
          set: { updatedAt: new Date() },
        }),
    );

    // Write file to storage
    await mkdir(dir, { recursive: true });
    await writeFile(filename, file.buffer);
    // TODO: make thumbnails for images and preview videos for video uploads.

    const link = `${this.configService.getOrThrow<string>('ORIGIN')}/blob/${key}${ext}`;

    return [link];
  }

  private logger = new Logger(BlobController.name);
  constructor(
    @Inject(blobConfig.KEY) private config: ConfigType<typeof blobConfig>,
    private configService: ConfigService,
    @Inject(DRIZZLE) private db: DrizzleDb,
  ) {}
}
