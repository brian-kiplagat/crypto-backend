import { validator } from 'hono/validator';
import { z } from 'zod';

import { validateSchema } from './validator.js';

const createTradeSchema = z.object({
  offer_id: z.number().int().positive('Offer ID must be a positive integer'),
  fiat_amount: z.number().positive('Fiat amount must be a positive number'),
});

const createTradeValidator = validator('json', (value, c) => {
  return validateSchema(c, createTradeSchema, value);
});

const reopenTradeSchema = z.object({
  trade_id: z.number().int().positive('Trade ID must be a positive integer'),
});

const reopenTradeValidator = validator('json', (value, c) => {
  return validateSchema(c, reopenTradeSchema, value);
});

const markPaidSchema = z.object({
  payment_proof: z.string().optional(),
  notes: z.string().optional(),
});

const markPaidValidator = validator('json', (value, c) => {
  return validateSchema(c, markPaidSchema, value);
});

const cancelTradeSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

const cancelTradeValidator = validator('json', (value, c) => {
  return validateSchema(c, cancelTradeSchema, value);
});

const openDisputeSchema = z.object({
  reason: z.string().min(1, 'Dispute reason is required'),
  explanation: z.string().min(10, 'Dispute explanation must be at least 10 characters'),
});

const openDisputeValidator = validator('json', (value, c) => {
  return validateSchema(c, openDisputeSchema, value);
});

const resolveDisputeSchema = z.object({
  awarded_to: z.enum(['buyer', 'seller'], {
    errorMap: () => ({ message: 'Awarded to must be either buyer or seller' }),
  }),
  mod_notes: z.string().optional(),
});

const resolveDisputeValidator = validator('json', (value, c) => {
  return validateSchema(c, resolveDisputeSchema, value);
});

const releaseCryptoSchema = z.object({
  tx_hash: z.string().optional(),
  notes: z.string().optional(),
});

const releaseCryptoValidator = validator('json', (value, c) => {
  return validateSchema(c, releaseCryptoSchema, value);
});

const filterTradesSchema = z.object({
  status: z
    .enum([
      'OPENED',
      'PAID',
      'SUCCESSFUL',
      'CANCELLED_BUYER',
      'CANCELLED_SELLER',
      'CANCELLED_SYSTEM',
      'AWARDED_BUYER',
      'AWARDED_SELLER',
      'DISPUTED',
    ])
    .optional(),
  buyer_id: z.number().int().positive().optional(),
  seller_id: z.number().int().positive().optional(),
  offer_id: z.number().int().positive().optional(),
  min_amount: z.number().positive().optional(),
  max_amount: z.number().positive().optional(),
  dispute_started: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const filterTradesValidator = validator('json', (value, c) => {
  return validateSchema(c, filterTradesSchema, value);
});

const updateTradeSchema = z.object({
  fiat_amount_original: z.number().positive().optional(),
  fiat_amount_with_margin: z.number().positive().optional(),
  btc_amount_with_margin: z.number().positive().optional(),
  btc_amount_original: z.number().positive().optional(),
  price: z.number().positive().optional(),
  status: z
    .enum([
      'OPENED',
      'PAID',
      'SUCCESSFUL',
      'CANCELLED_BUYER',
      'CANCELLED_SELLER',
      'CANCELLED_SYSTEM',
      'AWARDED_BUYER',
      'AWARDED_SELLER',
      'DISPUTED',
    ])
    .optional(),
  moderator_flag: z.string().optional(),
  cancelled: z.string().optional(),
  dispute_started: z.boolean().optional(),
  dispute_reason: z.string().optional(),
  dispute_explanation: z.string().optional(),
  dispute_started_by: z.string().optional(),
  dispute_mod_notes: z.string().optional(),
  escrow_return: z.boolean().optional(),
  expiry_time: z.string().datetime().optional(),
});

const updateTradeValidator = validator('json', (value, c) => {
  return validateSchema(c, updateTradeSchema, value);
});

type CreateTradeBody = z.infer<typeof createTradeSchema>;
type ReopenTradeBody = z.infer<typeof reopenTradeSchema>;
type MarkPaidBody = z.infer<typeof markPaidSchema>;
type CancelTradeBody = z.infer<typeof cancelTradeSchema>;
type OpenDisputeBody = z.infer<typeof openDisputeSchema>;
type ResolveDisputeBody = z.infer<typeof resolveDisputeSchema>;
type ReleaseCryptoBody = z.infer<typeof releaseCryptoSchema>;
type FilterTradesBody = z.infer<typeof filterTradesSchema>;
type UpdateTradeBody = z.infer<typeof updateTradeSchema>;

export {
  type CancelTradeBody,
  cancelTradeValidator,
  type CreateTradeBody,
  createTradeValidator,
  type FilterTradesBody,
  filterTradesValidator,
  type MarkPaidBody,
  markPaidValidator,
  type OpenDisputeBody,
  openDisputeValidator,
  type ReleaseCryptoBody,
  releaseCryptoValidator,
  type ReopenTradeBody,
  reopenTradeValidator,
  type ResolveDisputeBody,
  resolveDisputeValidator,
  type UpdateTradeBody,
  updateTradeValidator,
};
