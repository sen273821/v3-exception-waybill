import { db } from '@/lib/db'
import type { ApprovalInput } from '@/types'
import { addHours } from '@/lib/utils'
import { v2Client } from '@/lib/v2-client'

const STATUS_MAP: Record<number, string> = {
  0: 'pending',
  1: 'l1_approval',
  2: 'l2_approval',
}

export async function submitApproval(input: ApprovalInput) {
  const result = await db.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: input.ticketId } })
    if (!ticket) throw new Error('工单不存在')

    // 权限与状态校验
    if (input.action === 'release') {
      const user = await tx.user.findUnique({ where: { id: input.approverId } })
      if (user?.role !== 'qc_manager' && user?.role !== 'admin') {
        throw new Error('只有品控主管可执行快速放行')
      }
      if (ticket.type !== 'qc') throw new Error('快速放行仅适用于品控工单')
    } else {
      if (ticket.reporterId === input.approverId) throw new Error('不能审批自己上报的工单')
      const expectedStatus = STATUS_MAP[ticket.currentLevel]
      if (ticket.status !== expectedStatus) throw new Error(`工单当前状态为 ${ticket.status}，无法审批`)
    }

    // 幂等：防止重复审批记录（同一 ticket + approver + action 在 5 秒内只接受一次）
    const recent = await tx.approvalRecord.findFirst({
      where: {
        ticketId: input.ticketId,
        approverId: input.approverId,
        action: input.action,
        createdAt: { gte: new Date(Date.now() - 5000) },
      },
    })
    if (recent) throw new Error('操作过于频繁，请稍后再试')

    // 创建审批记录
    const record = await tx.approvalRecord.create({
      data: {
        ticketId: input.ticketId,
        approverId: input.approverId,
        level: ticket.currentLevel,
        action: input.action,
        comment: input.comment,
      },
    })

    let nextStatus: string = ticket.status
    let nextLevel = ticket.currentLevel
    let executedAction: string | undefined

    if (input.action === 'reject') {
      if (ticket.resubmitCount >= ticket.maxResubmitCount) {
        nextStatus = 'closed'
      } else {
        nextStatus = 'pending'
        nextLevel = 0
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { resubmitCount: { increment: 1 } },
        })
      }
    } else if (input.action === 'approve') {
      // 查询当前层级对应的审批规则（不限制 maxAmount，用于判断是否需要升级）
      const rule = await tx.approvalRule.findFirst({
        where: {
          level: ticket.currentLevel + 1,
          exceptionType: ticket.type,
          isActive: true,
          minAmount: { lte: ticket.amount },
        },
        orderBy: { level: 'asc' },
      })

      if (rule && rule.level === 1) {
        // 金额超阈值需要二级审批
        if (rule.maxAmount != null && ticket.amount > rule.maxAmount) {
          nextStatus = 'l2_approval'
          nextLevel = 2
        } else {
          nextStatus = 'executing'
          nextLevel = 1
          executedAction = await executeAction(tx, ticket, record.id)
        }
      } else if (rule && rule.level === 2) {
        nextStatus = 'executing'
        nextLevel = 2
        executedAction = await executeAction(tx, ticket, record.id)
      } else {
        nextStatus = 'executing'
        nextLevel = ticket.currentLevel + 1
        executedAction = await executeAction(tx, ticket, record.id)
      }
    } else if (input.action === 'release') {
      // 快速放行：直接完成
      nextStatus = 'completed'
      nextLevel = ticket.currentLevel
      executedAction = 'release'
      await tx.scanRecord.updateMany({
        where: { ticketId: ticket.id },
        data: { holdStatus: 'released', releasedAt: new Date() },
      })
    }

    // 更新工单状态（并发控制：只有状态未变时才更新）
    const updated = await tx.ticket.updateMany({
      where: { id: ticket.id, status: ticket.status },
      data: {
        status: nextStatus,
        currentLevel: nextLevel,
        currentAssigneeId: null,
        executedAction,
      },
    })

    if (updated.count === 0) {
      throw new Error('该工单已被他人处理，请刷新后重试')
    }

    return { record, nextStatus, executedAction, externalCode: ticket.externalCode }
  })

  // 如果工单完成，回写 V2 异常标记为 false（放在事务外，避免网络调用阻塞 DB 事务）
  if (result.nextStatus === 'completed' || result.nextStatus === 'closed') {
    try {
      await v2Client.markException(result.externalCode, false)
    } catch (err) {
      console.warn('回写 V2 异常标记失败', err)
    }
  }

  return result
}

async function executeAction(tx: any, ticket: any, approvalRecordId: string): Promise<string> {
  const action = resolveAction(ticket)

  if (action === 'compensate_customer' || action === 'compensate_supplier' || action === 'return_inventory') {
    await tx.paymentRecord.create({
      data: {
        ticketId: ticket.id,
        approvalRecordId,
        amount: ticket.amount,
        direction: ticket.type === 'logistics' ? 'customer_compensate' : 'supplier_recover',
        status: 'pending',
      },
    })
  }

  if (action === 'return_inventory' || action === 'reorder' || action === 'downgrade') {
    // 库存流水：记录变更，不维护实时库存
    await tx.inventoryLog.create({
      data: {
        ticketId: ticket.id,
        approvalRecordId,
        skuCode: ticket.subType,
        changeType: action === 'return_inventory' ? 'inbound' : 'scrap',
        quantity: 0,
        note: `执行动作：${action}`,
      },
    })
  }

  // 解锁品控批次
  if (ticket.type === 'qc') {
    await tx.scanRecord.updateMany({
      where: { ticketId: ticket.id },
      data: { holdStatus: 'released', releasedAt: new Date() },
    })
  }

  return action
}

function resolveAction(ticket: any): string {
  if (ticket.type === 'logistics') {
    switch (ticket.subType) {
      case 'lost': return 'compensate_customer'
      case 'damaged': return 'compensate_customer'
      case 'rejected': return 'return_inventory'
      case 'timeout': return 'compensate_customer'
      case 'address_error': return 'reorder'
      default: return 'compensate_customer'
    }
  }

  // qc
  switch (ticket.subType) {
    case 'quantity_mismatch': return 'compensate_supplier'
    case 'broken': return 'return_inventory'
    case 'spec_mismatch': return 'return_inventory'
    case 'label_error': return 'downgrade'
    case 'batch_error': return 'reorder'
    default: return 'compensate_supplier'
  }
}

export async function processOverdueTickets() {
  const rules = await db.approvalRule.findMany({ where: { isActive: true } })
  const tickets = await db.ticket.findMany({
    where: {
      status: { in: ['pending', 'l1_approval', 'l2_approval'] },
    },
  })

  for (const ticket of tickets) {
    const rule = rules.find((r) => r.level === ticket.currentLevel || (ticket.currentLevel === 0 && r.level === 1))
    if (!rule) continue

    const deadline = addHours(ticket.createdAt, rule.timeoutHours)
    if (new Date() > deadline) {
      // 超时策略：pending 直接升二级，l1 升二级，l2 驳回
      if (ticket.status === 'pending' || ticket.status === 'l1_approval') {
        await db.ticket.update({
          where: { id: ticket.id },
          data: { status: 'l2_approval', currentLevel: 2 },
        })
      } else if (ticket.status === 'l2_approval') {
        await db.ticket.update({
          where: { id: ticket.id },
          data: { status: 'closed' },
        })
      }
    }
  }
}
