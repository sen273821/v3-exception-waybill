import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { operatorId, releaseReason } = body

    const scan = await db.scanRecord.findUnique({
      where: { id },
      include: { ticket: true },
    })

    if (!scan || !scan.ticket) {
      return NextResponse.json({ error: '扫描记录或关联工单不存在' }, { status: 404 })
    }

    const user = await db.user.findUnique({ where: { id: operatorId } })
    if (!user || (user.role !== 'qc_manager' && user.role !== 'admin')) {
      return NextResponse.json({ error: '只有品控主管可执行快速放行' }, { status: 403 })
    }

    await db.$transaction(async (tx) => {
      await tx.scanRecord.update({
        where: { id },
        data: {
          result: 'released',
          holdStatus: 'released',
          releaseReason: String(releaseReason ?? ''),
          releasedAt: new Date(),
        },
      })

      await tx.ticket.update({
        where: { id: scan.ticketId! },
        data: { status: 'completed', executedAction: 'release' },
      })

      await tx.approvalRecord.create({
        data: {
          ticketId: scan.ticketId!,
          approverId: operatorId,
          level: 0,
          action: 'release',
          comment: `品控主管快速放行：${releaseReason}`,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('快速放行失败', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '快速放行失败' },
      { status: 500 },
    )
  }
}
