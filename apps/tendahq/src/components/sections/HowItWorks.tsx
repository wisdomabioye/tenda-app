import { useState } from 'react'
import { SectionBadge } from '../ui/SectionBadge'
import { APP_INFO } from '../../app-info'

type Tab = 'earn' | 'post'

export function HowItWorks() {
  const [tab, setTab] = useState<Tab>('earn')

  const steps = tab === 'earn' ? APP_INFO.howItWorksEarn : APP_INFO.howItWorksPost

  return (
    <section id="how-it-works" className="py-24 px-6 bg-gray-50">
      <div className="max-w-3xl mx-auto text-center">
        <SectionBadge>How it works</SectionBadge>
        <h2 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-6">
          Simple for everyone
        </h2>

        {/* Tab toggle */}
        <div className="inline-flex items-center bg-white border border-gray-200 rounded-2xl p-1 mb-12">
          <button
            onClick={() => setTab('earn')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              tab === 'earn' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Earn SOL
          </button>
          <button
            onClick={() => setTab('post')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              tab === 'post' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Post a gig
          </button>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-0">
          {steps.map((step, i) => (
            <div key={step.step} className="flex gap-6 text-left">
              {/* Line + circle */}
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30">
                  {step.step}
                </div>
                {i < steps.length - 1 && <div className="w-0.5 flex-1 bg-blue-100 my-2" />}
              </div>

              {/* Content */}
              <div className={`pb-10 ${i === steps.length - 1 ? 'pb-0' : ''}`}>
                <h3 className="text-lg font-bold text-gray-900 mt-2 mb-1">{step.title}</h3>
                <p className="text-gray-500">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
