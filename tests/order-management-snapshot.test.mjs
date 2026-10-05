import test from 'node:test'
import assert from 'node:assert/strict'
import {managementSnapshotDetails, managementOrderNotice} from '../data/order-management-snapshot.mjs'

test('商家订单详情只显示订单真实快照，不沿用画布示例字段', () => {
  const order = {
    buyer_id:201, buyerName:'真实会员', rule_id:1, ruleEffectiveAt:'2026-09-01',
    items:[{snapshot_json:JSON.stringify({ruleId:1,prices:[2990,1800,1400,1000],bps:[0,300,200,100],chain:[
      {agentId:4,memberId:104,rank:1},{agentId:3,memberId:103,rank:1},{agentId:1,memberId:101,rank:3},
    ]})}],
  }
  const details = managementSnapshotDetails(order, value => (value / 100).toFixed(2))
  assert.equal(details.buyer, '真实会员 · 会员 201')
  assert.equal(details.customer, 'C 云代理 · 代理 4 / 会员 104')
  assert.equal(details.peer, 'C 云代理 · 代理 3 / 会员 103')
  assert.equal(details.owner, 'A 总代理 · 代理 1 / 会员 101')
  assert.equal(details.rule, '规则 #1 · 3%')
  assert.equal(details.prices, '¥18.00 / ¥14.00 / ¥10.00')
  assert.equal(details.ruleEffectiveAt, '2026-09-01')
  assert.match(managementOrderNotice('COMPLETED'), /已完成/)
})

test('缺少历史快照时明确标记缺失，不回退成示例人物或价格', () => {
  const details = managementSnapshotDetails({buyer_id:202,items:[{}]}, value => String(value))
  assert.equal(details.buyer, '会员 202')
  assert.equal(details.customer, '快照未记录')
  assert.equal(details.prices, '快照未记录')
  assert.equal(details.peer, '无同级上级')
})
