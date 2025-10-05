import { logger } from '../lib/logger.ts';
import type { TradeRepository } from '../repository/trade.ts';
import type { NewTrade } from '../schema/schema.ts';
import { TradeStatus } from '../util/string.ts';
import type { OfferService } from './offer.ts';
import type { UserService } from './user.ts';

/**
 * Service class for managing trades
 */
export class TradeService {
  private repo: TradeRepository;
  private offerService: OfferService;
  private userService: UserService;

  constructor(tradeRepo: TradeRepository, offerService: OfferService, userService: UserService) {
    this.repo = tradeRepo;
    this.offerService = offerService;
    this.userService = userService;
  }

  /**
   * Creates a new trade from an offer
   * @param {number} offerId - ID of the offer
   * @param {number} buyerId - ID of the buyer
   * @param {number} fiatAmount - Fiat amount to trade
   * @returns {Promise<number>} ID of the created trade
   * @throws {Error} When trade creation fails
   */
  public async create(tradeData: NewTrade): Promise<number> {
    try {
      const record = await this.repo.create(tradeData);
      return record[0].id;
    } catch (error) {
      logger.error('Failed to create trade:', error);
      throw error;
    }
  }

  /**
   * Finds trade by its ID
   * @param {number} id - ID of the trade
   * @returns {Promise<Trade|undefined>} The trade if found
   * @throws {Error} When trade retrieval fails
   */
  public async findById(id: number) {
    try {
      return await this.repo.findById(id);
    } catch (error) {
      logger.error('Failed to find trade:', error);
      throw error;
    }
  }

  /**
   * Finds trade by request ID
   * @param {string} requestId - Request ID of the trade
   * @returns {Promise<Trade|undefined>} The trade if found
   * @throws {Error} When trade retrieval fails
   */
  public async findByRequestId(requestId: string) {
    try {
      return await this.repo.findByRequestId(requestId);
    } catch (error) {
      logger.error('Failed to find trade by request ID:', error);
      throw error;
    }
  }

  /**
   * Finds all trades for a specific user (as buyer or seller)
   * @param {number} userId - ID of the user
   * @returns {Promise<Trade[]>} List of trades for the user
   * @throws {Error} When trade retrieval fails
   */
  public async findByUserId(userId: number) {
    try {
      return await this.repo.findByUserId(userId);
    } catch (error) {
      logger.error('Failed to find trades by user ID:', error);
      throw error;
    }
  }

  /**
   * Finds all trades for a buyer
   * @param {number} buyerId - ID of the buyer
   * @returns {Promise<Trade[]>} List of trades for the buyer
   * @throws {Error} When trade retrieval fails
   */
  public async findByBuyerId(buyerId: number) {
    try {
      return await this.repo.findByBuyerId(buyerId);
    } catch (error) {
      logger.error('Failed to find trades by buyer ID:', error);
      throw error;
    }
  }

  /**
   * Finds all trades for a seller
   * @param {number} sellerId - ID of the seller
   * @returns {Promise<Trade[]>} List of trades for the seller
   * @throws {Error} When trade retrieval fails
   */
  public async findBySellerId(sellerId: number) {
    try {
      return await this.repo.findBySellerId(sellerId);
    } catch (error) {
      logger.error('Failed to find trades by seller ID:', error);
      throw error;
    }
  }

  /**
   * Finds all trades for an offer
   * @param {number} offerId - ID of the offer
   * @returns {Promise<Trade[]>} List of trades for the offer
   * @throws {Error} When trade retrieval fails
   */
  public async findByOfferId(offerId: number) {
    try {
      return await this.repo.findByOfferId(offerId);
    } catch (error) {
      logger.error('Failed to find trades by offer ID:', error);
      throw error;
    }
  }

  /**
   * Finds all trades with a specific status
   * @param {string} status - Status of the trades
   * @returns {Promise<Trade[]>} List of trades with the status
   * @throws {Error} When trade retrieval fails
   */
  public async findByStatus(status: TradeStatus) {
    try {
      return await this.repo.findByStatus(status);
    } catch (error) {
      logger.error('Failed to find trades by status:', error);
      throw error;
    }
  }

  /**
   * Finds all expired trades
   * @returns {Promise<Trade[]>} List of expired trades
   * @throws {Error} When trade retrieval fails
   */
  public async findExpired() {
    try {
      return await this.repo.findExpired();
    } catch (error) {
      logger.error('Failed to find expired trades:', error);
      throw error;
    }
  }

  /**
   * Finds all disputed trades
   * @returns {Promise<Trade[]>} List of disputed trades
   * @throws {Error} When trade retrieval fails
   */
  public async findDisputed() {
    try {
      return await this.repo.findDisputed();
    } catch (error) {
      logger.error('Failed to find disputed trades:', error);
      throw error;
    }
  }

  /**
   * Filters trades based on criteria
   * @param {object} criteria - Filter criteria
   * @returns {Promise<Trade[]>} List of filtered trades
   * @throws {Error} When trade filtering fails
   */
  public async filter(criteria: {
    status?: TradeStatus;
    buyer_id?: number;
    seller_id?: number;
    offer_id?: number;
    min_amount?: number;
    max_amount?: number;
    dispute_started?: boolean;
    page?: number;
    limit?: number;
  }) {
    try {
      return await this.repo.filter(criteria);
    } catch (error) {
      logger.error('Failed to filter trades:', error);
      throw error;
    }
  }

