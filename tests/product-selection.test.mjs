import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {productQuantity,purchaseQuantityLimit} from '../data/product-selection.mjs'

test('M07 授权数量和库存共同限制可选数量',()=>{
  assert.equal(purchaseQuantityLimit({stock:320,crossPurchaseRemaining:2}),2)
  assert.equal(purchaseQuantityLimit({stock:1,crossPurchaseRemaining:2}),1)
  assert.equal(purchaseQuantityLimit({stock:320}),320)
  assert.equal(purchaseQuantityLimit({stock:320,crossPurchaseRemaining:0}),0)
})

test('M07 数量只在同商城、同会员、同 SKU 回到详情时沿用，库存变化后裁剪',()=>{
  const selected={shopId:2,memberId:201,productId:'sku-a',qty:3}
  assert.equal(productQuantity(selected,2,201,'sku-a',5),3)
  assert.equal(productQuantity(selected,2,201,'sku-a',2),2)
  assert.equal(productQuantity(selected,3,201,'sku-a',5),1)
  assert.equal(productQuantity(selected,2,202,'sku-a',5),1)
  assert.equal(productQuantity(selected,2,201,'sku-b',5),1)
  assert.equal(productQuantity({...selected,qty:0},2,201,'sku-a',5),1)
  assert.equal(productQuantity({...selected,qty:1.5},2,201,'sku-a',5),1)
  assert.equal(productQuantity(selected,2,201,'sku-a',0),1)
})

test('M07 实际步进处理器阻止零、负数、超库存，返回 M05 时恢复有效数量',()=>{
  const source=fs.readFileSync(new URL('../components/DesignScreen.vue',import.meta.url),'utf8')
  const lines=source.split(/\r?\n/).filter(line=>/^function (syncProductQty|setProductQty|selectVariant)\(/.test(line))
  assert.equal(lines.length,3)
  const context={screen:{layout:'sku'},qty:{value:1},backend:{shopId:2,productSelection:null,guest:false},selectionMemberId:{value:201},currentProduct:{value:{id:'sku-a',stock:3}},state:{selectedProduct:'sku-a'},form:{},productQuantity,purchaseQuantityLimit,persist:()=>{}}
  vm.runInNewContext(lines.join('\n')+'\nglobalThis.actions={syncProductQty,setProductQty,selectVariant}',context)
  context.actions.setProductQty(3)
  assert.equal(context.qty.value,3)
  assert.equal(context.backend.productSelection.qty,3)
  for(const invalid of [0,-1,1.5,4,NaN])context.actions.setProductQty(invalid)
  assert.equal(context.qty.value,3)
  context.currentProduct.value.stock=undefined;context.actions.setProductQty(2)
  assert.equal(context.qty.value,3)
  context.currentProduct.value.stock=3
  context.screen.layout='product';context.qty.value=1
  context.actions.syncProductQty()
  assert.equal(context.qty.value,3)
  context.currentProduct.value={id:'sku-a',stock:2};context.actions.syncProductQty()
  assert.equal(context.qty.value,2)
  context.currentProduct.value={id:'sku-a',stock:320,crossPurchaseRemaining:2};context.actions.setProductQty(3)
  assert.equal(context.qty.value,2)
  context.backend.productSelection.qty=3;context.actions.syncProductQty()
  assert.equal(context.qty.value,2)
  context.actions.selectVariant({id:'sku-b',spec:'蓝色'})
  assert.equal(context.state.selectedProduct,'sku-b')
  assert.equal(context.backend.productSelection,null)
  assert.equal(context.qty.value,1)
  assert.match(source,/:disabled="!canIncreaseProductQty"/)
  assert.match(source,/qty\.value>purchaseQuantityLimit\(currentProduct\.value\)/)
})

test('M02/M04/M05/M07 登录后缺货商品禁用购买与加购，访客仍可进入登录',()=>{
  const source=fs.readFileSync(new URL('../components/DesignScreen.vue',import.meta.url),'utf8')
  const helper=source.split(/\r?\n/).find(line=>line.startsWith('function isSoldOut('))
  assert.ok(helper)
  const context={backend:{guest:false},purchaseQuantityLimit}
  vm.runInNewContext(helper+'\nglobalThis.isSoldOut=isSoldOut',context)
  assert.equal(context.isSoldOut({stock:0}),true)
  assert.equal(context.isSoldOut({stock:undefined}),true)
  assert.equal(context.isSoldOut({stock:2}),false)
  context.backend.guest=true
  assert.equal(context.isSoldOut({stock:0}),false)
  assert.equal((source.match(/:disabled="isSoldOut\(/g)||[]).length,4)
  assert.match(source,/isSoldOut\(currentProduct\)\?'暂时缺货':'立即购买'/)
})

test('M06 无本商城代理资格时仍显示零售价并解释代理价审核条件',()=>{
  const source=fs.readFileSync(new URL('../components/DesignScreen.vue',import.meta.url),'utf8')
  assert.match(source,/v-if="screen\.agent&&!backend\.agent"/)
  assert.match(source,/当前按零售价展示，通过本商城代理审核后可查看代理价/)
  assert.match(source,/登录并通过本商城代理审核后可查看代理价/)
})
