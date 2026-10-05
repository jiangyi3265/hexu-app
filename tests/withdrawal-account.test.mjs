import test from 'node:test'
import assert from 'node:assert/strict'
import { withdrawalAccountLabel, withdrawalOutcome } from '../data/business.mjs'

test('提现账户名称按已审核渠道回显，不能留下空白目标', () => {
  assert.equal(withdrawalAccountLabel([]), '请先添加并审核结算账户')
  assert.equal(withdrawalAccountLabel([{ status: 'PENDING', body: { channel: 'BALANCE' } }]), '请先添加并审核结算账户')
  assert.equal(withdrawalAccountLabel([{ status: 'PENDING' }, { status: 'APPROVED', body: { channel: 'BALANCE', accountName: 'A 总代理' } }]), '系统余额 · A 总代理')
  assert.equal(withdrawalAccountLabel([{ status: 'APPROVED', body: { channel: 'WECHAT', accountName: '测试会员' } }]), '微信零钱 · 测试会员')
  assert.equal(withdrawalAccountLabel([{ status: 'APPROVED', body: { channel: 'BANK', masked: '工商银行（尾号3287）' } }]), '工商银行（尾号3287）')
  assert.equal(withdrawalAccountLabel([{ status: 'APPROVED', body: { channel: 'BANK' } }]), '银行卡账户待核对')
  assert.equal(withdrawalAccountLabel([{ status: 'APPROVED', body: {} }]), '结算账户资料待核对')
})

test('提现终态不再误提示仍可能到账', () => {
  assert.deepEqual(withdrawalOutcome('PENDING', 99), { body: '尚未确认到账，预计金额¥0.99', actual: '尚未确认' })
  assert.deepEqual(withdrawalOutcome('PROCESSING', 99), { body: '付款处理中，到账以渠道结果为准', actual: '尚未确认' })
  assert.deepEqual(withdrawalOutcome('PAID', 99), { body: '渠道已确认实际付款', actual: '¥0.99' })
  for (const status of ['REJECTED', 'FAILED']) assert.deepEqual(withdrawalOutcome(status, 99), { body: '冻结金额已退回可提现余额', actual: '未到账' })
})
