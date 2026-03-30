import { Link } from 'react-router-dom'
import { APP_INFO } from '../../app-info'
import logoFull from '../../assets/logo-full.png'

const externalLinks = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Why Tenda', href: '/#why-tenda' },
  { label: 'Download', href: '/#download' },
  { label: 'WhatsApp', href: APP_INFO.whatsappUrl },
  { label: 'Twitter / X', href: APP_INFO.twitterUrl },
]

const legalLinks = [
  { label: 'Terms of Service', to: '/terms' },
  { label: 'Privacy Policy', to: '/privacy' },
]

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--bg-soft)_92%,black)] text-[var(--text-muted)] py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
        <div className="flex flex-col items-center md:items-start gap-3">
          <img src={logoFull} alt={APP_INFO.name} className="h-6 w-auto opacity-75" />
          <p className="text-sm text-center md:text-left max-w-xs">
            Trustless gig marketplace on Solana. Instant escrow, proof-based payments.
          </p>
        </div>

        <nav className="flex flex-wrap justify-center md:justify-end gap-x-8 gap-y-3">
          {externalLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--heading)] transition-colors no-underline"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
        <span>&copy; {new Date().getFullYear()} Tenda. Built on Solana.</span>
        <div className="flex gap-6">
          {legalLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-[var(--text-muted)] hover:text-[var(--heading)] transition-colors no-underline"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
