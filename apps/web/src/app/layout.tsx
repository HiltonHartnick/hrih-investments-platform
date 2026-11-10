import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HRIH Investments | Platform API',
  description: 'Secure HRIH Investments CRM and product-ingestion services.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA">
      <body>{children}</body>
    </html>
  )
}
