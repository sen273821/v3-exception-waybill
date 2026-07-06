import OpenAI from 'openai'
import { db } from '@/lib/db'

const MODEL_NAME = 'deepseek-chat'
const BASE_URL = 'https://api.deepseek.com'

export async function suggestQcSubType(description: string): Promise<{
  subType: string
  severity: string
  confidence: number
  explanation: string
}> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY 未配置')
  }

  const client = new OpenAI({ apiKey, baseURL: BASE_URL })

  const prompt = [
    '你是仓库品控助手。根据以下扫描异常描述，从 [quantity_mismatch, broken, spec_mismatch, label_error, batch_error] 中推荐品控异常子类型，',
    '并给出严重度 [low, medium, high, critical]、置信度 0-1、以及判断依据。',
    '必须返回 JSON：{ subType, severity, confidence, explanation }',
    `描述：${description}`,
  ].join('\n')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  try {
    const response = await client.chat.completions.create(
      {
        model: MODEL_NAME,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '你是品控分类助手，只能返回 JSON。' },
          { role: 'user', content: prompt },
        ],
      },
      { signal: controller.signal },
    )
    clearTimeout(timeout)

    const raw = response.choices[0]?.message?.content?.trim() ?? '{}'
    const parsed = JSON.parse(raw)
    return {
      subType: String(parsed.subType || 'quantity_mismatch'),
      severity: String(parsed.severity || 'medium'),
      confidence: Number(parsed.confidence ?? 0.5),
      explanation: String(parsed.explanation || 'AI 建议，需人工确认'),
    }
  } catch {
    throw new Error('AI 推荐失败')
  }
}

export async function suggestApprovalOpinion(ticketId: string): Promise<{
  opinion: string
  references: Array<{ id: string; summary: string }>
  confidence: number
}> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY 未配置')

  // 查找相似历史审批记录
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) throw new Error('工单不存在')

  const history = await db.approvalRecord.findMany({
    where: {
      ticket: { type: ticket.type, subType: ticket.subType },
      action: 'approve',
    },
    include: { ticket: true, approver: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  const refs = history.map((h) => ({
    id: h.id,
    summary: `审批人 ${h.approver.name} 于 ${h.createdAt.toISOString()} 审批通过，意见：${h.comment}`,
  }))

  const client = new OpenAI({ apiKey, baseURL: BASE_URL })

  const prompt = [
    '你是异常审批助手。根据以下当前工单信息和历史审批记录，给出建议审批意见。',
    '返回 JSON：{ opinion, confidence }。references 已由系统提供，无需在 JSON 中重复。',
    `当前工单类型：${ticket.type}，子类型：${ticket.subType}，金额：${ticket.amount}，描述：${ticket.description}`,
    `历史审批记录：${JSON.stringify(refs)}`,
  ].join('\n')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  try {
    const response = await client.chat.completions.create(
      {
        model: MODEL_NAME,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '你是审批建议助手，只能返回 JSON。' },
          { role: 'user', content: prompt },
        ],
      },
      { signal: controller.signal },
    )
    clearTimeout(timeout)

    const raw = response.choices[0]?.message?.content?.trim() ?? '{}'
    const parsed = JSON.parse(raw)
    return {
      opinion: String(parsed.opinion || '建议通过'),
      references: refs,
      confidence: Number(parsed.confidence ?? 0.5),
    }
  } catch {
    throw new Error('AI 建议生成失败')
  }
}
