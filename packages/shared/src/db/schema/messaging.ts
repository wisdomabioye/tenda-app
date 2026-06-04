/**
 * Carry-forward messaging + comms tables (stage-0-foundation.md § Database:
 * "conversations, messages, device_tokens, subscriptions, announcements:
 * carry forward unchanged from current schema (drop chain-specific FKs
 * where any)").
 *
 * Copied from the legacy schema at Stage 0 cutover (#34) with two
 * deliberate deltas:
 *   - `messages.gig_id` / `messages.offer_id` collapse into a single
 *     `escrow_id` — gigs and exchanges are both escrows in v2, and the
 *     chat context divider only needs one reference.
 *   - timestamps follow the v2 convention (no timezone flag), matching
 *     every other table in this schema, and `updated_at` columns gain the
 *     v2 `$onUpdate` auto-bump.
 *
 * NOTE: after editing run `pnpm --filter @tenda/shared build` and
 * `pnpm db:generate` (migrations are generated, never hand-written).
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { escrows } from './escrow'
import { users } from './identity'

export const conversationStatusEnum = pgEnum('conversation_status', ['active', 'closed'])

/** Expo today; fcm/apns delivery added in Stage 5 (S5.1). */
export const devicePlatformEnum = pgEnum('device_platform', ['expo', 'fcm', 'apns'])

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Canonical order: user_a_id < user_b_id (enforced in application layer)
    user_a_id: uuid('user_a_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    user_b_id: uuid('user_b_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: conversationStatusEnum('status').notNull().default('active'),
    closed_by: uuid('closed_by').references(() => users.id),
    closed_at: timestamp('closed_at'),
    last_message_at: timestamp('last_message_at'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('conversations_user_pair_unique').on(t.user_a_id, t.user_b_id),
    index('conversations_user_a_idx').on(t.user_a_id),
    index('conversations_user_b_idx').on(t.user_b_id),
    // S5.7 (closes open 86): inbox ordering — list a user's conversations
    // newest-message-first without a sort node.
    index('conversations_user_a_last_msg_idx').on(t.user_a_id, t.last_message_at.desc()),
    index('conversations_user_b_last_msg_idx').on(t.user_b_id, t.last_message_at.desc()),
  ],
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversation_id: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    sender_id: uuid('sender_id')
      .notNull()
      .references(() => users.id),
    // Chat context divider: "discussing escrow X" (gig or exchange alike).
    escrow_id: uuid('escrow_id').references(() => escrows.id, { onDelete: 'set null' }),
    content: varchar('content', { length: 2000 }).notNull(),
    // S5.2 (closes open #85): optional chat attachment. URL must live under
    // the conversation-scoped Cloudinary folder (validated at send).
    attachment_url: text('attachment_url'),
    attachment_type: text('attachment_type', { enum: ['image', 'file'] }),
    attachment_size: integer('attachment_size'),
    read_at: timestamp('read_at'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    // Composite index covers the paginated history query:
    // WHERE conversation_id = X ORDER BY created_at DESC [LIMIT n]
    index('messages_conversation_created_at_idx').on(t.conversation_id, t.created_at),
    index('messages_sender_id_idx').on(t.sender_id),
    // Partial index for unread-count queries and mark-as-read UPDATE
    index('messages_unread_idx')
      .on(t.conversation_id, t.sender_id)
      .where(sql`${t.read_at} IS NULL`),
  ],
)

export const device_tokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    platform: devicePlatformEnum('platform').notNull().default('expo'),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('device_tokens_token_unique').on(t.token),
    index('device_tokens_user_id_idx').on(t.user_id),
  ],
)

export const gig_subscriptions = pgTable(
  'gig_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // '*' means any city/category (sentinel instead of NULL to enable UNIQUE constraint)
    city: text('city').notNull().default('*'),
    category: text('category').notNull().default('*'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('gig_subscriptions_unique').on(t.user_id, t.city, t.category),
    index('gig_subscriptions_user_id_idx').on(t.user_id),
    // Covers the fan-out query: WHERE city IN (data.city, '*') — filters by city first,
    // then category, avoiding a full-table scan as subscriber count grows.
    index('gig_subscriptions_city_category_idx').on(t.city, t.category),
  ],
)

export const announcements = pgTable(
  'announcements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 200 }).notNull(),
    body: varchar('body', { length: 2000 }).notNull(),
    // priority: higher = shown first. 0 = normal, 1 = important, 2 = urgent.
    priority: integer('priority').notNull().default(0),
    is_active: boolean('is_active').notNull().default(true),
    // published_at: set when first made active (set once, never cleared).
    published_at: timestamp('published_at'),
    // expires_at: null = never expires.
    expires_at: timestamp('expires_at'),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Public feed query: WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY priority DESC
    index('announcements_active_priority_idx').on(t.is_active, t.priority),
    index('announcements_expires_at_idx').on(t.expires_at),
  ],
)
