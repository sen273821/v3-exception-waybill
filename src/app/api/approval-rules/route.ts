import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const rules = await db.approvalRule.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(rules)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rule = await db.approvalRule.create({ data: body })
    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建失败' },
      { status: 400 },
    )
  }
}
