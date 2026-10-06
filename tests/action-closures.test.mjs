import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {loadPure} from './helpers/pure-module.mjs'
import {notificationText,notificationTemplateForEditor,notificationTemplateForSave} from '../data/notification-display.mjs'
import {inventoryReasonLabel,inventoryMatchesFilter,inventoryDeltaLabel} from '../data/inventory-ledger.mjs'
import {managementSnapshotDetails,managementOrderNotice} from '../data/order-management-snapshot.mjs'
import {sandboxMemberId} from '../data/dev-entry.mjs'
import {financePage,settlementInputKey,signedCurrency,financeActor} from '../data/finance-view.mjs'
import * as wholesaleHelpers from '../data/wholesale-order.mjs'
import {isValidRegion} from '../data/region-picker.mjs'

// Exercise the real page-data/command/render functions with an in-memory API.
// This verifies field contracts and state transitions, not native UI or Java.
const source = fs.readFileSync(new URL('../data/backend.js', import.meta.url), 'utf8')
const screenSource = fs.readFileSync(new URL('../components/DesignScreen.vue', import.meta.url), 'utf8')
const catalog = fs.readFileSync(new URL('../data/catalog.js', import.meta.url), 'utf8')
const screens = fs.readFileSync(new URL('../data/screens.js', import.meta.url), 'utf8')
test('G32 经营端入口说明与审核列表动作一致',()=>{
 assert.match(screens,/page\('G32',[^\n]+action\('查看改绑申请','G33'\)/)
 assert.doesNotMatch(screens,/action\('申请更改归属','G33'\)/)
})
const [profileHelpers,paymentHelpers,complianceHelpers,reviewHelpers,supportHelpers,afterSaleHelpers,timeHelpers,cartHelpers,businessHelpers,storefrontHelpers,catalogEditorHelpers] = await Promise.all([loadPure('profile.js'),loadPure('payment-clock.js'),loadPure('compliance.js'),loadPure('reviews.js'),loadPure('support.js'),loadPure('aftersale.js'),loadPure('datetime.js'),loadPure('cart-checkout.js'),loadPure('business.mjs'),loadPure('storefront-display.mjs'),loadPure('catalog-editor.mjs')])
const plain = value => JSON.parse(JSON.stringify(value))
function fixture({decoration={},documents={},agent=null,context,responses={},failures=[],modalConfirm=true,modalFailure=false,modalDeferred=false,onModal,onRequest,interceptRequest,remoteLogin=false,expireBootstrapOnce=false,expireProfileOnce=false,renewedToken='test-token',refunds=[],bootstrapMember=null,bootstrapShop=null,bootstrapOrders=[],bootstrapNotifications=[],shopList=null,pageStack=null,h5Search='',catalogProducts=[{id:'sku-real',price:1000,stock:10,warning_qty:6}]}={}) {
  const writes=[],requests=[],clipboard=[],modals=[],toasts=[],navigations=[],routeActions=[],storage=new Map(),products=[],state={changes:{},cart:[],favorites:[],browseHistory:[],addresses:[],orders:[],notifications:[],points:0,shopPoints:0,balance:0}
  const member={id:201,name:'接口会员',phone:'13800138000'},shop={id:2,name:'真实商城',kind:'DEALER',county:'真实县域'}
  const account={platformPoints:{available:100},shopPoints:{available:50},wallet:{available:1000},withdrawals:[],refunds:plain(refunds),earnings:[]}
  const docs=plain(documents)
  const dataFor=(url,data,method)=>{
    if(failures.some(path=>url.endsWith(path)))throw new Error('服务暂不可用')
    const override=Object.keys(responses).find(path=>url.endsWith(path));if(override)return plain(responses[override])
    if(url.endsWith('/bootstrap'))return {member:bootstrapMember||member,shop:bootstrapShop||shop,agent,account,storefront:{decoration},products:catalogProducts,addresses:[],cart:docs.cart||[],favorites:[],browseHistory:docs.browse_history||[],orders:bootstrapOrders,notifications:bootstrapNotifications}
    if(url.includes('/browse/')){
      const sku=decodeURIComponent(url.split('/browse/')[1].split('?')[0]);if(!catalogProducts.some(product=>product.id===sku))throw new Error('商品不存在')
      const ids=[sku,...(docs.browse_history?.[0]?.body?.ids||[]).filter(id=>id!==sku)].slice(0,50)
      docs.browse_history=[{id:'browse-doc',status:'ACTIVE',body:{ids}}];writes.push({operation:'browse',sku});return {ids}
    }
    if(url.endsWith('/login'))return {token:renewedToken}
    if(url.endsWith('/policies'))return {USER_AGREEMENT:{version:'v1'},PRIVACY_POLICY:{version:'v1'},WITHDRAWAL_AGREEMENT:{id:'POLW',version:'v1'},CUSTOMER_AUTHORIZATION:{id:'POLC',version:'v1'}}
    if(url.endsWith('/privacy-consent')){writes.push({operation:'privacy-consent',...plain(data)});return [{type:'USER_AGREEMENT',version:'v1'},{type:'PRIVACY_POLICY',version:'v1'}]}
    if(url.endsWith('/shops'))return shopList||[shop,{id:1,name:'直营商城',kind:'DIRECT',county:'其他地区',status:'ACTIVE'}]
    if(url.endsWith('/recipient'))return {id:202,name:'张**'}
    if(url.endsWith('/management/products'))return catalogProducts.map(product=>({...product,available:product.available??product.stock??0,locked:product.locked??0}))
    if(url.endsWith('/wholesale-rules'))return {mixedEnabled:false,mixCapacity:24,minMixBoxes:2}
    if(url.endsWith('/coupons'))return docs.coupons||[]
    if(url.endsWith('/reviews'))return []
    if(url.endsWith('/review-context')){
      const submission=(docs.review||[]).find(d=>d.status!=='REJECTED'&&d.body?.orderId===data.orderId&&d.body?.skuId===data.skuId)||null;
      if(data.parentId)throw new Error('原评价不存在、未公开或不属于该订单商品');
      return {shopId:data.shopId,orderId:data.orderId,skuId:data.skuId,reviewAllowed:!submission||submission.status==='SUPPLEMENT',parent:null,submission,appendSubmission:null};
    }
    if(url.endsWith('/invitation-context'))return context
    if(url.endsWith('/management/fulfillment/pick')||url.endsWith('/management/orders'))return []
    if(url.endsWith('/management/ship')){writes.push({operation:'ship',...plain(data)});return {id:data.id,status:'SHIPPED'}}
    if(url.endsWith('/document-save')){
      writes.push(plain(data));const config=url.includes('/management/')&&data.kind!=='stocktake'
      const saved={id:data.id||'DOC'+writes.length,kind:data.kind,member_id:member.id,shop_id:shop.id,status:config||data.kind==='cart'?'ACTIVE':'PENDING',body:plain(data),created_at:'2026-09-27 10:00:00'}
      docs[data.kind]=[saved,...(docs[data.kind]||[]).filter(d=>d.id!==saved.id)]
      if(data.kind==='decoration')decoration=plain(data)
      return saved
    }
    if(url.endsWith('/marketing-preview')){writes.push({operation:'marketing-preview',...plain(data)});return {subtotal:3500,promotionDiscount:0,couponDiscount:0,pointsDiscount:0,freight:0,total:3500,productPaid:3500,cost:3500,margin:0,validated:true}}
    if(url.endsWith('/document-review')){writes.push(plain(data));const record=Object.values(docs).flat().find(d=>d.id===data.id);if(record)record.status=data.decision;return record||{id:data.id,status:data.decision}}
    if(url.endsWith('/document-remove')){writes.push({operation:'document-remove',...plain(data)});for(const kind of Object.keys(docs))docs[kind]=(docs[kind]||[]).filter(record=>record.id!==data.id);return {id:data.id,status:'REMOVED'}}
    if(url.endsWith('/staff-assign')){writes.push(plain(data));return {saved:true}}
    if(url.endsWith('/stock-warning')){writes.push({operation:'stock-warning',...plain(data)});return {updated:true}}
    if(url.endsWith('/catalog-settings-save')){writes.push(plain(data));return {category:{id:data.categoryId||'CATEGORY',body:{items:data.categories}},...(data.freight?{freight:{id:'FREIGHT'}}:{})}}
    if(url.endsWith('/order-create')){writes.push(plain(data));return {id:'purchase-created',shop_id:data.shopId,buyer_id:member.id,status:'UNPAID',items:[],total:0,subtotal:0}}
    if(url.endsWith('/points-redeem')){writes.push({operation:'points-redeem',...plain(data)});const sku=catalogProducts.find(p=>p.id===data.skuId);return {id:'points-created',shop_id:shop.id,buyer_id:member.id,order_type:'POINTS',status:'PAID',points_used:sku.point_price*data.qty,total:0,subtotal:0,items:[{id:'line-points',sku_id:sku.id,name:sku.name,qty:data.qty,unit_price:0}]}}
    if(url.endsWith('/order-cancel')){writes.push({operation:'order-cancel',...plain(data)});return {id:data.id,status:'CANCELLED'}}
    if(url.endsWith('/order-receive')){writes.push({operation:'order-receive',...plain(data)});return {id:data.id,status:'COMPLETED',shop_id:shop.id,buyer_id:member.id,items:[{id:'sku-real'}]}}
    if(url.endsWith('/checkin')){writes.push({operation:'checkin',...plain(data)});return {points:5,date:new Date().toISOString().slice(0,10)}}
    if(url.endsWith('/coupon-claim')){
      const campaign=(docs.coupons||[]).find(c=>c.id===data.id&&c.kind==='coupon')
      if(!campaign)throw new Error('优惠券活动不存在')
      if((docs.coupons||[]).some(c=>c.kind==='coupon_claim'&&c.campaign_ref===data.id&&c.member_id===member.id))throw new Error('您已领取该优惠券')
      writes.push({operation:'coupon-claim',...plain(data)})
      const claim={id:'CP'+writes.length,kind:'coupon_claim',status:'AVAILABLE',campaign_ref:data.id,member_id:member.id,shop_id:data.shopId,body:{...campaign.body,campaignId:data.id}}
      docs.coupons=[claim,...docs.coupons]
      return {id:claim.id,kind:claim.kind,status:claim.status,campaign_ref:claim.campaign_ref}
    }
    if(url.endsWith('/points-transfer')){writes.push({operation:'points-transfer',...plain(data)});return {reference:'JFnew',debit:-data.amount,credit:data.amount}}
    if(url.endsWith('/withdraw')){writes.push({operation:'withdraw',...plain(data)});return {id:'TXnew',shop_id:shop.id,member_id:member.id,amount:data.amount,fee:Math.round(data.amount*0.006),net:data.amount-Math.round(data.amount*0.006),status:'PENDING',channel:data.channel}}
    if(url.endsWith('/withdrawals/TXnew'))return {id:'TXnew',shop_id:shop.id,member_id:member.id,amount:writes.find(w=>w.operation==='withdraw')?.amount,fee:6,net:994,status:'PENDING',channel:'BANK'}
    if(url.endsWith('/refund-cancel')){const refund=account.refunds.find(r=>r.id===data.id);if(!refund)throw new Error('售后申请不存在');writes.push({operation:'refund-cancel',...plain(data)});refund.status='CLOSED';return plain(refund)}
    if(url.endsWith('/exchange-receive')){const refund=account.refunds.find(r=>r.id===data.id);if(!refund)throw new Error('换货单不存在');writes.push({operation:'exchange-receive',...plain(data)});refund.status='CLOSED';return plain(refund)}
    if(url.endsWith('/refund-apply')){writes.push({operation:'refund-apply',...plain(data)});return {id:'new-refund',order_id:data.id,line_id:data.lineId,shop_id:shop.id,member_id:member.id,qty:data.qty,refund_type:data.type,status:'PENDING'}}
    if(url.includes('/documents/')||url.includes('/documents_')){const kind=url.split(/\/documents\/|\/documents_/).at(-1);return (docs[kind]||[]).map(record=>({...record,kind:record.kind||kind}))}
    throw new Error('Unexpected mock endpoint '+method+' '+url)
  }
  const uni={getStorageSync:key=>storage.get(key),setStorageSync:(key,value)=>storage.set(key,value),removeStorageSync:key=>storage.delete(key),request:options=>{requests.push({url:options.url,method:options.method});if(interceptRequest?.(options,dataFor))return;if(expireBootstrapOnce&&options.url.endsWith('/bootstrap')){expireBootstrapOnce=false;options.success({statusCode:401,data:{code:401,msg:'登录已失效，请重新登录'}});return}if(expireProfileOnce&&options.url.endsWith('/profile')){expireProfileOnce=false;options.success({statusCode:401,data:{code:401,msg:'登录已失效，请重新登录'}});return}try{onRequest?.(options.url,options.data,options.method);options.success({statusCode:200,data:{code:200,data:dataFor(options.url,options.data,options.method)}})}catch(error){options.success({statusCode:400,data:{code:400,msg:error.message}})}},login:o=>o.success({code:'wechat-test-code'}),showModal:o=>{modals.push({title:o.title,content:o.content});onModal?.(o);if(modalDeferred)return;if(modalFailure)o.fail?.();else o.success({confirm:modalConfirm})},setClipboardData:o=>{clipboard.push(o.data);o.success?.()}}
  if(pageStack){uni.navigateBack=options=>routeActions.push({type:'back',delta:options.delta});uni.redirectTo=options=>routeActions.push({type:'redirect',url:options.url})}
   const sandbox={...profileHelpers,...paymentHelpers,...complianceHelpers,...reviewHelpers,...supportHelpers,...afterSaleHelpers,...timeHelpers,...cartHelpers,...businessHelpers,...storefrontHelpers,...catalogEditorHelpers,...wholesaleHelpers,isValidRegion,sandboxMemberId,financePage,settlementInputKey,signedCurrency,financeActor,notificationText,notificationTemplateForEditor,notificationTemplateForSave,inventoryReasonLabel,inventoryMatchesFilter,inventoryDeltaLabel,managementSnapshotDetails,managementOrderNotice,reactive:value=>value,state,products,persist:()=>{},toast:message=>toasts.push(message),navigate:page=>navigations.push(page),money:value=>(Number(value)/100).toFixed(2),uni,getCurrentPages:()=>pageStack||[],URLSearchParams,location:{search:h5Search,hash:''},Date,Math,Promise,setTimeout,clearTimeout}
  vm.createContext(sandbox)
  const transformed=source.replace(/^import .*$/mg,'').replace(/export\s*\{[^}]*\}/g,'').replace(/export /g,'').replace(/import\.meta\.env/g,remoteLogin?'({DEV:true,VITE_HEXU_API:"https://api.example.test"})':'({DEV:true,VITE_HEXU_API:"http://127.0.0.1:8088"})')
  vm.runInContext(transformed+'\nglobalThis.api={backend,pageData,handleRemote,selectOrder,liveBlocks,finishPaidOrder,loadProfile,authorizeProfilePhone,claimCoupon,validateCheckoutCoupon,refresh,rememberLoginReturn,clearLoginReturn,enterGuestBrowsing,setDefaultAddress,removeSavedAddress}',sandbox)
  vm.runInContext(catalog.replace(/export /g,'')+screens.replace(/^import .*$/mg,'').replace(/export /g,'')+'\nglobalThis.screenData=screens',sandbox)
  const {backend,pageData,handleRemote,selectOrder,liveBlocks,finishPaidOrder,loadProfile,authorizeProfilePhone,claimCoupon,validateCheckoutCoupon,refresh,rememberLoginReturn,clearLoginReturn,enterGuestBrowsing,setDefaultAddress,removeSavedAddress}=sandbox.api
  Object.assign(backend,{ready:true,shopId:2,catalogShopId:2,token:'test-token',member,agent,account,shopInfo:shop,storefront:{decoration}})
  state.shop=shop.name
  return {backend,writes,requests,clipboard,modals,toasts,navigations,routeActions,storage,state,products,docs,pageData,handleRemote,selectOrder,loadProfile,authorizeProfilePhone,claimCoupon,validateCheckoutCoupon,refresh,rememberLoginReturn,clearLoginReturn,enterGuestBrowsing,finishPaidOrder,setDefaultAddress,removeSavedAddress,setRequest:handler=>{sandbox.request=handler},render:liveBlocks,blocks:(id,form={},filter='')=>liveBlocks(id,sandbox.screenData[id].blocks,form,filter)}
}
const ctx=(pageId,form)=>({pageId,form,validate:()=>true})
const ok=data=>({statusCode:200,data:{code:200,data}})
async function waitHeld(held){for(let i=0;i<40&&!held.length;i++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(held.length,1)}

for(const stage of ['bootstrap','shops','order'])test(`跨 token 旧刷新在 ${stage} 响应迟到后不覆盖新会员资料`,async()=>{
 const held=[]
 const oldOrder={id:'old-order',status:'COMPLETED',shop_id:2,buyer_id:201,total:100,subtotal:100,items:[]}
 const newOrder={...oldOrder,id:'new-order',buyer_id:202}
 const f=fixture({responses:{'/orders/old-order':oldOrder,'/orders/new-order':newOrder},interceptRequest:(request,dataFor)=>{
  const old=request.header.Authorization==='Bearer token-A',path=request.url
  const currentStage=path.endsWith('/bootstrap')?'bootstrap':path.endsWith('/shops')?'shops':path.endsWith('/orders/old-order')?'order':''
  if(old&&currentStage===stage){held.push({request,data:currentStage==='bootstrap'?{...dataFor(path,request.data,request.method),member:{id:201,name:'旧会员'},addresses:[{status:'ACTIVE',body:{name:'旧地址'}}]}:dataFor(path,request.data,request.method)});return true}
  if(path.endsWith('/bootstrap')){const base=dataFor(path,request.data,request.method);request.success(ok({...base,member:{id:old||stage==='order'?201:202,name:old?'旧会员':'新会员'},addresses:[{status:'ACTIVE',body:{name:old?'旧地址':'新地址'}}]}));return true}
  if(path.endsWith('/coupons')){request.success(ok([{id:old?'old-coupon':'new-coupon'}]));return true}
  return false
 }})
 f.backend.token='token-A';if(stage==='order')f.state.activeOrder='old-order'
 const first=f.refresh();await waitHeld(held)
 f.backend.token='token-B';if(stage==='order')f.state.activeOrder='new-order'
 await f.refresh()
 assert.equal(f.backend.member.id,stage==='order'?201:202)
 assert.equal(f.state.addresses[0].name,'新地址')
 assert.equal(f.backend.coupons[0].id,'new-coupon')
 if(stage==='order')assert.equal(f.backend.activeOrder.id,'new-order')
 held[0].request.success(ok(held[0].data))
 await assert.rejects(first,/资料读取已过期/)
 assert.equal(f.backend.member.id,stage==='order'?201:202)
 assert.equal(f.state.addresses[0].name,'新地址')
 assert.equal(f.backend.coupons[0].id,'new-coupon')
 if(stage==='order')assert.equal(f.backend.activeOrder.id,'new-order')
})

test('同身份并发刷新不吞掉较早的写后完成流程',async()=>{
 const held=[]
 const f=fixture({interceptRequest:(request,dataFor)=>{if(request.url.endsWith('/bootstrap')&&!held.length){held.push({request,data:dataFor(request.url,request.data,request.method)});return true}return false}})
 const first=f.refresh();await waitHeld(held)
 await f.refresh()
 held[0].request.success(ok(held[0].data))
 await first
 assert.equal(f.backend.member.id,201)
})

test('正式环境订单详情401保留登录失效错误并清除旧身份',async()=>{
 const f=fixture({remoteLogin:true,interceptRequest:request=>{if(!request.url.endsWith('/orders/paid-order'))return false;request.success({statusCode:401,data:{code:401,msg:'登录已失效，请重新登录'}});return true}})
 f.state.activeOrder='paid-order'
 await assert.rejects(f.refresh(),/登录已失效/)
 assert.equal(f.backend.token,'')
 assert.equal(f.backend.member,null)
 assert.deepEqual(plain(f.state.orders),[])
})

test('本地跨商城刷新在清空旧会员后仍接受同会员合法续期',async()=>{
 const f=fixture({expireBootstrapOnce:true,renewedToken:'renewed-token',bootstrapShop:{id:1,name:'直营商城',kind:'DIRECT'}})
 f.backend.shopId=1
 await f.refresh()
 assert.equal(f.backend.token,'renewed-token')
 assert.equal(f.backend.member.id,201)
 assert.equal(f.backend.shopId,1)
})

test('G07/G08 仅本地沙盒明确就绪时提示可模拟，不提升正式收款或进件状态',()=>{
 const merchant={sandboxReady:true,paymentReady:false,applicationStatus:'PENDING',authorizationStatus:'PENDING',certificateStatus:'PENDING'};
 const local=fixture();local.backend.merchant=merchant;
 for(const id of ['G07','G08']){
  const blocks=local.blocks(id);
  assert.equal(blocks[0].title,'本地模拟已就绪，正式渠道待配置');
  assert.equal(blocks[0].tone,'orange');
  assert.match(blocks.find(b=>b.type==='rows'&&b.items?.some(i=>i.label==='收款权限')).items.find(i=>i.label==='收款权限').value,/待渠道核实/);
 }
 assert.equal(local.blocks('G07').find(b=>b.type==='timeline').active,1);
 const formal=fixture({remoteLogin:true});formal.backend.merchant=merchant;
 assert.equal(formal.blocks('G07').some(b=>b.title==='本地模拟已就绪，正式渠道待配置'),false);
 assert.equal(formal.blocks('G08').some(b=>b.title==='本地模拟已就绪，正式渠道待配置'),false);
 local.backend.merchant={...merchant,sandboxReady:false};
 assert.equal(local.blocks('G07').some(b=>b.title==='本地模拟已就绪，正式渠道待配置'),false);
})

test('G47 selecting a shop point account accepts numeric IDs from API and storage',()=>{
 const f=fixture()
 f.backend.management.G47=[
  {member_id:'101',name:'账户甲',available:0,frozen:false,pending_reclaim:0,gained:0,used:0},
  {member_id:201,name:'账户乙',available:859,frozen:false,pending_reclaim:0,gained:900,used:41}
 ]
 f.state.selectedPointMember='201'
 const blocks=f.blocks('G47')
 assert.equal(blocks.find(b=>b.type==='profile').name,'账户乙')
 assert.equal(blocks.find(b=>b.type==='stats').items[0].value,859)
})

test('G47 account-row action reloads the selected member and visible balance',async()=>{
 const points=[
  {member_id:101,name:'账户甲',available:0,frozen:false,pending_reclaim:0,gained:0,used:0},
  {member_id:201,name:'账户乙',available:859,frozen:false,pending_reclaim:0,gained:900,used:41}
 ]
 const f=fixture({responses:{'/management/points':points}})
 assert.equal(await f.pageData('G47',{}),true)
 assert.equal(f.blocks('G47').find(b=>b.type==='profile').name,'账户甲')
 assert.equal(await f.handleRemote('point-member:201',ctx('G47',{})),true)
 assert.equal(f.state.selectedPointMember,201)
 assert.equal(f.blocks('G47').find(b=>b.type==='profile').name,'账户乙')
 assert.equal(f.blocks('G47').find(b=>b.type==='stats').items[0].value,859)
})

test('G46 账务调整先校验原因和财务凭证，不发送无效申请',async()=>{
 const f=fixture(),line={id:'DZL-real',status:'AMOUNT_MISMATCH',difference:1};
 f.backend.management.G46=[line];f.backend.reconciliationLine=line.id;
 const form={adjustment:'申请账务调整',reason:'',uploads:[]};
 for(const reason of ['', ' ', 'A', 'A'.repeat(501)]){
  form.reason=reason;await f.handleRemote('submit',ctx('G46',form));
  assert.equal(f.requests.some(request=>request.url.endsWith('/adjustment-propose')),false);
  assert.match(f.toasts.at(-1),/2–500/);
 }
 form.reason='核实差额';await f.handleRemote('submit',ctx('G46',form));
 assert.equal(f.requests.some(request=>request.url.endsWith('/adjustment-propose')),false);
 assert.match(f.toasts.at(-1),/1至9份财务凭证/);
 form.uploads=Array(10).fill('attachment');await f.handleRemote('submit',ctx('G46',form));
 assert.equal(f.requests.some(request=>request.url.endsWith('/adjustment-propose')),false);
 assert.match(f.toasts.at(-1),/1至9份财务凭证/);
})

test('G45 收支趋势保留正负方向，G46 差额使用规范货币符号',()=>{
 assert.equal(signedCurrency(-1),'−¥0.01')
 assert.equal(signedCurrency(1),'¥0.01')
 const f=fixture()
 f.backend.management.G45=[{totals:[{category:'PAYOUT',amount:-1000}],history:[
  {day:'2026-10-03',amount:-1000},{day:'2026-10-04',amount:500},{day:'2026-10-05',amount:0}
 ]}]
 const chart=f.blocks('G45').find(block=>block.type==='chart')
 assert.equal(chart.signed,true)
 assert.deepEqual(plain(chart.values),[-100,50,0])
 assert.deepEqual(plain(chart.actualValues),['−¥10.00','¥5.00','¥0.00'])
 assert.equal(f.blocks('G45').find(block=>block.type==='rows').items[0].value,'−¥10.00')
 const line={id:'DZL1',status:'AMOUNT_MISMATCH',business_id:'HX1',expected_amount:0,channel_amount:1,difference:-1}
 f.backend.management.G46=[line]
 assert.equal(f.blocks('G46').find(block=>block.title==='差异详情').items.find(item=>item.label==='账本差额').value,'−¥0.01')
 line.difference=1
 assert.equal(f.blocks('G46').find(block=>block.title==='差异详情').items.find(item=>item.label==='账本差额').value,'¥0.01')
})

test('G46 待审和驳回调整显示已保存理由、凭证及复核意见',()=>{
 const f=fixture(),proof='FILE71d1f9ec48ed4cf38e5886f37307b901'
 f.backend.management.G46=[{id:'DZL1',status:'AMOUNT_MISMATCH',business_id:'HX1',expected_amount:100,channel_amount:99,difference:-1}]
 f.backend.adjustments=[{id:'ADJ1',line_id:'DZL1',status:'PENDING',reason:'渠道尾差待复核',requested_by:'member:201',evidence_json:JSON.stringify({uploads:[proof]})}]
 let blocks=f.blocks('G46'),detail=blocks.find(block=>block.title==='调整申请记录')
 assert.equal(detail.items.find(item=>item.label==='申请理由').value,'渠道尾差待复核')
 assert.equal(detail.items.find(item=>item.label==='申请人').value,'会员 201')
 assert.deepEqual(plain(blocks.find(block=>block.type==='proofs').items),[proof])
 f.backend.adjustments[0].status='REJECTED'
 f.backend.adjustments[0].reviewed_by='staff:1'
 f.backend.adjustments[0].review_reason='凭证金额与回执不一致'
 blocks=f.blocks('G46');detail=blocks.find(block=>block.title==='调整申请记录')
 assert.equal(detail.items.find(item=>item.label==='复核人').value,'后台人员 1')
 assert.equal(detail.items.find(item=>item.label==='复核意见').value,'凭证金额与回执不一致')
 f.backend.reconciliationLine='DZL2'
 f.backend.management.G46.unshift({id:'DZL2',status:'MATCHED',business_id:'HX2',expected_amount:100,channel_amount:100,difference:0})
 blocks=f.blocks('G46')
 assert.equal(blocks.some(block=>block.type==='proofs'||block.title==='调整申请记录'),false)
})

test('G64 交易时限范围与后端一致，无效输入不发送配置',async()=>{
 const f=fixture(),form={'未支付订单关闭（分钟）':15,'自动收货（天）':7,'售后申请期限（天）':7};
 const invalid=[['未支付订单关闭（分钟）',0],['未支付订单关闭（分钟）',1441],['自动收货（天）',0],['自动收货（天）',91],['售后申请期限（天）',0],['售后申请期限（天）',366],['售后申请期限（天）',1.5]];
 for(const [key,value] of invalid){const original=form[key];form[key]=value;await f.handleRemote('save',ctx('G64',form));assert.equal(f.writes.length,0);assert.match(f.toasts.at(-1),new RegExp(key.slice(0,4)));form[key]=original;}
 await f.handleRemote('save',ctx('G64',form));
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].kind,'system_parameter');
 assert.deepEqual([f.writes[0].unpaidMinutes,f.writes[0].autoReceiveDays,f.writes[0].afterSalesDays],[15,7,7]);
})

test('G10 新商品缺少真实主图时不提交，不能回退为示例图', async () => {
  const f=fixture(),form={商品编码:'TEST_NO_IMAGE',商品名称:'待上传图片商品',uploads:[]}
  await f.handleRemote('save',ctx('G10',form))
  assert.equal(f.toasts.at(-1),'请先上传商品主图')
  assert.equal(f.writes.length,0)
  assert.equal(f.requests.some(request=>request.url.endsWith('/sku-save')),false)
})

test('G10 编辑旧商品时回显原封面，不把它写进新商品草稿', () => {
  const f=fixture(),form={规格:'500ml',retail:89,cloud:55,center:45,owner:35,uploads:[]}
  f.backend.editProduct={id:'cup',asset:'cup',status:'ACTIVE'}
  assert.equal(f.blocks('G10',form).find(block=>block.type==='upload').existingAsset,'cup')
  f.backend.editProduct=null
  assert.equal(f.blocks('G10',form).find(block=>block.type==='upload').existingAsset,'')
  const component=fs.readFileSync(new URL('../components/UiBlock.vue',import.meta.url),'utf8')
  assert.match(component,/block\.existingAsset&&!uploads\.length/)
  assert.match(component,/previewExistingCover/)
})

test('G10 输入长度与服务端商品字段契约一致', () => {
  const f=fixture()
  const blocks=f.blocks('G10',{})
  const fields=blocks.filter(block=>block.type==='fields').flatMap(block=>block.items)
  for(const [key,maxlength] of Object.entries({商品名称:160,商品编码:64,productGroup:64,商品详情:10000})){
    assert.equal(fields.find(item=>item.key===key)?.maxlength,maxlength)
  }
  const component=fs.readFileSync(new URL('../components/UiBlock.vue',import.meta.url),'utf8')
  assert.match(component,/:maxlength="block\.editKeys\[j\]==='规格'\?160:-1"/)
})

test('G10 三位小数价格在页面提交前拦截，不产生商品保存请求', async () => {
  const f=fixture(),form={商品编码:'cup',商品名称:'保温杯',productGroup:'',retail:'89.999',cloud:'55',center:'45',owner:'35',可售库存:'108',weightGrams:'1000',uploads:[]}
  f.backend.editProduct={id:'cup',asset:'cup',status:'ACTIVE'}
  await f.handleRemote('save',ctx('G10',form))
  assert.equal(f.toasts.at(-1),'商品价格须为最多两位小数的有效金额')
  assert.equal(f.requests.some(request=>request.url.endsWith('/sku-save')),false)
})

test('售后详情旧链接按真实类型替换路由，不把换货显示成退款',async()=>{
 const exchange={id:'SHexchange',order_id:'HXreal',shop_id:2,member_id:201,refund_type:'EXCHANGE',status:'CLOSED'}
 const f=fixture({refunds:[exchange],pageStack:[]})
 f.state.activeOrder=exchange.order_id
 f.state.selectedRefund=exchange.id
 assert.equal(await f.pageData('M23',{}),true)
 assert.equal(f.routeActions.at(-1)?.url,'/pages/M24/index')
 assert.equal(f.routeActions.at(-1)?.type,'redirect')
 assert.equal(await f.pageData('M24',{}),true)
 assert.equal(f.routeActions.length,1)
 const returned=fixture({refunds:[{...exchange,id:'SHreturn',refund_type:'RETURN',status:'SUCCESS'}],pageStack:[]})
 returned.state.activeOrder=exchange.order_id
 returned.state.selectedRefund='SHreturn'
 assert.equal(await returned.pageData('M24',{}),true)
 assert.equal(returned.routeActions.at(-1)?.url,'/pages/M23/index')
})

test('D55 交错切换两笔订单时售后详情始终匹配当前订单',async()=>{
 const only={id:'SHonly',order_id:'HX100',shop_id:2,member_id:201,refund_type:'REFUND_ONLY',status:'SUCCESS',amount:10000}
 const returned={id:'SHreturn',order_id:'HX120',shop_id:2,member_id:201,refund_type:'RETURN',status:'SUCCESS',amount:6000}
 const f=fixture({refunds:[returned,only]})
 f.state.activeOrder='HX120';f.state.selectedRefund=returned.id
 await f.pageData('M23',{})
 assert.equal(f.backend.refund.id,returned.id)
 f.selectOrder({id:'HX100',items:[]})
 assert.equal(f.state.selectedRefund,null)
 await f.pageData('M23',{})
 assert.equal(f.backend.refund.id,only.id)
 assert.equal(f.state.selectedRefund,only.id)
 f.selectOrder({id:'HX120',items:[]})
 await f.pageData('M23',{})
 assert.equal(f.backend.refund.id,returned.id)
 f.state.activeOrder='HX100';f.state.selectedRefund=returned.id;f.backend.refund=returned
 await f.pageData('M23',{})
 assert.equal(f.backend.refund.id,only.id)
})

