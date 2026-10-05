import test from 'node:test'
import assert from 'node:assert/strict'
import {addressCheckoutPage} from '../data/address-navigation.mjs'

const page=route=>({route:`pages/${route}/index`})

test('地址选择只返回当前实际结算来源，不受旧采购状态影响',()=>{
 assert.equal(addressCheckoutPage([page('M11'),page('M12'),page('M13')]),'M12')
 assert.equal(addressCheckoutPage([page('G14'),page('G15'),page('M13')]),'G15')
 assert.equal(addressCheckoutPage([page('G15'),page('M25'),page('M13')]),null)
 assert.equal(addressCheckoutPage([page('M13')]),null)
})
