import { NewCampaignSchema, UpdateCampaignSchema } from '@schemas/campaigns';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CampaignPublicationSchema = z.object({
  id: z.number(),
  publishBefore: z.string().nullable().pipe(z.coerce.date().nullable()),
  publishAfter: z.string().nullable().pipe(z.coerce.date().nullable()),
  creditAllocation: z.object({
    id: z.string().uuid(),
    allocated: z.number(),
    exhausted: z.union([z.string(), z.number()]).pipe(z.coerce.number()),
  }),
});

export const CampaignPublicationLookupSchema = z.object({
  broadcast_count: z.string().pipe(z.coerce.number()),
  click_count: z.string().pipe(z.coerce.number()),
  total_exhausted_credits: z.string().pipe(z.coerce.number()),
  creditAllocation: z.string(),
  campaign: z.string().pipe(z.coerce.number()),
  updatedAt: z.string().pipe(z.coerce.date()),
  id: z.string().pipe(z.coerce.number()),
  createdAt: z.string().pipe(z.coerce.date()),
  owner: z.string().pipe(z.coerce.number()),
});

export const CampaignLookupPaginationValidationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((n) => {
      if (n && /^\d+$/.test(n)) return n;
      return undefined;
    })
    .pipe(z.coerce.number().optional().default(0)),
  size: z
    .string()
    .optional()
    .transform((n) => {
      if (n && /^\d+$/.test(n)) return n;
      return undefined;
    })
    .pipe(z.coerce.number().optional().default(10)),
});

export class NewCampaignDto extends createZodDto(NewCampaignSchema) {}
export class UpdateCampaignDto extends createZodDto(UpdateCampaignSchema) {}
