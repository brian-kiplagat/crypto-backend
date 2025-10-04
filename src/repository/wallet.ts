import { desc, eq, sql } from 'drizzle-orm';

import { db } from '../lib/database.js';
import type { NewBitcoinAddress } from '../schema/schema.js';
import { bitcoinAddressSchema } from '../schema/schema.js';

export class WalletRepository {
  public async create(address: NewBitcoinAddress) {
    return db.insert(bitcoinAddressSchema).values(address).$returningId();
  }

  public async findById(id: number) {
    return db.query.bitcoinAddressSchema.findFirst({
      where: eq(bitcoinAddressSchema.id, id),
    });
  }

  public async findByUserId(userId: number) {
    return db.query.bitcoinAddressSchema.findMany({
      where: eq(bitcoinAddressSchema.user_id, userId),
      orderBy: [desc(bitcoinAddressSchema.created_at)],
    });
  }

  public async findByAddress(address: string) {
    return db.query.bitcoinAddressSchema.findFirst({
      where: eq(bitcoinAddressSchema.address, address),
    });
  }

  public async findByWalletId(walletId: string) {
    return db.query.bitcoinAddressSchema.findMany({
      where: eq(bitcoinAddressSchema.wallet_id, walletId),
      orderBy: [desc(bitcoinAddressSchema.created_at)],
    });
  }

  public async update(id: number, data: Partial<NewBitcoinAddress>) {
    return db.update(bitcoinAddressSchema).set(data).where(eq(bitcoinAddressSchema.id, id));
  }

  public async delete(id: number) {
    return db.delete(bitcoinAddressSchema).where(eq(bitcoinAddressSchema.id, id));
  }

  public async deleteByUserId(userId: number) {
    return db.delete(bitcoinAddressSchema).where(eq(bitcoinAddressSchema.user_id, userId));
  }

  public async getAddressCount(userId: number) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(bitcoinAddressSchema)
      .where(eq(bitcoinAddressSchema.user_id, userId));

    return result[0]?.count || 0;
  }

  public async getAddressCountByWalletId(walletId: string) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(bitcoinAddressSchema)
      .where(eq(bitcoinAddressSchema.wallet_id, walletId));

    return result[0]?.count || 0;
  }
}
