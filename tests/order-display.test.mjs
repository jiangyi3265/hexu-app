import test from 'node:test'
import assert from 'node:assert/strict'
import {orderLineDisplayAmount,orderAmountRows,afterSaleReductionRows,refundDisplayAmount,redemptionPageTitle,refundReviewPresentation,returnTrackingSubmitted,refundInspectionForm,afterSalePageTitle,afterSaleDetailPage,managementAfterSalePage,afterSaleStatusLabel} from '../data/business.mjs'

test('M18 从订单金额守恒拆分营销优惠与积分现金抵扣，兼容不同积分汇率',()=>{
 const money=cents=>(cents/100).toFixed(2)
 const values=order=>Object.fromEntries(orderAmountRows(order,money).map(row=>[row.label,row.value]))
 assert.deepEqual(values({order_type:'DEALER_RETAIL',subtotal:2990,discount:0,points_used:598,freight:0,total:2392}),{商品总价:'¥29.90',优惠金额:'¥0.00',积分抵扣:'−¥5.98',运费:'¥0.00',实付款:'¥23.92'})
 assert.deepEqual(values({order_type:'DEALER_RETAIL',subtotal:2990,discount:500,points_used:200,freight:800,total:3190}),{商品总价:'¥29.90',优惠金额:'−¥5.00',积分抵扣:'−¥1.00',运费:'¥8.00',实付款:'¥31.90'})
 assert.equal('积分抵扣' in values({order_type:'DEALER_RETAIL',subtotal:2990,discount:500,points_used:0,freight:0,total:2490}),false)
 assert.equal('积分抵扣' in values({order_type:'POINTS',subtotal:0,discount:0,points_used:1000,freight:0,total:0}),false)
})

test('M21 单商品售后区分仅积分、券和积分叠加及无抵扣，退款额仍按商品实付',()=>{
 const money=cents=>(cents/100).toFixed(2)
 const rows=(order,paid)=>afterSaleReductionRows({...order,items:[{unitPrice:2990,qty:1,paid}]},{unitPrice:2990,qty:1,paid},money)
 assert.deepEqual(rows({subtotal:2990,discount:0,points_used:598,freight:0,total:2392},2392),[{label:'积分抵扣',value:'−¥5.98'}])
 assert.deepEqual(rows({subtotal:2990,discount:500,points_used:200,freight:800,total:3190},2390),[{label:'优惠金额',value:'−¥5.00'},{label:'积分抵扣',value:'−¥1.00'}])
 assert.deepEqual(rows({subtotal:2990,discount:500,points_used:0,freight:0,total:2490},2490),[{label:'优惠金额',value:'−¥5.00'}])
 assert.deepEqual(rows({subtotal:2990,discount:0,points_used:0,freight:0,total:2990},2990),[])
})

test('M21 多商品只展示全单券和积分金额，不虚构当前商品分摊',()=>{
 const money=cents=>(cents/100).toFixed(2),line={unitPrice:2000,qty:1,paid:1650},other={unitPrice:1000,qty:1,paid:850}
 const order={subtotal:3000,discount:300,points_used:200,freight:0,total:2500,items:[line,other]}
 assert.deepEqual(afterSaleReductionRows(order,line,money),[{label:'订单优惠金额',value:'−¥3.00'},{label:'订单积分抵扣',value:'−¥2.00'},{label:'本商品实付',value:'¥16.50'}])
 assert.deepEqual(afterSaleReductionRows({items:[line],points_used:200},line,money),[{label:'本商品已减金额（明细待核对）',value:'−¥3.50'}])
})

test('积分兑换订单列表显示真实积分而非零元价格',()=>{
 const line={unitPrice:0,qty:1}
 assert.equal(orderLineDisplayAmount({order_type:'POINTS',points_used:1800,items:[line]},line,()=> '0.00'),'1800积分')
 assert.equal(orderLineDisplayAmount({order_type:'DEALER_RETAIL'}, {unitPrice:2990,qty:2},cents=>(cents/100).toFixed(2)),'¥59.80')
 assert.equal(orderLineDisplayAmount({order_type:'DEALER_RETAIL'}, {unitPrice:2000,qty:1,paid:1900},cents=>(cents/100).toFixed(2)),'¥19.00')
})

