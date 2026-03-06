import { APP_INFO } from '../../app-info'

const EFFECTIVE_DATE = 'March 1, 2026'

export function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <h1 className="text-4xl font-black text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-12">Effective: {EFFECTIVE_DATE}</p>

      <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">1. Overview</h2>
          <p>
            {APP_INFO.name} is designed to be as minimal as possible with your personal data.
            Because gig transactions happen on-chain, most activity is public by nature of the
            Solana blockchain. This policy explains what we collect, why, and how.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">2. What We Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Wallet address</strong> — used as your account identifier. Public on-chain.
            </li>
            <li>
              <strong>Profile information</strong> — name, avatar, and bio that you optionally provide.
            </li>
            <li>
              <strong>Gig content</strong> — titles, descriptions, proof files (photos/videos) you upload.
            </li>
            <li>
              <strong>Messages</strong> — in-app conversations between users.
            </li>
            <li>
              <strong>Device push token</strong> — to send you relevant notifications. Stored only while
              you are registered for notifications.
            </li>
            <li>
              <strong>Usage data</strong> — crash reports and performance data via Sentry, to help us fix bugs.
              No personal identifiers are attached beyond your wallet address.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">3. What We Do Not Collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Private keys or seed phrases (never — your wallet is non-custodial)</li>
            <li>Government ID or KYC documents</li>
            <li>Precise location (city is optionally provided by you for gig filtering)</li>
            <li>Financial account information</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">4. How We Use Your Data</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To operate the platform — match workers with gigs, facilitate payments</li>
            <li>To send push notifications for gig activity and messages</li>
            <li>To resolve disputes — admin may review proof files and messages in dispute cases</li>
            <li>To improve the product — anonymised crash and usage analytics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Sharing</h2>
          <p>We do not sell your data. We share data only with:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>Cloudinary</strong> — for proof file storage and delivery</li>
            <li><strong>Expo / FCM / APNs</strong> — for push notification delivery</li>
            <li><strong>Sentry</strong> — for crash reporting</li>
            <li>Law enforcement if required by valid legal process</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">6. On-Chain Data</h2>
          <p>
            Gig escrow transactions are recorded permanently on the Solana blockchain and are
            publicly visible. Tenda has no ability to remove or alter on-chain data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">7. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. If you wish to
            delete your account and associated off-chain data, contact us via the channels below.
            On-chain records cannot be deleted.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">8. Security</h2>
          <p>
            We use industry-standard measures to protect your data. However, no system is
            perfectly secure. You are responsible for keeping your wallet credentials safe.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">9. Changes</h2>
          <p>
            We may update this policy. Material changes will be communicated via the App or
            our social channels. Continued use after changes means you accept the new policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">10. Contact</h2>
          <p>
            For privacy requests or questions, reach us on{' '}
            <a href={APP_INFO.twitterUrl} className="text-blue-500 hover:underline" target="_blank" rel="noreferrer">
              Twitter / X
            </a>{' '}
            or{' '}
            <a href={APP_INFO.whatsappUrl} className="text-blue-500 hover:underline" target="_blank" rel="noreferrer">
              WhatsApp
            </a>.
          </p>
        </section>

      </div>
    </div>
  )
}
