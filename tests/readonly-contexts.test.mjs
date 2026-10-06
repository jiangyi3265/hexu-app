import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {loadPure} from './helpers/pure-module.mjs'

const source=fs.readFileSync(new URL('../data/backend.js',import.meta.url),'utf8')
const catalog=fs.readFileSync(new URL('../data/catalog.js',import.meta.url),'utf8')
const screens=fs.readFileSync(new URL('../data/screens.js',import.meta.url),'utf8')
const helpers=Object.assign({},...await Promise.all(['profile.js','payment-clock.js','compliance.js','reviews.js','support.js','datetime.js'].map(loadPure)))
const plain=value=>JSON.parse(JSON.stringify(value))
function fixture({decoration={},promotions=[],refunds=[],orders={},listedOrders=null,returnAddress={},failures=[],allowWrites=false}={}){
 const toasts=[],requests=[],writes=[],state={changes:{},cart:[],favorites:[],addresses:[],orders:[],notifications:[]},products=[],storage=new Map()
 const member={id:201,name:'真实会员',phone:'13800138000'},shop={id:2,name:'真实商城',kind:'DEALER',returnAddress}
 const account={platformPoints:{available:0},shopPoints:{available:0},wallet:{available:0},withdrawals:[],refunds,earnings:[]}
 const api={decoration,promotions,orders,listedOrders,failures,account}
 const response=(url,data,method)=>{
  requests.push({url,data,method});if(api.failures.some(path=>url.endsWith(path)))throw new Error('真实读取失败')
  if(method!=='GET'){
   if(!allowWrites)throw new Error('只读测试不得写入')
   writes.push({url,...plain(data)})
   if(url.endsWith('/document-review')){const record=api.promotions.find(x=>x.id===data.id);if(!record)throw new Error('申请不存在');record.status=data.decision;record.review_note=data.reason;return record}
   if(url.endsWith('/order-receive')){const record=api.orders[data.id];if(!record)throw new Error('订单不存在');record.status='COMPLETED';return record}
   if(url.endsWith('/return-tracking')){const record=api.account.refunds.find(x=>x.id===data.id);if(!record)throw new Error('售后不存在');record.return_json=JSON.stringify({carrier:data.carrier,tracking:data.tracking,uploads:data.uploads});return record}
   throw new Error('Unexpected command '+url)
  }
  if(url.endsWith('/bootstrap'))return {member,shop,account:api.account,storefront:{decoration:api.decoration},products:[],addresses:[],cart:[],favorites:[],orders:[],notifications:[]}
  if(url.endsWith('/shops'))return [shop]
  if(url.endsWith('/coupons'))return []
  if(url.endsWith('/documents/support'))return []
  if(url.endsWith('/management/documents_promotion'))return api.promotions
  if(url.endsWith('/orders'))return api.listedOrders??Object.values(api.orders)
  if(url.includes('/orders/')){const order=api.orders[decodeURIComponent(url.split('/orders/')[1])];if(!order)throw new Error('真实订单不存在');return order}
  throw new Error('Unexpected endpoint '+url)
 }
 const uni={getStorageSync:key=>storage.get(key),setStorageSync:(key,value)=>storage.set(key,value),removeStorageSync:key=>storage.delete(key),request:options=>{try{options.success({statusCode:200,data:{code:200,data:plain(response(options.url,options.data,options.method))}})}catch(error){options.success({statusCode:400,data:{code:400,msg:error.message}})}}}
 const sandbox={...helpers,reactive:x=>x,state,products,persist:()=>{},toast:x=>toasts.push(x),navigate:()=>{},money:x=>(Number(x)/100).toFixed(2),uni,getCurrentPages:()=>[],URLSearchParams,Date,Math,Promise,setTimeout,clearTimeout}
 vm.createContext(sandbox)
 const transformed=source.replace(/^import .*$/mg,'').replace(/export\s*\{[^}]*\}/g,'').replace(/export /g,'').replace(/import\.meta\.env/g,'({DEV:true,VITE_HEXU_API:"http://127.0.0.1:8088"})')
 vm.runInContext(transformed+'\nglobalThis.functions={backend,pageData,liveBlocks,handleRemote}',sandbox)
 vm.runInContext(catalog.replace(/export /g,'')+screens.replace(/^import .*$/mg,'').replace(/export /g,'')+'\nglobalThis.screenData=screens',sandbox)
 const {backend,pageData,liveBlocks,handleRemote}=sandbox.functions
 Object.assign(backend,{ready:true,catalogShopId:2,shopId:2,member,token:'real-test-session',account,shopInfo:shop,storefront:{decoration}});state.shop=shop.name
 return {backend,state,api,pageData,requests,toasts,writes,handleRemote,blocks:(id,form={})=>liveBlocks(id,sandbox.screenData[id].blocks,form),screenData:sandbox.screenData}
}
const purchase=(status='SHIPPED',type='WHOLESALE')=>({id:'REAL-PURCHASE',shop_id:900,destination_shop_id:2,buyer_id:201,order_type:type,status,total:4200,subtotal:4200,shipping_json:JSON.stringify({carrier:'真实承运商',tracking:'REAL12345678'}),items:[{id:12,sku_id:'actual-sku',name:'真实采购商品',qty:7,unit_price:600}]})
const refund=(status='WAIT_RETURN',extra={})=>({id:'REAL-REFUND',order_id:'REAL-ORDER',member_id:201,shop_id:2,status,return_json:JSON.stringify({carrier:'真实快递',tracking:'REAL12345678',uploads:['FILEactual']}),...extra})
const promotion=(status='PENDING',extra={})=>({id:'REAL-PROMOTION',kind:'promotion',shop_id:2,member_id:204,status,created_at:'2026-09-27 10:00:00',body:{fromRank:1,rank:2,assessment:{rank:1,targetRank:2,periodStart:'2026-09-01',periodEnd:'2026-10-01',metrics:[{key:'sales',label:'团队销售额',value:235000,threshold:200000,enabled:true,passed:true},{key:'repeat',label:'客户复购率',value:7500,threshold:7000,enabled:true,passed:true},{key:'people',label:'有效下级人数',value:6,threshold:5,enabled:true,passed:true},{key:'disabled',label:'已停用指标',enabled:false}]}},...extra})
const context=(pageId,form)=>({pageId,form,validate:()=>true})

