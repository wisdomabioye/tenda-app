import { Download, Smartphone, ArrowRight } from 'lucide-react'
import { APP_INFO } from '../../app-info'

export function DownloadCTA() {
  return (
    <section id="download" className="py-24 px-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white overflow-hidden relative">
      {/* Decorative circles */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-white/5 rounded-full pointer-events-none" />

      <div className="relative max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-6">
          <Smartphone className="w-8 h-8 text-white" />
        </div>

        <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
          Ready to get paid?
        </h2>
        <p className="text-xl text-blue-100 mb-10 max-w-xl mx-auto">
          Download Tenda for Android and start posting or accepting gigs today.
          No sign-up required — just connect your Solana wallet.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={APP_INFO.apkUrl}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold bg-white text-blue-600 hover:bg-blue-50 shadow-xl shadow-blue-900/30 active:scale-[0.98] transition-all duration-200 no-underline"
          >
            <Download className="w-5 h-5" />
            Download APK
          </a>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-blue-200 text-sm">
          <ArrowRight className="w-4 h-4" />
          <span>iOS version coming soon</span>
        </div>
      </div>
    </section>
  )
}
