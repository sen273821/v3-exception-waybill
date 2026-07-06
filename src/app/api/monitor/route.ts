import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { processOverdueTickets } from '@/lib/approval-service'

export async function POST() {
  try {
    await processOverdueTickets()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('处理超时工单失败', error)
    return NextResponse.json({ error: '处理超时工单失败' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const logs = await db.syncLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const total = await db.syncLog.count()
    const success = await db.syncLog.count({ where: { success: true } })
    const latest = logs[0]

    return NextResponse.json({
      latestSyncAt: latest?.createdAt ?? null,
      successRate: total > 0 ? success / total : 1,
      totalCalls: total,
      recentLogs: logs,
    })
  } catch (error) {
    console.error('获取同步日志失败', error)
    return NextResponse.json({ error: '获取同步日志失败' }, { status: 500 })
  }
}
