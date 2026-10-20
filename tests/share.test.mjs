import test from 'node:test'
import assert from 'node:assert/strict'
import {sharePayload} from '../data/share.mjs'

test('store and product cards retain the correct shop and SKU',()=>{
 assert.deepEqual(sharePayload('M03',{shopId:2,shopName:'安溪禾序商城'}),{
  title:'安溪禾序商城',path:'/pages/M03/index?shop=2'
 })
 assert.deepEqual(sharePayload('M05',{shopId:2,product:{id:'A&B',name:'精选商品'}}),{
  title:'精选商品',path:'/pages/M05/index?shop=2&sku=A%26B'
 })
})

test('invitation card is only issued for a current agent and unexpired invite',()=>{
 const invite={invite:'IV&1',shopId:2,agentId:37,expiresAt:'2099-01-01T00:00:00Z'}
 const context={shopId:2,shopName:'安溪禾序商城',agentId:37,invite}
 assert.equal(sharePayload('M34',context).path,'/pages/M35/index?shop=2&invite=IV%261')
 assert.equal(sharePayload('M34',{...context,agentId:38}).path,'/pages/M03/index?shop=2')
 assert.equal(sharePayload('M34',{...context,invite:{...invite,expiresAt:'2000-01-01T00:00:00Z'}}).path,'/pages/M03/index?shop=2')
})

test('only an active group produces a group card',()=>{
 assert.equal(sharePayload('M58',{shopId:1,group:{id:'G&1',status:'FORMING'}}).path,'/pages/M58/index?shop=1&group=G%261')
 assert.equal(sharePayload('M58',{shopId:1,group:{id:'G1',status:'FORMED'}}).path,'/pages/M02/index?shop=1')
})
