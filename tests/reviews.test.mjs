import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {loadPure} from './helpers/pure-module.mjs'
const {filterReviews,reviewPayload,ratingLabel,reviewContextAllowed,reviewButtonLabel,reviewTimeLabel}=await loadPure('reviews.js')
const {dateTimeLabel}=await loadPure('datetime.js')

test('评价时间显示本地年月日时分，不直接露出ISO；纯日期保留原日历日期',()=>{
 const value='2026-09-27T13:44:55.000-04:00'
 assert.equal(reviewTimeLabel(value),dateTimeLabel(value,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}))
 assert.doesNotMatch(reviewTimeLabel(value),/T|\.000|-04:00/)
 assert.equal(reviewTimeLabel('2026-09-27'),'2026-09-27')
 assert.equal(reviewTimeLabel(' 2024-02-29 '),'2024-02-29')
 for(const invalid of [null,undefined,'','bad','2025-02-29']) assert.equal(reviewTimeLabel(invalid),'—')
})
test('首评与追评日期均接入格式化，文本和图片仍按真实记录展示',()=>{
 const source=fs.readFileSync(new URL('../components/UiBlock.vue',import.meta.url),'utf8')
 assert.match(source,/reviewTimeLabel\(review\.createdAt\)/)
 assert.match(source,/reviewTimeLabel\(append\.createdAt\)/)
 assert.doesNotMatch(source,/\{\{(?:review|append)\.createdAt\}\}/)
})

