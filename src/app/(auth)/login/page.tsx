import { login } from './actions'
import Link from 'next/link'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const resolvedParams = await searchParams;
  const error = resolvedParams?.error;

  return (
    <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {error && (
        <div style={{ padding: 'var(--space-3)', backgroundColor: 'rgba(248, 113, 113, 0.1)', color: '#f87171', borderRadius: 'var(--radius-md)', border: '1px solid rgba(248, 113, 113, 0.2)', fontSize: '0.875rem', textAlign: 'center' }}>
          {error}
        </div>
      )}
      <div className="form-group">
        <label htmlFor="email" className="form-label">Email</label>
        <input 
          id="email" 
          name="email" 
          type="email" 
          required 
          className="input-field" 
          placeholder="your@email.com" 
        />
      </div>
      <div className="form-group">
        <label htmlFor="password" className="form-label">Password</label>
        <input 
          id="password" 
          name="password" 
          type="password" 
          required 
          className="input-field" 
          placeholder="••••••••" 
        />
      </div>
      <button formAction={login} className="btn-primary" style={{ width: '100%', marginTop: 'var(--space-2)' }}>
        Sign in
      </button>
      
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 'var(--space-4)' }}>
        Don't have an account? <Link href="/signup" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Sign up</Link>
      </p>
    </form>
  )
}
