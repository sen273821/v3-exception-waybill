import { NextRequest, NextResponse } from 'next/server'
import { submitApproval } from '@/lib/approval-service'
import { suggestApprovalOpinion } from '@/lib/ai-service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const result = await submitApproval({
      ticketId: id,
      action: body.action,
      comment: String(body.comment ?? ''),
      approverId: String(body.approverId ?? '').trim(),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('审批失败', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '审批失败' },
      { status: 400 },
    )
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await suggestApprovalOpinion(id)
    return NextResponse.json({ ...result, aiSuggestion: true })
  } catch (error) {
    // AI 失败不阻塞主流程
    return NextResponse.json(
      { aiSuggestion: false, error: error instanceof Error ? error.message : 'AI 建议失败' },
      { status: 200 },
    )
  }
}
