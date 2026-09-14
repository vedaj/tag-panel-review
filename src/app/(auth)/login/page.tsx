'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="landing-shell">
      <div className="hero-panel">
        <p className="eyebrow">Faculty Portal</p>
        <h1 className="title-font" style={{ fontFamily: 'var(--title-font)', margin: '8px 0 0', fontSize: '2rem', letterSpacing: '-0.03em', color: 'var(--app-hero-text)' }}>
          TAG Panel Review
        </h1>
        <p className="hero-copy">
          Data Science TAG · Dept. of Computer Science &amp; Engineering<br />
          School of Computing, Amrita Vishwa Vidyapeetham
        </p>

        <form onSubmit={handleLogin} style={{ marginTop: '28px', display: 'grid', gap: '16px' }}>
          <div className="form-field">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="faculty@cb.amrita.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="error-box">{error}</div>}

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
