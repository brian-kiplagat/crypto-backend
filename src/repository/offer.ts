import { and, desc, eq, gte, like, lte, sql } from 'drizzle-orm';

import { db } from '../lib/database.js';
import type { NewOffer } from '../schema/schema.js';
import { offersSchema } from '../schema/schema.js';
import { FilterOffersBody } from '../web/validator/offer.ts';

export class OfferRepository {
  public async create(offer: NewOffer) {
    return db.insert(offersSchema).values(offer).$returningId();
  }

  public async findById(id: number) {
    return db.query.offersSchema.findFirst({
      where: eq(offersSchema.id, id),
      with: {
        user: true,
      },
    });
  }

  public async findByUserId(userId: number) {
    return db.query.offersSchema.findMany({
      where: eq(offersSchema.user_id, userId),
      orderBy: [desc(offersSchema.created_at)],
      with: {
        user: true,
      },
    });
  }

  public async findActive() {
    return db.query.offersSchema.findMany({
      where: and(eq(offersSchema.status, 'active'), eq(offersSchema.active, true)),
      orderBy: [desc(offersSchema.created_at)],
      with: {
        user: true,
      },
    });
  }

  public async filter(criteria: FilterOffersBody) {
    const conditions = [];

    if (criteria.currency) {
      conditions.push(eq(offersSchema.currency, criteria.currency));
    }

    if (criteria.method_id) {
      conditions.push(like(offersSchema.method_id, `%${criteria.method_id}%`));
    }

    if (criteria.status) {
      conditions.push(eq(offersSchema.status, criteria.status));
    }

    if (criteria.min_rate !== undefined) {
      conditions.push(gte(offersSchema.margin, criteria.min_rate.toString()));
    }

    if (criteria.max_rate !== undefined) {
      conditions.push(lte(offersSchema.margin, criteria.max_rate.toString()));
    }

    if (criteria.user_id) {
      conditions.push(eq(offersSchema.user_id, criteria.user_id));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const limit = criteria.limit || 20;
    const offset = ((criteria.page || 1) - 1) * limit;

    return db.query.offersSchema.findMany({
      where: whereClause,
      orderBy: [desc(offersSchema.created_at)],
      limit,
      offset,
      with: {
        user: true,
      },
    });
  }

  public async update(id: number, data: Partial<NewOffer>) {
    return db.update(offersSchema).set(data).where(eq(offersSchema.id, id));
  }

  public async toggleStatus(id: number, status: 'active' | 'inactive' | 'paused') {
    return db.update(offersSchema).set({ status }).where(eq(offersSchema.id, id));
  }

  public async toggleActive(id: number, active: boolean) {
    return db.update(offersSchema).set({ active }).where(eq(offersSchema.id, id));
  }

  public async toggleAllForUser(userId: number, status: 'active' | 'inactive' | 'paused') {
    return db.update(offersSchema).set({ status }).where(eq(offersSchema.user_id, userId));
  }

  public async delete(id: number) {
    return db.delete(offersSchema).where(eq(offersSchema.id, id));
  }

  public async deleteByUserId(userId: number) {
    return db.delete(offersSchema).where(eq(offersSchema.user_id, userId));
  }

  public async getCount(userId?: number) {
    const whereClause = userId ? eq(offersSchema.user_id, userId) : undefined;

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(offersSchema)
      .where(whereClause);

    return result[0]?.count || 0;
  }

  public async getActiveCount() {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(offersSchema)
      .where(and(eq(offersSchema.status, 'active'), eq(offersSchema.active, true)));

    return result[0]?.count || 0;
  }
}
