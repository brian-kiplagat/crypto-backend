import type { Context } from 'hono';

import { logger } from '../../lib/logger.js';
import type { OfferService } from '../../service/offer.js';
import { UserService } from '../../service/user.js';
import {
  type CreateOfferBody,
  type FilterOffersBody,
  type QuickEditOfferBody,
  type ToggleAllOffersBody,
  type ToggleOfferBody,
  type UpdateOfferBody,
} from '../validator/offer.js';
import { ERRORS, serveBadRequest, serveNotFound } from './resp/error.js';

export class OfferController {
  private offerService: OfferService;
  private userService: UserService;

  constructor(offerService: OfferService, userService: UserService) {
    this.offerService = offerService;
    this.userService = userService;
  }

  /**
   * Retrieves user information from JWT payload
   * @private
   * @param {Context} c - The Hono context containing JWT payload
   * @returns {Promise<User|null>} The user object if found, null otherwise
   */
  private getUser = async (c: Context) => {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user;
  };

  /**
   * Creates a new offer
   * @param {Context} c - The Hono context containing offer details
   * @returns {Promise<Response>} Response containing created offer information
   * @throws {Error} When offer creation fails
   */
  public createOffer = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: CreateOfferBody = await c.req.json();
      const { margin, minimum, maximum } = body;

      const offerId = await this.offerService.create({
        ...body,
        user_id: user.id,
        minimum: minimum.toString(),
        maximum: maximum.toString(),
        margin: margin.toString(),
        status: 'active',
        active: true,
      });

