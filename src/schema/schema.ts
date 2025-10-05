import { relations } from 'drizzle-orm';
import {
  boolean,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

export const userSchema = mysqlTable('user', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  phone: varchar('phone', { length: 100 }).notNull().default(''),
  dial_code: varchar('dial_code', { length: 10 }).notNull().default(''),
  password: varchar('password', { length: 255 }).notNull(),
  reset_token: varchar('reset_token', { length: 255 }),
  email_token: varchar('email_token', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  role: mysqlEnum('role', ['user', 'role', 'admin']).default('user'),
  profile_picture: text('profile_picture'),
  bio: varchar('bio', { length: 255 }),
  username: varchar('username', { length: 255 }),
  is_verified: boolean('is_verified').default(false),
  health: mysqlEnum('health', ['active', 'banned', 'on_hold', 'suspended', 'blocked']).default(
    'active',
  ),
  is_deleted: boolean('is_deleted').default(false),
  google_id: varchar('google_id', { length: 255 }),
  balance: decimal('balance', { precision: 20, scale: 8 }).default('0.00000000'),
  google_access_token: varchar('google_access_token', { length: 255 }),
  auth_provider: mysqlEnum('auth_provider', ['local', 'google']).default('local'),
});

export const notificationsSchema = mysqlTable('notifications', {
  id: serial('id').primaryKey(),
  user_id: int('user_id')
    .references(() => userSchema.id)
    .notNull(),
  notification_type: mysqlEnum('notification_type', [
    'comment',
    'like',
    'system',
    'new_lead',
    'new_booking',
    'new_payment',
    'reminder',
  ]).notNull(),
  is_read: boolean('is_read').default(false),
  title: varchar('title', { length: 255 }),
  message: text('message'),
  link: text('link'),
  metadata: json('metadata'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const emailsSchema = mysqlTable('emails', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  subtitle: varchar('subtitle', { length: 255 }).notNull(),
  body: text('body').notNull(),
  button_text: varchar('button_text', { length: 255 }).notNull(),
  button_link: varchar('button_link', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
  checked: boolean('checked').default(false),
  starred: boolean('starred').default(false),
  flagged: boolean('flagged').default(false),
  user_id: int('user_id')
    .references(() => userSchema.id)
    .notNull(),
  status: mysqlEnum('status', ['draft', 'sent', 'failed']).default('draft'),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const bitcoinAddressSchema = mysqlTable('bitcoin_addresses', {
  id: serial('id').primaryKey(),
  user_id: int('user_id').references(() => userSchema.id),
  address: varchar('address', { length: 255 }).notNull().unique(),
  wallet_id: varchar('wallet_id', { length: 255 }).notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  chain: int('chain').notNull(),
  index: int('index').notNull(),
  address_type: varchar('address_type', { length: 50 }),
  created_at: timestamp('created_at').defaultNow(),
  metadata: json('metadata'),
});

export const countriesSchema = mysqlTable('countries', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  iso: varchar('iso', { length: 2 }).notNull().unique(),
  iso3: varchar('iso3', { length: 3 }).notNull().unique(),
  dial: varchar('dial', { length: 5 }).notNull(),
  currency: varchar('currency', { length: 3 }),
  currency_name: varchar('currency_name', { length: 100 }),
  reason: varchar('reason', { length: 255 }),
  active: boolean('active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const methodsSchema = mysqlTable('methods', {
  id: serial('id').primaryKey(),
  method_name: varchar('method_name', { length: 255 }).notNull(),
  active: boolean('active').default(true),
});

export const offersSchema = mysqlTable('offers', {
  id: serial('id').primaryKey(),
  user_id: int('user_id')
    .references(() => userSchema.id)
    .notNull(),
  type: mysqlEnum('type', ['buy', 'sell']).notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  terms: text('terms').notNull(),
  instructions: text('instructions').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  minimum: decimal('minimum', { precision: 20, scale: 2 }).notNull().default('0.00'),
  maximum: decimal('maximum', { precision: 20, scale: 2 }).notNull().default('0.00'),
  method_id: int('method_id')
    .references(() => methodsSchema.id)
    .notNull(),
  margin: decimal('margin', { precision: 20, scale: 2 }).notNull(),
  status: mysqlEnum('status', ['active', 'inactive', 'paused']).default('active'),
  active: boolean('active').default(true),
  deauth: boolean('deauth').default(false),
  id_verification: boolean('id_verification').default(false),
  full_name_required: boolean('full_name_required').default(false),
  minimum_trades: int('minimum_trades').default(0),
  new_trader_limit: boolean('new_trader_limit').default(false),
  vpn_blocked: boolean('vpn_blocked').default(false),
  limit_countries: mysqlEnum('limit_countries', ['none', 'blocked', 'allowed']).default('none'),
  blocked_countries: json('blocked_countries'),
  allowed_countries: json('allowed_countries'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const tradesSchema = mysqlTable('trades', {
  id: serial('id').primaryKey(),
  request_id: text('request_id'),
  flag_expired: varchar('flag_expired', { length: 255 }).default('NOT_EXPIRED'),
  fiat_amount_original: decimal('fiat_amount_original', { precision: 20, scale: 2 })
    .notNull()
    .default('0.00'),
  fiat_amount_with_margin: decimal('fiat_amount_with_margin', { precision: 20, scale: 2 })
    .notNull()
    .default('0.00'),
  btc_amount_with_margin: decimal('btc_amount_with_margin', { precision: 20, scale: 8 })
    .notNull()
    .default('0.00000000'),
  btc_amount_original: decimal('btc_amount_original', { precision: 20, scale: 8 })
    .notNull()
    .default('0.00000000'),
  price: decimal('price', { precision: 20, scale: 2 }).default('0.00'),
  buyer: int('buyer')
    .references(() => userSchema.id)
    .notNull(),
  seller: int('seller')
    .references(() => userSchema.id)
    .notNull(),
  status: mysqlEnum('status', [
    'OPENED',
    'PAID',
    'SUCCESSFUL',
    'CANCELLED_BUYER',
    'CANCELLED_SELLER',
    'CANCELLED_SYSTEM',
    'AWARDED_BUYER',
    'AWARDED_SELLER',
    'DISPUTED',
  ]).default('OPENED'),
  moderator_flag: varchar('moderator_flag', { length: 255 }).default('NA'),
  offer_id: int('offer_id')
    .references(() => offersSchema.id)
    .notNull(),
  cancelled: varchar('cancelled', { length: 100 }).default('NA'),
  dispute_started: boolean('dispute_started').default(false),
  dispute_time: timestamp('dispute_time'),
  dispute_time_resolve: timestamp('dispute_time_resolve'),
  dispute_reason: varchar('dispute_reason', { length: 255 }),
  dispute_explanation: varchar('dispute_explanation', { length: 255 }),
  dispute_started_by: varchar('dispute_started_by', { length: 50 }),
  dispute_mod_notes: varchar('dispute_mod_notes', { length: 255 }),
  escrow_return: boolean('escrow_return').default(false),
  expiry_time: timestamp('expiry_time'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const bitgoTxSchema = mysqlTable('bitgo_tx', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 255 }).notNull(),
  wallet: varchar('wallet', { length: 255 }).notNull(),
  coin: varchar('coin', { length: 255 }).notNull(),
  transfer: varchar('transfer', { length: 255 }).notNull(),
  hash: varchar('hash', { length: 255 }).notNull(),
  amount: decimal('amount', { precision: 20, scale: 8 }).notNull(),
  state: varchar('state', { length: 255 }).notNull(),
  ip: varchar('ip', { length: 255 }).notNull(),
  paid: boolean('paid').default(false),
  usd: decimal('usd', { precision: 20, scale: 2 }).notNull(),
  usdrate: decimal('usdrate', { precision: 20, scale: 8 }).notNull(),
  height: varchar('height', { length: 255 }).notNull(),
  email: int('email')
    .references(() => userSchema.email)
    .notNull(),
  user_id: int('user_id')
    .references(() => userSchema.id)
    .notNull(),
  confirmations: varchar('confirmations', { length: 255 }).notNull(),
  satoshi: decimal('satoshi', { precision: 20, scale: 8 }).notNull(),
  reason: varchar('reason', { length: 255 }).notNull(),
  tx: text('tx'),
  status: varchar('status', { length: 255 }),
  feeString: varchar('feeString', { length: 255 }),
  payGoFee: varchar('payGoFee', { length: 255 }),
  total_fee: decimal('total_fee', { precision: 20, scale: 8 }).default('0.00000000'),
  coinpes_fee: decimal('coinpes_fee', { precision: 20, scale: 8 }).default('0.00000000'),
  request_id: varchar('request_id', { length: 255 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const internalSchema = mysqlTable('internal', {
  id: serial('id').primaryKey(),
  amount_btc: decimal('amount_btc', { precision: 20, scale: 8 }).notNull().default('0.00000000'),
  fiat: decimal('fiat', { precision: 20, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  sender: int('sender')
    .references(() => userSchema.id)
    .notNull(),
  recepient: int('recepient')
    .references(() => userSchema.id)
    .notNull(),
  request_id: varchar('request_id', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const feedbackSchema = mysqlTable('feedback', {
  id: serial('id').primaryKey(),
  request_id: varchar('request_id', { length: 255 }).notNull(),
  trade_id: int('trade_id')
    .references(() => tradesSchema.id)
    .notNull(),
  comment: text('comment').default('No comment yet'),
  flag: text('flag').default('N/A'),
  user_id: int('user_id')
    .references(() => userSchema.id)
    .notNull(),
  target: int('target')
    .references(() => userSchema.id)
    .notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  method: varchar('method', { length: 50 }).notNull(),
  photo_url: varchar('photo_url', { length: 255 }).default('https://api.coinpes.com/avatar.webp'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const offerCountryRestrictionsSchema = mysqlTable('offer_country_restrictions', {
  id: serial('id').primaryKey(),
  offer_id: int('offer_id')
    .references(() => offersSchema.id)
    .notNull(),
  country_iso: varchar('country_iso', { length: 2 }).notNull(),
  restriction_type: mysqlEnum('restriction_type', ['allowed', 'blocked']).notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

export const wordsSchema = mysqlTable('words', {
  id: serial('id').primaryKey(),
  word: varchar('word', { length: 255 }).notNull(),
});

export type Email = typeof emailsSchema.$inferSelect;
export type Notification = typeof notificationsSchema.$inferSelect;
export type NewNotification = typeof notificationsSchema.$inferInsert;
export type NewEmail = typeof emailsSchema.$inferInsert;
export type User = typeof userSchema.$inferSelect;
export type BitcoinAddress = typeof bitcoinAddressSchema.$inferSelect;
export type NewUser = typeof userSchema.$inferInsert;
export type NewBitcoinAddress = typeof bitcoinAddressSchema.$inferInsert;

// New schema types
export type Country = typeof countriesSchema.$inferSelect;
export type NewCountry = typeof countriesSchema.$inferInsert;
export type Method = typeof methodsSchema.$inferSelect;
export type NewMethod = typeof methodsSchema.$inferInsert;
export type Offer = typeof offersSchema.$inferSelect;
export type NewOffer = typeof offersSchema.$inferInsert;
export type Trade = typeof tradesSchema.$inferSelect;
export type NewTrade = typeof tradesSchema.$inferInsert;
export type BitgoTx = typeof bitgoTxSchema.$inferSelect;
export type NewBitgoTx = typeof bitgoTxSchema.$inferInsert;
export type Internal = typeof internalSchema.$inferSelect;
export type NewInternal = typeof internalSchema.$inferInsert;
export type Feedback = typeof feedbackSchema.$inferSelect;
export type NewFeedback = typeof feedbackSchema.$inferInsert;
export type OfferCountryRestriction = typeof offerCountryRestrictionsSchema.$inferSelect;
export type NewOfferCountryRestriction = typeof offerCountryRestrictionsSchema.$inferInsert;
export type Word = typeof wordsSchema.$inferSelect;
export type NewWord = typeof wordsSchema.$inferInsert;

// Define relations

export const notificationRelations = relations(notificationsSchema, ({ one }) => ({
  user: one(userSchema, {
    fields: [notificationsSchema.user_id],
    references: [userSchema.id],
  }),
}));

export const mailRelations = relations(emailsSchema, ({ one }) => ({
  user: one(userSchema, {
    fields: [emailsSchema.user_id],
    references: [userSchema.id],
  }),
}));

export const bitcoinAddressRelations = relations(bitcoinAddressSchema, ({ one }) => ({
  user: one(userSchema, {
    fields: [bitcoinAddressSchema.user_id],
    references: [userSchema.id],
  }),
}));

export const offerRelations = relations(offersSchema, ({ one }) => ({
  user: one(userSchema, {
    fields: [offersSchema.user_id],
    references: [userSchema.id],
  }),
  method: one(methodsSchema, {
    fields: [offersSchema.method_id],
    references: [methodsSchema.id],
  }),
}));

export const tradeRelations = relations(tradesSchema, ({ one }) => ({
  offer: one(offersSchema, {
    fields: [tradesSchema.offer_id],
    references: [offersSchema.id],
  }),
  buyer: one(userSchema, {
    fields: [tradesSchema.buyer],
    references: [userSchema.id],
  }),
  seller: one(userSchema, {
    fields: [tradesSchema.seller],
    references: [userSchema.id],
  }),
}));

export const bitgoTxRelations = relations(bitgoTxSchema, ({ one }) => ({
  user: one(userSchema, {
    fields: [bitgoTxSchema.user_id],
    references: [userSchema.id],
  }),
  email: one(userSchema, {
    fields: [bitgoTxSchema.email],
    references: [userSchema.email],
  }),
}));

export const internalRelations = relations(internalSchema, ({ one }) => ({
  sender: one(userSchema, {
    fields: [internalSchema.sender],
    references: [userSchema.id],
  }),
  recipient: one(userSchema, {
    fields: [internalSchema.recepient],
    references: [userSchema.id],
  }),
}));

export const feedbackRelations = relations(feedbackSchema, ({ one }) => ({
  user: one(userSchema, {
    fields: [feedbackSchema.user_id],
    references: [userSchema.id],
  }),
  target: one(userSchema, {
    fields: [feedbackSchema.target],
    references: [userSchema.id],
  }),
}));

export const offerCountryRestrictionsRelations = relations(
  offerCountryRestrictionsSchema,
  ({ one }) => ({
    offer: one(offersSchema, {
      fields: [offerCountryRestrictionsSchema.offer_id],
      references: [offersSchema.id],
    }),
    country: one(countriesSchema, {
      fields: [offerCountryRestrictionsSchema.country_iso],
      references: [countriesSchema.iso],
    }),
  }),
);

export const wordsRelations = relations(wordsSchema, ({ one }) => ({
  word: one(wordsSchema, {
    fields: [wordsSchema.id],
    references: [wordsSchema.id],
  }),
}));
