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

      // Generate a unique username if not provided
      const username = additionalFields.custom_id || (await this.generateUserName());

      // Create user with all fields
      const user = await this.repo.create({
        name,
        email,
        password: hashedPassword,
        role,
        phone,
        auth_provider: 'local',
        custom_id: username,
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
}