test('售后详情不回显其他会员的残留选中单，切换会员清理售后上下文',async()=>{
 const stale={id:'SHother',order_id:'HXother',shop_id:2,member_id:202,refund_type:'EXCHANGE',status:'CLOSED'}
 const f=fixture({pageStack:[]})
 f.backend.refund=stale;f.state.selectedRefund=stale.id
 assert.equal(await f.pageData('M23',{}),true)
 assert.equal(f.backend.refund,null)
 assert.match(JSON.stringify(f.blocks('M23')),/尚未选择售后记录/)
 const changed=fixture()
 changed.backend.member={id:202};changed.backend.refund=stale;changed.state.selectedRefund=stale.id
 await changed.refresh()
 assert.equal(changed.backend.refund,null)
 assert.equal(changed.state.selectedRefund,null)
})

test('售后详情刷新失败不展示上一次单据，提供重新读取入口',async()=>{
 const f=fixture({failures:['/bootstrap']})
 f.backend.refund={id:'SHstale',order_id:'HXstale',shop_id:2,member_id:201,refund_type:'RETURN',status:'SUCCESS'}
 for(const page of ['M23','M24']){
  assert.equal(await f.pageData(page,{}),false)
  const blocks=f.blocks(page)
  assert.match(JSON.stringify(blocks),/业务数据读取失败|重新读取/)
  assert.doesNotMatch(JSON.stringify(blocks),/SHstale/)
 }
})

test('订单售后记录将已完成换货标为换货已完成',()=>{
 const exchange={id:'SHexchange',order_id:'HXreal',shop_id:2,member_id:201,refund_type:'EXCHANGE',status:'CLOSED'}
 const f=fixture({refunds:[exchange]})
 f.backend.activeOrder={id:'HXreal',rawStatus:'COMPLETED',items:[{lineId:1,id:'sku-real',name:'测试商品',qty:1,unitPrice:2990}]}
 const record=f.blocks('M18').find(block=>block.title==='售后记录')
 assert.equal(record.items[0].value,'换货已完成')
})

test('M23 已退款售后单号在退款信息卡标记为可换行，金额和状态仍取同一真实售后单',()=>{
 const id='SH'+'a'.repeat(32),orderId='HX'+'b'.repeat(32)
 const refund={id,order_id:orderId,shop_id:2,member_id:201,refund_type:'REFUND_ONLY',status:'SUCCESS',line_id:1,qty:1,amount:2990,reason:'本地测试'}
 const f=fixture({refunds:[refund]})
 f.backend.refund=refund
 f.backend.activeOrder={id:orderId,rawStatus:'COMPLETED',order_type:'DEALER_RETAIL',items:[{lineId:1,id:'sku-real',name:'测试商品',qty:1,unitPrice:2990}]}
 const cards=f.blocks('M23').filter(block=>block.type==='rows')
 const info=cards.find(block=>block.title==='退款信息')
 assert.equal(info.items.find(item=>item.label==='售后单号')?.value,id)
 assert.equal(info.items.find(item=>item.label==='售后单号')?.wrapIdentifier,true)
 assert.equal(info.items.find(item=>item.label==='已退金额')?.value,'¥29.90')
 assert.equal(info.items.find(item=>item.label==='处理状态')?.value,'已退款')
 assert.ok(cards.filter(block=>block.items.some(item=>item.label==='售后单号')).every(block=>block.items.find(item=>item.label==='售后单号').wrapIdentifier===true))
})

test('订单详情区分原始实付款与累计现金退款，积分单不冒充现金退款',()=>{
 const f=fixture()
 f.backend.activeOrder={id:'HXpartial',rawStatus:'COMPLETED',order_type:'DEALER_RETAIL',total:89700,subtotal:89700,refunded:2990,items:[{lineId:1,id:'sku-real',name:'测试商品',qty:30,unitPrice:2990}]}
 const cash=f.blocks('M18').filter(block=>block.type==='rows').flatMap(block=>block.items)
 assert.equal(cash.find(item=>item.label==='实付款')?.value,'¥897.00')
 assert.equal(cash.find(item=>item.label==='已退款')?.value,'¥29.90')
 f.backend.activeOrder={...f.backend.activeOrder,id:'DHpoints',order_type:'POINTS',refunded:0,points_used:1800,points_scope:0}
 const points=f.blocks('M18').filter(block=>block.type==='rows').flatMap(block=>block.items)
 assert.equal(points.some(item=>item.label==='已退款'),false)
 assert.equal(points.find(item=>item.label==='扣除平台积分')?.value,1800)
})

test('冷启动保留当前售后定位，真正切换商城才清理定位',async()=>{
 const current=fixture({refunds:[{id:'SHcurrent',order_id:'HXreal',shop_id:2,member_id:201,refund_type:'RETURN',status:'SUCCESS'}]})
 current.backend.catalogShopId=null;current.state.selectedRefund='SHcurrent'
 await current.refresh()
 assert.equal(current.state.selectedRefund,'SHcurrent')
 const switching=fixture()
 switching.backend.catalogShopId=1;switching.state.selectedRefund='SHold'
 await switching.refresh()
 assert.equal(switching.state.selectedRefund,null)
})

test('换货状态通知进入换货详情而非退款详情',async()=>{
 const exchange={id:'SHnotice',order_id:'HXreal',shop_id:2,member_id:201,refund_type:'EXCHANGE',status:'CLOSED'}
 const f=fixture({refunds:[exchange],responses:{'/message-read':{id:1,event_type:'REFUND_UPDATED',reference_id:exchange.id,title:'换货已完成'}}})
 f.state.activeOrder='HXold'
 await f.handleRemote('message-open:1',ctx('M64',{}))
 assert.equal(f.navigations.at(-1),'M24')
 assert.equal(f.state.activeOrder,'HXreal')
})

test('M23 仅退款按售后状态区分申请金额和实退金额，不误显示退货验收步骤',()=>{
 const f=fixture()
 f.backend.activeOrder={id:'HXcoupon',items:[{lineId:7,id:'sku-real',name:'测试商品',qty:1,unitPrice:7990}]}
 f.backend.refund={id:'SHcoupon',line_id:7,qty:1,amount:7490,reason:'不喜欢/不想要',refund_type:'REFUND_ONLY',status:'APPROVED'}
 let blocks=f.blocks('M23')
 let info=blocks.find(block=>block.title==='售后申请')
 assert.deepEqual(plain(info.items.map(item=>[item.label,item.value])),[
  ['售后单号','SHcoupon'],['处理状态','审核通过'],['申请数量','1件'],['申请退款金额','¥74.90'],['退款原因','不喜欢/不想要']
 ])
 assert.match(blocks.find(block=>block.type==='notice').body,/尚未退款/)
 assert.deepEqual(plain(blocks.find(block=>block.type==='timeline').items),['申请提交','商家审核','渠道退款','退款完成'])
 f.backend.refund.status='SUCCESS'
 blocks=f.blocks('M23')
 assert.equal(blocks.find(block=>block.type==='timeline').active,4)
 assert.equal(blocks.find(block=>block.title==='退款信息').items[1].value,'已退款')
 assert.equal(blocks.find(block=>block.title==='退款信息').items[3].label,'已退金额')
 f.backend.refund.status='CLOSED'
 blocks=f.blocks('M23')
 assert.deepEqual(plain(blocks.find(block=>block.type==='timeline').items),['申请提交','售后已关闭'])
 assert.equal(blocks.find(block=>block.title==='售后申请').items[3].label,'原申请金额')
 assert.match(blocks.find(block=>block.type==='notice').body,/未发生退款/)
 f.backend.refund.status='REJECTED'
 blocks=f.blocks('M23')
 assert.equal(blocks.find(block=>block.title==='售后申请').items[3].label,'原申请金额')
 assert.match(blocks.find(block=>block.type==='notice').body,/已驳回.*未发生退款/)
})
test('M23 积分售后在申请、关闭、成功阶段只标退回积分，不冒充现金退款',()=>{
 const f=fixture()
 f.backend.activeOrder={id:'DHpoints',order_type:'POINTS',points_used:1000,items:[{lineId:8,id:'sku-real',name:'测试商品',qty:2,unitPrice:0}]}
 f.backend.refund={id:'SHpoints',order_id:'DHpoints',line_id:8,qty:1,amount:0,reason:'商品破损',refund_type:'REFUND_ONLY',status:'PENDING'}
 let blocks=f.blocks('M23'),card=blocks.find(block=>block.title==='售后申请')
 assert.equal(card.items[3].label,'申请退回积分')
 assert.equal(card.items[3].value,'500积分')
 assert.match(blocks.find(block=>block.type==='notice').body,/积分尚未退回/)
 f.backend.refund.status='CLOSED'
 blocks=f.blocks('M23');card=blocks.find(block=>block.title==='售后申请')
 assert.equal(card.items[3].label,'原申请退回积分')
 assert.match(blocks.find(block=>block.type==='notice').body,/积分未退回/)
 f.backend.refund.status='SUCCESS'
 blocks=f.blocks('M23');card=blocks.find(block=>block.title==='积分退回信息')
 assert.equal(card.items[3].label,'已退积分')
 assert.match(blocks.find(block=>block.type==='notice').body,/积分已退回/)
 assert.equal(JSON.stringify(blocks).includes('退款金额'),false)
})
test('M23 待审核仅退款可见撤销入口，终态和已寄回记录不显示',()=>{
 const f=fixture()
 f.backend.activeOrder={id:'HXrefund',items:[{lineId:7,id:'sku-real',name:'测试商品',qty:1,unitPrice:2990}]}
 f.backend.refund={id:'SHrefund',line_id:7,qty:1,amount:2990,reason:'商品破损',refund_type:'REFUND_ONLY',status:'PENDING',return_json:null}
 const cancel=()=>f.blocks('M23').filter(block=>block.type==='rows').flatMap(block=>block.items).some(item=>item.target==='cancel-after')
 assert.equal(cancel(),true)
 f.backend.refund.status='CLOSED'
 assert.equal(cancel(),false)
 f.backend.refund.status='WAIT_RETURN'
 f.backend.refund.return_json='{}'
 assert.equal(cancel(),false)
})
test('退货退款和换货成功时完成节点显示已完成',()=>{
 const f=fixture()
 f.backend.activeOrder={id:'HXfinished',items:[{lineId:7,id:'sku-real',name:'测试商品',qty:1,unitPrice:2990}]}
 f.backend.refund={id:'SHfinished',line_id:7,qty:1,amount:2990,reason:'商品破损',refund_type:'RETURN',status:'SUCCESS'}
 let timeline=f.blocks('M23').find(block=>block.type==='timeline')
 assert.equal(timeline.active,timeline.items.length)
 f.backend.refund.refund_type='EXCHANGE'
 f.backend.refund.status='CLOSED'
 timeline=f.blocks('M24').find(block=>block.type==='timeline')
 assert.equal(timeline.active,timeline.items.length)
})
test('M24 换货进度使用当前阶段说明，历史审核意见不冒充当前操作',()=>{
 const f=fixture()
 f.backend.activeOrder={id:'HXexchange',items:[{lineId:7,id:'sku-real',name:'测试商品',qty:1,unitPrice:2000}]}
 f.backend.refund={id:'SHexchange',line_id:7,qty:1,amount:2000,reason:'商品破损',refund_type:'EXCHANGE',status:'WAIT_RETURN',review_note:'待买家填写退回运单后验收',return_json:null}
 const body=()=>f.blocks('M24').find(block=>block.type==='notice').body
 assert.equal(body(),'请填写退回物流信息，等待商家验收。')
 f.backend.refund.return_json=JSON.stringify({carrier:'顺丰速运',tracking:'TESTRETURN1234'})
 assert.equal(body(),'退回运单已提交，等待商家验收。')
 f.backend.refund.status='WAIT_EXCHANGE'
 assert.equal(body(),'商家已验收，等待寄出换货商品。')
 f.backend.refund.status='EXCHANGE_SHIPPED'
 assert.equal(body(),'换货商品已发出，请核对物流并确认收货。')
 f.backend.refund.status='CLOSED'
 assert.equal(body(),'换货已完成，物流信息见下方明细。')
})
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}

test('G53 套餐原价与商品候选卡均采用零售价，不改代理购买价',()=>{
 const paper={id:'paper',name:'抽取式面巾纸',price:1000,retailPrice:2990,stock:10}
 const oil={id:'oil',name:'食用植物调和油',price:4000,retailPrice:7990,stock:10}
 const f=fixture({catalogProducts:[paper,oil]})
 f.products.push(paper,oil)
 const form={套餐商品:'paper:1\noil:1',_marketingTab:'组合套餐'}
 const cards=f.blocks('G53',form).find(block=>block.type==='productGrid').products
 assert.equal(form.原价合计,'109.80')
 assert.deepEqual(cards.map(product=>product.price),[2990,7990])
 assert.deepEqual(f.products.map(product=>product.price),[1000,4000])
})

test('G18 直接进入库存预警只选真实商城商品，不回退到示例商品',async()=>{
 const f=fixture({responses:{'/management/inventory':[]}}),form={}
 f.state.selectedProduct='stapler'
 assert.equal(await f.pageData('G18',form),true)
 assert.equal(form._warningSkuId,'sku-real')
 assert.equal(form.预警阈值,6)
 assert.equal(f.blocks('G18',form).find(block=>block.type==='product').id,'sku-real')
})

test('M55 本地联调登录过期后只续登录一次，并重读真实优惠券',async()=>{
 const campaign={id:'coupon-new',kind:'coupon',status:'ACTIVE',body:{type:'FULL_REDUCTION',name:'测试券',threshold:1000,discount:100,expiresAt:Date.now()+86400000}}
 const f=fixture({expireBootstrapOnce:true,documents:{coupons:[campaign]}})
 assert.equal(await f.pageData('M55',{}),true)
 assert.equal(f.requests.filter(r=>r.url.endsWith('/login')).length,1,JSON.stringify(f.requests))
 assert.equal(f.requests.filter(r=>r.url.endsWith('/bootstrap')).length,2)
 assert.equal(f.backend.coupons[0].id,campaign.id)
 assert.equal(f.backend.ready,true)
})

test('M26 本地会话过期后续登，资料读取与保存仍回填同一会员',async()=>{
 const profile={name:'续登资料',phone:'13800138000',gender:'女',birthday:'1995-09-23',region:['福建省','泉州市','安溪县'],signature:'测试签名',avatarId:''}
 const read=fixture({expireProfileOnce:true,renewedToken:'renewed-token',responses:{'/hexu/app/profile':profile}})
 const form={}
 await read.loadProfile(form,true)
 assert.equal(read.backend.token,'renewed-token')
 assert.equal(form.name,profile.name)
 assert.equal(form._profileMemberId,201)
 assert.equal(read.requests.filter(r=>r.url.endsWith('/profile')).length,2)
 assert.equal(read.requests.filter(r=>r.url.endsWith('/login')).length,1)

 const save=fixture({expireProfileOnce:true,renewedToken:'renewed-token',responses:{'/hexu/app/profile':profile}})
 const draft={...profile,name:'续登资料',_hydrated:true,_profileMemberId:201}
 await save.handleRemote('save',ctx('M26',draft))
 assert.equal(save.backend.token,'renewed-token')
 assert.equal(save.backend.profile.name,profile.name)
 assert.equal(draft._hydrated,true)
 assert.equal(save.toasts.at(-1),'保存成功')
 assert.equal(save.requests.filter(r=>r.url.endsWith('/login')).length,1)
})

test('正式环境登录过期后清除本地身份与业务缓存，不把旧优惠券显示为空态或可领取',async()=>{
 const f=fixture({remoteLogin:true,expireBootstrapOnce:true})
 Object.assign(f.backend,{ready:true,token:'expired-token',catalogShopId:2,member:{id:201},coupons:[{id:'old-coupon'}],account:{platformPoints:{available:100}}})
 Object.assign(f.state,{serverHydrated:true,cart:[{id:'sku-real'}],orders:[{id:'old-order'}]})
 await assert.rejects(f.refresh(),/登录已失效/)
 assert.equal(f.backend.ready,false)
 assert.equal(f.backend.token,'')
 assert.equal(f.backend.member,null)
 assert.equal(f.backend.coupons.length,0)
 assert.equal(f.state.cart.length,0)
 assert.equal(f.state.orders.length,0)
 assert.equal(f.state.serverHydrated,false)
 assert.equal(f.requests.filter(r=>r.url.endsWith('/login')).length,0)
})

const unpaidOrder=()=>({id:'own-unpaid',buyer_id:201,shop_id:2,rawStatus:'UNPAID',status:'待付款',order_type:'DEALER_RETAIL',total:2990,subtotal:2990,freight:0,discount:0,created_at:'2026-09-27T15:55:25.000-04:00',items:[{id:'sku-real',qty:1,unitPrice:2990}]})
const savedCart=()=>[{id:'cart-doc',kind:'cart',status:'ACTIVE',body:{items:[{id:'sku-real',qty:3,selected:true},{id:'other-sku',qty:2,selected:false}]}}]
const paidOrder=()=>({id:'paid-order',buyer_id:201,shop_id:2,status:'PAID',order_type:'DEALER_RETAIL',total:1000,subtotal:1000,items:[{id:'line-1',sku_id:'sku-real',qty:1,unit_price:1000}]})

test('M05 浏览记录来自服务端，重复浏览去重且后访问的商品置顶',async()=>{
 const f=fixture({catalogProducts:[{id:'sku-real',price:1000,stock:10},{id:'sku-next',price:2000,stock:5}]})
 await f.pageData('M05',{})
 assert.deepEqual(f.state.browseHistory,['sku-real'])
 await f.pageData('M05',{})
 assert.deepEqual(f.state.browseHistory,['sku-real'])
 f.state.selectedProduct='sku-next'
 await f.pageData('M05',{})
 assert.deepEqual(f.state.browseHistory,['sku-next','sku-real'])
 assert.deepEqual(f.docs.browse_history[0].body.ids,['sku-next','sku-real'])
 assert.equal(f.writes.filter(write=>write.operation==='browse').length,3)
})

test('资料页读取失败后的显式重试覆盖旧表单，普通后台刷新保留未保存输入',async()=>{
 const path='/hexu/app/profile',responses={[path]:{name:'原昵称',phone:'13800138000',gender:'女',birthday:'1995-09-23',region:['浙江省','杭州市'],signature:'原签名',avatarId:''}},failures=[];
 const f=fixture({responses,failures}),form={};
 await f.loadProfile(form);
 form.name='尚未保存的昵称';
 responses[path]={...responses[path],name:'服务端新昵称',signature:'服务端新签名'};
 await f.loadProfile(form);
 assert.equal(form.name,'尚未保存的昵称');
 failures.push('/profile');
 await assert.rejects(f.loadProfile(form),/服务暂不可用/);
 assert.match(f.backend.profileError,/服务暂不可用/);
 failures.length=0;
 await f.handleRemote('profile-refresh',ctx('M26',form));
 assert.equal(form.name,'服务端新昵称');
 assert.equal(form.signature,'服务端新签名');
 assert.equal(f.backend.profileError,'');
 assert.equal(f.writes.length,0);
})
test('M26 较早的资料读取响应或失败不覆盖较新的读取结果',async()=>{
 const f=fixture(),form={};const reads=[]
 f.setRequest(()=>{const task=deferred();reads.push(task);return task.promise})
 const old=f.loadProfile(form,true),latest=f.loadProfile(form,true)
 reads[1].resolve({name:'最新昵称',phone:'13800138000',region:[],avatarId:'',signature:'最新签名'})
 await latest
 reads[0].resolve({name:'旧昵称',phone:'13800138000',region:[],avatarId:'',signature:'旧签名'})
 await old
 assert.equal(form.name,'最新昵称')
 assert.equal(f.backend.profile.name,'最新昵称')
 const obsolete=f.loadProfile(form,true),current=f.loadProfile(form,true)
 reads[3].resolve({name:'刷新昵称',phone:'13800138000',region:[],avatarId:'',signature:''})
 await current
 reads[2].reject(new Error('旧请求失败'))
 await obsolete
 assert.equal(form.name,'刷新昵称')
 assert.equal(f.backend.profileError,'')
})
test('M26 保存或微信手机号授权成功后，先前的资料读取不得回滚回显',async()=>{
 const saved={name:'已保存昵称',phone:'13800138000',gender:'',birthday:'',region:[],signature:'已保存签名',avatarId:''}
 const f=fixture(),form={...saved,_hydrated:true,_profileMemberId:201},read=deferred()
 f.setRequest((path,data,method)=>method==='POST'?Promise.resolve(saved):read.promise)
 const old=f.loadProfile(form,true)
 await f.handleRemote('save',ctx('M26',form))
 read.resolve({...saved,name:'保存前昵称',signature:'保存前签名'})
 await old
 assert.equal(form.name,'已保存昵称')
 assert.equal(f.backend.profile.name,'已保存昵称')

 const phoneRead=deferred()
 f.setRequest((path,data,method)=>method==='POST'?Promise.resolve({...saved,phone:'13900139000'}):phoneRead.promise)
 const oldPhone=f.loadProfile(form,true)
 await f.authorizeProfilePhone('wechat-phone-code',form)
 phoneRead.resolve({...saved,phone:'13800138000'})
 await oldPhone
 assert.equal(form.phone,'13900139000')
 assert.equal(f.backend.profile.phone,'13900139000')
})
test('M26 并行资料读取失败后保存或手机号授权成功，会清除旧读取错误',async()=>{
 for(const operation of ['save','phone']){
  const profile={name:'已保存昵称',phone:operation==='phone'?'13900139000':'13800138000',gender:'',birthday:'',region:[],signature:'',avatarId:''}
  const f=fixture(),form={...profile,_hydrated:true,_profileMemberId:201},read=deferred(),write=deferred()
  f.setRequest((path,data,method)=>method==='POST'?write.promise:read.promise)
  const pendingRead=f.loadProfile(form,true)
  const pendingWrite=operation==='save'?f.handleRemote('save',ctx('M26',form)):f.authorizeProfilePhone('wechat-phone-code',form)
  read.reject(new Error('旧资料读取失败'))
  await assert.rejects(pendingRead,/旧资料读取失败/)
  assert.match(f.backend.profileError,/旧资料读取失败/)
  write.resolve(profile)
  await pendingWrite
  assert.equal(f.backend.profileError,'')
  assert.equal(form.phone,profile.phone)
 }
})
test('M26 资料读取响应前换账号，不把原账号资料回填到新账号表单',async()=>{
 const path='/hexu/app/profile';let f
 f=fixture({responses:{[path]:{name:'原账号昵称',phone:'13800138000',region:[],avatarId:''}},onRequest:url=>{if(url.endsWith('/profile')){f.backend.member={id:202,name:'新账号昵称'};f.backend.token='new-token'}}})
 const form={name:'新账号草稿'}
 await assert.rejects(f.loadProfile(form),/登录账号已变化/)
 assert.equal(form.name,'新账号草稿')
 assert.equal(f.backend.profile,null)
 assert.equal(f.backend.profileError,'')
})
test('M26 保存响应前换账号，原账号提交成功但不覆盖新账号资料或允许旧表单重交',async()=>{
 const path='/hexu/app/profile',saved={name:'原账号新昵称',phone:'13800138000',gender:'',birthday:'',region:[],signature:'',avatarId:''};let f
 f=fixture({responses:{[path]:saved},onRequest:(url,data,method)=>{if(url.endsWith('/profile')&&method==='POST'){f.backend.member={id:202,name:'新账号昵称'};f.backend.token='new-token';f.backend.profile={name:'新账号昵称',avatarId:''}}}})
 const form={name:'原账号新昵称',phone:'13800138000',gender:'',birthday:'',region:[],signature:'',avatarId:'',_hydrated:true,_profileMemberId:201}
 await f.handleRemote('save',ctx('M26',form))
 assert.equal(f.requests.filter(r=>r.url.endsWith('/profile')&&r.method==='POST').length,1)
 assert.equal(f.backend.member.name,'新账号昵称')
 assert.equal(f.backend.profile.name,'新账号昵称')
 assert.equal(form._hydrated,false)
 assert.match(f.toasts.at(-1),/原账号资料已保存/)
 await f.handleRemote('save',ctx('M26',form))
 assert.equal(f.requests.filter(r=>r.url.endsWith('/profile')&&r.method==='POST').length,1)
})
test('M26 微信手机号授权正常回填；响应前换账号不覆盖新账号手机号',async()=>{
 const path='/hexu/app/profile/phone',form={phone:'13800138000',_hydrated:true,_profileMemberId:201}
 const normal=fixture({responses:{[path]:{phone:'13900139000'}}})
 await normal.authorizeProfilePhone('wechat-code',form)
 assert.equal(form.phone,'13900139000')
 assert.equal(normal.backend.member.phone,'13900139000')

 let changed
 changed=fixture({responses:{[path]:{phone:'13900139000'}},onRequest:url=>{if(url.endsWith('/profile/phone')){changed.backend.member={id:202,phone:'13700137000'};changed.backend.token='new-token';changed.backend.profile={phone:'13700137000'}}}})
 const oldForm={phone:'13800138000',_hydrated:true,_profileMemberId:201}
 await changed.authorizeProfilePhone('wechat-code',oldForm)
 assert.equal(changed.backend.member.phone,'13700137000')
 assert.equal(changed.backend.profile.phone,'13700137000')
 assert.equal(oldForm.phone,'13800138000')
 assert.equal(oldForm._hydrated,false)
 assert.match(changed.toasts.at(-1),/原账号手机号已更新/)
})
test('M26 保存后退出重进从服务端重新回显全部字段与头像ID，不借用旧表单',async()=>{
 const path='/hexu/app/profile',avatarId='FILE'+'a'.repeat(32)
 const responses={[path]:{name:'原昵称',phone:'13800138000',gender:'',birthday:'',region:[],signature:'',avatarId:''}}
 const f=fixture({responses,onRequest:(url,data,method)=>{if(url.endsWith('/profile')&&method==='POST')responses[path]={...responses[path],...plain(data)}}})
 const form={}
 await f.loadProfile(form)
 Object.assign(form,{name:'新昵称',gender:'女',birthday:'1995-09-23',region:['浙江省','杭州市','余杭区'],signature:'新签名',avatarId})
 await f.handleRemote('save',ctx('M26',form))
 assert.equal(f.toasts.at(-1),'保存成功')
 const reopened={}
 await f.loadProfile(reopened)
 for(const key of ['name','gender','birthday','signature','avatarId'])assert.equal(reopened[key],form[key])
 assert.deepEqual(reopened.region,form.region)
 assert.equal(reopened.phone,'13800138000')
 assert.equal(reopened._profileMemberId,201)
 assert.equal(f.requests.filter(r=>r.url.endsWith('/profile')&&r.method==='GET').length,2)
})
test('M26 原账号草稿不能提交到新账号，切换后读取覆盖原草稿且不显示旧头像',async()=>{
 const path='/hexu/app/profile',responses={[path]:{name:'原账号',phone:'13800138000',gender:'',birthday:'',region:[],signature:'',avatarId:'FILE'+'a'.repeat(32)}}
 const f=fixture({responses}),form={}
 await f.loadProfile(form)
 assert.equal(f.backend.profileMemberId,201)
 f.backend.member={id:202,name:'新账号'};f.backend.token='new-token'
 const staleBlocks=f.blocks('M26',form)
 assert.equal(staleBlocks.length,1)
 assert.equal(staleBlocks[0].type,'notice')
 await f.handleRemote('save',ctx('M26',form))
 assert.equal(f.requests.filter(r=>r.url.endsWith('/profile')&&r.method==='POST').length,0)
 responses[path]={name:'新账号',phone:'13700137000',gender:'男',birthday:'',region:[],signature:'新签名',avatarId:''}
 await f.loadProfile(form)
 assert.equal(form.name,'新账号')
 assert.equal(form.avatarId,'')
 assert.equal(form._profileMemberId,202)
 assert.equal(f.backend.profileMemberId,202)
 assert.equal(f.backend.profile.avatarId,'')
})
test('M25 切换会员后资料读取失败，不保留原会员头像缓存',async()=>{
 const path='/hexu/app/profile',failures=[]
 const f=fixture({responses:{[path]:{name:'原账号',phone:'13800138000',region:[],avatarId:'FILE'+'a'.repeat(32)}},failures})
 await f.loadProfile({})
 assert.equal(f.backend.profileMemberId,201)
 f.backend.member={id:202,name:'新账号'};f.backend.token='new-token';failures.push('/profile')
 await assert.rejects(f.loadProfile(null),/服务暂不可用/)
 assert.equal(f.backend.profile,null)
 assert.equal(f.backend.profileMemberId,null)
})

test('积分转赠草稿绑定本人和积分归属，换商城或旧草稿不能确认',async()=>{
 const f=fixture();f.state.shopPoints=50;
 await f.handleRemote('transfer',ctx('M51',{pointsType:'商城积分',recipient:'13800138001',amount:'10'}));
 assert.equal(f.state.pendingTransfer.senderId,201);
 assert.equal(f.state.pendingTransfer.scopeShopId,2);
 f.backend.shopId=1;
 await f.handleRemote('confirm-transfer',ctx('M52',{}));
 assert.equal(f.writes.length,0);
 assert.match(f.toasts.at(-1),/账号或商城已变化/);

 const stale=fixture();stale.state.pendingTransfer={phone:'13800138001',recipientId:202,amount:10,type:'平台积分'};
 await stale.pageData('M52',{});
 assert.equal(stale.state.pendingTransfer,null);
 assert.match(JSON.stringify(stale.blocks('M52')),/暂无待确认转赠/);
})

test('转赠接口成功但资料刷新失败时保留回执并清草稿，不会再次扣积分',async()=>{
 const failures=[],f=fixture({failures});f.state.points=100;
 await f.handleRemote('transfer',ctx('M51',{pointsType:'平台积分',recipient:'13800138001',amount:'10'}));
 assert.equal(f.state.pendingTransfer.scopeShopId,0);
 failures.push('/bootstrap');
 await f.handleRemote('confirm-transfer',ctx('M52',{}));
 assert.deepEqual(f.writes.filter(x=>x.operation==='points-transfer').map(x=>[x.shopId,x.recipientId,x.amount]),[[0,202,10]]);
 assert.equal(f.state.pendingTransfer,null);
 assert.equal(f.state.lastTransferReceipt.reference,'JFnew');
 assert.equal(f.navigations.at(-1),'M53');
 assert.ok(f.toasts.some(message=>message.includes('转赠已提交，资料刷新失败')));
 await f.handleRemote('confirm-transfer',ctx('M52',{}));
 assert.equal(f.writes.filter(x=>x.operation==='points-transfer').length,1);
})
test('立即购买与采购付款不删除同款已保存购物车；购物车来源仅扣除本单数量',async()=>{
 const response={'/orders/paid-order':paidOrder()};
 for(const purchase of [false,true]){
  const f=fixture({documents:{cart:savedCart()},responses:response});f.state.activeOrder='paid-order';if(purchase)f.state.purchaseOrder='paid-order';
  await f.finishPaidOrder('paid-order');
  assert.equal(f.state.cart[0].qty,3);assert.equal(f.state.cart[1].qty,2);
  assert.equal(f.writes.filter(w=>w.kind==='cart').length,0);
  assert.equal(f.navigations.at(-1),purchase?'G16':'M16');
 }
 const f=fixture({documents:{cart:savedCart()},responses:response});f.state.activeOrder='paid-order';
 f.state.cartCheckouts={'paid-order':{shopId:2,memberId:201,items:[{id:'sku-real',qty:1}]}};
 await f.finishPaidOrder('paid-order');
 assert.equal(f.state.cart[0].qty,2);assert.equal(f.state.cart[1].qty,2);
 assert.equal(f.writes.filter(w=>w.kind==='cart').length,1);
 assert.equal(f.writes.find(w=>w.kind==='cart').items[0].qty,2);
 assert.equal(f.state.cartCheckouts['paid-order'],undefined);
})
test('购物车订单标记按商城和会员隔离，未知来源不误删',async()=>{
 for(const scope of [{shopId:3,memberId:201},{shopId:2,memberId:202}]){
  const f=fixture({documents:{cart:savedCart()},responses:{'/orders/paid-order':paidOrder()}});f.state.activeOrder='paid-order';
  f.state.cartCheckouts={'paid-order':{...scope,items:[{id:'sku-real',qty:3}]}};
  await f.finishPaidOrder('paid-order');assert.equal(f.state.cart[0].qty,3);assert.equal(f.writes.length,0);
 }
})
test('付款确认后购物车写失败可按原服务端购物车重试，不重复扣减',async()=>{
 const failures=['/document-save'],f=fixture({documents:{cart:savedCart()},responses:{'/orders/paid-order':paidOrder()},failures});
 f.state.activeOrder='paid-order';f.state.cartCheckouts={'paid-order':{shopId:2,memberId:201,items:[{id:'sku-real',qty:1}]}};
 await f.finishPaidOrder('paid-order');assert.equal(f.state.cartSyncPendingOrder,'paid-order');
 assert.ok(f.state.cartCheckouts['paid-order']);assert.equal(f.writes.length,0);
 assert.match(JSON.stringify(f.blocks('M18')),/购物车尚未同步/);
 failures.length=0;await f.handleRemote('payment-refresh',ctx('M18',{}));
 assert.equal(f.state.cart[0].qty,2);assert.equal(f.writes.filter(w=>w.kind==='cart').length,1);
 assert.equal(f.state.cartSyncPendingOrder,null);assert.equal(f.state.cartCheckouts['paid-order'],undefined);
})
test('订单详情刷新支付结果只检查当前订单，不借用另一笔待同步订单',async()=>{
 const f=fixture({responses:{'/orders/other-order':{...unpaidOrder(),id:'other-order',status:'UNPAID'},'/orders/paid-order':paidOrder()}});
 f.state.activeOrder='other-order';f.state.pendingPaymentOrder='other-order';f.state.cartSyncPendingOrder='paid-order';
 await f.handleRemote('payment-refresh',ctx('M18',{}));
 assert.ok(f.requests.some(x=>x.url.endsWith('/orders/other-order')));
 assert.ok(!f.requests.some(x=>x.url.endsWith('/orders/paid-order')));
 assert.equal(f.state.cartSyncPendingOrder,'paid-order');assert.equal(f.state.activeOrder,'other-order');
})
test('M12 订单已创建但资料刷新失败时进入收银台，同页重按不生成第二单',async()=>{
 const agreement={id:'POL-purchase-v1',version:'purchase-v1',title:'购买协议',content:'本地测试协议正文'}
 const f=fixture({failures:['/bootstrap'],responses:{'/policies':{PURCHASE_AGREEMENT:agreement}}}),address={name:'收货人',phone:'13800138000',region:'真实地区',detail:'实际地址'},form={orderConsent:true,_purchaseAgreementKey:'201:2:POL-purchase-v1:purchase-v1',remark:'一次购买'}
 f.state.addresses=[address]
 f.state.changes.M12={shopId:2,memberId:201,remark:'一次购买'}
 const context={...ctx('M12',form),checkoutQuote:{total:1000},selectedLines:[{id:'sku-real',qty:1}],pointsDiscount:0,address}
 await f.handleRemote('checkout',context)
 assert.equal(f.writes.filter(x=>x.items?.[0]?.id==='sku-real').length,1)
 assert.equal(f.writes[0].remark,'一次购买')
 assert.equal(f.writes[0].orderConsent,true)
 assert.equal(f.writes[0].agreementPolicyId,agreement.id)
 assert.equal(f.writes[0].agreementVersion,agreement.version)
 assert.equal(f.state.changes.M12,undefined)
 assert.equal(f.state.activeOrder,'purchase-created')
 assert.equal(f.backend.activeOrder.id,'purchase-created')
 assert.equal(f.navigations.at(-1),'M15')
 assert.match(f.toasts.at(-1),/订单已创建，资料刷新失败/)
 await f.pageData('M15',{})
 assert.doesNotMatch(JSON.stringify(f.blocks('M15')),/请先选择订单/)
 await f.handleRemote('checkout',context)
 assert.equal(f.writes.length,1)
 assert.equal(f.navigations.at(-1),'M15')
 f.backend.member.id=202
 await f.handleRemote('checkout',context)
 assert.equal(f.writes.length,1)
 assert.match(f.toasts.at(-1),/账号或商城已变化/)
})

