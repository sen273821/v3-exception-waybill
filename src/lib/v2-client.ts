import { v4 as uuidv4 } from 'uuid'
import type { SyncLogEntry, V2Order, V2OrderListResponse, V2ValidateSkuResponse } from '@/types'
import { db } from '@/lib/db'

const V2_BASE_URL = process.env.V2_BASE_URL ?? 'http://127.0.0.1:3000'
const V3_API_KEY = process.env.V3_API_KEY ?? ''
const REQUEST_TIMEOUT_MS = 5000
const MAX_RETRIES = 2

export interface V2ClientOptions {
  requestId?: string
}

export class V2Client {
  private async request<T>(
    apiName: string,
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    params?: Record<string, string>,
    options?: V2ClientOptions,
  ): Promise<{ data: T; log: SyncLogEntry; fromCache: boolean }> {
    const requestId = options?.requestId ?? `v2-${uuidv4()}`
    const url = new URL(path, V2_BASE_URL)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value)
      })
    }

    const start = Date.now()
    let lastError: Error | undefined
    let statusCode: number | undefined
    let responseText = ''

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

        const res = await fetch(url.toString(), {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-V3-API-Key': V3_API_KEY,
            'X-Request-Id': requestId,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })

        clearTimeout(timeout)
        statusCode = res.status
        responseText = await res.text()

        if (!res.ok) {
          throw new Error(`V2 returned ${res.status}: ${responseText.slice(0, 200)}`)
        }

        const data = JSON.parse(responseText) as T
        const log = await this.writeLog({
          requestId,
          apiName,
          method,
          params: this.summarizeParams(params ?? body),
          statusCode,
          response: responseText.slice(0, 500),
          durationMs: Date.now() - start,
          success: true,
        })

        return { data, log, fromCache: false }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
        }
      }
    }

    const log = await this.writeLog({
      requestId,
      apiName,
      method,
      params: this.summarizeParams(params ?? body),
      statusCode,
      response: responseText.slice(0, 500),
      durationMs: Date.now() - start,
      success: false,
      errorMessage: lastError?.message,
    })

    throw new V2UnavailableError(`调用 V2 接口失败: ${lastError?.message}`, log)
  }

  private summarizeParams(input?: Record<string, unknown>): string {
    if (!input) return ''
    const clone = { ...input }
    if (clone.skuCode) clone.skuCode = String(clone.skuCode).slice(0, 20)
    if (clone.externalCode) clone.externalCode = String(clone.externalCode).slice(0, 30)
    return JSON.stringify(clone)
  }

  private async writeLog(partial: Omit<SyncLogEntry, 'createdAt'>): Promise<SyncLogEntry> {
    const entry = await db.syncLog.create({
      data: {
        ...partial,
      },
    })
    return {
      ...entry,
      params: entry.params ?? undefined,
      response: entry.response ?? undefined,
      errorMessage: entry.errorMessage ?? undefined,
      statusCode: entry.statusCode ?? undefined,
      createdAt: entry.createdAt.toISOString(),
    }
  }

  async getOrders(params: {
    externalCode?: string
    recipientName?: string
    page?: string
    pageSize?: string
    startDate?: string
    endDate?: string
  }, options?: V2ClientOptions): Promise<V2OrderListResponse> {
    const res = await this.request<V2OrderListResponse>(
      'v3.orders.list',
      'GET',
      '/api/v3/orders',
      undefined,
      {
        externalCode: params.externalCode ?? '',
        recipientName: params.recipientName ?? '',
        page: params.page ?? '1',
        pageSize: params.pageSize ?? '100',
        startDate: params.startDate ?? '',
        endDate: params.endDate ?? '',
      },
      options,
    )
    return res.data
  }

  async validateSku(externalCode: string, skuCode: string, options?: V2ClientOptions): Promise<V2ValidateSkuResponse> {
    const res = await this.request<V2ValidateSkuResponse>(
      'v3.orders.validate-sku',
      'POST',
      `/api/v3/orders/${encodeURIComponent(externalCode)}/validate-sku`,
      { skuCode },
      undefined,
      options,
    )
    return res.data
  }

  async markException(externalCode: string, hasOpenException: boolean, options?: V2ClientOptions): Promise<void> {
    await this.request<{ success: boolean }>(
      'v3.orders.mark-exception',
      'POST',
      `/api/v3/orders/${encodeURIComponent(externalCode)}/exception`,
      { hasOpenException },
      undefined,
      options,
    )
  }

  async healthCheck(options?: V2ClientOptions): Promise<boolean> {
    try {
      await this.request<{ status: string }>('v3.health', 'GET', '/api/v3/health', undefined, undefined, options)
      return true
    } catch {
      return false
    }
  }
}

export class V2UnavailableError extends Error {
  log: SyncLogEntry
  constructor(message: string, log: SyncLogEntry) {
    super(message)
    this.log = log
  }
}

export const v2Client = new V2Client()
