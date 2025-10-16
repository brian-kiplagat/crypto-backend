import { validator } from 'hono/validator';
import { z } from 'zod';

import { validateSchema } from './validator.js';

const createCallSchema = z.object({
    to: z.string().min(6),
});

const createCallValidator = validator('json', (value, c) => {
    return validateSchema(c, createCallSchema, value);
});

type CreateCallBody = z.infer<typeof createCallSchema>;

export { type CreateCallBody, createCallValidator };
