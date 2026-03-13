'use server'

import { createClient } from '@/utils/supabase/server'
import { getConfig } from '@/utils/config'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

/**
 * Lightweight action: just creates an order record in Supabase and validates config.
 * Returns orderId immediately so the client can hand off to the long-running API route.
 */
export async function createOrder(formData: FormData) {
  const supabase = await createClient()

  const parameters = {
    jobName: formData.get('jobName') as string,
    maxLeads: Math.max(100, parseInt(formData.get('maxLeads') as string || '100')),
    enrichEmails: formData.get('enrichEmails') === 'on',
    personalize: formData.get('personalize') === 'on',
  }

  if (!parameters.jobName?.trim()) {
    return { success: false, error: 'Job description is required' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const config = getConfig()
  if (!config.apify_key) return { success: false, error: 'Missing Apify API key. Add it in Config Settings.' }
  if (!config.anthropic_key && !config.openai_key) return { success: false, error: 'Missing Anthropic or OpenAI API key in Config Settings.' }

  const { data: order, error: orderError } = await supabase.from('orders').insert([{
    user_id: user.id,
    query: parameters.jobName,
    status: 'processing',
    count: 0,
    parameters
  }]).select().single()

  if (orderError || !order) {
    console.error('Order creation failed', orderError)
    return { success: false, error: 'Could not create job order in database' }
  }

  return { success: true, orderId: order.id as string }
}

export async function startScrapeJob(formData: FormData) {
  const supabase = await createClient()

  const parameters = {
    jobName: formData.get('jobName') as string,
    maxLeads: Math.max(100, parseInt(formData.get('maxLeads') as string || '100')),
    enrichEmails: formData.get('enrichEmails') === 'on',
    personalize: formData.get('personalize') === 'on',
  }

  // --- AUTH ---
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  // --- CREATE ORDER ---
  const { data: order, error: orderError } = await supabase.from('orders').insert([{
    user_id: user.id,
    query: parameters.jobName,
    status: 'processing',
    count: 0,
    parameters
  }]).select().single()

  if (orderError || !order) {
    console.error("Order creation failed", orderError)
    throw new Error("Could not create job order")
  }

  const orderId = order.id

  const updateStatus = async (
    status: string,
    extra: { count?: number; downloadUrl?: string; error?: string } = {}
  ) => {
    await supabase.from('orders').update({
      status,
      updated_at: new Date().toISOString(),
      ...extra
    }).eq('id', orderId)
  }

  // --- LOAD CONFIG ---
  const config = getConfig()

  if (!config.apify_key) {
    await updateStatus('failed', { error: 'Missing Apify API key. Add it in Settings.' })
    return { success: false, error: 'Missing Apify API key' }
  }

  if (!config.anthropic_key && !config.openai_key) {
    await updateStatus('failed', { error: 'Missing Anthropic or OpenAI API key in Settings.' })
    return { success: false, error: 'Missing AI keys' }
  }

  // --- PHASE 1: AI -> Apify Filter Schema ---
  const prompt = `You are a lead generation expert. Convert this plain-English request into a JSON filter object for an Apify actor extracting leads from Apollo-like databases.

User request: "${parameters.jobName}"
Max leads (totalResults): ${parameters.maxLeads}

CRITICAL RULES:
1. Return ONLY a valid JSON object, no markdown, no explanation.
2. Use the exact keys and data types provided below. All list fields MUST be arrays of strings.
3. Be broad rather than extremely strict unless the user explicitly requested it.
4. "includeEmails" MUST be true.
5. "contactEmailStatus" SHOULD be "verified" by default.

Available JSON Keys (Omit if not relevant):
- firstName: string
- lastName: string
- personTitle: string[] (e.g., ["CEO", "Founder", "VP of Sales"])
- seniority: string[] (Use EXACT strings from this list ONLY: "Founder", "Chairman", "President", "CEO", "CXO", "Vice President", "Director", "Head", "Manager", "Senior", "Junior", "Entry Level", "Executive")
- functional: string[] (e.g., ["Admin", "Analytics", "Engineering", "Marketing", "Sales", "Operations"])
- companyEmployeeSize: string[] (Use EXACT strings from this list: "0 - 1", "2 - 10", "11 - 50", "51 - 200", "201 - 500", "501 - 1000", "1001 - 5000", "5001 - 10000", "10000+")
- personCountry: string[] (e.g., ["United States", "United Kingdom", "Canada"])
- personState: string[] (e.g., ["California", "Texas"])
- contactEmailStatus: string (Use "verified")
- companyCountry: string[]
- companyState: string[]
- companyDomain: string[]
- industry: string[] (e.g., ["Software Development", "Public Safety", "Hospitality", "IT Services and IT Consulting", "Financial Services"])
- industryKeywords: string[] (e.g., ["AI", "SaaS", "Fintech", "Healthtech"])
- revenue: string[] (Use EXACT strings from this list: "< 1M", "1M-10M", "11M-100M", "101M-500M", "501M-1B", "1B+")
- businessModel: string[] (Use EXACT strings from this list: "Product", "Services", "Solutions", "Marketplace", "E-commerce")
- includeEmails: boolean (MUST be true)
- totalResults: number (set to ${parameters.maxLeads})

Return ONLY the JSON object.`;

  let apifyInput: Record<string, any> = { totalResults: parameters.maxLeads, includeEmails: true };

  try {
    let rawText = ''
    if (config.anthropic_key) {
      const anthropic = new Anthropic({ apiKey: config.anthropic_key })
      const msg = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
      // @ts-ignore
      rawText = msg.content[0].text.trim()
    } else {
      const openai = new OpenAI({ apiKey: config.openai_key })
      const comp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
      rawText = comp.choices[0].message.content || '{}'
    }

    // Strip markdown code fences if present
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    // Normalize array fields in case AI returns a string instead of array
    const asArray = (val: any) => Array.isArray(val) ? val : (typeof val === 'string' && val.trim() !== '' ? [val] : undefined);
    
    const arrayKeys = ['personTitle', 'seniority', 'functional', 'companyEmployeeSize', 'personCountry', 'personState', 'companyCountry', 'companyState', 'companyDomain', 'industry', 'industryKeywords', 'revenue', 'businessModel'];
    arrayKeys.forEach(key => {
      if (parsed[key] !== undefined) {
        const arr = asArray(parsed[key]);
        if (arr) parsed[key] = arr;
        else delete parsed[key];
      }
    });

    apifyInput = { ...apifyInput, ...parsed }
    console.log('[LeadScraper] Apify input generated:', JSON.stringify(apifyInput, null, 2))
  } catch (err: any) {
    console.error('[LeadScraper] AI translation failed:', err)
    await updateStatus('failed', { error: `AI failed to format query: ${err.message}` })
    return { success: false, error: 'AI translation failed' }
  }


  // --- PHASE 2: SCRAPE via Apify ---
  let leads: any[] = []
  const actorSlug = 'peakydev~leads-scraper'
  // Start the run WITHOUT waitForFinish so we get the runId immediately
  const apifyStartUrl = `https://api.apify.com/v2/acts/${actorSlug}/runs?token=${config.apify_key}`

  try {
    console.log('[LeadScraper] Starting Apify run...')
    const runRes = await fetch(apifyStartUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyInput)
    })

    if (!runRes.ok) {
      const errText = await runRes.text()
      throw new Error(`Apify run failed (${runRes.status}): ${errText}`)
    }

    const runData = await runRes.json()
    const runId = runData?.data?.id
    const datasetId = runData?.data?.defaultDatasetId
    const initialStatus = runData?.data?.status

    if (!runId || !datasetId) throw new Error('Apify returned no run ID or dataset ID')
    console.log(`[LeadScraper] Run started | ID: ${runId} | Dataset: ${datasetId} | Initial status: ${initialStatus}`)

    // --- POLL until the run finishes (max 10 minutes) ---
    const MAX_WAIT_MS = 10 * 60 * 1000
    const POLL_INTERVAL_MS = 5000
    const started = Date.now()
    let runStatus = initialStatus ?? 'RUNNING'

    // If already SUCCEEDED immediately, wait a moment for data to flush
    if (runStatus === 'SUCCEEDED') {
      console.log('[LeadScraper] Run SUCCEEDED immediately — waiting 5s for data flush...')
      await new Promise(r => setTimeout(r, 5000))
    }

    while (runStatus === 'RUNNING' || runStatus === 'READY' || runStatus === 'ABORTING') {
      if (Date.now() - started > MAX_WAIT_MS) {
        throw new Error('Apify run timed out after 10 minutes')
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

      const statusRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${config.apify_key}`
      )
      if (!statusRes.ok) throw new Error(`Failed to poll run status (${statusRes.status})`)
      const statusData = await statusRes.json()
      runStatus = statusData?.data?.status ?? 'RUNNING'
      const elapsed = Math.round((Date.now() - started) / 1000)
      console.log(`[LeadScraper] Run status after ${elapsed}s: ${runStatus}`)
    }

    if (runStatus !== 'SUCCEEDED') {
      throw new Error(`Apify run ended with status: ${runStatus}`)
    }

    // --- Fetch dataset items ---
    const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${config.apify_key}&format=json&clean=true`
    const dataRes = await fetch(datasetUrl)
    if (!dataRes.ok) throw new Error(`Dataset fetch failed (${dataRes.status})`)

    const raw: any[] = await dataRes.json()
    console.log(`[LeadScraper] Got ${raw.length} raw leads from Apify`)
    if (raw.length > 0) console.log('[LeadScraper] Sample lead:', JSON.stringify(raw[0], null, 2))
    else console.warn('[LeadScraper] Empty dataset — actor found no results for these filters.')

    // Normalize using EXACT field names from actor output schema docs
    leads = raw.map(l => ({
      firstName: l.firstName || l.first_name || '',
      lastName: l.lastName || l.last_name || '',
      fullName: l.fullName || l.full_name || l.name || `${l.firstName || l.first_name || ''} ${l.lastName || l.last_name || ''}`.trim(),
      jobTitle: l.title || l.personTitle || l.job_title || l.headline || '',
      companyName: l.company || l.companyName || l.company_name || l.org_name || '',
      domain: l.companyDomain || l.company_domain || l.domain || l.website || '',
      email: l.email || l.contactEmail || l.personal_email || null,
      linkedin: l.linkedinUrl || l.personLinkedinUrl || l.linkedin || l.linkedIn || '',
      city: l.city || l.personCity || '',
      state: l.state || l.personState || '',
      country: l.country || l.personCountry || '',
      location: [l.city || l.personCity, l.state || l.personState, l.country || l.personCountry].filter(Boolean).join(', '),
      industry: l.industry || l.companyIndustry || '',
      companySize: l.companyEmployeeSize || l.company_size || l.size || '',
    }))

  } catch (err: any) {
    console.error('[LeadScraper] Apify failed:', err)
    await updateStatus('failed', { error: `Apify: ${err.message}` })
    return { success: false, error: err.message }
  }


  // --- PHASE 3: ENRICH via Prospeo (optional) ---
  if (parameters.enrichEmails && config.prospeo_key && leads.length > 0) {
    console.log('[LeadScraper] Enriching emails via Prospeo...')
    const enriched: any[] = []

    for (const lead of leads) {
      if (lead.email) { enriched.push(lead); continue }
      if (!lead.firstName && !lead.domain) { enriched.push(lead); continue }

      try {
        const res = await fetch('https://api.prospeo.io/linkedin-email-finder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-KEY': config.prospeo_key },
          body: JSON.stringify({
            first_name: lead.firstName,
            last_name: lead.lastName,
            company: lead.companyName,
            domain: lead.domain
          })
        })
        const data = await res.json()
        const foundEmail = data?.response?.email || data?.email || null
        enriched.push({ ...lead, email: foundEmail })
      } catch {
        enriched.push(lead)
      }
    }

    leads = enriched.filter(l => l.email)
    console.log(`[LeadScraper] After enrichment: ${leads.length} leads with emails`)
  }

  // --- PHASE 4: PERSONALIZE via AI (optional) ---
  if (parameters.personalize && config.personalization_prompt && leads.length > 0) {
    console.log('[LeadScraper] Personalizing leads...')

    const personalize = async (lead: any): Promise<string> => {
      const ctx = config.personalization_prompt
        .replace('{first name}', lead.firstName)
        .replace('{last name}', lead.lastName)
        .replace('{organization_name}', lead.companyName)
        .replace('{headline}', lead.jobTitle)
        .replace('{industry}', lead.industry)
        .replace('{location}', lead.location)
        .replace('{email}', lead.email || '')

      try {
        if (config.anthropic_key) {
          const anthropic = new Anthropic({ apiKey: config.anthropic_key })
          const msg = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 250,
            messages: [{ role: 'user', content: ctx }]
          })
          // @ts-ignore
          return msg.content[0].text
        } else {
          const openai = new OpenAI({ apiKey: config.openai_key })
          const comp = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: ctx }]
          })
          return comp.choices[0].message.content || '{}'
        }
      } catch {
        return '{}'
      }
    }

    leads = await Promise.all(leads.map(async lead => {
      const raw = await personalize(lead)
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
        if (parsed.verdict === 'true' || parsed.verdict === true || String(parsed.verdict).toLowerCase() === 'true') {
          return { ...lead, icebreaker: parsed.icebreaker || '', shortenedCompanyName: parsed.shortenedCompanyName || '' }
        }
      } catch (e) { console.error('Personalization parse error:', e, "Raw output:", raw) }
      return { ...lead, icebreaker: '', shortenedCompanyName: '' }
    }))
  }

  // --- PHASE 5: BUILD CSV ---
  const escape = (val: string) => `"${(val || '').replace(/"/g, '""')}"`

  let csv = 'firstName,lastName,fullName,companyName,shortCompanyName,jobTitle,email,linkedin,city,state,country,industry,companySize,icebreaker\n'
  for (const l of leads) {
    csv += [
      escape(l.firstName),
      escape(l.lastName),
      escape(l.fullName),
      escape(l.companyName),
      escape(l.shortenedCompanyName || ''),
      escape(l.jobTitle),
      escape(l.email || ''),
      escape(l.linkedin || ''),
      escape(l.city || ''),
      escape(l.state || ''),
      escape(l.country || ''),
      escape(l.industry || ''),
      escape(l.companySize || ''),
      escape(l.icebreaker || ''),
    ].join(',') + '\n'
  }

  // --- PHASE 6: UPLOAD CSV TO SUPABASE STORAGE ---
  const fileName = `results_${orderId}.csv`
  const { error: uploadError } = await supabase.storage
    .from('results')
    .upload(fileName, new Blob([csv], { type: 'text/csv' }), { upsert: true, contentType: 'text/csv' })

  if (uploadError) {
    console.error('[LeadScraper] Storage upload failed:', uploadError)
    await updateStatus('failed', { error: `Storage upload failed: ${uploadError.message}` })
    return { success: false, error: uploadError.message }
  }

  const { data: { publicUrl } } = supabase.storage.from('results').getPublicUrl(fileName)

  // --- PHASE 7: MARK ORDER COMPLETE ---
  await updateStatus('completed', { count: leads.length, downloadUrl: publicUrl })
  console.log(`[LeadScraper] Done! ${leads.length} leads. URL: ${publicUrl}`)

  return { success: true, orderId, count: leads.length, downloadUrl: publicUrl }
}
