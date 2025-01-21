import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { fromZodError } from 'zod-validation-error';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { success, data, error } = this.schema.safeParse(value);

    if (!success) {
      throw new BadRequestException(fromZodError(error));
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data;
  }
}
