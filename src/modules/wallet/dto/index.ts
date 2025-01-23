import { PaymentMethodProviderNameSchema } from '@modules/finance/dto';
import { z } from 'zod';

export const WalletBalanceSchema = z.object({
  balance: z.union([z.string(), z.number()]).pipe(z.coerce.number()),
  ownerId: z.number(),
  id: z.string(),
});

export const BalancesSchema = z.object({
  funding: WalletBalanceSchema,
  rewards: WalletBalanceSchema,
});

export const WalletTransfersInputValidationSchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .optional()
    .pipe(z.coerce.number().min(0).optional().default(0)),
  size: z
    .union([z.string(), z.number()])
    .optional()
    .pipe(z.coerce.number().min(1).optional().default(20)),
});

export const WalletTopupInputValidationSchema = z.object({
  paymentMethod:
    process.env['NODE_ENV'] === 'production'
      ? PaymentMethodProviderNameSchema.exclude(['virtual'])
      : PaymentMethodProviderNameSchema,
  amount: z.number().min(0),
  currency: z
    .string()
    .length(3)
    .transform((s) => s.toUpperCase()),
});

export type WalletTopupInput = z.infer<typeof WalletTopupInputValidationSchema>;

export const WalletTransferSchema = z.object({
  id: z.string(),
  from: z.string().uuid().nullable(),
  to: z.string().uuid(),
  amount: z.number().nullable(),
  status: z.enum(['pending', 'cancelled', 'complete']),
  type: z.enum(['funding', 'reward', 'withdrawal']),
  date: z.date(),
  payment: z
    .object({
      id: z.string().uuid(),
      currency: z.string(),
      amount: z.number(),
      status: z.enum(['pending', 'cancelled', 'complete']),
    })
    .nullable(),
});

export const WalletTransfersResponseSchema = z.object({
  total: z.number(),
  data: z.array(WalletTransferSchema),
});
