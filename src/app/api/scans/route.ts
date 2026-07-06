import { NextRequest, NextResponse } from 'next/server'
import { processScan } from '@/lib/qc/scan-service'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await processScan({
      externalCode: String(body.externalCode ?? '').trim(),
      skuCode: String(body.skuCode ?? '').trim(),
      scanCode: String(body.scanCode ?? '').trim(),
      description: String(body.description ?? ''),
      operatorId: String(body.operatorId ?? '').trim(),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('扫描录入失败', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '扫描录入失败' },
      { status: 400 },
    )
  }
}

export async function GET() {
  try {
    const records = await db.scanRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { ticket: true, operator: { select: { name: true, role: true } }, qcRule: true },
    })
    return NextResponse.json(records)
  } catch (error) {
    console.error('获取扫描记录失败', error)
    return NextResponse.json({ error: '获取扫描记录失败' }, { status: 500 })
  }
}
