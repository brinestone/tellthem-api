import { newPublicationSchema } from '@schemas/campaigns';
import { createZodDto } from 'nestjs-zod';

export class NewPublicationDto extends createZodDto(newPublicationSchema) {}
