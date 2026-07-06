import { db } from '../src/lib/db'

async function main() {
  // 创建 mock 用户
  const users = await Promise.all([
    db.user.create({ data: { email: 'reporter@example.com', name: '上报员 A', role: 'reporter' } }),
    db.user.create({ data: { email: 'approver1@example.com', name: '一级审批 B', role: 'approver_l1' } }),
    db.user.create({ data: { email: 'approver2@example.com', name: '二级审批 C', role: 'approver_l2' } }),
    db.user.create({ data: { email: 'qcmanager@example.com', name: '品控主管 D', role: 'qc_manager' } }),
    db.user.create({ data: { email: 'admin@example.com', name: '管理员 E', role: 'admin' } }),
  ])

  // 创建品控规则
  await Promise.all([
    db.qcRule.create({
      data: {
        name: '数量差异≥5%',
        subType: 'quantity_mismatch',
        conditionType: 'quantity_diff_pct',
        threshold: 5,
        severity: 'high',
        autoCreateTicket: true,
        autoApprovalLevel: 1,
      },
    }),
    db.qcRule.create({
      data: {
        name: '破损等级≥2',
        subType: 'broken',
        conditionType: 'damage_level',
        threshold: 2,
        severity: 'critical',
        autoCreateTicket: true,
        autoApprovalLevel: 2,
      },
    }),
    db.qcRule.create({
      data: {
        name: '标签错误',
        subType: 'label_error',
        conditionType: 'text_match',
        severity: 'medium',
        autoCreateTicket: true,
        autoApprovalLevel: 1,
      },
    }),
  ])

  // 创建审批分级规则
  await Promise.all([
    db.approvalRule.create({
      data: { name: '小额一级审批', level: 1, minAmount: 0, maxAmount: 500, exceptionType: 'logistics', timeoutHours: 24 },
    }),
    db.approvalRule.create({
      data: { name: '大额二级审批', level: 2, minAmount: 500, maxAmount: null, exceptionType: 'logistics', timeoutHours: 12 },
    }),
    db.approvalRule.create({
      data: { name: '品控一级审批', level: 1, minAmount: 0, maxAmount: 300, exceptionType: 'qc', timeoutHours: 4 },
    }),
    db.approvalRule.create({
      data: { name: '品控二级审批', level: 2, minAmount: 300, maxAmount: null, exceptionType: 'qc', timeoutHours: 4 },
    }),
  ])

  // 创建快照
  const snapshot = await db.waybillSnapshot.create({
    data: {
      externalCode: 'DEMO-0001',
      storeName: '测试门店',
      recipientName: '张三',
      recipientPhone: '13800138000',
      recipientAddress: '测试地址',
      totalAmount: 1000,
      skuSummary: JSON.stringify([
        { skuCode: 'SKU-001', skuName: '商品 A', skuQuantity: 10 },
        { skuCode: 'SKU-002', skuName: '商品 B', skuQuantity: 5 },
      ]),
      syncStatus: 'fresh',
      lastSyncAt: new Date(),
    },
  })

  const reporter = users[0]
  const subTypes = ['lost', 'damaged', 'rejected', 'timeout', 'address_error']

  // 生成 200 条模拟工单
  for (let i = 0; i < 200; i++) {
    const isQc = i % 3 === 0
    const type = isQc ? 'qc' : 'logistics'
    const subType = isQc
      ? ['quantity_mismatch', 'broken', 'spec_mismatch', 'label_error', 'batch_error'][i % 5]
      : subTypes[i % 5]
    const amount = [120, 800, 2000, 50, 300][i % 5]
    const statuses = ['pending', 'l1_approval', 'l2_approval', 'executing', 'completed', 'closed']
    const status = statuses[i % 6]
    const level = status === 'l2_approval' ? 2 : status === 'l1_approval' ? 1 : 0

    await db.ticket.create({
      data: {
        ticketNo: `EX-${Date.now().toString(36).toUpperCase()}-${i.toString().padStart(3, '0')}`,
        source: i % 4 === 0 ? 'scan' : 'manual',
        type,
        subType,
        status,
        externalCode: `DEMO-${String(i % 50).padStart(4, '0')}`,
        waybillSnapshotId: snapshot.id,
        amount,
        description: `${type === 'qc' ? '品控' : '物流'}异常示例 #${i + 1}`,
        reporterId: reporter.id,
        currentLevel: level,
        resubmitCount: i % 7,
      },
    })
  }

  console.log('Seed completed')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
