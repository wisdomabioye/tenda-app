import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { Hero } from './components/sections/Hero'
import { Problem } from './components/sections/Problem'
import { HowItWorks } from './components/sections/HowItWorks'
import { Stats } from './components/sections/Stats'
import { WhyTenda } from './components/sections/WhyTenda'
import { WhoItsFor } from './components/sections/WhoItsFor'
import { DownloadCTA } from './components/sections/Download'
import { Terms } from './components/sections/Terms'
import { Privacy } from './components/sections/Privacy'

function LandingPage() {
  return (
    <main>
      <Hero />
      <Problem />
      <HowItWorks />
      <Stats />
      <WhyTenda />
      <WhoItsFor />
      <DownloadCTA />
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}
