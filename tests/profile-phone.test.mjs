import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'

const source=readFileSync(new URL('../components/UiBlock.vue',import.meta.url),'utf8')
const handler=source.match(/^function inputPhone\(key,value\)\{.*\}$/m)?.[0]

test('手机号输入时过滤中文、符号和超长粘贴内容',()=>{
  assert.ok(handler)
  const updates=[]
  const context={set:(key,value)=>updates.push([key,value])}
  vm.runInNewContext(`${handler}\nglobalThis.inputPhone=inputPhone`,context)
  assert.equal(context.inputPhone('contactPhone','脚后跟139-0013-9000'),'13900139000')
  assert.equal(context.inputPhone('contactPhone','13900139000123'),'13900139000')
  assert.equal(context.inputPhone('contactPhone','中文'),'')
  assert.deepEqual(updates,[['contactPhone','13900139000'],['contactPhone','13900139000'],['contactPhone','']])
})
