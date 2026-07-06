import type { Metadata } from 'next'
import './globals.css'
import LayoutShell from '@/components/LayoutShell'

export const metadata: Metadata = {
  title: 'V3 运单全流程管理系统',
  description: '运单从扫描品控、异常上报、分级审批到执行联动的全生命周期管理',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}
