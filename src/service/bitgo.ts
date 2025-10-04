import { BitGoAPI } from '@bitgo/sdk-api';
import { Btc } from '@bitgo/sdk-coin-btc';

import env from '../lib/env.ts';
import { logger } from '../lib/logger.ts';
import { UserService } from './user.ts';
import type { WalletService } from './wallet.ts';

/**
 * Service class for managing BitGo Bitcoin wallet operations
 */
export class BitgoService {
  private userService: UserService;
  private walletService: WalletService;
  private bitgo: BitGoAPI;

  constructor(userService: UserService, walletService: WalletService) {
    this.userService = userService;
    this.walletService = walletService;
    this.bitgo = new BitGoAPI({
      env: 'prod',
      accessToken: env.BITGO_ACCESS_TOKEN,
    });
    this.bitgo.register('btc', Btc.createInstance);
  }

  /**
   * Creates a new Bitcoin address for a user
   * @param {number} userId - ID of the user
   * @param {string} email - The email of the user
   * @param {number} chain - The chain of the address
   * @returns {Promise<number>} ID of the created address in our database
   * @throws {Error} When address creation fails
   */
  public async createAddress(userId: number, email: string, chain: number) {
    try {
      // Get your existing wallet
      const existingWallet = await this.bitgo
        .coin('btc')
        .wallets()
        .get({ id: env.BITGO_WALLET_ID });

      // Create a new address under your existing wallet
      const newAddress = await existingWallet.createAddress({
        chain,
        label: email,
      });

      const addressId = await this.walletService.create({
        user_id: userId,
        address: newAddress.address,
        wallet_id: newAddress.wallet,
        label: newAddress.label,
        chain: newAddress.chain,
        index: newAddress.index,
        address_type: newAddress.addressType,
        metadata: {
          coinSpecific: newAddress.coinSpecific,
          keychains: newAddress.keychains,
        },
      });

      logger.info(`Created Bitcoin address ${newAddress.address} for user ${userId}`);
      return addressId;
    } catch (error) {
      logger.error('Failed to create Bitcoin address:', error);
      throw error;
    }
  }

  /**
   * Gets all Bitcoin addresses for a user
   * @param {number} userId - ID of the user
   * @returns {Promise<BitcoinAddress[]>} List of user's Bitcoin addresses
   * @throws {Error} When address retrieval fails
   */
  public async getUserAddresses(userId: number) {
    try {
      return await this.walletService.findByUserId(userId);
    } catch (error) {
      logger.error('Failed to get user Bitcoin addresses:', error);
      throw error;
    }
  }
}
