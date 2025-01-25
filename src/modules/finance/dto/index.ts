import { PhoneNumberUtil } from 'google-libphonenumber';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import * as CountryData from '../../../assets/countries.json';

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

export const ExchangerateQuerySchema = z
  .object({
    src: z.string().length(3),
    dest: z
      .string()
      .transform((val) => val.toUpperCase().split(','))
      .pipe(z.string().length(3).array()),
  })
  .refine(({ src, dest }) => {
    const set = new Set(
      CountryData.flatMap((c) => c.currencies ?? []).map((c) => c.code),
    );

    if (!set.has(src)) {
      return {
        message: `The value for "src" (${src}) is invalid as it is an unsupported currency code`,
      };
    }
    for (const code of dest) {
      if (!set.has(code)) {
        return {
          message: `The value for "dest" contains an unsupported currency code: ${code}`,
        };
      }
    }
    return true;
  });

export class UpdatePaymentMethodDto extends createZodDto(
  UpdatePaymentMethodSchema,
) {}
