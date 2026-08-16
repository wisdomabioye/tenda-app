'use client'

/**
 * Settings index — web port of mobile's settings tab. Groups: exchange
 * access (the CO4 advanced-mode toggle unlocking the P2P surface),
 * security & accounts, support, build info (web reports NEXT_PUBLIC_*
 * envs — lib/app-version is Expo-specific and has no web analogue).
 */
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeftRight, Banknote, CircleHelp, KeyRound, ShieldCheck, Wallet } from 'lucide-react'
import { APP_INFO } from '@tenda/shared'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'
import { Toggle } from '@/components/ui/Toggle'
import { showToast } from '@/components/ui/Toast'
import { getEnv } from '@/lib/config/env'

const ROW_CLASS =
  'flex items-center gap-3 rounded-card border border-border-subtle bg-surface-card px-4 py-3 text-sm font-semibold text-content-primary transition-colors hover:bg-surface-inset'

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-1 pb-1 pt-4 font-numeric text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">
      {children}
    </p>
  )
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const refreshUser = useAuthStore((s) => s.refreshUser)
  const [savingAdvanced, setSavingAdvanced] = useState(false)

  async function toggleAdvanced(next: boolean) {
    if (savingAdvanced) return
    setSavingAdvanced(true)
    try {
      await api.users.updateMe({ advanced_mode_enabled: next })
      await refreshUser()
      showToast('success', next ? 'P2P exchange unlocked' : 'P2P exchange hidden')
    } catch {
      showToast('error', 'Could not update the setting, please try again')
    } finally {
      setSavingAdvanced(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <h1 className="px-1 pb-2 pt-6 font-display text-2xl font-bold text-content-primary">Settings</h1>

      <SectionLabel>Trading</SectionLabel>
      <div className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface-card px-4 py-3">
        <ArrowLeftRight size={16} className="shrink-0 text-content-secondary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-content-primary">P2P Exchange</p>
          <p className="text-xs text-content-secondary">
            Unlocks the currency-exchange order book and offer creation.
          </p>
        </div>
        <Toggle
          value={user?.advanced_mode_enabled ?? false}
          onChange={(next) => void toggleAdvanced(next)}
          disabled={savingAdvanced}
          label="P2P Exchange"
        />
      </div>

      <SectionLabel>Security &amp; accounts</SectionLabel>
      <nav className="flex flex-col gap-2" aria-label="Security and accounts">
        <Link href="/settings/security" className={ROW_CLASS}>
          <ShieldCheck size={16} /> Sign-in &amp; security
        </Link>
        <Link href="/settings/linked-wallets" className={ROW_CLASS}>
          <Wallet size={16} /> Linked wallets
        </Link>
        <Link href="/settings/bank-accounts" className={ROW_CLASS}>
          <Banknote size={16} /> Payout accounts
        </Link>
        <Link href="/settings/token-approvals" className={ROW_CLASS}>
          <KeyRound size={16} /> Token approvals
        </Link>
      </nav>

      <SectionLabel>Support</SectionLabel>
      <Link href="/support" className={ROW_CLASS}>
        <CircleHelp size={16} /> Help &amp; guide
      </Link>

      <p className="px-1 pt-6 text-center text-xs text-content-tertiary">
        {APP_INFO.name} web · {getEnv()} build
      </p>
    </div>
  )
}
