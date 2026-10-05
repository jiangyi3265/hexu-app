const questionTypes = new Set(['订单问题','商品咨询','售后服务','账户与代理','活动咨询','其他问题'])
const invalidText = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/

export function supportPayload(form = {}) {
 if (typeof form.question !== 'string' || !questionTypes.has(form.question.trim())) throw new Error('请选择有效的留言问题类型')
 if (typeof form.message !== 'string' || invalidText.test(form.message)) throw new Error('留言内容不能包含非法控制字符')
 const message = form.message.trim()
 if (!message || [...message].length > 500) throw new Error('留言内容请输入1–500个字符')
 const order = form['关联订单'] ?? ''
 if (typeof order !== 'string' || /[\u0000-\u001F\u007F-\u009F]/.test(order)) throw new Error('请填写有效的关联订单编号')
 const uploads = [...(form.uploads || [])]
 if (uploads.length > 9 || new Set(uploads).size !== uploads.length || uploads.some(id => !/^FILE[0-9a-f]{32}$/.test(id))) throw new Error('请重新上传有效留言图片，最多9张')
 return {question:form.question.trim(),message,orderId:order.trim(),uploads}
}

export function visibleSupportRecords(records, memberId, shopId) {
 if (!Array.isArray(records)) throw new Error('客服留言列表响应无效，请刷新重试')
 return records.filter(record => record?.kind === 'support'
  && Number(record.member_id) === Number(memberId)
  && Number(record.shop_id) === Number(shopId)
  && record.status !== 'DELETED')
}
