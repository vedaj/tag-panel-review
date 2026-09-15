import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TAG Panel Review',
  description: 'Data Science TAG Panel Review · Dept. of Computer Science & Engineering, School of Computing, Amrita Vishwa Vidyapeetham',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Applies persisted theme/font before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('tag:theme');var f=localStorage.getItem('tag:font');if(t==='dark')document.documentElement.classList.add('dark');if(f==='sans')document.documentElement.classList.add('font-sans-ui');}catch(e){}})();` }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
