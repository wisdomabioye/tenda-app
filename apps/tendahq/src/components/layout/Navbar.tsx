import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
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
          elevated
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
            className="md:hidden p-2 rounded-lg cursor-pointer text-[var(--text)] hover:bg-[color-mix(in_oklab,var(--surface)_94%,transparent)]"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--bg-elev)_96%,black)] px-4 py-4">
            <div className="mx-auto flex max-w-6xl flex-col gap-3">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="py-1 font-medium no-underline text-[var(--text)]"
                >
                  {l.label}
                </a>
              ))}
              <Button href={APP_INFO.apkUrl} variant="primary" size="sm" className="self-start mt-1">
                Download App
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
