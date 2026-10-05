import test from 'node:test'
import assert from 'node:assert/strict'
import {loadPure} from './helpers/pure-module.mjs'
const {paymentNotice,paymentState}=await loadPure('payment-clock.js')
test('付款剩余时间每秒递减且期限不变',()=>{
  const order={rawStatus:'UNPAID',expires_at:'2026-09-27T12:15:00Z'},now=Date.parse('2026-09-27T12:00:00Z')
  assert.equal(paymentState(order,now).title,'请在 15:00 内完成支付')
  assert.equal(paymentState(order,now+1000).title,'请在 14:59 内完成支付')
  assert.equal(paymentState(order,now+900000).payable,false)
})
test('无订单、无效期限和已付款订单不能继续付款',()=>{
  for(const order of [null,{rawStatus:'PAID'},{rawStatus:'UNPAID',expires_at:'invalid'}])assert.equal(paymentState(order).payable,false)
})
test('本地支付已确认但页面仍在跳转时不闪现错误状态',()=>{
  const paid={rawStatus:'PAID'}
  assert.equal(paymentState(paid,Date.now(),true).title,'支付已确认，正在跳转结果页')
  assert.equal(paymentState(paid,Date.now(),true).processing,true)
  assert.equal(paymentState(paid,Date.now()).title,'订单已不在待付款状态，请返回订单查看')
  assert.deepEqual(paymentNotice(paid,Date.now(),true,'超时订单将关闭'),{
    title:'支付已确认，正在跳转结果页',
    body:'支付结果已确认，即将查看订单结果'
  })
  assert.equal(paymentNotice(paid,Date.now(),false,'超时订单将关闭').body,'付款已确认，请返回订单查看最新状态')
  assert.equal(paymentNotice({rawStatus:'CANCELLED'},Date.now(),false,'超时订单将关闭').body,'订单已关闭，不能继续支付')
  assert.equal(paymentNotice({rawStatus:'UNPAID',expires_at:'2026-09-27T12:00:00Z'},Date.now(),false,'超时订单将关闭').body,'付款期限已过，请返回订单查看最新状态')
})
test('带时区毫秒的真实接口期限仍逐秒递减，不依赖字符串 Date',()=>{
  const order={rawStatus:'UNPAID',expires_at:'2026-09-27T14:47:17.000-04:00'}
  const now=Date.UTC(2026,8,27,18,46,17)
  assert.equal(paymentState(order,now).title,'请在 01:00 内完成支付')
  assert.equal(paymentState(order,now+1000).title,'请在 00:59 内完成支付')
  assert.equal(paymentState(order,now+60000).payable,false)
})
