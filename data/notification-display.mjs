const legacyReviewTitles = {
  APPROVED: '审核通过',
  REJECTED: '审核未通过',
  SUPPLEMENT: '待补充资料'
}

export function notificationText(value, referenceKind = '') {
  const text = String(value ?? '')
  const status = /^申请处理结果：(APPROVED|REJECTED|SUPPLEMENT)$/.exec(text)?.[1]
  const subject = { review: '商品评价审核', review_append: '商品追评审核' }[referenceKind] || '申请处理结果'
  return status ? `${subject}：${legacyReviewTitles[status]}` : text
}

const templateLabels = {
  shop: '商城名称',
  reference: '关联单号',
  message: '业务说明'
}

const templateKeys = Object.fromEntries(Object.entries(templateLabels).map(([key, label]) => [label, key]))

export function notificationTemplateForEditor(value) {
  return String(value ?? '').replace(/\{\{(shop|reference|message)\}\}/g, (_, key) => `【${templateLabels[key]}】`)
}

export function notificationTemplateForSave(value) {
  return String(value ?? '').replace(/【(商城名称|关联单号|业务说明)】/g, (_, label) => `{{${templateKeys[label]}}}`)
}
