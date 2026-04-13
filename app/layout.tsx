import type { Metadata } from 'next'
import { Lora, Barlow } from 'next/font/google'
import './globals.css'

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
  display: 'swap',
})

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-barlow',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'OWL — The AI Operating System for Companies That Mean Business',
  description:
    'OWL is a managed AI operating system that deploys 180+ specialized agents across your business. Revenue intelligence, org decomposition, sales acceleration — deployed in 90 days with zero added headcount.',
  openGraph: {
    title: 'OWL — The AI Operating System for Companies That Mean Business',
    description:
      'A managed AI operating system with 180+ specialized agents. Deployed in 90 days.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${lora.variable} ${barlow.variable}`}>
      <body
        style={{
          background: '#0F1014',
          color: '#F2EDE4',
          margin: 0,
          padding: 0,
        }}
      >
        {children}
      </body>
    </html>
  )
}
