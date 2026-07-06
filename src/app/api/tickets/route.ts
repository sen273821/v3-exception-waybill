import { NextRequest, NextResponse } from 'next/server'
import { createTicket } from '@/lib/ticket-service'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const ticket = await createTicket({
      externalCode: String(body.externalCode ?? '').trim(),
      type: body.type,
      subType: String(body.subType ?? '').trim(),
      amount: Number(body.amount ?? 0),
      description: String(body.description ?? ''),
      reporterId: String(body.reporterId ?? '').trim(),
    })

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error('创建工单失败', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建工单失败' },
      { status: 400 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? ''
    const type = searchParams.get('type') ?? ''
    const externalCode = searchParams.get('externalCode') ?? ''
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10) || 20))

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (type) where.type = type
    if (externalCode) where.externalCode = { contains: externalCode }

    const [data, total] = await Promise.all([
      db.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          reporter: { select: { name: true, role: true } },
          waybillSnapshot: true,
        },
      }),
      db.ticket.count({ where }),
    ])

    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (error) {
    console.error('获取工单列表失败', error)
    return NextResponse.json({ error: '获取工单列表失败' }, { status: 500 })
  }
}
