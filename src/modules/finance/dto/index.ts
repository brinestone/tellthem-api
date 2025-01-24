import { PhoneNumberUtil } from 'google-libphonenumber';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const PaymentMethodProviderNameSchema = z.enum(['momo', 'virtual']);

export const UpdateMomoPaymentMethodSchema = z.object({
  phoneNumber: z.string().refine((phone) => {
    const util = PhoneNumberUtil.getInstance();
    const p = util.parseAndKeepRawInput(phone);
    return util.isValidNumber(p);
  }),
});

export const UpdatePaymentMethodSchema = z.object({
  provider: PaymentMethodProviderNameSchema.exclude(['virtual']),
  data: UpdateMomoPaymentMethodSchema,
});

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

export class UpdatePaymentMethodDto extends createZodDto(
  UpdatePaymentMethodSchema,
) {}
