'use client'

import { useState, useCallback } from 'react'
import { ScanLine, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import ToastStack, { type ToastItem, type ToastTone } from '@/components/ToastStack'

export default function ScanPage() {
  const [externalCode, setExternalCode] = useState('')
  const [skuCode, setSkuCode] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const pushToast = useCallback((title: string, description?: string, tone: ToastTone = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    setToasts((prev) => [...prev, { id, title, description, tone }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const handleScan = async () => {
    if (!externalCode || !skuCode) {
      pushToast('请填写完整信息', '运单号和 SKU 不能为空', 'error')
      return
    }
    setLoading(true)
    try {
      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('v3-user') ?? '{}') : {}
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalCode,
          skuCode,
          scanCode: `SC-${Date.now()}`,
          description,
          operatorId: user.id || 'reporter-id',
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || '扫描失败')
      setResult(body)
      pushToast(body.isNewTicket ? '品控异常，已锁定批次' : body.message, undefined, body.isNewTicket ? 'error' : 'success')
    } catch (err) {
      pushToast('扫描失败', (err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="ui-card">
        <div className="ui-card-header">
          <div className="flex items-center gap-3">
            <ScanLine className="h-5 w-5 text-[var(--primary)]" />
            <div className="ui-title">扫描品控</div>
          </div>
        </div>
        <div className="ui-card-body space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="ui-grid-label">运单号（外部编码）</span>
              <input
                className="ui-input"
                value={externalCode}
                onChange={(e) => setExternalCode(e.target.value)}
                placeholder="例如：DEMO-0001"
              />
            </label>
            <label className="block">
              <span className="ui-grid-label">SKU 编码</span>
              <input
                className="ui-input"
                value={skuCode}
                onChange={(e) => setSkuCode(e.target.value)}
                placeholder="例如：SKU-001"
              />
            </label>
          </div>
          <label className="block">
            <span className="ui-grid-label">扫描异常描述（可选，用于品控规则匹配）</span>
            <textarea
              className="ui-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：破损等级：2；数量差异：8"
            />
          </label>
          <button
            type="button"
            className="ui-button ui-button-primary"
            onClick={handleScan}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                品控检测中...
              </>
            ) : (
              <>
                <ScanLine className="h-4 w-4" />
                执行扫描检测
              </>
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className={`ui-card border-l-4 ${result.isNewTicket ? 'border-l-red-500' : result.scanRecord?.result === 'pass' ? 'border-l-green-500' : 'border-l-amber-500'}`}>
          <div className="ui-card-body">
            <div className="flex items-center gap-2 mb-2">
              {result.scanRecord?.result === 'pass' ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <div className="font-semibold">{result.message}</div>
            </div>
            <div className="text-sm text-[var(--text-muted)]">
              扫描码：{result.scanRecord?.scanCode}
              {result.ticketNo && ` · 工单号：${result.ticketNo}`}
              {result.fromCache && ' · 使用本地快照校验'}
            </div>
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </>
  )
}
