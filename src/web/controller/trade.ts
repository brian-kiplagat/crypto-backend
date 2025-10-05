import type { Context } from 'hono';

import { logger } from '../../lib/logger.js';
import { NewTrade } from '../../schema/schema.ts';
import { OfferService } from '../../service/offer.ts';
import type { TradeService } from '../../service/trade.js';
import { UserService } from '../../service/user.js';
import {
    type CancelTradeBody,
    type CreateTradeBody,
    type FilterTradesBody,
    type OpenDisputeBody,
    type ResolveDisputeBody,
    type UpdateTradeBody,
} from '../validator/trade.js';
import { ERRORS, serveBadRequest, serveNotFound } from './resp/error.js';

export class TradeController {
    private tradeService: TradeService;
    private userService: UserService;
    private offerService: OfferService;

    constructor(tradeService: TradeService, userService: UserService, offerService: OfferService) {
        this.tradeService = tradeService;
        this.userService = userService;
        this.offerService = offerService;
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
            const { offer_id, fiat_amount } = body;
            // Get the offer
            const offer = await this.offerService.findById(offer_id);
            if (!offer) {
                throw new Error('Offer not found');
            }

            // Validate offer is active
            if (offer.status !== 'active' || !offer.active) {
                throw new Error('Offer is not active');
            }

            // Validate buyer is not the seller
            if (offer.user_id === user.id) {
                throw new Error('Cannot buy from your own offer');
            }

            // Calculate amounts
            const finalRate =
                parseFloat(offer.exchange_rate) +
                parseFloat(offer.exchange_rate) * parseFloat(offer.margin);
            const btcAmount = fiat_amount / finalRate;
            const fiatWithMargin = fiat_amount * (1 + parseFloat(offer.margin));

            // Generate unique request ID
            const requestId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Set expiry time (24 hours from now)
            const expiryTime = new Date();
            expiryTime.setHours(expiryTime.getHours() + 24);

            const tradeData: NewTrade = {
                requestId,
                type: 'buy',
                fiat_amount_original: fiat_amount.toString(),
                fiat_amount_with_margin: fiatWithMargin.toString(),
                btc_amount_with_margin: btcAmount.toString(),
                btc_amount_original: btcAmount.toString(),
                price: finalRate.toString(),
                buyer: user.id,
                seller: offer.user_id,
                offer_id: offer_id,
                status: 'OPENED',
                expiry_time: expiryTime,
                dispute_started: false,
                escrow_return: false,
            };

            const tradeId = await this.tradeService.create(tradeData);

            return c.json({
                success: true,
                trade_id: tradeId,
                message: 'Trade created successfully',
            });
        } catch (error) {
            logger.error('Failed to create trade:', error);
            return serveBadRequest(c, error instanceof Error ? error.message : 'Failed to create trade');
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

            return c.json({
                success: true,
                trade,
            });
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
                success: true,
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
                success: true,
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
                success: true,
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

            const cancelledBy = existingTrade.buyer === user.id ? 'buyer' : 'seller';
            await this.tradeService.cancelTrade(id, cancelledBy, body.reason);

            return c.json({
                success: true,
                message: 'Trade cancelled successfully',
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
                success: true,
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
                success: true,
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

            await this.tradeService.releaseCrypto(id);

            return c.json({
                success: true,
                message: 'Crypto released successfully',
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
                success: true,
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
                success: true,
                trades,
                count,
            });
        } catch (error) {
            logger.error('Failed to get disputed trades:', error);
            return serveBadRequest(c, 'Failed to get disputed trades');
        }
    };

    /**
     * Updates a trade (Admin/Moderator only)
     * @param {Context} c - The Hono context containing trade details
     * @returns {Promise<Response>} Response indicating update status
     * @throws {Error} When trade update fails
     */
    public updateTrade = async (c: Context) => {
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
            const body: UpdateTradeBody = await c.req.json();

            // Convert decimal numbers to strings and normalize date fields
            const updateData: Partial<UpdateTradeBody> = { ...body };
            if (body.fiat_amount_original !== undefined) {
                updateData.fiat_amount_original = body.fiat_amount_original.toString();
            }
            if (body.fiat_amount_with_margin !== undefined) {
                updateData.fiat_amount_with_margin = body.fiat_amount_with_margin.toString();
            }
            if (body.btc_amount_with_margin !== undefined) {
                updateData.btc_amount_with_margin = body.btc_amount_with_margin.toString();
            }
            if (body.btc_amount_original !== undefined) {
                updateData.btc_amount_original = body.btc_amount_original.toString();
            }
            if (body.price !== undefined) {
                updateData.price = body.price.toString();
            }
            if (typeof body.expiry_time === 'string') {
                updateData.expiry_time = new Date(body.expiry_time);
            }

            await this.tradeService.update(id, updateData);

            return c.json({
                success: true,
                message: 'Trade updated successfully',
            });
        } catch (error) {
            logger.error('Failed to update trade:', error);
            return serveBadRequest(c, 'Failed to update trade');
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
                success: true,
                message: 'Trade deleted successfully',
            });
        } catch (error) {
            logger.error('Failed to delete trade:', error);
            return serveBadRequest(c, 'Failed to delete trade');
        }
    };
}
