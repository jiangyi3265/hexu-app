import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source=fs.readFileSync(new URL('../data/backend.js',import.meta.url),'utf8')
const plain=value=>JSON.parse(JSON.stringify(value))

function fixture(){
 const requests=[],toasts=[],storage=new Map([['hexu-member-id',701]]),state={cart:[],favorites:[]}
 const uni={
  request:options=>requests.push(options),
  getStorageSync:key=>storage.get(key),
  setStorageSync:(key,value)=>storage.set(key,value),
  removeStorageSync:key=>storage.delete(key)
 }
 const sandbox={reactive:value=>value,state,products:[],persist:()=>{},toast:message=>toasts.push(message),navigate:()=>{},uni,getCurrentPages:()=>[],URLSearchParams,location:{search:'',hash:''},Date,Math,Promise,setTimeout,clearTimeout}
 vm.createContext(sandbox)
 vm.runInContext(source.replace(/^import .*$/mg,'').replace(/export\s*\{[^}]*\}/g,'').replace(/export /g,'').replace(/import\.meta\.env/g,'({DEV:true,VITE_HEXU_API:"http://127.0.0.1:8088"})')+'\nglobalThis.api={backend,request,apiCommand,enterGuestBrowsing,syncCart,syncFavorites,loadMarketingBuyer,handleRemote,marketingPreviewPayload}',sandbox)
 const {backend}=sandbox.api
 Object.assign(backend,{ready:true,guest:false,shopId:2,token:'token-a',member:{id:701}})
 const respond=(index,status,data={})=>{
  const request=requests[index]
  assert.ok(request,`missing request ${index}`)
  request.success({statusCode:status,data:{code:status,msg:status===401?'登录过期':'',data:plain(data)}})
 }
 const switchMember=()=>{backend.member={id:702};backend.token='token-b';storage.set('hexu-member-id',702)}
 return {...sandbox.api,state,storage,requests,toasts,respond,switchMember}
}

const tick=()=>new Promise(resolve=>setImmediate(resolve))
const documentWrites=requests=>requests.filter(item=>item.url.includes('/document-save'))

test('P1-1 旧会员地址 POST 的迟到 401 不以新会员 token、正文或幂等键重发',async()=>{
 const f=fixture()
 const pending=f.apiCommand('document-save',{kind:'address',name:'A 的草稿'})
 assert.equal(f.requests.length,1)
 assert.equal(f.requests[0].header.Authorization,'Bearer token-a')
 const firstBody=plain(f.requests[0].data),firstKey=f.requests[0].header['Idempotency-Key']
 f.switchMember()
 f.respond(0,401)
 await assert.rejects(pending,/账号或商城已变化/)
 assert.deepEqual(plain(f.requests[0].data),firstBody)
 assert.ok(firstKey)
 assert.equal(f.requests.length,1)
 assert.equal(documentWrites(f.requests).filter(item=>item.header.Authorization==='Bearer token-b').length,0)
 // 此处只证明没有第二次请求；真实数据库和审计需在联调环境单独回读。
})

test('同一会员沙盒续期仍保留原正文和幂等键，且只重发一次',async()=>{
 const f=fixture()
 const pending=f.apiCommand('document-save',{kind:'address',name:'A 的草稿'})
 const body=plain(f.requests[0].data),key=f.requests[0].header['Idempotency-Key']
 f.respond(0,401)
 await tick()
 assert.equal(f.requests.length,2)
 assert.match(f.requests[1].url,/\/hexu\/dev\/login$/)
 assert.equal(f.requests[1].data.memberId,701)
 assert.equal(f.requests[1].header.Authorization,undefined)
 f.respond(1,200,{token:'token-a-new'})
 await tick()
 assert.equal(f.requests.length,3)
 assert.equal(f.requests[2].header.Authorization,'Bearer token-a-new')
 assert.deepEqual(plain(f.requests[2].data),body)
 assert.equal(f.requests[2].header['Idempotency-Key'],key)
 f.respond(2,200,{id:'address-a'})
 assert.equal((await pending).id,'address-a')
})

test('延迟 401 期间页面改动嵌套草稿，合法同身份重试仍使用发起时正文',async()=>{
 const f=fixture(),draft={body:{name:'原草稿'}}
 const pending=f.request('/hexu/app/commands/document-save',draft,'POST','fixed-key')
 draft.body.name='新草稿'
 f.respond(0,401)
 await tick()
 f.respond(1,200,{token:'token-a-new'})
 await tick()
 assert.equal(f.requests[2].data.body.name,'原草稿')
 assert.equal(f.requests[2].header['Idempotency-Key'],'fixed-key')
 f.respond(2,200,{id:'address-a'})
 await pending
})

