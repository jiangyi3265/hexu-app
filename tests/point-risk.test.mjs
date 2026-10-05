import test from 'node:test'
import assert from 'node:assert/strict'
import {pointRiskPayload} from '../data/point-risk.mjs'

const valid = () => ({
  单笔上限: '1000', 每日累计上限: '5000', 月累计上限: '30000',
  frequencyEnabled: true, 每日最多次数: '10', windowCount: '5',
  windowSeconds: '60', 异常账户冻结: true,
})

test('G50 accepts and normalizes a valid risk configuration', () => {
  assert.deepEqual(pointRiskPayload(valid()), {
    singleLimit: 1000, dailyLimit: 5000, monthlyLimit: 30000,
    frequencyEnabled: true, dailyCount: 10, windowCount: 5,
    windowSeconds: 60, autoFreeze: true,
  })
})

test('G50 rejects non-integer and out-of-order limits before request', () => {
  for (const patch of [
    {单笔上限: '6000'}, {单笔上限: '0'}, {每日累计上限: '30001'},
    {单笔上限: '1.5'}, {单笔上限: '-1'}, {单笔上限: '9007199254740992'},
  ]) assert.throws(() => pointRiskPayload({...valid(), ...patch}))
})

test('G50 matches server frequency bounds when enabled', () => {
  for (const patch of [
    {每日最多次数: '0'}, {每日最多次数: '10001'},
    {windowCount: '0'}, {windowCount: '11'},
    {windowSeconds: '9'}, {windowSeconds: '86401'},
  ]) assert.throws(() => pointRiskPayload({...valid(), ...patch}))
  assert.equal(pointRiskPayload({...valid(), frequencyEnabled: false, 每日最多次数: '', windowCount: '', windowSeconds: ''}).dailyCount, 0)
})