      return c.json({
        offer_id: offerId,
        message: 'Offer created successfully',
      });
    } catch (error) {
      logger.error('Failed to create offer:', error);
      return serveBadRequest(c, 'Failed to create offer');
    }
  };

  /**
   * Retrieves all offers for the authenticated user
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing list of offers
   * @throws {Error} When fetching offers fails
   */
  public getMyOffers = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const [offers, count] = await Promise.all([
        this.offerService.findByUserId(user.id),
        this.offerService.getCount(user.id),
      ]);

      return c.json({
        offers,
        count,
      });
    } catch (error) {
      logger.error('Failed to get offers:', error);
      return serveBadRequest(c, 'Failed to get offers');
    }
  };

  /**
   * Retrieves all active offers
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing list of active offers
   * @throws {Error} When fetching active offers fails
   */
  public getActiveOffers = async (c: Context) => {
    try {
      const [offers, count] = await Promise.all([
        this.offerService.findActive(),
        this.offerService.getActiveCount(),
      ]);

      return c.json({
        offers,
        count,
      });
    } catch (error) {
      logger.error('Failed to get active offers:', error);
      return serveBadRequest(c, 'Failed to get active offers');
    }
  };

  /**
   * Filters offers based on criteria
   * @param {Context} c - The Hono context containing filter criteria
   * @returns {Promise<Response>} Response containing filtered offers
   * @throws {Error} When filtering offers fails
   */
  public filterOffers = async (c: Context) => {
    try {
      const body: FilterOffersBody = await c.req.json();
      const { currency, method_id, status, min_rate, max_rate, user_id, page, limit } = body;

      const criteria: FilterOffersBody = {
        page,
        limit,
      };

      if (currency) criteria.currency = currency;
      if (method_id) criteria.method_id = method_id;
      if (status) criteria.status = status;
      if (min_rate) criteria.min_rate = min_rate;
      if (max_rate) criteria.max_rate = max_rate;
      if (user_id) criteria.user_id = user_id;

      const offers = await this.offerService.filter(criteria);

      return c.json({
        offers,
        criteria,
      });
    } catch (error) {
      logger.error('Failed to filter offers:', error);
      return serveBadRequest(c, 'Failed to filter offers');
    }
  };

  /**
   * Retrieves a specific offer by ID
   * @param {Context} c - The Hono context containing offer ID
   * @returns {Promise<Response>} Response containing offer details
   * @throws {Error} When fetching offer fails
   */
  public getOffer = async (c: Context) => {
    try {
      const id = parseInt(c.req.param('id'));
      const offer = await this.offerService.findById(id);

      if (!offer) {
        return serveNotFound(c, 'Offer not found');
      }

      return c.json(offer);
    } catch (error) {
      logger.error('Failed to get offer:', error);
      return serveBadRequest(c, 'Failed to get offer');
    }
  };

  /**
   * Updates an existing offer
   * @param {Context} c - The Hono context containing offer details
   * @returns {Promise<Response>} Response indicating update status
   * @throws {Error} When offer update fails
   */
  public updateOffer = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));
      const body: UpdateOfferBody = await c.req.json();
      const { minimum, maximum, margin } = body;
      // Check if offer exists and belongs to user
      const existingOffer = await this.offerService.findById(id);
      if (!existingOffer) {
        return serveNotFound(c, 'Offer not found');
      }

      if (existingOffer.user_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      // Convert numbers to strings for decimal fields
      const updateData: Partial<UpdateOfferBody> = { ...body };

      await this.offerService.update(id, {
        ...updateData,
        minimum: minimum?.toString(),
        maximum: maximum?.toString(),
        margin: margin?.toString(),
      });

      return c.json({
        message: 'Offer updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update offer:', error);
      return serveBadRequest(c, 'Failed to update offer');
    }
  };

  /**
   * Quick edit for offer (partial update)
   * @param {Context} c - The Hono context containing offer details
   * @returns {Promise<Response>} Response indicating update status
   * @throws {Error} When offer quick edit fails
   */
  public quickEdit = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));
      const body: QuickEditOfferBody = await c.req.json();

      // Check if offer exists and belongs to user
      const existingOffer = await this.offerService.findById(id);
      if (!existingOffer) {
        return serveNotFound(c, 'Offer not found');
      }

      if (existingOffer.user_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      // Convert numbers to strings for decimal fields
      const updateData: any = { ...body };
      if (body.margin !== undefined) {
        updateData.margin = body.margin.toString();
      }

      await this.offerService.update(id, updateData);

      return c.json({
        message: 'Offer updated successfully',
      });
    } catch (error) {
      logger.error('Failed to quick edit offer:', error);
      return serveBadRequest(c, 'Failed to quick edit offer');
    }
  };

  /**
   * Toggles offer status
   * @param {Context} c - The Hono context containing offer ID and status
   * @returns {Promise<Response>} Response indicating toggle status
   * @throws {Error} When offer toggle fails
   */
  public toggleOffer = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));
      const body: ToggleOfferBody = await c.req.json();

      // Check if offer exists and belongs to user
      const existingOffer = await this.offerService.findById(id);
      if (!existingOffer) {
        return serveNotFound(c, 'Offer not found');
      }

      if (existingOffer.user_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.offerService.toggleStatus(id, body.status);

      return c.json({
        message: `Offer status changed to ${body.status}`,
      });
    } catch (error) {
      logger.error('Failed to toggle offer:', error);
      return serveBadRequest(c, 'Failed to toggle offer');
    }
  };

  /**
   * Toggles all offers for the authenticated user
   * @param {Context} c - The Hono context containing status
   * @returns {Promise<Response>} Response indicating toggle status
   * @throws {Error} When toggling all offers fails
   */
  public toggleAllOffers = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: ToggleAllOffersBody = await c.req.json();

      await this.offerService.toggleAllForUser(user.id, body.status);

      return c.json({
        message: `All offers status changed to ${body.status}`,
      });
    } catch (error) {
      logger.error('Failed to toggle all offers:', error);
      return serveBadRequest(c, 'Failed to toggle all offers');
    }
  };

  /**
   * Deletes an offer
   * @param {Context} c - The Hono context containing offer ID
   * @returns {Promise<Response>} Response indicating deletion status
   * @throws {Error} When offer deletion fails
   */
  public deleteOffer = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));

      // Check if offer exists and belongs to user
      const existingOffer = await this.offerService.findById(id);
      if (!existingOffer) {
        return serveNotFound(c, 'Offer not found');
      }

      if (existingOffer.user_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.offerService.delete(id);

      return c.json({
        message: 'Offer deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete offer:', error);
      return serveBadRequest(c, 'Failed to delete offer');
    }
  };

  /**
   * Deletes all offers for the authenticated user
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response indicating deletion status
   * @throws {Error} When offer deletion fails
   */
  public deleteAllOffers = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      await this.offerService.deleteByUserId(user.id);

      return c.json({
        message: 'All offers deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete all offers:', error);
      return serveBadRequest(c, 'Failed to delete all offers');
    }
  };
}
