import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { APP_INFO } from '@tenda/shared'
import { siteUrl } from '@/lib/config/site-url'
import { THEME_INIT_SCRIPT } from '@/lib/theme'
import { ToastHost } from '@/components/ui/Toast'
import './globals.css'

// Inter carries BOTH the display and body roles (spec-correction #44 — the
// comps' Space Grotesk/Manrope pairing was replaced by user direction,
// 2026-08-24). A variable font, so every weight the app sets is one file.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: APP_INFO.name, template: `%s | ${APP_INFO.name}` },
  description: APP_INFO.description,
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Paints an explicit theme choice before hydration — no light flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Global: toasts must survive route changes AND fire from the public
            group (the gig detail island toasts there). */}
        <ToastHost />
      </body>
    </html>
  )
}
