'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { ReownProvider } from '@/providers/reown'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ReownProvider>{children}</ReownProvider>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  )
}
