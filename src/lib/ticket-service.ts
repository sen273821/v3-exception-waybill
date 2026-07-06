import { db } from '@/lib/db'
import type { TicketInput, TicketType, TicketStatus, LogisticsSubType } from '@/types'
import { v2Client, V2UnavailableError } from '@/lib/v2-client'
import { aggregateWaybill, generateTicketNo, serializeSkuSummary } from '@/lib/utils'

export async function createTicket(input: TicketInput) {
  // 1. 实时校验运单存在
  let orders = []
  let fromCache = false
  try {
    const list = await v2Client.getOrders({ externalCode: input.externalCode, pageSize: '100' })
    orders = list.data
    if (orders.length === 0) {
      throw new Error(`运单 ${input.externalCode} 不存在`)
    }
  } catch (error) {
    if (error instanceof V2UnavailableError) {
      const snapshot = await db.waybillSnapshot.findFirst({
        where: { externalCode: input.externalCode },
        orderBy: { lastSyncAt: 'desc' },
      })
      if (!snapshot) {
        throw new Error('V2 服务不可用且无本地快照，无法校验运单')
      }
      fromCache = true
      orders = [{
        externalCode: snapshot.externalCode,
        storeName: snapshot.storeName,
        recipientName: snapshot.recipientName,
        recipientPhone: snapshot.recipientPhone,
        recipientAddress: snapshot.recipientAddress,
        skuCode: '',
        skuName: '',
        skuQuantity: 0,
        skuSpec: '',
        remark: '',
        ruleId: '',
        createdAt: snapshot.createdAt.toISOString(),
      }]
    } else {
      throw error
    }
  }

  // 2. 同类型未关闭工单重复校验
  const existing = await db.ticket.findFirst({
    where: {
      externalCode: input.externalCode,
      type: input.type,
      subType: input.subType,
      status: { notIn: ['completed', 'rejected', 'closed'] },
    },
  })
  if (existing) {
    throw new Error(`已存在未关闭的同类工单：${existing.ticketNo}，状态：${existing.status}`)
  }

  // 3. 更新快照
  const aggregated = aggregateWaybill(input.externalCode, orders as any)
  let snapshot = await db.waybillSnapshot.findFirst({
    where: { externalCode: input.externalCode },
    orderBy: { lastSyncAt: 'desc' },
  })

  if (snapshot) {
    snapshot = await db.waybillSnapshot.update({
      where: { id: snapshot.id },
      data: {
        totalAmount: aggregated?.totalAmount ?? snapshot.totalAmount,
        skuSummary: serializeSkuSummary(aggregated?.skuSummary ?? []),
        syncStatus: fromCache ? 'stale' : 'fresh',
        lastSyncAt: new Date(),
      },
    })
  } else {
    if (!aggregated) throw new Error('无法聚合运单信息')
    snapshot = await db.waybillSnapshot.create({
      data: {
        externalCode: input.externalCode,
        storeName: aggregated.storeName,
        recipientName: aggregated.recipientName,
        recipientPhone: aggregated.recipientPhone,
        recipientAddress: aggregated.recipientAddress,
        totalAmount: aggregated.totalAmount,
        skuSummary: serializeSkuSummary(aggregated.skuSummary),
        syncStatus: fromCache ? 'stale' : 'fresh',
        lastSyncAt: new Date(),
      },
    })
  }

  // 4. 创建工单
  const ticketNo = generateTicketNo()
  const ticket = await db.ticket.create({
    data: {
      ticketNo,
      source: 'manual',
      type: input.type as TicketType,
      subType: input.subType,
      status: 'pending',
      externalCode: input.externalCode,
      waybillSnapshotId: snapshot.id,
      amount: input.amount,
      description: input.description,
      reporterId: input.reporterId,
      currentLevel: 0,
    },
  })

  // 5. 回写 V2 异常标记
  try {
    await v2Client.markException(input.externalCode, true)
  } catch (err) {
    console.warn('回写 V2 异常标记失败', err)
  }

  return ticket
}
