'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import ToastStack, { type ToastItem, type ToastTone } from '@/components/ToastStack'

const SUB_TYPES: Record<string, { label: string; value: string }[]> = {
  logistics: [
    { label: '丢件', value: 'lost' },
    { label: '破损', value: 'damaged' },
    { label: '客户拒收', value: 'rejected' },
    { label: '超时未签收', value: 'timeout' },
    { label: '收货地址错误', value: 'address_error' },
  ],
  qc: [
    { label: '数量不符', value: 'quantity_mismatch' },
    { label: '外观破损', value: 'broken' },
    { label: '规格不符', value: 'spec_mismatch' },
    { label: '标签错误', value: 'label_error' },
    { label: '批次异常', value: 'batch_error' },
  ],
}

export default function NewTicketPage() {
  const router = useRouter()
  const [externalCode, setExternalCode] = useState('')
  const [type, setType] = useState('logistics')
  const [subType, setSubType] = useState('lost')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<any>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const pushToast = useCallback((title: string, description?: string, tone: ToastTone = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    setToasts((prev) => [...prev, { id, title, description, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const fetchAiSuggestion = async () => {
    if (!description) return
    try {
      const res = await fetch('/api/ai/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, type }),
      })
      const body = await res.json()
      if (body.subType) setAiSuggestion(body)
    } catch {
      // AI 失败不阻塞
    }
  }

  const handleSubmit = async () => {
    if (!externalCode || !amount || !description) {
      pushToast('请填写完整信息', '', 'error')
      return
    }
    setLoading(true)
    try {
      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('v3-user') ?? '{}') : {}
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalCode,
          type,
          subType,
          amount: Number(amount),
          description,
          reporterId: user.id || 'reporter-id',
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || '上报失败')
      pushToast('异常上报成功', `工单号：${body.ticketNo}`, 'success')
      setTimeout(() => router.push('/tickets'), 800)
    } catch (err) {
      pushToast('上报失败', (err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="ui-card">
        <div className="ui-card-header">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--primary)]" />
            <div className="ui-title">上报异常工单</div>
          </div>
        </div>
        <div className="ui-card-body space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="ui-grid-label">运单号</span>
              <input className="ui-input" value={externalCode} onChange={(e) => setExternalCode(e.target.value)} placeholder="DEMO-0001" />
            </label>
            <label className="block">
              <span className="ui-grid-label">异常类型</span>
              <select className="ui-select" value={type} onChange={(e) => { setType(e.target.value); setSubType(SUB_TYPES[e.target.value][0].value) }}>
                <option value="logistics">物流异常</option>
                <option value="qc">品控异常</option>
              </select>
            </label>
            <label className="block">
              <span className="ui-grid-label">子类型</span>
              <select className="ui-select" value={subType} onChange={(e) => setSubType(e.target.value)}>
                {SUB_TYPES[type].map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="ui-grid-label">异常金额</span>
              <input className="ui-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </label>
          </div>
          <label className="block">
            <span className="ui-grid-label">异常描述</span>
            <textarea className="ui-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="请描述异常情况..." />
          </label>

          {aiSuggestion && (
            <div className="rounded-lg bg-[var(--primary-soft)] p-4 text-sm">
              <div className="font-medium text-[var(--primary-dark)]">AI 建议（需人工确认）</div>
              <div className="mt-1">推荐子类型：{SUB_TYPES[type].find((s) => s.value === aiSuggestion.subType)?.label ?? aiSuggestion.subType}</div>
              <div className="text-[var(--text-muted)]">置信度：{Math.round((aiSuggestion.confidence ?? 0) * 100)}% · {aiSuggestion.explanation}</div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" className="ui-button ui-button-secondary" onClick={fetchAiSuggestion} disabled={!description}>
              AI 推荐类型
            </button>
            <button type="button" className="ui-button ui-button-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />提交中...</> : '提交上报'}
            </button>
          </div>
        </div>
      </div>
      <ToastStack toasts={toasts} onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </>
  )
}
