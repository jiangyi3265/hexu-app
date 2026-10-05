import test from 'node:test'
import assert from 'node:assert/strict'
import {matchesProduct, productMatchesSearch, stockSku} from '../data/product-search.mjs'

const product = {id:'cup', name:'禾序 316不锈钢保温杯'}

test('商品中心支持按名称和货号搜索', () => {
  assert.equal(productMatchesSearch(product, '保温杯'), true)
  assert.equal(productMatchesSearch(product, ' CUP '), true)
  assert.equal(stockSku(product), 'cup')
  assert.equal(productMatchesSearch(product, 'SKU cup'), true)
  assert.equal(productMatchesSearch(product, 'SKU HX-CUP'), false)
  assert.equal(productMatchesSearch(product, '不存在'), false)
  assert.equal(productMatchesSearch(product, ' '), true)
})

test('分类页可按名称、编码、品牌、规格和分类检索', () => {
  const item = {...product, brand:'禾序', spec:'500ml', category:'生活日用'}
  for (const keyword of ['保温杯', 'CUP', '禾序', '500ml', '生活日用']) {
    assert.equal(matchesProduct(item, keyword), true)
  }
  assert.equal(matchesProduct(item, '其他商品'), false)
})
