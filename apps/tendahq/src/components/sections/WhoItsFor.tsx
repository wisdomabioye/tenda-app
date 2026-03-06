import { Briefcase, ClipboardList, Check } from 'lucide-react'
import { SectionBadge } from '../ui/SectionBadge'
import { Button } from '../ui/Button'
import { APP_INFO } from '../../app-info'

const workers = [
  'Side hustlers between jobs',
  'Freelancers tired of payment delays',
  'Crypto-native earners',
  'Anyone wanting instant SOL payouts',
]

const posters = [
  'Small businesses needing quick help',
  'Individuals posting one-time tasks',
  'Crypto-savvy entrepreneurs',
  'Anyone who wants verified work done',
]

export function WhoItsFor() {
  return (
    <section id="for-who" className="py-24 px-6 bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <SectionBadge>Who it&apos;s for</SectionBadge>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
            Two sides, one platform
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Workers */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-600/20 to-blue-800/10 border border-blue-500/20">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6">
              <Briefcase className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">Workers</h3>
            <p className="text-gray-400 mb-6">You do the work, you keep the SOL. No chargebacks, no waiting.</p>
            <ul className="space-y-3 mb-8">
              {workers.map((w) => (
                <li key={w} className="flex items-center gap-3 text-gray-300">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-blue-400" />
                  </span>
                  {w}
                </li>
              ))}
            </ul>
            <Button href={APP_INFO.apkUrl} variant="primary" size="md">
              Start earning
            </Button>
          </div>

          {/* Posters */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-emerald-600/20 to-emerald-800/10 border border-emerald-500/20">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-6">
              <ClipboardList className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">Posters</h3>
            <p className="text-gray-400 mb-6">Post a task, review proof, release payment. No disputes, no stress.</p>
            <ul className="space-y-3 mb-8">
              {posters.map((p) => (
                <li key={p} className="flex items-center gap-3 text-gray-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <Button
              href={APP_INFO.apkUrl}
              size="md"
              className="inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 cursor-pointer no-underline px-6 py-3 text-base bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
            >
              Post your first gig
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
