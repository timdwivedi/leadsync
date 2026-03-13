import { NextResponse } from 'next/server'
import { getConfig } from '@/utils/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = getConfig()

  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    config: {
      hasApifyKey: !!config.apify_key,
      apifyKeyPrefix: config.apify_key ? config.apify_key.substring(0, 8) + '...' : 'MISSING',
      hasAnthropicKey: !!config.anthropic_key,
      hasOpenAIKey: !!config.openai_key,
      hasProspeoKey: !!config.prospeo_key,
    }
  }

  if (!config.apify_key) {
    return NextResponse.json({ ...diagnostics, error: 'No Apify key found in config.json' })
  }

  // Test 1: Validate Apify token
  try {
    const meRes = await fetch(`https://api.apify.com/v2/users/me?token=${config.apify_key}`)
    const meData = await meRes.json()
    diagnostics.apifyUser = {
      status: meRes.status,
      username: meData?.data?.username,
      plan: meData?.data?.plan?.id || meData?.data?.plan,
      monthlyUsage: meData?.data?.monthlyUsage,
      error: meData?.error?.message || null
    }
  } catch (e: any) {
    diagnostics.apifyUserError = e.message
  }

  // Test 2: Start a minimal actor run (just 3 leads, US only)
  const minimalInput = {
    personTitle: ['CEO'],
    personCountry: ['United States'],
    totalResults: 3,
    includeEmails: true
  }

  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/peakydev~leads-scraper/runs?token=${config.apify_key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(minimalInput)
      }
    )
    const runData = await runRes.json()
    diagnostics.testRun = {
      httpStatus: runRes.status,
      runId: runData?.data?.id,
      runStatus: runData?.data?.status,
      datasetId: runData?.data?.defaultDatasetId,
      error: runData?.error || null
    }

    // If run started, poll briefly to see if it completes
    if (runData?.data?.id && runRes.ok) {
      const runId = runData.data.id
      await new Promise(r => setTimeout(r, 8000))

      const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${config.apify_key}`)
      const pollData = await pollRes.json()
      diagnostics.testRunAfter8s = {
        status: pollData?.data?.status,
        itemCount: pollData?.data?.stats?.itemCount ?? 'unknown'
      }

      // If done, fetch dataset
      if (pollData?.data?.status === 'SUCCEEDED') {
        const dsRes = await fetch(
          `https://api.apify.com/v2/datasets/${runData.data.defaultDatasetId}/items?token=${config.apify_key}&format=json&clean=true&limit=3`
        )
        const dsData = await dsRes.json()
        diagnostics.datasetItems = dsData.slice(0, 3)
        diagnostics.datasetCount = dsData.length
      }
    }
  } catch (e: any) {
    diagnostics.testRunError = e.message
  }

  return NextResponse.json(diagnostics, { status: 200 })
}
