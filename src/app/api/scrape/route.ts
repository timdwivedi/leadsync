import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getConfig } from '@/utils/config';

// Ensure the endpoint can run for a while if on Vercel
export const maxDuration = 300; 

export async function POST(req: Request) {
  let currentOrderId: string | null = null;
  
  try {
    const body = await req.json();
    const { orderId, userId, parameters } = body;
    currentOrderId = orderId;

    // Automatically enforce scraper minimum leads requirement
    if (parameters && parameters.maxLeads !== undefined) {
      parameters.maxLeads = Math.max(100, parameters.maxLeads);
    }

    if (!orderId || !userId || !parameters || !parameters.jobName) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    const accessToken = authHeader?.replace('Bearer ', '');

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        },
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
          },
        },
      }
    )

    // Load config from our local JSON store mechanism
    const config = getConfig();

    // Early exit if crucial keys are missing
    if (!config.apify_key) {
      await updateOrderStatus(supabase, orderId, 'failed', 'Missing Apify key');
      return NextResponse.json({ error: 'Missing Apify API Key' }, { status: 400 });
    }

    if (!config.anthropic_key && !config.openai_key) {
      await updateOrderStatus(supabase, orderId, 'failed', 'Missing AI keys for filtering');
      return NextResponse.json({ error: 'Missing Anthropic or OpenAI API Key' }, { status: 400 });
    }

    // --- PHASE 1: AI Translation of Job Name -> Apify Input Schema ---
    const schemaInstructions = `You are a lead generation expert. Convert this plain-English request into a JSON filter object for an Apify actor extracting leads from Apollo-like databases.

User request: "${parameters.jobName}"
Max leads (totalResults): ${parameters.maxLeads || 100}

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
- totalResults: number (set to ${parameters.maxLeads || 100})

Return ONLY the JSON object.`;

    let apifyInputParams: Record<string, any> = { totalResults: parameters.maxLeads || 100, includeEmails: true };

    try {
      console.log('[scrape/route] Generating AI translation for:', parameters.jobName);
      let rawText = '';
      if (config.anthropic_key) {
        const anthropic = new Anthropic({ apiKey: config.anthropic_key });
        const msg = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 800,
          messages: [{ role: 'user', content: schemaInstructions }]
        });
        // @ts-ignore
        rawText = msg.content[0].text.trim();
      } else {
        const openai = new OpenAI({ apiKey: config.openai_key });
        const comp = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: schemaInstructions }],
          response_format: { type: 'json_object' }
        });
        rawText = comp.choices[0].message.content || '{}';
      }
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
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

      apifyInputParams = { ...apifyInputParams, ...parsed };
      console.log('[scrape/route] Apify input:', JSON.stringify(apifyInputParams, null, 2));
    } catch (err) {
      console.error('[scrape/route] AI Translation Failed:', err);
      await updateOrderStatus(supabase, orderId, 'failed', 'AI translation failed');
      return NextResponse.json({ error: 'AI Translation Failed' }, { status: 500 });
    }

    // --- PHASE 2: SCRAPE via Apify (poll until done) ---
    let leads: any[] = [];
    const actorSlug = 'peakydev~leads-scraper';
    const apifyStartUrl = `https://api.apify.com/v2/acts/${actorSlug}/runs?token=${config.apify_key}`;

    try {
      console.log('[scrape/route] Starting Apify run...');
      const runRes = await fetch(apifyStartUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyInputParams)
      });

      if (!runRes.ok) {
        const errText = await runRes.text();
        throw new Error(`Apify run failed (${runRes.status}): ${errText}`);
      }

      const runData = await runRes.json();
      const runId = runData?.data?.id;
      const datasetId = runData?.data?.defaultDatasetId;
      let runStatus = runData?.data?.status ?? 'RUNNING';

      if (!runId || !datasetId) throw new Error('Apify returned no run ID or dataset ID');
      console.log(`[scrape/route] Run started | ID: ${runId} | Status: ${runStatus}`);

      if (runStatus === 'SUCCEEDED') {
        await new Promise(r => setTimeout(r, 5000)); // wait for data to flush
      }

      // Poll until done (max 10 minutes)
      const MAX_WAIT_MS = 10 * 60 * 1000;
      const POLL_INTERVAL_MS = 5000;
      const started = Date.now();

      while (runStatus === 'RUNNING' || runStatus === 'READY' || runStatus === 'ABORTING') {
        if (Date.now() - started > MAX_WAIT_MS) throw new Error('Apify run timed out after 10 minutes');
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${config.apify_key}`);
        if (!statusRes.ok) throw new Error(`Failed to poll run status (${statusRes.status})`);
        const statusData = await statusRes.json();
        runStatus = statusData?.data?.status ?? 'RUNNING';
        console.log(`[scrape/route] Run status after ${Math.round((Date.now() - started) / 1000)}s: ${runStatus}`);
      }

      if (runStatus !== 'SUCCEEDED') throw new Error(`Apify run ended with status: ${runStatus}`);

      const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${config.apify_key}&format=json&clean=true`;
      const dataRes = await fetch(datasetUrl);
      if (!dataRes.ok) throw new Error(`Dataset fetch failed (${dataRes.status})`);

      const raw: any[] = await dataRes.json();
      console.log(`[scrape/route] Got ${raw.length} raw leads from Apify`);
      if (raw.length > 0) console.log('[scrape/route] Sample lead:', JSON.stringify(raw[0], null, 2));

      // Detect actor-level error responses (e.g. free plan restriction)
      if (raw.length > 0 && raw[0]?.error && Object.keys(raw[0]).length === 1) {
        throw new Error(`Apify actor error: ${raw[0].error}`);
      }

      leads = raw.map((l: any) => ({
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
      }));

    } catch (err: any) {
      console.error('[scrape/route] Apify failed:', err);
      await updateOrderStatus(supabase, orderId, 'failed', `Apify: ${err.message}`);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    // --- PHASE 3: ENRICH via Prospeo ---
    if (parameters.enrichEmails && config.prospeo_key && leads.length > 0) {
      try {
        console.log("Enriching leads with Prospeo...");
        const enrichedLeads = await Promise.all(leads.map(async (lead) => {
          if (lead.email) return lead; 
          if (!lead.domain && !lead.companyName) return lead;

          try {
            const res = await fetch('https://api.prospeo.io/enrich-person', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-KEY': config.prospeo_key
              },
              body: JSON.stringify({
                data: {
                  company_name: lead.companyName,
                  company_website: lead.domain,
                  first_name: lead.firstName,
                  last_name: lead.lastName,
                  full_name: lead.fullName
                }
              })
            });
            const data = await res.json();
            const foundEmail = data.email || (data.response && data.response.email) || null;
            return {
              ...lead,
              email: foundEmail,
              emailStatus: foundEmail ? 'found via prospeo' : 'not found'
            };
          } catch (e) {
            console.error("Prospeo failed for", lead.fullName, e);
            return lead;
          }
        }));
        leads = enrichedLeads.filter(l => l.email); // filter leads; keeping only those where email is found
        console.log(`Enrichment complete. ${leads.length} leads have emails.`);
      } catch (err: any) {
        console.error("Enrichment mapping failed", err);
      }
    }

    // --- PHASE 4: PERSONALIZE via AI ---
    if (parameters.personalize && config.personalization_prompt && leads.length > 0) {
      console.log("Personalizing leads...");
      const generatePersonalization = async (lead: any) => {
        const promptContext = config.personalization_prompt
          .replace('{first name}', lead.firstName)
          .replace('{last name}', lead.lastName)
          .replace('{organization_name}', lead.companyName)
          .replace('{headline}', lead.jobTitle)
          .replace('{industry}', lead.industry)
          .replace('{location}', lead.location)
          .replace('{email}', lead.email || '');

        if (config.anthropic_key) {
          const anthropic = new Anthropic({ apiKey: config.anthropic_key });
          const msg = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 250,
            messages: [{ role: 'user', content: promptContext }]
          });
          // @ts-ignore
          return msg.content[0].text;
        } else if (config.openai_key) {
          const openai = new OpenAI({ apiKey: config.openai_key });
          const comp = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'system', content: promptContext }],
          });
          return comp.choices[0].message.content;
        }
      };

      leads = await Promise.all(leads.map(async (lead) => {
        try {
          const rawPersonalization = await generatePersonalization(lead) || "{}";
          const jsonMatch = rawPersonalization.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawPersonalization);
          
          if (parsed.verdict === "true" || parsed.verdict === true || String(parsed.verdict).toLowerCase() === 'true') {
             return { ...lead, icebreaker: parsed.icebreaker, shortenedCompanyName: parsed.shortenedCompanyName };
          } else {
             return { ...lead, icebreaker: "Failed validation", shortenedCompanyName: "" };
          }
        } catch (e) {
          console.error("Personalization Parse Error for", lead.fullName, e);
          return { ...lead, icebreaker: "Parsing error", shortenedCompanyName: "" };
        }
      }));
    }

    // --- PHASE 5: ASSEMBLE CSV & UPLOAD ---
    console.log("Assembling CSV...");
    let csvContent = "firstName,lastName,fullName,companyName,shortCompanyName,jobTitle,email,linkedin,city,state,country,industry,companySize,icebreaker\n";
    leads.forEach(l => {
      const escape = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
      
      csvContent += [
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
        escape(l.icebreaker || '')
      ].join(',') + '\n';
    });

    const fileName = `results_${orderId}.csv`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from('results')
      .upload(fileName, new Blob([csvContent], { type: 'text/csv' }), {
        upsert: true,
        contentType: 'text/csv'
      });

    if (storageError) {
      throw new Error(`Failed to upload CSV: ${storageError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage.from('results').getPublicUrl(fileName);

    // Update Order
    await updateOrderStatus(supabase, orderId, 'completed', null, leads.length, publicUrl);
    console.log("Job completed successfully!");

    return NextResponse.json({ success: true, count: leads.length, url: publicUrl });

  } catch (error: any) {
    console.error("Scrape Job Fatal Error:", error);
    
    if (currentOrderId) {
      try {
        const cookieStore = await cookies();
        const authHeader = req.headers.get('Authorization');
        const accessToken = authHeader?.replace('Bearer ', '');
        
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
            },
            cookies: {
              getAll() { return cookieStore.getAll() },
              setAll() {}
            }
          }
        );
        await updateOrderStatus(supabase, currentOrderId, 'failed', error.message);
      } catch (e) {
        console.error("Failed to update status in catch block:", e);
      }
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function updateOrderStatus(supabase: any, orderId: string, status: string, errorMsg?: string | null, count = 0, downloadUrl?: string) {
  if (!orderId) return;
  await supabase.from('orders').update({
    status,
    error: errorMsg,
    count,
    downloadUrl,
    updated_at: new Date().toISOString()
  }).eq('id', orderId);
}
