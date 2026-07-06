import type { QcRuleConfig, QcSubType, ScanInput } from '@/types'
import { db } from '@/lib/db'
import type { ScanRecord, QcRule } from '@prisma/client'

export interface QcEvaluationResult {
  result: 'pass' | 'hold'
  ruleId?: string
  subType?: QcSubType
  severity?: string
  reason?: string
}

export async function evaluateQc(input: ScanInput): Promise<QcEvaluationResult> {
  const rules = await db.qcRule.findMany({ where: { isActive: true }, orderBy: { severity: 'asc' } })

  for (const rule of rules) {
    const matched = matchRule(rule, input)
    if (matched) {
      return {
        result: 'hold',
        ruleId: rule.id,
        subType: rule.subType as QcSubType,
        severity: rule.severity,
        reason: `命中品控规则：${rule.name}`,
      }
    }
  }

  return { result: 'pass' }
}

function matchRule(rule: QcRule, input: ScanInput): boolean {
  // 数量差异示例：description 中包含 "数量差异:30" 表示差异 30%
  if (rule.conditionType === 'quantity_diff_pct' && rule.threshold != null) {
    const match = input.description?.match(/数量差异[:：]\s*(\d+)/)
    if (match) {
      const diff = Number.parseInt(match[1], 10)
      return diff >= rule.threshold
    }
  }

  // 破损等级示例：description 中包含 "破损等级:2"
  if (rule.conditionType === 'damage_level' && rule.threshold != null) {
    const match = input.description?.match(/破损等级[:：]\s*(\d+)/)
    if (match) {
      const level = Number.parseInt(match[1], 10)
      return level >= rule.threshold
    }
  }

  // 文本匹配示例：description 中包含规则名关键字
  if (rule.conditionType === 'text_match') {
    return input.description?.includes(rule.name) ?? false
  }

  return false
}

export async function findOpenQcTicket(externalCode: string, skuCode: string): Promise<ScanRecord | null> {
  return db.scanRecord.findFirst({
    where: {
      externalCode,
      skuCode,
      result: 'hold',
      holdStatus: 'locked',
      ticketId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  })
}
