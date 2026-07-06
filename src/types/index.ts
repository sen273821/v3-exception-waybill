export interface V2Order {
  id: string
  externalCode: string
  storeName: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  skuCode: string
  skuName: string
  skuQuantity: number
  skuSpec: string
  remark: string
  ruleId: string
  createdAt: string
  hasOpenException?: boolean
}

export interface V2OrderListResponse {
  data: V2Order[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface V2ValidateSkuResponse {
  valid: boolean
  order?: V2Order
  error?: string
}

export type UserRole = 'reporter' | 'approver_l1' | 'approver_l2' | 'qc_manager' | 'admin'

export interface AppUser {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
}

export type TicketSource = 'scan' | 'manual'
export type TicketType = 'qc' | 'logistics'
export type TicketStatus =
  | 'pending'
  | 'l1_approval'
  | 'l2_approval'
  | 'executing'
  | 'completed'
  | 'rejected'
  | 'closed'

export type LogisticsSubType =
  | 'lost'
  | 'damaged'
  | 'rejected'
  | 'timeout'
  | 'address_error'

export type QcSubType =
  | 'quantity_mismatch'
  | 'broken'
  | 'spec_mismatch'
  | 'label_error'
  | 'batch_error'

export interface QcRuleConfig {
  id?: string
  name: string
  subType: QcSubType
  conditionType: string
  threshold?: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  autoCreateTicket: boolean
  autoApprovalLevel?: number | null
  isActive: boolean
}

export interface ApprovalRuleConfig {
  id?: string
  name: string
  level: 1 | 2
  minAmount: number
  maxAmount?: number | null
  exceptionType: string
  timeoutHours: number
  isActive: boolean
}

export interface WaybillSummary {
  id: string
  externalCode: string
  storeName: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  totalAmount?: number
  skuSummary: Array<{ skuCode: string; skuName: string; skuQuantity: number; skuSpec?: string }>
  syncStatus: 'fresh' | 'stale'
  lastSyncAt: string
}

export interface ScanInput {
  externalCode: string
  skuCode: string
  scanCode: string
  description?: string
  operatorId: string
}

export interface TicketInput {
  externalCode: string
  type: TicketType
  subType: string
  amount: number
  description: string
  reporterId: string
}

export interface ApprovalInput {
  ticketId: string
  action: 'approve' | 'reject' | 'release'
  comment: string
  approverId: string
}

export interface SyncLogEntry {
  requestId: string
  apiName: string
  method: string
  params?: string
  statusCode?: number
  response?: string
  durationMs: number
  success: boolean
  errorMessage?: string
  createdAt: string
}
