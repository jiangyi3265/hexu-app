import test from 'node:test'
import assert from 'node:assert/strict'
import {catalogEditorValues} from '../data/catalog-editor.mjs'

const form=()=>({商品编码:'cup',productGroup:'cup_group',retail:'89.00',cloud:'55',center:'45.0',owner:'35.00',可售库存:'108',weightGrams:'1000'})

test('商品编辑以精确分保存四档价格和整数库存',()=>{
 assert.deepEqual(catalogEditorValues(form()),{sku:'cup',productGroup:'cup_group',retail:8900,cloud_price:5500,center_price:4500,owner_price:3500,available:108,weightGrams:1000})
})

test('商品编辑拒绝三位小数和倒挂价格，不静默四舍五入',()=>{
 for(const [key,value] of [['retail','89.999'],['owner','0'],['retail','1000000.01'],['cloud','99.00']]){
  const draft=form();draft[key]=value
  assert.throws(()=>catalogEditorValues(draft))
 }
})

test('商品编辑拒绝空库存、非整数重量和非法编号',()=>{
 for(const [key,value] of [['可售库存',''],['可售库存','1.5'],['weightGrams','0'],['weightGrams','1.5'],['商品编码','商品'],['productGroup','含空格 编号']]){
  const draft=form();draft[key]=value
  assert.throws(()=>catalogEditorValues(draft))
 }
})
