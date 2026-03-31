import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getQualitativeAnalysis, QaServiceError, QA_CACHE_TTL_SECONDS } from '@/lib/qa/service'
import { qaRequestSchema } from '@/lib/qa/contracts'

async function handleTickerLookup(payload: unknown) {
  const parsed = qaRequestSchema.parse(payload)
  const data = await getQualitativeAnalysis(parsed.ticker)

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': `private, max-age=0, s-maxage=${QA_CACHE_TTL_SECONDS}`,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const ticker = request.nextUrl.searchParams.get('ticker')
    return await handleTickerLookup({ ticker })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid ticker.' }, { status: 400 })
    }
    if (error instanceof QaServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Qualitative analysis is currently unavailable.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    return await handleTickerLookup(body)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid ticker.' }, { status: 400 })
    }
    if (error instanceof QaServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Qualitative analysis is currently unavailable.' }, { status: 500 })
  }
}
