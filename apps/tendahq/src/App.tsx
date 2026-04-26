import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { Hero } from './components/sections/hero/Hero'
import { TrustStrip } from './components/sections/trust-strip/TrustStrip'
import { TwoProducts } from './components/sections/two-products/TwoProducts'
import { HowEscrowWorks } from './components/sections/how-escrow-works/HowEscrowWorks'
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
