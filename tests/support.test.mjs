import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const {supportPayload,visibleSupportRecords}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('../data/support.js',import.meta.url),'utf8')).toString('base64'))
const file='FILE'+'a'.repeat(32),base={question:'其他问题',message:'  真实留言\n第二行\t说明  ','关联订单':' HX真实订单 ',uploads:[file]}
test('客服提交只保留规范业务字段，不发送整个表单或内部身份',()=>{
 assert.deepEqual(supportPayload({...base,rank:3,memberId:1,shopId:99,kind:'profile',phone:'隐私',_key:'缓存'}),{question:'其他问题',message:'真实留言\n第二行\t说明',orderId:'HX真实订单',uploads:[file]})
 assert.equal(supportPayload({...base,'关联订单':''}).orderId,'')
})
test('留言允许正常多行，拒空值、超500字符、非法类型和控制字符',()=>{
 assert.equal([...supportPayload({...base,message:'🌱'.repeat(500)}).message].length,500)
 for(const change of [{message:''},{message:' '},{message:[]},{message:'字'.repeat(501)},{message:'非法\u0000字'},{message:'非法\u0085字'},{question:'伪造类型'},{'关联订单':[]},{'关联订单':'HX\n订单'}])assert.throws(()=>supportPayload({...base,...change}))
})
test('留言图片最多9个有效唯一附件，不接受临时路径和重复',()=>{
 for(const uploads of [[file,file],['/tmp/private.png'],Array(10).fill(file)])assert.throws(()=>supportPayload({...base,uploads}))
 assert.equal(supportPayload({...base,uploads:[]}).uploads.length,0)
})
test('客服文档按服务端身份和商城双重限定，拒绝跨主体列表泄露',()=>{
 const own={kind:'support',member_id:201,shop_id:2,status:'APPROVED'}
 assert.deepEqual(visibleSupportRecords([own,{...own,member_id:202},{...own,shop_id:3},{...own,status:'DELETED'},{...own,kind:'agent_application'}],201,2),[own])
 assert.throws(()=>visibleSupportRecords({},201,2))
})
