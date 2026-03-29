import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/* ─── TYPES ──────────────────────────────────────────────────────────────── */

interface CompanyData {
  symbol: string
  name: string
  sector: string
  marketCap: number | null
  price: number | null
  pe: number | null
  pb: number | null
  evEbitda: number | null
  roe: number | null
  grossMargin: number | null
  revenueGrowth: number | null
  debtEquity: number | null
}

/* ─── FETCH COMPANY DATA ─────────────────────────────────────────────────── */

async function fetchCompanyData(sym: string, fKey: string): Promise<CompanyData | null> {
  const base = 'https://finnhub.io/api/v1'
  const [profileRes, quoteRes, metricsRes] = await Promise.allSettled([
    fetch(`${base}/stock/profile2?symbol=${sym}&token=${fKey}`, { next: { revalidate: 3600 } }).then(r => r.json()),
    fetch(`${base}/quote?symbol=${sym}&token=${fKey}`, { next: { revalidate: 60 } }).then(r => r.json()),
    fetch(`${base}/stock/metric?symbol=${sym}&metric=all&token=${fKey}`, { next: { revalidate: 3600 } }).then(r => r.json()),
  ])

  const profile = profileRes.status === 'fulfilled' ? profileRes.value : {}
  const quote   = quoteRes.status   === 'fulfilled' ? quoteRes.value   : {}
  const metrics = metricsRes.status === 'fulfilled' ? metricsRes.value?.metric ?? {} : {}

  if (!profile?.name) return null

  return {
    symbol: sym,
    name:          profile.name ?? sym,
    sector:        profile.finnhubIndustry ?? '—',
    marketCap:     profile.marketCapitalization ?? null,
    price:         quote.c ?? null,
    pe:            metrics['peNormalizedAnnual'] ?? metrics['peTTM'] ?? null,
    pb:            metrics['pbAnnual'] ?? metrics['pbQuarterly'] ?? null,
    evEbitda:      metrics['evEbitdaTTM'] ?? null,
    roe:           metrics['roeTTM'] ?? null,
    grossMargin:   metrics['grossMarginTTM'] ?? null,
    revenueGrowth: metrics['revenueGrowthTTMYoy'] ?? null,
    debtEquity:    metrics['totalDebt/totalEquityAnnual'] ?? null,
  }
}

/* ─── ROUTE ──────────────────────────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { symbol } = await params
  const sym = symbol.toUpperCase()

  const fKey = process.env.FINNHUB_API_KEY
  if (!fKey) return NextResponse.json({ error: 'Missing FINNHUB_API_KEY' }, { status: 500 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })

  /* ── Step A: fetch subject data + raw peer list in parallel ── */
  const [subjectData, peersRes] = await Promise.allSettled([
    fetchCompanyData(sym, fKey),
    fetch(`https://finnhub.io/api/v1/stock/peers?symbol=${sym}&token=${fKey}`, { next: { revalidate: 3600 } })
      .then(r => r.json())
      .then((d: unknown) => (Array.isArray(d) ? d.filter((s: unknown) => s !== sym).slice(0, 12) as string[] : [])),
  ])

  const subject = subjectData.status === 'fulfilled' ? subjectData.value : null
  if (!subject) return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })

  const rawPeerSymbols: string[] = peersRes.status === 'fulfilled' ? peersRes.value : []

  // Fetch basic profiles for raw peers (to give GPT names + sectors)
  const rawPeerProfiles = await Promise.allSettled(
    rawPeerSymbols.map(s =>
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${s}&token=${fKey}`, { next: { revalidate: 3600 } })
        .then(r => r.json())
        .then(d => ({ symbol: s, name: d?.name ?? s, sector: d?.finnhubIndustry ?? '—' }))
        .catch(() => ({ symbol: s, name: s, sector: '—' }))
    )
  )
  const rawPeerMeta = rawPeerProfiles
    .filter((r): r is PromiseFulfilledResult<{ symbol: string; name: string; sector: string }> => r.status === 'fulfilled')
    .map(r => r.value)

  /* ── Step B: OpenAI peer grading ── */
  type PeerAssessment = { symbol: string; score: number; keep: boolean; reason: string; aiAdded?: boolean }
  let aiInsights: {
    peerAssessments: PeerAssessment[]
    suggestedAdditions: string[]
    metricWeights: Record<string, { score: number; reason: string }>
    analystNote: string
  } | null = null

  const peerListText = rawPeerMeta.map(p => `${p.symbol} — ${p.name} (${p.sector})`).join('\n')

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You are a senior equity research analyst. Given a subject company and a list of Finnhub-sourced peers, your job is to:
1. Assess each peer for comparability (are they truly a close comp?)
2. Suggest up to 3 additional tickers that would be better comparables (only well-known public US equities)
3. Weight the most relevant valuation metrics for this specific company type
4. Write a short analyst note on the peer group

Return a JSON object with exactly this shape:
{
  "peerAssessments": [{ "symbol": string, "score": number (1-10), "keep": boolean, "reason": string }],
  "suggestedAdditions": string[],
  "metricWeights": {
    "pe":          { "score": number (1-10), "reason": string },
    "evEbitda":    { "score": number (1-10), "reason": string },
    "pb":          { "score": number (1-10), "reason": string },
    "grossMargin": { "score": number (1-10), "reason": string },
    "roe":         { "score": number (1-10), "reason": string }
  },
  "analystNote": string
}
Keep reasons concise (one sentence). Only suggest additions if you are confident they are public US equities with similar business models.`,
        },
        {
          role: 'user',
          content: `SUBJECT: ${subject.name} (${sym})
SECTOR: ${subject.sector}
MARKET CAP: ${subject.marketCap ? `$${(subject.marketCap / 1000).toFixed(1)}B` : '—'}
PROFITABLE: ${subject.pe != null && subject.pe > 0 ? 'Yes' : 'No/unclear'}
REVENUE GROWTH YOY: ${subject.revenueGrowth != null ? `${subject.revenueGrowth.toFixed(1)}%` : '—'}
GROSS MARGIN: ${subject.grossMargin != null ? `${subject.grossMargin.toFixed(1)}%` : '—'}

FINNHUB PEERS:
${peerListText || 'No peers returned.'}`,
        },
      ],
    })

    const raw = completion.choices[0].message.content ?? '{}'
    aiInsights = JSON.parse(raw)
  } catch {
    // If AI fails, fall back to all raw peers unfiltered
    aiInsights = null
  }

  /* ── Step C: assemble final peer set and fetch their full data ── */
  let finalPeerSymbols: string[]

  if (aiInsights) {
    const kept = aiInsights.peerAssessments.filter(p => p.keep).map(p => p.symbol)
    const added = aiInsights.suggestedAdditions ?? []
    // Mark AI-added peers in assessments for client transparency
    for (const sym of added) {
      if (!aiInsights.peerAssessments.find(p => p.symbol === sym)) {
        aiInsights.peerAssessments.push({ symbol: sym, score: 8, keep: true, reason: 'Suggested by Graham as a closer comparable', aiAdded: true })
      }
    }
    finalPeerSymbols = [...new Set([...kept, ...added])].slice(0, 8)
  } else {
    finalPeerSymbols = rawPeerSymbols.slice(0, 8)
  }

  const peerResults = await Promise.allSettled(
    finalPeerSymbols.map(s => fetchCompanyData(s, fKey))
  )
  const peers = peerResults
    .filter((r): r is PromiseFulfilledResult<CompanyData> => r.status === 'fulfilled' && r.value != null)
    .map(r => r.value)

  return NextResponse.json({ subject, peers, aiInsights })
}