test('最新评价按真实带时区时间排序，无效时间排最后且不改源数组',()=>{
 const rows=[{id:'invalid',createdAt:'not-a-date'},{id:'older',createdAt:'2026-09-27T14:00:00.000-04:00'},{id:'newer',createdAt:'2026-09-28T02:01:00.000+08:00'}]
 assert.deepEqual(filterReviews(rows,'最新').map(x=>x.id),['newer','older','invalid'])
 assert.equal(rows[0].id,'invalid')
})
test('审核按钮文案区分首评、追评、待审核与已通过，不与真实状态矛盾',()=>{
 const context={submission:{status:'APPROVED'},appendSubmission:{status:'PENDING'}}
 assert.equal(reviewButtonLabel(context,'',true),'评价已审核通过')
 assert.equal(reviewButtonLabel(context,'parent',true),'追评已提交，等待审核')
 assert.equal(reviewButtonLabel({...context,appendSubmission:{status:'APPROVED'}},'parent',true),'追评已审核通过')
 assert.equal(reviewButtonLabel(context,'parent',false),'提交追评')
 assert.equal(reviewButtonLabel(context,'',false),'提交评价')
 assert.equal(reviewButtonLabel(null,'',true),'当前评价不可提交')
})
test('首评禁止不误禁追评，缺失或不同上下文不可提交',()=>{
 const parent={id:'approved-review',mine:true,appendAllowed:true}
 const context={reviewAllowed:false,parent}
 assert.equal(reviewContextAllowed(context),false)
 assert.equal(reviewContextAllowed(context,parent.id),true)
 assert.equal(reviewContextAllowed({...context,parent:{...parent,appendAllowed:false,appendSupplementAllowed:true}},parent.id),true)
 for(const invalid of [null,{}, {...context,parent:{...parent,mine:false}}, {...context,parent:{...parent,appendAllowed:false}}, {...context,parent:{...parent,id:'other-review'}}])assert.equal(reviewContextAllowed(invalid,parent.id),false)
 assert.equal(reviewContextAllowed({reviewAllowed:true}),true)
})
test('评分文案与真实星数同步，一般和差评不误标满意',()=>{
 assert.deepEqual([1,2,3,4,5].map(ratingLabel),['很不满意','不满意','一般','满意','非常满意'])
 assert.equal(ratingLabel(0),'请选择评分')
})
const order={id:'order-real',rawStatus:'COMPLETED',items:[{id:'sku-real'}]},file='FILE'+'a'.repeat(32),form={评价内容:'  真实评价  ',rating:5,uploads:[file],phone:'私密字段',_secret:'不得提交'}
test('有图/追评/最新筛选只取公开图片和审核后追加，不修改源数组',()=>{
 const reviews=[{id:1,createdAt:'2026-01-01',images:[]},{id:2,createdAt:'2026-02-01',images:[file]},{id:3,createdAt:'2026-03-01',appends:[{images:[file]}]}]
 assert.deepEqual(filterReviews(reviews,'有图').map(r=>r.id),[2,3])
 assert.deepEqual(filterReviews(reviews,'追评').map(r=>r.id),[3])
 assert.deepEqual(filterReviews(reviews,'最新').map(r=>r.id),[3,2,1]);assert.equal(reviews[0].id,1)
})
test('首评只提交规范字段，不泄露整个form',()=>{
 assert.deepEqual(reviewPayload(form,order,'sku-real'),{kind:'review',orderId:order.id,skuId:'sku-real',rating:5,content:'真实评价',uploads:[file],anonymous:false})
 for(const invalid of [{评价内容:''},{评价内容:'字'.repeat(501)},{rating:0},{rating:1.5},{uploads:[file,file]},{uploads:['其他附件']}])assert.throws(()=>reviewPayload({...form,...invalid},order,'sku-real'))
 assert.throws(()=>reviewPayload(form,{...order,rawStatus:'PAID'},'sku-real'));assert.throws(()=>reviewPayload(form,order,'other-sku'))
})
test('只有本人已审核且可追加的同订单同SKU允许追评',()=>{
 const parent={id:'review-real',mine:true,appendAllowed:true,orderId:order.id,skuId:'sku-real'}
 assert.deepEqual(reviewPayload(form,order,'sku-real',parent),{kind:'review_append',parentId:parent.id,orderId:order.id,skuId:'sku-real',content:'真实评价',uploads:[file]})
 for(const invalid of [{mine:false},{appendAllowed:false},{orderId:'other-order'},{skuId:'other-sku'}])assert.throws(()=>reviewPayload(form,order,'sku-real',{...parent,...invalid}))
})
test('首评追评拒绝Unicode纯空白及C0/C1，trim前拒绝边缘非法控制符',()=>{
 const parent={id:'review-real',mine:true,appendAllowed:true,orderId:order.id,skuId:'sku-real'}
 const invalid=['\u3000','\u00a0','\u2003','\ufeff',' \u3000\u00a0\ufeff\n\r\t ','\u0001真实评价','真实评价\u0085']
 for(let point=0;point<=0x9f;point++)if((point<=0x1f||point>=0x7f)&&![9,10,13].includes(point))invalid.push('真实'+String.fromCharCode(point)+'评价')
 for(const value of invalid)for(const context of [null,parent])assert.throws(()=>reviewPayload({...form,评价内容:value},order,'sku-real',context))
})
test('首评追评保留正常LF/CRLF/tab及500个Unicode字符边界',()=>{
 const parent={id:'review-real',mine:true,appendAllowed:true,orderId:order.id,skuId:'sku-real'},content='🌿'.repeat(490)+'\n第二行\r\n\t末行🌿'
 assert.equal([...content].length,500)
 for(const context of [null,parent]){
  assert.equal(reviewPayload({...form,评价内容:'\u3000\ufeff'+content+'\u00a0'},order,'sku-real',context).content,content)
  assert.throws(()=>reviewPayload({...form,评价内容:content+'🌿'},order,'sku-real',context))
 }
})
test('补充首评/追评复用本人原申请，不产生重复新申请',()=>{
 const submission={id:'review-supplement',status:'SUPPLEMENT',body:{parentId:'review-real',orderId:order.id,skuId:'sku-real'}}
 assert.equal(reviewPayload(form,order,'sku-real',null,submission).id,submission.id)
 const parent={id:'review-real',mine:true,appendAllowed:false,appendSupplementAllowed:true,appendStatus:'SUPPLEMENT',appendId:submission.id,orderId:order.id,skuId:'sku-real'}
 assert.equal(reviewPayload(form,order,'sku-real',parent,submission).id,submission.id)
 assert.throws(()=>reviewPayload(form,order,'sku-real',parent,{...submission,body:{parentId:'different-review'}}))
 for(const change of [{appendSupplementAllowed:false},{appendSupplementAllowed:undefined},{appendId:'other-submission'}])assert.throws(()=>reviewPayload(form,order,'sku-real',{...parent,...change},submission))
 assert.throws(()=>reviewPayload(form,{...order,refunded:1},'sku-real',parent,submission));assert.throws(()=>reviewPayload(form,{...order,refunded:1},'sku-real'))
 assert.throws(()=>reviewPayload(form,order,'sku-real',null,{...submission,body:{orderId:'different-order',skuId:'sku-real'}}))
})