test('M12 读取当前购买协议正文与版本，更新后清除旧勾选且不建单',async()=>{
 const responses={'/policies':{PURCHASE_AGREEMENT:{id:'POL-purchase-v1',version:'v1',title:'购买协议',content:'第一版正文'}}}
 const f=fixture({responses}),form={orderConsent:true}
 await f.pageData('M12',form)
 assert.equal(form.orderConsent,false)
 assert.equal(form._purchaseAgreementKey,'201:2:POL-purchase-v1:v1')
 const row=f.blocks('M12',form).find(block=>block.title==='购买协议')
 assert.equal(row.items[0].target,'policy:PURCHASE_AGREEMENT')
 assert.match(row.items[0].value,/v1/)
 await f.handleRemote('policy:PURCHASE_AGREEMENT',ctx('M12',form))
 assert.equal(f.backend.openPolicy.content,'第一版正文')
 form.orderConsent=true
 responses['/policies'].PURCHASE_AGREEMENT={id:'POL-purchase-v2',version:'v2',title:'购买协议',content:'第二版正文'}
 await f.pageData('M12',form)
 assert.equal(form.orderConsent,false)
 assert.equal(form._purchaseAgreementKey,'201:2:POL-purchase-v2:v2')
 assert.equal(f.writes.filter(write=>write.operation==='order-create').length,0)
})

test('M12 协议读取失败时清掉旧协议与勾选，展示失败态而不提交订单',async()=>{
 const failures=['/policies'],f=fixture({failures,responses:{'/policies':{}}}),form={orderConsent:true,_purchaseAgreementKey:'201:2:POL-old:v1'}
 f.backend.policies={PURCHASE_AGREEMENT:{id:'POL-old',version:'v1',title:'旧购买协议',content:'旧正文'}}
 await f.pageData('M12',form)
 assert.equal(form.orderConsent,false)
 assert.equal(form._purchaseAgreementKey,'')
 assert.equal(f.backend.policies.PURCHASE_AGREEMENT,undefined)
 assert.equal(f.blocks('M12',form)[0].title,'购买协议读取失败')
 assert.equal(f.writes.filter(write=>write.operation==='order-create').length,0)
 failures.length=0
 await f.pageData('M12',form)
 assert.equal(f.blocks('M12',form)[0].title,'购买协议未发布')
})
test('M62 积分兑换确认后刷新失败保留订单，重复点击不再扣积分',async()=>{
 const failures=[],f=fixture({failures,catalogProducts:[{id:'real-points',name:'真实积分商品',price:1000,point_price:80,stock:10}]})
 await f.pageData('M62',{})
 const address={name:'收货人',phone:'13800138000',region:'真实地区',detail:'实际地址'},form={兑换数量:1}
 f.state.addresses=[address];f.state.selectedPointProduct='real-points'
 failures.push('/bootstrap')
 await f.handleRemote('redeem',{...ctx('M62',form),address})
 assert.equal(f.writes.filter(x=>x.operation==='points-redeem').length,1)
 assert.equal(f.state.lastRedemption.id,'points-created')
 assert.equal(f.backend.redemptionOrder.id,'points-created')
 assert.equal(f.navigations.at(-1),'M63')
 assert.match(f.toasts.at(-1),/积分兑换已提交，资料刷新失败/)
 await f.pageData('M63',{})
 assert.match(JSON.stringify(f.blocks('M63')),/兑换订单已确认/)
 await f.handleRemote('redeem',{...ctx('M62',form),address})
 assert.equal(f.writes.length,1)
 failures.splice(0,failures.length,'/orders/points-created')
 await f.pageData('M63',{})
 assert.equal(f.backend.redemptionOrder.id,'points-created')
 assert.match(f.toasts.at(-1),/当前展示刚提交的订单/)
})
test('财务三个刷新动作读取失败时不谎报同步成功',async()=>{
 for(const [pageId,target,path] of [['G39','settle','/management/earnings'],['G42','reverse','/management/earnings'],['G44','query-payment','/management/withdrawals']]){
  const f=fixture({failures:[path]});await f.handleRemote(target,ctx(pageId,{}));
  assert.ok(f.toasts.length>0,JSON.stringify({pageId,toasts:f.toasts,requests:f.requests}));assert.ok(!f.toasts.some(x=>x.includes('已同步最新业务记录')));
 }
})
test('D97 收益与冲正订单按订单号搜索并每页仅显示八条',()=>{
 const f=fixture(),ids=Array.from({length:62},(_,i)=>`HX${String(i+1).padStart(4,'0')}`)
 f.backend.management.G42=ids.map(order_id=>({order_id}))
 f.backend.reversal={id:ids[0],total:2000,refunded:0,status:'PAID',earnings:[]}
 const blocks=[{type:'rows',title:'原始订单',items:[]},{type:'table',heads:[],rows:[]}]
 const first=f.render('G42',blocks,{},'', '',1).find(b=>b.title?.startsWith('选择订单'))
 const last=f.render('G42',blocks,{},'', '',8).find(b=>b.title?.startsWith('选择订单'))
 const searched=f.render('G42',blocks,{},'',ids[45],1).find(b=>b.title?.startsWith('选择订单'))
 assert.equal(first.items.length,8);assert.equal(last.items.length,6)
 assert.equal(last.items.at(-1).label,ids.at(-1));assert.equal(searched.items.length,1)
 f.backend.earningSummary={pending:100,settled:200,frozen:0}
 f.backend.management.G39=ids.map(order_id=>({order_id,status:'PENDING',agent_id:101,earning_type:'RETAIL',amount:100,reversed:0}))
 const earning=f.render('G39',[{type:'stats',items:[{label:'待结算'},{label:'已结算'},{label:'冻结'}]},{type:'ledger',items:[]}],{},'待结算','HX0046',1)
 assert.equal(earning.find(b=>b.type==='ledger').items.length,1)
})
test('D98 试算失败或参数变化后旧金额立即失效',async()=>{
 const failures=[]
 const f=fixture({failures,responses:{'/management/settlement-preview':{items:[{name:'零售毛利',type:'RETAIL',amount:3400}],chain:[]}}})
 Object.assign(f.backend,{settlementPreview:null,settlementPreviewKey:''})
 f.products.push({id:'sku-real',price:2000,retailPrice:2000,stock:10})
 const form={试算商品:'sku-real',归属代理:'990211 · 云代理',quantity:1,rate:3}
 await f.handleRemote('calculate',ctx('G40',form))
 assert.equal(f.backend.settlementPreview.items[0].amount,3400)
 form.quantity=0
 const stale=f.render('G40',[{type:'fields',items:[]},{type:'product'},{type:'settlement'},{type:'relation'}],form)
 assert.match(JSON.stringify(stale),/参数已变化，请重新试算/)
 assert.doesNotMatch(JSON.stringify(stale),/34\.00/)
 failures.push('/management/settlement-preview')
 await f.handleRemote('calculate',ctx('G40',form))
 assert.equal(f.backend.settlementPreview,null)
 assert.match(f.toasts.at(-1),/服务暂不可用/)
 failures.length=0;form.quantity=2
 await f.handleRemote('calculate',ctx('G40',form))
 assert.equal(f.backend.settlementPreview.items[0].amount,3400)
})
test('D99 收益页读取拒绝后持续显示失败，不伪装零金额或空数据',async()=>{
 for(const [id,path] of [['G39','/management/earningSummary'],['G40','/management/agents'],['G42','/management/earnings']]){
  const f=fixture({failures:[path]})
  f.backend.earningSummary={pending:87083,settled:441204,frozen:0}
  f.backend.management[id]=[{order_id:'HX-OLD'}]
  f.backend.settlementPreview={items:[{name:'旧',amount:3400}],chain:[]}
  await f.pageData(id,{})
  const rendered=f.blocks(id)
  assert.equal(rendered.length,1,id)
  assert.equal(rendered[0].title,'业务数据读取失败',id)
  assert.match(rendered[0].body,/服务暂不可用/)
  assert.doesNotMatch(JSON.stringify(rendered),/870\.83|4412\.04|暂无|HX-OLD/)
 }
})
test('M14 地址服务端保存后刷新失败仍回显一次，编辑不变成新建',async()=>{
 const form={name:'实际收货人',phone:'13800138000',region:'福建省 泉州市 安溪县',detail:'测试街道1号',usage:'公司',primary:true,addressConsent:true}
 const create=fixture({failures:['/bootstrap']})
 await create.handleRemote('save-address',ctx('M14',form))
 assert.equal(create.writes.filter(x=>x.kind==='address').length,1)
 assert.equal(create.state.addresses.length,1)
 assert.equal(create.state.addresses[0].serverId,'DOC1')
 assert.equal(create.state.addresses[0].region,form.region)
 assert.equal(create.writes[0].usage,'公司')
 assert.equal(create.state.addresses[0].usage,'公司')
 assert.equal(create.navigations.at(-1),'M13')
 assert.match(create.toasts.at(-1),/地址已保存，列表刷新失败/)
 await create.handleRemote('save-address',ctx('M14',form))
 assert.equal(create.writes.length,1)

 const edit=fixture({failures:['/bootstrap']})
 edit.state.addresses=[{serverId:'ADDR1',name:'原收货人',phone:'13800138000',region:'福建省 泉州市 安溪县',detail:'原地址',primary:true}]
 edit.state.editAddress=0
 const editForm={...form,detail:'更新后的地址',usage:'学校'};delete editForm._savedAddress
 await edit.handleRemote('save-address',ctx('M14',editForm))
 assert.equal(edit.writes.length,1)
 assert.equal(edit.writes[0].id,'ADDR1')
 assert.equal(edit.state.addresses.length,1)
 assert.equal(edit.state.addresses[0].detail,'更新后的地址')
 assert.equal(edit.state.addresses[0].usage,'学校')
})
test('M14 保存后回到原地址列表，不把已提交表单留在返回栈',async()=>{
 const form={name:'测试收件人',phone:'13900000001',region:'浙江省 杭州市 西湖区',detail:'测试路1号',usage:'家',primary:false,addressConsent:true}
 const fromList=fixture({pageStack:[{route:'pages/M25/index'},{route:'pages/M13/index'},{route:'pages/M14/index'}]})
 await fromList.handleRemote('save-address',ctx('M14',{...form}))
 assert.deepEqual(fromList.routeActions.map(action=>action.type),['back'])
 assert.equal(fromList.routeActions[0].delta,1)
 const direct=fixture({pageStack:[{route:'pages/M14/index'}]})
 await direct.handleRemote('save-address',ctx('M14',{...form}))
 assert.deepEqual(direct.routeActions.map(action=>action.type),['redirect'])
 assert.equal(direct.routeActions[0].url,'/pages/M13/index')
})
test('M14 缺地区、编辑上下文丢失或接口失败均不本地新增地址',async()=>{
 const form={name:'实际收货人',phone:'13800138000',region:'',detail:'测试街道1号',primary:true,addressConsent:true}
 const f=fixture()
 await f.handleRemote('save-address',ctx('M14',form))
 assert.equal(f.writes.length,0)
 assert.match(f.toasts.at(-1),/请选择有效的省、市、区/)
 f.state.editAddress=2;form.region='福建省 泉州市 安溪县'
 await f.handleRemote('save-address',ctx('M14',form))
 assert.equal(f.writes.length,0)
 assert.match(f.toasts.at(-1),/重新选择需要编辑的地址/)
 const failed=fixture({failures:['/document-save']})
 await failed.handleRemote('save-address',ctx('M14',form))
 assert.equal(failed.state.addresses.length,0)
 assert.equal(failed.navigations.length,0)
 assert.equal(form._savedAddress,undefined)
})
test('M14 地区不再限于三条示例，地址用途与长度校验不允许无效写入',async()=>{
 const fields=fixture().blocks('M14').find(block=>block.type==='fields').items
 assert.equal(fields.find(item=>item.key==='region').kind,'addressRegion')
 assert.equal(fields.find(item=>item.key==='usage').value,'家')
 const base={name:'收货人',phone:'13800138000',region:'新疆维吾尔自治区 乌鲁木齐市 天山区',detail:'测试街道1号',usage:'其他',addressConsent:true}
 const valid=fixture({failures:['/bootstrap']})
 await valid.handleRemote('save-address',ctx('M14',{...base}))
 assert.equal(valid.writes[0].region,base.region)
 assert.equal(valid.writes[0].usage,'其他')
 for(const invalid of [{usage:'虚构用途'},{name:'甲'.repeat(31)},{detail:'路'.repeat(151)},{phone:'12345'},{region:'区'.repeat(101)},{region:'火星省 土星市 木星区'},{region:'浙江省 泉州市 安溪县'}]){
  const f=fixture()
  await f.handleRemote('save-address',ctx('M14',{...base,...invalid}))
  assert.equal(f.writes.length,0,JSON.stringify(invalid))
  assert.ok(f.toasts.length>0,JSON.stringify(invalid))
 }
})
test('M13 设默认和删除以服务端成功为准，刷新失败仍保持本地列表一致',async()=>{
 const f=fixture({failures:['/bootstrap']})
 f.state.addresses=[{serverId:'ADDR1',name:'甲',phone:'13800138000',region:'福建省 泉州市',detail:'地址一',usage:'家',primary:true},{serverId:'ADDR2',name:'乙',phone:'13800138001',region:'福建省 泉州市',detail:'地址二',usage:'公司',primary:false}]
 f.state.selectedAddress=1
 await f.setDefaultAddress(1)
 assert.equal(f.writes.length,1)
 assert.equal(f.writes[0].id,'ADDR2')
 assert.equal(f.writes[0].usage,'公司')
 assert.deepEqual(f.state.addresses.map(a=>a.primary),[false,true])
 assert.match(f.toasts.at(-1),/默认地址已设置，列表刷新失败/)
 await f.setDefaultAddress(1)
 assert.equal(f.writes.length,1)
 await f.removeSavedAddress(0)
 assert.equal(f.writes[1].operation,'document-remove')
 assert.equal(f.writes[1].id,'ADDR1')
 assert.deepEqual(f.state.addresses.map(a=>a.serverId),['ADDR2'])
 assert.equal(f.state.selectedAddress,0)
 assert.match(f.toasts.at(-1),/地址已删除，列表刷新失败/)
})
test('M13 删除失败或地址索引失效不误删其他记录',async()=>{
 const f=fixture({failures:['/document-remove']})
 f.state.addresses=[{serverId:'ADDR1',name:'甲',region:'福建省',detail:'地址一'}]
 await assert.rejects(f.removeSavedAddress(2),/重新选择收货地址/)
 await assert.rejects(f.removeSavedAddress(0),/服务暂不可用/)
 assert.equal(f.state.addresses.length,1)
 assert.equal(f.writes.length,0)
})
test('M50 签到成功后刷新失败保留成功状态，同会员同店当天不重复提交',async()=>{
 const f=fixture({failures:['/bootstrap']})
 f.backend.checkinRewards={platform:5,shop:0}
 await f.handleRemote('checkin',ctx('M50',{}))
 assert.equal(f.writes.filter(x=>x.operation==='checkin').length,1)
 assert.equal(f.backend.checkinRewards.platform,0)
 assert.match(f.toasts.at(-1),/签到已完成，积分刷新失败/)
 await f.handleRemote('checkin',ctx('M50',{}))
 assert.equal(f.writes.length,1)
 assert.equal(f.toasts.at(-1),'今天已签到')
 f.backend.member.id=202
 await f.handleRemote('checkin',ctx('M50',{}))
 assert.equal(f.writes.length,2)
})
test('M13/M14 地址写入响应前切换账号，不覆盖新账号本地地址',async()=>{
 const switchAccount=f=>{f.backend.member={id:202};f.backend.token='other-token';f.state.addresses=[{serverId:'NEW1',name:'新账号地址',primary:true}]}
 let create
 create=fixture({onRequest:url=>{if(url.endsWith('/document-save'))switchAccount(create)}})
 const form={name:'原账号',phone:'13800138000',region:'福建省 泉州市 安溪县',detail:'旧地址',primary:true,addressConsent:true}
 await create.handleRemote('save-address',ctx('M14',form))
 assert.equal(create.writes.filter(x=>x.kind==='address').length,1)
 assert.deepEqual(create.state.addresses.map(a=>a.serverId),['NEW1'])
 assert.equal(create.navigations.length,0)
 assert.equal(form._savedAddress.memberId,201)
 assert.match(create.toasts.at(-1),/原账号地址已保存/)

 let primary
 primary=fixture({onRequest:url=>{if(url.endsWith('/document-save'))switchAccount(primary)}})
 primary.state.addresses=[{serverId:'OLD1',name:'原账号地址',phone:'13800138000',region:'福建省',detail:'旧地址',primary:false}]
 await primary.setDefaultAddress(0)
 assert.deepEqual(primary.state.addresses.map(a=>a.serverId),['NEW1'])
 assert.match(primary.toasts.at(-1),/原账号默认地址已提交/)

 let removal
 removal=fixture({onRequest:url=>{if(url.endsWith('/document-remove'))switchAccount(removal)}})
 removal.state.addresses=[{serverId:'OLD1',name:'原账号地址',primary:true}]
 await removal.removeSavedAddress(0)
 assert.deepEqual(removal.state.addresses.map(a=>a.serverId),['NEW1'])
 assert.match(removal.toasts.at(-1),/原账号地址已删除/)
})
test('M50 签到响应前切换账号，回执属于原账号且不覆盖新账号今日奖励',async()=>{
 let f
 f=fixture({onRequest:url=>{if(url.endsWith('/checkin')){f.backend.member={id:202};f.backend.token='other-token';f.backend.checkinRewards={platform:8,shop:2}}}})
 await f.handleRemote('checkin',ctx('M50',{}))
 assert.equal(f.writes.filter(x=>x.operation==='checkin').length,1)
 assert.equal(f.backend.checkinReceipt.memberId,201)
 assert.equal(f.backend.checkinRewards.platform,8)
 assert.match(f.toasts.at(-1),/原账号签到已完成/)
})
test('M55 优惠券领取成功后列表刷新失败保留已领回执，重复点击不再提交',async()=>{
 const campaign={id:'CAMP1',kind:'coupon',status:'ACTIVE',body:{name:'测试券',type:'FULL_REDUCTION',discount:500,threshold:3000,expiresAt:Date.now()+86400000}}
 const f=fixture({documents:{coupons:[campaign]},failures:['/coupons']})
 f.backend.coupons=plain(f.docs.coupons)
 await f.claimCoupon('CAMP1')
 assert.equal(f.writes.filter(w=>w.operation==='coupon-claim').length,1)
 assert.equal(f.backend.coupons[0].kind,'coupon_claim')
 assert.equal(f.backend.coupons[0].campaign_ref,'CAMP1')
 assert.equal(f.backend.coupons[0].body.name,'测试券')
 assert.match(f.toasts.at(-1),/优惠券已领取，列表刷新失败/)
 await f.claimCoupon('CAMP1')
 assert.equal(f.writes.filter(w=>w.operation==='coupon-claim').length,1)
 assert.equal(f.toasts.at(-1),'已领取该优惠券')
})
test('M55 正常领取只回读本店优惠券，服务端领取记录准确回显',async()=>{
 const campaign={id:'CAMP1',kind:'coupon',status:'ACTIVE',body:{name:'测试券',expiresAt:Date.now()+86400000}}
 const f=fixture({documents:{coupons:[campaign]}})
 f.backend.coupons=plain(f.docs.coupons)
 await f.claimCoupon('CAMP1')
 assert.equal(f.backend.coupons[0].id,'CP1')
 assert.equal(f.backend.coupons[0].body.campaignId,'CAMP1')
 assert.equal(f.toasts.at(-1),'优惠券已领取')
 assert.equal(f.requests.filter(r=>r.url.endsWith('/coupons')).length,1)
 assert.equal(f.requests.filter(r=>r.url.endsWith('/bootstrap')).length,0)
})
test('M55 领取失败、无效活动不造本地已领券；服务端列表短暂延迟保留回执',async()=>{
 const campaign={id:'CAMP1',kind:'coupon',status:'ACTIVE',body:{name:'测试券',expiresAt:Date.now()+86400000}}
 const failed=fixture({documents:{coupons:[campaign]},failures:['/coupon-claim']})
 failed.backend.coupons=plain(failed.docs.coupons)
 await assert.rejects(failed.claimCoupon('CAMP1'),/服务暂不可用/)
 assert.equal(failed.backend.coupons.length,1)
 assert.equal(failed.writes.length,0)
 await assert.rejects(failed.claimCoupon('不存在'),/活动已变化/)

 const lag=fixture({documents:{coupons:[campaign]},responses:{'/coupons':[]}})
 lag.backend.coupons=plain(lag.docs.coupons)
 await lag.claimCoupon('CAMP1')
 assert.equal(lag.backend.coupons[0].kind,'coupon_claim')
 assert.match(lag.toasts.at(-1),/列表同步稍有延迟/)
})
test('M55 领取响应前换账号，不把原账号领取回执写进新账号优惠券',async()=>{
 const campaign={id:'CAMP1',kind:'coupon',status:'ACTIVE',body:{name:'测试券',expiresAt:Date.now()+86400000}}
 let f
 f=fixture({documents:{coupons:[campaign]},onRequest:url=>{if(url.endsWith('/coupon-claim')){f.backend.member={id:202};f.backend.token='new-token';f.backend.coupons=[]}}})
 f.backend.coupons=plain(f.docs.coupons)
 await f.claimCoupon('CAMP1')
 assert.equal(f.writes.filter(w=>w.operation==='coupon-claim').length,1)
 assert.equal(f.backend.coupons.length,0)
 assert.match(f.toasts.at(-1),/原账号优惠券已领取/)
})
test('M55 切会员或切商城后即使优惠券回读失败，也不展示上一归属的券',async()=>{
 for(const scope of ['member','shop']){
  const f=fixture({failures:['/coupons']})
  f.backend.coupons=[{id:'OLD-CLAIM',kind:'coupon_claim',status:'AVAILABLE',body:{name:'原归属券',expiresAt:Date.now()+86400000}}]
  f.state.couponId='OLD-CLAIM'
  if(scope==='member')f.backend.member={id:202};else f.backend.catalogShopId=1
  await assert.rejects(f.refresh(),/服务暂不可用/)
  assert.equal(f.backend.coupons.length,0,scope)
  assert.equal(f.state.couponId,null,scope)
 }
})
test('M61 选券先用真实订单商品和地址请求服务端试算，校验期间不重复发送',async()=>{
 const coupon={id:'CP1',kind:'coupon_claim',status:'AVAILABLE',member_id:201,shop_id:2,body:{expiresAt:Date.now()+86400000}}
 let quoted
 const f=fixture({responses:{'/quote':{couponDiscount:500,total:2500}},onRequest:(url,data)=>{if(url.endsWith('/quote'))quoted=plain(data)}})
 f.products.push({id:'sku-real',price:1000,stock:10})
 f.backend.coupons=[coupon];f.state.cart=[{id:'sku-real',qty:2,selected:true}]
 f.state.addresses=[{name:'本人',phone:'13800138000',region:'福建省 泉州市',detail:'测试地址'}]
 const pending=f.validateCheckoutCoupon('CP1')
 await assert.rejects(f.validateCheckoutCoupon('CP1'),/校验中/)
 const result=await pending
 assert.equal(result.couponDiscount,500)
 assert.equal(quoted.couponId,'CP1')
 assert.equal(quoted.shopId,2)
 assert.deepEqual(quoted.items,[{id:'sku-real',qty:2}])
 assert.equal(quoted.address.name,'本人')
 assert.equal(f.backend.couponSelecting,false)
})
test('M61 服务端试算失败、账号变化或失效券均不能被确认为可用',async()=>{
 const coupon={id:'CP1',kind:'coupon_claim',status:'AVAILABLE',member_id:201,shop_id:2,body:{expiresAt:Date.now()+86400000}}
 const invalid=fixture({failures:['/quote']});invalid.backend.coupons=[coupon];invalid.state.cart=[{id:'sku-real',qty:1,selected:true}];invalid.products.push({id:'sku-real',price:1000,stock:10})
 await assert.rejects(invalid.validateCheckoutCoupon('CP1'),/服务暂不可用/)
 assert.equal(invalid.backend.couponSelecting,false)
 invalid.backend.coupons=[{...coupon,status:'USED'}]
 await assert.rejects(invalid.validateCheckoutCoupon('CP1'),/优惠券已失效/)
 invalid.backend.coupons=[coupon];invalid.state.cart.push({id:'removed',qty:1,selected:true})
 await assert.rejects(invalid.validateCheckoutCoupon('CP1'),/所选商品暂不可售/)

 let changed
 changed=fixture({responses:{'/quote':{couponDiscount:500}},onRequest:url=>{if(url.endsWith('/quote')){changed.backend.member={id:202};changed.backend.token='new-token'}}})
 changed.products.push({id:'sku-real',price:1000,stock:10})
 changed.backend.coupons=[coupon];changed.state.cart=[{id:'sku-real',qty:1,selected:true}]
 await assert.rejects(changed.validateCheckoutCoupon('CP1'),/账号、商城或结算商品已变化/)
 assert.equal(changed.backend.couponSelecting,false)
})
test('M47 提现金额与页面报价使用同一严格元分校验',async()=>{
 const invalid=['1.001','1.005','1e2','0x10','', ' ', '.', '-1', '90071992547409.92',null,undefined,NaN,Infinity]
 for(const amount of invalid){
  const f=fixture({documents:{settlement_account:[{id:'ACC1',status:'APPROVED',body:{channel:'BANK'}}]}})
  f.state.balance=1000
  const form={amount,consent:true,_withdrawalPolicyKey:'201:2:POLW:v1'}
  assert.ok(businessHelpers.withdrawal(amount,1000).error,String(amount))
  await f.handleRemote('withdraw',ctx('M47',form))
  assert.equal(f.writes.length,0,String(amount))
  assert.equal(f.requests.some(x=>x.url.endsWith('/documents/settlement_account')),false,String(amount))
  assert.ok(f.toasts.length>0,String(amount))
 }
 const valid=fixture({documents:{settlement_account:[{id:'ACC1',status:'APPROVED',body:{channel:'BANK'}}]}})
 valid.state.balance=1000
 const form={amount:'1.23',consent:true,_withdrawalPolicyKey:'201:2:POLW:v1'}
 await valid.handleRemote('withdraw',ctx('M47',form))
 assert.equal(valid.writes.length,1)
 assert.equal(valid.writes[0].amount,123)
 assert.equal(valid.state.lastWithdrawal.amount,123)
 assert.equal(form.amount,'')
 assert.equal(form.consent,false)
 assert.deepEqual(valid.navigations,['M49'])
})
test('M49 首次进入且无提现记录时显示空态，不把缺失回执当匹配',async()=>{
 const f=fixture()
 await f.pageData('M49',{})
 assert.equal(f.backend.withdrawalDetail,null)
 assert.match(JSON.stringify(f.blocks('M49')),/暂无提现记录/)
})
test('M49 终态分别保留审核说明和打款结果，长说明不被截断',()=>{
 const f=fixture()
 const payoutReason='本地模拟打款结果：'+'核对后未向真实银行发起转账。'.repeat(20)
 for(const status of ['FAILED','PAID']){
  f.backend.withdrawalDetail={id:'TXdetail',member_id:201,shop_id:2,amount:1000,fee:6,net:994,status,channel:'BANK',reason:'初审通过',payout_reason:payoutReason}
  const blocks=f.blocks('M49')
  const details=blocks.find(block=>block.type==='rows'&&block.title==='提现信息')
  assert.equal(details.items.find(item=>item.label==='审核说明')?.value,'初审通过')
  assert.equal(details.items.find(item=>item.label==='打款说明')?.value,payoutReason)
  assert.match(JSON.stringify(blocks),/本地模拟打款结果/)
 }
})
test('M64 提现通知指定单据即使未进入列表，M49 仍读取指定单而非旧提现',async()=>{
 const detail={id:'TXnotice',member_id:201,shop_id:2,amount:880,fee:5,net:875,status:'PAID',channel:'BANK'}
 const f=fixture({responses:{'/message-read':{id:11,title:'提现结果',event_type:'WITHDRAW_UPDATED',reference_id:'TXnotice'},'/withdrawals/TXnotice':detail}})
 f.backend.account.withdrawals=[{id:'TXold',member_id:201,shop_id:2,amount:300,status:'PAID'}]
 await f.handleRemote('message-open:11',ctx('M64',{}))
 assert.deepEqual(f.navigations,['M49'])
 await f.pageData('M49',{})
 assert.equal(f.backend.withdrawalDetail.id,'TXnotice')
 assert.equal(f.state.lastWithdrawal.id,'TXnotice')
 assert.equal(f.requests.some(r=>r.url.endsWith('/withdrawals/TXold')),false)
})
test('M64 旧版 SYSTEM 提现失败消息打开对应单据',async()=>{
 const id='TX6f0a7e7cb0be42c9a07844bad45b58a0'
 const detail={id,member_id:201,shop_id:2,amount:1000,status:'FAILED',payout_reason:'银行退票'}
 const f=fixture({responses:{'/message-read':{id:12,title:'银行卡打款失败',event_type:'SYSTEM',reference_id:id},['/withdrawals/'+id]:detail}})
 f.backend.account.withdrawals=[{id:'TXnew',member_id:201,shop_id:2,status:'PAID'}]
 await f.handleRemote('message-open:12',ctx('M64',{}))
 assert.deepEqual(f.navigations,['M49'])
 await f.pageData('M49',{})
 assert.equal(f.backend.withdrawalDetail.id,id)
 assert.equal(f.backend.withdrawalDetail.payout_reason,'银行退票')
})
test('M49 冷启动只恢复当前账号商城选中的提现单号',async()=>{
 const id='TX6f0a7e7cb0be42c9a07844bad45b58a0'
 const detail={id,member_id:201,shop_id:2,amount:1000,status:'FAILED'}
 const f=fixture({responses:{['/withdrawals/'+id]:detail}})
 f.backend.account.withdrawals=[{id:'TXnew',member_id:201,shop_id:2,status:'PAID'}]
 f.state.withdrawalView={id,memberId:201,shopId:2}
 await f.pageData('M49',{})
 assert.equal(f.backend.withdrawalDetail.id,id)
 assert.equal(f.requests.some(r=>r.url.endsWith('/withdrawals/TXnew')),false)
})
test('M49 指定提现单失效时明确失败，不退回展示另一笔记录',async()=>{
 const f=fixture({failures:['/withdrawals/TXmissing']})
 f.backend.account.withdrawals=[{id:'TXold',member_id:201,shop_id:2,amount:300,status:'PAID'}]
 f.backend.withdrawalDetail={id:'TXold',member_id:201,shop_id:2}
 f.state.lastWithdrawal={id:'TXmissing'}
 assert.equal(await f.pageData('M49',{}),false)
 assert.match(f.toasts.at(-1),/服务暂不可用/)
 assert.equal(f.backend.withdrawalDetail,null)
 assert.equal(f.requests.some(r=>r.url.endsWith('/withdrawals/TXold')),false)
})
test('M49 服务端提现明细属于别的商城时不回显',async()=>{
 const f=fixture({responses:{'/withdrawals/TXother':{id:'TXother',member_id:201,shop_id:3,amount:880,status:'PAID'}}})
 f.state.lastWithdrawal={id:'TXother'}
 assert.equal(await f.pageData('M49',{}),false)
 assert.match(f.toasts.at(-1),/不属于当前账号或商城/)
 assert.equal(f.backend.withdrawalDetail,null)
})
test('M49 提现详情请求途中切换账号，不把原账号明细回填新账号',async()=>{
 let f
 f=fixture({responses:{'/withdrawals/TXnotice':{id:'TXnotice',member_id:201,shop_id:2,amount:880,status:'PAID'}},onRequest:url=>{
  if(url.endsWith('/withdrawals/TXnotice')){f.backend.member={id:202};f.backend.token='new-token'}
 }})
 f.state.lastWithdrawal={id:'TXnotice'}
 assert.equal(await f.pageData('M49',{}),false)
 assert.match(f.toasts.at(-1),/账号或提现单已变化/)
 assert.equal(f.backend.withdrawalDetail,null)
})
test('M49 默认首笔读取期间另选提现单，不用旧响应覆盖新选择',async()=>{
 let f
 f=fixture({responses:{'/withdrawals/TXfirst':{id:'TXfirst',member_id:201,shop_id:2,amount:100,status:'PAID'}},onRequest:url=>{
  if(url.endsWith('/withdrawals/TXfirst'))f.state.lastWithdrawal={id:'TXsecond'}
 }})
 f.backend.account.withdrawals=[{id:'TXfirst',member_id:201,shop_id:2}]
 assert.equal(await f.pageData('M49',{}),false)
 assert.equal(f.backend.withdrawalDetail,null)
 assert.equal(f.state.lastWithdrawal.id,'TXsecond')
 assert.match(f.toasts.at(-1),/账号或提现单已变化/)
})
test('M49 本地沙盒明确 PAID 回执不要求微信转账 package，回读本人提现单后提示模拟到账',async()=>{
 const receipt={id:'TXsandbox',member_id:201,shop_id:2,amount:1000,fee:6,net:994,status:'PAID',channel:'WECHAT',channel_ref:'SANDBOX-TXsandbox'};
 const responses={'/wechat/withdrawals/TXsandbox/transfer':{sandbox:true,status:'PAID',channelRef:'SANDBOX-TXsandbox',withdrawal:receipt},'/withdrawals/TXsandbox':receipt};
 const f=fixture({responses});f.state.lastWithdrawal=receipt;f.backend.withdrawalDetail=receipt;
 await f.handleRemote('wechat-transfer',ctx('M49',{}));
 assert.equal(f.requests.some(r=>r.url.endsWith('/wechat/withdrawals/TXsandbox/transfer')&&r.method==='POST'),true);
 assert.equal(f.requests.some(r=>r.url.endsWith('/withdrawals/TXsandbox')),true);
 assert.equal(f.backend.withdrawalDetail.status,'PAID');
 assert.equal(f.toasts.at(-1),'本地模拟到账');
})
test('M49 缺沙盒标记或正式环境仍须微信渠道 package，不把 PAID 字样冒充收款授权',async()=>{
 const receipt={id:'TXsandbox',member_id:201,shop_id:2,amount:1000,fee:6,net:994,status:'APPROVED',channel:'WECHAT'};
 for(const [remoteLogin,data] of [[false,{sandbox:false,status:'PAID'}],[true,{sandbox:true,status:'PAID'}]]){
  const f=fixture({remoteLogin,responses:{'/wechat/withdrawals/TXsandbox/transfer':data}});f.state.lastWithdrawal=receipt;f.backend.withdrawalDetail=receipt;
  await f.handleRemote('wechat-transfer',ctx('M49',{}));
  assert.match(f.toasts.at(-1),/渠道未返回收款确认参数/);
  assert.equal(f.toasts.includes('本地模拟到账'),false);
  assert.equal(f.requests.some(r=>r.url.endsWith('/withdrawals/TXsandbox')),false);
 }
})
test('会员或商城切换时清除旧提现选择与详情缓存',async()=>{
 const memberChanged=fixture()
 memberChanged.backend.member={id:202}
 memberChanged.backend.withdrawalDetail={id:'TXother',member_id:202,shop_id:2}
 memberChanged.state.lastWithdrawal={id:'TXother'}
 await memberChanged.refresh()
 assert.equal(memberChanged.backend.withdrawalDetail,null)
 assert.equal(memberChanged.state.lastWithdrawal,null)

 const shopChanged=fixture()
 shopChanged.backend.shopId=1
 shopChanged.backend.withdrawalDetail={id:'TXother',member_id:201,shop_id:2}
 shopChanged.state.lastWithdrawal={id:'TXother'}
 await shopChanged.refresh()
 assert.equal(shopChanged.backend.withdrawalDetail,null)
 assert.equal(shopChanged.state.lastWithdrawal,null)
})
test('M46 指定收益不在最近列表时读取指定编号，不冒充第一笔',async()=>{
 const detail={id:22,member_id:201,shop_id:2,amount:500,status:'AVAILABLE'}
 const f=fixture({responses:{'/earnings/22':detail}})
 f.backend.account.earnings=[{id:11,member_id:201,shop_id:2,amount:100}]
 f.state.selectedEarning=22
 assert.equal(await f.pageData('M46',{}),true)
 assert.equal(f.backend.earningDetail.id,22)
 assert.equal(f.requests.some(r=>r.url.endsWith('/earnings/11')),false)
})
test('M46 收益明细跨商城或读取中换账号时不回显',async()=>{
 const otherShop=fixture({responses:{'/earnings/22':{id:22,member_id:201,shop_id:3,amount:500}}})
 otherShop.state.selectedEarning=22
 assert.equal(await otherShop.pageData('M46',{}),false)
 assert.equal(otherShop.backend.earningDetail,null)
 assert.match(otherShop.toasts.at(-1),/不属于当前账号或商城/)

 let changed
 changed=fixture({responses:{'/earnings/22':{id:22,member_id:201,shop_id:2,amount:500}},onRequest:url=>{
  if(url.endsWith('/earnings/22')){changed.backend.member={id:202};changed.backend.token='new-token'}
 }})
 changed.state.selectedEarning=22
 assert.equal(await changed.pageData('M46',{}),false)
 assert.equal(changed.backend.earningDetail,null)
 assert.match(changed.toasts.at(-1),/账号或收益记录已变化/)
})
test('G43/G44 管理端指定提现申请不在当前列表时仍按编号读取，不冒充待审单',async()=>{
 const list=[{id:'TXold',shop_id:2,status:'PENDING'}]
 const detail={id:'TXchosen',shop_id:2,member_id:201,status:'PAID',amount:880}
 for(const pageId of ['G43','G44']){
  const f=fixture({responses:{'/management/withdrawals':list,'/management/withdrawals/TXchosen':detail}})
  f.state.selectedWithdrawal='TXchosen'
  assert.equal(await f.pageData(pageId,{}),true)
  assert.equal(f.backend.managementWithdrawal.id,'TXchosen')
  assert.equal(f.requests.some(r=>r.url.endsWith('/management/withdrawals/TXold')),false)
 }
})
test('G43 管理提现明细跨商城或读取中换账号时不回显',async()=>{
 const list=[{id:'TXold',shop_id:2,status:'PENDING'}]
 const otherShop=fixture({responses:{'/management/withdrawals':list,'/management/withdrawals/TXchosen':{id:'TXchosen',shop_id:3}}})
 otherShop.state.selectedWithdrawal='TXchosen'
 assert.equal(await otherShop.pageData('G43',{}),false)
 assert.equal(otherShop.backend.managementWithdrawal,null)
 assert.match(otherShop.toasts.at(-1),/不属于当前商城/)

 let changed
 changed=fixture({responses:{'/management/withdrawals':list,'/management/withdrawals/TXchosen':{id:'TXchosen',shop_id:2}},onRequest:url=>{
  if(url.endsWith('/management/withdrawals/TXchosen')){changed.backend.member={id:202};changed.backend.token='new-token'}
 }})
 changed.state.selectedWithdrawal='TXchosen'
 assert.equal(await changed.pageData('G43',{}),false)
 assert.equal(changed.backend.managementWithdrawal,null)
 assert.match(changed.toasts.at(-1),/管理账号或提现申请已变化/)
})
test('G43/G44 权限拒绝时显示橙色错误态，不把拒绝当成无提现记录',async()=>{
 for(const pageId of ['G43','G44']){
  const f=fixture({failures:['/management/withdrawals']})
  assert.equal(await f.pageData(pageId,{}),false)
  const blocks=f.blocks(pageId)
  assert.equal(blocks[0].type,'notice')
  assert.equal(blocks[0].tone,'orange')
  assert.match(blocks[0].body,/服务暂不可用/)
  assert.equal(JSON.stringify(blocks).includes('暂无提现记录'),false)
  assert.equal(f.backend.managementWithdrawal,null)
 }
})
test('M47 提交成功后刷新失败仍进入详情，不留下可重复提交的表单',async()=>{
 const f=fixture({documents:{settlement_account:[{id:'ACC1',status:'APPROVED',body:{channel:'BANK'}}]},failures:['/bootstrap','/withdrawals/TXnew']})
 f.state.balance=1000
 f.backend.account.withdrawals=[{id:'TXold',member_id:201,shop_id:2,amount:300,status:'PAID'}]
 const form={amount:'10.00',consent:true,_withdrawalPolicyKey:'201:2:POLW:v1'}
 await f.handleRemote('withdraw',ctx('M47',form))
 assert.equal(f.writes.length,1)
 assert.equal(f.writes[0].amount,1000)
 assert.equal(f.state.lastWithdrawal.id,'TXnew')
 assert.deepEqual(f.navigations,['M49'])
 assert.equal(form.amount,'')
 assert.equal(form.consent,false)
 assert.match(f.toasts.at(-1),/提现申请已提交，资料刷新失败/)
 await f.pageData('M49',form)
 assert.equal(f.backend.withdrawalDetail.id,'TXnew')
 assert.equal(f.state.lastWithdrawal.id,'TXnew')
 assert.match(f.toasts.at(-1),/当前展示刚提交的申请/)
 await f.handleRemote('withdraw',ctx('M47',form))
 assert.equal(f.writes.length,1)
})
test('岗位写入和通知模板保存成功后回读失败，不提示写入失败或重复创建',async()=>{
 const staff=fixture({failures:['/management/operations/staff']}),form={staffLogin:'staff',role:'仓储人员',staffEnabled:true,staffReason:'授权'};
 staff.backend.staffLookup={user_id:12,user_name:'staff'};await staff.handleRemote('save',ctx('G61',form));
 assert.equal(staff.writes.length,1);assert.match(staff.toasts.at(-1),/已保存，列表读取失败/);
 const template=fixture({failures:['/management/documents_notification_template']});
 await template.handleRemote('template-save',ctx('G64',{templateEvent:'订单',templateTitle:'通知',templateContent:'内容'}));
 assert.equal(template.writes.length,1);assert.match(template.toasts.at(-1),/模板已保存，列表刷新失败/);
})

