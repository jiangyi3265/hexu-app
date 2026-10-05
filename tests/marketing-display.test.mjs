import test from 'node:test'
import assert from 'node:assert/strict'
import {marketingBlocks, marketingProductNames, marketingOffer} from '../data/marketing-display.mjs'

test('M56 shows backend activity quota, buyer limit, product, offer and Beijing times', () => {
  const campaign = {
    id: 'rule-1', kind: 'promotion_rule', available: true, remaining: 2, memberRemaining: 1,
    body: {name: '限时折扣', type: 'LIMITED', skuIds: 'stapler', rateBps: 9500,
      startsAt: Date.parse('2026-10-03T00:00:00+08:00'),
      expiresAt: Date.parse('2026-11-02T23:59:59+08:00')}
  }
  const blocks = marketingBlocks([campaign], [{id: 'stapler', name: '晨光订书机'}])
  assert.equal(blocks[0].subtitle, '有效活动，优惠在结算时核算')
  assert.deepEqual(blocks[1].items, [
    {label: '限时优惠', value: '选购商品', target: 'campaign:rule-1'},
    {label: '活动优惠', value: '9.5折'},
    {label: '活动商品', value: '晨光订书机'},
    {label: '活动时间', value: '2026-10-03 00:00 至 2026-11-02 23:59（北京时间 UTC+08:00）'},
    {label: '活动剩余', value: '2'},
    {label: '本人可参与', value: '1'}
  ])
  const soldOut = marketingBlocks([{...campaign, available: false, memberRemaining: 0}])
  assert.equal(soldOut[0].subtitle, '活动名额已满')
  assert.equal(soldOut[1].items[0].target, undefined)
  assert.equal(soldOut[1].items.at(-1).value, '0')
  const sameDay = marketingBlocks([{...campaign, body: {...campaign.body,
    name: '十月同日结束的限时优惠活动',
    startsAt: Date.parse('2026-10-05T10:00:00+08:00'),
    expiresAt: Date.parse('2026-10-05T14:30:00+08:00')}}])
  assert.equal(sameDay[1].title, '十月同日结束的限时优惠活动')
  assert.equal(sameDay[1].items[3].value, '2026-10-05 10:00 至 2026-10-05 14:30（北京时间 UTC+08:00）')
})

test('M56 format handles all-products, bundles and rule types', () => {
  assert.equal(marketingProductNames({kind: 'promotion_rule', body: {skuIds: ''}}), '全部商品')
  assert.equal(marketingProductNames({kind: 'bundle', body: {items: [{skuId: 'cup'}]}}, [{id: 'cup', name: '保温杯'}]), '保温杯')
  assert.equal(marketingOffer({type: 'FULL_REDUCTION', threshold: 20000, discount: 500}), '满¥200.00减¥5.00')
  assert.equal(marketingOffer({type: 'BUNDLE', price: 1500}), '活动价¥15.00')
  assert.equal(marketingBlocks([])[0].subtitle, '暂无进行中的活动')
})
