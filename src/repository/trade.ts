import { and, desc, eq, gte, lte, or, sql } from 'drizzle-orm';

import { db } from '../lib/database.js';
import type { NewTrade } from '../schema/schema.js';
import { tradesSchema } from '../schema/schema.js';
import { TradeStatus } from '../util/string.js';

export class TradeRepository {
  public async create(trade: NewTrade) {
    return db.insert(tradesSchema).values(trade).$returningId();
  }

  public async findById(id: number) {
    return db.query.tradesSchema.findFirst({
      where: eq(tradesSchema.id, id),
      with: {
        offer: true,
        buyerUser: true,
        sellerUser: true,
      },
    });
  }

  public async findByRequestId(requestId: string) {
    return db.query.tradesSchema.findFirst({
      where: eq(tradesSchema.requestId, requestId),
      with: {
        offer: true,
        buyerUser: true,
        sellerUser: true,
      },
    });
  }

  public async findByUserId(userId: number) {
    return db.query.tradesSchema.findMany({
      where: or(eq(tradesSchema.buyer, userId), eq(tradesSchema.seller, userId)),
      orderBy: [desc(tradesSchema.created_at)],
      with: {
        offer: true,
        buyerUser: true,
        sellerUser: true,
      },
    });
  }

  public async findByBuyerId(buyerId: number) {
    return db.query.tradesSchema.findMany({
      where: eq(tradesSchema.buyer, buyerId),
      orderBy: [desc(tradesSchema.created_at)],
      with: {
        offer: true,
        buyerUser: true,
        sellerUser: true,
      },
    });
  }

  public async findBySellerId(sellerId: number) {
    return db.query.tradesSchema.findMany({
      where: eq(tradesSchema.seller, sellerId),
      orderBy: [desc(tradesSchema.created_at)],
      with: {
        offer: true,
        buyerUser: true,
        sellerUser: true,
      },
    });
  }

  public async findByOfferId(offerId: number) {
    return db.query.tradesSchema.findMany({
      where: eq(tradesSchema.offer_id, offerId),
      orderBy: [desc(tradesSchema.created_at)],
      with: {
        offer: true,
        buyerUser: true,
        sellerUser: true,
      },
    });
  }

  public async findByStatus(status: TradeStatus) {
    return db.query.tradesSchema.findMany({
      where: eq(tradesSchema.status, status),
      orderBy: [desc(tradesSchema.created_at)],
      with: {
        offer: true,
        buyerUser: true,
        sellerUser: true,
      },
    });
  }

  public async findExpired() {
    return db.query.tradesSchema.findMany({
      where: and(eq(tradesSchema.status, 'OPENED'), lte(tradesSchema.expiry_time, new Date())),
      orderBy: [desc(tradesSchema.created_at)],
      with: {
        offer: true,
        buyerUser: true,
        sellerUser: true,
      },
    });
  }

  public async findDisputed() {
    return db.query.tradesSchema.findMany({
      where: eq(tradesSchema.dispute_started, true),
      orderBy: [desc(tradesSchema.dispute_time)],
      with: {
        offer: true,
        buyerUser: true,
        sellerUser: true,
      },
    });
  }

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
    const conditions = [];

    if (criteria.status) {
      conditions.push(eq(tradesSchema.status, criteria.status));
    }

    if (criteria.buyer_id) {
      conditions.push(eq(tradesSchema.buyer, criteria.buyer_id));
    }

    if (criteria.seller_id) {
      conditions.push(eq(tradesSchema.seller, criteria.seller_id));
    }

    if (criteria.offer_id) {
      conditions.push(eq(tradesSchema.offer_id, criteria.offer_id));
    }

    if (criteria.min_amount !== undefined) {
      conditions.push(gte(tradesSchema.fiat_amount_original, criteria.min_amount.toString()));
    }

    if (criteria.max_amount !== undefined) {
      conditions.push(lte(tradesSchema.fiat_amount_original, criteria.max_amount.toString()));
    }

    if (criteria.dispute_started !== undefined) {
      conditions.push(eq(tradesSchema.dispute_started, criteria.dispute_started));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const limit = criteria.limit || 20;
    const offset = ((criteria.page || 1) - 1) * limit;

    return db.query.tradesSchema.findMany({
      where: whereClause,
      orderBy: [desc(tradesSchema.created_at)],
      limit,
      offset,
      with: {
        offer: true,
        buyerUser: true,
        sellerUser: true,
      },
    });
  }

  public async update(id: number, data: Partial<NewTrade>) {
    return db.update(tradesSchema).set(data).where(eq(tradesSchema.id, id));
  }

  public async updateStatus(id: number, status: TradeStatus) {
    return db.update(tradesSchema).set({ status }).where(eq(tradesSchema.id, id));
  }

  public async markPaid(id: number) {
    return db.update(tradesSchema).set({ status: 'PAID' }).where(eq(tradesSchema.id, id));
  }

  public async cancelTrade(id: number, cancelledBy: 'buyer' | 'seller', reason?: string) {
    return db
      .update(tradesSchema)
      .set({
        status: cancelledBy === 'buyer' ? 'CANCELLED_BUYER' : 'CANCELLED_SELLER',
        cancelled: reason || 'User cancelled',
      })
      .where(eq(tradesSchema.id, id));
  }

  public async openDispute(
    id: number,
    startedBy: 'buyer' | 'seller',
    reason: string,
    explanation: string,
  ) {
    return db
      .update(tradesSchema)
      .set({
        dispute_started: true,
        dispute_time: new Date(),
        dispute_reason: reason,
        dispute_explanation: explanation,
        dispute_started_by: startedBy,
        status: 'DISPUTED',
      })
      .where(eq(tradesSchema.id, id));
  }

  public async resolveDispute(id: number, awardedTo: 'buyer' | 'seller', modNotes?: string) {
    return db
      .update(tradesSchema)
      .set({
        status: awardedTo === 'buyer' ? 'AWARDED_BUYER' : 'AWARDED_SELLER',
        dispute_time_resolve: new Date(),
        dispute_mod_notes: modNotes,
        dispute_started: false,
      })
      .where(eq(tradesSchema.id, id));
  }

  public async releaseCrypto(id: number) {
    return db
      .update(tradesSchema)
      .set({
        status: 'SUCCESSFUL',
        escrow_return: false,
      })
      .where(eq(tradesSchema.id, id));
  }

  public async expireTrade(id: number) {
    return db
      .update(tradesSchema)
      .set({
        status: 'CANCELLED_SYSTEM',
        cancelled: 'Trade expired',
      })
      .where(eq(tradesSchema.id, id));
  }

  public async delete(id: number) {
    return db.delete(tradesSchema).where(eq(tradesSchema.id, id));
  }

  public async deleteByUserId(userId: number) {
    return db
      .delete(tradesSchema)
      .where(or(eq(tradesSchema.buyer, userId), eq(tradesSchema.seller, userId)));
  }

  public async getCount(userId?: number) {
    const whereClause = userId
      ? or(eq(tradesSchema.buyer, userId), eq(tradesSchema.seller, userId))
      : undefined;

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(tradesSchema)
      .where(whereClause);

    return result[0]?.count || 0;
  }

  public async getCountByStatus(status: TradeStatus) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(tradesSchema)
      .where(eq(tradesSchema.status, status));

    return result[0]?.count || 0;
  }

  public async getDisputedCount() {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(tradesSchema)
      .where(eq(tradesSchema.dispute_started, true));

    return result[0]?.count || 0;
  }
}
