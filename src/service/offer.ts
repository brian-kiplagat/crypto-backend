import { logger } from '../lib/logger.ts';
import type { OfferRepository } from '../repository/offer.ts';
import type { NewOffer } from '../schema/schema.ts';
import { FilterOffersBody } from '../web/validator/offer.ts';

/**
 * Service class for managing offers
 */
export class OfferService {
  private repo: OfferRepository;

  constructor(offerRepo: OfferRepository) {
    this.repo = offerRepo;
  }

  /**
   * Creates a new offer
   * @param {NewOffer} offer - The offer details to create
   * @returns {Promise<number>} ID of the created offer
   * @throws {Error} When offer creation fails
   */
  public async create(offer: NewOffer): Promise<number> {
    try {
      const record = await this.repo.create(offer);
      return record[0].id;
    } catch (error) {
      logger.error('Failed to create offer:', error);
      throw error;
    }
  }

  /**
   * Finds offer by its ID
   * @param {number} id - ID of the offer
   * @returns {Promise<Offer|undefined>} The offer if found
   * @throws {Error} When offer retrieval fails
   */
  public async findById(id: number) {
    try {
      return await this.repo.findById(id);
    } catch (error) {
      logger.error('Failed to find offer:', error);
      throw error;
    }
  }

  /**
   * Finds all offers for a specific user
   * @param {number} userId - ID of the user
   * @returns {Promise<Offer[]>} List of offers for the user
   * @throws {Error} When offer retrieval fails
   */
  public async findByUserId(userId: number) {
    try {
      return await this.repo.findByUserId(userId);
    } catch (error) {
      logger.error('Failed to find offers by user ID:', error);
      throw error;
    }
  }

  /**
   * Finds all active offers
   * @returns {Promise<Offer[]>} List of active offers
   * @throws {Error} When offer retrieval fails
   */
  public async findActive() {
    try {
      return await this.repo.findActive();
    } catch (error) {
      logger.error('Failed to find active offers:', error);
      throw error;
    }
  }

  /**
   * Filters offers based on criteria
   * @param {object} criteria - Filter criteria
   * @returns {Promise<Offer[]>} List of filtered offers
   * @throws {Error} When offer filtering fails
   */
  public async filter(criteria: FilterOffersBody) {
    try {
      return await this.repo.filter(criteria);
    } catch (error) {
      logger.error('Failed to filter offers:', error);
      throw error;
    }
  }

  /**
   * Updates an existing offer
   * @param {number} id - ID of the offer to update
   * @param {Partial<NewOffer>} data - Updated offer data
   * @returns {Promise<void>}
   * @throws {Error} When offer update fails
   */
  public async update(id: number, data: Partial<NewOffer>): Promise<void> {
    try {
      await this.repo.update(id, data);
    } catch (error) {
      logger.error('Failed to update offer:', error);
      throw error;
    }
  }

  /**
   * Toggles offer status
   * @param {number} id - ID of the offer to toggle
   * @param {'active' | 'inactive' | 'paused'} status - New status
   * @returns {Promise<void>}
   * @throws {Error} When offer status toggle fails
   */
  public async toggleStatus(id: number, status: 'active' | 'inactive' | 'paused'): Promise<void> {
    try {
      await this.repo.toggleStatus(id, status);
    } catch (error) {
      logger.error('Failed to toggle offer status:', error);
      throw error;
    }
  }

  /**
   * Toggles offer active state
   * @param {number} id - ID of the offer to toggle
   * @param {boolean} active - New active state
   * @returns {Promise<void>}
   * @throws {Error} When offer active toggle fails
   */
  public async toggleActive(id: number, active: boolean): Promise<void> {
    try {
      await this.repo.toggleActive(id, active);
    } catch (error) {
      logger.error('Failed to toggle offer active state:', error);
      throw error;
    }
  }

  /**
   * Toggles all offers for a user
   * @param {number} userId - ID of the user
   * @param {'active' | 'inactive' | 'paused'} status - New status
   * @returns {Promise<void>}
   * @throws {Error} When toggling all offers fails
   */
  public async toggleAllForUser(
    userId: number,
    status: 'active' | 'inactive' | 'paused',
  ): Promise<void> {
    try {
      await this.repo.toggleAllForUser(userId, status);
    } catch (error) {
      logger.error('Failed to toggle all offers for user:', error);
      throw error;
    }
  }

  /**
   * Deletes an offer
   * @param {number} id - ID of the offer to delete
   * @returns {Promise<void>}
   * @throws {Error} When offer deletion fails
   */
  public async delete(id: number): Promise<void> {
    try {
      await this.repo.delete(id);
    } catch (error) {
      logger.error('Failed to delete offer:', error);
      throw error;
    }
  }

  /**
   * Deletes all offers for a user
   * @param {number} userId - ID of the user
   * @returns {Promise<void>}
   * @throws {Error} When offer deletion fails
   */
  public async deleteByUserId(userId: number): Promise<void> {
    try {
      await this.repo.deleteByUserId(userId);
    } catch (error) {
      logger.error('Failed to delete offers by user ID:', error);
      throw error;
    }
  }

  /**
   * Gets the count of offers
   * @param {number} userId - Optional user ID to count offers for
   * @returns {Promise<number>} Count of offers
   * @throws {Error} When getting offer count fails
   */
  public async getCount(userId?: number): Promise<number> {
    try {
      return await this.repo.getCount(userId);
    } catch (error) {
      logger.error('Failed to get offer count:', error);
      throw error;
    }
  }

  /**
   * Gets the count of active offers
   * @returns {Promise<number>} Count of active offers
   * @throws {Error} When getting active offer count fails
   */
  public async getActiveCount(): Promise<number> {
    try {
      return await this.repo.getActiveCount();
    } catch (error) {
      logger.error('Failed to get active offer count:', error);
      throw error;
    }
  }
}
