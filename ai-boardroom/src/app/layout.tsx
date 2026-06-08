import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { SiteNav } from '@/components/site-nav'

export const metadata: Metadata = {
  title: 'AI Boardroom — Multi-Agent Decision Intelligence',
  description: 'Specialized AI agents debate, critique, and build your project roadmap.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <SiteNav />
        <main>{children}</main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
