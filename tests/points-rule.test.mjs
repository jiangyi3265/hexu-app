import test from 'node:test'
import assert from 'node:assert/strict'
import {pointsRulePayload} from '../data/points-rule.mjs'

const valid = () => ({
  消费每1元赠送: '1', 每日签到赠送: '5', 评价赠送: '10',
  '有效期（天）': '365', 每1元所需积分: '100', '最高抵扣比例（%）': '20',
})

test('G48 normalizes a valid points rule', () => {
  assert.deepEqual(pointsRulePayload(valid()), {
    kind: 'points_rule', purchaseRate: 1, checkinPoints: 5,
    reviewPoints: 10, expiryDays: 365, pointsPerYuan: 100,
    deductionPercent: 20,
  })
})

test('G48 rejects every server-side numeric boundary before request', () => {
  for (const patch of [
    {消费每1元赠送: '101'}, {每日签到赠送: '101'}, {评价赠送: '101'},
    {'有效期（天）': '36501'}, {每1元所需积分: '0'},
    {'最高抵扣比例（%）': '21'}, {'最高抵扣比例（%）': '1.5'},
    {'最高抵扣比例（%）': '-1'}, {'最高抵扣比例（%）': ''},
  ]) assert.throws(() => pointsRulePayload({...valid(), ...patch}))
})
