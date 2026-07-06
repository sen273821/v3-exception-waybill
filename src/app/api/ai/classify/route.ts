import { NextRequest, NextResponse } from 'next/server'
import { suggestQcSubType } from '@/lib/ai-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await suggestQcSubType(String(body.description ?? ''))
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { aiSuggestion: false, error: error instanceof Error ? error.message : 'AI 推荐失败' },
      { status: 200 },
    )
  }
}