test('经营端售后列表区分积分退回与现金退款',()=>{
 const money=cents=>(cents/100).toFixed(2)
 assert.equal(refundDisplayAmount({order_type:'POINTS',points_return:1800,amount:0},money),'1800积分')
 assert.equal(refundDisplayAmount({order_type:'DEALER_RETAIL',amount:8900},money),'¥89.00')
 assert.equal(refundDisplayAmount({order_type:'DEALER_RETAIL',refund_type:'EXCHANGE',amount:2990},money),'商品价值 ¥29.90')
})

test('兑换结果标题随服务端订单状态变化',()=>{
 assert.equal(redemptionPageTitle(null),'兑换结果')
 assert.equal(redemptionPageTitle({rawStatus:'SHIPPED'}),'兑换成功')
 assert.equal(redemptionPageTitle({rawStatus:'REFUNDED'}),'兑换订单')
})

test('商家售后审核文案按退货换货类型显示',()=>{
 assert.deepEqual(refundReviewPresentation('RETURN'),{title:'退货退款审核',reject:'拒绝退货',approve:'同意退货'})
 assert.deepEqual(refundReviewPresentation('EXCHANGE'),{title:'换货审核',reject:'拒绝换货',approve:'同意换货'})
 assert.equal(refundReviewPresentation('REFUND_ONLY'),null)
})

test('换货和退货退款申请页显示真实业务名称',()=>{
 assert.equal(afterSalePageTitle('换货'),'申请换货')
 assert.equal(afterSalePageTitle('退货退款'),'申请退货退款')
 assert.equal(afterSalePageTitle('部分退款'),'申请部分退款')
 assert.equal(afterSalePageTitle('仅退款'),'申请退款')
 assert.equal(afterSaleDetailPage('EXCHANGE'),'M24')
 assert.equal(afterSaleDetailPage('RETURN'),'M23')
 assert.equal(managementAfterSalePage({refund_type:'EXCHANGE',status:'CLOSED'}),'G28')
 assert.equal(managementAfterSalePage({refund_type:'EXCHANGE',status:'EXCHANGE_SHIPPED'}),'G28')
 assert.equal(managementAfterSalePage({refund_type:'EXCHANGE',status:'WAIT_RETURN'}),'G27')
 assert.equal(managementAfterSalePage({refund_type:'RETURN',status:'SUCCESS'}),'G26')
 assert.equal(afterSaleStatusLabel({refund_type:'EXCHANGE',status:'CLOSED'},'已关闭'),'换货已完成')
 assert.equal(afterSaleStatusLabel({refund_type:'RETURN',status:'CLOSED'},'已关闭'),'已关闭')
})

test('已提交的退货运单显示可修改而非首次填写',()=>{
 assert.equal(returnTrackingSubmitted({return_json:'{"tracking":"TEST20261001RETURN1"}'}),true)
 assert.equal(returnTrackingSubmitted({return_json:'{"tracking":""}'}),false)
 assert.equal(returnTrackingSubmitted({return_json:'broken'}),false)
})

test('验收记录冷重载从售后凭证回填数量、外观、备注和照片',()=>{
 const refund={qty:2,evidence_json:JSON.stringify({inspection:{receivedQty:2,goodQty:0,note:'包装破损',uploads:['FILEproof1']}})}
 assert.deepEqual(refundInspectionForm(refund),{退回数量:2,实际验收:0,外观状态:'破损不可销售',验收备注:'包装破损',uploads:['FILEproof1']})
 assert.deepEqual(refundInspectionForm({qty:1,evidence_json:'broken'}),{退回数量:1,实际验收:1,外观状态:'完好可再次销售',验收备注:'',uploads:[]})
})
