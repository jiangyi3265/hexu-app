import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {loadPure} from './helpers/pure-module.mjs'

const {beginCheckout,checkoutLinesReady} = await loadPure('cart-checkout.js')
const {cartProductSnapshot,cartDisplayProduct} = await loadPure('cart-item-display.mjs')

test('重新结算时清除上一单优惠券和买家留言', async () => {
  const state={buyNow:{id:'paper',qty:1},couponId:'paper-only-coupon'}
  beginCheckout(state,{id:'oil',qty:1,selected:true})
  assert.deepEqual(state,{buyNow:{id:'oil',qty:1,selected:true},couponId:null,checkoutPoints:null})
  state.couponId='another-coupon'
  beginCheckout(state)
  assert.deepEqual(state,{buyNow:null,couponId:null,checkoutPoints:null})
  state.changes={M12:{remark:'上一单留言'}}
  state.checkoutPoints={memberId:201,shopId:2,usePoints:true}
  beginCheckout(state)
  assert.deepEqual(state.changes,{})
  assert.equal(state.checkoutPoints,null)
  const screen=await readFile(new URL('../components/DesignScreen.vue',import.meta.url),'utf8')
  assert.match(screen,/function buy\(\).*beginCheckout\(state,\{id:currentProduct\.value\.id,qty:qty\.value,selected:true\}\)/)
  assert.match(screen,/@tap="cartCheckout"/)
  assert.match(screen,/function cartCheckout\(\)\{beginCheckout\(state\);persist\(\);navigate\('M12'\)\}/)
})

test('缺失或非法商品不能按零元结算，全部真实商品才允许试算', () => {
  const catalog = [{id:'real',price:2990},{id:'other',price:0}]
  assert.equal(checkoutLinesReady([{id:'real',qty:1}],catalog),true)
  assert.equal(checkoutLinesReady([{id:'real',qty:1},{id:'other',qty:2}],catalog),true)
  for (const lines of [
    [], [{id:'removed',qty:1}],
    [{id:'real',qty:1},{id:'removed',qty:1}],
    [{id:'real',qty:0}], [{id:'real',qty:1.5}],
    [{id:'no-price',qty:1}]
  ]) assert.equal(checkoutLinesReady(lines,[...catalog,{id:'no-price',price:null}]),false)
})

test('购物车与确认订单在无效商品或未完成报价时隐藏假金额并禁用提交', async () => {
  const screen = await readFile(new URL('../components/DesignScreen.vue',import.meta.url),'utf8')
  assert.match(screen,/cartDisplayProduct\(line,products\)\.unavailable\?'暂不可售':'¥'\+money\(cartDisplayProduct\(line,products\)\.price\)/)
  assert.match(screen,/cartDisplayProduct\(line,products\)\.unavailable.*SKU \{\{line\.id\}\}/)
  assert.match(screen,/accountDataReady&&selectedLinesReady\?'¥'\+money\(total\):'—'/)
  assert.match(screen,/screen\.layout==='checkout'&&accountDataReady&&selectedLinesReady/)
  assert.match(screen,/checkoutQuote\?'¥'\+money\(payTotal\):'—'/)
  assert.match(screen,/'is-disabled':!checkoutQuote\|\|backend\.cartMutating\|\|backend\.busy/)
  assert.match(screen,/const version=\+\+quoteVersion;checkoutQuote\.value=null;quoteError\.value='';\s*if\(pageId!=='M12'\|\|createdCheckoutOrder\.value\|\|!backend\.ready\|\|!state\.serverHydrated\|\|!selectedLinesReady\.value\)return/)
  assert.match(screen,/v-if="quoteError" class="card"/)
  assert.match(screen,/返回修改数量/)
})

test('失效购物车保留商品识别信息但不得据旧快照重新结算', () => {
  const active={id:'sku-1',name:'端测纸巾',spec:'24包装',asset:'cup',price:2000}
  const line={id:active.id,qty:1,selected:true,snapshot:cartProductSnapshot(active)}
  const unavailable=cartDisplayProduct(line,[])
  assert.equal(unavailable.name,'端测纸巾')
  assert.equal(unavailable.spec,'24包装')
  assert.equal(unavailable.asset,'cup')
  assert.equal(unavailable.unavailable,true)
  assert.equal(checkoutLinesReady([line],[]),false)
  assert.deepEqual(cartDisplayProduct(line,[{...active,name:'新名称'}]),{...active,name:'新名称',unavailable:false})
  assert.equal(cartDisplayProduct({id:'legacy'},[]).name,'商品暂不可售')
})
