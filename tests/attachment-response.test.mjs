import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const backendSource=fs.readFileSync(new URL('../data/backend.js',import.meta.url),'utf8')
const handler=backendSource.match(/^export async function uploadAttachment[\s\S]*?(?=^const documentKinds=)/m)?.[0]
assert.ok(handler,'真实附件上传请求处理器必须存在')

function harness(response){
 const backend={ready:true,member:{id:201},token:'member-201-token',shopId:2,uploadingCount:0}
 const calls=[]
 const sandbox={backend,state:{},apiBase:'',connect:async()=>true,
  uni:{uploadFile:options=>{calls.push(options);response instanceof Error?options.fail():options.success(response)}}}
 vm.runInNewContext(handler.replace(/^export /,'')+'\nglobalThis.uploadAttachment=uploadAttachment',sandbox)
 return {backend,calls,upload:sandbox.uploadAttachment}
}

test('附件上传只接受有效服务端ID并释放上传中状态',async()=>{
 const id='FILE'+'a'.repeat(32),h=harness({statusCode:200,data:JSON.stringify({code:200,data:{id,mime:'image/png'}})})
 const uploaded=await h.upload('/tmp/proof.png','AVATAR',0)
 assert.equal(uploaded.id,id)
 assert.equal(h.calls[0].header.Authorization,'Bearer member-201-token')
 assert.equal(h.calls[0].formData.purpose,'AVATAR')
 assert.equal(h.backend.uploadingCount,0)
})

test('附件上传的伪成功、无效ID和坏JSON不能写入表单',async()=>{
 const id='FILE'+'a'.repeat(32)
 for(const response of [
  {statusCode:500,data:JSON.stringify({code:200,data:{id}})},
  {statusCode:200,data:JSON.stringify({code:200,data:{}})},
  {statusCode:200,data:JSON.stringify({code:200,data:{id:'not-an-attachment'}})},
  {statusCode:200,data:'not-json'}
 ]){
  const h=harness(response)
  await assert.rejects(()=>h.upload('/tmp/proof.png','AVATAR',0))
  assert.equal(h.backend.uploadingCount,0)
 }
})

test('附件上传网络失败后允许重试',async()=>{
 const h=harness(new Error('offline'))
 await assert.rejects(()=>h.upload('/tmp/proof.png','AVATAR',0),/图片上传失败/)
 assert.equal(h.backend.uploadingCount,0)
})
