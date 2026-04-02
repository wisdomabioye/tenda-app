'use client'

import { useState } from 'react'
import { AppHeader } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { FeesView } from '@/components/finance/fees-view'
import { TxView } from '@/components/finance/tx-view'

type Tab = 'fees' | 'gig_tx' | 'exchange_tx'

const TABS: { id: Tab; label: string }[] = [
  { id: 'fees',        label: 'Fee summary' },
  { id: 'gig_tx',     label: 'Gig transactions' },
  { id: 'exchange_tx', label: 'Exchange transactions' },
]

export default function FinancePage() {
  const [tab,  setTab]  = useState<Tab>('fees')
  const [from, setFrom] = useState('')
  const [to,   setTo]   = useState('')

  return (
    <>
      <AppHeader title="Finance" />

      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          {TABS.map((t) => (
            <Button
              key={t.id}
              variant={tab === t.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {tab === 'fees'        && <FeesView from={from} to={to} onFromChange={setFrom} onToChange={setTo} />}
        {tab === 'gig_tx'     && <TxView ledgerType="gig"      from={from} to={to} />}
        {tab === 'exchange_tx' && <TxView ledgerType="exchange" from={from} to={to} />}
      </main>
    </>
  )
}