test('通知模板编辑显示中文占位说明，保存时仍写入服务端需要的替换标记',async()=>{
 const f=fixture({documents:{notification_template:[{id:'T1',status:'ACTIVE',body:{event:'ORDER_PAID',name:'支付提醒',title:'{{shop}}通知',content:'{{message}}，关联单号 {{reference}}'}}]}}),form={}
 await f.pageData('G64',form)
 assert.equal(form.templateContent,'【业务说明】，关联单号 【关联单号】')
 const blocks=f.blocks('G64',form,'消息通知')
 assert.ok(blocks.some(block=>block.title==='发送时自动填写'))
 assert.doesNotMatch(JSON.stringify(blocks),/\{\{(?:shop|reference|message)\}\}/)
 await f.handleRemote('template-open:T1',ctx('G64',form))
 assert.equal(form.templateTitle,'【商城名称】通知')
 form.templateContent='【商城名称】：【业务说明】，单号【关联单号】'
 await f.handleRemote('template-save',ctx('G64',form))
 assert.equal(f.writes.at(-1).title,'{{shop}}通知')
 assert.equal(f.writes.at(-1).content,'{{shop}}：{{message}}，单号{{reference}}')
})
test('公司采购售后只给采购人入口，其他管理人可关联但不能冒用买家单',async()=>{
 const f=fixture(),refund={id:'customer-refund',order_id:'customer-order',line_id:7,status:'WAIT_EXCHANGE'};
 f.backend.refund=refund;f.backend.afterSaleLinks=[{customerRefundId:refund.id,wholesaleOrderId:'wholesale-order',wholesaleBuyerId:202}];
 let row=f.blocks('G28',{},'整箱直发关联').find(b=>b.title==='公司售后操作').items[0];
 assert.equal(row.target,undefined);assert.match(row.value,/采购人本人/);
 await f.handleRemote('direct-wholesale-refund',ctx('G28',{}));
 assert.match(f.toasts.at(-1),/采购订单的购买人/);assert.ok(!f.requests.some(x=>x.url.includes('/orders/wholesale-order')));
 f.backend.afterSaleLinks[0].wholesaleBuyerId=201;
 row=f.blocks('G28',{},'整箱直发关联').find(b=>b.title==='公司售后操作').items[0];
 assert.equal(row.target,'direct-wholesale-refund');
})
test('取消订单必须确认，拒绝或弹窗失败不写；列表明确取消所点订单而非旧activeOrder',async()=>{
 for(const options of [{modalConfirm:false},{modalFailure:true},{}]){
  const f=fixture({...options,failures:['/bootstrap']}),order=unpaidOrder();f.state.orders=[order];f.state.activeOrder='other-order';
  await f.handleRemote('cancel-order:'+order.id,ctx('M17',{}));
  assert.equal(f.modals.length,1);assert.match(f.modals[0].content,/不可继续付款/);
  const confirmed=!options.modalFailure&&options.modalConfirm!==false;
  assert.equal(f.writes.length,confirmed?1:0);
  assert.equal(order.rawStatus,confirmed?'CANCELLED':'UNPAID');
  if(confirmed){assert.equal(f.writes[0].id,order.id);assert.match(f.toasts.at(-1),/订单已取消，资料刷新失败/)}
 }
 const ui=fs.readFileSync(new URL('../components/UiBlock.vue',import.meta.url),'utf8');assert.match(ui,/emit\('action','cancel-order:'\+o\.id\)/);
 assert.doesNotMatch(ui,/apiCommand\('order-cancel'/);
})
test('取消订单确认期间身份或状态变化、非本人和无订单不发送取消请求，API失败保留待付',async()=>{
 for(const scenario of ['identity','status','other-owner','missing','request-failure']){
  let f,order=unpaidOrder();
  f=fixture({failures:scenario==='request-failure'?['/order-cancel']:[],onModal:()=>{if(scenario==='identity')f.backend.token='new-actor';if(scenario==='status')order.rawStatus='PAID'}});
  if(scenario==='other-owner')order.buyer_id=202;
  if(scenario!=='missing')f.state.orders=[order];f.state.activeOrder=order.id;
  await f.handleRemote('cancel-order',ctx('M18',{}));assert.equal(f.writes.length,0);
  if(scenario==='request-failure')assert.equal(order.rawStatus,'UNPAID');
 }
})
test('取消确认期间刷新替换订单对象时按同ID重读新状态，不提交捕获的旧待付对象',async()=>{
 let f;const original=unpaidOrder();
 f=fixture({onModal:()=>{f.state.orders=[{...original,rawStatus:'PAID',status:'待发货'}]}});
 f.state.orders=[original];f.backend.activeOrder=original;f.state.activeOrder=original.id;
 await f.handleRemote('cancel-order',ctx('M18',{}));
 assert.equal(f.writes.length,0);assert.equal(original.rawStatus,'UNPAID');assert.equal(f.state.orders[0].rawStatus,'PAID');assert.match(f.toasts.at(-1),/订单状态已变化/);
})
test('取消确认弹窗在途的重复点击只开一窗，取消/确认后均释放busy',async()=>{
 for(const confirm of [false,true]){
  let dialog;const f=fixture({modalDeferred:true,failures:['/bootstrap'],onModal:o=>{dialog=o}}),order=unpaidOrder();f.state.orders=[order];
  const first=f.handleRemote('cancel-order:'+order.id,ctx('M17',{}));
  assert.equal(f.backend.busy,true);await f.handleRemote('cancel-order:'+order.id,ctx('M17',{}));assert.equal(f.modals.length,1);
  dialog.success({confirm});await first;
  assert.equal(f.writes.length,confirm?1:0);assert.equal(f.backend.busy,false);
 }
})
test('确认收货须二次确认，取消、身份变化和失败均不提交',async()=>{
 const shipped=()=>({id:'ship-test',rawStatus:'SHIPPED',status:'待收货',buyer_id:201,shop_id:2,items:[{id:'sku-real'}]})
 for(const scenario of ['cancel','dialog-failure','identity','status','api-failure','success']){
  let f
  f=fixture({modalConfirm:scenario!=='cancel',modalFailure:scenario==='dialog-failure',failures:scenario==='api-failure'?['/order-receive']:[],onModal:()=>{if(scenario==='identity')f.backend.token='other-token';if(scenario==='status')f.backend.activeOrder.rawStatus='COMPLETED'}})
  f.state.activeOrder='ship-test';f.backend.activeOrder=shipped()
  await f.handleRemote('receive',ctx('M19',{}))
  assert.equal(f.modals.length,1,scenario)
  assert.match(f.modals[0].content,/订单将完成并结算收益/)
  assert.equal(f.writes.filter(w=>w.operation==='order-receive').length,scenario==='success'?1:0,scenario)
  assert.equal(f.backend.busy,false,scenario)
  if(scenario==='success')assert.ok(f.navigations.includes('M10'))
 }
})
const cancellableRefund=()=>({id:'own-refund',order_id:'own-order',shop_id:2,member_id:201,status:'WAIT_RETURN',return_json:null,refund_type:'RETURN'})
const shippableExchange=()=>({id:'own-exchange',order_id:'own-order',shop_id:2,member_id:201,status:'EXCHANGE_SHIPPED',refund_type:'EXCHANGE'})
test('撤销售后须二次确认；拒绝、弹窗失败、接口失败均保持原状态',async()=>{
 for(const options of [{modalConfirm:false},{modalFailure:true},{failures:['/refund-cancel']}]){
  const f=fixture({refunds:[cancellableRefund()],...options});f.backend.refund=f.backend.account.refunds[0];f.state.selectedRefund='own-refund';
  await f.handleRemote('cancel-after',ctx('M23',{}));
  assert.equal(f.modals.length,1);assert.match(f.modals[0].content,/撤销后/);
  assert.equal(f.writes.length,0);assert.equal(f.backend.account.refunds[0].status,'WAIT_RETURN');
  assert.equal(f.backend.busy,false);
 }
})
test('撤销售后只操作本人本店可撤销记录，确认期间身份或状态变化不发送请求',async()=>{
 for(const scenario of ['missing','other-member','other-shop','returned','finished','wrong-selection','identity','shop-change','status-change']){
  let f;const refund=cancellableRefund();
  if(scenario==='other-member')refund.member_id=202;
  if(scenario==='other-shop')refund.shop_id=3;
  if(scenario==='returned')refund.return_json='{}';
  if(scenario==='finished')refund.status='WAIT_EXCHANGE';
  f=fixture({refunds:scenario==='missing'?[]:[refund],onModal:()=>{if(scenario==='identity')f.backend.token='other-token';if(scenario==='shop-change')f.backend.shopId=3;if(scenario==='status-change')f.backend.account.refunds[0].status='WAIT_EXCHANGE'}});
  f.backend.refund=scenario==='missing'?null:f.backend.account.refunds[0];f.state.selectedRefund=scenario==='wrong-selection'?'other-refund':'own-refund';
  await f.handleRemote('cancel-after',ctx('M23',{}));
  assert.equal(f.writes.length,0,scenario);
 }
})
test('撤销售后成功即更新本地状态，后续刷新失败不误报提交失败；重复点击仅开一窗',async()=>{
 let dialog;const f=fixture({refunds:[cancellableRefund()],modalDeferred:true,failures:['/bootstrap'],onModal:o=>{dialog=o}});
 f.backend.refund=f.backend.account.refunds[0];f.state.selectedRefund='own-refund';
 const first=f.handleRemote('cancel-after',ctx('M23',{}));
 await f.handleRemote('cancel-after',ctx('M23',{}));assert.equal(f.modals.length,1);
 dialog.success({confirm:true});await first;
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].id,'own-refund');
 assert.equal(f.backend.account.refunds[0].status,'CLOSED');assert.equal(f.backend.refund.status,'CLOSED');
 assert.match(f.toasts.at(-1),/已撤销，资料刷新失败/);assert.equal(f.backend.busy,false);
 await f.handleRemote('cancel-after',ctx('M23',{}));assert.equal(f.writes.length,1);
})
test('确认换货收货必须二次确认；拒绝、弹窗或接口失败不关闭售后',async()=>{
 for(const options of [{modalConfirm:false},{modalFailure:true},{failures:['/exchange-receive']}]){
  const f=fixture({refunds:[shippableExchange()],...options});f.backend.refund=f.backend.account.refunds[0];f.state.selectedRefund='own-exchange';
  await f.handleRemote('exchange-receive',ctx('M24',{}));
  assert.equal(f.modals.length,1);assert.match(f.modals[0].content,/售后单将关闭/);
  assert.equal(f.writes.length,0);assert.equal(f.backend.refund.status,'EXCHANGE_SHIPPED');assert.equal(f.backend.busy,false);
 }
})
test('换货收货只允许本人本店已发出的当前单，确认期间变化不提交',async()=>{
 for(const scenario of ['missing','other-member','other-shop','pending','wrong-selection','identity','status-change']){
  let f;const refund=shippableExchange();
  if(scenario==='other-member')refund.member_id=202;
  if(scenario==='other-shop')refund.shop_id=3;
  if(scenario==='pending')refund.status='WAIT_EXCHANGE';
  f=fixture({refunds:scenario==='missing'?[]:[refund],onModal:()=>{if(scenario==='identity')f.backend.token='other-token';if(scenario==='status-change')f.backend.account.refunds[0].status='CLOSED'}});
  f.backend.refund=scenario==='missing'?null:f.backend.account.refunds[0];f.state.selectedRefund=scenario==='wrong-selection'?'other-id':'own-exchange';
  await f.handleRemote('exchange-receive',ctx('M24',{}));assert.equal(f.writes.length,0,scenario);
 }
})
test('换货确认成功即显示关闭，刷新失败仍保留结果并阻断重复提交',async()=>{
 const f=fixture({refunds:[shippableExchange()],failures:['/bootstrap']});f.backend.refund=f.backend.account.refunds[0];f.state.selectedRefund='own-exchange';
 await f.handleRemote('exchange-receive',ctx('M24',{}));
 assert.equal(f.writes.length,1);assert.equal(f.backend.refund.status,'CLOSED');
 assert.match(f.toasts.at(-1),/换货已完成，资料刷新失败/);
 await f.handleRemote('exchange-receive',ctx('M24',{}));assert.equal(f.writes.length,1);
})
test('售后M21不把空值或零数量改成1件，合法申请使用当前订单行和明确类型',async()=>{
 const f=fixture({failures:['/bootstrap']}),order={id:'real-order',rawStatus:'PAID',items:[{lineId:7,id:'sku-real',qty:2,refunded_qty:0,refunded_paid:0,paid:2000}]};
 f.state.activeOrder=order.id;f.state.afterType='换货';f.backend.activeOrder=order;f.backend.afterLineId=7;
 const form={申请数量:'',退款原因:'商品破损',问题描述:'真实问题',uploads:[]};
 assert.equal(f.blocks('M21',form).find(b=>b.type==='fields').items.find(i=>i.key==='退款金额').kind,'readonly');
 assert.equal(form.退款金额,'—');
 for(const quantity of ['',0,'0','1.5',3]){form.申请数量=quantity;await f.handleRemote('refund',ctx('M21',form));assert.equal(f.writes.length,0)}
 form.申请数量=1;assert.equal(f.blocks('M21',form).find(b=>b.type==='rows').items.find(i=>i.label==='本次换货商品价值').value,'¥10.00');
 await f.handleRemote('refund',ctx('M21',form));
 assert.deepEqual(f.writes[0],{operation:'refund-apply',shopId:2,id:'real-order',lineId:7,qty:1,type:'EXCHANGE',reason:'商品破损',description:'真实问题',uploads:[]});
 assert.equal(f.navigations.at(-1),'M24');assert.equal(f.backend.refund.id,'new-refund');
 assert.match(f.toasts.at(-1),/售后申请已提交，资料刷新失败/);
 await f.handleRemote('refund',ctx('M21',form));assert.equal(f.writes.length,1);
})
test('M21 真实积分抵扣单仅显示积分抵扣，不把它冒充优惠分摊且保留退款上限',()=>{
 const f=fixture(),line={lineId:7,id:'sku-real',name:'测试商品',unitPrice:2990,qty:1,paid:2392,refunded_qty:0,refunded_paid:0}
 f.backend.activeOrder={id:'HXpoints-cash',order_type:'DEALER_RETAIL',subtotal:2990,discount:0,points_used:598,freight:0,total:2392,items:[line]}
 const form={申请数量:1},card=f.blocks('M21',form).find(block=>block.type==='rows'&&block.title==='退款金额')
 assert.deepEqual(plain(card.items),[{label:'商品金额',value:'¥29.90'},{label:'积分抵扣',value:'−¥5.98'},{label:'本次最多可退',value:'¥23.92'}])
 assert.equal(form.退款金额,'23.92')
})
test('M20与M21复用同一张真实凭证时仅提交一次，并保留上一步的补充说明',async()=>{
 const file='FILE'+'a'.repeat(32),f=fixture({failures:['/bootstrap']});
 f.state.activeOrder='real-order';f.state.afterType='退货退款';
 f.backend.activeOrder={id:'real-order',rawStatus:'PAID',items:[{lineId:7,id:'sku-real',qty:1,refunded_qty:0}]};
 f.backend.afterDraft={补充说明:'上一步说明',uploads:[file]};
 await f.handleRemote('refund',ctx('M21',{申请数量:1,退款原因:'商品破损',问题描述:'',uploads:[file]}));
 assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0].uploads,[file]);assert.equal(f.writes[0].description,'上一步说明');
})
test('售后提交后列表暂未同步时仍保留服务端返回单据和去重状态',async()=>{
 const f=fixture();f.state.activeOrder='real-order';f.state.afterType='仅退款';
 f.backend.activeOrder={id:'real-order',rawStatus:'PAID',items:[{lineId:7,id:'sku-real',qty:1,refunded_qty:0}]};
 await f.handleRemote('refund',ctx('M21',{申请数量:1,退款原因:'商品破损',问题描述:'',uploads:[]}));
 assert.equal(f.writes.length,1);assert.equal(f.backend.refund?.id,'new-refund');
 assert.equal(f.backend.account.refunds.some(item=>item.id==='new-refund'),true);
 assert.equal(f.navigations.at(-1),'M23');
})
test('未付及取消订单不冒充实付款，已付显示原付款、积分单不冒充微信渠道，日期格式化',()=>{
 for(const status of ['UNPAID','CANCELLED','PAID','SHIPPED','COMPLETED','REFUNDED']){
  const f=fixture(),order={...unpaidOrder(),rawStatus:status,status};f.backend.activeOrder=order;f.state.activeOrder=order.id;
  const rows=f.blocks('M18').filter(b=>b.type==='rows').flatMap(b=>b.items),unpaid=['UNPAID','CANCELLED'].includes(status);
  const payment=rows.find(r=>r.label==='支付方式');assert.equal(payment.value,unpaid?'未付款':'微信支付');
  const amount=rows.find(r=>r.label===(status==='UNPAID'?'待付金额':status==='CANCELLED'?'订单金额':'实付款'));assert.equal(amount.value,'¥29.90');
  assert.equal(rows.some(r=>r.label==='实付款'),!unpaid);assert.doesNotMatch(rows.find(r=>r.label==='下单时间').value,/T|\.000|-04:00/);
  order.order_type='POINTS';assert.equal(f.blocks('M18').filter(b=>b.type==='rows').flatMap(b=>b.items).find(r=>r.label==='支付方式').value,'平台积分');
 }
})

test('G22 管理订单快照不把未付或取消订单标成微信实付',()=>{
 for(const status of ['UNPAID','CANCELLED','PAID']){
  const f=fixture(),order={...unpaidOrder(),rawStatus:status,status,items:[{id:'sku-real',name:'真实商品',qty:1,unitPrice:2990}]}
  f.backend.management.G22=[order];f.state.managementOrder=order.id
  const rows=f.blocks('G22').find(block=>block.type==='rows'&&block.title==='金额快照').items
  const unpaid=status!=='PAID'
  assert.equal(rows.find(item=>item.label==='支付渠道').value,unpaid?'未付款':'微信支付')
  const amountLabel=status==='UNPAID'?'待付金额':status==='CANCELLED'?'订单金额':'实付金额'
  assert.equal(rows.find(item=>item.label===amountLabel).value,'¥29.90')
  assert.equal(rows.some(item=>item.label==='实付金额'),!unpaid)
 }
})

test('收银台与支付结果的大额数字始终取本次真实订单，不回显设计稿金额',()=>{
 const f=fixture(),order=unpaidOrder();
 f.backend.activeOrder=order;f.state.activeOrder=order.id;
 const cashier=f.blocks('M15');
 assert.equal(cashier.find(block=>block.type==='amount').value,'29.90');
 assert.equal(cashier.find(block=>block.type==='amount').label,'真实商城商品订单');
 assert.doesNotMatch(JSON.stringify(cashier),/¥40\.00|HX2026091300012345/);
 order.rawStatus='PAID';order.status='已支付';order.paid_at='2026-09-27T16:00:00.000-04:00';
 const result=f.blocks('M16');
 assert.equal(result.find(block=>block.type==='success').value,'¥29.90');
 assert.equal(result.find(block=>block.type==='rows').items.find(item=>item.label==='订单编号').value,order.id);
 assert.doesNotMatch(JSON.stringify(result),/¥40\.00|HX2026091300012345/);
 order.shop_id=900;order.total=72000;order.rawStatus='UNPAID';
 const wholesale=f.blocks('M15').find(block=>block.type==='amount');
 assert.equal(wholesale.value,'720.00');
 assert.equal(wholesale.label,'公司批发中台商品订单');
})

test('邀请页面和分享均更新非法或过期缓存，同店同代理未来缓存才复用',async()=>{
 const now=Date.now(),fresh={shopId:2,invite:'IV-fresh',expiresAt:now+86400000}
 for(const cached of [null,{expiresAt:'bad'},{expiresAt:null},{expiresAt:''},{expiresAt:'2026-02-30T12:00:00Z'},{expiresAt:now-1},{shopId:1,expiresAt:fresh.expiresAt},{agentId:7,expiresAt:fresh.expiresAt},{expiresAt:fresh.expiresAt}]) {
  const f=fixture({agent:{id:42},responses:{'/invite':fresh}})
  const original=cached?{shopId:2,agentId:42,invite:'IV-cached',...cached}:null
  const reusable=cached&&original.shopId===2&&original.agentId===42&&original.expiresAt===fresh.expiresAt
  f.backend.activeInvite=original
  await f.pageData('M34',{})
  assert.equal(f.requests.filter(r=>r.url.endsWith('/invite')).length,reusable?0:1)
  assert.equal(f.backend.activeInvite.invite,reusable?'IV-cached':'IV-fresh')
  f.backend.activeInvite=original
  await f.handleRemote('share',ctx('M34',{}))
  assert.equal(f.requests.filter(r=>r.url.endsWith('/invite')).length,reusable?0:2)
  assert.match(f.clipboard.at(-1),new RegExp('invite='+(reusable?'IV-cached':'IV-fresh')+'$'))
  assert.equal(f.writes.length,0)
 }
})

test('客服留言动作只提交后台消费字段，保留多行内容和关联订单',async()=>{
 const f=fixture(),form={question:'其他问题',message:' 第一行\n第二行\t说明 ',关联订单:' HX-own-order ',uploads:[],phone:'不提交',rank:3,_draft:'不提交'};
 await f.handleRemote('message',ctx('M29',form));
 assert.deepEqual(f.writes[0],{question:'其他问题',message:'第一行\n第二行\t说明',orderId:'HX-own-order',uploads:[],kind:'support',shopId:2});
 assert.equal(f.toasts.at(-1),'已提交后台');
 assert.equal(form.message,'');assert.equal(form.关联订单,'');assert.deepEqual(plain(form.uploads),[]);
 await f.handleRemote('message',ctx('M29',form));assert.equal(f.writes.length,1);
})

test('M29 新留言保存后选择新回执，详情不继续显示旧工单',async()=>{
 const old={id:'DOCold',kind:'support',member_id:201,shop_id:2,status:'PENDING',created_at:'2026-09-27 09:00:00',body:{question:'订单问题',message:'旧工单'}}
 const f=fixture({documents:{support:[old]}}),form={question:'其他问题',message:'新客服图片工单',关联订单:'',uploads:[]}
 await f.pageData('M29',form)
 assert.equal(f.backend.selectedSupportId,'DOCold')
 await f.handleRemote('message',ctx('M29',form))
 assert.equal(f.backend.selectedSupportId,'DOC1')
 assert.equal(f.blocks('M29').find(block=>block.title==='我的留言内容')?.body,'新客服图片工单')
 assert.equal(f.blocks('M29').find(block=>block.title==='客服回复')?.body,'留言已提交，等待客服处理。')
})

