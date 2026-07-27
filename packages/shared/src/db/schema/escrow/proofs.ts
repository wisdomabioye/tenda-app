/** Proof satellite: what a worker attached to satisfy the gig's requirements. */

import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { escrows } from './escrows'
import { proofTypeEnum } from './enums'

export const escrow_proofs = pgTable(
  'escrow_proofs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    escrow_id: uuid('escrow_id')
      .notNull()
      .references(() => escrows.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    type: proofTypeEnum('type').notNull(),
    uploaded_at: timestamp('uploaded_at').notNull().defaultNow(),
  },
  (t) => [index('escrow_proofs_escrow_idx').on(t.escrow_id)],
)
