import test from 'node:test'
import assert from 'node:assert/strict'
import {loadPure} from './helpers/pure-module.mjs'

const {refundApplicationPayload} = await loadPure('aftersale.js')
const file = 'FILE' + 'a'.repeat(32)
const order = {id:'real-order',rawStatus:'PAID',items:[{lineId:7,id:'real-sku',qty:3,refunded_qty:1}]}
const base = {order,lineId:7,quantity:1,type:'退货退款',reason:' 商品破损 ',description:' 具体问题 ',uploads:[file]}

test('售后申请仅提交后端消费字段，不把空数量转换为1件',()=>{
 assert.deepEqual(refundApplicationPayload({...base,formShopId:99,memberId:202}),{id:'real-order',lineId:7,qty:1,type:'RETURN',reason:'商品破损',description:'具体问题',uploads:[file]})
 for(const quantity of ['',0,'0',null,undefined,'abc','1.5','1e0',true,3,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>refundApplicationPayload({...base,quantity}),String(quantity))
})

test('售后申请不得超出当前订单行余额、绕过进行中售后或直发客户数量',()=>{
 for(const change of [{quantity:3},{lineId:8},{refunds:[{line_id:7,status:'PENDING'}]},{directQuantity:2}])assert.throws(()=>refundApplicationPayload({...base,...change}))
 assert.equal(refundApplicationPayload({...base,quantity:2,directQuantity:2}).qty,2)
})

test('售后类型、订单状态、原因、描述与图片遵守后端字段契约',()=>{
 for(const type of ['仅退款','退货退款','部分退款','换货'])assert.ok(refundApplicationPayload({...base,type}).type)
 for(const change of [
  {type:'未知类型'},{type:'toString'},{order:{...order,rawStatus:'UNPAID'}},{reason:''},{reason:'a'},{reason:'坏\u0000货'},
  {reason:'字'.repeat(501)},{description:'字'.repeat(501)},{description:'坏\u0085货'},
  {uploads:[file,file]},{uploads:['/tmp/a.png']},{uploads:Array.from({length:10},(_,i)=>'FILE'+i.toString(16).padStart(32,'0'))}
 ])assert.throws(()=>refundApplicationPayload({...base,...change}))
})
