import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Outfit } from 'next/font/google'
import { APP_INFO } from '@tenda/shared'
import { siteUrl } from '@/lib/config/site-url'
import { THEME_INIT_SCRIPT } from '@/lib/theme'
import { ToastHost } from '@/components/ui/Toast'
import './globals.css'

// Inter carries the BODY role. It briefly carried display too (spec-correction
// #44, 2026-08-24) after the comps' Space Grotesk/Manrope pairing was dropped;
// display moved to Outfit on 2026-09-01 by user direction, to share a display
// face with apps/tendahq. A variable font, so every weight is one file.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

// The DISPLAY role, and the face apps/tendahq already ships. Only `globals.css`
// names it — every heading goes through the `font-display` utility, so this is
// the one place the display face is chosen.
const outfit = Outfit({
  variable: '--font-outfit',
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
      className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
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
