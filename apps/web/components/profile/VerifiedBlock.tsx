'use client'

/**
 * "Verified" (comp) — what this account has actually proved.
 *
 * Only rows the server has marked verified appear. An identity that is merely
 * ATTACHED is not a verification, and listing it under this heading would
 * turn an unproven address into a trust signal: `IdentityMethodWire.verified`
 * is the one field that decides, and wallets earn their row from
 * `verified_at`, not from being linked.
 *
 * Nothing verified renders nothing at all, rather than an empty panel headed
 * "Verified" — which reads as a claim about a user who has made none.
 */
import { BadgeCheck, Mail, Wallet } from 'lucide-react'
import type { IdentityMethodWire, LinkedWallet } from '@tenda/shared'

export interface VerifiedRow {
  key: string
  label: string
  value: string
}

/** Verified identities first, then wallets — pure, so the rules are testable. */
export function buildVerifiedRows(
  identities: readonly IdentityMethodWire[],
  wallets: readonly LinkedWallet[],
): VerifiedRow[] {
  const rows: VerifiedRow[] = identities
    .filter((i) => i.verified)
    .map((i) => ({
      key: `identity:${i.kind}:${i.identifier}`,
      label: i.kind === 'email' ? 'Email' : i.kind,
      // The address when the credential carries one; an OAuth `sub` is an
      // opaque id and says nothing useful to the person reading it.
      value: i.email ?? 'Verified',
    }))

  const verifiedWallets = wallets.filter((w) => w.verified_at !== null)
  if (verifiedWallets.length > 0) {
    rows.push({
      key: 'wallets',
      label: 'Wallet',
      value:
        verifiedWallets.length === 1
          ? '1 verified'
          : `${verifiedWallets.length} verified`,
    })
  }
  return rows
}

export function VerifiedBlock({
  identities,
  wallets,
}: {
  identities: readonly IdentityMethodWire[]
  wallets: readonly LinkedWallet[]
}) {
  const rows = buildVerifiedRows(identities, wallets)
  if (rows.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 font-numeric text-xs font-medium uppercase leading-4 tracking-[0.13em] text-content-tertiary">
        Verified
      </h2>
      <dl className="rounded-card border border-border-default bg-surface-card px-4 py-1">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center gap-3 border-b border-border-subtle py-2.5 last:border-b-0"
          >
            {row.label === 'Wallet' ? (
              <Wallet size={15} aria-hidden className="shrink-0 text-content-tertiary" />
            ) : (
              <Mail size={15} aria-hidden className="shrink-0 text-content-tertiary" />
            )}
            <dt className="text-sm capitalize text-content-secondary">{row.label}</dt>
            <dd className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-content-primary">
              {row.value}
              <BadgeCheck size={15} aria-hidden className="text-feedback-success-base" />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
