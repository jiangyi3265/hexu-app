export function withdrawal(amount,balance){
 const value=typeof amount==='string'||typeof amount==='number'?String(amount).trim():''
 if(!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value))return {error:'提现金额须为有效金额，最多2位小数'}
 const [yuanPart,fraction='']=value.split('.')
 const yuan=Number(yuanPart||0),cents=yuan*100+Number(fraction.padEnd(2,'0'))
 if(!Number.isSafeInteger(cents))return {error:'提现金额超出安全范围'}
 if(cents<100)return {error:'单次提现最低1元'}
 if(!Number.isSafeInteger(balance)||balance<0||cents>balance)return {error:'可提现余额不足'}
 const fee=Math.round(cents*0.006)
 return {cents,fee,net:cents-fee}
}
export function withdrawalAccountLabel(documents){
 const account=Array.isArray(documents)?documents.find(item=>item?.status==='APPROVED'):null
 if(!account)return '请先添加并审核结算账户'
 const body=account.body||{},name=String(body.accountName||'').trim()
 if(body.channel==='BALANCE')return ['系统余额',name].filter(Boolean).join(' · ')
 if(body.channel==='WECHAT')return ['微信零钱',name].filter(Boolean).join(' · ')
 if(body.channel==='BANK')return String(body.masked||[body.bankName,body.bank].filter(Boolean).join(' ')).trim()||'银行卡账户待核对'
 return '结算账户资料待核对'
}
export function withdrawalOutcome(status,net,demo=false){
 if(status==='PAID'&&demo)return {body:'演示到账，未发生真实转账',actual:'演示 ¥'+(net/100).toFixed(2)}
 if(status==='PAID')return {body:'渠道已确认实际付款',actual:'¥'+(net/100).toFixed(2)}
 if(status==='REJECTED'||status==='FAILED')return {body:'冻结金额已退回可提现余额',actual:'未到账'}
 if(status==='PROCESSING')return {body:'付款处理中，到账以渠道结果为准',actual:'尚未确认'}
 return {body:'尚未确认到账，预计金额¥'+(net/100).toFixed(2),actual:'尚未确认'}
}
export function orderLineDisplayAmount(order,line,money){
 if(order?.order_type==='POINTS')return order.items?.length===1?Number(order.points_used)+'积分':'积分兑换'
 const paid=Number(line.paid)
 return '¥'+money(Number.isSafeInteger(paid)&&paid>=0?paid:Number(line.unitPrice||0)*Number(line.qty||0))
}
export function orderAmountRows(order,money){
 const subtotal=Number(order?.subtotal||0),discount=Number(order?.discount||0),freight=Number(order?.freight||0),total=Number(order?.total||0)
 const pointsCash=subtotal-discount+freight-total
 const rows=[{label:'商品总价',value:'¥'+money(subtotal)},{label:'优惠金额',value:discount>0?'−¥'+money(discount):'¥0.00'}]
 if(order?.order_type!=='POINTS'&&Number(order?.points_used||0)>0)rows.push({label:'积分抵扣',value:pointsCash>0?'−¥'+money(pointsCash):'金额待核对'})
 rows.push({label:'运费',value:'¥'+money(freight)},{label:'实付款',value:'¥'+money(total)})
 return rows
}
export function afterSaleReductionRows(order,line,money){
 const gross=Number(line?.unitPrice)*Number(line?.qty),paid=Number(line?.paid)
 const fallback=Number.isSafeInteger(gross)&&Number.isSafeInteger(paid)&&gross>paid&&paid>=0?[{label:'本商品已减金额（明细待核对）',value:'−¥'+money(gross-paid)}]:[]
 if(order?.subtotal==null||order?.total==null||!Array.isArray(order?.items)||!order.items.length)return fallback
 const subtotal=Number(order.subtotal),discount=Number(order.discount??0),freight=Number(order.freight??0),total=Number(order.total),pointsUsed=Number(order.points_used??0)
 const pointsCash=subtotal-discount+freight-total
 const linesGross=order.items.reduce((sum,item)=>sum+Number(item.unitPrice)*Number(item.qty),0)
 const linesPaid=order.items.reduce((sum,item)=>sum+Number(item.paid),0)
 if(![gross,paid,subtotal,discount,freight,total,pointsUsed,pointsCash,linesGross,linesPaid].every(Number.isSafeInteger)||discount<0||pointsCash<0||pointsUsed<0||pointsCash>0&&pointsUsed===0||linesGross!==subtotal||linesPaid!==subtotal-discount-pointsCash)return fallback
 const wholeOrder=order.items.length>1,rows=[]
 if(discount>0)rows.push({label:wholeOrder?'订单优惠金额':'优惠金额',value:'−¥'+money(discount)})
 if(pointsCash>0)rows.push({label:wholeOrder?'订单积分抵扣':'积分抵扣',value:'−¥'+money(pointsCash)})
 if(wholeOrder&&rows.length)rows.push({label:'本商品实付',value:'¥'+money(paid)})
 return rows
}
export function refundDisplayAmount(refund,money){
 const value=refund?.order_type==='POINTS'?Number(refund.points_return||0)+'积分':'¥'+money(refund?.amount||0)
 return refund?.refund_type==='EXCHANGE'?'商品价值 '+value:value
}
export function redemptionPageTitle(order){
 if(!order)return '兑换结果'
 return ['PAID','SHIPPED','COMPLETED'].includes(order.rawStatus)?'兑换成功':'兑换订单'
}
export function refundReviewPresentation(type){
 if(type==='RETURN')return {title:'退货退款审核',reject:'拒绝退货',approve:'同意退货'}
 if(type==='EXCHANGE')return {title:'换货审核',reject:'拒绝换货',approve:'同意换货'}
 return null
}
export function afterSalePageTitle(type){
 return ({换货:'申请换货',退货退款:'申请退货退款',部分退款:'申请部分退款'})[type]||'申请退款'
}
export function afterSaleDetailPage(type){return type==='EXCHANGE'?'M24':'M23'}
export function managementAfterSalePage(refund){
 if(refund?.status==='WAIT_RETURN')return 'G27'
 if(refund?.refund_type==='EXCHANGE'&&['WAIT_EXCHANGE','EXCHANGE_SHIPPED','CLOSED'].includes(refund.status))return 'G28'
 return 'G26'
}
export function afterSaleStatusLabel(refund,fallback){return refund?.refund_type==='EXCHANGE'&&refund.status==='CLOSED'?'换货已完成':fallback}
export function returnTrackingSubmitted(refund){
 let returned=refund?.return_json
 if(typeof returned==='string'){try{returned=JSON.parse(returned)}catch{return false}}
 return !!(returned&&typeof returned.tracking==='string'&&returned.tracking.trim())
}
export function refundInspectionForm(refund){
 let evidence=refund?.evidence_json
 if(typeof evidence==='string'){try{evidence=JSON.parse(evidence)}catch{evidence={}}}
 const inspection=evidence?.inspection||{},received=Number(inspection.receivedQty??refund?.qty??0),good=Number(inspection.goodQty??refund?.qty??0)
 return {退回数量:received,实际验收:good,外观状态:good===0?'破损不可销售':'完好可再次销售',验收备注:inspection.note||'',uploads:Array.isArray(inspection.uploads)?[...inspection.uploads]:[]}
}
export function pointsTransfer(amount,balance,type='platform',sameShop=true,limit=1000){const n=Number(amount);if(!Number.isInteger(n)||n<=0)return{error:'请输入正整数积分'};if(n>limit)return{error:'超过单笔'+limit+'积分上限'};if(n>balance)return{error:'可用积分不足'};if(type==='shop'&&!sameShop)return{error:'商城积分仅限本商城内转赠'};return{amount:n,balance:balance-n}}
export function settlement(quantity=1,rate=0.03){return{retail:1000*quantity,peer:Math.round(1000*quantity*rate),center:200*quantity,ownerGross:200*quantity,ownerCost:-Math.round(1000*quantity*rate),ownerNet:200*quantity-Math.round(1000*quantity*rate)}}
export function validPhone(value){return /^1[3-9]\d{9}$/.test(value)}

