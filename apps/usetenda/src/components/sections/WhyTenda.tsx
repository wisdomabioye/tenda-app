import { Zap, Camera, Lock, Scale } from 'lucide-react'
import { SectionBadge } from '../ui/SectionBadge'
import type { LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: Zap,
    title: 'Instant Escrow',
    description: 'Funds lock the moment a gig is published — no waiting, no manual holds.',
  },
  {
    icon: Camera,
    title: 'Proof-Based Approval',
    description: 'Workers submit photo/video proof. Posters review before releasing payment.',
  },
  {
    icon: Lock,
    title: 'Non-Custodial',
    description: 'Your keys, your money. Tenda never touches your SOL — the smart contract does.',
  },
  {
    icon: Scale,
    title: 'Built-in Disputes',
    description: 'Fair dispute resolution backed by admin arbitration. No he-said-she-said.',
  },
]

export function WhyTenda() {
  return (
    <section id="why-tenda" className="py-24 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <SectionBadge>Why Tenda</SectionBadge>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight">
            Built different
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            Every feature exists to protect workers and posters — not extract from them.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="group p-7 rounded-2xl border border-gray-100 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 bg-white"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
                <f.icon className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
