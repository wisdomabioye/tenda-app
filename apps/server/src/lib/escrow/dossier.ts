/**
 * Builds the admin escrow dossier — the full mediation context behind a
 * dispute. Pure data assembly (no HTTP), so it is unit-testable and reused
 * by GET /v1/admin/escrows/:id/dossier.
 *
 * Party vocabulary is structural creator|counterparty (the same words the
 * `winner` enum uses). The counterparty is the ACCEPTED worker/taker
 * (escrows.counterparty_id); if the escrow was pre-assigned but never
 * accepted we fall back to assigned_counterparty_id so the dossier still
 * names the intended party. A party is omitted only when neither id exists.
 */
import { and, asc, eq, inArray } from 'drizzle-orm'
import {
  escrows,
  gig_details,
  exchange_details,
  escrow_proofs,
  escrow_transactions,
  disputes,
  users,
} from '@tenda/shared/db/schema'
import type {
  AdminEscrowDossier,
  DossierParty,
  DossierGigDetails,
  DossierExchangeDetails,
} from '@tenda/shared'
import type { AppDatabase } from '@server/plugins/db'

const iso = (d: Date): string => d.toISOString()

export async function buildEscrowDossier(
  db: AppDatabase,
  escrow_id: string,
): Promise<AdminEscrowDossier | null> {
  const [escrow] = await db.select().from(escrows).where(eq(escrows.id, escrow_id)).limit(1)
  if (escrow === undefined) return null

  // The accepted counterparty is authoritative; the pre-assignment is a
  // fallback so an unaccepted-but-assigned escrow still names the party.
  const counterpartyId = escrow.counterparty_id ?? escrow.assigned_counterparty_id
  const partyIds = [escrow.creator_id, counterpartyId].filter(
    (id): id is string => id !== null,
  )

  const [dispute, partyUsers, gigRow, exchangeRow, proofRows, txRows] = await Promise.all([
    db
      .select({ raised_by: disputes.raised_by })
      .from(disputes)
      .where(eq(disputes.escrow_id, escrow.id))
      .limit(1),
    db
      .select({
        id: users.id,
        first_name: users.first_name,
        last_name: users.last_name,
      })
      .from(users)
      .where(inArray(users.id, partyIds)),
    db.select().from(gig_details).where(eq(gig_details.escrow_id, escrow.id)).limit(1),
    db.select().from(exchange_details).where(eq(exchange_details.escrow_id, escrow.id)).limit(1),
    db
      .select()
      .from(escrow_proofs)
      .where(eq(escrow_proofs.escrow_id, escrow.id))
      .orderBy(asc(escrow_proofs.uploaded_at)),
    db
      .select()
      .from(escrow_transactions)
      .where(and(eq(escrow_transactions.escrow_id, escrow.id)))
      .orderBy(asc(escrow_transactions.created_at)),
  ])

  const raisedBy = dispute[0]?.raised_by ?? null
  const nameOf = (id: string) => partyUsers.find((u) => u.id === id) ?? null

  const parties: DossierParty[] = []
  const creator = nameOf(escrow.creator_id)
  parties.push({
    role: 'creator',
    user_id: escrow.creator_id,
    first_name: creator?.first_name ?? null,
    last_name: creator?.last_name ?? null,
    raised_dispute: raisedBy === escrow.creator_id,
  })
  if (counterpartyId !== null) {
    const cp = nameOf(counterpartyId)
    parties.push({
      role: 'counterparty',
      user_id: counterpartyId,
      first_name: cp?.first_name ?? null,
      last_name: cp?.last_name ?? null,
      raised_dispute: raisedBy === counterpartyId,
    })
  }

  const gig: DossierGigDetails | null =
    gigRow[0] === undefined
      ? null
      : {
          title: gigRow[0].title,
          description: gigRow[0].description,
          category: gigRow[0].category,
          country: gigRow[0].country,
          city: gigRow[0].city,
          remote: gigRow[0].remote,
        }

  const exchange: DossierExchangeDetails | null =
    exchangeRow[0] === undefined
      ? null
      : {
          fiat_amount: exchangeRow[0].fiat_amount,
          fiat_currency: exchangeRow[0].fiat_currency,
          rate: exchangeRow[0].rate,
          payment_window_seconds: exchangeRow[0].payment_window_seconds,
          payment_proof_url: exchangeRow[0].payment_proof_url,
        }

  return {
    escrow_id: escrow.id,
    kind: escrow.kind,
    status: escrow.status,
    chain_id: escrow.chain_id,
    asset: escrow.asset,
    amount_raw: escrow.amount_raw,
    dispute_bond_raw: escrow.dispute_bond_raw,
    created_at: iso(escrow.created_at),
    parties,
    gig,
    exchange,
    proofs: proofRows.map((p) => ({
      id: p.id,
      url: p.url,
      type: p.type,
      uploaded_at: iso(p.uploaded_at),
    })),
    transactions: txRows.map((t) => ({
      id: t.id,
      type: t.type,
      tx_ref: t.tx_ref,
      amount_raw: t.amount_raw,
      platform_fee_raw: t.platform_fee_raw,
      actor_id: t.actor_id,
      created_at: iso(t.created_at),
    })),
  }
}
