import { newPublicationSchema } from '@schemas/campaigns';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const BroadcastViewUpsertSchema = z.object({
  deviceInfo: z.object({
    hash: z.string(),
    height: z.number(),
    width: z.number(),
    concurrency: z.number(),
  }),
});

export class NewPublicationDto extends createZodDto(newPublicationSchema) {}
