import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TAG Panel Review',
  description: 'Data Science TAG Panel Review · Dept. of Computer Science & Engineering, School of Computing, Amrita Vishwa Vidyapeetham',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
