import { validator } from 'hono/validator';
import { z } from 'zod';

import { validateSchema } from './validator.js';

const chargeCustomerSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
  email: z.string().email('Invalid email format'),
  amount: z
    .number()
    .int()
    .positive('Amount must be a positive integer (in pence)')
    .min(50, 'Minimum amount is 50 pence')
    .optional(),
});

const chargeCustomerValidator = validator('json', (value, c) => {
  return validateSchema(c, chargeCustomerSchema, value);
});

const chargeAllCustomersSchema = z.object({
  amount: z
    .number()
    .int()
    .positive('Amount must be a positive integer (in pence)')
    .min(50, 'Minimum amount is 50 pence')
    .optional(),
});

const chargeAllCustomersValidator = validator('json', (value, c) => {
  return validateSchema(c, chargeAllCustomersSchema, value);
});

type ChargeCustomerBody = z.infer<typeof chargeCustomerSchema>;
type ChargeAllCustomersBody = z.infer<typeof chargeAllCustomersSchema>;

export {
  type ChargeAllCustomersBody,
  chargeAllCustomersValidator,
  type ChargeCustomerBody,
  chargeCustomerValidator,
};