test('客服留言非法内容不调用接口，接口失败保留原表单便于重试',async()=>{
 const f=fixture(),form={question:'其他问题',message:'',关联订单:'',uploads:[]};
 for(const invalid of ['', ' ', '🌿'.repeat(501),'内容\u0000隐藏']){form.message=invalid;await f.handleRemote('message',ctx('M29',form));assert.equal(f.writes.length,0);}
 const failed=fixture({failures:['/document-save']}),draft={...form,message:'待重试留言'};
 await failed.handleRemote('message',ctx('M29',draft));assert.equal(failed.writes.length,0);assert.equal(draft.message,'待重试留言');assert.match(failed.toasts.at(-1),/服务暂不可用/);
})

test('客服已落库而刷新失败仍清空已提交草稿，不误称保存失败或再建工单',async()=>{
 const f=fixture({failures:['/bootstrap']}),form={question:'订单问题',message:'已保存留言',关联订单:'',uploads:[]};
 await f.handleRemote('message',ctx('M29',form));assert.equal(f.writes.length,1);assert.equal(form.message,'');assert.match(f.toasts.at(-1),/留言已提交，资料刷新失败/);
 await f.handleRemote('message',ctx('M29',form));assert.equal(f.writes.length,1);
})

test('M29 只显示本人当前商城留言，冷载显示500字原文和后台完整回复',async()=>{
 const id='DOC'+'a'.repeat(32),message='测试'.repeat(250),reply='已核对订单和寄回运单。'.repeat(16)
 const own={id,kind:'support',member_id:201,shop_id:2,status:'APPROVED',created_at:'2026-10-03 22:58:00',review_note:reply,body:{question:'售后服务',message,orderId:'HX-own'}}
 const others=[{...own,id:'DOC'+'b'.repeat(32),member_id:202,review_note:'其他会员私密回复'},{...own,id:'DOC'+'c'.repeat(32),shop_id:3,review_note:'其他商城私密回复'}]
 const f=fixture({documents:{support:[own,...others]}})
 assert.equal(await f.pageData('M29',{}),true)
 assert.equal(f.backend.supportRecords.length,1)
 const blocks=f.blocks('M29')
 assert.equal(blocks.find(block=>block.title==='客服回复')?.body,reply)
 assert.equal(blocks.find(block=>block.title==='我的留言内容')?.body,message)
 assert.equal(blocks.find(block=>block.title==='我的留言')?.items.length,1)
 assert.equal(JSON.stringify(blocks).includes('其他会员私密回复'),false)
 assert.equal(JSON.stringify(blocks).includes('其他商城私密回复'),false)
 const other=fixture({documents:{support:[own,...others]},bootstrapMember:{id:202,name:'另一会员',phone:'13800138002'}})
 assert.equal(await other.pageData('M29',{}),true)
 assert.equal(other.backend.supportRecords.length,1)
 assert.equal(other.backend.supportRecords[0].member_id,202)
})

test('M64 客服处理通知进入该会员的 M29 回复，不把通用状态文案当回复',async()=>{
 const id='DOC'+'a'.repeat(32),reply='商家核实寄回运单和售后状态后的完整处理意见'
 const doc={id,kind:'support',member_id:201,shop_id:2,status:'APPROVED',review_note:reply,created_at:'2026-10-03 22:58:00',body:{question:'售后服务',message:'请核对售后',orderId:'HX-own'}}
 const f=fixture({documents:{support:[doc]},responses:{'/message-read':{id:128,event_type:'SYSTEM',reference_id:id,title:'客服留言已处理',body_text:'客服留言已处理'}}})
 await f.handleRemote('message-open:128',ctx('M64',{}))
 assert.equal(f.navigations.at(-1),'M29')
 assert.equal(f.backend.selectedSupportId,id)
 assert.equal(f.blocks('M29').find(block=>block.title==='客服回复')?.body,reply)
 assert.equal(f.modals.length,0)
})

test('M29 冷刷新仅给已保存的本人留言图片预览入口，不展示草稿或他人图片',async()=>{
 const file='FILE'+'a'.repeat(32),other='FILE'+'b'.repeat(32)
 const own={id:'DOCown',kind:'support',member_id:201,shop_id:2,status:'PENDING',body:{question:'其他问题',message:'图片已提交',uploads:[file]}}
 const alien={...own,id:'DOCalien',member_id:202,body:{...own.body,uploads:[other]}}
 const f=fixture({documents:{support:[own,alien]}})
 await f.pageData('M29',{uploads:['FILE'+'c'.repeat(32)]})
 const row=f.blocks('M29').find(block=>block.title==='留言图片')
 assert.deepEqual(plain(row.items),[{label:'已提交图片 1',value:'查看图片',target:'view-proof:'+file}])
 assert.equal(JSON.stringify(f.blocks('M29')).includes(other),false)
})

test('评价商品和筛选使用同一个真实SKU；无效SKU不替换为其他商品',async()=>{
 const f=fixture({catalogProducts:[{id:'real-cup',name:'真实杯子',price:8900,stock:5}]});await f.pageData('M09',{});
 const product=f.blocks('M09').find(b=>b.type==='product');assert.equal(product.id,'real-cup');assert.equal(product.name,'真实杯子');assert.equal(product.price,'89.00');
 f.state.selectedProduct='missing';assert.match(f.blocks('M09')[0].title,/暂不可售/);
})
test('首评使用订单所选SKU、空白内容不提交，等待审核时不重复写入',async()=>{
 const order={id:'review-order',shop_id:2,status:'COMPLETED',items:[{id:1,sku_id:'sku-real',qty:1,name:'实际商品',unit_price:1000}],total:1000},f=fixture({responses:{'/orders/review-order':order}}),form={};f.state.activeOrder=order.id;
 await f.pageData('M10',form);assert.equal(form.评价内容,'');assert.equal(f.state.reviewSku,'sku-real');
 await f.handleRemote('review',ctx('M10',form));assert.equal(f.writes.length,0);
 form.评价内容='真实评价';await f.handleRemote('review',ctx('M10',form));assert.equal(f.writes[0].skuId,'sku-real');assert.equal(f.writes[0].rating,5);assert.equal('phone' in f.writes[0],false);
 await f.pageData('M10',form);await f.handleRemote('review',ctx('M10',form));assert.equal(f.writes.length,1);
})
test('补充评价重新进入回显原内容和附件，保存仍是同一审核记录',async()=>{
 const order={id:'supplement-order',shop_id:2,status:'COMPLETED',items:[{id:1,sku_id:'sku-real',qty:1,unit_price:1000}],total:1000},f=fixture({documents:{review:[{id:'review-original',status:'SUPPLEMENT',body:{orderId:order.id,skuId:'sku-real',rating:4,content:'原意见',uploads:[]}}]},responses:{'/orders/supplement-order':order}}),form={};f.state.activeOrder=order.id;
 await f.pageData('M10',form);assert.equal(form.评价内容,'原意见');assert.equal(form.rating,4);assert.equal(f.blocks('M10',form).some(b=>b.type==='rating'),true);
 form.评价内容='补齐后的意见';await f.handleRemote('review',ctx('M10',form));assert.equal(f.writes[0].id,'review-original');assert.equal(f.writes[0].content,form.评价内容);
})
test('缺跨店上下文和不合法积分数量不写入API',async()=>{
 const f=fixture(),form={采购数量:1,兑换数量:1};await f.handleRemote('cross-store',ctx('M44',form));assert.equal(f.writes.length,0);assert.match(f.toasts.at(-1),/目标商城/);
 await f.pageData('M62',form);f.state.selectedPointProduct='sku-real';form.兑换数量=0;await f.handleRemote('redeem',ctx('M62',form));assert.equal(f.writes.length,0);assert.match(f.toasts.at(-1),/正整数/);
})

test('装修保存映射真实首页字段，同时保留未编辑配置和轮播跳转',async()=>{
  const f=fixture({decoration:{brandName:'原品牌',slogan:'原标语',servicePhone:'0571-12345678',themeColor:'#123456',moduleOrder:['固定布局'],categories:[{name:'原分类',target:'M04'}],homeProducts:['sku-real'],banners:[{image:'old-image',title:'原活动',target:'M56',subtitle:'原副标题'}]}}),form={}
  await f.pageData('G60',form)
  assert.equal(form.商城名称,'原品牌');assert.equal(form.客服电话,'0571-12345678')
  form.商城名称='新品牌';form.品牌标语='新标语';form.uploads=['new-image']
  await f.handleRemote('decorate',ctx('G60',form))
  const saved=f.writes[0]
  assert.equal(saved.brandName,'新品牌');assert.equal(saved.slogan,'新标语')
  assert.equal(saved.banners[0].image,'new-image');assert.equal(saved.banners[0].target,'M56')
  assert.deepEqual(saved.categories,[{name:'原分类',target:'M04'}]);assert.deepEqual(saved.homeProducts,['sku-real'])
  assert.equal(saved.themeColor,'#123456');assert.deepEqual(saved.moduleOrder,['固定布局'])
  assert.equal(saved.customerPhone,'0571-12345678');assert.equal('servicePhone' in saved,false)
  assert.equal('uploads' in saved,false);assert.equal('_decorationShop' in saved,false)
  assert.equal(form.商城名称,'新品牌')
})

test('G60 移除首张轮播后不把已停用的第二张改成首张活动',async()=>{
  const banners=[
    {image:'A',title:'首张活动',target:'M55',enabled:true,sort:1},
    {image:'B',title:'停用活动',target:'M56',enabled:false,sort:2},
    {image:'C',title:'末张活动',target:'M57',enabled:true,sort:3}
  ]
  const f=fixture({decoration:{brandName:'原品牌',banners}}),form={}
  await f.pageData('G60',form)
  form.uploads=['B','C']
  await f.handleRemote('decorate',ctx('G60',form))
  assert.deepEqual(plain(f.writes[0].banners),banners.slice(1))
  assert.deepEqual(plain(f.backend.storefront.decoration.banners),banners.slice(1))
})

test('银行卡空值和错误格式不提交，正确账户回读为审核中',async()=>{
  const f=fixture(),form={}
  await f.pageData('M48',form)
  form.开户姓名='本人';form.银行卡号='12';form.开户银行='开户银行'
  await f.handleRemote('save',ctx('M48',form));assert.equal(f.writes.length,0)
  form.银行卡号='6222021234567890123'
  await f.handleRemote('save',ctx('M48',form))
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].channel,'BANK')
  assert.equal(f.backend.settlementAccount.status,'PENDING');assert.equal(form.开户姓名,'本人')
  await f.handleRemote('save',ctx('M48',form));assert.equal(f.writes.length,1)
})
test('结算账户已保存但回读失败时保留待审记录并阻止重复开户',async()=>{
 const f=fixture({failures:['/bootstrap']}),form={channel:'银行卡',开户姓名:'本人',银行卡号:'6222021234567890123',开户银行:'真实银行'};
 await f.handleRemote('save',ctx('M48',form));
 assert.equal(f.writes.length,1);assert.equal(f.backend.settlementAccount.status,'PENDING');
 assert.match(f.toasts.at(-1),/账户已提交，状态读取失败/);
 await f.handleRemote('save',ctx('M48',form));assert.equal(f.writes.length,1);
})
test('装修提交已成功但展示回读失败时不谎报已同步',async()=>{
 const f=fixture({failures:['/bootstrap']}),form={商城名称:'真实品牌',品牌标语:'真实标语',客服电话:'12345678',店铺公告:'真实公告',uploads:['FILEbanner']};
 await f.handleRemote('decorate',ctx('G60',form));
 assert.equal(f.writes.length,1);assert.match(f.toasts.at(-1),/装修已保存，商城展示读取失败/);
 assert.ok(!f.toasts.at(-1).includes('已同步'));
})

test('已审核账户只回显掩码和状态，更换账户是独立新申请',async()=>{
  const f=fixture({documents:{settlement_account:[{id:'approved',status:'APPROVED',body:{channel:'BANK',accountName:'本人',bank:'****0123',bankName:'真实银行'}}]}}),form={}
  await f.pageData('M48',form)
  assert.equal(form.银行卡号,'****0123');assert.equal(form.开户银行,'真实银行')
  const blocks=f.blocks('M48',form),fields=blocks.find(b=>b.type==='fields')
  assert.equal(fields.items.every(i=>i.kind==='readonly'),true)
  await f.handleRemote('save',ctx('M48',form));assert.equal(f.writes.length,0)
  await f.handleRemote('settlement-account:NEW',ctx('M48',form))
  assert.equal(form.银行卡号,'');assert.equal(f.backend.settlementAccount,null)
})

test('待审核代理申请不能重提，历史补件须签当前协议并沿用原申请编号',async()=>{
  const f=fixture({documents:{agent_application:[{id:'apply-real',status:'PENDING',created_at:'2026-09-27',body:{name:'本人',phone:'13800138000',rank:1,uploads:['FILEoriginal']}}]},responses:{'/policies':{AGENT_AGREEMENT:{id:'POLICY-V1',version:'v1'}}}}),form={}
  await f.pageData('M31',form)
  assert.deepEqual(plain(form.uploads),['FILEoriginal'])
  await f.handleRemote('agent-resubmit',ctx('M31',form));assert.equal(f.writes.length,0)
  f.docs.agent_application[0].status='SUPPLEMENT';await f.pageData('M31',form);form.uploads.push('FILEextra')
  // 旧申请没有协议版本，页面先展示独立确认，未勾选不能写入。
  assert.match(JSON.stringify(f.blocks('M31',form)),/代理合作协议/)
  await f.handleRemote('agent-resubmit',ctx('M31',form));assert.equal(f.writes.length,0)
  form.agreementReconsent=true
  await f.handleRemote('agent-resubmit',ctx('M31',form))
  assert.equal(f.writes[0].id,'apply-real');assert.equal(f.writes[0].rank,1)
  assert.deepEqual(f.writes[0].uploads,['FILEoriginal','FILEextra'])
  assert.equal(f.writes[0].agreementVersion,'v1')
  assert.equal(f.writes[0].agreementPolicyId,'POLICY-V1')
})
test('代理协议或商城变化会清除旧勾选',async()=>{
  const responses={'/policies':{AGENT_AGREEMENT:{id:'POLICY-V1',version:'v1'}}}
  const f=fixture({responses}),form={}
  await f.pageData('M30',form)
  form.consent=true
  // 已勾选的旧协议不能自动同意新版本或另一商城协议。
  responses['/policies']={AGENT_AGREEMENT:{id:'POLICY-V2',version:'v2'}}
  await f.pageData('M30',form)
  assert.equal(form.consent,false)
  form.consent=true
  f.backend.shopId=3
  await f.pageData('M30',form)
  assert.equal(form.consent,false)
})

test('G05显示真实申请并将平台权限操作处理为只读说明',async()=>{
  const f=fixture({documents:{shop_application:[{id:'shop-apply',status:'PENDING',member_id:201,body:{name:'真实申请商城',representative:'本人',county:'真实县域',company:'真实主体'}}]}}),form={}
  await f.pageData('G05',form)
  assert.match(JSON.stringify(f.blocks('G05',form)),/真实申请商城/)
  await f.handleRemote('approve',ctx('G05',form));assert.equal(f.writes.length,0)
  assert.match(f.toasts.at(-1),/平台后台审核/)
})

test('订单类型筛选保留全量数据，提供匹配订单给列表',()=>{
  const f=fixture(),list=[{id:'retail',order_type:'DEALER_RETAIL'},{id:'purchase',order_type:'AGENT_PURCHASE'}]
  f.backend.management.G21=list
  assert.deepEqual(plain(f.blocks('G21',{orderType:'代理采购'}).find(b=>b.type==='orderList').orders),[list[1]])
  assert.equal(f.backend.management.G21.length,2)
  assert.equal(f.blocks('G21',{orderType:'全部类型'}).find(b=>b.type==='orderList').orders.length,2)
})

test('无代理不显示申请通过，失效邀请不允许绑定且显示服务端原因',async()=>{
  const f=fixture({context:{valid:false,reason:'链接已过期',bound:false,shop:{id:2,name:'真实商城'},inviter:null}}),form={consent:true}
  assert.equal(f.blocks('M32').some(b=>b.type==='success'),false)
  await f.pageData('M35',form)
  assert.match(JSON.stringify(f.blocks('M35',form)),/链接已过期/)
  await f.handleRemote('bind',ctx('M35',form));assert.equal(f.writes.length,0)
  assert.equal(f.toasts.at(-1),'链接已过期')
})

test('申请读取失败显示可重试错误，恢复后重新读取真实申请',async()=>{
  const failures=['/documents_shop_application']
  const f=fixture({failures,documents:{shop_application:[{id:'real',status:'PENDING',body:{name:'恢复后的真实商城'}}]}}),form={}
  await f.pageData('G05',form)
  assert.match(JSON.stringify(f.blocks('G05',form)),/服务暂不可用/)
  assert.match(JSON.stringify(f.blocks('G05',form)),/action-page-refresh/)
  failures.length=0;await f.handleRemote('action-page-refresh',ctx('G05',form))
  assert.match(JSON.stringify(f.blocks('G05',form)),/恢复后的真实商城/)
})

test('G20重新进入从真实盘点记录恢复，选择其他记录不依赖内存',async()=>{
  const stocktakes=[{id:'pending-stock',status:'PENDING',body:{items:[{skuId:'sku-real',name:'真实商品',available:10,locked:2,actual:11,delta:-1}]}},{id:'done-stock',status:'APPROVED',body:{items:[{skuId:'sku-real',name:'真实商品',available:10,locked:0,actual:10,delta:0}]}}]
  const f=fixture({documents:{stocktake:stocktakes}}),form={}
  await f.pageData('G20',form)
  assert.equal(f.backend.stocktake.id,'pending-stock')
  assert.deepEqual(plain(f.blocks('G20',form).find(b=>b.type==='table').rows),[['真实商品','12','11','-1']])
  await f.handleRemote('stocktake-select:done-stock',ctx('G20',form))
  assert.equal(f.state.selectedStocktake,'done-stock');assert.equal(f.backend.stocktake.id,'done-stock')
  await f.handleRemote('approve',ctx('G20',form));assert.match(f.toasts.at(-1),/已经审核/)
})
test('G20切换盘点单清除上一单原因，空原因不得审核；提交后原因不沿用',async()=>{
 const records=[{id:'stock-a',status:'PENDING',body:{items:[]}},{id:'stock-b',status:'PENDING',body:{items:[]}}];
 const f=fixture({documents:{stocktake:records}}),form={};await f.pageData('G20',form);
 form.原因说明='第一单原因';await f.handleRemote('stocktake-select:stock-b',ctx('G20',form));
 assert.equal(form.原因说明,'');await f.handleRemote('approve',ctx('G20',form));assert.equal(f.writes.length,0);
 assert.match(f.toasts.at(-1),/审核原因/);form.原因说明='第二单原因';await f.handleRemote('approve',ctx('G20',form));
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].id,'stock-b');assert.equal(f.writes[0].reason,'第二单原因');assert.equal(form.原因说明,'');
})

test('考核方案回填并保存可读回新值',async()=>{
  const f=fixture({documents:{assessment_rule:[{id:'rule',status:'ACTIVE',body:{name:'真实季度方案',periodKind:'QUARTER',periodMonths:3,salesThreshold:1234500,directCount:4,repeatRate:30,operator:'OR',effectiveAt:Date.now()}}]}}),form={}
  await f.pageData('G36',form)
  assert.equal(form.方案名称,'真实季度方案');assert.equal(form.销售业绩门槛,12345);assert.equal(form.metricMode,'任一指标满足')
  form.销售业绩门槛=12500.5;await f.handleRemote('save',ctx('G36',form))
  assert.equal(f.writes[0].salesThreshold,1250050);assert.equal(form.销售业绩门槛,12500.5)
})

test('满减编辑使用读取的SKU范围和真实金额，不再固定cup',async()=>{
  const f=fixture({documents:{promotion_rule:[{id:'promotion',status:'ACTIVE',body:{name:'真实满减',type:'FULL_REDUCTION',skuIds:'sku-real',threshold:5000,discount:1000,quantity:50,perMember:2,startsAt:Date.now(),expiresAt:Date.now()+86400000,stackCoupon:true,stackPoints:false}}]}}),form={_marketingTab:'满减'}
  await f.pageData('G52',form)
  assert.equal(form.活动折扣,10);assert.equal(form.活动门槛,50);assert.equal(form.促销商品,'sku-real')
  form.活动折扣=12;await f.handleRemote('publish',{...ctx('G52',form),activeFilter:'满减'})
  assert.equal(f.writes[0].id,'promotion');assert.equal(f.writes[0].discount,1200);assert.equal(f.writes[0].skuIds,'sku-real')
  assert.equal(form.活动折扣,12)
})

test('G52–G54 已归档或审核中的活动在页面侧阻止覆盖',async()=>{
 for(const pageId of ['G52','G53','G54'])for(const status of ['ARCHIVED','PENDING','APPROVED']){
  const f=fixture();f.backend.marketingDetails={[pageId]:{id:'locked-rule',status,body:{}}};
  await f.handleRemote(pageId==='G52'?'publish':'save',ctx(pageId,{}));
  assert.equal(f.writes.length,0);
  assert.equal(f.requests.some(request=>request.url.endsWith('/document-save')),false);
  assert.match(f.toasts.at(-1),/不能覆盖.*新建当前类型活动/);
 }
})

test('加价购回填和保存自定义门槛价格商品数量，空商品不提交',async()=>{
  const f=fixture({documents:{bundle:[{id:'addon',status:'ACTIVE',body:{name:'真实加价购',type:'ADDON',items:[{skuId:'sku-real',qty:2}],threshold:15000,price:1800,quantity:30,perMember:3,startsAt:Date.now(),expiresAt:Date.now()+86400000}}]}}),form={_marketingTab:'加价购'}
  await f.pageData('G53',form)
  assert.equal(form.活动门槛,150);assert.equal(form.套餐价格,18);assert.equal(form.套餐商品,'sku-real:2')
  form.套餐商品='';await f.handleRemote('save',{...ctx('G53',form),activeFilter:'加价购'});assert.equal(f.writes.length,0)
  form.套餐商品='sku-real:3';form.活动门槛=180;form.套餐价格=20
  await f.handleRemote('save',{...ctx('G53',form),activeFilter:'加价购'})
  assert.equal(f.writes[0].threshold,18000);assert.equal(f.writes[0].price,2000);assert.deepEqual(f.writes[0].items,[{skuId:'sku-real',qty:3}])
  assert.equal(form.套餐价格,20)
})
test('营销配置已保存但回读失败时不谎报同步，重提仍更新原记录',async()=>{
 const f=fixture({failures:['/bootstrap']}),form={套餐名称:'真实组合',套餐商品:'sku-real:1',套餐价格:'9.99',活动库存:5,每人限购:1,开始时间:'2026-10-01',结束时间:'2026-10-31'};
 await f.handleRemote('save',{...ctx('G53',form),activeFilter:'组合套餐'});
 assert.equal(f.writes.length,1);assert.match(f.toasts.at(-1),/活动配置已保存，列表读取失败/);
 const savedId=f.backend.marketingDetails.G53.id;assert.equal(f.backend.selectedMarketingConfig.G53,savedId);
 await f.handleRemote('save',{...ctx('G53',form),activeFilter:'组合套餐'});
 assert.equal(f.writes.length,2);assert.equal(f.writes[1].id,savedId);
})

test('拼团配置回填现有活动，提交保留活动和开关',async()=>{
  const f=fixture({documents:{group_campaign:[{id:'group-real',status:'ACTIVE',body:{name:'真实拼团',enabled:false,skuId:'sku-real',price:600,size:3,hours:12,startsAt:Date.now(),expiresAt:Date.now()+86400000}}]}}),form={_marketingTab:'拼团活动'}
  await f.pageData('G54',form)
  assert.equal(form.活动商品,'sku-real');assert.equal(form.拼团价格,6);assert.equal(form.拼团开关,false)
  await f.handleRemote('save',{...ctx('G54',form),activeFilter:'拼团活动'})
  assert.equal(f.writes[0].id,'group-real');assert.equal(f.writes[0].enabled,false);assert.equal(f.writes[0].hours,12)
})

test('G54 新拼团不从商品目录暗填商品或代理价，默认保持关闭',async()=>{
 const f=fixture(),form={_marketingTab:'拼团活动'}
 assert.equal(await f.pageData('G54',form),true)
 assert.equal(form.活动名称,'')
 assert.equal(form.活动商品,'')
 assert.equal(form.拼团价格,'')
 assert.equal(form.拼团开关,false)
})

test('G54 开启拼团时商品、团价、人数和时限先在页面拦截',async()=>{
 const f=fixture({catalogProducts:[{id:'sku-real',price:1000,retailPrice:2000,stock:10}]}),form={_marketingTab:'拼团活动',活动名称:'点检拼团',活动商品:'sku-real',拼团价格:'',拼团开关:true,成团人数:2,'成团时限（小时）':24,开始时间:'2030-01-01',截止日期:'2030-01-31'};
 await f.pageData('G54',form);
 Object.assign(form,{活动名称:'点检拼团',活动商品:'sku-real',拼团价格:'',拼团开关:true,成团人数:2,'成团时限（小时）':24,开始时间:'2030-01-01',截止日期:'2030-01-31'});
 for(const [key,value] of [['拼团价格',''],['拼团价格','0'],['拼团价格','20.01'],['拼团价格','1.001'],['活动商品','missing'],['成团人数',1],['成团人数',21],['成团人数',2.5],['成团时限（小时）',0],['成团时限（小时）',169]]){
  Object.assign(form,{活动商品:'sku-real',拼团价格:'9.99',成团人数:2,'成团时限（小时）':24,[key]:value});
  await f.handleRemote('save',{...ctx('G54',form),activeFilter:'拼团活动'});
  assert.equal(f.writes.length,0,`${key}=${value} 不应发请求`);
 }
 Object.assign(form,{活动商品:'sku-real',拼团价格:'9.99',成团人数:3,'成团时限（小时）':12});
 await f.handleRemote('save',{...ctx('G54',form),activeFilter:'拼团活动'});
 assert.equal(f.writes.length,1,f.toasts.at(-1));assert.equal(f.writes[0].price,999);assert.equal(f.writes[0].size,3);assert.equal(f.writes[0].hours,12);
})

test('G54 邀请奖励金额和门槛不合法时不发保存请求',async()=>{
 const f=fixture(),form={_marketingTab:'邀请有礼',活动名称:'点检邀请',完成首单奖励:'1',完成三单奖励:'2',单人奖励上限:'10',有效订单门槛:'1',开始时间:'2030-01-01',截止日期:'2030-01-31'};
 for(const [key,value] of [['完成首单奖励',''],['完成首单奖励','1.001'],['完成三单奖励','-1'],['单人奖励上限','0'],['有效订单门槛','0.99']]){
  Object.assign(form,{完成首单奖励:'1',完成三单奖励:'2',单人奖励上限:'10',有效订单门槛:'1',[key]:value});
  await f.handleRemote('save',{...ctx('G54',form),activeFilter:'邀请有礼'});
  assert.equal(f.writes.length,0,`${key}=${value} 不应发请求`);
 }
 Object.assign(form,{完成首单奖励:'0',完成三单奖励:'0',单人奖励上限:'10',有效订单门槛:'1'});
 await f.handleRemote('save',{...ctx('G54',form),activeFilter:'邀请有礼'});assert.equal(f.writes.length,0);
 form.完成首单奖励='1';
 await f.handleRemote('save',{...ctx('G54',form),activeFilter:'邀请有礼'});
 assert.equal(f.writes.length,1,f.toasts.at(-1));assert.equal(f.writes[0].firstOrderReward,100);assert.equal(f.writes[0].minOrderAmount,100);
})

test('G55 数量、积分和客户商品选择不合法时不请求真实试算',async()=>{
 const f=fixture(),form={previewCustomer:'101 · 客户',previewSku:'cup · 保温杯',previewQty:1,previewPoints:0,previewScope:'平台积分',previewRegion:'泉州市安溪县',previewCoupon:'不使用优惠券'};
 f.backend.previewCustomers=[{member_id:101,name:'客户'}];f.backend.previewCatalog=[{id:'cup',name:'保温杯',status:'ACTIVE'}];
 for(const [key,value] of [['previewQty',0],['previewQty',1.5],['previewQty',100001],['previewPoints',-1],['previewPoints',0.5],['previewCustomer','999 · 错误客户'],['previewSku','missing · 错误商品'],['previewRegion','']]){
  Object.assign(form,{previewCustomer:'101 · 客户',previewSku:'cup · 保温杯',previewQty:1,previewPoints:0,previewRegion:'泉州市安溪县',[key]:value});
  await f.handleRemote('calculate',ctx('G55',form));assert.equal(f.writes.length,0,`${key}=${value} 不应试算`);
 }
 Object.assign(form,{previewCustomer:'101 · 客户',previewSku:'cup · 保温杯',previewQty:2,previewPoints:0,previewRegion:'泉州市安溪县'});
 await f.handleRemote('calculate',ctx('G55',form));assert.equal(f.writes.length,1,f.toasts.at(-1));assert.equal(f.writes[0].items[0].qty,2);assert.equal(f.writes[0].customerId,101);
})

test('G56 启用联动须核对书面确认、商品、日期和全部奖励约束',async()=>{
 const f=fixture(),form={enabled:true,name:'点检联动',skuIds:'sku-real',minOrderAmount:100,rewardCap:500,maxRewardPerOrder:300,totalRewardBps:10000,directReward:50,directBps:0,orderReward:0,orderBps:0,peerReward:0,peerBps:0,relationshipMode:'KEEP_RELATION',passedChild:'EARLIEST',startDate:'2030-01-01',endDate:'2030-01-31',writtenConfirmed:true,confirmationFile:'FILE-test'};
 for(const [key,value] of [['name',''],['writtenConfirmed',false],['minOrderAmount',99],['rewardCap',0],['maxRewardPerOrder',0],['totalRewardBps',10001],['directBps',100],['skuIds',''],['confirmationFile',''],['startDate','2030-02-30']]){
  Object.assign(form,{name:'点检联动',writtenConfirmed:true,minOrderAmount:100,rewardCap:500,maxRewardPerOrder:300,totalRewardBps:10000,directBps:0,skuIds:'sku-real',confirmationFile:'FILE-test',startDate:'2030-01-01',[key]:value});
  await f.handleRemote('enable-link',ctx('G56',form));assert.equal(f.writes.length,0,`${key}=${value} 不应保存`);
 }
 Object.assign(form,{name:'点检联动',writtenConfirmed:true,minOrderAmount:100,rewardCap:500,maxRewardPerOrder:300,totalRewardBps:10000,directBps:0,skuIds:'sku-real',confirmationFile:'FILE-test',startDate:'2030-01-01'});
 await f.handleRemote('enable-link',ctx('G56',form));assert.equal(f.writes.length,1,f.toasts.at(-1));assert.equal(f.writes[0].startsAt,Date.parse('2030-01-01T00:00:00+08:00'));assert.equal(f.writes[0].expiresAt,Date.parse('2030-01-31T23:59:59+08:00'));assert.equal(f.writes[0]._linkHydrated,undefined);
})

test('G52 新促销不暗填商品、折扣或积分叠加，预览仅展示所选SKU',async()=>{
 const f=fixture({catalogProducts:[{id:'sku-real',price:4000,retailPrice:7900,stock:10}]}),form={_marketingTab:'限时折扣'}
 assert.equal(await f.pageData('G52',form),true)
 assert.equal(form.活动商品,'')
 assert.equal(form.活动折扣,'')
 assert.equal(form.允许积分抵扣,false)
 assert.equal(f.blocks('G52',form,'限时折扣').find(block=>block.title==='活动商品预览')?.type,'notice')
 form.促销商品='sku-real'
 const preview=f.blocks('G52',form,'限时折扣').find(block=>block.type==='product')
 assert.equal(preview?.id,'sku-real')
 assert.equal(preview?.price,'79.00')
})

test('G51-G54 日期以商城上海日界保存，非法日历日期不得发布',async()=>{
 const start=Date.parse('2030-01-01T00:00:00+08:00'),end=Date.parse('2030-01-31T23:59:59+08:00')
 const cases=[
  {pageId:'G52',tab:'限时折扣',target:'publish',form:{活动名称:'时区回归促销',活动折扣:9,活动库存:5,每人限购:1}},
  {pageId:'G53',tab:'组合套餐',target:'save',form:{套餐名称:'时区回归套餐',套餐商品:'sku-real:1',套餐价格:8,活动库存:5,每人限购:1}},
  {pageId:'G54',tab:'邀请有礼',target:'save',form:{活动名称:'时区回归邀请',完成首单奖励:1,完成三单奖励:2,单人奖励上限:10,有效订单门槛:1}}
 ]
 for(const {pageId,tab,target,form:fields} of cases){
  const f=fixture(),form={_marketingTab:tab}
  await f.pageData(pageId,form)
  Object.assign(form,fields,{开始时间:'2030-01-01',[pageId==='G54'?'截止日期':'结束时间']:'2030-01-31'})
  await f.handleRemote(target,{...ctx(pageId,form),activeFilter:tab})
  assert.equal(f.writes.length,1,pageId+' save')
  assert.equal(f.writes[0].startsAt,start,pageId+' start')
  assert.equal(f.writes[0].expiresAt,end,pageId+' end')
  form.开始时间='2030-02-30'
  await f.handleRemote(target,{...ctx(pageId,form),activeFilter:tab})
  assert.equal(f.writes.length,1,pageId+' invalid day')
 }
 const c=fixture(),form={}
 await c.pageData('G51',form)
 Object.assign(form,{优惠券名称:'时区回归优惠券',优惠券类型:'满减券',使用门槛:10,优惠金额:1,发放数量:5,有效期至:'2030-01-31'})
 await c.handleRemote('publish',ctx('G51',form))
 assert.equal(c.writes.length,1)
 assert.equal(c.writes[0].expiresAt,end)
 form.有效期至='2030-02-30'
 await c.handleRemote('publish',ctx('G51',form))
 assert.equal(c.writes.length,1)
})

