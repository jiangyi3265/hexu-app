import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const ui=fs.readFileSync(new URL('../components/UiBlock.vue',import.meta.url),'utf8')
const handler=ui.match(/^function choose\(\)\{[\s\S]*?^\}/m)?.[0]
assert.ok(handler,'通用图片选择处理器必须存在')

function harness(onUpload){
 const backend={member:{id:201},token:'member-201-token',shopId:2,reviewContext:null,uploadingCount:0}
 const state={activeOrder:null,reviewSku:null,reviewParent:null}
 const props={form:{uploads:[]},block:{type:'upload'}}
 const componentActive={value:true},uploads={value:[]},calls=[],updates=[],toasts=[]
 let route='pages/G60/index',chooser
 const sandbox={backend,state,props,componentActive,uploads,
  toast:value=>toasts.push(value),set:(key,value)=>{updates.push([key,value]);props.form[key]=value},
  getCurrentPages:()=>[{route}],uni:{chooseImage:options=>{chooser=options}},
  uploadAttachment:async(...args)=>{calls.push(args);return onUpload?onUpload(result):{id:'FILE'+'a'.repeat(32)}}}
 vm.runInNewContext(handler+'\nglobalThis.choose=choose',sandbox)
 const result={backend,state,props,componentActive,calls,updates,toasts,choose:sandbox.choose,
  select:paths=>chooser.success({tempFilePaths:paths}),setRoute:value=>{route=value}}
 return result
}

test('通用上传在原商城页面正常保存服务端附件ID',async()=>{
 const h=harness()
 h.choose()
 await h.select(['/tmp/storefront.png'])
 assert.equal(h.calls.length,1)
 assert.deepEqual(h.calls[0].slice(0,2),['/tmp/storefront.png','STOREFRONT'])
 assert.equal(h.updates.length,1)
 assert.equal(h.updates[0][0],'uploads')
 assert.equal(h.updates[0][1][0],'FILE'+'a'.repeat(32))
})

test('M29 图片上传使用客服用途，返回的附件才能提交本人本店客服留言',async()=>{
 const h=harness()
 h.setRoute('pages/M29/index')
 h.choose()
 await h.select(['/tmp/support-test.png'])
 assert.deepEqual(h.calls[0].slice(0,3),['/tmp/support-test.png','SUPPORT',2])
 assert.equal(h.props.form.uploads.length,1)
})

test('通用上传选择器返回前切账号或切页面，不向新上下文上传',async()=>{
 const account=harness()
 account.choose()
 account.backend.member={id:202}
 account.backend.token='member-202-token'
 await account.select(['/tmp/proof.png'])
 assert.deepEqual(account.calls,[])
 assert.deepEqual(account.updates,[])

 const page=harness()
 page.choose()
 page.setRoute('pages/M10/index')
 await page.select(['/tmp/proof.png'])
 assert.deepEqual(page.calls,[])
 assert.deepEqual(page.updates,[])
})

test('通用上传请求中切账号或卸载，不回填旧附件到当前表单',async()=>{
 const account=harness(h=>{h.backend.member={id:202};h.backend.token='member-202-token';return {id:'FILE'+'a'.repeat(32)}})
 account.choose()
 await account.select(['/tmp/proof.png'])
 assert.equal(account.calls.length,1)
 assert.deepEqual(account.updates,[])

 const unmounted=harness(h=>{h.componentActive.value=false;return {id:'FILE'+'a'.repeat(32)}})
 unmounted.choose()
 await unmounted.select(['/tmp/proof.png'])
 assert.equal(unmounted.calls.length,1)
 assert.deepEqual(unmounted.updates,[])
})

test('通用上传换商城、换表单或评价订单后不沿用旧附件',async()=>{
 const shop=harness()
 shop.choose()
 shop.backend.shopId=3
 await shop.select(['/tmp/proof.png'])
 assert.deepEqual(shop.calls,[])

 const form=harness(h=>{h.props.form={uploads:[]};return {id:'FILE'+'a'.repeat(32)}})
 form.choose()
 await form.select(['/tmp/proof.png'])
 assert.equal(form.calls.length,1)
 assert.deepEqual(form.updates,[])

 const review=harness(h=>{h.backend.reviewContext.orderId='HX2';return {id:'FILE'+'a'.repeat(32)}})
 review.setRoute('pages/M10/index')
 review.backend.reviewContext={shopId:2,orderId:'HX1',skuId:'paper'}
 review.backend.activeOrder={id:'HX1'}
 review.state.activeOrder='HX1'
 review.state.reviewSku='paper'
 review.props.form._reviewScope='member:201:shop:2:order:HX1:sku:paper'
 review.choose()
 await review.select(['/tmp/review.png'])
 assert.equal(review.calls.length,1)
 assert.equal(review.calls[0][1],'REVIEW')
 assert.deepEqual(review.updates,[])
})
