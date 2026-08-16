'use client'

/**
 * Payout accounts — web port of mobile's bank-accounts settings over the
 * SHARED payout registry (NG/KE/GH country specs, per-rail fields and
 * validation — never re-encoded here). Add renders the spec's fields;
 * delete confirms through ConfirmDialog.
 */
import { useEffect, useState } from 'react'
import { Landmark, Smartphone, Trash2 } from 'lucide-react'
import {
  PAYOUT_COUNTRY_SPECS,
  SUPPORTED_PAYOUT_COUNTRIES,
  getPayoutSpec,
  type BankAccountSummary,
  type PayoutAccountInput,
  type PayoutRailSpec,
} from '@tenda/shared'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { ConfirmDialog } from '@/components/ui/overlay/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { showToast } from '@/components/ui/Toast'

const EMPTY_INPUT: PayoutAccountInput = { bank_code: '', account_number: '', account_name: '' }

function AccountForm({ onCreated }: { onCreated: (row: BankAccountSummary) => void }) {
  const [country, setCountry] = useState<string>(SUPPORTED_PAYOUT_COUNTRIES[0])
  const spec = getPayoutSpec(country)
  const [railKind, setRailKind] = useState<string | null>(null)
  const rail: PayoutRailSpec | null =
    spec === null ? null : (spec.rails.find((r) => r.kind === railKind) ?? spec.rails[0])
  const [input, setInput] = useState<PayoutAccountInput>(EMPTY_INPUT)
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (rail === null) return
    const invalid = rail.validate(input)
    if (invalid !== null) {
      showToast('error', invalid)
      return
    }
    setSaving(true)
    try {
      const row = await api.fiat.createBankAccount({
        country,
        kind: rail.kind,
        bank_code: input.bank_code,
        account_number: input.account_number,
        account_name: input.account_name,
      })
      setInput(EMPTY_INPUT)
      onCreated(row)
      showToast('success', 'Payout account added')
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Could not add the account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-card p-4">
      <h2 className="text-sm font-semibold text-content-primary">Add an account</h2>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Country">
        {SUPPORTED_PAYOUT_COUNTRIES.map((code) => (
          <Chip
            key={code}
            label={`${PAYOUT_COUNTRY_SPECS[code].flag} ${PAYOUT_COUNTRY_SPECS[code].countryName}`}
            selected={country === code}
            onClick={() => {
              setCountry(code)
              setRailKind(null)
              setInput(EMPTY_INPUT)
            }}
          />
        ))}
      </div>

      {spec !== null && spec.rails.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Payout rail">
          {spec.rails.map((r) => (
            <Chip
              key={r.kind}
              label={r.label}
              selected={rail?.kind === r.kind}
              onClick={() => {
                setRailKind(r.kind)
                setInput(EMPTY_INPUT)
              }}
            />
          ))}
        </div>
      )}

      {rail?.fields.map((field) => (
        <label key={field.column} className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-content-primary">{field.label}</span>
          {field.options !== undefined ? (
            <select
              value={input[field.column]}
              onChange={(e) => setInput((prev) => ({ ...prev, [field.column]: e.target.value }))}
              className="rounded-control border border-border-default bg-surface-card p-2.5 text-content-primary outline-none focus:border-brand-primary"
            >
              <option value="">{field.placeholder}</option>
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={input[field.column]}
              onChange={(e) => setInput((prev) => ({ ...prev, [field.column]: e.target.value }))}
              inputMode={field.keyboard === 'numeric' ? 'numeric' : 'text'}
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              className="rounded-control border border-border-default bg-surface-card p-2.5 text-content-primary outline-none focus:border-brand-primary"
            />
          )}
        </label>
      ))}

      <Button disabled={saving} onClick={() => void handleAdd()}>
        {saving ? 'Adding…' : 'Add account'}
      </Button>
    </section>
  )
}

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccountSummary[] | null>(null)
  const [deleting, setDeleting] = useState<BankAccountSummary | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.fiat
      .bankAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]))
  }, [])

  async function confirmDelete() {
    if (deleting === null) return
    setBusy(true)
    try {
      await api.fiat.deleteBankAccount({ id: deleting.id })
      setAccounts((prev) => (prev === null ? prev : prev.filter((r) => r.id !== deleting.id)))
      setDeleting(null)
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Could not remove the account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="pt-1 font-display text-2xl font-bold text-content-primary">Payout accounts</h1>

      {accounts === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-content-secondary">
          No payout accounts yet. Buyers pay your fiat into the account you attach to an offer.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface-card px-4 py-3"
            >
              {row.kind === 'mobile_money' ? (
                <Smartphone size={16} className="shrink-0 text-content-secondary" />
              ) : (
                <Landmark size={16} className="shrink-0 text-content-secondary" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-content-primary">
                  {row.account_name}
                  {row.is_default && <span className="ml-2 text-xs text-brand-primary">Default</span>}
                </span>
                <span className="font-numeric text-xs text-content-secondary">
                  {row.country} · {row.bank_code} · {row.account_number_masked}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${row.account_name}`}
                onClick={() => setDeleting(row)}
                className="flex h-9 w-9 items-center justify-center rounded-control text-content-tertiary transition-colors hover:bg-surface-inset hover:text-feedback-danger-base"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AccountForm onCreated={(row) => setAccounts((prev) => [...(prev ?? []), row])} />

      <ConfirmDialog
        open={deleting !== null}
        title="Remove payout account"
        message={deleting !== null ? `Remove ${deleting.account_name} (${deleting.account_number_masked})?` : undefined}
        confirmLabel="Remove"
        destructive
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
