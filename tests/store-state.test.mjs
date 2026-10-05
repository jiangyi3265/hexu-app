import test from 'node:test'
import assert from 'node:assert/strict'
import {initialState} from '../data/store-state.mjs'

test('冷启动不从缓存展示上一账号业务数据，保留付款核对上下文',()=>{
  const saved={cart:[{id:'old'}],favorites:['old'],addresses:[{name:'旧地址'}],orders:[{id:'old-order'}],notifications:[{message:'旧消息'}],points:321,shopPoints:99,balance:456,shop:'旧商城',changes:{M26:{result:'已保存'}},signedIn:true,signedToday:true,serverHydrated:true,serverCartId:'old-cart',serverFavoriteId:'old-favorite',couponId:'old-coupon',lastWithdrawal:{id:'old-withdrawal'},lastTransferReceipt:{id:'old-transfer'},lastRedemption:{id:'old-redeem'},pendingTransfer:{recipientName:'旧接收人'},pendingPaymentOrder:'pay-check',cartCheckouts:{'pay-check':{memberId:201,shopId:2,items:[{id:'sku',qty:1}]}}}
  const next=initialState(saved)
  for(const key of ['cart','favorites','addresses','orders','notifications'])assert.deepEqual(next[key],[])
  for(const key of ['points','shopPoints','balance'])assert.equal(next[key],0)
  for(const key of ['serverCartId','serverFavoriteId','couponId','lastWithdrawal','lastTransferReceipt','lastRedemption','pendingTransfer'])assert.equal(next[key],null)
  assert.equal(next.shop,'')
  assert.equal(next.signedIn,false)
  assert.equal(next.signedToday,false)
  assert.equal(next.serverHydrated,false)
  assert.deepEqual(next.changes,{})
  assert.equal(next.pendingPaymentOrder,'pay-check')
  assert.deepEqual(next.cartCheckouts,saved.cartCheckouts)
  assert.deepEqual(saved.cart,[{id:'old'}])
})

test('损坏或数组形式的本地状态不能覆盖业务空态',()=>{
  for(const saved of [null,[],42,'bad']){
    const next=initialState(saved)
    assert.deepEqual(next.cart,[])
    assert.equal(next.points,0)
    assert.equal(next.serverHydrated,false)
  }
})

test('冷启动只保留带账号商城范围的提现单号，不回显提现数据',()=>{
  const view={id:'TX6f0a7e7cb0be42c9a07844bad45b58a0',memberId:201,shopId:2}
  assert.deepEqual(initialState({withdrawalView:view,lastWithdrawal:{amount:1000}}).withdrawalView,view)
  assert.equal(initialState({withdrawalView:view,lastWithdrawal:{amount:1000}}).lastWithdrawal,null)
  assert.equal(initialState({withdrawalView:{...view,id:'bad'}}).withdrawalView,null)
})

test('冷启动仅保留积分开关的账号范围，等待服务端身份回读后再应用',()=>{
  const checkoutPoints={memberId:201,shopId:2,usePoints:true}
  const state=initialState({checkoutPoints,points:5,cart:[{id:'paper'}]})
  assert.deepEqual(state.checkoutPoints,checkoutPoints)
  assert.equal(state.points,0)
  assert.deepEqual(state.cart,[])
  assert.equal(initialState({checkoutPoints:'invalid'}).checkoutPoints,null)
})

test('实际 Store 冷启动不会回显旧账号缓存',async()=>{
  const priorUni=globalThis.uni
  globalThis.uni={getStorageSync:()=>({cart:[{id:'old'}],points:321,shop:'旧商城',signedIn:true,pendingPaymentOrder:'pay-check'}),setStorageSync:()=>{}}
  try{
    const {state}=await import('../data/store.js?cold-start-test')
    assert.deepEqual(state.cart,[])
    assert.equal(state.points,0)
    assert.equal(state.shop,'')
    assert.equal(state.signedIn,false)
    assert.equal(state.pendingPaymentOrder,'pay-check')
  }finally{
    if(priorUni===undefined)delete globalThis.uni
    else globalThis.uni=priorUni
  }
})
