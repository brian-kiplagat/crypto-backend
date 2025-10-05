import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { isValidPhoneNumber } from 'libphonenumber-js';

import { db } from '../../lib/database.js';
import { encrypt, verify } from '../../lib/encryption.js';
import env from '../../lib/env.js';
import { encode, type JWTPayload } from '../../lib/jwt.js';
import { logger } from '../../lib/logger.ts';
import { userSchema } from '../../schema/schema.ts';
import { BitgoService } from '../../service/bitgo.ts';
import type { UserService } from '../../service/user.js';
import { WalletService } from '../../service/wallet.ts';
import sendWelcomeEmailAsync from '../../task/client/sendWelcomeEmailAsync.js';
import { sendTransactionalEmail } from '../../task/email-processor.ts';
import type {
  Disable2FaBody,
  EmailVerificationBody,
  InAppResetPasswordBody,
  LoginBody,
  RegisterTokenBody,
  RegistrationBody,
  RequestResetPasswordBody,
  ResetPasswordBody,
  UpdateUserDetailsBody,
  Verify2FaBody,
} from '../validator/user.js';
import { ERRORS, MAIL_CONTENT, serveBadRequest, serveInternalServerError } from './resp/error.js';
import { serializeUser } from './serializer/user.js';

export class AuthController {
  private service: UserService;
  private bitgoService: BitgoService;
  private walletService: WalletService;

  constructor(userService: UserService, bitgoService: BitgoService, walletService: WalletService) {
    this.service = userService;
    this.bitgoService = bitgoService;
    this.walletService = walletService;
  }

