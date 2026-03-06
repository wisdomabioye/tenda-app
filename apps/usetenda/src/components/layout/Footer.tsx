import { Link } from 'react-router-dom'
import { APP_INFO } from '../../app-info'
import logoFull from '../../assets/logo-full.png'

const externalLinks = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Why Tenda', href: '#why-tenda' },
  { label: 'Download', href: APP_INFO.apkUrl },
  { label: 'WhatsApp', href: APP_INFO.whatsappUrl },
  { label: 'Twitter / X', href: APP_INFO.twitterUrl },
]

const legalLinks = [
  { label: 'Terms of Service', to: '/terms' },
  { label: 'Privacy Policy', to: '/privacy' },
]

export function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400 py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
        <div className="flex flex-col items-center md:items-start gap-3">
          <img src={logoFull} alt={APP_INFO.name} className="h-6 w-auto brightness-0 invert opacity-60" />
          <p className="text-sm text-center md:text-left max-w-xs">
            Trustless gig marketplace on Solana. Instant escrow, proof-based payments.
          </p>
        </div>

        <nav className="flex flex-wrap justify-center md:justify-end gap-x-8 gap-y-3">
          {externalLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-gray-400 hover:text-white transition-colors no-underline"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
        <span>&copy; {new Date().getFullYear()} Tenda. Built on Solana.</span>
        <div className="flex gap-6">
          {legalLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-gray-500 hover:text-gray-300 transition-colors no-underline"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
