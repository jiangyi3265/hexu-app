import test from 'node:test'
import assert from 'node:assert/strict'
import {loadPure} from './helpers/pure-module.mjs'

const {couponCards, availableCouponCount, couponStackingBlocked, toggledCouponId} = await loadPure('coupons.js')
const now = Date.parse('2026-09-27T12:00:00Z')
const campaign = (id, type = 'FULL_REDUCTION') => ({id, kind:'coupon', status:'ACTIVE', body:{name:id,type,discount:500,threshold:3000,expiresAt:now+86400000}})
const claim = (id, campaignId, status = 'AVAILABLE', expiresAt = now+86400000, type = 'FULL_REDUCTION') => ({id, kind:'coupon_claim', campaign_ref:campaignId, status, body:{name:id,type,discount:500,threshold:3000,expiresAt}})

test('优惠券中心两个筛选维度独立：已领取券不重复显示活动，已使用与过期准确分类',()=>{
 const rows=[campaign('new'),campaign('claimed'),campaign('discount','DISCOUNT'),claim('mine','claimed'),claim('used','old','USED'),claim('expired','old-expired','AVAILABLE',now-1)]
 assert.deepEqual(couponCards(rows,{now}).map(x=>x.id),['new','discount','mine','used','expired'])
 assert.deepEqual(couponCards(rows,{status:'可使用',now}).map(x=>x.id),['mine'])
 assert.deepEqual(couponCards(rows,{status:'已使用',now}).map(x=>x.id),['used'])
 assert.deepEqual(couponCards(rows,{status:'已过期',now}).map(x=>x.id),['expired'])
 assert.deepEqual(couponCards(rows,{status:'全部',type:'折扣券',now}).map(x=>x.id),['discount'])
 assert.equal(availableCouponCount(rows,now),1)
})

test('结算仅提供本人未过期可用券；已领、已用、过期卡片不再触发重复领取',()=>{
 const rows=[campaign('new'),claim('mine','claimed'),claim('used','old','USED'),claim('expired','old-expired','AVAILABLE',now-1),claim('locked','in-order','LOCKED')]
 assert.deepEqual(couponCards(rows,{choose:true,now}).map(x=>x.id),['mine'])
 const cards=couponCards(rows,{now})
 assert.deepEqual(cards.map(x=>[x.id,x.uiAction,x.uiLabel]),[
  ['new','claim','领取'],['mine','','已领取'],['used','','已使用'],['expired','','已过期'],['locked','','使用中']
 ])
 assert.equal(availableCouponCount(rows,now),1)
})

test('限量券领完后直接显示已领完，旧接口未返回余量时仍可领取',()=>{
 const soldOut={...campaign('sold-out'),remainingQuantity:0}
 const available={...campaign('available'),remainingQuantity:1}
 const cards=couponCards([soldOut,available,campaign('legacy')],{now})
 assert.deepEqual(cards.map(x=>[x.uiAction,x.uiLabel,x.uiUnavailable]),[
  ['','已领完',true],['claim','领取',false],['claim','领取',false]
 ])
})

test('结算时指定商品券对完全不匹配的购物商品直接显示不可用',()=>{
 const paper=claim('paper-coupon','paper-campaign')
 paper.body.skuIds='paper, towel'
 const [wrong]=couponCards([paper],{choose:true,orderSkuIds:['oil'],now})
 assert.deepEqual([wrong.uiAction,wrong.uiLabel,wrong.uiUnavailable],['','不可用',true])
 const [matching]=couponCards([paper],{choose:true,orderSkuIds:['oil','paper'],now})
 assert.deepEqual([matching.uiAction,matching.uiLabel,matching.uiUnavailable],['select','选择',false])
})

test('实际活动明确禁止叠券时，结算选券入口标为不可叠加',()=>{
 assert.equal(couponStackingBlocked(null),false)
 assert.equal(couponStackingBlocked({couponStackable:true}),false)
 assert.equal(couponStackingBlocked({couponStackable:false}),true)
 assert.equal(couponStackingBlocked({promotions:[]}),false)
 assert.equal(couponStackingBlocked({promotions:[{body:{stackCoupon:true}}]}),false)
 assert.equal(couponStackingBlocked({promotions:[{body:{stackCoupon:false}}]}),true)
 const paper=claim('paper-coupon','paper-campaign')
 paper.body.skuIds='paper'
 const [blocked]=couponCards([paper],{choose:true,orderSkuIds:['paper'],stackBlocked:true,now})
 assert.deepEqual([blocked.uiAction,blocked.uiLabel,blocked.uiUnavailable],['','不可叠加',true])
 const [allowed]=couponCards([paper],{choose:true,orderSkuIds:['paper'],stackBlocked:false,now})
 assert.deepEqual([allowed.uiAction,allowed.uiLabel,allowed.uiUnavailable],['select','选择',false])
})

test('重复点击已选择的券可撤销，重新进入选券页以结算状态回显',async()=>{
 assert.equal(toggledCouponId('claim-a','claim-a'),'')
 assert.equal(toggledCouponId('claim-a','claim-b'),'claim-b')
 const {readFile}=await import('node:fs/promises')
 const screen=await readFile(new URL('../components/DesignScreen.vue',import.meta.url),'utf8')
 assert.match(screen,/if\(pageId==='M61'\)form\.coupon=state\.couponId\|\|''/)
 assert.match(screen,/if\(!form\.coupon&&state\.couponId\)\{state\.couponId=null;persist\(\);returnToCheckout\(\)/)
 assert.match(screen,/function returnToCheckout\(\)[\s\S]*?backDeltaTo\(getCurrentPages\(\),'M12'\)/)
})
