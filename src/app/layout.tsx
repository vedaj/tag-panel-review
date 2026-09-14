import type { Metadata } from 'next'
import { Instrument_Sans } from 'next/font/google'
import './globals.css'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
})

export const metadata: Metadata = {
  title: 'TAG Panel Review',
  description: 'Data Science TAG Panel Review · Dept. of Computer Science & Engineering, School of Computing, Amrita Vishwa Vidyapeetham',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={instrumentSans.className}>{children}</body>
    </html>
  )
}