test('M29读取真实装修客服电话公告，不显示固定营业时间或节假日文案',async()=>{
 const f=fixture({decoration:{customerPhone:'0571-87654321',announcement:'今晚盘点，发货安排以订单通知为准。'}}),before=JSON.stringify(f.screenData.M29.blocks)
 await f.pageData('M29',{});const text=JSON.stringify(f.blocks('M29'));assert.match(text,/0571-87654321/);assert.match(text,/今晚盘点/);assert.doesNotMatch(text,/400-800-1234|08:30|20:00|国庆|10月4日/);assert.equal(JSON.stringify(f.screenData.M29.blocks),before)
 f.api.decoration={customerPhone:'13812345678',announcement:'更新后的真实公告'};await f.pageData('M29',{});const next=JSON.stringify(f.blocks('M29'));assert.match(next,/13812345678|更新后的真实公告/);assert.doesNotMatch(next,/今晚盘点|0571-87654321/)
})
test('M29未配置时说明缺失，不冒充存在客服时间和联系电话',async()=>{
 const f=fixture();await f.pageData('M29',{});const text=JSON.stringify(f.blocks('M29'));assert.match(text,/尚未配置客服电话/);assert.match(text,/暂未发布店铺公告/);assert.doesNotMatch(text,/400-|国庆|周一至周日/)
})