test('G52 编辑上海零点开始的营销活动不会把日期回填成设备前一天',async()=>{
 const start=Date.parse('2030-01-01T00:00:00+08:00'),end=Date.parse('2030-01-31T23:59:59+08:00')
 const f=fixture({documents:{promotion_rule:[{id:'timezone-rule',status:'ACTIVE',body:{name:'上海日期活动',type:'LIMITED',rateBps:9000,startsAt:start,expiresAt:end}}]}}),form={_marketingTab:'限时折扣'}
 await f.pageData('G52',form)
 assert.equal(form.开始时间,'2030-01-01')
 assert.equal(form.结束时间,'2030-01-31')
})

test('积分明细按真实kind分别筛选，筛选不改变原流水',()=>{
  const f=fixture();f.backend.account.pointLedger=[{kind:'CHECKIN',amount:5,shop_id:0},{kind:'ORDER_USE',amount:-10,shop_id:0},{kind:'TRANSFER_IN',amount:20,shop_id:2},{kind:'EXPIRE',amount:-2,shop_id:2},{kind:'REFUND_RETURN',amount:10,shop_id:0}]
  for(const filter of ['获得','抵扣','转入/转出','到期','退款'])assert.equal(f.blocks('M53',{},filter).find(b=>b.type==='ledger').items.length,1)
  assert.equal(f.blocks('M53',{},'全部').find(b=>b.type==='ledger').items.length,5)
  assert.equal(f.backend.account.pointLedger.length,5)
})

test('我的积分现有余额可进入积分明细，冻结与临期字段不误触',()=>{
  const f=fixture(),stats=f.blocks('M50').filter(b=>b.type==='stats')
  assert.equal(stats.length,2)
  for(const block of stats){
    assert.equal(block.items[0].target,'M53')
    assert.equal(block.items[1].target,undefined)
    assert.equal(block.items[2].target,undefined)
  }
})

test('积分商城分类按服务端商品分类筛选，不把未分类商品混入',()=>{
  const f=fixture()
  f.products.push(
    {id:'cup',point_price:2800,category:'生活日用'},
    {id:'towel',point_price:1800,category:'生活日用'},
    {id:'stapler',point_price:500,category:'办公用品'},
    {id:'unknown',point_price:300,category:''},
    {id:'lamp',point_price:0,category:'家居电器'}
  )
  const ids=filter=>f.blocks('M54',{},filter).find(b=>b.type==='pointsProducts').ids
  assert.deepEqual(plain(ids('全部')),['cup','towel','stapler','unknown'])
  assert.deepEqual(plain(ids('生活日用')),['cup','towel'])
  assert.deepEqual(plain(ids('办公用品')),['stapler'])
  assert.deepEqual(plain(ids('家居电器')),[])
  assert.match(JSON.stringify(f.blocks('M54',{},'家居电器')),/暂无此分类兑换商品/)
  f.backend.shopInfo.categories=['办公用品','生活日用']
  assert.deepEqual(plain(f.blocks('M54').find(b=>b.type==='tabs').items),['全部','办公用品','生活日用'])
})

test('收益与积分流水显示本地时间，不直接回显服务端ISO时间',()=>{
  const f=fixture(),createdAt='2026-09-28T13:23:11.000-04:00'
  f.backend.account.ledger=[{kind:'LEVEL',category:'LEVEL',amount:400,created_at:createdAt,reference_id:'order-1'}]
  f.backend.account.pointLedger=[{kind:'CHECKIN',amount:5,shop_id:0,created_at:createdAt}]
  const expected=timeHelpers.dateTimeLabel(createdAt)
  assert.equal(f.blocks('M45',{},'全部').find(b=>b.type==='ledger').items[0][1],expected)
  assert.equal(f.blocks('M53',{},'全部').find(b=>b.type==='ledger').items[0][1],expected)
  assert.doesNotMatch(expected,/T13:23:11|\.000-04:00/)
})

test('客户和团队筛选仅使用已返回的绑定日期/直属下级职级',()=>{
  const f=fixture({agent:{id:10,rank_no:2,status:'ACTIVE'}})
  f.backend.agentData={customers:[{member_id:1,name:'近期客户',bound_at:new Date().toISOString()},{member_id:2,name:'历史客户',bound_at:'2020-01-01'}],children:[{id:2,name:'同级',rank_no:2,status:'ACTIVE'},{id:3,name:'低级',rank_no:1,status:'ACTIVE'}]}
  assert.equal(f.blocks('M36',{},'最近30天绑定（1）').find(b=>b.type==='people').items[0][0],'近期客户')
  assert.equal(f.blocks('M36',{},'历史绑定（1）').find(b=>b.type==='people').items[0][0],'历史客户')
  const recent=f.blocks('M36',{},'最近30天绑定（1）').find(b=>b.type==='people').items[0]
  assert.equal(recent[3],timeHelpers.dateTimeLabel(f.backend.agentData.customers[0].bound_at))
  assert.doesNotMatch(recent[3],/T|\.\d{3}Z/)
  f.backend.agentData.customers=f.backend.agentData.customers.slice(0,1)
  const empty=f.blocks('M36',{},'历史绑定（0）')
  assert.equal(empty.find(b=>b.type==='people').items.length,0)
  assert.doesNotMatch(JSON.stringify(empty.find(b=>b.title==='客户详情')),/申请客户迁移|近期客户/)
  assert.equal(f.blocks('M37',{},'同级直推').find(b=>b.type==='people').items.length,1)
  assert.match(JSON.stringify(f.blocks('M37',{},'直属下级')),/直属下级/)
})

test('评价统计来自真实记录，未提供图片/追评时不模拟筛选成果',async()=>{
  const f=fixture();await f.pageData('M09',{});f.backend.reviews=[{name:'甲',rating:5,content:'真实一',createdAt:'2026-09-26'},{name:'乙',rating:3,content:'真实二',createdAt:'2026-09-27'}]
  assert.deepEqual(plain(f.blocks('M09').find(b=>b.type==='stats').items.map(i=>i.value)),['4.0','50%',2])
  assert.equal(f.blocks('M09',{},'最新').find(b=>b.type==='reviews').items[0].name,'乙')
  assert.equal(f.blocks('M09',{},'有图').find(b=>b.type==='reviews').items.length,0)
  assert.equal(f.blocks('M09',{},'追评').find(b=>b.type==='reviews').items.length,0)
})

test('满赠金额只读0元，不能用折扣输入假装修改赠品价格',async()=>{
  const f=fixture({documents:{bundle:[{id:'gift',status:'ACTIVE',body:{name:'真实满赠',type:'GIFT',price:999,items:[{skuId:'sku-real',qty:1}],threshold:6000,quantity:20,perMember:1,startsAt:Date.now(),expiresAt:Date.now()+86400000}}]}}),form={_marketingTab:'满赠'}
  await f.pageData('G52',form);assert.equal(form.活动折扣,0)
  const field=f.blocks('G52',form).find(b=>b.type==='fields').items.find(i=>i.key==='活动折扣')
  assert.equal(field.kind,'readonly');assert.match(field.label,/固定0元/)
  form.活动折扣=99;await f.handleRemote('publish',{...ctx('G52',form),activeFilter:'满赠'})
  assert.equal(f.writes[0].price,0);assert.equal(form.活动折扣,0)
})

test('WEIGHTED历史考核整体只读，改简化指标也不能覆盖原权重',async()=>{
  const body={id:'embedded-old',name:'真实加权',periodKind:'MONTH',periodMonths:1,operator:'WEIGHTED',salesThreshold:10000,directCount:3,repeatRate:20,salesWeight:60,peopleWeight:30,repeatWeight:10,scoreThreshold:80,teamDepth:4,effectiveAt:Date.now()}
  const f=fixture({documents:{assessment_rule:[{id:'weighted',status:'ACTIVE',body}]}}),form={}
  await f.pageData('G36',form)
  assert.equal(form.metricMode,'加权指标');assert.match(f.backend.assessmentRuleReadOnly,/加权/)
  const blocks=f.blocks('G36',form)
  assert.ok(blocks.filter(b=>b.type==='fields').every(b=>b.items.every(i=>i.kind==='readonly')))
  assert.equal(blocks.some(b=>b.type==='options'),false);assert.match(JSON.stringify(blocks),/原加权参数/)
  form.metricMode='全部指标同时满足';form.销售业绩门槛=1
  await f.handleRemote('save',ctx('G36',form))
  assert.equal(f.writes.length,0);assert.match(f.toasts.at(-1),/原方案已保护/)
  assert.deepEqual(plain(f.backend.assessmentRule.body),body)
})

test('自然年、自定义和非3个月历史滚动方案不被当前周期选项覆盖',async()=>{
  for(const period of [{periodKind:'YEAR',periodMonths:12},{periodKind:'CUSTOM',periodMonths:3,startDate:'2026-01-01',endDate:'2026-06-01'},{periodKind:'ROLLING',periodMonths:6}]){
    const f=fixture({documents:{assessment_rule:[{id:'historical',status:'ACTIVE',body:{...period,name:'历史周期',operator:'AND',salesThreshold:0,directCount:0,repeatRate:0,effectiveAt:Date.now()}}]}}),form={}
    await f.pageData('G36',form);const blocks=f.blocks('G36',form)
    assert.match(JSON.stringify(blocks),/历史方案只读保护/)
    if(period.periodKind==='ROLLING')assert.equal(form.考核周期,'滚动6个月')
    form.考核周期='自然月';await f.handleRemote('save',ctx('G36',form));assert.equal(f.writes.length,0)
  }
})

test('普通考核编辑保留未展示的指标开关和复购参数，创建新版本不复用旧ID',async()=>{
  const f=fixture({documents:{assessment_rule:[{id:'simple',status:'ACTIVE',body:{id:'old-body-id',name:'普通方案',periodKind:'MONTH',periodMonths:1,operator:'AND',salesThreshold:10000,directCount:1,repeatRate:10,teamDepth:5,salesEnabled:false,peopleEnabled:true,repeatEnabled:false,repeatMinOrders:4,repeatMinAmount:2500,effectiveAt:Date.now()}}]}}),form={}
  await f.pageData('G36',form);form.方案名称='修改后的普通方案';await f.handleRemote('save',ctx('G36',form))
  assert.equal(f.writes[0].teamDepth,5);assert.equal(f.writes[0].salesEnabled,false);assert.equal(f.writes[0].repeatEnabled,false)
  assert.equal(f.writes[0].repeatMinOrders,4);assert.equal(f.writes[0].repeatMinAmount,2500);assert.equal('id' in f.writes[0],false)
})

test('G18 预警阈值在提交前拒绝空值、负数、小数与越界值',async()=>{
  const f=fixture(),form={_warningSkuId:'sku-real',预警阈值:10}
  f.products.push({id:'sku-real',stock:10,warning_qty:6})
  for(const invalid of ['',-1,1.5,'2147483648','1e2']){
    form.预警阈值=invalid
    await f.handleRemote('save',ctx('G18',form))
    assert.equal(f.writes.length,0)
  }
  form.预警阈值='0'
  await f.handleRemote('save',ctx('G18',form))
  assert.equal(f.writes[0].operation,'stock-warning')
  assert.equal(f.writes[0].warningQty,0)
})

test('盘点元数据只读且范围为真实存在商品，空值/小数/低于锁定库存不提交',async()=>{
  const f=fixture({catalogProducts:[{id:'stapler',name:'真实订书机',price:1000,stock:8,locked:2},{id:'cup',name:'真实杯',price:2000,stock:4,locked:0}]}),form={}
  await f.pageData('G19',form)
  assert.equal(form['stocktake:stapler'],10);assert.equal(form['stocktake:cup'],4);assert.equal('stocktake:paper' in form,false)
  const blocks=f.blocks('G19',form)
  assert.ok(blocks.find(b=>b.title==='盘点任务').items.every(i=>i.kind==='readonly'))
  assert.equal(blocks.find(b=>b.title==='实盘录入').items.length,2);assert.equal(blocks.find(b=>b.type==='table').rows.length,2)
  for(const invalid of ['',1,2.5]){form['stocktake:stapler']=invalid;await f.handleRemote('stocktake-propose',ctx('G19',form));assert.equal(f.writes.length,0)}
  form['stocktake:stapler']=9;await f.handleRemote('stocktake-propose',ctx('G19',form))
  assert.deepEqual(f.writes[0].items,[{skuId:'stapler',actual:9,expectedAvailable:8,expectedLocked:2},{skuId:'cup',actual:4,expectedAvailable:4,expectedLocked:0}])
  assert.equal(Object.keys(f.writes[0]).length,3) // kind/items/shopId only; no unsupported metadata.
  assert.equal(f.state.selectedStocktake,'DOC1')
  assert.equal(form._stocktakeSnapshot,'')
  await f.pageData('G19',form)
  assert.equal(form['stocktake:stapler'],10)
})

test('盘点范围与管理库存一致，包含未上架但仍有库存的SKU',async()=>{
  const managementProducts=[{id:'active',name:'在售商品',available:5,locked:1,status:'ACTIVE'},{id:'pending',name:'待审核商品',available:3,locked:0,status:'PENDING'}]
  const f=fixture({catalogProducts:[{id:'active',name:'在售商品',stock:5,locked:1}],responses:{'/management/products':managementProducts}}),form={}
  await f.pageData('G19',form)
  assert.deepEqual(f.blocks('G19',form).find(block=>block.type==='table').rows.map(row=>row[0]),['在售商品','待审核商品'])
  assert.equal(form['stocktake:pending'],3)
  await f.handleRemote('stocktake-propose',ctx('G19',form))
  assert.deepEqual(f.writes[0].items.map(item=>item.skuId),['active','pending'])
})

test('没有可盘点商品或读取失败时不提交静态SKU',async()=>{
  const f=fixture({catalogProducts:[]}),form={};await f.pageData('G19',form);await f.handleRemote('stocktake-propose',ctx('G19',form))
  assert.equal(f.writes.length,0);assert.match(f.toasts.at(-1),/没有可盘点商品/)
  const failed=fixture({failures:['/bootstrap']}),badForm={};await failed.pageData('G19',badForm)
  await failed.handleRemote('stocktake-propose',ctx('G19',badForm));assert.equal(failed.writes.length,0);assert.match(failed.toasts.at(-1),/重新读取盘点/)
  const managementFailure=fixture({failures:['/management/products']}),managementForm={};await managementFailure.pageData('G19',managementForm)
  await managementFailure.handleRemote('stocktake-propose',ctx('G19',managementForm));assert.equal(managementFailure.writes.length,0);assert.match(managementFailure.toasts.at(-1),/重新读取盘点/)
})

test('M19 旧账号订单指针失效时不请求物流，也不误报服务端故障',async()=>{
  const f=fixture(),form={}
  f.state.activeOrder='foreign-order'
  await f.pageData('M19',form)
  assert.equal(f.requests.some(x=>x.url.includes('/foreign-order/tracking')),false)
  assert.match(JSON.stringify(f.blocks('M19',form)),/请先选择订单/)
  assert.equal(f.backend.operationError,'')
})

test('M19 收货手机号按文案脱敏，历史异常号码不原样泄露',()=>{
 const f=fixture()
 const order={id:'HXmask',shop_id:2,buyer_id:201,status:'PAID',rawStatus:'PAID',address_json:JSON.stringify({name:'张三',phone:'13888881234',region:'浙江省 杭州市',detail:'测试地址'}),items:[]}
 f.backend.activeOrder=order
 const recipient=()=>f.blocks('M19').find(block=>block.title==='收货信息').items.find(item=>item.label==='收货人').value
 assert.equal(recipient(),'张三 138****1234')
 order.address_json=JSON.stringify({name:'张三',phone:'12345678901'})
 assert.equal(recipient(),'张三 ****')
})

test('M19 已收货订单保留终态，承运商运输中只作为轨迹单独说明',()=>{
 const f=fixture()
 f.backend.activeOrder={id:'HXcompleted',shop_id:2,buyer_id:201,status:'COMPLETED',rawStatus:'COMPLETED',items:[]}
 f.backend.tracking={status:'IN_TRANSIT',carrier:'测试承运商',tracking:'TR123'}
 const notice=f.blocks('M19').find(block=>block.type==='notice')
 assert.equal(notice.title,'订单已收货')
 assert.match(notice.body,/承运商轨迹：运输中/)
})

test('G45 无权读取后持续显示权限错误，旧账本与金额不会显示',async()=>{
 const f=fixture({failures:['/management/financeSummary']})
 f.backend.management.G45=[{totals:[{category:'RECEIPT',amount:998015}]}]
 await f.pageData('G45',{})
 assert.match(f.backend.financeErrors.G45,/服务暂不可用/)
 assert.deepEqual(plain(f.blocks('G45').map(block=>block.type)),['notice'])
 assert.doesNotMatch(JSON.stringify(f.blocks('G45')),/9980|资金账本/)
})

test('切换会员后不请求上一会员的订单；同会员重读保留订单定位',async()=>{
  const other=fixture({bootstrapMember:{id:101,name:'经营会员',phone:'13800138001'}})
  other.state.lastHydratedIdentity={memberId:201,shopId:2}
  other.state.activeOrder='HX201'
  await other.refresh()
  assert.equal(other.state.activeOrder,null)
  assert.equal(other.backend.activeOrder,null)
  assert.equal(other.requests.some(x=>x.url.endsWith('/orders/HX201')),false)
  assert.equal(other.state.lastHydratedIdentity.memberId,101)

  const own=fixture({responses:{'/orders/HX201':{id:'HX201',status:'PAID',items:[],total:100}}})
  own.state.lastHydratedIdentity={memberId:201,shopId:2}
  own.state.activeOrder='HX201'
  await own.refresh()
  assert.equal(own.state.activeOrder,'HX201')
  assert.equal(own.backend.activeOrder?.id,'HX201')
  assert.equal(own.requests.some(x=>x.url.endsWith('/orders/HX201')),true)

  const legacy=fixture({bootstrapMember:{id:101,name:'经营会员',phone:'13800138001'},pageStack:[{route:'pages/G01/index'}]})
  legacy.state.activeOrder='HX201'
  await legacy.refresh()
  assert.equal(legacy.state.activeOrder,null)
  assert.equal(legacy.requests.some(x=>x.url.endsWith('/orders/HX201')),false)

  const staleDashboard=fixture({bootstrapMember:{id:101,name:'经营会员',phone:'13800138001'},pageStack:[{route:'pages/G01/index'}]})
  staleDashboard.state.lastHydratedIdentity={memberId:101,shopId:2}
  staleDashboard.state.activeOrder='HX201'
  await staleDashboard.refresh()
  assert.equal(staleDashboard.state.activeOrder,null)
  assert.equal(staleDashboard.requests.some(x=>x.url.endsWith('/orders/HX201')),false)
})

test('新上架商品自动进入盘点范围，库存变化后重读账面数量',async()=>{
  const catalogProducts=[{id:'sku-new',name:'新商品',price:990,stock:7,locked:1}]
  const f=fixture({catalogProducts}),form={}
  await f.pageData('G19',form)
  assert.equal(form['stocktake:sku-new'],8)
  assert.equal(f.blocks('G19',form).find(b=>b.type==='table').rows[0][0],'新商品')
  catalogProducts[0].stock=9
  await f.pageData('G19',form)
  assert.equal(form['stocktake:sku-new'],10)
})

test('发货备注从本地及旧远程配置移除，发货只提交接口消费的物流字段',async()=>{
  const f=fixture(),form={快递公司:'中通快递',tracking:'TRACK123456',发货备注:'旧表单备注'}
  await f.pageData('G23',form)
  f.state.managementOrder='real-order'
  f.backend.management.G23=[{id:'real-order',shop_id:2,rawStatus:'PAID',total:1000,subtotal:1000,items:[{id:'sku-real',name:'真实商品',lineId:1,qty:1,unitPrice:1000}]}]
  assert.equal(f.blocks('G23',form).filter(b=>b.type==='fields').some(b=>b.items.some(i=>i.key==='发货备注')),false)
  assert.equal(f.blocks('G23',form).find(b=>b.type==='fields').items.find(i=>i.key==='tracking').maxlength,40)
  const legacy=[{type:'fields',title:'发货信息',items:[{key:'tracking',kind:'input'},{key:'发货备注',kind:'textarea'}]}]
  assert.equal(f.render('G23',legacy,form).find(b=>b.type==='fields').items.length,1)
  f.state.managementOrder='real-order';await f.handleRemote('ship',ctx('G23',form))
  assert.deepEqual(f.writes[0],{operation:'ship',id:'real-order',carrier:'中通快递',tracking:'TRACK123456',shopId:2})
})

test('G23 发货拦截无效运单和快递公司，合法输入去空格后提交',async()=>{
 const f=fixture(),form={快递公司:'顺丰速运',tracking:'TRACK123456'}
 f.state.managementOrder='real-order'
 for(const [carrier,tracking] of [['顺丰速运','短号'],['顺丰速运','TRACK-123456'],['顺丰速运',' TRACK123456 '],['顺丰\n速运','TRACK123456'],['x'.repeat(61),'TRACK123456'],['','TRACK123456']]){
  form.快递公司=carrier;form.tracking=tracking
  await f.handleRemote('ship',ctx('G23',form))
  assert.equal(f.writes.length,0)
  assert.match(f.toasts.at(-1),/8至40位字母数字运单号/)
 }
 form.快递公司=' 顺丰速运 ';form.tracking='TRACK123456'
 await f.handleRemote('ship',ctx('G23',form))
 assert.deepEqual(f.writes[0],{operation:'ship',id:'real-order',carrier:'顺丰速运',tracking:'TRACK123456',shopId:2})
})

test('未选订单的收银台、订单及售后入口不回显样例业务数据',()=>{
 const f=fixture()
 for(const id of ['M15','M18','M10','M20','M21','G22','G23','G24']){
  const blocks=f.blocks(id)
  assert.equal(blocks.length,1)
  assert.equal(blocks[0].type,'notice')
  assert.match(blocks[0].title,/请先选择订单/)
 }
})

test('G22 重新读取当前商城订单详情，展示真实关系及价格快照',async()=>{
 const id='real-order',detail={id,shop_id:2,buyer_id:201,buyerName:'真实买家',status:'COMPLETED',subtotal:2990,total:2990,refunded:1000,order_type:'DEALER_RETAIL',ruleEffectiveAt:'2026-09-01',items:[{id:9,sku_id:'paper',name:'真实纸巾',qty:1,unit_price:2990,snapshot_json:JSON.stringify({ruleId:1,prices:[2990,1800,1400,1000],bps:[0,300,200,100],chain:[{agentId:4,memberId:104,rank:1},{agentId:3,memberId:103,rank:1},{agentId:1,memberId:101,rank:3}]})}]}
 const f=fixture({responses:{['/management/orders/'+id]:detail}}),form={}
 f.state.managementOrder=id
 assert.equal(await f.pageData('G22',form),true)
 assert.ok(f.requests.some(r=>r.url.includes('/management/orders/'+id)))
 const blocks=f.blocks('G22',form),snapshot=blocks.find(b=>b.title==='订单快照')
 assert.equal(blocks.find(b=>b.type==='notice').title,'已完成')
 assert.equal(snapshot.items.find(i=>i.label==='购买人').value,'真实买家 · 会员 201')
 assert.equal(snapshot.items.find(i=>i.label==='云 / 中心 / 总代价').value,'¥18.00 / ¥14.00 / ¥10.00')
 assert.equal(blocks.find(b=>b.type==='product').name,'真实纸巾')
 const amount=blocks.find(b=>b.title==='金额快照与已退款')
 assert.equal(amount.items.find(i=>i.label==='实付金额').value,'¥29.90')
 assert.equal(amount.items.find(i=>i.label==='已退款').value,'¥10.00')
})

test('历史订单及售后商品卡使用下单快照封面，不回查已更换的当前商品图',()=>{
 const orderId='HX'+'a'.repeat(32),asset='/hexu/app/attachments/order-cover/'+orderId+'/9'
 const line={id:'cup',lineId:9,name:'原保温杯',spec:'下单规格',asset,qty:1,unitPrice:8900,paid:8900,refunded_qty:0}
 const order={id:orderId,shop_id:2,buyer_id:201,status:'待发货',rawStatus:'PAID',order_type:'DEALER_RETAIL',total:8900,subtotal:8900,refunded:0,items:[line]}
 const f=fixture({catalogProducts:[{id:'cup',name:'现售杯',asset:'new-cover',price:9900,stock:10}]})
 f.state.activeOrder=orderId;f.backend.activeOrder=order
 f.state.managementOrder=orderId
 for(const pageId of ['M18','G22','G23','G24']){
  if(pageId.startsWith('G'))f.backend.management[pageId]=[order]
  const product=f.blocks(pageId).find(block=>block.type==='product')
  if(product)assert.equal(product.product.asset,asset,pageId)
 }
 f.backend.afterLineId=9
 assert.equal(f.blocks('M20').find(block=>block.type==='product').product.asset,asset)
 const photo=fs.readFileSync(new URL('../components/Photo.vue',import.meta.url),'utf8')
 assert.match(photo,/order-cover/)
 assert.match(photo,/Authorization:'Bearer '\+backend\.token/)
})

test('G14 采购箱规与起订箱数只展示当前批发商品配置',async()=>{
  const sku={id:'oil',name:'真实食用油',spec:'6瓶/箱',asset:'oil',price:4000,stock:100,box_size:6,min_boxes:3}
 const f=fixture({responses:{'/products':[sku]}}),form={boxes:2}
 f.state.selectedProduct='oil'
 await f.pageData('G14',form)
  assert.equal(form['wholesaleQty:oil'],18)
 const blocks=f.blocks('G14',form)
  assert.equal(blocks.find(b=>b.type==='wholesaleItem').qty,18)
  assert.equal(blocks.find(b=>b.type==='wholesaleItem').product.spec,'6瓶/箱')
 assert.equal(blocks.find(b=>b.type==='rows').items.find(i=>i.label==='合计').value,'¥720.00')
 assert.equal(blocks.find(b=>b.type==='notice'&&b.title==='公司批发 · 采购补货').body,'当前身份：商城经营者')
})

test('G14 查看混批规则只展示当前公司批发 SKU，不跳入本店箱规编辑页',async()=>{
 const f=fixture()
 f.state.wholesaleSku={id:'paper',name:'清风 抽取式面巾纸',box_size:24,min_boxes:2,mix_group:''}
 await f.handleRemote('G13',ctx('G14',{}))
 assert.equal(f.navigations.length,0)
 assert.match(f.modals.at(-1).content,/清风 抽取式面巾纸[\s\S]*24件\/箱，2箱起批[\s\S]*未配置混批组/)
 f.state.wholesaleSku={id:'oil',name:'食用油',box_size:6,min_boxes:3,mix_group:'FOOD'}
 await f.handleRemote('G13',ctx('G14',{}))
 assert.match(f.modals.at(-1).content,/食用油[\s\S]*6件\/箱，3箱起批[\s\S]*FOOD/)
})

test('G13 非法箱规和混批字段在发请求前被拦截',async()=>{
 const valid={boxSize:24,minBoxes:2,minQty:1,mixUnits:1,mixGroup:'',混批开关:false,mixCapacity:24,minMixBoxes:2}
 for(const [field,value,message] of [
  ['boxSize','0','箱规、起订量和箱容积分须为正整数'],
  ['minBoxes','1.5','箱规、起订量和箱容积分须为正整数'],
  ['mixUnits','','箱规、起订量和箱容积分须为正整数'],
  ['mixGroup','非法 分组','混批组编号格式错误'],
  ['mixCapacity',0,'混批箱容与最低箱数无效'],
 ]){
  const f=fixture(),form={...valid,[field]:value,混批开关:field==='mixCapacity'}
  f.backend.boxProduct={id:'cup'}
  await f.handleRemote('save',ctx('G13',form))
  assert.equal(f.toasts.at(-1),message)
  assert.equal(f.requests.length,0)
  assert.equal(f.writes.length,0)
 }
})

test('G14 选择服务端首个可售批发品后按该 SKU 结算，不回退示例 SKU',async()=>{
  const sku={id:'oil',name:'真实食用油',spec:'6瓶/箱',asset:'oil',price:4000,stock:100,box_size:6,min_boxes:2}
 const f=fixture({responses:{'/products':[sku]}}),form={boxes:2}
 f.state.selectedProduct='retail-not-wholesale'
 await f.pageData('G14',form)
 await f.handleRemote('wholesale',ctx('G14',form))
  assert.equal(f.state.wholesaleContext.lines[0].id,'oil')
 assert.equal(f.navigations.at(-1),'G15')
 await f.pageData('G15',{})
  assert.equal(f.blocks('G15').find(b=>b.type==='wholesaleItem').product.id,'oil')
})

test('G14 批发接口拒绝时清除旧商品，不展示样例身份价格或允许结算',async()=>{
 const f=fixture({failures:['/products']})
 f.state.wholesaleSku={id:'old-member-sku',price:3500,box_size:24}
 await f.pageData('G14',{boxes:2})
 const blocks=f.blocks('G14')
 assert.equal(f.state.wholesaleSku,null)
 assert.match(JSON.stringify(blocks),/业务数据读取失败/)
 assert.doesNotMatch(JSON.stringify(blocks),/old-member-sku|当前身份：总代理|¥288\.00/)
})

test('G15 直达或切换会员商城后不借用上次采购上下文',async()=>{
 const sku={id:'oil',price:4000,box_size:6,min_boxes:2}
 const f=fixture({responses:{'/products':[sku]}})
 assert.match(JSON.stringify(f.blocks('G15')),/请从采购购物车选择商品与箱数/)
 f.state.wholesaleSku=sku
 f.state.wholesaleContext={memberId:202,shopId:2,skuId:'oil',boxes:2}
 await f.pageData('G15',{})
 assert.equal(f.state.wholesaleSku,null)
 assert.equal(f.requests.some(x=>x.url.includes('/products')),false)
 f.state.addresses=[{name:'收货人',detail:'仓库'}]
 await f.handleRemote('purchase',ctx('G15',{}))
 assert.equal(f.writes.length,0)
 assert.match(f.toasts.at(-1),/采购商品或箱规已变化/)
})

test('D116 G14/G15 同组 A24+B24 可逐项确认并提交，A23+B24 在采购页拦截',async()=>{
 const a={id:'A',name:'商品A',spec:'24件/箱',asset:'cup',price:3500,stock:100,box_size:24,min_boxes:2,min_qty:1,mix_group:'C13',mix_units:1}
 const b={...a,id:'B',name:'商品B',asset:'paper',price:4000}
 const rules={mixedEnabled:true,mixCapacity:24,minMixBoxes:2}
 const productScopes=[]
 const f=fixture({catalogProducts:[],responses:{'/products':[a,b],'/wholesale-rules':rules},onRequest:(url,data)=>{if(url.endsWith('/products'))productScopes.push([data.shopId,data.destinationShopId])}}),form={}
 f.state.selectedProduct='A';f.state.addresses=[{name:'采购人',detail:'收货仓'}]
 await f.pageData('G14',form)
 form.wholesaleAdd='商品B · B';await f.handleRemote('wholesale-add',ctx('G14',form))
 assert.equal(f.blocks('G14',form).filter(block=>block.type==='wholesaleItem').length,2)
 form['wholesaleQty:A']=23;form['wholesaleQty:B']=24
 await f.handleRemote('wholesale',ctx('G14',form))
 assert.match(f.toasts.at(-1),/混批组 C13/)
 assert.equal(f.navigations.includes('G15'),false)
 form['wholesaleQty:A']='2e1'
 await f.handleRemote('wholesale',ctx('G14',form))
 assert.match(f.toasts.at(-1),/1 至 100000 件/)
 form['wholesaleQty:A']=24
 await f.handleRemote('wholesale',ctx('G14',form))
 assert.deepEqual(plain(f.state.wholesaleContext.lines.map(line=>[line.id,line.qty])),[['A',24],['B',24]])
 await f.pageData('G15',{})
 const items=f.blocks('G15').filter(block=>block.type==='wholesaleItem')
 assert.deepEqual(plain(items.map(block=>block.product.name)),['商品A','商品B'])
 assert.deepEqual(plain(items.map(block=>block.product.asset)),['cup','paper'])
 f.state.addresses=[{name:'采购人',detail:'收货仓'}]
 await f.handleRemote('purchase',{...ctx('G15',{delivery:'采购入库'}),address:{name:'采购人',detail:'收货仓'}})
 assert.ok(productScopes.length>=4)
 assert.ok(productScopes.every(([source,destination])=>source===900&&destination===2))
 assert.deepEqual(plain(f.writes.at(-1).items),[{id:'A',qty:24},{id:'B',qty:24}])
 assert.equal(f.writes.at(-1).expectedTotal,24*3500+24*4000)
})

