import { NewCampaignSchema, UpdateCampaignSchema } from '@schemas/campaigns';
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

export type NewCampaignDto = z.infer<typeof NewCampaignSchema>;
export type UpdateCampaignDto = z.infer<typeof UpdateCampaignSchema>;
