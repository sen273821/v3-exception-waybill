import type { V2Order } from '@/types'

export function aggregateWaybill(externalCode: string, orders: V2Order[]) {
  const lines = orders.filter((o) => o.externalCode === externalCode)
  if (lines.length === 0) return null

  const first = lines[0]
  const skuSummary = lines.map((line) => ({
    skuCode: line.skuCode,
    skuName: line.skuName,
    skuQuantity: line.skuQuantity,
    skuSpec: line.skuSpec,
  }))

  const totalAmount = skuSummary.reduce((sum, item) => {
    // 无法从 V2 获知单价，这里用数量作为金额占位
    return sum + (item.skuQuantity || 0)
  }, 0)

  return {
    externalCode,
    storeName: first.storeName,
    recipientName: first.recipientName,
    recipientPhone: first.recipientPhone,
    recipientAddress: first.recipientAddress,
    totalAmount,
    skuSummary,
  }
}

export function serializeSkuSummary(summary: Array<{ skuCode: string; skuName: string; skuQuantity: number; skuSpec?: string }>): string {
  return JSON.stringify(summary)
}

export function parseSkuSummary(raw: string): Array<{ skuCode: string; skuName: string; skuQuantity: number; skuSpec?: string }> {
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function generateTicketNo(): string {
  const prefix = 'EX'
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${ts}-${rand}`
}

export function generateScanCode(): string {
  return `SC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

export function isOverdue(deadline: Date): boolean {
  return new Date() > deadline
}
