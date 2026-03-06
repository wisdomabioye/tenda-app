import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { Hero } from './components/sections/Hero'
import { Problem } from './components/sections/Problem'
import { HowItWorks } from './components/sections/HowItWorks'
import { Stats } from './components/sections/Stats'
import { WhyTenda } from './components/sections/WhyTenda'
import { WhoItsFor } from './components/sections/WhoItsFor'
import { DownloadCTA } from './components/sections/Download'

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Stats />
        <WhyTenda />
        <WhoItsFor />
        <DownloadCTA />
      </main>
      <Footer />
    </>
  )
}