test('D116 刷新保留当前采购数量，并发库存降低后不提交旧数量',async()=>{
 const a={id:'A',name:'商品A',spec:'24件/箱',asset:'cup',price:3500,stock:100,box_size:24,min_boxes:2,min_qty:1,mix_group:'C13',mix_units:1}
 const b={...a,id:'B',name:'商品B'}
 const products=[a,b],responses={'/products':products,'/wholesale-rules':{mixedEnabled:true,mixCapacity:24,minMixBoxes:2}}
 let reads=0
 const f=fixture({responses,onRequest:url=>{if(url.endsWith('/products')&&++reads===4)products[0].stock=23}}),form={}
 f.state.selectedProduct='A';f.state.addresses=[{name:'采购人',detail:'收货仓'}]
 await f.pageData('G14',form)
 form.wholesaleAdd='商品B · B';await f.handleRemote('wholesale-add',ctx('G14',form))
 form['wholesaleQty:A']=24;form['wholesaleQty:B']=24
 await f.handleRemote('wholesale',ctx('G14',form))
 const refreshed={};await f.pageData('G14',refreshed)
 assert.deepEqual([refreshed['wholesaleQty:A'],refreshed['wholesaleQty:B']],[24,24])
 await f.pageData('G15',{})
 f.state.addresses=[{name:'采购人',detail:'收货仓'}]
 await f.handleRemote('purchase',{...ctx('G15',{}),address:{name:'采购人',detail:'收货仓'}})
 assert.match(f.toasts.at(-1),/库存不足/)
 assert.equal(f.writes.length,0)
})

test('D124 使用公司来源 SKU 资料；来源名称、图或规格缺失时不允许提交',async()=>{
 const complete={id:'cup',name:'禾序 316不锈钢保温杯',spec:'316不锈钢 500ml',asset:'cup',price:3500,stock:100,box_size:24,min_boxes:2}
 const responses={'/products':[complete]}
 const f=fixture({catalogProducts:[],responses}),form={}
 await f.pageData('G14',form)
 assert.equal(f.blocks('G14',form).find(block=>block.type==='wholesaleItem').product.name,complete.name)
 await f.handleRemote('wholesale',ctx('G14',form))
 await f.pageData('G15',{})
 assert.equal(f.blocks('G15').find(block=>block.type==='wholesaleItem').product.asset,'cup')
 f.state.addresses=[{name:'采购人',detail:'仓库'}]
 responses['/products']=[{...complete,asset:''}]
 await f.handleRemote('purchase',{...ctx('G15',{}),address:{name:'采购人',detail:'仓库'}})
 assert.match(f.toasts.at(-1),/名称、图片或规格缺失/)
 assert.equal(f.writes.length,0)
})

test('G12 新增运费模板必须填写合法名称，空白和控制字符不写入配置',async()=>{
 const f=fixture(),form={categoryNames:'生活日用',计费方式:'固定运费',首件运费:0,续件运费:0,偏远地区加收:0,满额包邮门槛:0,firstUnits:1,stepUnits:1}
 f.backend.catalogSettings={categories:['生活日用']}
 for(const name of ['', '   ', '运费\n模板', '模'.repeat(81)]){
  form.模板名称=name
  await f.handleRemote('save',ctx('G12',form))
  assert.equal(f.writes.length,0)
  assert.match(f.toasts.at(-1),/1至80字的运费模板名称/)
 }
})

test('G12 只调整分类时不附带空运费模板',async()=>{
 const f=fixture({responses:{'/management/products':[],'/management/catalog-settings':{categories:['生活日用','办公用品']},'/management/documents_freight':[],'/management/documents_category':[{id:'CATEGORY',status:'ACTIVE'}]}}),form={}
 await f.pageData('G12',form)
 form.categoryNames='办公用品\n生活日用'
 await f.handleRemote('save',ctx('G12',form))
 assert.equal(f.writes.length,1)
 assert.equal(f.writes[0].categoryId,'CATEGORY')
 assert.deepEqual(plain(f.writes[0].categories),['办公用品','生活日用'])
 assert.equal('freight' in f.writes[0],false)
})

test('普通客户的代理中心和晋升页不显示示例身份、趋势或资格',async()=>{
 const f=fixture();f.backend.agentData={customers:[{name:'旧代理客户'}]};f.backend.assessment={eligible:true}
 for(const id of ['M33','M38']){await f.pageData(id,{});const text=JSON.stringify(f.blocks(id));assert.match(text,/尚未获得本店代理身份/);assert.doesNotMatch(text,/210,000|48%|近6个月|已具备申请/)}
 assert.equal(f.backend.assessment,null);assert.equal(f.backend.agentData,null)
})

test('真实代理业绩只用当前考核字段，无6个月示例图与假活跃指标',async()=>{
 const f=fixture({agent:{id:4,rank_no:1},responses:{'/agent-data':{customers:[{member_id:202,name:'真实客户'}],children:[]},'/assessment':{configured:true,eligible:false,rank:1,targetRank:2,periodStart:'2026-09-01',periodEnd:'2026-09-30',customers:1,orders:2,repeatBps:2500,sales:2000,metrics:[{key:'sales',label:'销售额',value:2000,threshold:5000}]}}})
 await f.pageData('M33',{});const b=f.blocks('M33'),stats=b.filter(x=>x.type==='stats')[1]
 assert.equal(b.find(x=>x.type==='profile').name,'接口会员');assert.deepEqual(plain(stats.items.map(x=>x.value)),[1,1,2,'25%']);assert.equal(b.some(x=>x.type==='chart'),false);assert.equal(stats.items[1].label,'本期成交客户')
 await f.pageData('M38',{});assert.deepEqual(plain(f.blocks('M38').find(x=>x.type==='relation').items),['云代理','分货中心']);assert.match(JSON.stringify(f.blocks('M38')),/尚未达到晋升条件/)
})

test('迁移页回读实际归属，清掉样例代理与生效日期',async()=>{
 const f=fixture({context:{bound:true,shop:{id:2,name:'实际原店'},currentBinding:{agentId:17,name:'实际代理'}}}),form={目标代理:'李四',期望生效时间:'2026-09-20'}
 await f.pageData('M41',form);assert.equal(form.目标代理,'');assert.equal(form.期望生效时间,'');assert.equal(form.目标商城,'')
 const b=f.blocks('M41',form);assert.deepEqual(plain(b.find(x=>x.type==='rows').items),[{label:'原商城',value:'实际原店'},{label:'当前代理',value:'实际代理 · 17'}]);assert.deepEqual(plain(b.find(x=>x.type==='fields').items.find(x=>x.key==='目标商城').options),['直营商城'])
 f.backend.migrationContext={bound:false};assert.match(JSON.stringify(f.blocks('M41',form)),/暂无可迁移/)
})

test('跨店采购无显式目标不显示青木店与120元，目标价格来自目标店公开商品',async()=>{
 const f=fixture({responses:{'/guest/products':[{id:'sku-real',name:'目标商品',price:3456}]}})
 await f.pageData('M44',{});assert.match(JSON.stringify(f.blocks('M44')),/请先选择要访问/);assert.doesNotMatch(JSON.stringify(f.blocks('M44')),/青木|120.00/)
 f.backend.requestedShopId=1;f.state.selectedProduct='sku-real';await f.pageData('M44',{})
 assert.equal(f.backend.crossPurchaseProduct,null)
 await f.handleRemote('cross-product:sku-real',ctx('M44',{}))
 assert.equal(f.blocks('M44').find(x=>x.type==='product').price,'34.56');assert.equal(f.backend.crossPurchaseTarget.name,'直营商城');assert.equal(f.blocks('M44').some(x=>x.type==='options'),false)
})

test('跨店申请商品只属于选择它的会员与目标店',async()=>{
 const member={id:201,name:'原会员',phone:'13800138000'}
 const f=fixture({bootstrapMember:member,responses:{'/guest/products':[{id:'target-sku',name:'目标商品',price:3456}]}})
 f.backend.requestedShopId=1
 await f.pageData('M44',{})
 await f.handleRemote('cross-product:target-sku',ctx('M44',{}))
 assert.equal(f.backend.crossPurchaseProduct.id,'target-sku')
 member.id=202;member.name='另一会员'
 await f.pageData('M44',{})
 assert.equal(f.backend.crossPurchaseProduct,null)
 assert.match(JSON.stringify(f.blocks('M44')),/请先选择目标商城的可售商品/)
})

test('跨店审批卡同时展示业务名称与编号，已批准记录显示撤销原因',()=>{
 const f=fixture(),document={id:'DOC-test',status:'PENDING',shop_id:3,member_id:103,body:{name:'测试代理',sourceShopId:2,items:[{skuId:'stapler',qty:2}],expiresAt:Date.now()+86400000}}
 f.backend.shops=[{id:2,name:'原商城'},{id:3,name:'采购商城'}]
 f.backend.management.G35=[document]
 f.products.push({id:'stapler',name:'晨光订书机',spec:'ABS9166'})
 let details=f.blocks('G35').find(block=>block.title==='申请详情').items
 assert.match(JSON.stringify(details),/测试代理.*103.*原商城.*2.*采购商城.*3.*晨光订书机.*ABS9166.*stapler/)
 assert.equal(details.find(row=>row.label==='申请商品数量').wrapIdentifier,true)
 document.status='APPROVED'
 assert.equal(f.blocks('G35').find(block=>block.title==='提前撤销授权').items[0].key,'撤销原因')
})

test('G35 长业务名称保留完整内容和编号，商品明细使用换行布局',()=>{
 const f=fixture(),memberName='跨店采购申请代理'.repeat(8),sourceName='原商城名称'.repeat(12),targetName='采购商城名称'.repeat(12),productName='商品名称'.repeat(30)
 const document={id:'DOC-long',status:'PENDING',shop_id:3,member_id:103,body:{name:memberName,sourceShopId:2,items:[{skuId:'long-sku',qty:2}],expiresAt:Date.now()+86400000}}
 f.backend.shops=[{id:2,name:sourceName},{id:3,name:targetName}]
 f.backend.management.G35=[document]
 f.products.push({id:'long-sku',name:productName,spec:'超长规格'.repeat(15)})
 const rows=f.blocks('G35').find(block=>block.title==='申请详情').items
 assert.equal(rows.find(row=>row.label==='申请人').value,`${memberName}（会员 103）`)
 assert.equal(rows.find(row=>row.label==='原商城').value,`${sourceName}（2）`)
 assert.equal(rows.find(row=>row.label==='采购商城').value,`${targetName}（3）`)
 const item=rows.find(row=>row.label==='申请商品数量')
 assert.equal(item.value,`${productName} · ${'超长规格'.repeat(15)}（long-sku）×2`)
 assert.equal(item.wrapIdentifier,true)
})

test('G35 只为已批准授权发起带原因的撤销命令',async()=>{
 const f=fixture({responses:{'/management/document-revoke':{id:'DOC-test',status:'REVOKED'}}})
 const document={id:'DOC-test',status:'APPROVED',shop_id:2,member_id:103,body:{items:[{skuId:'stapler',qty:2}],expiresAt:Date.now()+86400000}}
 f.backend.management.G35=[document]
 await f.handleRemote('cross-revoke',ctx('G35',{'撤销原因':'提前终止授权'}))
 assert.equal(f.requests.filter(request=>request.url.endsWith('/management/document-revoke')).length,1)
 document.status='REVOKED';f.backend.management.G35=[document]
 await f.handleRemote('cross-revoke',ctx('G35',{'撤销原因':'再次撤销'}))
 assert.equal(f.requests.filter(request=>request.url.endsWith('/management/document-revoke')).length,1)
})

test('跨店申请可切换目标店真实商品，原因字段准确保存；不存在商品不写入',async()=>{
 const f=fixture({responses:{'/guest/products':[{id:'target-sku',name:'目标商品',price:3456}]}}),form={采购数量:2,reason:'当前店无货，申请单次采购'};f.backend.requestedShopId=1;
 await f.pageData('M44',form);const choice=f.blocks('M44').find(x=>x.title==='选择访问店商品').items[0];assert.equal(choice.target,'cross-product:target-sku');
 await f.handleRemote(choice.target,ctx('M44',form));assert.equal(f.backend.crossPurchaseProduct.id,'target-sku');
 await f.handleRemote('cross-store',ctx('M44',form));assert.equal(f.writes[0].reason,form.reason);assert.equal(f.writes[0].items[0].skuId,'target-sku');assert.equal(f.writes[0].shopId,1);
 await f.handleRemote('cross-product:missing',ctx('M44',form));assert.equal(f.writes.length,1);assert.match(f.toasts.at(-1),/已变化/);
})

test('兑换订单详情始终选中回读的兑换单，不能沿用之前零售单',async()=>{
 const f=fixture();f.state.activeOrder='retail-order';await f.handleRemote('redemption-order',ctx('M63',{}));assert.equal(f.state.activeOrder,'retail-order');
 f.backend.redemptionOrder={id:'points-order',order_type:'POINTS'};await f.handleRemote('redemption-order',ctx('M63',{}));assert.equal(f.state.activeOrder,'points-order');
})

test('跨店受限时进入实际访问确认页，当前店和待申请店不混淆',async()=>{
 const f=fixture({responses:{'/shop-access':{allowed:false,homeShopId:2,homeShopName:'真实商城'}}});await f.handleRemote('switch-shop:1',ctx('M42',{}));
 assert.equal(f.backend.shopId,2);assert.equal(f.backend.requestedShopId,1);assert.equal(f.navigations.at(-1),'M43');assert.equal(f.writes.length,0);
})

test('单次跨店授权已建单后冷进目标店，转到本人订单且保留返源入口',async()=>{
 const order={id:'HX-own-cross-order',shop_id:3,buyer_id:201,status:'UNPAID',total:12000,subtotal:12000,items:[]}
 const f=fixture({pageStack:[],bootstrapShop:{id:3,name:'目标店',kind:'DEALER'},bootstrapOrders:[order],responses:{'/shop-access':{allowed:false,crossOrderHistory:true,pendingOrderId:order.id,homeShopId:2,homeShopName:'原店'}}})
 f.backend.shopId=3;f.state.lastHydratedIdentity={memberId:201,shopId:2}
 await f.pageData('M03',{})
 assert.deepEqual(plain(f.routeActions),[{type:'redirect',url:'/pages/M17/index'}])
 assert.equal(f.backend.shopId,3)
 await f.pageData('M17',{})
 assert.equal(f.backend.crossOrderHomeShopId,2)
 assert.equal(f.backend.crossOrderPendingId,order.id)
 assert.equal(f.state.orders[0].id,order.id)
 assert.match(f.blocks('M17').find(block=>block.title==='跨店订单').body,/继续支付或取消/)
 f.backend.crossOrderPendingId=''
 assert.match(f.blocks('M17').find(block=>block.title==='跨店订单').body,/查看历史/)
})

test('M42 选择有本人已建跨店单的目标店，进入目标店订单而非重新申请',async()=>{
 const targetShop={id:3,name:'目标店',kind:'DEALER',status:'ACTIVE'}
 const order={id:'HX-own-cross-order',shop_id:3,buyer_id:201,status:'UNPAID',total:12000,subtotal:12000,items:[]}
 const f=fixture({shopList:[{id:2,name:'原店',kind:'DEALER',status:'ACTIVE'},targetShop],bootstrapShop:targetShop,bootstrapOrders:[order],responses:{'/shop-access':{allowed:false,crossOrderHistory:true,pendingOrderId:order.id,homeShopId:2,homeShopName:'原店'}}})
 await f.handleRemote('switch-shop:3',ctx('M42',{}))
 assert.equal(f.backend.shopId,3)
 assert.equal(f.backend.crossOrderHomeShopId,2)
 assert.equal(f.navigations.at(-1),'M17')
 assert.equal(f.state.orders[0].id,order.id)
 assert.equal(f.backend.requestedShopId,undefined)
})

test('M42 切到直营商城进入 M02，切到经销商商城进入 M03',async()=>{
 const direct=fixture({bootstrapShop:{id:1,name:'直营商城',kind:'DIRECT',county:'其他地区'},responses:{'/shop-access':{allowed:true}}})
 await direct.handleRemote('switch-shop:1',ctx('M42',{}))
 assert.equal(direct.backend.shopId,1)
 assert.equal(direct.backend.shopInfo.kind,'DIRECT')
 assert.equal(direct.navigations.at(-1),'M02')

 const dealer=fixture({responses:{'/shop-access':{allowed:true}}})
 await dealer.handleRemote('switch-shop:2',ctx('M42',{}))
 assert.equal(dealer.backend.shopId,2)
 assert.equal(dealer.navigations.at(-1),'M03')
})

test('M42 重名商城按 ID 选择，错误 ID 不误入其他店',async()=>{
 const shops=[{id:1,name:'同名商城',kind:'DIRECT',status:'ACTIVE'},{id:3,name:'同名商城',kind:'DEALER',status:'ACTIVE'}]
 const f=fixture({shopList:shops,bootstrapShop:shops[1],responses:{'/shop-access':{allowed:true}}})
 await f.handleRemote('switch-shop:3',ctx('M42',{}))
 assert.equal(f.backend.shopId,3)
 assert.equal(f.backend.shopInfo.kind,'DEALER')
 assert.equal(f.navigations.at(-1),'M03')
 await f.handleRemote('switch-shop:不存在',ctx('M42',{}))
 assert.equal(f.backend.shopId,3)
 assert.equal(f.navigations.length,1)
 assert.match(f.toasts.at(-1),/尚未开通/)
})

test('本地游客登录先校验协议，勾选后获取真实联调会话，不被游客保护拦回',async()=>{
 const f=fixture();f.backend.guest=true;f.backend.ready=false;await f.handleRemote('login',ctx('M01',{consent:false}));assert.equal(f.navigations.length,0);assert.match(f.toasts.at(-1),/登录协议/);
 await f.handleRemote('login',ctx('M01',{consent:true}));assert.equal(f.backend.guest,false);assert.equal(f.backend.ready,true);assert.equal(f.navigations.at(-1),'M03');
 assert.deepEqual(plain(f.writes.filter(w=>w.operation==='privacy-consent')),[{operation:'privacy-consent',shopId:2,versions:{USER_AGREEMENT:'v1',PRIVACY_POLICY:'v1'}}]);
})

test('本地登录同意记录失败时停留登录页，避免显示虚假的登录成功',async()=>{
 const f=fixture({failures:['/privacy-consent']});f.backend.guest=true;f.backend.ready=false;
 await f.handleRemote('login',ctx('M01',{consent:true}));
 assert.equal(f.navigations.length,0);
 assert.match(f.toasts.at(-1),/服务暂不可用/);
})

test('M01 显式游客浏览在本地包不自动开发登录，冷启续览受保护页仍要求登录',async()=>{
 const f=fixture({responses:{'/guest/products':[{id:'sku-real',name:'公开商品',price:1000}],'/storefront':{decoration:{},pages:{},categories:[]}}});f.storage.set('hexu-api-token','old-token');f.state.cart=[{id:'sku-real',qty:1}];
 f.enterGuestBrowsing();
 assert.equal(f.storage.has('hexu-api-token'),false);
 assert.equal(f.storage.get('hexu-guest-browse'),true);
 assert.equal(f.backend.member,null);
 assert.equal(f.state.cart.length,0);
 await f.pageData('M03',{});
 assert.equal(f.backend.guest,true);
 assert.equal(f.requests.some(r=>r.url.endsWith('/dev/login')),false);
 f.backend.guest=false; // Simulate a page instance after a cold start, with the explicit choice retained in storage.
 await f.pageData('M04',{});
 assert.equal(f.backend.guest,true);
 await f.pageData('M17',{});
 assert.equal(f.navigations.at(-1),'M01');
 assert.equal(f.requests.some(r=>r.url.endsWith('/dev/login')),false);
 await f.handleRemote('login',ctx('M01',{consent:true}));
 assert.equal(f.backend.ready,true);
 assert.equal(f.storage.has('hexu-guest-browse'),false);
 assert.equal(f.requests.some(r=>r.url.endsWith('/dev/login')),true);
})

test('未选择游客的本地开发首页仍按原方式建立测试会话',async()=>{
 const f=fixture({responses:{'/shop-access':{allowed:true}}});f.backend.ready=false;f.backend.token='';
 await f.pageData('M03',{});
 assert.equal(f.backend.ready,true);
 assert.equal(f.backend.guest,false);
 assert.equal(f.requests.some(r=>r.url.endsWith('/dev/login')),true);
 assert.equal(f.storage.has('hexu-guest-browse'),false);
})

test('HBuilder 开发包连接线上服务时，未登录首页直接游客浏览且不弹登录提示',async()=>{
 const f=fixture({remoteLogin:true,responses:{'/guest/products':[{id:'sku-real',name:'公开商品',price:1000}],'/storefront':{decoration:{},pages:{},categories:[]}}})
 f.backend.ready=false;f.backend.token=''
 await f.pageData('M03',{})
 assert.equal(f.backend.guest,true)
 assert.equal(f.backend.ready,false)
 assert.equal(f.toasts.length,0)
 assert.equal(f.requests.some(r=>r.url.endsWith('/dev/login')||r.url.endsWith('/bootstrap')),false)
 assert.equal(f.products[0].id,'sku-real')
})

test('本地包显式测试会员可从游客首页切入本人会话，手动游客选择仍优先',async()=>{
 const pageStack=[{route:'pages/M03/index',options:{member:'990411',shop:'2'}}]
 const member={id:990411,name:'独立测试会员'}
 const f=fixture({pageStack,h5Search:'?member=990411&shop=2',bootstrapMember:member,responses:{'/shop-access':{allowed:true}}})
 f.backend.guest=true;f.backend.ready=false;f.backend.token=''
 await f.pageData('M03',{})
 assert.equal(f.backend.ready,true)
 assert.equal(f.backend.guest,false)
 assert.equal(f.backend.member.id,member.id)
 assert.equal(f.storage.get('hexu-member-id'),member.id)
 assert.equal(f.requests.some(r=>r.url.endsWith('/dev/login')),true)

 const guest=fixture({pageStack,responses:{'/guest/products':[],'/storefront':{decoration:{},pages:{},categories:[]}}})
 guest.backend.guest=true;guest.backend.ready=false;guest.storage.set('hexu-guest-browse',true)
 await guest.pageData('M03',{})
 assert.equal(guest.backend.guest,true)
 assert.equal(guest.requests.some(r=>r.url.endsWith('/dev/login')),false)
})

test('M01 只保留微信登录，不请求手机号权限或展示未开通短信入口',async()=>{
 assert.match(screenSource,/<button class="primary full" @tap="handle\('login'\)">一键登录（微信授权）<\/button>/);
 assert.match(screenSource,/v-if="isLocalSandbox\(\)"[^>]*>开发环境登录，不调用微信授权/);
 assert.doesNotMatch(screenSource,/getPhoneNumber|phoneLogin|phoneConsent|onPhoneNumber/);
 const f=fixture({remoteLogin:true,responses:{'/policies':{USER_AGREEMENT:{version:'v1'},PRIVACY_POLICY:{version:'v1'}},'/wechat/login':{token:'wechat-token'}}});
 f.backend.guest=true;f.backend.ready=false;
 await f.handleRemote('login',ctx('M01',{consent:true}));
 assert.equal(f.backend.ready,true);
 assert.equal(f.requests.some(r=>r.url.endsWith('/wechat/phone')),false);
})

test('正式微信登录获 token 后资料刷新失败会清除半登录状态',async()=>{
 const f=fixture({remoteLogin:true,failures:['/bootstrap'],responses:{'/policies':{USER_AGREEMENT:{version:'v1'},PRIVACY_POLICY:{version:'v1'}},'/wechat/login':{token:'wechat-token'}}});
 f.backend.guest=true;f.backend.ready=false;f.state.cart=[{id:'old-sku',qty:1}];
 await f.handleRemote('login',ctx('M01',{consent:true}));
 assert.equal(f.requests.some(r=>r.url.endsWith('/wechat/login')),true);
 assert.equal(f.backend.token,'');
 assert.equal(f.backend.ready,false);
 assert.equal(f.backend.member,null);
 assert.equal(f.state.cart.length,0);
 assert.equal(f.storage.has('hexu-api-token'),false);
 assert.equal(f.navigations.length,0);
 assert.match(f.toasts.at(-1),/服务暂不可用/);
})

test('正式微信登录部分 bootstrap 数据已装载后失败也不残留会员缓存',async()=>{
 const f=fixture({remoteLogin:true,failures:['/coupons'],responses:{'/policies':{USER_AGREEMENT:{version:'v1'},PRIVACY_POLICY:{version:'v1'}},'/wechat/login':{token:'wechat-token'}}});
 f.backend.guest=true;f.backend.ready=false;
 await f.handleRemote('login',ctx('M01',{consent:true}));
 assert.equal(f.backend.ready,false);
 assert.equal(f.backend.token,'');
 assert.equal(f.backend.member,null);
 assert.equal(f.products.length,0);
 assert.equal(f.state.orders.length,0);
 assert.equal(f.state.signedIn,false);
 assert.equal(f.storage.has('hexu-api-token'),false);
})

test('游客商品卡片可进入真实商品；登录后返回原商品并保留商城、商品及邀请上下文',async()=>{
 const f=fixture();await f.refresh();f.backend.guest=true;f.backend.ready=false;
 await f.handleRemote('product:missing',ctx('M03',{}));
 assert.equal(f.navigations.length,0);
 assert.match(f.toasts.at(-1),/商品已变化/);
 f.rememberLoginReturn('M17');
 await f.handleRemote('product:sku-real',ctx('M03',{}));
 assert.equal(f.navigations.at(-1),'M05');
 assert.equal(f.state.selectedProduct,'sku-real');
 assert.equal(f.backend.loginReturn,null);
 f.state.invite='invite-original';f.state.selectedGroup='group-original';
 await f.handleRemote('cart-add',ctx('M05',{}));
 assert.equal(f.navigations.at(-1),'M01');
 assert.equal(f.backend.loginReturn.pageId,'M05');
 assert.equal(f.writes.length,0);
 f.state.selectedProduct='';f.state.invite='';f.state.selectedGroup='';
 await f.handleRemote('login',ctx('M01',{consent:false}));
 assert.equal(f.backend.loginReturn.pageId,'M05');
 await f.handleRemote('login',ctx('M01',{consent:true}));
 assert.equal(f.navigations.at(-1),'M05');
 assert.equal(f.backend.shopId,2);
 assert.equal(f.state.selectedProduct,'sku-real');
 assert.equal(f.state.invite,'invite-original');
 assert.equal(f.state.selectedGroup,'group-original');
 assert.equal(f.backend.loginReturn,null);
})

test('会员尚未初始化时商品卡片先读取当前商城商品，再打开真实 SKU',async()=>{
 const f=fixture();f.backend.ready=false;f.backend.token='';
 await f.handleRemote('product:sku-real',ctx('M03',{}));
 assert.equal(f.backend.ready,true);
 assert.equal(f.state.selectedProduct,'sku-real');
 assert.equal(f.navigations.at(-1),'M05');
})

test('游客与会员分享当前商品链接，不创建代理邀请；失效商品不复制',async()=>{
 const f=fixture();await f.refresh();f.state.selectedProduct='sku-real';f.backend.guest=true;f.backend.ready=false;
 await f.handleRemote('share',ctx('M05',{}));
 assert.equal(f.clipboard.at(-1),'/pages/M05/index?shop=2&sku=sku-real');
 assert.equal(f.navigations.length,0);
 assert.equal(f.backend.loginReturn,null);
 assert.equal(f.writes.length,0);
 f.state.selectedProduct='missing';
 await f.handleRemote('share',ctx('M05',{}));
 assert.equal(f.clipboard.length,1);
 assert.match(f.toasts.at(-1),/商品已变化/);
 f.backend.guest=false;f.backend.ready=true;f.state.selectedProduct='sku-real';
 await f.handleRemote('share',ctx('M05',{}));
 assert.equal(f.clipboard.length,2);
 assert.equal(f.writes.length,0);
})

