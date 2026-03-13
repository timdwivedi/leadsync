import { getConfig } from '@/utils/config'
import ConfigForm from './ConfigForm'

export default async function ConfigPage() {
  const profile = getConfig();

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>Configuration</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Set up your API keys and personalization prompts to enable the lead generation pipeline.</p>
      </div>

      <ConfigForm profile={profile} />
    </div>
  )
}
