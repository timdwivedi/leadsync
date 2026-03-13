'use client'
import { KeyRound, Bot, Sparkles, MailSearch } from 'lucide-react'
import { saveConfig } from './actions'
import { AppConfig } from '@/utils/config'

export default function ConfigForm({ profile }: { profile: AppConfig }) {
  return (
    <form action={async (formData) => { await saveConfig(formData); alert("Keys saved successfully!"); }} className="glass-panel" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound size={20} className="gradient-text-accent" /> Scraping
        </h2>
        <div className="form-group" style={{ maxWidth: '50%' }}>
          <label htmlFor="apify_key" className="form-label">Apify API Key</label>
          <input id="apify_key" name="apify_key" type="password" defaultValue={profile.apify_key} className="input-field" placeholder="apify_api_..." />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>Used for LinkedIn scraping.</div>
        </div>
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={20} className="gradient-text-accent" /> AI Generation
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div className="form-group">
            <label htmlFor="anthropic_key" className="form-label">Anthropic API Key (Primary)</label>
            <input id="anthropic_key" name="anthropic_key" type="password" defaultValue={profile.anthropic_key} className="input-field" placeholder="sk-ant-..." />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>Prioritized if both keys are provided (Claude 3.5 Sonnet).</div>
          </div>
          <div className="form-group">
            <label htmlFor="openai_key" className="form-label">OpenAI API Key (Fallback)</label>
            <input id="openai_key" name="openai_key" type="password" defaultValue={profile.openai_key} className="input-field" placeholder="sk-proj-..." />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>Used as fallback if Anthropic key is missing (GPT-4o).</div>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="personalization_prompt" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={14} color="var(--accent-secondary)" /> Personalization Prompt (Icebreaker)
          </label>
          <textarea 
            id="personalization_prompt" 
            name="personalization_prompt" 
            defaultValue={profile.personalization_prompt} 
            className="input-field" 
            rows={8}
            style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Define the AI system prompt and required JSON output format. Wait for the `{'input: {first name}, {last name}, ...'}` block at the end.
          </div>
        </div>
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MailSearch size={20} className="gradient-text-accent" /> Enrichment
        </h2>
        <div className="form-group" style={{ maxWidth: '50%' }}>
          <label htmlFor="prospeo_key" className="form-label">Prospeo API Key</label>
          <input id="prospeo_key" name="prospeo_key" type="password" defaultValue={profile.prospeo_key} className="input-field" placeholder="sk_..." />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>For finding professional emails using Prospeo.</div>
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
        <button type="submit" className="btn-primary" style={{ display: 'inline-flex', paddingInline: '3rem' }}>
          Save Configuration
        </button>
      </div>
    </form>
  )
}
