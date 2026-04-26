import type { FaqCategory } from '../types'

export const CRYPTO_CATEGORY: FaqCategory = {
  num: '04',
  slug: 'crypto',
  title: 'Crypto basics',
  caption: '2 questions',
  questions: [
    {
      id: 'Q.13',
      question: 'Do I need to know anything about crypto to use Tenda?',
      answer: (
        <>
          <p>
            No more than you&apos;d need to use any mobile app. You install the app, connect a
            Solana wallet (Tenda guides you through this on first launch), and that&apos;s it.
            The wallet is yours — Tenda never holds your keys.
          </p>
          <p>
            For posters: the app handles converting your fiat estimate into a SOL amount at the
            current rate when you publish. For workers: payouts arrive as SOL; you can keep them,
            self-custody, or convert via Exchange to local fiat.
          </p>
        </>
      ),
    },
    {
      id: 'Q.14',
      question: 'What if I lose my phone?',
      answer: (
        <>
          <p>
            Your wallet&apos;s recovery phrase is the answer — same as any non-custodial wallet.
            Install the wallet on a new device, restore from your seed phrase, reopen Tenda, and
            you&apos;re back to where you were. Active gigs / open offers don&apos;t care which
            device you connect from.
          </p>
          <p>
            <strong>Important:</strong> Tenda cannot recover your wallet. If you lose both the
            device and the seed phrase, the wallet is gone. Back up your seed phrase the moment
            you create the wallet.
          </p>
        </>
      ),
    },
  ],
}
