'use client'

import { useEffect, useState } from 'react'
import { Settings2, Plus, Trash2 } from 'lucide-react'

interface Rule {
  id?: string
  name: string
  subType?: string
  conditionType: string
  threshold?: number
  severity?: string
  autoApprovalLevel?: number | null
  level?: number
  minAmount?: number
  maxAmount?: number | ''
  exceptionType?: string
  timeoutHours?: number
}

export default function RulesPage() {
  const [qcRules, setQcRules] = useState<Rule[]>([])
  const [approvalRules, setApprovalRules] = useState<Rule[]>([])
  const [activeTab, setActiveTab] = useState<'qc' | 'approval'>('qc')

  useEffect(() => {
    fetch('/api/qc-rules').then((r) => r.json()).then(setQcRules)
    fetch('/api/approval-rules').then((r) => r.json()).then(setApprovalRules)
  }, [])

  return (
    <div className="ui-card">
      <div className="ui-card-header">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-[var(--primary)]" />
          <div className="ui-title">规则配置</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`ui-button ${activeTab === 'qc' ? 'ui-button-primary' : 'ui-button-secondary'}`}
            onClick={() => setActiveTab('qc')}
          >
            品控规则
          </button>
          <button
            type="button"
            className={`ui-button ${activeTab === 'approval' ? 'ui-button-primary' : 'ui-button-secondary'}`}
            onClick={() => setActiveTab('approval')}
          >
            审批规则
          </button>
        </div>
      </div>

      <div className="ui-card-body">
        {activeTab === 'qc' ? (
          <>
            <div className="mb-4 text-sm text-[var(--text-muted)]">品控规则引擎触发条件，支持数量差异、破损等级、文本匹配。</div>
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>规则名</th>
                    <th>子类型</th>
                    <th>条件</th>
                    <th>阈值</th>
                    <th>严重度</th>
                    <th>自动审批级别</th>
                  </tr>
                </thead>
                <tbody>
                  {qcRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.name}</td>
                      <td>{rule.subType}</td>
                      <td>{rule.conditionType}</td>
                      <td>{rule.threshold ?? '-'}</td>
                      <td>{rule.severity}</td>
                      <td>{rule.autoApprovalLevel ?? '无'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 text-sm text-[var(--text-muted)]">审批分级规则，按异常金额决定审批层级和超时时长。</div>
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>规则名</th>
                    <th>层级</th>
                    <th>金额范围</th>
                    <th>异常类型</th>
                    <th>超时时长（小时）</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.name}</td>
                      <td>L{rule.level}</td>
                      <td>{rule.minAmount} - {rule.maxAmount || '∞'}</td>
                      <td>{rule.exceptionType}</td>
                      <td>{rule.timeoutHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
