'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Search, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

export default function ScrapePage() {
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [result, setResult] = useState<{ success: boolean; error?: string; count?: number; downloadUrl?: string } | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setStatusMsg('Creating job order...')

    try {
      const form = e.currentTarget
      const formData = new FormData(form)

      // Get auth session so the API route can authenticate
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated. Please log in again.')

      // Create the order record first via a lightweight server action
      const { createOrder } = await import('./actions')
      const orderResult = await createOrder(formData)
      if (!orderResult.success || !orderResult.orderId) {
        throw new Error(orderResult.error || 'Failed to create job order')
      }

      setStatusMsg('Order created. Starting AI → Apify pipeline (this can take 2–10 min)...')

      // Call the long-running API route (maxDuration=300) instead of server action
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderId: orderResult.orderId,
          userId: session.user.id,
          parameters: {
            jobName: formData.get('jobName') as string,
            maxLeads: Math.max(100, parseInt(formData.get('maxLeads') as string || '100')),
            enrichEmails: formData.get('enrichEmails') === 'on',
            personalize: formData.get('personalize') === 'on',
          }
        })
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || `Request failed with status ${res.status}`)
      }

      setResult({ success: true, count: data.count, downloadUrl: data.url })
      if (res.ok) form.reset()
    } catch (err: any) {
      setResult({ success: false, error: err.message || 'An unexpected error occurred.' })
    } finally {
      setLoading(false)
      setStatusMsg('')
    }
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>Scrape Leads</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Describe your target audience in plain English. AI will convert it into Apify filters, scrape & enrich the data, then generate personalized icebreakers.</p>
      </div>

      {result && result.success && (
        <div style={{ backgroundColor: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)', border: '1px solid rgba(74, 222, 128, 0.2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CheckCircle size={20} />
          <div>
            <strong>Job completed!</strong> Found {result.count} leads.{' '}
            {result.downloadUrl && (
              <a href={result.downloadUrl} target="_blank" rel="noreferrer" style={{ color: '#4ade80', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Download CSV <ExternalLink size={12} />
              </a>
            )}
            {' '}— Also visible in <strong>Job Orders</strong>.
          </div>
        </div>
      )}

      {result && !result.success && (
        <div style={{ backgroundColor: 'rgba(248, 113, 113, 0.1)', color: '#f87171', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)', border: '1px solid rgba(248, 113, 113, 0.2)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Job failed:</strong> {result.error}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

        <div className="form-group">
          <label htmlFor="jobName" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={16} color="var(--accent-secondary)" /> Job Description
          </label>
          <input
            id="jobName"
            name="jobName"
            required
            className="input-field"
            placeholder="e.g. Find SaaS founders and CTOs in the US with 10-200 employees"
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            AI will translate this into structured Apify filters automatically.
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="maxLeads" className="form-label">Max Leads</label>
          <input id="maxLeads" name="maxLeads" type="number" defaultValue={100} min={100} max={30000} className="input-field" style={{ maxWidth: '200px' }} />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>Minimum is 100 leads per run based on the scraper's requirements.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input type="checkbox" id="enrichEmails" name="enrichEmails" defaultChecked style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }} />
            <label htmlFor="enrichEmails" style={{ color: 'var(--text-primary)' }}>Verify &amp; enrich emails via Prospeo (uses Prospeo credits)</label>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input type="checkbox" id="personalize" name="personalize" defaultChecked style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }} />
            <label htmlFor="personalize" style={{ color: 'var(--text-primary)' }}>Generate AI personalized icebreakers (uses your prompt from Settings)</label>
          </div>
        </div>

        {loading && (
          <div style={{ backgroundColor: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(96, 165, 250, 0.2)', fontSize: '0.875rem' }}>
            <strong>Running pipeline:</strong> {statusMsg || 'AI → Apify scrape → Email enrichment → Personalization → CSV upload...'} This may take 2–10 minutes. Please keep this tab open.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', paddingInline: '3rem', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            {loading ? 'Running Pipeline...' : 'Find Leads'}
          </button>
        </div>
      </form>
    </div>
  )
}
