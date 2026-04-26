import { SUPPORTED_CURRENCIES } from '@/data/currencies'
import type { FaqCategory } from '../types'

export const COVERAGE_CATEGORY: FaqCategory = {
  num: '05',
  slug: 'coverage',
  title: 'Coverage & access',
  caption: '1 question',
  questions: [
    {
      id: 'Q.15',
      question: 'Why Solana, and which countries can use Tenda?',
      answer: (
        <>
          <p>
            Solana keeps the contract math simple: ~400 ms blocks, fees so small they don&apos;t
            distort the platform fee, and a mature mobile-wallet story (Mobile Wallet Adapter)
            that let us ship a real on-chain experience inside a regular Android app.
          </p>
          <p>
            On the geographic side, Tenda is global by default — the contract runs wherever
            Solana does. Local-fiat exchange is currently live across{' '}
            {SUPPORTED_CURRENCIES.length} corridors:{' '}
            <code className="font-mono">{SUPPORTED_CURRENCIES.join(' · ')}</code>. New corridors
            unlock as we add fiat partners and as buyers and sellers meet there.
          </p>
        </>
      ),
    },
  ],
}