test('M29兼容后台旧客服电话字段，新字段保存后优先显示新值',async()=>{
 const f=fixture({decoration:{servicePhone:'旧客服 0571-12345678'}})
 await f.pageData('M29',{});assert.match(JSON.stringify(f.blocks('M29')),/0571-12345678/)
 f.api.decoration={servicePhone:'旧客服 0571-12345678',customerPhone:'13812345678'}
 await f.pageData('M29',{});const text=JSON.stringify(f.blocks('M29'))
 assert.match(text,/13812345678/);assert.doesNotMatch(text,/0571-12345678/)
})
test('G37无申请时仅空态，清除样例生效日期并禁止审核',async()=>{
 const f=fixture(),form={职级生效时间:'2026-09-20'};await f.pageData('G37',form);const b=f.blocks('G37',form);assert.equal(b.length,1);assert.match(JSON.stringify(b),/暂无晋升申请/);assert.doesNotMatch(JSON.stringify(b),/陈浩|210,000|安溪青木|县域总代理/);assert.equal(f.backend.promotionReview,null);assert.equal(f.backend.promotionReviewAllowed,false);assert.equal(form.职级生效时间,'')
})
test('G37真实快照使用销售元和复购百分比，申请关联不再是样例',async()=>{
 const f=fixture({promotions:[promotion()]}),form={};await f.pageData('G37',form);const b=f.blocks('G37',form),progress=b.find(x=>x.type==='progress');assert.equal(f.backend.promotionReview.id,'REAL-PROMOTION');assert.equal(f.backend.promotionReviewAllowed,true);assert.equal(b.find(x=>x.type==='profile').subtitle,'当前：云代理 → 申请：分货中心');assert.deepEqual(plain(progress.items.map(x=>x[1])),['¥2350.00 / ¥2000.00','75% / 70%','6 / 5']);assert.equal(progress.items.length,3);assert.match(JSON.stringify(b),/REAL-PROMOTION|2026-09-01/);assert.doesNotMatch(JSON.stringify(b),/陈浩|青木|210,000/);assert.equal(form.职级生效时间,'')
})
test('G37历史记录只读，SUPPLEMENT可继续审核且选择记录对应真实id',async()=>{
 const approved=promotion('APPROVED',{id:'APPROVED-REAL',review_note:'已核对原资料',body:{fromRank:1,rank:2,effectiveAt:Date.UTC(2026,9,1)}}),supplement=promotion('SUPPLEMENT',{id:'SUPPLEMENT-REAL',review_note:'待补充说明'})
 const f=fixture({promotions:[approved,supplement]}),form={};f.backend.selectedDocuments={G37:'APPROVED-REAL'};await f.pageData('G37',form);assert.equal(f.backend.promotionReviewAllowed,false);assert.equal(f.blocks('G37',form).find(x=>x.type==='fields').items.every(x=>x.kind==='readonly'),true);assert.equal(form.审核意见,'已核对原资料');assert.notEqual(form.职级生效时间,'')
 f.backend.selectedDocuments.G37='SUPPLEMENT-REAL';await f.pageData('G37',form);assert.equal(f.backend.promotionReview.id,'SUPPLEMENT-REAL');assert.equal(f.backend.promotionReviewAllowed,true);assert.equal(form.职级生效时间,'');assert.equal(form.审核意见,'待补充说明');assert.match(JSON.stringify(f.blocks('G37',form)),/document-select:SUPPLEMENT-REAL/)
})
test('G16无采购上下文不沿用上一张已付款零售订单或显示假物流',async()=>{
 const f=fixture();f.backend.activeOrder={id:'RETAIL-OLD',rawStatus:'PAID',order_type:'DEALER_RETAIL'};await f.pageData('G16',{});const text=JSON.stringify(f.blocks('G16'));assert.match(text,/暂无近期采购订单/);assert.doesNotMatch(text,/待收货|已发货|SF1234567890|CG202609130028|RETAIL-OLD/);assert.equal(f.backend.purchaseOrderDetail,null);assert.equal(f.backend.purchaseReceiveAllowed,false)
})
test('G16重进后从本人当前商城采购列表选回直发单，再读取真实详情',async()=>{
 const direct=purchase('SHIPPED','DIRECT_SHIP'),otherShop={...purchase(),id:'OTHER-SHOP',destination_shop_id:3},otherBuyer={...purchase(),id:'OTHER-BUYER',buyer_id:202},retail={...purchase(),id:'RETAIL',order_type:'DEALER_RETAIL'}
 const f=fixture({orders:{'REAL-PURCHASE':direct,'OTHER-SHOP':otherShop,'OTHER-BUYER':otherBuyer,RETAIL:retail}})
 await f.pageData('G16',{})
 const list=JSON.stringify(f.blocks('G16'))
 assert.match(list,/purchase-order:REAL-PURCHASE/)
 assert.doesNotMatch(list,/OTHER-SHOP|OTHER-BUYER|RETAIL|REAL12345678/)
 assert.equal(f.backend.purchaseReceiveAllowed,false)
 await f.handleRemote('purchase-order:OTHER-SHOP',context('G16',{}))
 assert.equal(f.state.purchaseOrder,undefined)
 await f.handleRemote('purchase-order:REAL-PURCHASE',context('G16',{}))
 assert.equal(f.state.purchaseOrder,'REAL-PURCHASE')
 assert.equal(f.backend.purchaseOrderDetail.id,'REAL-PURCHASE')
 assert.equal(f.backend.purchaseReceiveAllowed,true)
 const detail=JSON.stringify(f.blocks('G16'))
 assert.match(detail,/整箱直发，不计入商城可售库存/)
 assert.match(detail,/purchase-orders/)
 await f.handleRemote('purchase-orders',context('G16',{}))
 assert.equal(f.state.purchaseOrder,null)
 assert.match(JSON.stringify(f.blocks('G16')),/purchase-order:REAL-PURCHASE/)
 assert.equal(f.writes.length,0)
})
test('G16历史采购单不在最近列表时可按单号找回，非法或跨主体编号不建立上下文',async()=>{
 const old={...purchase('SHIPPED','DIRECT_SHIP'),id:'OLD-DIRECT'},foreign={...purchase(),id:'FOREIGN',buyer_id:202},retail={...purchase(),id:'RETAIL-ORDER',order_type:'DEALER_RETAIL'}
 const f=fixture({orders:{'OLD-DIRECT':old,FOREIGN:foreign,'RETAIL-ORDER':retail},listedOrders:[]}),form={}
 await f.pageData('G16',form)
 assert.match(JSON.stringify(f.blocks('G16',form)),/按采购单号查找|purchase-order-search/)
 for(const id of ['','../BAD','FOREIGN','RETAIL-ORDER']){
  form.purchaseOrderId=id
  await f.handleRemote('purchase-order-search',context('G16',form))
  assert.equal(f.state.purchaseOrder,undefined,id)
  assert.equal(f.backend.purchaseOrderDetail,null,id)
 }
 form.purchaseOrderId='OLD-DIRECT'
 await f.handleRemote('purchase-order-search',context('G16',form))
 assert.equal(f.state.purchaseOrder,'OLD-DIRECT')
 assert.equal(f.backend.purchaseOrderDetail.id,'OLD-DIRECT')
 assert.equal(f.backend.purchaseReceiveAllowed,true)
 assert.equal(f.writes.length,0)
})
test('G16真实采购逐项回显实际商品运单金额，状态决定收货权限',async()=>{
 const f=fixture({orders:{'REAL-PURCHASE':purchase()}});f.state.purchaseOrder='REAL-PURCHASE';await f.pageData('G16',{});const b=f.blocks('G16'),product=b.find(x=>x.type==='product');assert.equal(product.id,'actual-sku');assert.equal(product.name,'真实采购商品');assert.equal(product.qty,7);assert.equal(product.price,'6.00');assert.match(JSON.stringify(b),/真实承运商|REAL12345678|REAL-PURCHASE|7件|42.00/);assert.doesNotMatch(JSON.stringify(b),/SF1234567890|CG202609130028|48件/);assert.equal(f.backend.purchaseReceiveAllowed,true)
 for(const status of ['UNPAID','PAID','COMPLETED','CANCELLED','REFUNDED']){f.api.orders['REAL-PURCHASE']=purchase(status);await f.pageData('G16',{});assert.equal(f.backend.purchaseReceiveAllowed,false,status);assert.match(JSON.stringify(f.blocks('G16')),new RegExp(status==='UNPAID'?'待付款':status==='PAID'?'待发货':status==='COMPLETED'?'已完成':status==='CANCELLED'?'已取消':'已退款'))}
})
test('G16整箱直发说明不计入商城库存，跨商城非本人或零售单被拒绝',async()=>{
 const f=fixture({orders:{'REAL-PURCHASE':purchase('SHIPPED','DIRECT_SHIP')}});f.state.purchaseOrder='REAL-PURCHASE';await f.pageData('G16',{});assert.match(JSON.stringify(f.blocks('G16')),/整箱直发，不计入商城可售库存/)
 for(const change of [{order_type:'DEALER_RETAIL'},{buyer_id:202},{destination_shop_id:3}]){f.api.orders['REAL-PURCHASE']={...purchase(),...change};await f.pageData('G16',{});assert.equal(f.backend.purchaseOrderDetail,null);assert.equal(f.backend.purchaseReceiveAllowed,false);assert.match(JSON.stringify(f.blocks('G16')),/不是本人当前商城的采购订单/)}
})
test('M22无真实售后上下文清除旧资料并只显示空态',async()=>{
 const f=fixture(),form={tracking:'OLD12345678',uploads:['FILEold']};f.backend.refund=refund();f.state.selectedRefund='REAL-REFUND';await f.pageData('M22',form);const b=f.blocks('M22',form);assert.equal(b.length,1);assert.match(JSON.stringify(b),/尚未选择退货申请/);assert.doesNotMatch(JSON.stringify(b),/2026-09-20|填写退货物流信息|良渚|禾序商贸/);assert.equal(f.backend.returnTrackingAllowed,false);assert.equal(f.backend.refund,null);assert.equal(form.tracking,'');assert.deepEqual(plain(form.uploads),[])
})
test('M22本人WAIT_RETURN物流凭证与真实商家地址回显并可更新',async()=>{
 const f=fixture({refunds:[refund()],returnAddress:{name:'真实售后部',phone:'0571-12345678',address:'真实配置地址'}}),form={};f.state.selectedRefund='REAL-REFUND';await f.pageData('M22',form);assert.equal(f.backend.returnTrackingAllowed,true);assert.equal(form.快递公司,'真实快递');assert.equal(form.tracking,'REAL12345678');assert.deepEqual(plain(form.uploads),['FILEactual']);assert.match(JSON.stringify(f.blocks('M22',form)),/真实售后部|真实配置地址|REAL-REFUND/);assert.doesNotMatch(JSON.stringify(f.blocks('M22',form)),/2026-09-20|良渚街道/)
 f.api.account.refunds[0].return_json=JSON.stringify({carrier:'更新承运商',tracking:'NEW12345678',uploads:['FILEnew']});await f.pageData('M22',form);assert.equal(form.tracking,'NEW12345678');assert.deepEqual(plain(form.uploads),['FILEnew'])
})
test('M22非待退货状态只读已提交物流和凭证，不显示可编辑上传',async()=>{
 const f=fixture({refunds:[refund('WAIT_EXCHANGE')]}),form={};f.state.selectedRefund='REAL-REFUND';await f.pageData('M22',form);const b=f.blocks('M22',form);assert.equal(f.backend.returnTrackingAllowed,false);assert.equal(b.find(x=>x.type==='fields').items.every(x=>x.kind==='readonly'),true);assert.equal(b.some(x=>x.type==='upload'),false);assert.match(JSON.stringify(b),/view-proof:FILEactual/);assert.equal(form.tracking,'REAL12345678')
})
test('M22不能显示其他会员其他商城或已失效selectedRefund资料',async()=>{
 for(const record of [refund('WAIT_RETURN',{member_id:202}),refund('WAIT_RETURN',{shop_id:3})]){const f=fixture({refunds:[record]});f.state.selectedRefund='REAL-REFUND';await f.pageData('M22',{});assert.equal(f.backend.refund,null);assert.equal(f.backend.returnTrackingAllowed,false);assert.doesNotMatch(JSON.stringify(f.blocks('M22')),/REAL12345678|FILEactual/)}
 const f=fixture({refunds:[refund()]});f.state.selectedRefund='MISSING';await f.pageData('M22',{});assert.equal(f.backend.refund,null)
})
test('四页读取失败不沿用旧配置或记录，显示真实错误与重试入口',async()=>{
 for(const id of ['M29','G37','G16','M22']){const f=fixture({failures:['/bootstrap']});Object.assign(f.backend,{purchaseOrderDetail:purchase(),purchaseReceiveAllowed:true,promotionReview:promotion(),promotionReviewAllowed:true,refund:refund(),returnTrackingAllowed:true});await f.pageData(id,{});const b=f.blocks(id);assert.match(JSON.stringify(b),/业务数据读取失败|真实读取失败|action-page-refresh/);assert.equal(f.backend.displayPageErrors[id],'真实读取失败');assert.equal(f.requests.every(x=>x.method==='GET'),true);if(id==='G16')assert.equal(f.backend.purchaseReceiveAllowed,false);if(id==='G37')assert.equal(f.backend.promotionReviewAllowed,false);if(id==='M22')assert.equal(f.backend.returnTrackingAllowed,false)}
})

