import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import './casino.css'

const geist = Geist({ subsets: ['latin', 'cyrillic'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'UPGRADER — Virtual Skin Simulator',
  description: 'A local virtual skin upgrade simulator with demo currency and inventory.',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b0c0e',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className="bg-background" data-style-version="2026-07-12-clicker-plinko-21">
      <body className={`${geist.variable} font-sans antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
