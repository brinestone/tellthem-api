import { z } from 'zod';

export const LookupCampaignSchema = z.object({
  id: z.number(),
  title: z.string(),
  publicationCount: z.union([z.string(), z.number()]).pipe(z.coerce.number()),
});
