import test from 'node:test'
import assert from 'node:assert/strict'
import {checkoutDiscountLabel} from '../data/checkout-discount.mjs'

test('M12 费用明细按实际折扣来源命名', () => {
  assert.equal(checkoutDiscountLabel(null), '优惠券')
  assert.equal(checkoutDiscountLabel({promotionDiscount:100,couponDiscount:0}), '活动优惠')
  assert.equal(checkoutDiscountLabel({promotionDiscount:0,couponDiscount:100}), '优惠券')
  assert.equal(checkoutDiscountLabel({promotionDiscount:100,couponDiscount:50}), '活动及优惠券')
  assert.equal(checkoutDiscountLabel({promotionDiscount:100,couponDiscount:0}, true), '拼团优惠')
})
