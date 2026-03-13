import { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout" style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 50% 10%, rgba(212, 255, 54, 0.05), transparent 40%), var(--bg-primary)' }}>
      <div className="auth-container glass-panel" style={{ width: '100%', maxWidth: '400px', padding: 'var(--space-8)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <Link href="/" style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'inline-block' }}>
            <span className="gradient-text-accent" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              ⚡ LeadSync
            </span>
          </Link>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)', fontSize: '0.9rem' }}>
            Welcome back. Let's find some leads.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
