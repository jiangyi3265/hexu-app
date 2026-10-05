const refundTypes = {
 '仅退款': 'REFUND_ONLY',
 '退货退款': 'RETURN',
 '部分退款': 'PARTIAL',
 '换货': 'EXCHANGE'
}
const invalidText = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/

export function refundApplicationPayload({order, lineId, quantity, type, reason, description = '', uploads = [], directQuantity = 0, refunds = []}) {
 if (!order?.id || !['PAID', 'SHIPPED', 'COMPLETED'].includes(order.rawStatus)) throw new Error('请从可申请售后的真实订单重新进入')
 const line = lineId == null ? order.items?.find(item => item.qty > Number(item.refunded_qty || 0)) : order.items?.find(item => Number(item.lineId) === Number(lineId))
 if (!line || !Number.isSafeInteger(Number(line.lineId))) throw new Error('请选择订单中的售后商品')
 const rawQuantity = typeof quantity === 'number' ? String(quantity) : quantity
 if (typeof rawQuantity !== 'string' || !/^[1-9]\d*$/.test(rawQuantity)) throw new Error('申请数量须为正整数')
 const qty = Number(rawQuantity)
 if (!Number.isSafeInteger(qty)) throw new Error('申请数量须为正整数')
 if (refunds.some(record => Number(record.line_id) === Number(line.lineId) && !['SUCCESS', 'REJECTED', 'CLOSED'].includes(record.status))) throw new Error('该商品已有进行中的售后申请')
 if (qty > Number(line.qty) - Number(line.refunded_qty || 0)) throw new Error('申请数量超过可售后数量')
 if (directQuantity && qty < Number(directQuantity)) throw new Error('公司采购售后数量不得少于客户售后数量')
 const refundType = Object.prototype.hasOwnProperty.call(refundTypes, type) ? refundTypes[type] : null
 if (!refundType) throw new Error('请先选择有效的售后类型')
 if (typeof reason !== 'string' || invalidText.test(reason) || reason.trim().length < 2 || reason.trim().length > 500) throw new Error('退款原因须为2–500个有效字符')
 if (typeof description !== 'string' || invalidText.test(description) || description.length > 500) throw new Error('问题描述最多500个有效字符')
 if (!Array.isArray(uploads) || uploads.length > 9 || new Set(uploads).size !== uploads.length || uploads.some(id => typeof id !== 'string' || !/^FILE[0-9a-f]{32}$/.test(id))) throw new Error('售后凭证须为已上传图片，最多9张且不能重复')
 return {id:order.id, lineId:Number(line.lineId), qty, type:refundType, reason:reason.trim(), description:description.trim(), uploads:[...uploads]}
}
