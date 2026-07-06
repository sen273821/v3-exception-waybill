'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react'
import ToastStack, { type ToastItem, type ToastTone } from '@/components/ToastStack'

interface SyncLog {
  requestId: string
  apiName: string
  method: string
  statusCode?: number
  durationMs: number
  success: boolean
  errorMessage?: string
  createdAt: string
}

export default function MonitorPage() {
  const [data, setData] = useState<any>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const pushToast = useCallback((title: string, description?: string, tone: ToastTone = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    setToasts((prev) => [...prev, { id, title, description, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const load = useCallback(async () => {
    const res = await fetch('/api/monitor')
    const body = await res.json()
    setData(body)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleProcessOverdue = async () => {
    const res = await fetch('/api/monitor', { method: 'POST' })
    const body = await res.json()
    if (res.ok) {
      pushToast('超时工单处理完成', '', 'success')
      load()
    } else {
      pushToast('处理超时工单失败', body.error, 'error')
    }
  }

  return (
    <>
      <div className="ui-card">
        <div className="ui-card-header">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-[var(--primary)]" />
            <div className="ui-title">接口监控与同步</div>
          </div>
          <button type="button" className="ui-button ui-button-secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" /> 刷新
          </button>
        </div>
        <div className="ui-card-body">
          {data && (
            <>
              <div className="grid gap-4 sm:grid-cols-3 mb-6">
                <div className="rounded-lg border border-[var(--line)] p-4">
                  <div className="text-xs text-[var(--text-muted)]">最近一次同步</div>
                  <div className="font-medium">{data.latestSyncAt ? new Date(data.latestSyncAt).toLocaleString('zh-CN') : '无'}</div>
                </div>
                <div className="rounded-lg border border-[var(--line)] p-4">
                  <div className="text-xs text-[var(--text-muted)]">同步成功率</div>
                  <div className="font-medium">{Math.round((data.successRate ?? 0) * 100)}%</div>
                </div>
                <div className="rounded-lg border border-[var(--line)] p-4">
                  <div className="text-xs text-[var(--text-muted)]">总调用次数</div>
                  <div className="font-medium">{data.totalCalls}</div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-2">
                <div className="font-medium">最近调用日志</div>
                <button type="button" className="ui-button ui-button-primary" onClick={handleProcessOverdue}>
                  <Clock className="h-4 w-4" /> 处理超时工单
                </button>
              </div>

              <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Request ID</th>
                      <th>接口</th>
                      <th>方法</th>
                      <th>状态码</th>
                      <th>耗时</th>
                      <th>结果</th>
                      <th>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentLogs?.map((log: SyncLog) => (
                      <tr key={log.requestId}>
                        <td className="font-mono text-xs">{log.requestId.slice(0, 16)}...</td>
                        <td>{log.apiName}</td>
                        <td>{log.method}</td>
                        <td>{log.statusCode ?? '-'}</td>
                        <td>{log.durationMs}ms</td>
                        <td>
                          {log.success ? (
                            <span className="inline-flex items-center text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />成功</span>
                          ) : (
                            <span className="inline-flex items-center text-red-600"><XCircle className="h-3 w-3 mr-1" />{log.errorMessage || '失败'}</span>
                          )}
                        </td>
                        <td>{new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
      <ToastStack toasts={toasts} onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </>
  )
}
