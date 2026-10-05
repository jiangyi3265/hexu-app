import test from 'node:test'
import assert from 'node:assert/strict'
import {notificationText} from '../data/notification-display.mjs'

test('旧审核消息的状态码在列表和详情中本地化，不修改其他通知', async () => {
  assert.equal(notificationText('申请处理结果：APPROVED'), '申请处理结果：审核通过')
  assert.equal(notificationText('申请处理结果：REJECTED'), '申请处理结果：审核未通过')
  assert.equal(notificationText('申请处理结果：SUPPLEMENT'), '申请处理结果：待补充资料')
  assert.equal(notificationText('申请处理结果：APPROVED', 'review'), '商品评价审核：审核通过')
  assert.equal(notificationText('申请处理结果：REJECTED', 'review_append'), '商品追评审核：审核未通过')
  assert.equal(notificationText('订单支付成功'), '订单支付成功')
  assert.equal(notificationText('申请处理结果：UNKNOWN'), '申请处理结果：UNKNOWN')
})
