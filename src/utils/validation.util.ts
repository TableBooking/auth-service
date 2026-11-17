import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: { fields: result.error.issues.map((i) => i.path.join('.')) },
    });
  return result.data;
}
