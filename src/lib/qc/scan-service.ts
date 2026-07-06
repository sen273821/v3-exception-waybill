import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import { v2Client, V2UnavailableError } from '@/lib/v2-client'
import { evaluateQc, findOpenQcTicket } from '@/lib/qc/engine'
import {
  aggregateWaybill,
  generateScanCode,
  generateTicketNo,
  serializeSkuSummary,
} from '@/lib/utils'
import type { ScanInput } from '@/types'
import type { ScanRecord } from '@prisma/client'

export interface ScanResult {
  scanRecord: ScanRecord
  isNewTicket: boolean
  ticketNo?: string
  message: string
  fromCache?: boolean
}

export async function processScan(input: ScanInput): Promise<ScanResult> {
  // 1. 实时调用 V2 校验 SKU 归属
  let v2Order
  let fromCache = false
  try {
    const validateRes = await v2Client.validateSku(input.externalCode, input.skuCode)
    if (!validateRes.valid || !validateRes.order) {
      throw new Error(`SKU ${input.skuCode} 不属于运单 ${input.externalCode}`)
    }
    v2Order = validateRes.order
  } catch (error) {
    if (error instanceof V2UnavailableError) {
      // V2 不可用时，尝试用本地快照兜底
      const snapshot = await db.waybillSnapshot.findFirst({
        where: { externalCode: input.externalCode },
        orderBy: { lastSyncAt: 'desc' },
      })
      if (!snapshot) {
        throw new Error('V2 服务不可用，且无本地快照，无法完成校验')
      }
      const summary = JSON.parse(snapshot.skuSummary) as Array<{ skuCode: string }>
      if (!summary.some((item) => item.skuCode === input.skuCode)) {
        throw new Error(`SKU ${input.skuCode} 不在本地快照中`)
      }
      fromCache = true
      v2Order = {
        id: snapshot.id,
        externalCode: snapshot.externalCode,
        storeName: snapshot.storeName ?? '',
        recipientName: snapshot.recipientName ?? '',
        recipientPhone: snapshot.recipientPhone ?? '',
        recipientAddress: snapshot.recipientAddress ?? '',
        skuCode: input.skuCode,
        skuName: '',
        skuQuantity: 0,
        skuSpec: '',
        remark: '',
        ruleId: '',
        createdAt: snapshot.createdAt.toISOString(),
      }
    } else {
      throw error
    }
  }

  // 2. 确保本地快照存在
  const snapshot = await upsertSnapshot(input.externalCode, v2Order, fromCache)

  // 3. 幂等性检查：同一运单+SKU 存在未关闭品控工单
  const existingHold = await findOpenQcTicket(input.externalCode, input.skuCode)
  if (existingHold) {
    const scanRecord = await db.scanRecord.create({
      data: {
        scanCode: generateScanCode(),
        externalCode: input.externalCode,
        skuCode: input.skuCode,
        result: 'hold',
        holdStatus: 'locked',
        ticketId: existingHold.ticketId,
        operatorId: input.operatorId,
        waybillSnapshotId: snapshot.id,
      },
    })
    return {
      scanRecord: scanRecord as unknown as ScanRecord,
      isNewTicket: false,
      ticketNo: existingHold.ticketId ?? undefined,
      message: '该批次已存在未关闭品控工单，已追加扫描记录',
      fromCache,
    }
  }

  // 4. 执行品控规则引擎
  const qcResult = await evaluateQc(input)

  if (qcResult.result === 'pass') {
    const scanRecord = await db.scanRecord.create({
      data: {
        scanCode: generateScanCode(),
        externalCode: input.externalCode,
        skuCode: input.skuCode,
        result: 'pass',
        operatorId: input.operatorId,
        waybillSnapshotId: snapshot.id,
      },
    })
    return {
      scanRecord: scanRecord as unknown as ScanRecord,
      isNewTicket: false,
      message: '品控检测通过',
      fromCache,
    }
  }

  // 5. 异常：创建工单 + 锁定批次
  const ticketNo = generateTicketNo()
  const ticket = await db.ticket.create({
    data: {
      ticketNo,
      source: 'scan',
      type: 'qc',
      subType: qcResult.subType ?? 'quantity_mismatch',
      status: 'pending',
      externalCode: input.externalCode,
      waybillSnapshotId: snapshot.id,
      amount: 0,
      description: qcResult.reason ?? '扫描触发品控异常',
      reporterId: input.operatorId,
      currentLevel: 0,
    },
  })

  const scanRecord = await db.scanRecord.create({
    data: {
      scanCode: generateScanCode(),
      externalCode: input.externalCode,
      skuCode: input.skuCode,
      result: 'hold',
      holdStatus: 'locked',
      qcRuleId: qcResult.ruleId,
      ticketId: ticket.id,
      operatorId: input.operatorId,
      waybillSnapshotId: snapshot.id,
    },
  })

  // 6. 回写 V2 异常标记（非阻塞）
  try {
    await v2Client.markException(input.externalCode, true)
  } catch (err) {
    console.warn('回写 V2 异常标记失败', err)
  }

  return {
    scanRecord: scanRecord as unknown as ScanRecord,
    isNewTicket: true,
    ticketNo,
    message: qcResult.reason ?? '品控异常，批次已锁定',
    fromCache,
  }
}

async function upsertSnapshot(externalCode: string, order: {
  storeName?: string
  recipientName?: string
  recipientPhone?: string
  recipientAddress?: string
  skuCode: string
  skuName?: string
  skuQuantity?: number
  skuSpec?: string
}, fromCache: boolean) {
  // 拉取完整运单明细（尽量）
  let orders: typeof order[] = [order]
  try {
    const list = await v2Client.getOrders({ externalCode, pageSize: '100' })
    orders = list.data
  } catch {
    // 如果失败就用传入的单条
  }

  const aggregated = aggregateWaybill(externalCode, orders as any)
  if (!aggregated) throw new Error('无法聚合运单信息')

  const existing = await db.waybillSnapshot.findFirst({
    where: { externalCode },
    orderBy: { lastSyncAt: 'desc' },
  })

  const data = {
    externalCode,
    storeName: aggregated.storeName,
    recipientName: aggregated.recipientName,
    recipientPhone: aggregated.recipientPhone,
    recipientAddress: aggregated.recipientAddress,
    totalAmount: aggregated.totalAmount,
    skuSummary: serializeSkuSummary(aggregated.skuSummary),
    syncStatus: fromCache ? ('stale' as const) : ('fresh' as const),
    lastSyncAt: new Date(),
    syncLogId: uuidv4(),
  }

  if (existing) {
    return db.waybillSnapshot.update({
      where: { id: existing.id },
      data,
    })
  }

  return db.waybillSnapshot.create({ data })
}
