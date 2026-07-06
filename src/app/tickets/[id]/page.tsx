'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2, MessageSquare, AlertTriangle, ArrowLeft } from 'lucide-react'
import ToastStack, { type ToastItem, type ToastTone } from '@/components/ToastStack'

const STATUS_LABELS: Record<string, string> = {
  pending: '待审批',
  l1_approval: '一级审批中',
  l2_approval: '二级审批中',
  executing: '执行中',
  completed: '已完成',
  rejected: '已拒绝',
  closed: '已关闭',
}

export default function TicketDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState<any>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const pushToast = useCallback((title: string, description?: string, tone: ToastTone = 'info') => {
    const toastId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    setToasts((prev) => [...prev, { id: toastId, title, description, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toastId)), 4000)
  }, [])

  const loadTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${id}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      setTicket(body)
    } catch (err) {
      pushToast('加载工单详情失败', (err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [id, pushToast])

  useEffect(() => {
    loadTicket()
  }, [loadTicket])

  const fetchAiSuggestion = async () => {
    try {
      const res = await fetch(`/api/tickets/${id}/approve`)
      const body = await res.json()
      if (body.aiSuggestion) setAiSuggestion(body)
    } catch {
      // AI 失败不阻塞
    }
  }

  const handleApprove = async (action: 'approve' | 'reject') => {
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('v3-user') ?? '{}') : {}
    try {
      const res = await fetch(`/api/tickets/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment, approverId: user.id || 'reporter-id' }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || '审批失败')
      pushToast(action === 'approve' ? '审批通过' : '已拒绝', body.nextStatus ? `新状态：${STATUS_LABELS[body.nextStatus] ?? body.nextStatus}` : undefined, action === 'approve' ? 'success' : 'info')
      setComment('')
      loadTicket()
    } catch (err) {
      pushToast('审批失败', (err as Error).message, 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    )
  }

  if (!ticket) return null

  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('v3-user') ?? '{}') : {}
  const canApprove = ['pending', 'l1_approval', 'l2_approval'].includes(ticket.status) && ticket.reporterId !== user.id
  const isQcManager = user.role === 'qc_manager' || user.role === 'admin'

  return (
    <>
      <button type="button" className="ui-button ui-button-secondary mb-4" onClick={() => router.push('/tickets')}>
        <ArrowLeft className="h-4 w-4" /> 返回列表
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="ui-card lg:col-span-2">
          <div className="ui-card-header">
            <div>
              <div className="ui-title">工单 {ticket.ticketNo}</div>
              <div className="ui-subtitle">来源：{ticket.source === 'scan' ? '扫描触发' : '手工上报'} · 类型：{ticket.type === 'qc' ? '品控异常' : '物流异常'}</div>
            </div>
            <span className={`ui-badge ${
              ticket.status === 'completed' ? 'bg-green-100 text-green-700' :
              ticket.status === 'closed' ? 'bg-gray-100 text-gray-700' :
              ticket.status === 'rejected' ? 'bg-red-100 text-red-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {STATUS_LABELS[ticket.status] ?? ticket.status}
            </span>
          </div>
          <div className="ui-card-body space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-[var(--text-muted)]">运单号</div>
                <div className="font-medium">{ticket.externalCode}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">异常金额</div>
                <div className="font-medium">¥{ticket.amount.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">上报人</div>
                <div className="font-medium">{ticket.reporter?.name}（{ticket.reporter?.role}）</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">当前层级</div>
                <div className="font-medium">{ticket.currentLevel === 0 ? '待分配' : `L${ticket.currentLevel}`}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">异常描述</div>
              <div className="mt-1 rounded-lg bg-[var(--surface-muted)] p-3 text-sm">{ticket.description}</div>
            </div>

            {ticket.waybillSnapshot && (
              <div className="rounded-lg border border-[var(--line)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">运单信息</div>
                  <span className={`text-xs ${ticket.waybillSnapshot.syncStatus === 'fresh' ? 'text-green-600' : 'text-amber-600'}`}>
                    {ticket.waybillSnapshot.syncStatus === 'fresh' ? '实时获取自 V2' : `本地缓存，同步于 ${new Date(ticket.waybillSnapshot.lastSyncAt).toLocaleString('zh-CN')}`}
                  </span>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>门店：{ticket.waybillSnapshot.storeName || '-'}</div>
                  <div>收件人：{ticket.waybillSnapshot.recipientName || '-'}</div>
                  <div>电话：{ticket.waybillSnapshot.recipientPhone || '-'}</div>
                  <div>地址：{ticket.waybillSnapshot.recipientAddress || '-'}</div>
                </div>
              </div>
            )}

            {canApprove && (
              <div className="space-y-3 pt-4 border-t border-[var(--line)]">
                <textarea
                  className="ui-textarea"
                  placeholder="填写审批意见"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                {aiSuggestion?.aiSuggestion && (
                  <div className="rounded-lg bg-[var(--primary-soft)] p-3 text-sm">
                    <div className="font-medium text-[var(--primary-dark)]">AI 审批建议（需人工确认）</div>
                    <div>{aiSuggestion.opinion}</div>
                    {aiSuggestion.references?.length > 0 && (
                      <div className="text-xs text-[var(--text-muted)] mt-1">
                        参考历史：{aiSuggestion.references.map((r: any) => r.id.slice(0, 8)).join(', ')}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" className="ui-button ui-button-secondary" onClick={fetchAiSuggestion}>
                    <MessageSquare className="h-4 w-4" /> AI 建议
                  </button>
                  <button type="button" className="ui-button ui-button-primary" onClick={() => handleApprove('approve')}>
                    <CheckCircle2 className="h-4 w-4" /> 通过
                  </button>
                  <button type="button" className="ui-button ui-button-danger" onClick={() => handleApprove('reject')}>
                    <XCircle className="h-4 w-4" /> 拒绝
                  </button>
                </div>
              </div>
            )}

            {ticket.type === 'qc' && ticket.status !== 'completed' && ticket.status !== 'closed' && isQcManager && (
              <div className="pt-4 border-t border-[var(--line)]">
                <button
                  type="button"
                  className="ui-button ui-button-secondary text-amber-600"
                  onClick={async () => {
                    const reason = window.prompt('请输入快速放行原因')
                    if (!reason) return
                    const res = await fetch(`/api/scans/${ticket.scanRecords?.[0]?.id}/release`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ operatorId: user.id, releaseReason: reason }),
                    })
                    const body = await res.json()
                    if (!res.ok) { pushToast('快速放行失败', body.error, 'error'); return }
                    pushToast('快速放行成功', '', 'success')
                    loadTicket()
                  }}
                >
                  <AlertTriangle className="h-4 w-4" /> 品控主管快速放行
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="ui-card">
            <div className="ui-card-header">
              <div className="ui-title">审批历史</div>
            </div>
            <div className="ui-card-body">
              {ticket.approvals?.length === 0 && <div className="text-sm text-[var(--text-muted)]">暂无审批记录</div>}
              <div className="space-y-3">
                {ticket.approvals?.map((record: any) => (
                  <div key={record.id} className="border-l-2 border-[var(--primary)] pl-3">
                    <div className="text-sm font-medium">{record.approver?.name} · {record.action === 'approve' ? '通过' : record.action === 'reject' ? '拒绝' : '放行'}</div>
                    <div className="text-xs text-[var(--text-muted)]">{new Date(record.createdAt).toLocaleString('zh-CN')}</div>
                    {record.comment && <div className="text-sm mt-1">{record.comment}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ui-card">
            <div className="ui-card-header">
              <div className="ui-title">执行联动</div>
            </div>
            <div className="ui-card-body space-y-3">
              <div>
                <div className="text-xs text-[var(--text-muted)]">赔付记录</div>
                {ticket.payments?.length === 0 ? <div className="text-sm">无</div> : ticket.payments.map((p: any) => (
                  <div key={p.id} className="text-sm">¥{p.amount.toFixed(2)} · {p.direction === 'customer_compensate' ? '赔付客户' : '向供应商追偿'} · {p.status}</div>
                ))}
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">库存流水</div>
                {ticket.inventoryLogs?.length === 0 ? <div className="text-sm">无</div> : ticket.inventoryLogs.map((l: any) => (
                  <div key={l.id} className="text-sm">{l.changeType} · {l.note}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ToastStack toasts={toasts} onRemove={(toastId) => setToasts((prev) => prev.filter((t) => t.id !== toastId))} />
    </>
  )
}
