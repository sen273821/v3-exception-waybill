import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ticket = await db.ticket.findUnique({
      where: { id },
      include: {
        reporter: { select: { name: true, role: true } },
        waybillSnapshot: true,
        approvals: { include: { approver: { select: { name: true, role: true } } }, orderBy: { createdAt: 'desc' } },
        payments: true,
        inventoryLogs: true,
        scanRecords: { include: { qcRule: true } },
      },
    })

    if (!ticket) return NextResponse.json({ error: '工单不存在' }, { status: 404 })
    return NextResponse.json(ticket)
  } catch (error) {
    console.error('获取工单详情失败', error)
    return NextResponse.json({ error: '获取工单详情失败' }, { status: 500 })
  }
}
