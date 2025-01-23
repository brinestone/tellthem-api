import { z } from 'zod';

export const PaymentMethodProviderNameSchema = z.enum(['momo', 'virtual']);
export type PaymentMethodProviderNames = z.infer<
  typeof PaymentMethodProviderNameSchema
>;

export const PaymentMethodProviderSchema = z.object({
  label: z.string(),
  name: PaymentMethodProviderNameSchema,
  image: z.string().optional(),
});

export const ExchangerateQuerySchema = z.object({
  src: z.string().length(3),
  dest: z
    .string()
    .transform((val) => val.toUpperCase().split(','))
    .pipe(z.string().length(3).array()),
});
