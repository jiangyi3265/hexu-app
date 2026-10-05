import {timestamp,dateTimeLabel} from './datetime.js'

export function reviewTimeLabel(value) {
 if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) && Number.isFinite(timestamp(value))) return value.trim()
 return dateTimeLabel(value,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})
}

export function reviewPreviewTarget(images,index,apiBase,platform){
 const urls=(images||[]).map(image=>String(image||'')).filter(Boolean).map(url=>url.startsWith('/hexu/')?apiBase+url:url)
 if(!urls.length)throw new Error('图片暂不可用')
 const current=Math.max(0,Math.min(Number(index)||0,urls.length-1))
 return {urls,current,mode:platform==='h5'||(platform==='mp-weixin'&&urls.some(url=>/^http:\/\//i.test(url)))?'inline':'native'}
}

// Review presentation uses only public, approved data from the API.
export function filterReviews(reviews = [], filter = '') {
 const list = [...reviews]
 if (filter === '有图') return list.filter(r => (r.images || []).length || (r.appends || []).some(a => (a.images || []).length))
 if (filter === '追评') return list.filter(r => (r.appends || []).length)
 if (filter === '最新') {
  const time = value => {const parsed=timestamp(value);return Number.isFinite(parsed)?parsed:-Infinity}
  list.sort((a, b) => time(b.createdAt) - time(a.createdAt))
 }
 return list
}
export function reviewPayload(form, order, skuId, parent, submission) {
 if (!order || order.rawStatus !== 'COMPLETED' || Number(order.refunded || 0) !== 0) throw new Error('只能评价本人已完成且未退款的订单')
 if (!(order.items || []).some(line => line.id === skuId)) throw new Error('请选择订单中的商品')
 const raw = String(form.评价内容 || '')
 if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(raw)) throw new Error('评价内容不能包含非法控制字符')
 const content = raw.trim()
 if (!content || [...content].length > 500) throw new Error('评价内容请输入1–500个字符')
 const uploads = [...(form.uploads || [])]
 if (uploads.length > 9 || new Set(uploads).size !== uploads.length || uploads.some(id => !/^FILE[0-9a-f]{32}$/.test(id))) throw new Error('请重新上传有效评价图片，最多9张')
 if (parent) {
  const supplement = parent.appendSupplementAllowed === true && parent.appendStatus === 'SUPPLEMENT' && submission?.status === 'SUPPLEMENT' && submission.id === parent.appendId && submission.body?.parentId === parent.id && submission.body?.orderId === order.id && submission.body?.skuId === skuId
  if (!parent.mine || (!parent.appendAllowed && !supplement) || parent.orderId !== order.id || parent.skuId !== skuId) throw new Error('当前评价不可追加，请刷新后再试')
  return {kind:'review_append',parentId:parent.id,orderId:order.id,skuId,content,uploads,...(supplement?{id:submission.id}:{})}
 }
 if (submission && (submission.status !== 'SUPPLEMENT' || submission.body?.orderId !== order.id || submission.body?.skuId !== skuId)) throw new Error('评价记录已变化，请重新读取本人订单评价')
 const rating = Number(form.rating)
 if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('请选择1–5分的评分')
 return {kind:'review',orderId:order.id,skuId,rating,content,uploads,anonymous:!!form.匿名评价,...(submission?.status==='SUPPLEMENT'?{id:submission.id}:{})}
}
export function ratingLabel(rating) {
  return ({1:'很不满意',2:'不满意',3:'一般',4:'满意',5:'非常满意'})[rating]||'请选择评分'
}
// First-review eligibility is independent from an approved parent's append rights.
export function reviewContextAllowed(context, parentId = '') {
 if (!context) return false
 if (!parentId) return context.reviewAllowed === true
 const parent = context.parent
 return parent?.id === parentId && parent.mine === true &&
  (parent.appendAllowed === true || parent.appendSupplementAllowed === true)
}
export function reviewButtonLabel(context, parentId = '', locked = false) {
 if (!locked) return parentId ? '提交追评' : '提交评价'
 const noun = parentId ? '追评' : '评价'
 const status = (parentId ? context?.appendSubmission : context?.submission)?.status
 if (status === 'APPROVED') return noun + '已审核通过'
 if (status === 'PENDING') return noun + '已提交，等待审核'
 return '当前' + noun + '不可提交'
}