  /**
   * Authenticates a user with email and password
   * @param {Context} c - The Hono context containing login credentials
   * @returns {Promise<Response>} Response containing JWT token and user data
   * @throws {Error} When authentication fails
   */
  public login = async (c: Context) => {
    try {
      const body: LoginBody = await c.req.json();
      const user = await this.service.findByEmail(body.email);
      if (!user) {
        return c.json(
          {
            success: false,
            message: 'Invalid email, please try again',
            code: 'AUTH_INVALID_CREDENTIALS',
          },
          401,
        );
      }
      const isVerified = verify(body.password, user.password);
      if (!isVerified) {
        return c.json(
          {
            success: false,
            message: 'Invalid password, please try again',
            code: 'AUTH_INVALID_CREDENTIALS',
          },
          401,
        );
      }

      const token = await encode(user.id, user.email);
      const serializedUser = await serializeUser(user);
      return c.json({ token, user: serializedUser });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  };

  /**
   * Registers a new user in the system
   * @param {Context} c - The Hono context containing registration data
   * @returns {Promise<Response>} Response containing JWT token and user data
   * @throws {Error} When registration fails or user already exists
   */
  public register = async (c: Context) => {
    try {
      const body: RegistrationBody = await c.req.json();
      const { name, email, dial_code, phone, password } = body;
      const fullNumber = dial_code + phone;
      if (!isValidPhoneNumber(fullNumber)) {
        return serveBadRequest(c, ERRORS.INVALID_PHONE_NUMBER);
      }
      const existingUser = await this.service.findByEmail(email);
      if (existingUser) {
        return serveBadRequest(c, ERRORS.USER_EXISTS);
      }
      await this.service.create(name, email, password, 'user', fullNumber);

      const user = await this.service.findByEmail(email);
      if (!user) {
        return serveInternalServerError(c, new Error(ERRORS.USER_NOT_FOUND));
      }

      await this.bitgoService.createAddress(user.id, email, 10);

      await sendWelcomeEmailAsync(user.id);

      const token = await encode(user.id, user.email);
      const serializedUser = await serializeUser(user);
      return c.json({ token, user: serializedUser });
    } catch (err) {
      return serveInternalServerError(c, err);
    }
  };

  /**
   * Sends a verification token to user's email
   * @param {Context} c - The Hono context containing email information
   * @returns {Promise<Response>} Response indicating success or failure of token sending
   * @throws {Error} When token generation or email sending fails
   */
  public sendToken = async (c: Context) => {
    try {
      const body: EmailVerificationBody = await c.req.json();
      const user = await this.service.findByEmail(body.email);
      if (!user) {
        return c.json(
          {
            success: false,
            message: 'Invalid email, please check',
            code: 'AUTH_INVALID_CREDENTIALS',
          },
          401,
        );
      }
      //6 digint random number
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      await db.update(userSchema).set({ email_token: token }).where(eq(userSchema.id, user.id));

      await sendTransactionalEmail(user.email, user.name, 12, {
        subject: 'Your code',
        title: 'Thanks for signing up',
        subtitle: `${token}`,
        body: `Welcome to ${env.BRAND_NAME}. Your verification code code is ${token}`,
        buttonText: 'Ok, got it',
        buttonLink: `${env.FRONTEND_URL}`,
      });

      return c.json({
        message: 'Email token sent successfully',
      });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  };

  /**
   * Verifies the registration token sent to user's email
   * @param {Context} c - The Hono context containing token and user ID
   * @returns {Promise<Response>} Response indicating verification status
   * @throws {Error} When token verification fails
   */
  public verifyRegistrationToken = async (c: Context) => {
    try {
      const body: RegisterTokenBody = await c.req.json();
      const user = await this.service.find(body.id);
      if (!user) {
        return c.json(
          {
            success: false,
            message: 'Ops, could not verify account, please check',
            code: 'AUTH_INVALID_CREDENTIALS',
          },
          401,
        );
      }
      if (user.email_token !== String(body.token)) {
        return c.json(
          {
            success: false,
            message: 'Ops, wrong code, please check',
            code: 'AUTH_INVALID_CREDENTIALS',
          },
          401,
        );
      }
      await this.service.update(user.id, { is_verified: true });
      return c.json({
        message: 'Email verified successfully',
      });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  };

  /**
   * Initiates password reset process by sending reset token
   * @param {Context} c - The Hono context containing email information
   * @returns {Promise<Response>} Response indicating reset link sent status
   * @throws {Error} When reset token generation or email sending fails
   */
  public requestResetPassword = async (c: Context) => {
    try {
      const body: RequestResetPasswordBody = await c.req.json();
      const user = await this.service.findByEmail(body.email);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      await db.update(userSchema).set({ reset_token: token }).where(eq(userSchema.id, user.id));
      await sendTransactionalEmail(user.email, user.name, 12, {
        subject: 'Reset password',
        title: 'Reset password',
        subtitle: `${token}`,
        body: `Please click this link to reset your password: ${env.FRONTEND_URL}/reset-password?token=${token}&email=${user.email}`,
        buttonText: 'Reset password',
        buttonLink: `${env.FRONTEND_URL}/reset-password?token=${token}&email=${user.email}`,
      });
      return c.json({
        message: 'Reset password link sent successfully',
      });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  };

  /**
   * Retrieves user information from JWT payload
   * @private
   * @param {Context} c - The Hono context containing JWT payload
   * @returns {Promise<User|null>} The user object if found, null otherwise
   */
  private getUser = async (c: Context) => {
    const { email } = c.get('jwtPayload');
    const user = await this.service.findByEmail(email);
    return user;
  };

  /**
   * Resets user's password using token sent via email
   * @param {Context} c - The Hono context containing new password and token
   * @returns {Promise<Response>} Response indicating password reset status
   * @throws {Error} When password reset fails
   */
  public resetPassword = async (c: Context) => {
    try {
      const body: ResetPasswordBody = await c.req.json();
      const user = await this.service.findByEmail(body.email);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      if (user.reset_token !== String(body.token)) {
        return serveBadRequest(c, ERRORS.INVALID_TOKEN);
      }
      const hashedPassword = encrypt(body.password);
      await this.service.update(user.id, { password: hashedPassword });
      await db.update(userSchema).set({ reset_token: null }).where(eq(userSchema.id, user.id));
      await sendTransactionalEmail(user.email, user.name, 12, {
        subject: 'Password reset',
        title: 'Password reset',
        subtitle: `Your password has been reset successfully`,
        body: `Your password has been reset successfully. If this was not you, please contact our support agents. Thanks again for using ${env.FRONTEND_URL}!`,
        buttonText: 'Ok, got it',
        buttonLink: `${env.FRONTEND_URL}`,
      });
      return c.json({
        message: 'Password reset successfully',
      });
    } catch (err) {
      logger.error(err);
      return serveInternalServerError(c, err);
    }
  };

  /**
   * Resets user's password while logged in
   * @param {Context} c - The Hono context containing new password
   * @returns {Promise<Response>} Response indicating password reset status
   * @throws {Error} When password reset fails
   */
  public resetPasswordInApp = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: InAppResetPasswordBody = await c.req.json();

      // Verify old password
      const isOldPasswordValid = verify(body.oldPassword, user.password);
      if (!isOldPasswordValid) {
        return serveBadRequest(c, ERRORS.AUTH_INVALID_PASSWORD);
      }
      const hashedPassword = encrypt(body.newPassword);
      // Update password
      await this.service.update(user.id, { password: hashedPassword });

      // Send confirmation email
      await sendTransactionalEmail(user.email, user.name, 12, MAIL_CONTENT.PASSWORD_CHANGED_IN_APP);

      return c.json({
        message: 'Password changed successfully',
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves current user's profile information
   * @param {Context} c - The Hono context containing user information
   * @returns {Promise<Response>} Response containing user profile data
   * @throws {Error} When profile retrieval fails
   */
  public me = async (c: Context) => {
    const payload: JWTPayload = c.get('jwtPayload');
    const user = await this.service.findByEmail(payload.email as string);
    if (!user) {
      return serveInternalServerError(c, new Error(ERRORS.USER_NOT_FOUND));
    }

    const wallet = await this.walletService.findByUserId(user.id);

    const serializedUser = await serializeUser(user);
    return c.json({
      user: serializedUser,
      wallet: {
        id: wallet[0].id,
        address: wallet[0].address,
        user_id: wallet[0].user_id,
        address_type: wallet[0].address_type,
        chain: wallet[0].chain,
        index: wallet[0].index,
        createdAt: wallet[0].created_at,
      },
    });
  };

  /**
   * Updates user's profile details
   * @param {Context} c - The Hono context containing updated user information
   * @returns {Promise<Response>} Response containing updated user data
   * @throws {Error} When profile update fails
   */
  public updateUserDetails = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: UpdateUserDetailsBody = await c.req.json();

      // If email is being changed, check if it's already taken
      if (body.email && body.email !== user.email) {
        const existingUser = await this.service.findByEmail(body.email);
        if (existingUser) {
          return serveBadRequest(c, ERRORS.USER_EXISTS);
        }
      }
      const { name, email, dial_code, phone } = body;

      // Update user details
      await this.service.update(user.id, { name, email, dial_code, phone });

      // Get updated user
      const updatedUser = await this.service.find(user.id);
      if (!updatedUser) {
        return serveInternalServerError(c, new Error(ERRORS.USER_NOT_FOUND));
      }

      const serializedUser = await serializeUser(updatedUser);
      return c.json({
        message: 'User details updated successfully',
        user: serializedUser,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public generate2FaSetup = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const { qrCode, secret } = await this.service.generate2FaSetup(user.email);

      return c.json({
        qrCode,
        secret,
        message: '2FA setup generated successfully',
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public verify2Fa = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const body: Verify2FaBody = await c.req.json();
      const { token } = body;
      if (!user.two_factor_secret) {
        return serveBadRequest(c, ERRORS.INVALID_TOKEN);
      }

      const isValid = this.service.verify2Fa(user.two_factor_secret, token);

      return c.json({
        valid: isValid,
        message: isValid ? 'Token is valid' : 'Token is invalid',
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public disable2Fa = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const body: Disable2FaBody = await c.req.json();
      const { token } = body;

      const success = await this.service.disable2Fa(user.id, token);

      if (!success) {
        return serveBadRequest(c, ERRORS.INVALID_TOKEN);
      }

      return c.json({
        success: true,
        message: '2FA disabled successfully',
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
