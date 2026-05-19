import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { chains } from './chains'

// Polling-listener cursor only. Webhook listeners do NOT touch this table —
// dedup is via tx_ref uniqueness + BullMQ idempotency key.
export const chain_cursors = pgTable('chain_cursors', {
  chain_id: text('chain_id')
    .primaryKey()
    .references(() => chains.id),
  last_block: bigint('last_block', { mode: 'number' }).notNull().default(0),
  last_processed_at: timestamp('last_processed_at').notNull().defaultNow(),
})
