import { updatePrefSchema } from '@schemas/users';
import { createZodDto } from 'nestjs-zod';
import { hashThese } from 'src/util';
import { z } from 'zod';

export const UserClaimsSchema = z.object({
  email: z.string().email(),
  sub: z.number(),
  name: z.string(),
  image: z.string().nullable().optional(),
  tokenId: z.string().uuid().optional(),
  aud: z.string(),
});

export const TelegramCodeVerificationSchema = z.object({
  code: z
    .string()
    .length(6)
    .transform((arg) => hashThese(arg)),
});

export const TelegramBotMessageSchema = z.object({
  update_id: z.number(),
  message: z.object({
    message_id: z.number(),
    from: z.object({
      id: z.number(),
      is_bot: z.boolean(),
      first_name: z.string(),
      username: z.string(),
      language_code: z.string(),
    }),
    chat: z.object({
      id: z.number(),
      first_name: z.string(),
      username: z.string(),
      type: z.string(),
    }),
    date: z.number(),
    text: z.string(),
  }),
});
export const TelegramBotCommandSchema = TelegramBotMessageSchema.extend({
  message: TelegramBotMessageSchema.shape.message.extend({
    entities: z.array(
      z.object({
        offset: z.number(),
        length: z.number(),
        type: z.enum(['bot_command']),
      }),
    ),
  }),
});

export const TelegramAccountConnectionDataSchema = z.object({
  chatId: TelegramBotMessageSchema.shape.message.shape.chat.shape.id,
  userInfo: TelegramBotMessageSchema.shape.message.shape.from,
});

export class TelegramCodeVerificationInput extends createZodDto(
  TelegramCodeVerificationSchema,
) {}

export class UserClaimsDto extends createZodDto(UserClaimsSchema) {}

export class UpdatePrefsDto extends createZodDto(updatePrefSchema) {}
