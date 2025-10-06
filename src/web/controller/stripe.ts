import type { Context } from 'hono';

import { logger } from '../../lib/logger.js';
import { StripeService } from '../../service/stripe.js';
import { ChargeAllCustomersBody, ChargeCustomerBody } from '../validator/stripe.js';
import { serveBadRequest, serveInternalServerError } from './resp/error.js';

export class StripeController {
  private stripeService: StripeService;

  constructor() {
    this.stripeService = new StripeService();
  }

  /**
   * Retrieves all Stripe customers
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing customers data
   * @throws {Error} When fetching customers fails
   */
  public getCustomers = async (c: Context) => {
    try {
      const limit = parseInt(c.req.query('limit') || '1000');
      const customers = await this.stripeService.getCustomers(limit);
      return c.json({
        success: true,
        data: customers.data,
        has_more: customers.has_more,
      });
    } catch (error) {
      logger.error('Failed to fetch customers:', error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves all customer cards with detailed information
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing customer cards data
   * @throws {Error} When fetching customer cards fails
   */
  public getCustomerCards = async (c: Context) => {
    try {
      const customerCards = await this.stripeService.getCustomerCards();
      return c.json({
        success: true,
        data: customerCards,
        count: customerCards.length,
      });
    } catch (error) {
      logger.error('Failed to fetch customer cards:', error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Charges all customers with available payment methods
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing charge results
   * @throws {Error} When charging customers fails
   */
  public chargeAllCustomers = async (c: Context) => {
    try {
      const body: ChargeAllCustomersBody = await c.req.json();
      const { amount = 200 } = body; // Default £2.00
      const results = await this.stripeService.chargeAllCustomers(amount);

      const successful = results.filter((r) => 'success' in r && r.success).length;
      const failed = results.filter((r) => 'success' in r && !r.success).length;
      const skipped = results.filter((r) => 'status' in r && r.status === 'skipped').length;

      return c.json({
        success: true,
        summary: {
          total: results.length,
          successful,
          failed,
          skipped,
        },
        results,
      });
    } catch (error) {
      logger.error('Failed to charge customers:', error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Charges a specific customer
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing charge result
   * @throws {Error} When charging customer fails
   */
  public chargeCustomer = async (c: Context) => {
    try {
      const body: ChargeCustomerBody = await c.req.json();
      const { customerId, paymentMethodId, email, amount = 200 } = body;

      if (!customerId || !paymentMethodId || !email) {
        return serveBadRequest(c, 'customerId, paymentMethodId, and email are required');
      }

      const result = await this.stripeService.chargeCustomer(
        customerId,
        paymentMethodId,
        email,
        amount,
      );

      if (result.success) {
        return c.json({
          success: true,
          message: `Successfully charged ${email}`,
          data: result,
        });
      }
      return c.json(
        {
          success: false,
          message: `Failed to charge ${email}`,
          error: result.error,
        },
        400,
      );
    } catch (error) {
      logger.error('Failed to charge customer:', error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves a specific customer by ID
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing customer data
   * @throws {Error} When fetching customer fails
   */
  public getCustomer = async (c: Context) => {
    try {
      const customerId = c.req.param('id');

      if (!customerId) {
        return serveBadRequest(c, 'Customer ID is required');
      }

      const customer = await this.stripeService.getCustomer(customerId);

      return c.json({
        success: true,
        data: customer,
      });
    } catch (error) {
      logger.error('Failed to get customer:', error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Gets payment methods for a customer
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing payment methods
   * @throws {Error} When fetching payment methods fails
   */
  public getCustomerPaymentMethods = async (c: Context) => {
    try {
      const customerId = c.req.param('id');
      const type = c.req.query('type') || 'card';

      if (!customerId) {
        return serveBadRequest(c, 'Customer ID is required');
      }

      const paymentMethods = await this.stripeService.getCustomerPaymentMethods(
        customerId,
        type as any,
      );

      return c.json({
        success: true,
        data: paymentMethods.data,
        count: paymentMethods.data.length,
      });
    } catch (error) {
      logger.error('Failed to get customer payment methods:', error);
      return serveInternalServerError(c, error);
    }
  };
}
