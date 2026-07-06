# V3 与 V2 系统间接口文档

## 1. 概述

V3（运单全流程管理系统）与 V2（万能导入 AI 录单系统）是两个独立的 Next.js 项目，独立部署、独立数据库。V3 通过 HTTP API 调用 V2 获取运单数据，V2 不直接暴露内部数据库。

## 2. V2 暴露的 V3 专用接口

所有接口路径前缀为 `/api/v3/*`，需在请求头中携带鉴权密钥：

```
X-V3-API-Key: <V3_API_KEY>
```

鉴权由 V2 的 `src/middleware.ts` 统一拦截校验。

### 2.1 查询/校验运单

- **接口**：`GET /api/v3/orders`
- **用途**：校验运单是否存在，或分页查询运单列表
- **Query 参数**：
  - `externalCode`（可选）：按外部编码模糊查询
  - `recipientName`（可选）：按收件人姓名模糊查询
  - `page`、`pageSize`（可选，默认 1/20）
  - `startDate`、`endDate`（可选）
- **响应**：
  ```json
  {
    "data": [OrderRecord],
    "total": 10,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
  ```

### 2.2 校验 SKU 是否属于运单

- **接口**：`POST /api/v3/orders/validate-sku`
- **用途**：扫描录入时验证 SKU 确实属于该运单
- **请求体**：
  ```json
  { "externalCode": "DEMO-0001", "skuCode": "SKU-001" }
  ```
- **成功响应**：
  ```json
  { "valid": true, "order": OrderRecord }
  ```
- **失败响应**：
  ```json
  { "valid": false, "error": "SKU 不属于该运单或运单不存在" }
  ```

### 2.3 回写异常标记

- **接口**：`POST /api/v3/orders/:externalCode/exception`
- **用途**：V3 在工单创建/关闭时回写 V2，提示该运单是否存在未关闭异常
- **请求体**：
  ```json
  { "hasOpenException": true }
  ```
- **响应**：
  ```json
  { "success": true, "externalCode": "DEMO-0001", "hasOpenException": true }
  ```

### 2.4 健康检查

- **接口**：`GET /api/v3/health`
- **响应**：
  ```json
  { "status": "ok", "service": "v2-v3-bridge", "timestamp": "2026-07-06T..." }
  ```

## 3. V3 调用 V2 的客户端行为

- 封装在 `src/lib/v2-client.ts`
- 每次调用生成 `requestId` 并写入 `SyncLog`
- 超时时间：5 秒
- 重试策略：失败最多重试 2 次，间隔 500ms/1000ms
- 幂等性：V2 查询接口天然幂等；回写接口按外部编码批量更新
- V2 不可用时：基于本地 `WaybillSnapshot` 缓存继续服务，并在 UI 明确标注数据新鲜度

## 4. 环境变量

V2 需配置：

```env
V3_API_KEY=xxx
```

V3 需配置：

```env
V2_BASE_URL=https://universal-import-mu.vercel.app
V3_API_KEY=xxx
OPENAI_API_KEY=xxx
DATABASE_URL=...
```

## 5. 老系统二开意识说明

V2 原有接口未对外鉴权，本次新增 `/api/v3/*` 路由簇并配套 `middleware.ts` 专门服务 V3，不影响 V2 自身前端调用方。字段升级时遵循向后兼容原则：新增字段 `hasOpenException` 使用默认值 `false`，存量数据无感知。若 V2 金额字段类型从 `int` 改为 `decimal`，V3 侧使用 `Number()` 解析并以字符串形式落库到 `Decimal` 字段，避免精度丢失。
