'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Ticket, AlertTriangle, Clock, Loader2 } from 'lucide-react'
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

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  l1_approval: 'bg-blue-100 text-blue-700',
  l2_approval: 'bg-purple-100 text-purple-700',
  executing: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  closed: 'bg-gray-100 text-gray-700',
}

export default function TicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [externalCode, setExternalCode] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const pushToast = useCallback((title: string, description?: string, tone: ToastTone = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    setToasts((prev) => [...prev, { id, title, description, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const loadTickets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (type) params.set('type', type)
      if (externalCode) params.set('externalCode', externalCode)
      params.set('page', String(page))
      params.set('pageSize', '20')

      const res = await fetch(`/api/tickets?${params.toString()}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      setTickets(body.data)
      setTotalPages(body.totalPages)
    } catch (err) {
      pushToast('加载工单失败', (err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [status, type, externalCode, page, pushToast])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  return (
    <>
      <div className="ui-card">
        <div className="ui-card-header">
          <div className="flex items-center gap-3">
            <Ticket className="h-5 w-5 text-[var(--primary)]" />
            <div className="ui-title">异常工单列表</div>
          </div>
          <button
            type="button"
            className="ui-button ui-button-primary"
            onClick={() => router.push('/tickets/new')}
          >
            + 上报异常
          </button>
        </div>

        <div className="ui-card-body">
          <div className="flex flex-wrap gap-3 mb-4">
            <select className="ui-select w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
              <option value="">全部状态</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="ui-select w-40" value={type} onChange={(e) => { setType(e.target.value); setPage(1) }}>
              <option value="">全部类型</option>
              <option value="qc">品控异常</option>
              <option value="logistics">物流异常</option>
            </select>
            <input
              className="ui-input w-56"
              placeholder="运单号"
              value={externalCode}
              onChange={(e) => { setExternalCode(e.target.value); setPage(1) }}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
            </div>
          ) : (
            <>
              <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>工单号</th>
                      <th>类型</th>
                      <th>状态</th>
                      <th>运单号</th>
                      <th>金额</th>
                      <th>上报人</th>
                      <th>创建时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td className="font-mono text-xs">{ticket.ticketNo}</td>
                        <td>{ticket.type === 'qc' ? '品控' : '物流'}</td>
                        <td>
                          <span className={`ui-badge ${STATUS_COLORS[ticket.status] ?? 'bg-gray-100'}`}>
                            {STATUS_LABELS[ticket.status] ?? ticket.status}
                          </span>
                          {['pending', 'l1_approval', 'l2_approval'].includes(ticket.status) && ticket.resubmitCount >= 2 && (
                            <span className="ml-2 inline-flex items-center text-xs text-red-500">
                              <AlertTriangle className="h-3 w-3 mr-1" /> 即将超时
                            </span>
                          )}
                        </td>
                        <td>{ticket.externalCode}</td>
                        <td>¥{ticket.amount.toFixed(2)}</td>
                        <td>{ticket.reporter?.name}</td>
                        <td>{new Date(ticket.createdAt).toLocaleString('zh-CN')}</td>
                        <td>
                          <button
                            type="button"
                            className="ui-button ui-button-secondary text-xs"
                            onClick={() => router.push(`/tickets/${ticket.id}`)}
                          >
                            详情
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <button
                  type="button"
                  className="ui-button ui-button-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一页
                </button>
                <div className="text-sm text-[var(--text-muted)]">第 {page} / {totalPages} 页</div>
                <button
                  type="button"
                  className="ui-button ui-button-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ToastStack toasts={toasts} onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </>
  )
}
