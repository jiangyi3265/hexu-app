import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source=fs.readFileSync(new URL('../components/UiBlock.vue',import.meta.url),'utf8')
const chooseSource=source.slice(source.indexOf('function choose(){'),source.indexOf('function removeUpload(i)'))
assert.ok(chooseSource.startsWith('function choose(){'))

function fixture(route='pages/M10/index'){
 const form={uploads:[],_reviewScope:'member:201:shop:2:order:HX1:sku:SKU1'}
 const reviewContext={shopId:2,orderId:'HX1',skuId:'SKU1'}
 const backend={member:{id:201},token:'token-a',shopId:2,activeOrder:{id:'HX1'},reviewContext}
 const state={activeOrder:'HX1',reviewSku:'SKU1',reviewParent:null}
 const componentActive={value:true},props={form},uploads={value:[]},toasts=[],updates=[]
 let chooser,finishUpload
 const pending=new Promise(resolve=>{finishUpload=resolve})
 const sandbox={props,backend,state,componentActive,uploads,toast:message=>toasts.push(message),getCurrentPages:()=>[{route}],uni:{chooseImage:options=>{chooser=options}},uploadAttachment:()=>pending,set:(key,value)=>updates.push([key,value]),JSON,Number,Math}
 vm.createContext(sandbox)
 vm.runInContext(chooseSource+'\nglobalThis.choose=choose',sandbox)
 return {form,backend,state,componentActive,toasts,updates,choose:sandbox.choose,pick:()=>chooser.success({tempFilePaths:['/tmp/review.png']}),finishUpload}
}

test('原生选图导致同页上传组件重建后，成功附件仍写回评价草稿',async()=>{
 const f=fixture()
 f.choose()
 const done=f.pick()
 f.componentActive.value=false
 f.backend.token='renewed-token'
 f.finishUpload({id:'FILE'+'a'.repeat(32)})
 await done
 assert.deepEqual(Array.from(f.form.uploads),['FILE'+'a'.repeat(32)])
 assert.deepEqual(f.updates,[])
 assert.deepEqual(f.toasts,[])
})

test('选图期间切换订单后，旧附件不得写进新评价草稿',async()=>{
 const f=fixture()
 f.choose()
 const done=f.pick()
 f.state.activeOrder='HX2'
 f.finishUpload({id:'FILE'+'b'.repeat(32)})
 await done
 assert.deepEqual(f.form.uploads,[])
})

test('非评价上传仍遵守组件与令牌保护',async()=>{
 const f=fixture('pages/M29/index')
 f.choose()
 const done=f.pick()
 f.componentActive.value=false
 f.finishUpload({id:'FILE'+'c'.repeat(32)})
 await done
 assert.deepEqual(f.form.uploads,[])
 assert.deepEqual(f.updates,[])
})
