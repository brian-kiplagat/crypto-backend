import type { Context } from 'hono';

import { logger } from '../../lib/logger.js';
import { NewTrade } from '../../schema/schema.ts';
import { OfferService } from '../../service/offer.ts';
import { PriceService } from '../../service/price.ts';
import type { TradeService } from '../../service/trade.js';
import { UserService } from '../../service/user.js';
import {
  type CancelTradeBody,
  type CreateTradeBody,
  type FilterTradesBody,
  GetTradePriceBody,
  type OpenDisputeBody,
  type ResolveDisputeBody,
} from '../validator/trade.js';
import { ERRORS, serveBadRequest, serveNotFound } from './resp/error.js';

export class TradeController {
  private tradeService: TradeService;
  private userService: UserService;
  private offerService: OfferService;
  private priceService: PriceService;

  constructor(
    tradeService: TradeService,
    userService: UserService,
    offerService: OfferService,
    priceService: PriceService,
  ) {
    this.tradeService = tradeService;
    this.userService = userService;
    this.offerService = offerService;
    this.priceService = priceService;
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
   * Creates a new trade
   * @param {Context} c - The Hono context containing trade details
   * @returns {Promise<Response>} Response containing created trade information
   * @throws {Error} When trade creation fails
   */
  public createTrade = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: CreateTradeBody = await c.req.json();
      const { offer_id, fiat_amount, request_id } = body;
      // Get the offer
      const offer = await this.offerService.findById(offer_id);
      if (!offer) {
        throw new Error('Offer not found. Check if you have the correct link');
      }

      //de duplicate trade check
      const request = await this.tradeService.findByRequestId(request_id);
      if (request) {
        return serveBadRequest(c, 'Ops, this trade is already created');
      }

      // Validate offer is active
      if (offer.status !== 'active' || !offer.active) {
        throw new Error('Offer is not active at the moment');
      }

      // Validate buyer is not the seller
      if (offer.user_id === user.id) {
        throw new Error('You cannot make a trade from your own offer');
      }

      // Policy checks (user health and offer rules)
      if (user.health && user.health !== 'active') {
        return serveBadRequest(c, `Your account is ${user.health}.`);
      }
      if (offer.deauth) {
        return serveBadRequest(c, 'This offer is de-authorized by our support');
      }
      if (offer.id_verification && !user.is_verified) {
        return serveBadRequest(c, 'You must verify your ID to trade on this offer');
      }
      if (offer.full_name_required && (!user.name || user.name.trim().length < 2)) {
        return serveBadRequest(c, 'Your full name is required for this offer');
      }

      // Validate fiat amount is within offer minimum and maximum
      const min = parseFloat(offer.minimum);
      const max = parseFloat(offer.maximum);
      if (min && fiat_amount < min) {
        return serveBadRequest(c, `Enter an amount ≥ ${min}`);
      }
      if (max && fiat_amount > max) {
        return serveBadRequest(c, `Enter an amount ≤ ${max}`);
      }

      // Trades count rules
      const myTrades = await this.tradeService.getCount(user.id);
      if (offer.new_trader_limit && myTrades < (offer.minimum_trades ?? 0)) {
        return serveBadRequest(
          c,
          `This offer requires at least ${offer.minimum_trades} completed trades. You currently have ${myTrades}.`,
        );
      }

      // VPN / Tor header-based stub (set by upstream)
      if (offer.vpn_blocked && c.req.header('x-vpn') === 'true') {
        return serveBadRequest(c, 'This offer is not available for VPN/Tor users');
      }
      // Country restrictions via header stub `x-country-iso`
      const countryIso = (c.req.header('x-country-iso') || '').toUpperCase();
      if (countryIso && offer.limit_countries && offer.limit_countries !== 'none') {
        const blocked = (offer.blocked_countries as string[] | null) || [];
        const allowed = (offer.allowed_countries as string[] | null) || [];
        if (offer.limit_countries === 'blocked' && blocked.includes(countryIso)) {
          return serveBadRequest(c, 'This offer is not available in your country or region. ');
        }
        if (offer.limit_countries === 'allowed' && !allowed.includes(countryIso)) {
          return serveBadRequest(
            c,
            'This offer is not available in your country or region. Please check other offers.',
          );
        }
      }

      // Use PriceService for live price and calculations
      let currentBtcPrice = 0;
      try {
        currentBtcPrice = await this.priceService.getBtcPrice(offer.currency);
      } catch (error) {
        logger.error('Failed to get BTC price:', error);
        return serveBadRequest(c, 'We could not obtain prices for this trade');
      }
      if (!currentBtcPrice || Number.isNaN(currentBtcPrice)) {
        return serveBadRequest(c, 'Failed to resolve BTC price');
      }

      const margin = parseFloat(offer.margin);
      const pricing = this.priceService.calculatePricing(margin, currentBtcPrice, fiat_amount);
      const btcAmountOriginal = this.priceService.convertFiatToBtc(fiat_amount, currentBtcPrice);

      const offerType = offer.type === 'buy' ? 'buy' : 'sell';
      const sellerId = offerType === 'sell' ? offer.user_id : user.id;
      const buyerId = offerType === 'sell' ? user.id : offer.user_id;

      // escrow from sellerId
      const funderBalanceStr = await this.userService.getBalance(sellerId);
      const funderBalance = parseFloat(funderBalanceStr || '0');
      if (funderBalance < btcAmountOriginal) {
        return serveBadRequest(
          c,
          `Seller has insufficient BTC to fund escrow. Required: ${btcAmountOriginal.toFixed(8)} BTC, Available: ${funderBalance.toFixed(8)} BTC`,
        );
      }
      await this.userService.setBalance(sellerId, (funderBalance - btcAmountOriginal).toFixed(8));

      // Set expiry time (30 minutes from now)
      const expiryTime = new Date();
      expiryTime.setMinutes(expiryTime.getMinutes() + 30);

      const tradeData: NewTrade = {
        request_id: request_id,
        fiat_amount_original: fiat_amount.toString(),
        fiat_amount_with_margin: pricing.fiat_amount_with_margin.toFixed(2).toString(),
        btc_amount_with_margin: pricing.btc_amount_with_margin.toFixed(8).toString(),
        btc_amount_original: btcAmountOriginal.toFixed(8).toString(),
        price: pricing.price.toFixed(2).toString(),
        buyer: buyerId,
        seller: sellerId,
        offer_id: offer_id,
        status: 'OPENED',
        expiry_time: expiryTime,
        dispute_started: false,
        escrow_return: false,
      };

      const tradeId = await this.tradeService.create(tradeData);

      return c.json({
        trade_id: tradeId,
        message: 'Trade created successfully',
      });
    } catch (error) {
      logger.error('Failed to create trade:', error);
      return serveBadRequest(c, error instanceof Error ? error.message : 'Failed to create trade');
    }
  };

  public getTradePrice = async (c: Context) => {
    try {
      const body: GetTradePriceBody = await c.req.json();
      const { currency, fiat_amount } = body;
      const currentBtcPrice = await this.priceService.getBtcPrice(currency);
      const pricing = this.priceService.calculatePricing(0, currentBtcPrice, fiat_amount);
      return c.json({
        pricing,
        currentBtcPrice,
      });
    } catch (error) {
      logger.error('Failed to get trade price:', error);
      return serveBadRequest(
        c,
        error instanceof Error ? error.message : 'Failed to get trade price',
      );
    }
  };

  /**
   * Reopens a cancelled trade
   * @param {Context} c - The Hono context containing trade ID
   * @returns {Promise<Response>} Response indicating reopen status
   * @throws {Error} When reopening trade fails
   */
  public reopenTrade = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));

      // Check if trade exists and user is involved
      const existingTrade = await this.tradeService.findById(id);
      if (!existingTrade) {
        return serveNotFound(c, 'Trade not found');
      }

      if (existingTrade.buyer !== user.id && existingTrade.seller !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      // Validate status eligible for reopen
      if (
        !existingTrade.status ||
        !['CANCELLED_BUYER', 'CANCELLED_SELLER'].includes(existingTrade.status)
      ) {
        return serveBadRequest(c, 'Trade cannot be reopened in current status');
      }

      // Reset expiry time and re-fund escrow from seller
      const sellerBalanceStr = await this.userService.getBalance(existingTrade.seller);
      const sellerBalance = parseFloat(sellerBalanceStr || '0');
      const escrowAmount = parseFloat(existingTrade.btc_amount_original);
      if (sellerBalance < escrowAmount) {
        return serveBadRequest(
          c,
          `Insufficient balance to reopen trade. Required: ${escrowAmount.toFixed(8)} BTC, Available: ${sellerBalance.toFixed(8)} BTC`,
        );
      }
      await this.userService.setBalance(
        existingTrade.seller,
        (sellerBalance - escrowAmount).toFixed(8),
      );

      // Reset expiry time
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() + 24);

      await this.tradeService.reopenTrade(id, {
        status: 'OPENED',
        cancelled: 'NA',
        expiry_time: expiryTime,
      });

      return c.json({
        success: true,
        message: 'Trade reopened successfully',
      });
    } catch (error) {
      logger.error('Failed to reopen trade:', error);
      return serveBadRequest(c, error instanceof Error ? error.message : 'Failed to reopen trade');
    }
  };

  /**
   * Retrieves a specific trade by ID
   * @param {Context} c - The Hono context containing trade ID
   * @returns {Promise<Response>} Response containing trade details
   * @throws {Error} When fetching trade fails
   */
  public getTrade = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));
      const trade = await this.tradeService.findById(id);

      if (!trade) {
        return serveNotFound(c, 'Trade not found');
      }

      // Ensure user can only access their own trades
      if (trade.buyer !== user.id && trade.seller !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      return c.json(trade);
    } catch (error) {
      logger.error('Failed to get trade:', error);
      return serveBadRequest(c, 'Failed to get trade');
    }
  };

  /**
   * Retrieves all trades for the authenticated user
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing list of trades
   * @throws {Error} When fetching trades fails
   */
  public getMyTrades = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const [trades, count] = await Promise.all([
        this.tradeService.findByUserId(user.id),
        this.tradeService.getCount(user.id),
      ]);

      return c.json({
        trades,
        count,
      });
    } catch (error) {
      logger.error('Failed to get trades:', error);
      return serveBadRequest(c, 'Failed to get trades');
    }
  };

  /**
   * Filters trades based on criteria
   * @param {Context} c - The Hono context containing filter criteria
   * @returns {Promise<Response>} Response containing filtered trades
   * @throws {Error} When filtering trades fails
   */
  public filterTrades = async (c: Context) => {
    try {
      const body: FilterTradesBody = await c.req.json();
      const trades = await this.tradeService.filter(body);

      return c.json({
        trades,
        criteria: body,
      });
    } catch (error) {
      logger.error('Failed to filter trades:', error);
      return serveBadRequest(c, 'Failed to filter trades');
    }
  };

  /**
   * Marks a trade as paid
   * @param {Context} c - The Hono context containing trade ID
   * @returns {Promise<Response>} Response indicating paid status
   * @throws {Error} When marking trade as paid fails
   */
  public markPaid = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));

      // Check if trade exists and user is the buyer
      const existingTrade = await this.tradeService.findById(id);
      if (!existingTrade) {
        return serveNotFound(c, 'Trade not found');
      }

      if (existingTrade.buyer !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      if (existingTrade.status !== 'OPENED') {
        return serveBadRequest(c, 'Trade is not in OPENED status');
      }

      await this.tradeService.markPaid(id);

      return c.json({
        message: 'Trade marked as paid',
      });
    } catch (error) {
      logger.error('Failed to mark trade as paid:', error);
      return serveBadRequest(
        c,
        error instanceof Error ? error.message : 'Failed to mark trade as paid',
      );
    }
  };

  /**
   * Cancels a trade
   * @param {Context} c - The Hono context containing trade ID
   * @returns {Promise<Response>} Response indicating cancellation status
   * @throws {Error} When cancelling trade fails
   */
  public cancelTrade = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));
      const body: CancelTradeBody = await c.req.json();

      // Check if trade exists and user is involved
      const existingTrade = await this.tradeService.findById(id);
      if (!existingTrade) {
        return serveNotFound(c, 'Trade not found');
      }

      if (existingTrade.buyer !== user.id && existingTrade.seller !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      if (existingTrade.status !== 'OPENED') {
        return serveBadRequest(c, 'Trade cannot be cancelled in current status');
      }

      // Return escrow to seller balance
      const sellerBalanceStr = await this.userService.getBalance(existingTrade.seller);
      const sellerBalance = parseFloat(sellerBalanceStr || '0');
      const escrowAmount = parseFloat(existingTrade.btc_amount_original);
      await this.userService.setBalance(
        existingTrade.seller,
        (sellerBalance + escrowAmount).toFixed(8),
      );

      const cancelledBy = existingTrade.buyer === user.id ? 'buyer' : 'seller';
      await this.tradeService.cancelTrade(id, cancelledBy, body.reason);

      return c.json({
        message: 'Trade cancelled successfully',
        escrow_returned: escrowAmount.toFixed(8),
      });
    } catch (error) {
      logger.error('Failed to cancel trade:', error);
      return serveBadRequest(c, error instanceof Error ? error.message : 'Failed to cancel trade');
    }
  };

  /**
   * Opens a dispute for a trade
   * @param {Context} c - The Hono context containing trade ID
   * @returns {Promise<Response>} Response indicating dispute status
   * @throws {Error} When opening dispute fails
   */
  public openDispute = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));
      const body: OpenDisputeBody = await c.req.json();

      // Check if trade exists and user is involved
      const existingTrade = await this.tradeService.findById(id);
      if (!existingTrade) {
        return serveNotFound(c, 'Trade not found');
      }

      if (existingTrade.buyer !== user.id && existingTrade.seller !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }
      if (existingTrade.dispute_started) {
        return serveBadRequest(c, 'Dispute already started for this trade');
      }

      if (!existingTrade.status || !['OPENED', 'PAID'].includes(existingTrade.status as any)) {
        return serveBadRequest(c, 'Dispute cannot be opened for trade in current status');
      }

      const startedBy = existingTrade.buyer === user.id ? 'buyer' : 'seller';
      await this.tradeService.openDispute(id, startedBy, body.reason, body.explanation);

      return c.json({
        message: 'Dispute opened successfully',
      });
    } catch (error) {
      logger.error('Failed to open dispute:', error);
      return serveBadRequest(c, error instanceof Error ? error.message : 'Failed to open dispute');
    }
  };

  /**
   * Resolves a dispute (Admin/Moderator only)
   * @param {Context} c - The Hono context containing trade ID
   * @returns {Promise<Response>} Response indicating resolution status
   * @throws {Error} When resolving dispute fails
   */
  public resolveDispute = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // TODO: Add admin/moderator role check
      // if (user.role !== 'admin' && user.role !== 'moderator') {
      //   return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      // }
      const id = parseInt(c.req.param('id'));
      const trade = await this.tradeService.findById(id);
      if (!trade) {
        throw new Error('Trade not found');
      }
      const body: ResolveDisputeBody = await c.req.json();
      if (!trade.dispute_started) {
        return serveBadRequest(c, 'No dispute exists for this trade');
      }
      await this.tradeService.resolveDispute(id, body.awarded_to, body.mod_notes);

      return c.json({
        message: `Dispute resolved in favor of ${body.awarded_to}`,
      });
    } catch (error) {
      logger.error('Failed to resolve dispute:', error);
      return serveBadRequest(
        c,
        error instanceof Error ? error.message : 'Failed to resolve dispute',
      );
    }
  };

  /**
   * Releases crypto to buyer
   * @param {Context} c - The Hono context containing trade ID
   * @returns {Promise<Response>} Response indicating release status
   * @throws {Error} When releasing crypto fails
   */
  public releaseCrypto = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));

      // Check if trade exists and user is the seller
      const existingTrade = await this.tradeService.findById(id);
      if (!existingTrade) {
        return serveNotFound(c, 'Trade not found');
      }

      if (existingTrade.seller !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }
      if (existingTrade.status !== 'PAID') {
        return serveBadRequest(c, 'Trade must be in PAID status to release crypto');
      }

      // Distribute escrow: credit buyer with btc_amount_with_margin, return difference to seller
      const escrowAmount = parseFloat(existingTrade.btc_amount_original);
      const buyerAmount = parseFloat(existingTrade.btc_amount_with_margin);
      const sellerAmount = Math.max(escrowAmount - buyerAmount, 0);

      const sellerBalanceStr = await this.userService.getBalance(existingTrade.seller);
      const buyerBalanceStr = await this.userService.getBalance(existingTrade.buyer);
      const sellerBalance = parseFloat(sellerBalanceStr || '0');
      const buyerBalance = parseFloat(buyerBalanceStr || '0');

      await this.userService.setBalance(
        existingTrade.buyer,
        (buyerBalance + buyerAmount).toFixed(8),
      );
      if (sellerAmount > 0) {
        await this.userService.setBalance(
          existingTrade.seller,
          (sellerBalance + sellerAmount).toFixed(8),
        );
      }

      await this.tradeService.releaseCrypto(id);

      return c.json({
        message: 'Crypto released successfully',
        buyer_received: buyerAmount.toFixed(8),
        seller_returned: sellerAmount.toFixed(8),
      });
    } catch (error) {
      logger.error('Failed to release crypto:', error);
      return serveBadRequest(
        c,
        error instanceof Error ? error.message : 'Failed to release crypto',
      );
    }
  };

  /**
   * Gets expired trades (Admin/Moderator only)
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing expired trades
   * @throws {Error} When fetching expired trades fails
   */
  public getExpiredTrades = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // TODO: Add admin/moderator role check
      // if (user.role !== 'admin' && user.role !== 'moderator') {
      //   return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      // }

      const trades = await this.tradeService.findExpired();

      return c.json({
        trades,
        count: trades.length,
      });
    } catch (error) {
      logger.error('Failed to get expired trades:', error);
      return serveBadRequest(c, 'Failed to get expired trades');
    }
  };

  /**
   * Gets disputed trades (Admin/Moderator only)
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing disputed trades
   * @throws {Error} When fetching disputed trades fails
   */
  public getDisputedTrades = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // TODO: Add admin/moderator role check
      // if (user.role !== 'admin' && user.role !== 'moderator') {
      //   return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      // }

      const [trades, count] = await Promise.all([
        this.tradeService.findDisputed(),
        this.tradeService.getDisputedCount(),
      ]);

      return c.json({
        trades,
        count,
      });
    } catch (error) {
      logger.error('Failed to get disputed trades:', error);
      return serveBadRequest(c, 'Failed to get disputed trades');
    }
  };

  /**
   * Deletes a trade (Admin/Moderator only)
   * @param {Context} c - The Hono context containing trade ID
   * @returns {Promise<Response>} Response indicating deletion status
   * @throws {Error} When trade deletion fails
   */
  public deleteTrade = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // TODO: Add admin/moderator role check
      // if (user.role !== 'admin' && user.role !== 'moderator') {
      //   return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      // }

      const id = parseInt(c.req.param('id'));

      await this.tradeService.delete(id);

      return c.json({
        message: 'Trade deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete trade:', error);
      return serveBadRequest(c, 'Failed to delete trade');
    }
  };
}
