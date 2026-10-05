import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const ui = fs.readFileSync(new URL('../components/UiBlock.vue', import.meta.url), 'utf8')
const handler = ui.match(/^async function changePhone\(event\)\{[\s\S]*?^\}/m)?.[0]
assert.ok(handler, '手机号授权处理器必须存在')

function harness(authorize) {
  const backend = {member:{id:201},token:'member-201',busy:false}
  const form = {_hydrated:true,_profileMemberId:201,phone:'13800138000'}
  const props = {form}, componentActive = {value:true}, toasts = [], calls = []
  const sandbox = {backend,props,componentActive,Number,toast:message=>toasts.push(message),
    authorizeProfilePhone:async (code, target)=>{calls.push([code,target]);return authorize?.(backend,props,componentActive)}}
  vm.runInNewContext(handler + '\nglobalThis.changePhone=changePhone', sandbox)
  return {backend,form,props,componentActive,toasts,calls,changePhone:sandbox.changePhone}
}

test('M26 手机号授权只向当前资料页显示请求失败',async()=>{
  const current=harness(()=>{throw new Error('授权失败')})
  await current.changePhone({detail:{code:'wechat-code'}})
  assert.deepEqual(current.toasts,['授权失败'])
  assert.equal(current.backend.busy,false)
  assert.equal(current.calls[0][1],current.form)

  const changed=harness(backend=>{backend.member={id:202};backend.token='member-202';throw new Error('旧账号授权失败')})
  await changed.changePhone({detail:{code:'wechat-code'}})
  assert.deepEqual(changed.toasts,[])
  assert.equal(changed.backend.busy,false)

  const reopened=harness((backend,props)=>{props.form={_hydrated:true,_profileMemberId:201};throw new Error('旧页面授权失败')})
  await reopened.changePhone({detail:{code:'wechat-code'}})
  assert.deepEqual(reopened.toasts,[])

  const unloaded=harness((backend,props,active)=>{active.value=false;throw new Error('已卸载页面授权失败')})
  await unloaded.changePhone({detail:{code:'wechat-code'}})
  assert.deepEqual(unloaded.toasts,[])
})

test('M26 无手机号授权凭证或正在处理时不重复发起请求',async()=>{
  const missing=harness()
  await missing.changePhone({detail:{}})
  assert.deepEqual(missing.calls,[])
  const busy=harness()
  busy.backend.busy=true
  await busy.changePhone({detail:{code:'wechat-code'}})
  assert.deepEqual(busy.calls,[])
})
