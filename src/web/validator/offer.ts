import { validator } from 'hono/validator';
import { z } from 'zod';

import { validateSchema } from './validator.js';

const createOfferSchema = z.object({
  label: z.string().min(1).max(255),
  terms: z.string().min(1),
  instructions: z.string().min(1),
  currency: z.string().length(3),
  method_id: z.number().int().positive(),
  margin: z.number(),
});

const createOfferValidator = validator('json', (value, c) => {
  return validateSchema(c, createOfferSchema, value);
});

const updateOfferSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  terms: z.string().min(1).optional(),
  instructions: z.string().min(1).optional(),
  currency: z.string().length(3).optional(),
  method_id: z.number().int().positive().optional(),
  margin: z.number().optional(),
  status: z.enum(['active', 'inactive', 'paused']).optional(),
  active: z.boolean().optional(),
});

const updateOfferValidator = validator('json', (value, c) => {
  return validateSchema(c, updateOfferSchema, value);
});

const quickEditOfferSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  method_id: z.number().int().positive().optional(),
  margin: z.number().optional(),
  status: z.enum(['active', 'inactive', 'paused']).optional(),
});

const quickEditOfferValidator = validator('json', (value, c) => {
  return validateSchema(c, quickEditOfferSchema, value);
});

const filterOffersSchema = z.object({
  currency: z.string().length(3).optional(),
  method_id: z.number().int().positive().optional(),
  status: z.enum(['active', 'inactive', 'paused']).optional(),
  min_rate: z.number().optional(),
  max_rate: z.number().optional(),
  user_id: z.number().int().positive().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const filterOffersValidator = validator('json', (value, c) => {
  return validateSchema(c, filterOffersSchema, value);
});

const toggleOfferSchema = z.object({
  status: z.enum(['active', 'inactive', 'paused']),
});

const toggleOfferValidator = validator('json', (value, c) => {
  return validateSchema(c, toggleOfferSchema, value);
});

const toggleAllOffersSchema = z.object({
  status: z.enum(['active', 'inactive', 'paused']),
});

const toggleAllOffersValidator = validator('json', (value, c) => {
  return validateSchema(c, toggleAllOffersSchema, value);
});

type CreateOfferBody = z.infer<typeof createOfferSchema>;
type UpdateOfferBody = z.infer<typeof updateOfferSchema>;
type QuickEditOfferBody = z.infer<typeof quickEditOfferSchema>;
type FilterOffersBody = z.infer<typeof filterOffersSchema>;
type ToggleOfferBody = z.infer<typeof toggleOfferSchema>;
type ToggleAllOffersBody = z.infer<typeof toggleAllOffersSchema>;

export {
  type CreateOfferBody,
  createOfferValidator,
  type FilterOffersBody,
  filterOffersValidator,
  type QuickEditOfferBody,
  quickEditOfferValidator,
  type ToggleAllOffersBody,
  toggleAllOffersValidator,
  type ToggleOfferBody,
  toggleOfferValidator,
  type UpdateOfferBody,
  updateOfferValidator,
};
