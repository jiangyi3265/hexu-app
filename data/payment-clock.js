import {timestamp} from './datetime.js'

export function paymentState(order, now = Date.now(), processing = false) {
  if (!order) return {payable:false, title:'请先选择待付款订单'}
  if (processing && ['PAID', 'SHIPPED', 'COMPLETED', 'REFUNDED'].includes(order.rawStatus)) {
    return {payable:false, title:'支付已确认，正在跳转结果页', processing:true}
  }
  if (order.rawStatus !== 'UNPAID') return {payable:false, title:'订单已不在待付款状态，请返回订单查看'}
  const expiry = timestamp(order.expires_at)
  if (!Number.isFinite(expiry)) return {payable:false, title:'付款期限未读取，请重新进入订单'}
  const seconds = Math.max(0, Math.ceil((expiry - now) / 1000))
  const clock = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`
  return {payable:seconds>0, title:seconds>0?`请在 ${clock} 内完成支付`:'付款已超时，请返回订单查看关闭结果'}
}

export function paymentNotice(order, now, processing, defaultBody) {
  const state = paymentState(order, now, processing)
  const paid = ['PAID', 'SHIPPED', 'COMPLETED', 'REFUNDED'].includes(order?.rawStatus)
  return {
    title: state.title,
    body: state.processing ? '支付结果已确认，即将查看订单结果'
      : paid ? '付款已确认，请返回订单查看最新状态'
      : order?.rawStatus === 'CANCELLED' ? '订单已关闭，不能继续支付'
      : order?.rawStatus === 'UNPAID' && !state.payable ? '付款期限已过，请返回订单查看最新状态'
      : defaultBody
  }
}
