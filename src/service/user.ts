import QRCode from 'qrcode';
import speakeasy from 'speakeasy';

import { encrypt } from '../lib/encryption.ts';
import env from '../lib/env.ts';
import { logger } from '../lib/logger.ts';
import { UserRepository } from '../repository/user.ts';
import type { User } from '../schema/schema.ts';
import { sendTransactionalEmail } from '../task/email-processor.ts';
import { capitalizeFirst, shuffleString } from '../util/string.js';

/**
 * Service class for managing users, including creation, authentication, and profile management
 */
export class UserService {
  private repo: UserRepository;
  // 2FA Methods
  private readonly DIGITS = 6;
  private readonly STEP = 30; // seconds
  private readonly WINDOW = 1; // tolerance

  /**
   * Creates an instance of UserService
   * @param {UserRepository} userRepository - Repository for user operations
   */
  constructor(userRepository: UserRepository) {
    this.repo = userRepository;
    this.create = this.create.bind(this);
    this.findByEmail = this.findByEmail.bind(this);
  }

  /**
   * Creates a new user
   * @param {string} name - User's name
   * @param {string} email - User's email address
   * @param {string} password - User's password (will be encrypted)
   * @param {'user'|'role'|'admin'} role - User's role
   * @param {string} phone - User's phone number
   * @param {Partial<User>} [additionalFields={}] - Optional additional user fields
   * @returns {Promise<User>} Created user
   * @throws {Error} When user creation fails
   */
  public async create(
    name: string,
    email: string,
    password: string,
    role: 'user' | 'role' | 'admin',
    phone: string,
    additionalFields: Partial<User> = {},
  ) {
    try {
      const hashedPassword = encrypt(password);

      // Generate a unique username
      const username = await this.generateUserName();

      // Create user with all fields
      const user = await this.repo.create({
        name,
        email,
        password: hashedPassword,
        role,
        phone,
        auth_provider: 'local',
        username: username,
        ...additionalFields,
      });

      return user;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Finds a user by their email address
   * @param {string} email - Email address to search for
   * @returns {Promise<User|undefined>} The user if found
   */
  public async findByEmail(email: string) {
    return this.repo.findByEmail(email);
  }

  /**
   * Finds a user by their ID
   * @param {number} id - ID of the user
   * @returns {Promise<User|undefined>} The user if found
   */
  public async find(id: number) {
    return this.repo.find(id);
  }

  // Balance wrappers (DB still handled in repository)
  public async getBalance(userId: number): Promise<string> {
    return this.repo.getBalance(userId);
  }

  public async setBalance(userId: number, newBalance: string) {
    return this.repo.setBalance(userId, newBalance);
  }

  /**
   * Updates a user's information
   * @param {number} id - ID of the user to update
   * @param {Partial<User>} user - Updated user information
   * @returns {Promise<User>} The updated user
   */
  public async update(id: number, user: Partial<User>) {
    return this.repo.update(id, user);
  }

  /**
   * Updates a user's profile image
   * @param {number} id - ID of the user to update
   * @param {string} imageUrl - URL of the new profile image
   * @returns {Promise<User>} The updated user
   */
  public async updateProfileImage(id: number, imageUrl: string) {
    return this.repo.update(id, {
      profile_picture: imageUrl,
    });
  }

  /**
   * Deletes a user
   * @param {number} id - ID of the user to delete
   * @returns {Promise<void>}
   */
  public async delete(id: number) {
    return this.repo.delete(id);
  }

  /**
   * Sends a welcome email to a newly registered user
   * @param {string} email - Email address of the user
   * @returns {Promise<void>}
   * @throws {Error} When user is not found or email sending fails
   */
  public async sendWelcomeEmail(email: string) {
    try {
      const user = await this.findByEmail(email);
      if (!user) {
        throw new Error('User not found');
      }

      await sendTransactionalEmail(user.email, user.name, 12, {
        subject: `Welcome to ${env.BRAND_NAME}`,
        title: `Welcome to ${env.BRAND_NAME}`,
        subtitle: 'Your subscription is now active',
        body: `Thank you for subscribing to ${env.BRAND_NAME}. Your subscription is now active and you can start using all our features.`,
        buttonText: 'Ok, got it',
        buttonLink: `${env.FRONTEND_URL}`,
      });

      logger.info(`Welcome email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending welcome email:', error);
      throw error;
    }
  }

  /**
   * Generates a unique username using the Laravel pattern
   * @returns {Promise<string>} Generated username
   */
  public async generateUserName(): Promise<string> {
    const words = await this.repo.getTwoRandomWords();

    if (words.length < 2) {
      throw new Error('Not enough words in database for username generation');
    }

    const word1 = words[0].word.toLowerCase().trim();
    const word2 = words[1].word.toLowerCase().trim();

    // Process words similar to Laravel implementation
    const part1 = word1.substring(0, 8); // Max 8 chars
    const part2 = word2.substring(0, 5); // Max 5 chars

    // Generate 3-digit random number
    const part3 = Math.floor(Math.random() * 900) + 100; // 100-999

    // Capitalize and shuffle
    const capitalizedPart1 = capitalizeFirst(part1);
    const shuffledPart2 = shuffleString(part2);
    const capitalizedPart2 = capitalizeFirst(shuffledPart2);

    const username = capitalizedPart1 + capitalizedPart2 + part3;

    // Check if username exists and regenerate if needed
    const exists = await this.checkUsernameExists(username);
    if (exists) {
      return this.generateUserName(); // Recursive call to generate new username
    }

    return username;
  }

  /**
   * Checks if a username already exists
   * @param {string} username - Username to check
   * @returns {Promise<boolean>} True if username exists
   */
  public async checkUsernameExists(username: string): Promise<boolean> {
    const user = await this.repo.findByCustomId(username);
    return user !== undefined;
  }

  /**
   * Generates 2FA setup for a user
   * @param {string} userEmail - User's email address
   * @param {string} issuer - Application name/issuer
   * @returns {Promise<{qrCode: string, secret: string}>} 2FA setup data
   */
  public async generate2FaSetup(
    userEmail: string,
    issuer: string = env.BRAND_NAME,
  ): Promise<{ qrCode: string; secret: string }> {
    try {
      const secret = speakeasy.generateSecret({
        name: `${issuer}:${userEmail}`,
        length: 20,
      });

      const otpauth = secret.otpauth_url!;
      const qrCode = await QRCode.toDataURL(otpauth);

      return {
        qrCode,
        secret: secret.base32,
      };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Verifies a 2FA token
   * @param {string} secret - User's 2FA secret
   * @param {string} token - Token to verify
   * @returns {boolean} True if token is valid
   */
  public verify2Fa(secret: string, token: string): boolean {
    try {
      return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        digits: this.DIGITS,
        step: this.STEP,
        window: this.WINDOW,
      });
    } catch (error) {
      logger.error(error);
      return false;
    }
  }

  /**
   * Enables 2FA for a user
   * @param {number} userId - User ID
   * @param {string} secret - 2FA secret
   * @param {string} token - Verification token
   * @returns {Promise<boolean>} True if 2FA was enabled successfully
   */
  public async enable2Fa(userId: number, secret: string, token: string): Promise<boolean> {
    try {
      if (!this.verify2Fa(secret, token)) {
        return false;
      }

      // Update user with 2FA secret (you'll need to add this field to your schema)
      await this.repo.update(userId, {
        two_factor_secret: secret,
        two_factor_enabled: true,
      });

      logger.info(`2FA enabled for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(error);
      return false;
    }
  }

  /**
   * Disables 2FA for a user
   * @param {number} userId - User ID
   * @param {string} token - Current 2FA token for verification
   * @returns {Promise<boolean>} True if 2FA was disabled successfully
   */
  public async disable2Fa(userId: number, token: string): Promise<boolean> {
    try {
      const user = await this.repo.find(userId);
      if (!user || !user.two_factor_secret) {
        return false;
      }

      if (!this.verify2Fa(user.two_factor_secret, token)) {
        return false;
      }

      // Remove 2FA secret and disable
      await this.repo.update(userId, {
        two_factor_secret: null,
        two_factor_enabled: false,
      });

      logger.info(`2FA disabled for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(error);
      return false;
    }
  }

  /**
   * Checks if user has 2FA enabled
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} True if 2FA is enabled
   */
  public async is2FaEnabled(userId: number): Promise<boolean> {
    try {
      const user = await this.repo.find(userId);
      return user?.two_factor_enabled === true;
    } catch (error) {
      logger.error(error);
      return false;
    }
  }
}
