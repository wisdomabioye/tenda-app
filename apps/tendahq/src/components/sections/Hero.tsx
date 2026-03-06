import { ChevronDown } from 'lucide-react'
import { Button } from '../ui/Button'
import { APP_INFO } from '../../app-info'
import tendaIcon from '../../assets/tenda-icon-blue.png'

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-950">
      {/* Background gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 mb-8">
          <img src={tendaIcon} alt="" className="w-4 h-4" />
          <span>Powered by Solana — sub-second finality</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
          {APP_INFO.tagline}
        </h1>

        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
          {APP_INFO.description}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button href="/#download" variant="primary" size="lg">
            Download for Android
          </Button>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-lg font-semibold border-2 border-white/20 text-white hover:bg-white/10 hover:border-white/40 active:scale-[0.98] transition-all duration-200 no-underline"
          >
            See how it works
          </a>
        </div>

        {/* Social proof */}
        <p className="mt-8 text-sm text-gray-500">
          No custodial risk &middot; Open-source smart contracts
        </p>

        {/* Scroll indicator */}
        <div className="mt-20 flex flex-col items-center gap-1 opacity-30">
          <ChevronDown className="w-6 h-6 text-white animate-bounce" />
        </div>
      </div>
    </section>
  )
}
