import test from 'node:test'
import assert from 'node:assert/strict'
import {inventoryReasonLabel, inventoryMatchesFilter, inventoryDeltaLabel} from '../data/inventory-ledger.mjs'

test('库存流水展示可售和锁定库存的真实变化', () => {
  assert.equal(inventoryReasonLabel('ORDER_LOCK'), '下单锁定')
  assert.equal(inventoryDeltaLabel({available_delta:-2, locked_delta:2}), '-2 可售 · +2 锁定')
  assert.equal(inventoryDeltaLabel({available_delta:0, locked_delta:-2}), '-2 锁定')
  assert.equal(inventoryDeltaLabel({available_delta:1, locked_delta:-1}), '+1 可售 · -1 锁定')
})

test('库存流水按业务分类筛选', () => {
  assert.equal(inventoryMatchesFilter({reason:'PURCHASE_RECEIVE'}, '采购入库'), true)
  assert.equal(inventoryMatchesFilter({reason:'PAID'}, '采购入库'), false)
  assert.equal(inventoryMatchesFilter({reason:'CANCEL'}, '销售出库'), true)
  assert.equal(inventoryMatchesFilter({reason:'RETURN'}, '售后回库'), true)
  assert.equal(inventoryReasonLabel('RETURN_DEFECTIVE'), '退货验收转残次')
  assert.equal(inventoryMatchesFilter({reason:'RETURN_DEFECTIVE'}, '售后回库'), true)
  assert.equal(inventoryDeltaLabel({defective_delta:1}), '+1 残次')
  assert.equal(inventoryMatchesFilter({reason:'STOCKTAKE'}, '盘点'), true)
  assert.equal(inventoryMatchesFilter({reason:'SHOP_MERGE_IN'}, '全部'), true)
})
