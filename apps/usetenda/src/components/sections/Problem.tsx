import { XCircle, CheckCircle2 } from 'lucide-react'
import { SectionBadge } from '../ui/SectionBadge'

const problems = [
  {
    old: 'Payment held indefinitely',
    new: 'Funds released in seconds on-chain',
  },
  {
    old: 'No proof of work — trust issues',
    new: 'Workers submit verifiable proof before payout',
  },
  {
    old: 'Platform takes 10–30% cut',
    new: 'Zero fees during beta, minimal long-term',
  },
  {
    old: 'Accounts banned, funds frozen',
    new: 'Non-custodial — no one can touch your funds',
  },
]

export function Problem() {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <SectionBadge>The problem</SectionBadge>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight">
            Gig platforms are<br />
            <span className="text-red-500">broken by design.</span>
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            Traditional platforms extract value at every step. Tenda flips that model.
          </p>
        </div>

        <div className="grid gap-4">
          {problems.map((p, i) => (
            <div key={i} className="grid md:grid-cols-2 gap-4">
              {/* Old way */}
              <div className="flex items-center gap-4 p-5 rounded-2xl bg-red-50 border border-red-100">
                <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Old way</p>
                  <p className="text-gray-700 font-medium">{p.old}</p>
                </div>
              </div>
              {/* Tenda way */}
              <div className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-1">Tenda</p>
                  <p className="text-gray-700 font-medium">{p.new}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
