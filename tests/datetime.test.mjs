import test from 'node:test'
import assert from 'node:assert/strict'
import {loadPure} from './helpers/pure-module.mjs'
const {timestamp,dateTimeLabel,isFutureTimestamp} = await loadPure('datetime.js')

test('API ISO 时间保留时区与毫秒，数字构造不依赖 iOS 字符串解析',()=>{
  for (const value of ['2026-09-27T14:47:17.000-04:00','2026-09-28T02:47:17+08:00','2026-09-27T18:47:17Z','2026-09-27T18:47:17.1Z','2026-09-27T18:47:17.123456789Z']) {
    assert.equal(timestamp(value), Date.parse(value))
  }
  const expected=Date.UTC(2026,8,27,18,47,17)
  assert.equal(timestamp('2026-09-27T14:47:17.000-04:00'),expected)
  assert.equal(timestamp(String(expected)),expected)
  assert.equal(timestamp(expected),expected)
  assert.equal(timestamp(new Date(expected)),expected)
  assert.equal(dateTimeLabel('2026-09-27T14:47:17.000-04:00',{timeZone:'UTC',hour:'2-digit',minute:'2-digit',hour12:false}),'18:47')
})

test('SQL 无时区时间仍按设备当地时间；纯日期不因时区少一天',()=>{
  assert.equal(timestamp('2026-09-27 14:47:17'),new Date(2026,8,27,14,47,17).getTime())
  assert.equal(timestamp('2024-02-29'),Date.UTC(2024,1,29))
  assert.equal(timestamp('0099-09-27T00:00:00Z'),Date.parse('0099-09-27T00:00:00Z'))
})

test('不存在日期和非法时间不归一化成别的时间，缺失不伪装为当前时间',()=>{
  for (const value of [null,undefined,true,{},'', 'invalid','0000-01-01','2025-02-29','2026-04-31','2026-13-01','2026-01-00','2026-09-27T24:00:00Z','2026-09-27T00:60:00Z','2026-09-27T00:00:60Z','2026-09-27T00:00:00+24:00','2026-09-27T00:00:00+08:60',Infinity]) {
    assert.equal(Number.isNaN(timestamp(value)),true,String(value))
    assert.equal(dateTimeLabel(value),'—')
  }
  assert.equal(timestamp(0),0)
})

test('失效和非法有效期不能作为未来缓存；到期当刻即失效',()=>{
  const now=Date.UTC(2026,8,27,18)
  for (const value of [null,undefined,'','bad','2026-02-30T12:00:00Z',Infinity,0,now-1,now,'2026-09-27T14:00:00-04:00']) assert.equal(isFutureTimestamp(value,now),false)
  for (const value of [now+1,String(now+1),new Date(now+1),'2026-09-27T18:00:01Z','2026-09-28T02:00:01+08:00']) assert.equal(isFutureTimestamp(value,now),true)
})