test('G37提交只使用选中真实晋升id，SUPPLEMENT可以继续审核，成功后不能重复提交',async()=>{
 const f=fixture({allowWrites:true,promotions:[promotion('PENDING',{id:'OTHER-PROMOTION'}),promotion('SUPPLEMENT')]}),form={};f.backend.selectedDocuments={G37:'REAL-PROMOTION'};await f.pageData('G37',form);form.审核意见=' 已核对真实资料 ';await f.handleRemote('approve',context('G37',form));assert.equal(f.writes.length,1);assert.equal(f.writes[0].id,'REAL-PROMOTION');assert.equal(f.writes[0].decision,'APPROVED');assert.equal(f.writes[0].reason,'已核对真实资料');assert.equal(f.writes[0].effectiveAt,'');assert.equal(f.backend.promotionReviewAllowed,false);await f.handleRemote('approve',context('G37',form));assert.equal(f.writes.length,1)
})
test('G37拒绝空驳回意见和无效过去日期，未来日期准确提交，驳回不带生效日',async()=>{
 const f=fixture({allowWrites:true,promotions:[promotion()]}),form={};await f.pageData('G37',form);await f.handleRemote('reject',context('G37',form));assert.equal(f.writes.length,0)
 for(const date of ['2026-02-30','2020-01-01','invalid']){form.职级生效时间=date;await f.handleRemote('approve',context('G37',form));assert.equal(f.writes.length,0,date)}
 const later=new Date(Date.now()+3*86400000),expectedDate=[later.getFullYear(),String(later.getMonth()+1).padStart(2,'0'),String(later.getDate()).padStart(2,'0')].join('-');form.职级生效时间=expectedDate;await f.handleRemote('approve',context('G37',form));assert.equal(f.writes[0].effectiveAt,expectedDate)
 const rejected=fixture({allowWrites:true,promotions:[promotion()]}),rejectedForm={};await rejected.pageData('G37',rejectedForm);Object.assign(rejectedForm,{审核意见:'不符合条件',职级生效时间:'invalid'});await rejected.handleRemote('reject',context('G37',rejectedForm));assert.equal(rejected.writes[0].decision,'REJECTED');assert.equal(rejected.writes[0].effectiveAt,'')
})
test('G37失配记录身份商城加载状态或读取失败一律不提交',async()=>{
 const mutations=[f=>f.backend.promotionReviewAllowed=false,f=>f.backend.promotionReview=null,f=>f.backend.promotionReview.status='APPROVED',f=>f.backend.promotionReview.shop_id=3,f=>f.backend.promotionReview.kind='review',f=>f.backend.selectedDocuments={G37:'OTHER-ID'},f=>f.backend.member.id=202,f=>f.backend.shopId=3,f=>f.backend.token='new-member-session',f=>f.backend.pageLoading.G37=1,f=>f.backend.displayPageErrors.G37='读取失败',f=>f.backend.management.G37=[]]
 for(const mutate of mutations){const f=fixture({allowWrites:true,promotions:[promotion()]}),form={};await f.pageData('G37',form);mutate(f);await f.handleRemote('approve',context('G37',form));assert.equal(f.writes.length,0)}
 const stale=fixture({allowWrites:true,promotions:[promotion()]}),form={};await stale.pageData('G37',form);form._promotionKey='OTHER-ID:PENDING';await stale.handleRemote('reject',context('G37',form));assert.equal(stale.writes.length,0)
})
test('采购收货只提交真实采购id，成功后禁止重复收货',async()=>{
 const f=fixture({allowWrites:true,orders:{'REAL-PURCHASE':purchase()}});f.state.purchaseOrder='REAL-PURCHASE';await f.pageData('G16',{});await f.handleRemote('stock-receive',context('G16',{}));assert.equal(f.writes.length,1);assert.equal(f.writes[0].id,'REAL-PURCHASE');assert.equal(f.writes[0].shopId,2);assert.equal(f.backend.purchaseOrderDetail.rawStatus,'COMPLETED');assert.equal(f.backend.purchaseReceiveAllowed,false);await f.handleRemote('stock-receive',context('G16',{}));assert.equal(f.writes.length,1)
})
test('采购命令拒绝失配状态身份商城零售上下文和加载失败',async()=>{
 const mutations=[f=>f.backend.purchaseReceiveAllowed=false,f=>f.backend.purchaseOrderDetail=null,f=>f.state.purchaseOrder='OTHER-ID',f=>f.backend.purchaseOrderDetail.rawStatus='COMPLETED',f=>f.backend.purchaseOrderDetail.order_type='DEALER_RETAIL',f=>f.backend.purchaseOrderDetail.buyer_id=202,f=>f.backend.purchaseOrderDetail.destination_shop_id=3,f=>f.backend.purchaseOrderDetail.shop_id=2,f=>f.backend.member.id=202,f=>f.backend.shopId=3,f=>f.backend.pageLoading.G16=1,f=>f.backend.displayPageErrors.G16='读取失败']
 for(const mutate of mutations){const f=fixture({allowWrites:true,orders:{'REAL-PURCHASE':purchase()}});f.state.purchaseOrder='REAL-PURCHASE';await f.pageData('G16',{});mutate(f);await f.handleRemote('stock-receive',context('G16',{}));assert.equal(f.writes.length,0)}
 const wrongPage=fixture({allowWrites:true,orders:{'REAL-PURCHASE':purchase()}});wrongPage.state.purchaseOrder='REAL-PURCHASE';await wrongPage.pageData('G16',{});await wrongPage.handleRemote('stock-receive',context('M18',{}));assert.equal(wrongPage.writes.length,0)
})
test('退货物流命令使用真实申请和规范字段，提交凭证并阻止未重读重复点击',async()=>{
 const f=fixture({allowWrites:true,refunds:[refund()]}),form={};f.state.selectedRefund='REAL-REFUND';await f.pageData('M22',form);Object.assign(form,{快递公司:' 真实快递 ',tracking:'NEW12345678',uploads:['FILEreal-new'],无关私有字段:'不应外传'});await f.handleRemote('return-tracking',context('M22',form));assert.equal(f.writes.length,1);assert.deepEqual({id:f.writes[0].id,carrier:f.writes[0].carrier,tracking:f.writes[0].tracking,uploads:f.writes[0].uploads},{id:'REAL-REFUND',carrier:'真实快递',tracking:'NEW12345678',uploads:['FILEreal-new']});assert.equal('无关私有字段' in f.writes[0],false);assert.equal(f.backend.returnTrackingAllowed,false);await f.handleRemote('return-tracking',context('M22',form));assert.equal(f.writes.length,1)
})
test('退货物流命令拒绝上下文失配身份商城新状态及读取错误',async()=>{
 const mutations=[f=>f.backend.returnTrackingAllowed=false,f=>f.backend.refund=null,f=>f.backend.refund.status='APPROVED',f=>f.backend.refund.member_id=202,f=>f.backend.refund.shop_id=3,f=>f.state.selectedRefund='OTHER-ID',f=>f.backend.member.id=202,f=>f.backend.shopId=3,f=>f.backend.account.refunds=[],f=>f.backend.account.refunds[0].status='WAIT_EXCHANGE',f=>f.backend.pageLoading.M22=1,f=>f.backend.displayPageErrors.M22='读取失败']
 for(const mutate of mutations){const f=fixture({allowWrites:true,refunds:[refund()]}),form={};f.state.selectedRefund='REAL-REFUND';await f.pageData('M22',form);mutate(f);await f.handleRemote('return-tracking',context('M22',form));assert.equal(f.writes.length,0)}
 const wrongForm=fixture({allowWrites:true,refunds:[refund()]}),form={};wrongForm.state.selectedRefund='REAL-REFUND';await wrongForm.pageData('M22',form);form._returnId='OTHER-ID';await wrongForm.handleRemote('return-tracking',context('M22',form));assert.equal(wrongForm.writes.length,0)
})
test('退货物流格式不合法本地不提交，不接受本地路径重复或超量凭证',async()=>{
 const invalid=[{快递公司:''},{快递公司:'a'.repeat(61)},{快递公司:'bad\u0000carrier'},{tracking:'SHORT'},{tracking:'REAL_12345678'},{tracking:' REAL12345678 '},{tracking:'REAL12345678\nBAD'},{tracking:'1'.repeat(41)},{uploads:'FILEbad'},{uploads:['FILEone','FILEone']},{uploads:['https://example.test/a.png']},{uploads:['C:\\tmp\\a.png']},{uploads:Array.from({length:10},(_,i)=>'FILEproof'+i)}]
 for(const changes of invalid){const f=fixture({allowWrites:true,refunds:[refund()]}),form={};f.state.selectedRefund='REAL-REFUND';await f.pageData('M22',form);Object.assign(form,changes);await f.handleRemote('return-tracking',context('M22',form));assert.equal(f.writes.length,0,JSON.stringify(changes))}
})
test('旧generic评价和跨店分支已删除，显式真实处理器仍然存在',()=>{
 const generic=source.slice(source.indexOf('if(documentKinds[pageId]'),source.indexOf("if(pageId.startsWith('G'))"));assert.doesNotMatch(generic,/kind==='review'|kind==='cross_purchase'|selectedProduct\|\|'stapler'/);assert.match(source,/pageId==='M10'/);assert.match(source,/pageId==='M44'&&\['cross-store','submit'\]/)
})