test('M06 当前购买价与零售参考价分别取服务端字段，不把代理价当零售价',async()=>{
 const f=fixture({agent:{id:4,rank_no:2},catalogProducts:[{id:'sku-real',price:800,retailPrice:2000,stock:10}]});
 await f.refresh();
 assert.equal(f.products[0].price,800);
 assert.equal(f.products[0].retailPrice,2000);
 assert.match(screenSource,/detail-price">¥\{\{money\(currentProduct\.price\)\}\}/);
 assert.match(screenSource,/零售价 ¥\{\{money\(agentRetailPrice\)\}\}/);
 assert.doesNotMatch(screenSource,/currentProduct\.agent/);
})

test('正式微信登录请求携带原邀请参数，完成后回到原商品而非首页',async()=>{
 let loginInvite='';
 const policies={USER_AGREEMENT:{version:'v1'},PRIVACY_POLICY:{version:'v1'}};
 const f=fixture({remoteLogin:true,responses:{'/policies':policies,'/wechat/login':{token:'wechat-token'}},onRequest:(url,data)=>{if(url.endsWith('/wechat/login'))loginInvite=data.invite}});
 f.backend.guest=true;f.backend.ready=false;f.state.selectedProduct='sku-real';f.state.invite='invite-original';
 f.rememberLoginReturn('M05');f.state.selectedProduct='';f.state.invite='';
 await f.handleRemote('login',ctx('M01',{consent:true}));
 assert.equal(loginInvite,'invite-original');
 assert.equal(f.navigations.at(-1),'M05');
 assert.equal(f.state.selectedProduct,'sku-real');
 assert.equal(f.state.invite,'invite-original');
 assert.equal(f.backend.loginReturn,null);
})

test('游客受保护导航记住原目标，主动继续浏览会清除回跳；过期或跨商城目标不复用',async()=>{
 const f=fixture();f.backend.guest=true;
 const lines=screenSource.split(/\r?\n/).filter(line=>line.startsWith('function requireLogin(')||line.startsWith('function navigate('));
 assert.equal(lines.length,2);
 const ui={backend:f.backend,pageId:'M03',guestPages:new Set(['M01','M02','M03','M04','M05','M07']),rememberLoginReturn:f.rememberLoginReturn,clearLoginReturn:f.clearLoginReturn,storeNavigate:page=>f.navigations.push(page),toast:message=>f.toasts.push(message)};
 vm.runInNewContext(lines.join('\n')+'\nglobalThis.actions={navigate,requireLogin}',ui);
 ui.actions.navigate('M17');
 assert.equal(f.navigations.at(-1),'M01');
 assert.equal(f.backend.loginReturn.pageId,'M17');
 ui.actions.navigate('M04');
 assert.equal(f.navigations.at(-1),'M04');
 assert.equal(f.backend.loginReturn,null);
 f.rememberLoginReturn('M17');f.backend.loginReturn.at-=16*60*1000;
 await f.handleRemote('login',ctx('M01',{consent:true}));
 assert.equal(f.navigations.at(-1),'M03');
 assert.equal(f.backend.loginReturn,null);
 const cross=fixture();cross.rememberLoginReturn('M17');cross.backend.loginReturn.shopId=1;
 await cross.handleRemote('login',ctx('M01',{consent:true}));
 assert.equal(cross.navigations.at(-1),'M03');
})

test('选券金额来自实际待结算商品，空商品显示空态',async()=>{
 const f=fixture();await f.pageData('M61',{});assert.match(JSON.stringify(f.blocks('M61')),/暂无待结算商品/);assert.equal(f.backend.checkoutHasItems,false)
 f.state.buyNow={id:'sku-real',qty:3};const b=f.blocks('M61');assert.equal(b.find(x=>x.title==='订单商品').items[0].value,'¥30.00');assert.equal(f.backend.checkoutHasItems,true)
})

test('选券不静默丢弃已下架商品，也不拿剩余商品金额冒充整单',async()=>{
 const f=fixture();await f.pageData('M61',{})
 f.state.cart=[{id:'sku-real',qty:1,selected:true},{id:'removed',qty:1,selected:true}]
 const blocks=f.blocks('M61')
 assert.equal(f.backend.checkoutHasItems,false)
 assert.match(JSON.stringify(blocks),/所选商品暂不可售/)
 assert.equal(blocks.find(b=>b.type==='rows').items[0].target,'M11')
 assert.equal(blocks.some(b=>b.title==='订单商品'),false)
})

test('兑换确认只展示选择商品、平台积分及真实地址，无默认杯子或假余50',async()=>{
 const f=fixture({catalogProducts:[{id:'real-points',name:'真实积分商品',price:1000,point_price:80,stock:10}]});await f.pageData('M62',{})
 assert.match(JSON.stringify(f.blocks('M62',{兑换数量:1})),/请先选择积分兑换商品/)
 f.state.selectedPointProduct='real-points';f.state.addresses=[{name:'接口收货人',region:'真实地区',detail:'真实地址'}]
 const b=f.blocks('M62',{兑换数量:2});assert.equal(f.backend.redemptionReady,false);assert.equal(b.find(x=>x.type==='rows').items.find(x=>x.label==='兑换后剩余').value,'积分不足');assert.match(JSON.stringify(b),/真实地区/)
 f.blocks('M62',{兑换数量:1});assert.equal(f.backend.redemptionReady,true)
 f.blocks('M62',{兑换数量:1.5});assert.equal(f.backend.redemptionReady,false)
})

test('兑换结果必须回读真实POINTS订单，旧缓存金额不能造成功',async()=>{
 const f=fixture({responses:{'/orders/redeemed-real':{id:'redeemed-real',buyer_id:201,shop_id:2,order_type:'POINTS',status:'PAID',points_used:80,total:0,subtotal:0,items:[{sku_id:'sku-real',name:'真实兑换商品',qty:1,unit_price:0}]},'/orders/not-points':{id:'not-points',buyer_id:201,shop_id:2,order_type:'DEALER_RETAIL',status:'PAID',points_used:80,items:[]}}})
 await f.pageData('M63',{});assert.match(JSON.stringify(f.blocks('M63')),/暂无已确认的兑换订单/);assert.doesNotMatch(JSON.stringify(f.blocks('M63')),/兑换成功|DH202609130001/)
 f.state.lastRedemption={id:'redeemed-real',cost:2800,skuId:'cup'};await f.pageData('M63',{});const b=f.blocks('M63');assert.equal(b.find(x=>x.type==='rows').items[0].value,80);assert.equal(b.find(x=>x.type==='product').id,'sku-real');assert.match(JSON.stringify(b),/兑换订单已确认/)
 f.state.lastRedemption={id:'not-points'};await f.pageData('M63',{});assert.match(JSON.stringify(f.blocks('M63')),/暂无已确认的兑换订单/)
})

test('兑换成功页冷启动从当前会员订单列表恢复并回读服务端详情',async()=>{
 const receipt={id:'redeemed-real',buyer_id:201,shop_id:2,order_type:'POINTS',status:'PAID',points_used:80,total:0,subtotal:0,items:[{sku_id:'sku-real',name:'真实兑换商品',qty:1,unit_price:0}]}
 const f=fixture({bootstrapOrders:[receipt],responses:{'/orders/redeemed-real':receipt}})
 await f.pageData('M63',{});assert.equal(f.backend.redemptionOrder.id,'redeemed-real');assert.match(JSON.stringify(f.blocks('M63')),/兑换订单已确认/)
 const wrong=fixture({bootstrapOrders:[receipt],responses:{'/orders/redeemed-real':{...receipt,buyer_id:202}}})
 await wrong.pageData('M63',{});assert.match(JSON.stringify(wrong.blocks('M63')),/暂无已确认的兑换订单/)
})

test('积分订单详情展示实际扣除积分，不把零元商品价当兑换成本',()=>{
 const f=fixture();f.backend.activeOrder={id:'redeemed-real',order_type:'POINTS',rawStatus:'SHIPPED',status:'待收货',points_used:1800,points_scope:0,total:0,subtotal:0,items:[{id:'sku-real',name:'兑换商品',qty:1,unitPrice:0}]}
 const blocks=f.blocks('M18'),rows=blocks.filter(b=>b.type==='rows').flatMap(b=>b.items)
 assert.equal(blocks.find(b=>b.type==='product').price,'1800积分')
 assert.equal(rows.find(row=>row.label==='扣除平台积分').value,1800)
 assert.equal(rows.find(row=>row.label==='实付款').value,'¥0.00')
})

test('积分兑换售后确认展示退回积分而非零元退款',()=>{
 const f=fixture();f.backend.activeOrder={id:'redeemed-real',order_type:'POINTS',rawStatus:'SHIPPED',status:'待收货',points_used:1800,items:[{lineId:1,id:'sku-real',name:'兑换商品',qty:1,unitPrice:0,refunded_qty:0}]}
 const form={申请数量:1},blocks=f.blocks('M21',form),rows=blocks.filter(b=>b.type==='rows').flatMap(b=>b.items)
 assert.equal(blocks.find(b=>b.type==='product').price,'1800积分')
 assert.equal(rows.find(row=>row.label==='本次退回积分').value,1800)
 assert.equal(form.退款金额,'1800积分')
 assert.match(JSON.stringify(blocks),/商家审核后退回积分/)
})

test('退货及换货申请提示先寄回验收，不承诺审核后立即退款',()=>{
 const f=fixture();f.backend.activeOrder={id:'cash-order',order_type:'DEALER_RETAIL',items:[{lineId:1,id:'sku-real',name:'纸巾',qty:2,unitPrice:2990,paid:5980,refunded_qty:0}]}
 f.state.afterType='退货退款'
 assert.match(JSON.stringify(f.blocks('M21',{申请数量:1})),/商家验收后退款/)
 f.state.afterType='换货'
 assert.match(JSON.stringify(f.blocks('M21',{申请数量:1})),/商家验收后换货/)
 f.backend.activeOrder.order_type='POINTS';f.backend.activeOrder.points_used=100
 f.state.afterType='退货退款'
 assert.match(JSON.stringify(f.blocks('M21',{申请数量:1})),/商家验收后退回积分/)
})

test('积分兑换售后详情展示退回积分且不提示渠道退款',()=>{
 const f=fixture();f.backend.activeOrder={id:'redeemed-real',order_type:'POINTS',points_used:1800,items:[{lineId:1,id:'sku-real',name:'兑换商品',qty:1,unitPrice:0}]}
 f.backend.refund={id:'refund-real',order_id:'redeemed-real',line_id:1,qty:1,amount:0,status:'PENDING',refund_type:'REFUND_ONLY',reason:'兑换售后'}
 const blocks=f.blocks('M23'),rows=blocks.filter(b=>b.type==='rows').flatMap(b=>b.items)
 assert.equal(blocks.find(b=>b.type==='product').price,'1800积分')
 assert.equal(rows.find(row=>row.label==='申请退回积分').value,'1800积分')
 assert.doesNotMatch(JSON.stringify(blocks),/渠道退款|¥0.00/)
})

test('经营端积分售后审核详情展示积分而非零元或渠道退款',()=>{
 const f=fixture()
 f.backend.refundOrder={id:'redeemed-real',order_type:'POINTS',points_used:1800,items:[{lineId:1,id:'sku-real',name:'兑换商品',qty:1,unitPrice:0}]}
 f.backend.refund={id:'refund-real',order_id:'redeemed-real',line_id:1,qty:1,amount:0,points_return:1800,order_type:'POINTS',status:'SUCCESS',refund_type:'REFUND_ONLY',reason:'兑换售后'}
 const blocks=f.blocks('G26'),rows=blocks.filter(b=>b.type==='rows').flatMap(b=>b.items)
 assert.equal(blocks.find(b=>b.type==='product').price,'1800积分')
 assert.equal(rows.find(row=>row.label==='申请退回积分').value,'1800积分')
 assert.doesNotMatch(JSON.stringify(blocks),/申请退款|渠道退款|¥0.00/)
})

test('经营端已处理售后回显审核意见，待审核仍保留输入框',()=>{
 const f=fixture()
 f.backend.refund={id:'SHreturn',refund_type:'RETURN',status:'SUCCESS',review_note:'同意退货一件'}
 const finished=f.blocks('G26')
 assert.equal(finished.find(b=>b.title==='审核记录')?.items[0]?.value,'同意退货一件')
 assert.equal(finished.some(b=>b.type==='fields'&&b.title==='审核意见'),false)
 f.backend.refund.status='PENDING'
 assert.equal(f.blocks('G26').some(b=>b.type==='fields'&&b.title==='审核意见'),true)
})

test('非经销零售售后不请求仅适用直发订单的关联候选',async()=>{
 const refund={id:'refund-real',order_id:'redeemed-real',line_id:1,qty:1,amount:0,points_return:1800,order_type:'POINTS',status:'SUCCESS',refund_type:'REFUND_ONLY'}
 const order={id:'redeemed-real',order_type:'POINTS',points_used:1800,items:[{id:1,sku_id:'sku-real',qty:1,unit_price:0}]}
 const f=fixture({responses:{'/management/refunds':[refund],'/management/orders':[order],'/management/aftersale-links':[]}})
 f.backend.refund=refund
 await f.pageData('G26',{})
 assert.equal(f.requests.some(r=>r.url.includes('/aftersale-links/candidates')),false)
 assert.equal(f.backend.afterSaleCandidateError,'')
})

test('G28 不把已退款且无直发关联的退货单显示为换货履约',()=>{
 const f=fixture()
 f.backend.refund={id:'return-done',order_id:'cash-order',refund_type:'RETURN',status:'SUCCESS'}
 const blocks=f.blocks('G28')
 assert.match(JSON.stringify(blocks),/暂无可关联的整箱直发售后/)
 assert.doesNotMatch(JSON.stringify(blocks),/换货履约|等待客户确认/)
})

test('库存总览和售后计数只用真实管理记录，默认订单类型全部可见',async()=>{
 const f=fixture({responses:{'/management/products':[{id:'one',available:2,locked:3,warning_qty:2,retail:900},{id:'two',available:100,locked:1,warning_qty:0,retail:400}],'/management/refunds':[{status:'PENDING'},{status:'PENDING'},{status:'WAIT_RETURN'},{status:'SUCCESS'}],'/management/orders':[{id:'real',order_type:'DEALER_RETAIL',status:'PAID',total:100,subtotal:100,items:[]}]}}),form={orderType:'公司直营零售'}
 await f.pageData('G17',{});assert.deepEqual(plain(f.blocks('G17').find(x=>x.type==='stats').items.map(x=>x.value)),[2,102,1,4]);assert.deepEqual(plain(f.blocks('G17').find(x=>x.type==='stock').ids),['one','two'])
 await f.pageData('G25',{});assert.deepEqual(plain(f.blocks('G25').find(x=>x.type==='stats').items.map(x=>x.value)),[2,1,0])
 await f.pageData('G21',form);assert.equal(form.orderType,'全部类型');assert.equal(f.blocks('G21',form).find(x=>x.type==='orderList').orders.length,1)
 form.orderType='公司直营零售';await f.pageData('G21',form);assert.equal(f.blocks('G21',form).find(x=>x.type==='orderList').orders.length,0)
})

test('管理总览标明当前商城和真实日期，不显示8/12/6假待办',async()=>{
 const f=fixture({responses:{'/management/dashboard':{history:[{day:'2026-09-27',amount:1000,orders:2}],stockWarnings:1,activeShops:1,agents:4}}});await f.pageData('G01',{});const b=f.blocks('G01')
 assert.equal(b.find(x=>x.type==='profile').name,'真实商城 · 管理总览');assert.match(b.find(x=>x.type==='profile').subtitle,/2026-09-27/);assert.doesNotMatch(JSON.stringify(b),/2026年9月13日|8 待审核|12 待处理|6 待补货/);assert.equal(b.find(x=>x.title==='待办事项').items[2].value,'1件达到阈值')
})

test('非直营商城不能把本店数据装入 G02 直营经营台',async()=>{
 const f=fixture({responses:{'/management/dashboard':{history:[{day:'2026-09-27',amount:999999,orders:9}]}}})
 assert.equal(await f.pageData('G02',{}),true)
 assert.equal(f.requests.some(request=>request.url.endsWith('/management/dashboard')),false)
 const blocks=plain(f.blocks('G02'))
 assert.equal(blocks[0].title,'当前商城不是公司直营商城')
 assert.equal(blocks.some(block=>block.type==='stats'||block.type==='chart'||block.type==='hero'),false)
 assert.equal(blocks[1].items[0].target,'G03')
 assert.match(screenSource,/pageId==='G02'&&backend\.shopInfo\?\.kind!=='DIRECT'\)return '当前商城经营台'/)
})

test('G02 待发货快捷入口先打开已筛选订单列表，不直进缺少订单的 G23',()=>{
 assert.match(screenSource,/pageId==='G02'&&target==='G23'[\s\S]*?managementOrderListFilter='待发货'[\s\S]*?navigate\('G21'\)/)
 assert.match(screenSource,/pageId==='G21'&&state\.managementOrderListFilter[\s\S]*?filter\.value=state\.managementOrderListFilter[\s\S]*?state\.managementOrderListFilter=null/)
 assert.ok(screenSource.indexOf("pageId==='G02'&&target==='G23'")<screenSource.indexOf('if(await handleRemote(target'), '快捷入口必须先于远程动作处理')
})

test('G01 与直营 G02 趋势图只展示当前商城的真实七日历史',async()=>{
 const history=[{day:'2026-09-25',amount:0,orders:0},{day:'2026-09-26',amount:2500,orders:1},{day:'2026-09-27',amount:1250,orders:2}]
 const dashboard={history,activeShops:1,agents:4,activeProducts:2,newCustomers:1}
 const current=fixture({responses:{'/management/dashboard':dashboard}})
 await current.pageData('G01',{})
 const platformChart=plain(current.blocks('G01').find(block=>block.type==='chart'))
 assert.deepEqual(platformChart.values,[0,100,50])
 assert.deepEqual(platformChart.labels,['09-25','09-26','09-27'])
 assert.deepEqual(platformChart.actualValues,['0.00','25.00','12.50'])
 const direct=fixture({bootstrapShop:{id:1,name:'直营商城',kind:'DIRECT',county:'直营县域'},responses:{'/management/dashboard':dashboard}})
 direct.backend.shopId=1
 assert.equal(await direct.pageData('G02',{}),true)
 assert.equal(direct.requests.some(request=>request.url.endsWith('/management/dashboard')),true)
 const directBlocks=plain(direct.blocks('G02'))
 assert.equal(directBlocks.find(block=>block.type==='hero').title,'公司直营经营台')
 assert.deepEqual(directBlocks.find(block=>block.type==='chart').values,[0,100,50])
 assert.deepEqual(directBlocks.find(block=>block.type==='chart').actualValues,['0.00','25.00','12.50'])
})

test('经营总览读取失败或空历史时不回退固定趋势图',async()=>{
 const failed=fixture({failures:['/management/dashboard']})
 assert.equal(await failed.pageData('G01',{}),false)
 assert.equal(failed.blocks('G01').some(block=>block.type==='chart'),false)
 assert.match(failed.blocks('G01')[0].body,/服务暂不可用/)
 const direct=fixture({bootstrapShop:{id:1,name:'直营商城',kind:'DIRECT',county:'直营县域'},responses:{'/management/dashboard':{history:[],activeProducts:0,newCustomers:0}}})
 direct.backend.shopId=1
 assert.equal(await direct.pageData('G02',{}),true)
 const chart=plain(direct.blocks('G02').find(block=>block.type==='chart'))
 assert.deepEqual(chart.values,[])
 assert.equal(chart.periodLabel,'暂无数据')
})

test('迁移可选日期留空仍提交空值，有效闰日规范为完整时间',async()=>{
 for(const [date,expected] of [['',''],['2028-02-29','2028-02-29 00:00:00']]){
  const f=fixture({context:{bound:true,currentBinding:{agentId:17,name:'原代理'}},responses:{'/agent-lookup':[{id:28,name:'目标代理'}]}}),form={};await f.pageData('M41',form);
  Object.assign(form,{目标商城:'直营商城',目标代理:'目标代理',reason:'申请迁移',期望生效时间:date});await f.handleRemote('migration',ctx('M41',form));
  assert.equal(f.writes[0].effectiveAt,expected);assert.equal(f.writes[0].targetAgentId,28);
 }
})

test('迁移无效年月日与非日期字符串不提交',async()=>{
 const f=fixture({context:{bound:true,currentBinding:{agentId:17,name:'原代理'}},responses:{'/agent-lookup':[{id:28}]}}),form={};await f.pageData('M41',form);Object.assign(form,{目标商城:'直营商城',目标代理:'目标代理',reason:'申请迁移'});
 for(const date of ['2027-02-29','2026-04-31','0000-01-01','2026-13-01','2026-09-31',' 00:00:00',123]){form.期望生效时间=date;await f.handleRemote('migration',ctx('M41',form));assert.equal(f.writes.length,0);assert.match(f.toasts.at(-1),/有效.*日期/)}
})

test('采购备注按真实200字符契约白名单提交，空备注合法',async()=>{
 for(const remark of ['', ' 请按箱贴分开送达🌿 ', '🌿'.repeat(200)]){
   const sku={id:'wholesale-real',name:'真实批发品',spec:'24件/箱',asset:'cup',price:3500,stock:100,box_size:24,min_boxes:2};const f=fixture({responses:{'/products':[sku]}}),form={订单备注:remark,delivery:'整箱直发',phone:'不应进入请求',_privateDraft:'不可提交'};f.state.addresses=[{name:'实际收货人',detail:'实际收货地址'}];f.state.wholesaleSku=sku;f.backend.wholesaleProducts=[sku];f.backend.wholesaleRules={mixedEnabled:false};f.state.wholesaleContext={memberId:201,shopId:2,lines:[{id:sku.id,qty:48,price:sku.price}]};
  assert.equal(f.blocks('G15',form).find(b=>b.type==='fields').items[0].maxlength,200);await f.handleRemote('purchase',ctx('G15',form));
  assert.equal(f.writes[0].remark,remark.trim());assert.equal(f.writes[0].shopId,900);assert.equal(f.writes[0].destinationShopId,2);assert.equal(f.writes[0].directShip,true);assert.equal('phone' in f.writes[0],false);assert.equal('_privateDraft' in f.writes[0],false);
 }
})

test('采购超长备注和NUL不创建订单',async()=>{
  const sku={id:'wholesale-real',name:'真实批发品',spec:'24件/箱',asset:'cup',price:3500,stock:100,box_size:24,min_boxes:2};const f=fixture({responses:{'/products':[sku]}});f.state.addresses=[{name:'收货人',detail:'仓库'}];f.state.wholesaleSku=sku;f.state.wholesaleContext={memberId:201,shopId:2,lines:[{id:sku.id,qty:48,price:sku.price}]};
 for(const remark of ['🌿'.repeat(201),'备注\u0000隐藏']){await f.handleRemote('purchase',ctx('G15',{订单备注:remark}));assert.equal(f.writes.length,0);assert.match(f.toasts.at(-1),/200.*字符/)}
})

test('促销和套餐空白、NaN、无限和小数限量不提交',async()=>{
 for(const pageId of ['G52','G53']){
  const f=fixture(),form={};await f.pageData(pageId,form);Object.assign(form,{活动名称:'有效活动',套餐名称:'有效套餐',套餐商品:'sku-real:1',套餐价格:5,活动折扣:8.5});
  for(const key of ['活动库存','每人限购'])for(const invalid of ['', ' ', '.', null, undefined, NaN, Infinity, -1, 1.5, '0x10', Number.MAX_SAFE_INTEGER+1]){
   form.活动库存=10;form.每人限购=1;form[key]=invalid;await f.handleRemote(pageId==='G52'?'publish':'save',ctx(pageId,form));assert.equal(f.writes.length,0);assert.match(f.toasts.at(-1),/非负整数/);
  }
 }
})

test('促销和套餐明确零限量保留不限语义，正常整数和金额仍正确换算',async()=>{
 for(const pageId of ['G52','G53'])for(const limit of [0,3]){
  const f=fixture(),form={};await f.pageData(pageId,form);Object.assign(form,{活动名称:'有效活动',套餐名称:'有效套餐',套餐商品:'sku-real:2',套餐价格:5.25,活动折扣:8.5,活动库存:String(limit),每人限购:String(limit),原价合计:'readonly不能传'});
  await f.handleRemote(pageId==='G52'?'publish':'save',ctx(pageId,form));assert.equal(f.writes[0].quantity,limit);assert.equal(f.writes[0].perMember,limit);assert.equal('原价合计' in f.writes[0],false);
  if(pageId==='G52')assert.equal(f.writes[0].rateBps,8500);else assert.equal(f.writes[0].price,525);
  assert.match(JSON.stringify(f.blocks(pageId,form)),/0表示不限/);
 }
})

test('促销和套餐异常金额不被转换为JSON null或0',async()=>{
 for(const pageId of ['G52','G53']){
  const f=fixture(),form={};await f.pageData(pageId,form);Object.assign(form,{活动名称:'有效活动',套餐名称:'有效套餐',套餐商品:'sku-real:1',活动库存:10,每人限购:1});
  for(const invalid of ['', '.', NaN, Infinity]){form[pageId==='G52'?'活动折扣':'套餐价格']=invalid;await f.handleRemote(pageId==='G52'?'publish':'save',ctx(pageId,form));assert.equal(f.writes.length,0);}
 }
})

test('考核日期必填真实且不早于上海今天，失效日期不创建版本',async()=>{
 const f=fixture(),form={};await f.pageData('G36',form);form.方案名称='日期回归方案';
 for(const date of ['', '2026-02-30', '2000-01-01', '2101-01-01', null]){form.生效时间=date;await f.handleRemote('save',ctx('G36',form));assert.equal(f.writes.length,0);assert.match(f.toasts.at(-1),/生效日期/)}
})

test('考核上海今天可当天生效，未来日期固定上海零点而非设备时区',async()=>{
 const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10),future=new Date(Date.now()+86400000+8*3600000).toISOString().slice(0,10);
 for(const date of [today,future]){
  const f=fixture(),form={};await f.pageData('G36',form);assert.equal(form.生效时间,today);form.方案名称='生效时间回归方案';form.生效时间=date;await f.handleRemote('save',ctx('G36',form));assert.equal(f.writes[0].effectiveAt,Date.parse(date+'T00:00:00+08:00'));
  const field=f.blocks('G36',form).find(b=>b.type==='fields').items.find(i=>i.key==='生效时间');assert.equal(field.start,today);assert.equal(field.end,'2100-12-31');assert.equal(field.required,true);
 }
})

test('考核空阈值与非整数人数复购率不被当成0，明确0仍合法',async()=>{
 const f=fixture(),form={};await f.pageData('G36',form);form.方案名称='阈值回归方案';
 for(const [key,value] of [['销售业绩门槛','.'],['销售业绩门槛',''],['有效直推人数',null],['有效直推人数',1.5],['客户复购率（%）',NaN],['客户复购率（%）',1.5]]){
  Object.assign(form,{销售业绩门槛:0,有效直推人数:0,'客户复购率（%）':0});form[key]=value;await f.handleRemote('save',ctx('G36',form));assert.equal(f.writes.length,0);
 }
 Object.assign(form,{销售业绩门槛:0,有效直推人数:0,'客户复购率（%）':0});await f.handleRemote('save',ctx('G36',form));assert.equal(f.writes[0].salesThreshold,0);assert.equal(f.writes[0].directCount,0);assert.equal(f.writes[0].repeatRate,0);
})

test('新考核方案空名称不能提交',async()=>{
 const f=fixture(),form={};await f.pageData('G36',form);
 await f.handleRemote('save',ctx('G36',form));
 assert.equal(f.writes.length,0);assert.match(f.toasts.at(-1),/方案名称/);
})

test('新优惠券不预填示例业务数据，空名称不发布',async()=>{
 const f=fixture(),form={优惠券名称:'秋日焕新满减券'};await f.pageData('G51',form);
 assert.equal(form.优惠券名称,'');assert.equal(form.适用商品,'全部商品');
 await f.handleRemote('publish',ctx('G51',form));
 assert.equal(f.writes.length,0);assert.match(f.toasts.at(-1),/优惠券名称/);
})

test('G51 非法券金额、门槛、数量和有效期在请求前被拦截',async()=>{
 const f=fixture(),form={};await f.pageData('G51',form);
 const valid={优惠券名称:'点检券',优惠券类型:'满减券',使用门槛:'10',优惠金额:'1',发放数量:'2',有效期至:'2030-01-31'};
 const invalid=[
  [{优惠金额:''},/优惠金额/],
  [{优惠金额:'0'},/优惠金额/],
  [{优惠金额:'1.001'},/优惠金额/],
  [{使用门槛:'0.5'},/优惠金额/],
  [{发放数量:''},/发放数量/],
  [{发放数量:'1.5'},/发放数量/],
  [{有效期至:'2020-01-01'},/有效期/],
  [{优惠券类型:'折扣券',优惠金额:'10'},/折扣/],
  [{优惠券类型:'折扣券',优惠金额:'0'},/折扣/]
 ];
 for(const [change,message] of invalid){Object.assign(form,valid,change);await f.handleRemote('publish',ctx('G51',form));assert.equal(f.writes.length,0);assert.match(f.toasts.at(-1),message);}
 Object.assign(form,valid,{优惠券类型:'折扣券',使用门槛:'',优惠金额:'9.5'});
 await f.handleRemote('publish',ctx('G51',form));
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].rateBps,9500);assert.equal(f.writes[0].threshold,0);
})

const currencyTargets=[
 ['G36','', '销售业绩门槛','salesThreshold'],
 ['G53','组合套餐','套餐价格','price'],
 ['G53','加价购','活动门槛','threshold'],
 ['G52','满减','活动折扣','discount'],
 ['G52','满减','活动门槛','threshold'],
 ['G52','换购','活动折扣','price'],
 ['G52','换购','活动门槛','threshold'],
 ['G52','满赠','活动门槛','threshold']
]
async function currencyDraft(pageId,tab){
 const f=fixture(),form={_marketingTab:tab};await f.pageData(pageId,form);
 Object.assign(form,{方案名称:'精度回归考核',活动名称:'精度回归促销',套餐名称:'精度回归套餐',套餐商品:'sku-real:1',套餐价格:'1.50',活动折扣:tab==='满赠'?0:'1.50',活动门槛:'10.00',促销商品:'sku-real',活动商品:'sku-real',活动库存:10,每人限购:1});
 return {f,form,context:{...ctx(pageId,form),activeFilter:tab},target:pageId==='G52'?'publish':'save'};
}

test('真实金额处理器按整数元分转换0、一位两位金额及安全分边界',async()=>{
 for(const [pageId,tab,key,output] of currencyTargets)for(const [value,cents] of [[0,0],['1.50',150],[1.5,150],['0.01',1],['0.29',29],['90071992547409.91',Number.MAX_SAFE_INTEGER]]){
  const {f,form,context,target}=await currencyDraft(pageId,tab);form[key]=value;
  await f.handleRemote(target,context);assert.equal(f.writes.length,1,pageId+'/'+tab+'/'+key+'/'+value);assert.equal(f.writes[0][output],cents);
 }
})

test('真实金额处理器拒绝超2位、非白名单数值和超安全分且不改草稿',async()=>{
 for(const [pageId,tab,key] of currencyTargets){
  const {f,form,context,target}=await currencyDraft(pageId,tab),originalDocs=plain(f.docs);
  for(const invalid of ['0.001','1.500','90071992547409.92','90071992547410.00',Number.MAX_SAFE_INTEGER,'', ' ', '.', '-1', '0x10', '1e2',null,undefined,true,{},[],NaN,Infinity]){
   form[key]=invalid;await f.handleRemote(target,context);assert.equal(f.writes.length,0,pageId+'/'+tab+'/'+key+'/'+String(invalid));assert.match(f.toasts.at(-1),/最多2位小数|安全金额范围/);assert.equal(form[key],invalid);
  }
  assert.deepEqual(plain(f.docs),originalDocs);
 }
})

test('货币精度不误拦截三位折扣率，满赠金额仍固定0只读',async()=>{
 for(const tab of ['限时折扣','秒杀']){
  const {f,form,context,target}=await currencyDraft('G52',tab);form.活动折扣='8.555';await f.handleRemote(target,context);assert.equal(f.writes.length,1);assert.equal(f.writes[0].rateBps,8555);
 }
 const {f,form,context,target}=await currencyDraft('G52','满赠');form.活动折扣='0.001';await f.handleRemote(target,context);assert.equal(f.writes.length,1);assert.equal(f.writes[0].price,0);assert.equal(f.writes[0].rateBps,0);
 assert.equal(f.blocks('G52',form).find(b=>b.type==='fields').items.find(i=>i.key==='活动折扣').kind,'readonly');
})

test('M64 已读回执更新当前消息并打开本人关联订单',async()=>{
 const message={id:7,title:'订单已发货',body_text:'请查收',event_type:'ORDER_SHIPPED',reference_id:'HX7'}
 const f=fixture({responses:{'/message-read':message,'/orders/HX7':{...paidOrder(),id:'HX7'}}})
 f.state.notifications=[{id:7,read:false}]
 await f.handleRemote('message-open:7',ctx('M64',{}))
 assert.equal(f.state.notifications[0].read,true)
 assert.equal(f.state.activeOrder,'HX7')
 assert.equal(f.backend.activeOrder.id,'HX7')
 assert.deepEqual(f.navigations,['M18'])
})

test('M64 已读成功但关联订单不可读取时展示消息，不误跳旧订单',async()=>{
 const message={id:8,title:'订单已发货',body_text:'订单内容',event_type:'ORDER_SHIPPED',reference_id:'HX8'}
 const f=fixture({responses:{'/message-read':message},failures:['/orders/HX8']})
 f.state.notifications=[{id:8,read:false}]
 f.state.activeOrder='other-order'
 await f.handleRemote('message-open:8',ctx('M64',{}))
 assert.equal(f.state.notifications[0].read,true)
 assert.equal(f.state.activeOrder,'other-order')
 assert.deepEqual(f.navigations,[])
 assert.match(f.modals[0].content,/关联订单暂不可查看/)
})

test('M64 旧申请审核通知打开详情也显示中文状态',async()=>{
 const message={id:18,title:'申请处理结果：SUPPLEMENT',body_text:'申请处理结果：SUPPLEMENT',event_type:'AGENT_UPDATED'}
 const f=fixture({responses:{'/message-read':message}})
 f.state.notifications=[{id:18,read:false}]
 await f.handleRemote('message-open:18',ctx('M64',{}))
 assert.deepEqual(f.modals,[{title:'申请处理结果：待补充资料',content:'申请处理结果：待补充资料'}])
 assert.equal(f.state.notifications[0].read,true)
})

test('M64 按真实文档类型归类，评价和追评旧代理事件只显示评价消息',async()=>{
 const reference='DOC'+'a'.repeat(32)
 const notices=[
  {id:21,event_type:'AGENT_UPDATED',reference_kind:'review',reference_id:reference,title:'申请处理结果：APPROVED'},
  {id:22,event_type:'AGENT_UPDATED',reference_kind:'review_append',reference_id:reference,title:'申请处理结果：REJECTED'},
  {id:23,event_type:'SYSTEM',reference_kind:'agent_application',reference_id:reference,title:'代理申请审核通过'}
 ]
 const f=fixture({bootstrapNotifications:notices,responses:{'/message-read':{...notices[0],body_text:notices[0].title}}})
 await f.refresh()
 assert.deepEqual(f.state.notifications.map(n=>n.event),['SYSTEM','SYSTEM','AGENT_UPDATED'])
 assert.deepEqual(f.state.notifications.map(n=>n.message),['商品评价审核：审核通过','商品追评审核：审核未通过','代理申请审核通过'])
 await f.handleRemote('message-open:21',ctx('M64',{}))
 assert.deepEqual(f.modals,[{title:'商品评价审核：审核通过',content:'商品评价审核：审核通过'}])
 assert.deepEqual(f.navigations,[])
 assert.equal(f.requests.some(request=>request.url.includes('/documents/agent_application')),false)
})

test('M64 代理通知只打开本人本店当前关联申请，其它引用显示安全提示',async()=>{
 const id='DOC'+'b'.repeat(32),message={id:24,event_type:'AGENT_UPDATED',reference_kind:'agent_application',reference_id:id,title:'代理申请审核通过'}
 const own={id,kind:'agent_application',member_id:201,shop_id:2,status:'APPROVED',body:{name:'接口会员'}}
 const valid=fixture({documents:{agent_application:[own]},responses:{'/message-read':message}})
 await valid.handleRemote('message-open:24',ctx('M64',{}))
 assert.deepEqual(valid.navigations,['M31'])
 assert.equal(valid.backend.documents.agent_application[0].id,id)
 const other=fixture({documents:{agent_application:[{...own,member_id:202}]},responses:{'/message-read':message}})
 await other.handleRemote('message-open:24',ctx('M64',{}))
 assert.deepEqual(other.navigations,[])
 assert.match(other.modals[0].content,/关联申请暂不可查看/)
})

test('M64 客服通知以 support 引用打开本人留言，不依赖旧固定标题',async()=>{
 const id='DOC'+'c'.repeat(32)
 const doc={id,kind:'support',member_id:201,shop_id:2,status:'APPROVED',review_note:'处理意见',body:{question:'其他问题',message:'测试留言'}}
 const f=fixture({documents:{support:[doc]},responses:{'/message-read':{id:25,event_type:'AGENT_UPDATED',reference_kind:'support',reference_id:id,title:'客服已回复'}}})
 await f.handleRemote('message-open:25',ctx('M64',{}))
 assert.deepEqual(f.navigations,['M29'])
 assert.equal(f.backend.selectedSupportId,id)
})

test('M64 标已读响应前切账号不污染新账号消息或跳转',async()=>{
 const message={id:9,title:'原账号通知',body_text:'仅原账号可看',event_type:'SYSTEM'}
 let f
 f=fixture({responses:{'/message-read':message},onRequest:url=>{
  if(url.endsWith('/message-read')){f.backend.member={id:202};f.backend.token='other-token';f.state.notifications=[{id:9,read:false}]}
 }})
 f.state.notifications=[{id:9,read:false}]
 await f.handleRemote('message-open:9',ctx('M64',{}))
 assert.equal(f.state.notifications[0].read,false)
 assert.deepEqual(f.navigations,[])
 assert.deepEqual(f.modals,[])
 assert.match(f.toasts.at(-1),/原账号消息/)
})

test('M64 关联订单读取期间切账号不把旧订单带入新账号',async()=>{
 const message={id:10,title:'原账号订单',event_type:'ORDER_PAID',reference_id:'HX10'}
 let f
 f=fixture({responses:{'/message-read':message,'/orders/HX10':{...paidOrder(),id:'HX10'}},onRequest:url=>{
  if(url.endsWith('/orders/HX10')){f.backend.member={id:202};f.backend.token='other-token'}
 }})
 f.state.notifications=[{id:10,read:false}]
 await f.handleRemote('message-open:10',ctx('M64',{}))
 assert.equal(f.state.notifications[0].read,true)
 assert.equal(f.state.activeOrder,undefined)
 assert.equal(f.backend.activeOrder,null)
 assert.deepEqual(f.navigations,[])
 assert.deepEqual(f.modals,[])
})
