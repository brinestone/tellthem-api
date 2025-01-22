import { z } from 'zod';

export const UserClaimsSchema = z.object({
  email: z.string().email(),
  sub: z.number(),
  name: z.string(),
  image: z.string().nullable().optional(),
  tokenId: z.string().uuid().optional(),
  aud: z.string(),
});

export type UserClaims = z.infer<typeof UserClaimsSchema>;
