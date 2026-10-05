import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {backDeltaTo,backDestination} from '../data/address-navigation.mjs'

const page = id => ({route:`pages/${id}/index`})

test('售后和物流返回已经存在的订单页，不再新开订单页形成循环', async()=>{
  assert.equal(backDeltaTo([page('M17'),page('M18'),page('M20'),page('M21'),page('M23')],'M18'),3)
  assert.equal(backDeltaTo([page('M17'),page('M18'),page('M19')],'M18'),1)
  assert.equal(backDeltaTo([page('M18')],'M18'),0)
  assert.equal(backDeltaTo([page('M23')],'M18'),0)
  const screen=await readFile(new URL('../components/DesignScreen.vue',import.meta.url),'utf8')
  assert.match(screen,/if\(target==='M18'&&\['M19','M23','M24'\]\.includes\(pageId\)\)\{returnToOrderDetail\(\);return\}/)
  assert.match(screen,/uni\.navigateBack\(\{delta,fail:\(\)=>uni\.redirectTo\(\{url\}\)\}\)/)
})

test('自定义返回跳过重复页面，单页启动时返回商城首页',()=>{
  const fallback='/pages/M03/index'
  assert.deepEqual(backDestination([page('M36'),page('M41')],'pages/M41/index',fallback),{delta:1,url:'/pages/M36/index'})
  assert.deepEqual(backDestination([page('M36'),page('M41'),page('M41')],'pages/M41/index',fallback),{delta:2,url:'/pages/M36/index'})
  assert.deepEqual(backDestination([page('M41')],'pages/M41/index',fallback),{delta:0,url:fallback})
  assert.deepEqual(backDestination([page('M41'),page('M41')],'pages/M41/index',fallback),{delta:0,url:fallback})
  assert.deepEqual(backDestination([{route:'/pages/M41/index'},page('M41')],'pages/M41/index',fallback),{delta:0,url:fallback})
})
