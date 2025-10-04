import { logger } from '../lib/logger.ts';
import type { WalletRepository } from '../repository/wallet.ts';
import type { NewBitcoinAddress } from '../schema/schema.ts';

/**
 * Service class for managing Bitcoin wallet addresses
 */
export class WalletService {
  private repo: WalletRepository;

  constructor(walletRepo: WalletRepository) {
    this.repo = walletRepo;
  }

  /**
   * Creates a new Bitcoin address
   * @param {NewBitcoinAddress} address - The address details to create
   * @returns {Promise<number>} ID of the created address
   * @throws {Error} When address creation fails
   */
  public async create(address: NewBitcoinAddress): Promise<number> {
    try {
      const record = await this.repo.create(address);
      return record[0].id;
    } catch (error) {
      logger.error('Failed to create Bitcoin address:', error);
      throw error;
    }
  }

  /**
   * Finds address by its ID
   * @param {number} id - ID of the address
   * @returns {Promise<BitcoinAddress|undefined>} The address if found
   * @throws {Error} When address retrieval fails
   */
  public async findById(id: number) {
    try {
      return await this.repo.findById(id);
    } catch (error) {
      logger.error('Failed to find Bitcoin address by ID:', error);
      throw error;
    }
  }

  /**
   * Finds all addresses for a specific user
   * @param {number} userId - ID of the user
   * @returns {Promise<BitcoinAddress[]>} List of addresses for the user
   * @throws {Error} When address retrieval fails
   */
  public async findByUserId(userId: number) {
    try {
      return await this.repo.findByUserId(userId);
    } catch (error) {
      logger.error('Failed to find Bitcoin addresses by user ID:', error);
      throw error;
    }
  }

  /**
   * Finds address by Bitcoin address string
   * @param {string} address - The Bitcoin address string
   * @returns {Promise<BitcoinAddress|undefined>} The address if found
   * @throws {Error} When address retrieval fails
   */
  public async findByAddress(address: string) {
    try {
      return await this.repo.findByAddress(address);
    } catch (error) {
      logger.error('Failed to find Bitcoin address by address string:', error);
      throw error;
    }
  }

  /**
   * Finds all addresses for a specific BitGo wallet
   * @param {string} walletId - ID of the BitGo wallet
   * @returns {Promise<BitcoinAddress[]>} List of addresses for the wallet
   * @throws {Error} When address retrieval fails
   */
  public async findByWalletId(walletId: string) {
    try {
      return await this.repo.findByWalletId(walletId);
    } catch (error) {
      logger.error('Failed to find Bitcoin addresses by wallet ID:', error);
      throw error;
    }
  }

  /**
   * Updates an existing address
   * @param {number} id - ID of the address to update
   * @param {Partial<NewBitcoinAddress>} data - Updated address data
   * @returns {Promise<void>}
   * @throws {Error} When address update fails
   */
  public async update(id: number, data: Partial<NewBitcoinAddress>): Promise<void> {
    try {
      await this.repo.update(id, data);
    } catch (error) {
      logger.error('Failed to update Bitcoin address:', error);
      throw error;
    }
  }

  /**
   * Deletes an address
   * @param {number} id - ID of the address to delete
   * @returns {Promise<void>}
   * @throws {Error} When address deletion fails
   */
  public async delete(id: number): Promise<void> {
    try {
      await this.repo.delete(id);
    } catch (error) {
      logger.error('Failed to delete Bitcoin address:', error);
      throw error;
    }
  }

  /**
   * Deletes all addresses for a user
   * @param {number} userId - ID of the user
   * @returns {Promise<void>}
   * @throws {Error} When address deletion fails
   */
  public async deleteByUserId(userId: number): Promise<void> {
    try {
      await this.repo.deleteByUserId(userId);
    } catch (error) {
      logger.error('Failed to delete Bitcoin addresses by user ID:', error);
      throw error;
    }
  }

  /**
   * Gets the count of addresses for a user
   * @param {number} userId - ID of the user
   * @returns {Promise<number>} Count of addresses
   * @throws {Error} When getting address count fails
   */
  public async getAddressCount(userId: number): Promise<number> {
    try {
      return await this.repo.getAddressCount(userId);
    } catch (error) {
      logger.error('Failed to get address count:', error);
      throw error;
    }
  }

  /**
   * Gets the count of addresses for a BitGo wallet
   * @param {string} walletId - ID of the BitGo wallet
   * @returns {Promise<number>} Count of addresses
   * @throws {Error} When getting address count fails
   */
  public async getAddressCountByWalletId(walletId: string): Promise<number> {
    try {
      return await this.repo.getAddressCountByWalletId(walletId);
    } catch (error) {
      logger.error('Failed to get address count by wallet ID:', error);
      throw error;
    }
  }
}