  /**
   * Updates an existing trade
   * @param {number} id - ID of the trade to update
   * @param {Partial<NewTrade>} data - Updated trade data
   * @returns {Promise<void>}
   * @throws {Error} When trade update fails
   */
  public async update(id: number, data: Partial<NewTrade>): Promise<void> {
    try {
      await this.repo.update(id, data);
    } catch (error) {
      logger.error('Failed to update trade:', error);
      throw error;
    }
  }

  /**
   * Marks a trade as paid
   * @param {number} id - ID of the trade
   * @returns {Promise<void>}
   * @throws {Error} When marking trade as paid fails
   */
  public async markPaid(id: number): Promise<void> {
    try {
      await this.repo.markPaid(id);
    } catch (error) {
      logger.error('Failed to mark trade as paid:', error);
      throw error;
    }
  }

  /**
   * Cancels a trade
   * @param {number} id - ID of the trade
   * @param {string} cancelledBy - Who cancelled the trade ('buyer' or 'seller')
   * @param {string} reason - Reason for cancellation
   * @returns {Promise<void>}
   * @throws {Error} When cancelling trade fails
   */
  public async cancelTrade(
    id: number,
    cancelledBy: 'buyer' | 'seller',
    reason?: string,
  ): Promise<void> {
    try {
      await this.repo.cancelTrade(id, cancelledBy, reason);
    } catch (error) {
      logger.error('Failed to cancel trade:', error);
      throw error;
    }
  }

  /**
   * Opens a dispute for a trade
   * @param {number} id - ID of the trade
   * @param {string} startedBy - Who started the dispute ('buyer' or 'seller')
   * @param {string} reason - Reason for dispute
   * @param {string} explanation - Detailed explanation
   * @returns {Promise<void>}
   * @throws {Error} When opening dispute fails
   */
  public async openDispute(
    id: number,
    startedBy: 'buyer' | 'seller',
    reason: string,
    explanation: string,
  ): Promise<void> {
    try {
      await this.repo.openDispute(id, startedBy, reason, explanation);
    } catch (error) {
      logger.error('Failed to open dispute:', error);
      throw error;
    }
  }

  /**
   * Resolves a dispute
   * @param {number} id - ID of the trade
   * @param {string} awardedTo - Who the trade is awarded to ('buyer' or 'seller')
   * @param {string} modNotes - Moderator notes
   * @returns {Promise<void>}
   * @throws {Error} When resolving dispute fails
   */
  public async resolveDispute(
    id: number,
    awardedTo: 'buyer' | 'seller',
    modNotes?: string,
  ): Promise<void> {
    try {
      await this.repo.resolveDispute(id, awardedTo, modNotes);
    } catch (error) {
      logger.error('Failed to resolve dispute:', error);
      throw error;
    }
  }

  /**
   * Releases crypto to buyer
   * @param {number} id - ID of the trade
   * @returns {Promise<void>}
   * @throws {Error} When releasing crypto fails
   */
  public async releaseCrypto(id: number): Promise<void> {
    try {
      await this.repo.releaseCrypto(id);
    } catch (error) {
      logger.error('Failed to release crypto:', error);
      throw error;
    }
  }

  /**
   * Expires a trade
   * @param {number} id - ID of the trade
   * @returns {Promise<void>}
   * @throws {Error} When expiring trade fails
   */
  public async expireTrade(id: number): Promise<void> {
    try {
      await this.repo.expireTrade(id);
    } catch (error) {
      logger.error('Failed to expire trade:', error);
      throw error;
    }
  }

  /**
   * Reopens a cancelled trade
   * @param {number} id - ID of the trade
   * @returns {Promise<void>}
   * @throws {Error} When reopening trade fails
   */
  public async reopenTrade(id: number, data: Partial<NewTrade>): Promise<void> {
    try {
      await this.repo.update(id, data);
    } catch (error) {
      logger.error('Failed to reopen trade:', error);
      throw error;
    }
  }

  /**
   * Deletes a trade
   * @param {number} id - ID of the trade to delete
   * @returns {Promise<void>}
   * @throws {Error} When trade deletion fails
   */
  public async delete(id: number): Promise<void> {
    try {
      await this.repo.delete(id);
    } catch (error) {
      logger.error('Failed to delete trade:', error);
      throw error;
    }
  }

  /**
   * Deletes all trades for a user
   * @param {number} userId - ID of the user
   * @returns {Promise<void>}
   * @throws {Error} When trade deletion fails
   */
  public async deleteByUserId(userId: number): Promise<void> {
    try {
      await this.repo.deleteByUserId(userId);
    } catch (error) {
      logger.error('Failed to delete trades by user ID:', error);
      throw error;
    }
  }

  /**
   * Gets the count of trades
   * @param {number} userId - Optional user ID to count trades for
   * @returns {Promise<number>} Count of trades
   * @throws {Error} When getting trade count fails
   */
  public async getCount(userId?: number): Promise<number> {
    try {
      return await this.repo.getCount(userId);
    } catch (error) {
      logger.error('Failed to get trade count:', error);
      throw error;
    }
  }

  /**
   * Gets the count of trades by status
   * @param {string} status - Status to count
   * @returns {Promise<number>} Count of trades with the status
   * @throws {Error} When getting trade count fails
   */
  public async getCountByStatus(status: TradeStatus): Promise<number> {
    try {
      return await this.repo.getCountByStatus(status);
    } catch (error) {
      logger.error('Failed to get trade count by status:', error);
      throw error;
    }
  }

  /**
   * Gets the count of disputed trades
   * @returns {Promise<number>} Count of disputed trades
   * @throws {Error} When getting disputed count fails
   */
  public async getDisputedCount(): Promise<number> {
    try {
      return await this.repo.getDisputedCount();
    } catch (error) {
      logger.error('Failed to get disputed count:', error);
      throw error;
    }
  }
}
