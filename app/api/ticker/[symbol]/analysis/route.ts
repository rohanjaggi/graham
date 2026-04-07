import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { fetchLatestAnnualFilingExcerpt } from '@/lib/sec/edgar'

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const sym = symbol.toUpperCase()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fKey = process.env.FINNHUB_API_KEY
  if (!fKey) return NextResponse.json({ error: 'Missing FINNHUB_API_KEY' }, { status: 500 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })

  const base = 'https://finnhub.io/api/v1'
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - 30)
  const toStr = today.toISOString().split('T')[0]
  const fromStr = from.toISOString().split('T')[0]

  const [profileRes, metricsRes, newsRes, secText] = await Promise.all([
    fetch(`${base}/stock/profile2?symbol=${sym}&token=${fKey}`, { next: { revalidate: 3600 } }).then((r) => r.json()).catch(() => ({})),
    fetch(`${base}/stock/metric?symbol=${sym}&metric=all&token=${fKey}`, { next: { revalidate: 3600 } }).then((r) => r.json()).catch(() => ({})),
    fetch(`${base}/company-news?symbol=${sym}&from=${fromStr}&to=${toStr}&token=${fKey}`, { next: { revalidate: 900 } }).then((r) => r.json()).catch(() => []),
    fetchLatestAnnualFilingExcerpt(sym, 6000),
  ])

  if (!profileRes?.name) {
    return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })
  }

  const metrics = metricsRes?.metric ?? {}
  const recentNews = Array.isArray(newsRes)
    ? newsRes.slice(0, 8).map((n: { headline: string; source: string }) => `- ${n.headline} (${n.source})`).join('\n')
    : ''

  const contextBlock = `
COMPANY: ${profileRes.name} (${sym})
SECTOR: ${profileRes.finnhubIndustry ?? '—'} | EXCHANGE: ${profileRes.exchange ?? '—'}
MARKET CAP: ${profileRes.marketCapitalization ? `$${(profileRes.marketCapitalization / 1000).toFixed(1)}B` : '—'}

KEY METRICS:
- P/E (TTM): ${metrics.peTTM ?? metrics.peBasicExclExtraTTM ?? '—'}
- EV/EBITDA: ${metrics.evEbitdaTTM ?? '—'}
- ROE (TTM): ${metrics.roeTTM != null ? `${metrics.roeTTM.toFixed(1)}%` : '—'}
- Revenue Growth YoY: ${metrics.revenueGrowthTTMYoy != null ? `${metrics.revenueGrowthTTMYoy.toFixed(1)}%` : '—'}
- Gross Margin: ${metrics.grossMarginTTM != null ? `${metrics.grossMarginTTM.toFixed(1)}%` : '—'}
- Debt/Equity: ${metrics['totalDebt/totalEquityAnnual'] ?? '—'}
- Dividend Yield: ${metrics.dividendYieldIndicatedAnnual != null ? `${metrics.dividendYieldIndicatedAnnual.toFixed(2)}%` : 'None'}
- 52W Return: ${metrics['52WeekPriceReturnDaily'] != null ? `${metrics['52WeekPriceReturnDaily'].toFixed(1)}%` : '—'}

RECENT NEWS (last 30 days):
${recentNews || 'No recent news available.'}

${secText ? `10-K EXCERPT (most recent annual report):\n${secText}` : '10-K: Not available.'}
`.trim()

  let completion
  try {
    completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a senior equity research analyst at a top-tier investment bank.
Analyse the company data provided and return a JSON object with this exact shape:
{
  "moat": "Wide" | "Narrow" | "None",
  "moatReasoning": "1-2 sentence explanation",
  "bullThesis": ["point 1", "point 2", "point 3"],
  "bearThesis": ["point 1", "point 2", "point 3"],
  "keyRisks": ["risk 1", "risk 2", "risk 3"],
  "managementSignals": "2-3 sentences on capital allocation, insider activity signals, or strategic clarity",
  "verdict": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell",
  "verdictReasoning": "2-3 sentence investment summary at current valuation",
  "qualityScore": <integer 1-10>
}
Be specific and data-driven. Reference actual metrics where relevant. Do not hallucinate facts not present in the data.`,
        },
        { role: 'user', content: contextBlock },
      ],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OpenAI request failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const raw = completion.choices[0].message.content ?? '{}'
  let analysis
  try {
    analysis = JSON.parse(raw)
  } catch {
    analysis = { error: 'Failed to parse analysis' }
  }

  return NextResponse.json({ symbol: sym, name: profileRes.name, analysis })
}
