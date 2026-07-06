'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  ScanLine,
  Ticket,
  Settings2,
  Activity,
  LogOut,
  User,
} from 'lucide-react'

const TABS = [
  { key: 'scan', label: '扫描品控', href: '/scan', icon: ScanLine },
  { key: 'tickets', label: '异常工单', href: '/tickets', icon: Ticket },
  { key: 'rules', label: '规则配置', href: '/rules', icon: Settings2 },
  { key: 'monitor', label: '接口监控', href: '/monitor', icon: Activity },
]

interface LayoutShellProps {
  children: React.ReactNode
}

export default function LayoutShell({ children }: LayoutShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string } | null>(null)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('v3-user') : null
    if (saved) {
      setCurrentUser(JSON.parse(saved))
    } else {
      const defaultUser = { id: 'reporter-id', name: '上报员 A', role: 'reporter' }
      localStorage.setItem('v3-user', JSON.stringify(defaultUser))
      setCurrentUser(defaultUser)
    }
  }, [])

  const switchRole = useCallback((role: string, name: string, id: string) => {
    const user = { id, name, role }
    localStorage.setItem('v3-user', JSON.stringify(user))
    setCurrentUser(user)
    window.location.reload()
  }, [])

  return (
    <div className="ui-shell">
      <aside className="ui-sidebar">
        <div className="ui-sidebar-logo">
          <div className="font-bold text-lg">V3 运单管理</div>
          <div className="text-xs opacity-70">全流程异常处理</div>
        </div>
        <nav className="ui-sidebar-nav">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = pathname === tab.href
            return (
              <a
                key={tab.key}
                href={tab.href}
                className={`ui-sidebar-item ${active ? 'active' : ''}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </a>
            )
          })}
        </nav>      </aside>

      <div className="ui-main">
        <header className="ui-topbar">
          <div className="ui-topbar-title">运单全流程管理系统 V3</div>
          <div className="ui-topbar-user">
            <User className="h-4 w-4" />
            <select
              className="bg-transparent text-white text-sm outline-none"
              value={currentUser?.role ?? 'reporter'}
              onChange={(e) => {
                const map: Record<string, { id: string; name: string }> = {
                  reporter: { id: 'reporter-id', name: '上报员 A' },
                  approver_l1: { id: 'approver1-id', name: '一级审批 B' },
                  approver_l2: { id: 'approver2-id', name: '二级审批 C' },
                  qc_manager: { id: 'qcmanager-id', name: '品控主管 D' },
                  admin: { id: 'admin-id', name: '管理员 E' },
                }
                const role = e.target.value
                switchRole(role, map[role].name, map[role].id)
              }}
            >
              <option value="reporter">上报员 A</option>
              <option value="approver_l1">一级审批 B</option>
              <option value="approver_l2">二级审批 C</option>
              <option value="qc_manager">品控主管 D</option>
              <option value="admin">管理员 E</option>
            </select>
          </div>
        </header>

        <div className="ui-tabs-bar lg:hidden">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = pathname === tab.href
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => router.push(tab.href)}
                className={`ui-tab-item flex items-center gap-2 ${active ? 'active' : ''}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <main className="ui-page">{children}</main>
      </div>
    </div>
  )
}
