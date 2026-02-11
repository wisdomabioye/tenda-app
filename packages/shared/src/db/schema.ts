import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  json,
  pgEnum,
} from 'drizzle-orm/pg-core'

export const gigStatusEnum = pgEnum('gig_status', [
  'draft',
  'open',
  'accepted',
  'submitted',
  'completed',
  'disputed',
  'cancelled',
])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  wallet_address: text('wallet_address').unique().notNull(),
  first_name: text('first_name'),
  last_name: text('last_name'),
  avatar_url: text('avatar_url'),
  city: text('city').default('Lagos'),
  reputation_score: integer('reputation_score').default(0),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const gigs = pgTable('gigs', {
  id: uuid('id').primaryKey().defaultRandom(),
  poster_id: uuid('poster_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  worker_id: uuid('worker_id').references(() => users.id),
  title: varchar('title', { length: 200 }).notNull(),
  description: varchar('description', { length: 5000 }).notNull(),
  payment: integer('payment').notNull(),
  category: text('category').notNull(),
  status: gigStatusEnum('status').default('draft').notNull(),
  city: text('city').notNull(),
  address: text('address'),
  deadline: timestamp('deadline', { withTimezone: true }).notNull(),
  proof_urls: json('proof_urls').$type<string[]>().default([]),
  dispute_reason: varchar('dispute_reason', { length: 2000 }),
  escrow_address: text('escrow_address'),
  transaction_signature: text('transaction_signature'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
