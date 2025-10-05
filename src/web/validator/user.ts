import { validator } from 'hono/validator';
import { z } from 'zod';

import { validateSchema } from './validator.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(20),
});

const loginValidator = validator('json', (value, c) => {
  return validateSchema(c, loginSchema, value);
});

const registrationSchema = loginSchema.extend({
  name: z.string().min(2).max(40),
  phone: z.string(),
  dial_code: z.string(),
});

const uploadProfileImageSchema = z.object({
  imageBase64: z.string().nullable().optional(),
  fileName: z.string().nullable().optional(),
});

const registrationValidator = validator('json', (value, c) => {
  return validateSchema(c, registrationSchema, value);
});

const emailVerificationSchema = z.object({
  email: z.string().email(),
});

const emailVerificationValidator = validator('json', (value, c) => {
  return validateSchema(c, emailVerificationSchema, value);
});

const registerTokenSchema = z.object({
  token: z.number(),
  id: z.number(),
});

const registerTokenValidator = validator('json', (value, c) => {
  return validateSchema(c, registerTokenSchema, value);
});

const requestResetPasswordSchema = z.object({
  email: z.string().email(),
});

const requestResetPasswordValidator = validator('json', (value, c) => {
  return validateSchema(c, requestResetPasswordSchema, value);
});

const resetPasswordSchema = z.object({
  token: z.number(),
  email: z.string().email(),
  password: z.string().min(8).max(20),
});

const resetPasswordValidator = validator('json', (value, c) => {
  return validateSchema(c, resetPasswordSchema, value);
});

const inAppResetPasswordSchema = z.object({
  oldPassword: z.string().min(8).max(20),
  newPassword: z.string().min(8).max(20),
  confirmPassword: z.string().min(8).max(20),
});

const inAppResetPasswordValidator = validator('json', (value, c) => {
  return validateSchema(c, inAppResetPasswordSchema, value);
});

const updateUserDetailsSchema = z.object({
  name: z.string().min(2).max(40),
  email: z.string().email(),
  dial_code: z.string(),
  phone: z.string(),
});

const updateUserDetailsValidator = validator('json', (value, c) => {
  return validateSchema(c, updateUserDetailsSchema, value);
});

const uploadProfileImageValidator = validator('json', (value, c) => {
  return validateSchema(c, uploadProfileImageSchema, value);
});

const generate2FaSetupSchema = z.object({
  email: z.string().email(),
});

const generate2FaSetupValidator = validator('json', (value, c) => {
  return validateSchema(c, generate2FaSetupSchema, value);
});

const verify2FaSchema = z.object({
  token: z.string().length(6),
});

const verify2FaValidator = validator('json', (value, c) => {
  return validateSchema(c, verify2FaSchema, value);
});

const disable2FaSchema = z.object({
  token: z.string().length(6),
});

const disable2FaValidator = validator('json', (value, c) => {
  return validateSchema(c, disable2FaSchema, value);
});

type LoginBody = z.infer<typeof loginSchema>;
type RegistrationBody = z.infer<typeof registrationSchema>;
type EmailVerificationBody = z.infer<typeof emailVerificationSchema>;
type RegisterTokenBody = z.infer<typeof registerTokenSchema>;
type RequestResetPasswordBody = z.infer<typeof requestResetPasswordSchema>;
type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
type InAppResetPasswordBody = z.infer<typeof inAppResetPasswordSchema>;

type UpdateUserDetailsBody = z.infer<typeof updateUserDetailsSchema>;
type UploadProfileImageBody = z.infer<typeof uploadProfileImageSchema>;
type Generate2FaSetupBody = z.infer<typeof generate2FaSetupSchema>;
type Verify2FaBody = z.infer<typeof verify2FaSchema>;
type Disable2FaBody = z.infer<typeof disable2FaSchema>;

export {
  type Disable2FaBody,
  disable2FaValidator,
  type EmailVerificationBody,
  emailVerificationValidator,
  type Generate2FaSetupBody,
  generate2FaSetupValidator,
  type InAppResetPasswordBody,
  inAppResetPasswordValidator,
  type LoginBody,
  loginValidator,
  type RegisterTokenBody,
  registerTokenValidator,
  type RegistrationBody,
  registrationValidator,
  type RequestResetPasswordBody,
  requestResetPasswordValidator,
  type ResetPasswordBody,
  resetPasswordValidator,
  type UpdateUserDetailsBody,
  updateUserDetailsValidator,
  type UploadProfileImageBody,
  uploadProfileImageValidator,
  type Verify2FaBody,
  verify2FaValidator,
};
