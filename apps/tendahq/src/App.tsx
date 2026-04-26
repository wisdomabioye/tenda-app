import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { Hero } from './components/sections/hero/Hero'
import { TrustStrip } from './components/sections/trust-strip/TrustStrip'
import { TwoProducts } from './components/sections/two-products/TwoProducts'
import { HowEscrowWorks } from './components/sections/how-escrow-works/HowEscrowWorks'
import { LiveTicker } from './components/sections/live-ticker/LiveTicker'
import { WhyTenda } from './components/sections/why-tenda/WhyTenda'
import { Coverage } from './components/sections/coverage-map/Coverage'
import { ThreeAudiences } from './components/sections/three-audiences/ThreeAudiences'
import { FAQ } from './components/sections/faq/FAQ'
import { Terms } from './components/sections/Terms'
import { Privacy } from './components/sections/Privacy'

function LandingPage() {
  // Sections built section-by-section in Phase 3 (see LANDING_TODO.md).
  return (
    <>
      <Hero />
      <TrustStrip />
      <TwoProducts />
      <HowEscrowWorks />
      <LiveTicker />
      <WhyTenda />
      <Coverage />
      <ThreeAudiences />
      <FAQ />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}
