import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('离线状态不把未读取订单和收藏误判为空',async()=>{
  const [screen,block]=await Promise.all([
    readFile(new URL('../components/DesignScreen.vue',import.meta.url),'utf8'),
    readFile(new URL('../components/UiBlock.vue',import.meta.url),'utf8')
  ])
  assert.match(screen,/v-if="accountDataReady&&!favoriteTabProducts\.length"[^>]*>/)
  assert.match(screen,/暂无收藏商品，去商城看看吧/)
  assert.match(screen,/暂无浏览记录，去商城看看吧/)
  assert.match(block,/v-if="!visibleOrders\.length&&backend\.ready&&state\.serverHydrated"[^>]*class="empty-state"/)
})

test('分类游客目录可显示真空态，购物车离线时隐藏假数量和结算金额',async()=>{
  const screen=await readFile(new URL('../components/DesignScreen.vue',import.meta.url),'utf8')
  assert.match(screen,/catalogDataReady=computed\(\(\)=>accountDataReady\.value\|\|backend\.guest\)/)
  assert.match(screen,/v-if="!catalogDataReady" class="notice"/)
  assert.match(screen,/v-else-if="!categoryProducts\.length"/)
  assert.match(screen,/v-if="accountDataReady&&!state\.cart\.length"/)
  assert.match(screen,/accountDataReady\?cartQuantity:'—'/)
  assert.match(screen,/accountDataReady&&selectedLinesReady\?'¥'\+money\(total\):'—'/)
})

test('商品、结算、提现与积分转赠在业务数据未读到时不渲染假价格和可提交按钮',async()=>{
  const screen=await readFile(new URL('../components/DesignScreen.vue',import.meta.url),'utf8')
  for(const layout of ['product','checkout','withdrawal','transfer']){
    assert.match(screen,new RegExp(`screen\\.layout==='${layout}'[^>]*accountDataReady|accountDataReady[^>]*screen\\.layout==='${layout}'|screen\\.layout==='${layout}'[^>]*catalogDataReady`))
  }
  assert.match(screen,/class="bottom-bar product-bottom"/)
  assert.match(screen,/&&catalogDataReady&&currentProduct\.id" class="bottom-bar product-bottom"/)
  assert.match(screen,/catalogDataReady" class="notice">商品暂不可售，请返回列表重新选择/)
})
