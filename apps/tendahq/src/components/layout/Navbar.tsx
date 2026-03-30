import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronRight, Menu, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { APP_INFO } from '../../app-info'
import logoFull from '../../assets/logo-full.png'

const navLinks = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Why Tenda', href: '/#why-tenda' },
  { label: 'For who', href: '/#for-who' },
]

export function Navbar() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const elevated = scrolled || !isHome

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`mx-auto w-full transition-all duration-300 ${
          elevated || menuOpen
            ? 'border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg-elev)_96%,black)] shadow-[0_14px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl'
            : 'bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2 no-underline">
            <img
              src={logoFull}
              alt={APP_INFO.name}
              className={`h-7 w-auto transition-opacity duration-300 ${elevated ? 'opacity-100' : 'opacity-95'}`}
            />
          </a>

          <nav className="hidden md:flex items-center gap-7">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium no-underline text-[var(--text)] transition-colors hover:text-[var(--heading)]"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button href="/#download" variant="primary" size="sm">
              Download App
            </Button>
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="md:hidden rounded-xl p-2 text-[var(--text)] transition-colors hover:bg-[color-mix(in_oklab,var(--surface)_94%,transparent)]"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        <div
          id="mobile-nav"
          aria-hidden={!menuOpen}
          className={`md:hidden overflow-hidden transition-[max-height,opacity,border-color] duration-300 ease-out ${
            menuOpen
              ? 'max-h-[420px] opacity-100 border-t border-[var(--border)]'
              : 'pointer-events-none max-h-0 opacity-0 border-t border-transparent'
          }`}
        >
          <div
            className={`bg-[color-mix(in_oklab,var(--bg-elev)_98%,black)] transition-transform duration-300 ease-out ${
              menuOpen ? 'translate-y-0' : '-translate-y-2'
            }`}
          >
            <div className="mx-auto max-w-6xl px-4 pb-5 pt-3">
              <div className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Navigate
              </div>

              <div className="overflow-hidden rounded-b-[1.5rem] rounded-t-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-strong)_96%,transparent)] shadow-[var(--shadow-soft)]">
                <div className="divide-y divide-[var(--border)]">
                  {navLinks.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-4 no-underline text-[var(--heading)] transition-colors hover:bg-[color-mix(in_oklab,var(--surface)_92%,transparent)]"
                    >
                      <span className="text-sm font-medium">{l.label}</span>
                      <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                    </a>
                  ))}
                </div>

                <div className="border-t border-[var(--border)] p-4">
                  <Button href={APP_INFO.apkUrl} variant="primary" size="sm" className="w-full justify-center">
                    Download App
                  </Button>

                  <p className="mt-3 text-center text-xs leading-5 text-[var(--text-muted)]">
                    Trustless escrow for gigs on Solana
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
