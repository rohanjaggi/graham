import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

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
  evRevenue: number | null
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
    evRevenue:     metrics['evSalesAnnual'] ?? metrics['evSalesTTM'] ?? metrics['psTTM'] ?? null,
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
    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `You are a senior equity research analyst conducting a comparable companies analysis.

Score each Finnhub-sourced peer on a 1–10 scale using these five criteria (equal weight):
1. Industry & Sector alignment — same industry, similar regulatory environment
2. Size & Scale — comparable revenue, market cap, and operational scale
3. Geographic Focus — similar regional exposure and market conditions
4. Growth Prospects — similar revenue growth trajectory and market opportunity
5. Business Model — similar product/service mix, unit economics, and margin structure

A score of 5 is the minimum threshold for a peer to be considered a valid comparable. Any peer scoring below 5 must be replaced.

For every peer that scores below 5, you MUST suggest a replacement ticker in "suggestedAdditions" that scores at least 7 across the five criteria above. Replacements must be well-known public US equities. Do not add replacements for peers that score 5 or above.

Return a JSON object with exactly this shape:
{
  "peerAssessments": [{ "symbol": string, "score": number (1-10), "keep": boolean, "reason": string }],
  "suggestedAdditions": string[],
  "metricWeights": {
    "pe":          { "score": number (1-10), "reason": string },
    "evEbitda":    { "score": number (1-10), "reason": string },
    "pb":          { "score": number (1-10), "reason": string },
    "evRevenue":   { "score": number (1-10), "reason": string },
    "grossMargin": { "score": number (1-10), "reason": string },
    "roe":         { "score": number (1-10), "reason": string }
  },
  "analystNote": string
}
Set "keep": true for scores >= 5, "keep": false for scores < 5. Keep reasons concise (one sentence citing which criteria failed or passed). NEVER include the subject company itself in suggestedAdditions.`,
        },
        {
          role: 'user',
          content: `SUBJECT: ${subject.name} (${sym})
SECTOR: ${subject.sector}
MARKET CAP: ${subject.marketCap ? `$${(subject.marketCap / 1000).toFixed(1)}B` : '—'}
PROFITABLE: ${subject.pe != null && subject.pe > 0 ? 'Yes' : 'No/unclear'}
REVENUE GROWTH YOY: ${subject.revenueGrowth != null ? `${subject.revenueGrowth.toFixed(1)}%` : '—'}
GROSS MARGIN: ${subject.grossMargin != null ? `${subject.grossMargin.toFixed(1)}%` : '—'}
DEBT/EQUITY: ${subject.debtEquity != null ? subject.debtEquity.toFixed(2) : '—'}

FINNHUB PEERS (assess each against the 5 criteria):
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
    // Hard threshold: score < 5 is always dropped, regardless of the keep field GPT returned
    for (const p of aiInsights.peerAssessments) {
      p.keep = p.score >= 5
    }
    const kept = aiInsights.peerAssessments.filter(p => p.keep).map(p => p.symbol)
    const added = (aiInsights.suggestedAdditions ?? []).filter(s => s !== sym)
    // Mark AI-added peers in assessments for client transparency
    for (const sym of added) {
      if (!aiInsights.peerAssessments.find(p => p.symbol === sym)) {
        aiInsights.peerAssessments.push({ symbol: sym, score: 8, keep: true, reason: 'Suggested as replacement for a below-threshold Finnhub peer', aiAdded: true })
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
