import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {loadPure as pure} from './helpers/pure-module.mjs'

const source=fs.readFileSync(new URL('../data/backend.js',import.meta.url),'utf8')
const helpers=Object.assign({},...await Promise.all(['profile.js','payment-clock.js','compliance.js','reviews.js','datetime.js'].map(pure)))
const plain=value=>JSON.parse(JSON.stringify(value))
const file='FILE'+'a'.repeat(32)
const order={id:'own-order',shop_id:900,buyer_id:201,status:'COMPLETED',refunded:0,total:2300,subtotal:2300,items:[{id:91,sku_id:'real-sku',name:'实际订单商品',qty:1,unit_price:2300}]}
const context={shopId:900,orderId:order.id,skuId:'real-sku',reviewAllowed:true,parent:null,submission:null,appendSubmission:null}
function fixture({purchase=order,otherPurchases=[],reviewContext=context,reviewContextForRequest,contextError='',receiveError='',reviews=[]}={}){
 let reviewError=contextError
 let delayReviews=false
 const delayedReviews=[]
 const reads=[],writes=[],uploads=[],toasts=[],navigations=[],storage=new Map(),products=[],state={activeOrder:purchase.id,reviewSku:'real-sku',changes:{},cart:[],favorites:[],orders:[],notifications:[],addresses:[]};
 const member={id:201,name:'本人'},shop={id:2,kind:'DEALER',name:'当前浏览店'},account={platformPoints:{available:0},shopPoints:{available:0},wallet:{available:0},refunds:[],withdrawals:[],earnings:[]};
 const uni={getStorageSync:key=>storage.get(key),setStorageSync:(key,value)=>storage.set(key,value),removeStorageSync:key=>storage.delete(key),showModal:o=>o.success({confirm:true}),request:o=>{
  reads.push({url:o.url,data:plain(o.data||{}),method:o.method});let data;
  if(o.url.endsWith('/bootstrap'))data={member,shop,account,agent:null,storefront:{decoration:{}},products:[{id:'real-sku',name:'当前店同编号商品',asset:'FILE'+'b'.repeat(32),spec:'当前店规格',price:9999,stock:10}],orders:[],cart:[],favorites:[],addresses:[],notifications:[]};
  else if(o.url.endsWith('/shops'))data=[shop,{id:900,kind:'WHOLESALE',name:'实际订单商城'}];
  else if(o.url.endsWith('/coupons'))data=[];
  else if(o.url.includes('/orders/'))data=[purchase,...otherPurchases].find(item=>o.url.endsWith('/orders/'+item.id));
  else if(o.url.endsWith('/review-context')){if(delayReviews){delayedReviews.push({request:o,data:reviewContextForRequest?reviewContextForRequest(plain(o.data)):reviewContext});return}if(reviewError){o.success({statusCode:400,data:{code:400,msg:reviewError}});return}data=reviewContextForRequest?reviewContextForRequest(plain(o.data)):reviewContext}
  else if(o.url.endsWith('/reviews'))data=reviews;
  else if(o.url.endsWith('/order-receive')){if(receiveError){o.success({statusCode:400,data:{code:400,msg:receiveError}});return}writes.push({operation:'order-receive',...plain(o.data)});purchase={...purchase,status:'COMPLETED'};data=purchase;}
  else if(o.url.endsWith('/document-save')){writes.push(plain(o.data));data={id:'saved-review',status:'PENDING'}}
  else if(o.url.endsWith('/policies'))data={LOGIN:{version:'real-policy-v1'}};
  else {o.success({statusCode:400,data:{code:400,msg:'Unexpected endpoint '+o.url}});return}
  o.success({statusCode:200,data:{code:200,data:plain(data)}});
 },uploadFile:o=>{uploads.push(plain(o.formData));o.success({data:JSON.stringify({code:200,data:{id:file}})})}};
 const sandbox={...helpers,reactive:value=>value,state,products,persist:()=>{},toast:s=>toasts.push(s),navigate:s=>navigations.push(s),money:n=>(Number(n)/100).toFixed(2),uni,getCurrentPages:()=>[],URLSearchParams,location:{search:'',hash:''},Date,Math,Promise,setTimeout,clearTimeout};vm.createContext(sandbox);
 vm.runInContext(source.replace(/^import .*$/mg,'').replace(/export\s*\{[^}]*\}/g,'').replace(/export /g,'').replace(/import\.meta\.env/g,'({DEV:true,VITE_HEXU_API:"http://127.0.0.1:8088"})')+'\nglobalThis.api={backend,pageData,handleRemote,liveBlocks,uploadAttachment,selectOrder}',sandbox);
 Object.assign(sandbox.api.backend,{ready:true,shopId:2,catalogShopId:2,token:'real-test-token',member,shopInfo:shop,account});
 return {...sandbox.api,state,reads,writes,uploads,toasts,navigations,delayedReviews,setReviewError:value=>{reviewError=value},delayReviewReads:()=>{delayReviews=true},resolveReview:(index,error='')=>{const held=delayedReviews[index];assert.ok(held);held.request.success(error?{statusCode:400,data:{code:400,msg:error}}:{statusCode:200,data:{code:200,data:plain(held.data)}})}};
}
const ctx=form=>({pageId:'M10',form,validate:()=>true})
const blocks=[{type:'product'},{type:'rating'},{type:'fields',items:[{key:'评价内容'}]},{type:'notice'},{type:'reviews'}]
async function waitForReviewReads(f,count){for(let i=0;i<40&&f.delayedReviews.length<count;i++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(f.delayedReviews.length,count)}

test('首评补件提示显示本人的真实审核意见和空意见后备说明',async()=>{
 for(const note of ['请补充使用时间和杯盖照片','']){
  const submission={id:'own-supplement',status:'SUPPLEMENT',review_note:note,body:{orderId:order.id,skuId:'real-sku',rating:4,content:'原首评',uploads:[]}},f=fixture({reviewContext:{...context,submission}}),form={};await f.pageData('M10',form);
  const notice=f.liveBlocks('M10',blocks,form).find(b=>b.type==='notice');assert.equal(notice.title,'评价待补充');assert.equal(notice.body,note||'请补充评价文字或凭证，提交后将重新审核。');
 }
})

test('追评补件仅展示追加记录意见，不沿用首评意见',async()=>{
 const parent={id:'own-parent',mine:true,orderId:order.id,skuId:'real-sku',appendAllowed:false,appendSupplementAllowed:true,appendStatus:'SUPPLEMENT',appendId:'child'},f=fixture({reviewContext:{...context,reviewAllowed:false,parent,submission:{id:parent.id,status:'APPROVED',review_note:'首评旧意见',body:{orderId:order.id,skuId:'real-sku'}},appendSubmission:{id:'child',status:'SUPPLEMENT',review_note:'请提供追加体验日期',body:{orderId:order.id,skuId:'real-sku',parentId:parent.id,content:'待补追评',uploads:[]}}}}),form={};f.state.reviewParent=parent.id;await f.pageData('M10',form);
 const notice=f.liveBlocks('M10',blocks,form).find(b=>b.type==='notice');assert.equal(notice.title,'追评待补充');assert.equal(notice.body,'请提供追加体验日期');assert.doesNotMatch(JSON.stringify(f.liveBlocks('M10',blocks,form)),/首评旧意见/);
})

test('缺失或失配本人上下文不泄露缓存补件审核意见',async()=>{
 const f=fixture(),form={};await f.pageData('M10',form);f.backend.reviewSubmission={id:'other-review',status:'SUPPLEMENT',review_note:'缓存私人意见',body:{orderId:order.id,skuId:'real-sku'}};
 for(const current of [null,{...context,orderId:'other-order'},{...context,skuId:'other-sku'},{...context,shopId:2}]){f.backend.reviewContext=current;const rendered=f.liveBlocks('M10',blocks,form);assert.match(rendered[0].title,/上下文/);assert.doesNotMatch(JSON.stringify(rendered),/缓存私人意见/)}
 f.backend.reviewContext=context;f.backend.reviewSubmission.body.orderId='other-order';assert.doesNotMatch(JSON.stringify(f.liveBlocks('M10',blocks,form)),/缓存私人意见/);
})

test('M10定向本人订单上下文，不扫描公开500条或本人200条文档',async()=>{
 const f=fixture(),form={};await f.pageData('M10',form);
 const read=f.reads.find(r=>r.url.endsWith('/review-context'));assert.deepEqual(read.data,{shopId:900,orderId:order.id,skuId:'real-sku'});assert.equal(f.reads.some(r=>r.url.includes('/documents/')||r.url.endsWith('/reviews')),false);
 assert.equal(f.backend.reviewContext.shopId,900);assert.equal(form.评价内容,'');form.评价内容='真实体验';await f.handleRemote('review',ctx(form));
 assert.equal(f.writes[0].shopId,900);assert.equal(f.writes[0].orderId,order.id);assert.equal(f.writes[0].skuId,'real-sku');assert.equal(f.backend.shopId,2);
})
test('M10同一评价重读保留上传组件和图片草稿，失败或换身份立即撤下旧上下文',async()=>{
 const f=fixture(),form={};await f.pageData('M10',form)
 const uploadBlocks=[...blocks,{type:'upload',title:'上传图片'}],firstContext=f.backend.reviewContext
 form.uploads=[file]
 const reload=f.pageData('M10',form)
 assert.equal(f.backend.reviewContext,firstContext)
 assert.equal(f.liveBlocks('M10',uploadBlocks,form).find(block=>block.type==='upload')?.disabled,true)
 await reload
 assert.equal(f.liveBlocks('M10',uploadBlocks,form).find(block=>block.type==='upload')?.disabled,undefined)
 assert.deepEqual(plain(form.uploads),[file])
 f.setReviewError('评价上下文读取失败')
 const failed=f.pageData('M10',form)
 assert.ok(f.backend.reviewContext)
 await failed
 assert.equal(f.backend.reviewContext,null)
 assert.match(f.backend.actionPageErrors.M10,/读取失败/)

 const other=fixture(),otherForm={};await other.pageData('M10',otherForm)
 other.backend.member={id:202}
 const changed=other.pageData('M10',otherForm)
 assert.equal(other.backend.reviewContext,null)
 await changed

 const switched=fixture(),switchedForm={};await switched.pageData('M10',switchedForm)
 switched.state.activeOrder='another-order'
 const switchedLoad=switched.pageData('M10',switchedForm)
 assert.equal(switched.backend.reviewContext,null)
 await switchedLoad
})
for(const oldFailure of [false,true])test(`M10旧评价请求${oldFailure?'失败':'成功'}晚于新订单时不覆盖新上下文`,async()=>{
 const second={...order,id:'second-order'},f=fixture({otherPurchases:[second],reviewContextForRequest:data=>({...context,orderId:data.orderId,skuId:data.skuId})}),firstForm={},secondForm={}
 f.delayReviewReads()
 const first=f.pageData('M10',firstForm)
 await waitForReviewReads(f,1)
 f.state.activeOrder=second.id
 const latest=f.pageData('M10',secondForm)
 await waitForReviewReads(f,2)
 f.resolveReview(1)
 await latest
 assert.equal(f.backend.reviewContext.orderId,second.id)
 assert.equal(f.backend.pageLoading.M10,0)
 assert.equal(f.liveBlocks('M10',[...blocks,{type:'upload'}],secondForm).find(block=>block.type==='upload')?.disabled,undefined)
 f.resolveReview(0,oldFailure?'旧请求读取失败':'')
 await first
 assert.equal(f.backend.reviewContext.orderId,second.id)
 assert.equal(f.backend.actionPageErrors.M10,'')
 assert.equal(firstForm._reviewScope,undefined)
 assert.equal(secondForm._reviewScope!==undefined,true)
})
test('跨店评价上传和提交后的M09都使用实际订单商城和商品快照',async()=>{
 const f=fixture(),form={};await f.pageData('M10',form);await assert.rejects(f.uploadAttachment('/local.png','REVIEW'),/重新读取/);
 await f.uploadAttachment('/local.png','REVIEW',900);await f.uploadAttachment('/identity.png','IDENTITY');assert.deepEqual(f.uploads,[{shopId:900,purpose:'REVIEW'},{shopId:2,purpose:'IDENTITY'}]);
 form.评价内容='实际采购体验';form.uploads=[file];await f.handleRemote('review',ctx(form));await f.pageData('M09',{});
 assert.deepEqual(f.reads.findLast(r=>r.url.endsWith('/reviews')).data,{shopId:900,skuId:'real-sku'});assert.equal(f.backend.shopId,2);
 const product=f.liveBlocks('M09',blocks).find(b=>b.type==='product');assert.equal(product.name,'实际订单商品');assert.equal(product.price,'23.00');assert.equal(f.writes[0].uploads[0],file);
 await f.handleRemote('M09',{pageId:'M05',form:{}});assert.equal(f.state.reviewBrowse,null);await f.pageData('M09',{});assert.deepEqual(f.reads.findLast(r=>r.url.endsWith('/reviews')).data,{shopId:2,skuId:'real-sku'});assert.equal(f.liveBlocks('M09',blocks).find(b=>b.type==='product').name,'当前店同编号商品');
})
test('指定父评价缺失明确失败，保持追评状态而不静默首评',async()=>{
 const f=fixture({contextError:'原评价不存在、未公开或不属于该订单商品'}),form={评价内容:'旧输入'};f.state.reviewParent='missing-parent';f.backend.reviewParent={id:'stale-parent'};
 await f.pageData('M10',form);assert.equal(f.state.reviewParent,'missing-parent');assert.equal(f.backend.reviewContext,null);assert.equal(f.backend.reviewParent,null);assert.match(f.backend.actionPageErrors.M10,/原评价不存在/);
 await f.handleRemote('review',ctx(form));assert.equal(f.writes.length,0);await assert.rejects(f.uploadAttachment('/local.png','REVIEW',900),/重新读取/);assert.match(f.liveBlocks('M10',blocks,form)[0].title,/无法读取/);
})
test('定向补充首评按原id回显与提交，跨订单记录不能复用',async()=>{
 const submission={id:'old-supplement',status:'SUPPLEMENT',body:{orderId:order.id,skuId:'real-sku',content:'原意见',rating:4,uploads:[file]}};
 const f=fixture({reviewContext:{...context,submission}}),form={};await f.pageData('M10',form);assert.equal(form.评价内容,'原意见');assert.equal(form.rating,4);assert.deepEqual(plain(form.uploads),[file]);
 form.评价内容='首评补充后的新内容';form.rating=2;form.uploads=[];await f.handleRemote('review',ctx(form));assert.equal(f.writes[0].id,'old-supplement');assert.equal(f.writes[0].content,'首评补充后的新内容');assert.equal(f.writes[0].rating,2);assert.deepEqual(f.writes[0].uploads,[]);
 const invalid=fixture({reviewContext:{...context,orderId:'other-order'}});await invalid.pageData('M10',{});await invalid.handleRemote('review',ctx({评价内容:'不得错单',rating:5}));assert.equal(invalid.writes.length,0);assert.equal(invalid.backend.reviewContext,null);
})
test('退款后的SUPPLEMENT不能凭状态绕过显式追加资格',async()=>{
 const parent={id:'own-parent',mine:true,orderId:order.id,skuId:'real-sku',appendAllowed:false,appendSupplementAllowed:false,appendStatus:'SUPPLEMENT',appendId:'child'};
 const f=fixture({purchase:{...order,refunded:1},reviewContext:{...context,reviewAllowed:false,parent,appendSubmission:{id:'child',status:'SUPPLEMENT',body:{orderId:order.id,skuId:'real-sku',parentId:parent.id,content:'补充',uploads:[]}}},reviews:[parent]}),form={};f.state.reviewParent=parent.id;
 await f.pageData('M10',form);await f.handleRemote('review',ctx(form));assert.equal(f.writes.length,0);assert.match(f.liveBlocks('M10',blocks,form)[0].title,/退款/);
 f.backend.reviews=[parent];await f.handleRemote('review-append:'+parent.id,{pageId:'M09',form});assert.equal(f.navigations.includes('M10'),false);assert.match(f.toasts.at(-1),/不可追加/);
})
test('真实可补充追评复用指定child id，待审核不能重提',async()=>{
 const parent={id:'own-parent',mine:true,orderId:order.id,skuId:'real-sku',appendAllowed:false,appendSupplementAllowed:true,appendStatus:'SUPPLEMENT',appendId:'child'};
 const f=fixture({reviewContext:{...context,reviewAllowed:false,parent,appendSubmission:{id:'child',status:'SUPPLEMENT',body:{orderId:order.id,skuId:'real-sku',parentId:parent.id,content:'原补充',uploads:[file]}}}}),form={};f.state.reviewParent=parent.id;
 await f.pageData('M10',form);assert.equal(f.reads.find(r=>r.url.endsWith('/review-context')).data.parentId,parent.id);assert.equal(form.评价内容,'原补充');form.评价内容='已补完整';form.uploads=[];await f.handleRemote('review',ctx(form));assert.equal(f.writes[0].id,'child');assert.equal(f.writes[0].kind,'review_append');assert.equal(f.writes[0].shopId,900);assert.equal(f.writes[0].content,'已补完整');assert.deepEqual(f.writes[0].uploads,[]);
 const pending=fixture({reviewContext:{...context,reviewAllowed:false,submission:{id:'pending',status:'PENDING',body:{orderId:order.id,skuId:'real-sku'}}}});await pending.pageData('M10',{});await pending.handleRemote('review',ctx({评价内容:'重复',rating:5}));assert.equal(pending.writes.length,0);
})
test('未登录M01仍展示原登录块，协议内容保持真实读取',async()=>{
 const f=fixture();f.backend.guest=true;f.backend.ready=false;f.backend.pageLoading.M01=1;const login=[{type:'hero',title:'原登录布局'}];assert.deepEqual(f.liveBlocks('M01',login),login);
 await f.pageData('M01',{});assert.equal(f.backend.policies.LOGIN.version,'real-policy-v1');assert.deepEqual(f.liveBlocks('M01',login),login);
})
test('跨店M10和M09只用实际订单行图片规格，点击商品回原订单',async()=>{
 const image='FILE'+'c'.repeat(32),purchase={...order,items:order.items.map(line=>({...line,asset:image,spec:'实际订单商城规格'}))},f=fixture({purchase}),form={};await f.pageData('M10',form);
 const product=f.liveBlocks('M10',blocks,form).find(b=>b.type==='product');assert.equal(product.product.asset,image);assert.equal(product.product.spec,'实际订单商城规格');assert.equal(product.target,'review-order');
 await f.handleRemote(product.target,ctx(form));assert.equal(f.navigations.at(-1),'M18');assert.equal(f.state.activeOrder,order.id);assert.equal(f.navigations.includes('M05'),false);
 await f.handleRemote('product-reviews:real-sku',ctx(form));assert.equal(f.state.reviewBrowse.shopId,900);await f.pageData('M09',{});const publicProduct=f.liveBlocks('M09',blocks).find(b=>b.type==='product');assert.equal(publicProduct.product.asset,image);assert.equal(publicProduct.product.spec,'实际订单商城规格');assert.equal(publicProduct.target,'review-order');
 await f.handleRemote(publicProduct.target,{pageId:'M09',form:{}});assert.equal(f.navigations.at(-1),'M18');assert.equal(f.backend.shopId,2);
})
test('订单图片规格缺失为空，不借用当前店catalog；本店正常商品购买入口不变',async()=>{
 const f=fixture(),form={};await f.pageData('M10',form);const product=f.liveBlocks('M10',blocks,form).find(b=>b.type==='product');assert.equal(product.product.asset,'');assert.equal(product.product.spec,'');
 await f.handleRemote('product-reviews:real-sku',ctx(form));await f.pageData('M09',{});const displayed=f.liveBlocks('M09',blocks).find(b=>b.type==='product');assert.equal(displayed.product.asset,'');assert.equal(displayed.product.spec,'');
 const own=fixture({purchase:{...order,shop_id:2},reviewContext:{...context,shopId:2}}),ownForm={};await own.pageData('M10',ownForm);assert.equal(own.liveBlocks('M10',blocks,ownForm).find(b=>b.type==='product').target,'product:real-sku');
 await own.handleRemote('product-reviews:real-sku',ctx(ownForm));await own.pageData('M09',{});assert.equal(own.liveBlocks('M09',blocks).find(b=>b.type==='product').target,'product:real-sku');
})
test('选本人订单明确重置首评状态，同订单重选可预测且管理选单不改会员状态',()=>{
 const f=fixture(),selected={...order,rawStatus:'COMPLETED',items:[{id:'real-first',sku_id:'real-first'},{id:'real-second',sku_id:'real-second'}]};f.state.activeOrder='previous-order';f.state.reviewParent='previous-parent';f.state.reviewSku='previous-sku';
 f.selectOrder(selected);assert.equal(f.state.activeOrder,order.id);assert.equal(f.state.reviewParent,null);assert.equal(f.state.reviewSku,'real-first');assert.equal(f.navigations.at(-1),'M18');
 f.state.reviewParent='same-order-append';f.state.reviewSku='real-second';f.selectOrder(selected);assert.equal(f.state.reviewParent,null);assert.equal(f.state.reviewSku,'real-first');
 f.state.reviewParent='member-parent';f.state.reviewSku='member-sku';f.selectOrder({id:'staff-order',items:[{id:'staff-sku'}]},true);assert.equal(f.state.managementOrder,'staff-order');assert.equal(f.state.activeOrder,order.id);assert.equal(f.state.reviewParent,'member-parent');assert.equal(f.state.reviewSku,'member-sku');assert.equal(f.navigations.at(-1),'G22');
})
test('真实收货成功清旧追评并从服务端首SKU进入首评，失败不降级追评上下文',async()=>{
 const f=fixture({purchase:{...order,status:'SHIPPED'}});f.backend.activeOrder={...order,rawStatus:'SHIPPED'};f.state.reviewParent='older-parent';f.state.reviewSku='older-sku';await f.handleRemote('receive',{pageId:'M18',form:{}});
 assert.equal(f.writes[0].operation,'order-receive');assert.equal(f.writes[0].id,order.id);assert.equal(f.state.reviewParent,null);assert.equal(f.state.reviewSku,'real-sku');assert.equal(f.navigations.at(-1),'M10');await f.pageData('M10',{});assert.equal(f.reads.findLast(r=>r.url.endsWith('/review-context')).data.parentId,undefined);
 const rejected=fixture({purchase:{...order,status:'SHIPPED'},receiveError:'此订单暂不可收货'});rejected.backend.activeOrder={...order,rawStatus:'SHIPPED'};rejected.state.reviewParent='preserved-parent';rejected.state.reviewSku='preserved-sku';await rejected.handleRemote('receive',{pageId:'M18',form:{}});assert.equal(rejected.state.reviewParent,'preserved-parent');assert.equal(rejected.state.reviewSku,'preserved-sku');assert.equal(rejected.navigations.includes('M10'),false);assert.match(rejected.toasts.at(-1),/不可收货/);
})