test('P2-1 进入游客后旧会员迟到 401 不以本地旧会员 ID 续期',async()=>{
 const f=fixture()
 const pending=f.request('/hexu/app/profile')
 f.enterGuestBrowsing()
 f.respond(0,401)
 await assert.rejects(pending,/账号或商城已变化/)
 assert.equal(f.backend.guest,true)
 assert.equal(f.backend.token,'')
 assert.equal(f.storage.get('hexu-member-id'),701)
 assert.equal(f.requests.length,1)
})

test('P1-4 购物车旧队列不写 B，旧回执不覆盖 B 文档 ID',async()=>{
 const f=fixture()
 f.state.cart=[{id:'A-SKU',qty:1}]
 const first=f.syncCart()
 await tick()
 assert.equal(documentWrites(f.requests).length,1)
 assert.equal(f.requests[0].header.Authorization,'Bearer token-a')
 f.state.cart=[{id:'A-SKU-QUEUED',qty:2}]
 const queued=f.syncCart()
 f.switchMember()
 f.state.cart=[{id:'B-SKU',qty:1}]
 f.state.serverCartId='B-cart'
 f.respond(0,200,{id:'A-cart'})
 await first
 await queued
 assert.equal(f.state.serverCartId,'B-cart')
 assert.equal(documentWrites(f.requests).length,1)
 assert.equal(documentWrites(f.requests).filter(item=>item.header.Authorization==='Bearer token-b').length,0)
})

test('P1-4 收藏旧回执不覆盖 B 文档 ID，也不以 B 身份重发',async()=>{
 const f=fixture()
 f.state.favorites=['A-SKU']
 const pending=f.syncFavorites()
 assert.equal(f.requests[0].header.Authorization,'Bearer token-a')
 f.switchMember()
 f.state.favorites=['B-SKU'];f.state.serverFavoriteId='B-favorite'
 f.respond(0,401)
 await assert.rejects(pending,/账号或商城已变化/)
 assert.equal(f.state.serverFavoriteId,'B-favorite')
 assert.equal(f.requests.length,1)
})

test('P2-2 同客户跨店时迟到 A 店客户响应不能覆盖 B 店优惠券',async()=>{
 const f=fixture(),form={previewCustomer:'990001 · 测试客户'}
 const old=f.loadMarketingBuyer(form)
 assert.equal(f.requests[0].data.shopId,2)
 f.backend.shopId=3
 const current=f.loadMarketingBuyer(form)
 assert.equal(f.requests[1].data.shopId,3)
 f.respond(1,200,{coupons:[{id:'B-coupon',status:'AVAILABLE'}]})
 await current
 assert.equal(f.backend.marketingBuyer.coupons[0].id,'B-coupon')
 f.respond(0,200,{coupons:[{id:'A-coupon',status:'AVAILABLE'}]})
 await old
 assert.equal(f.backend.marketingBuyer.coupons[0].id,'B-coupon')
 assert.equal(form.previewCoupon,'不使用优惠券')
})

test('P2-2 双店同客户试算只提交 B 店券和商品',async()=>{
 const f=fixture(),form={previewCustomer:'990001 · 测试客户',previewSku:'SKU-B · B 店商品',previewQty:1,previewPoints:0,previewScope:'平台积分',previewCoupon:'B-coupon · B 券',previewRegion:'B 地区'}
 f.backend.shopId=3
 const buyer=f.loadMarketingBuyer(form)
 f.respond(0,200,{coupons:[{id:'B-coupon',kind:'coupon_claim',status:'AVAILABLE',body:{name:'B 券'}}]})
 await buyer
 f.backend.previewCustomers=[{member_id:990001}]
 f.backend.previewCatalog=[{id:'SKU-B',status:'ACTIVE'}]
 form.previewCoupon='A-coupon · A 券'
 assert.throws(()=>f.marketingPreviewPayload(form),/本商城试算客户|当前客户可用的优惠券/)
 form.previewCoupon='B-coupon · B 券'
 const pending=f.handleRemote('calculate',{pageId:'G55',form,validate:()=>true})
 assert.equal(f.requests.length,2)
 assert.equal(f.requests[1].header.Authorization,'Bearer token-a')
 assert.equal(f.requests[1].data.shopId,3)
 assert.equal(f.requests[1].data.couponId,'B-coupon')
 assert.equal(f.requests[1].data.items[0].id,'SKU-B')
 f.respond(1,200,{total:100})
 assert.equal(await pending,true)
 assert.equal(f.backend.marketingPreview.total,100)
})
