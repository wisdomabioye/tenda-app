import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/sections/footer/Footer'
import { Hero } from './components/sections/hero/Hero'
import { TaskWall } from './components/sections/task-wall/TaskWall'
import { TwoProducts } from './components/sections/two-products/TwoProducts'
import { CurrencyMarquee } from './components/sections/two-products/CurrencyMarquee'
import { HowEscrowWorks } from './components/sections/how-escrow-works/HowEscrowWorks'
import { Onboarding } from './components/sections/onboarding/Onboarding'
import { Ecosystems } from './components/sections/ecosystems/Ecosystems'
import { Networks } from './components/sections/networks/Networks'
import { FAQ } from './components/sections/faq/FAQ'
import { FinalCTA } from './components/sections/final-cta/FinalCTA'
import { Terms } from './components/sections/Terms'
import { Privacy } from './components/sections/Privacy'

/**
 * The landing composition, exported apart from <App /> so it can be rendered
 * without a router. <App /> mounts a BrowserRouter, which needs a DOM this
 * project deliberately does not install — the suite renders to static markup
 * instead. Exporting the page is what lets `page-rhythm.test.tsx` assert
 * against the REAL section order rather than against a copy of it that could
 * drift from the page it claims to check.
 */
export function LandingPage() {
  // Spine: dark hero → light task wall → dark products (+ full-bleed currency
  // marquee) → dark escrow explainer → light onboarding rails → dark
  // ecosystems → networks → FAQ → final CTA.
  //
  // Networks follows Ecosystems deliberately: Ecosystems argues WHY these
  // chains, so the reference table answering WHAT exactly am I connecting to
  // reads as the follow-up to that argument rather than as a spec sheet
  // dropped between two pitches.
  //
  // SURFACES STRICTLY ALTERNATE, and inserting a section is what breaks that.
  // Every neighbouring pair from TaskWall down differs, so the boundary between
  // two sections is always visible. Adding Networks as `base` directly above a
  // `base` FAQ put two identical surfaces side by side and erased one of those
  // boundaries; restoring the rhythm meant flipping FAQ and FinalCTA, because
  // an insertion into an alternating chain always costs a flip downstream.
  // `page-rhythm.test.tsx` now fails if a pair ever matches again.
  return (
    <>
      <Hero />
      <TaskWall />
      <TwoProducts />
      <CurrencyMarquee />
      <HowEscrowWorks />
      <Onboarding />
      <Ecosystems />
      <Networks />
      <FAQ />
      <FinalCTA />
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
