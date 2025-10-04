import { BitGoAPI } from '@bitgo/sdk-api';
import { Btc } from '@bitgo/sdk-coin-btc';

import env from '../lib/env.ts';
import { logger } from '../lib/logger.ts';
import { UserService } from './user.ts';

/**
 * Service class for managing notifications
 */
export class BitgoService {
  private userService: UserService;
  private bitgo: BitGoAPI;
  constructor(userService: UserService) {
    this.userService = userService;
    this.bitgo = new BitGoAPI({
      env: 'prod',
      accessToken: env.BITGO_ACCESS_TOKEN,
    });
    this.bitgo.register('btc', Btc.createInstance);
  }

  /**
   * Creates a new walletaddress for a user
   * @param {string} email - The email of the user
   * @param {number} chain - The chain of the address
   * @returns {Promise<number>} ID of the created address
   * @throws {Error} When address creation fails
   */
  public async createAddress(email: string, chain: number) {
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
      //logger.info(newAddress);

      return newAddress;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}
