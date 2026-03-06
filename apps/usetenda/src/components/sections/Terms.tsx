import { APP_INFO } from '../../app-info'

const EFFECTIVE_DATE = 'March 1, 2026'

export function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <h1 className="text-4xl font-black text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-12">Effective: {EFFECTIVE_DATE}</p>

      <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">1. Acceptance</h2>
          <p>
            By downloading or using {APP_INFO.name} ("the App"), you agree to these Terms of Service.
            If you do not agree, do not use the App.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">2. What Tenda Is</h2>
          <p>
            {APP_INFO.name} is a peer-to-peer gig marketplace built on the Solana blockchain.
            We provide the platform and smart contracts that facilitate agreements between posters
            and workers. We are not a party to any gig, nor do we employ or guarantee any user.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">3. Eligibility</h2>
          <p>
            You must be at least 18 years old and legally able to enter binding contracts in your
            jurisdiction to use the App.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">4. Wallets & Funds</h2>
          <p>
            Tenda is non-custodial. Your Solana wallet and private keys are your sole responsibility.
            Funds held in escrow are governed entirely by on-chain smart contracts. Tenda cannot
            reverse, pause, or recover any blockchain transaction.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">5. Platform Fee</h2>
          <p>
            A platform fee of {APP_INFO.stats[1].value} is deducted from the gig payment upon release
            from escrow. This fee is subject to change with notice.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">6. Gig Disputes</h2>
          <p>
            If a dispute is raised, an admin will review submitted evidence and make a final decision.
            Tenda's dispute resolution is binding within the platform. We reserve the right to resolve
            disputes at our sole discretion.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">7. Prohibited Conduct</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Post fraudulent or illegal gigs</li>
            <li>Submit false proof of work</li>
            <li>Manipulate, exploit, or abuse the smart contract or platform</li>
            <li>Harass, threaten, or deceive other users</li>
            <li>Violate any applicable law or regulation</li>
          </ul>
          <p className="mt-3">
            Violations may result in account suspension and forfeiture of funds in accordance with
            dispute resolution outcomes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">8. Disclaimers</h2>
          <p>
            The App is provided "as is" without warranties of any kind. Blockchain transactions are
            irreversible. Tenda is not liable for losses resulting from smart contract bugs, network
            failures, wallet compromise, or user error.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Tenda's total liability to you for any claim
            arising from use of the App shall not exceed the platform fees you paid in the 30 days
            preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">10. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of the App after changes constitutes
            acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">11. Contact</h2>
          <p>
            Questions? Reach us on{' '}
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
