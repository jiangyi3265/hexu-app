import test from 'node:test'
import assert from 'node:assert/strict'
import {stepperInput,shiftStepper} from '../data/stepper-input.mjs'
import {refundApplicationPayload} from '../data/aftersale.js'

test('数量框保留无效输入供页面显示和提交校验，不沿用之前的有效数量', () => {
 const order={id:'HXtest',rawStatus:'PAID',items:[{lineId:7,qty:2,refunded_qty:0}]}
 const application={order,lineId:7,type:'部分退款',reason:'商品破损'}
 for(const raw of ['0','','01','1.5','abc','1000000000']){
  const input=stepperInput(raw)
  assert.deepEqual(input,{valid:false,value:raw})
  assert.throws(()=>refundApplicationPayload({...application,quantity:input.value}))
 }
 assert.deepEqual(stepperInput('1'),{valid:true,value:1})
 assert.deepEqual(stepperInput('999999999'),{valid:true,value:999999999})
})

test('数量按钮将无效输入复位为一，并保持合法范围', () => {
 assert.equal(shiftStepper('0',1),1)
 assert.equal(shiftStepper('',1),1)
 assert.equal(shiftStepper('abc',-1),1)
 assert.equal(shiftStepper('1',1),2)
 assert.equal(shiftStepper('2',-1),1)
 assert.equal(shiftStepper('999999999',1),999999999)
})

test('售后数量按钮不能超过剩余可售后数量', () => {
 assert.equal(shiftStepper('1',1,1),1)
 assert.equal(shiftStepper('0',1,1),1)
 assert.equal(shiftStepper('2',-1,1),1)
 assert.equal(shiftStepper('1',1,0),0)
})
