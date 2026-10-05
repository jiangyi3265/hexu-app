export function currentPolicyVersions(policies) {
  const versions = {}
  for (const type of ['USER_AGREEMENT', 'PRIVACY_POLICY']) {
    if (!policies?.[type]?.version) throw new Error('用户协议或隐私政策尚未发布')
    versions[type] = policies[type].version
  }
  if (policies.THIRD_PARTY_SHARING?.version) versions.THIRD_PARTY_SHARING = policies.THIRD_PARTY_SHARING.version
  return versions
}

export function merchantApplicationPayload(shopId, form) {
  const contactPhone = String(form.contactPhone || '').trim()
  const attachmentIds = form.uploads || []
  if (!/^1[3-9][0-9]{9}$/.test(contactPhone)) throw new Error('请输入正确的联系人手机')
  if (!Array.isArray(attachmentIds) || !attachmentIds.length) throw new Error('请上传营业执照与主体资质')
  return {shopId,subjectType:form.主体类型 === '个体工商户' ? 'INDIVIDUAL' : 'ENTERPRISE',subjectName:String(form.subjectName || '').trim(),legalRepresentative:String(form.legalRepresentative || '').trim(),licenseNo:String(form.licenseNo || '').trim().toUpperCase(),contactPhone,settlementBank:String(form.settlementBank || '').trim(),settlementAccountRef:String(form.settlementAccountRef || '').trim(),attachmentIds,applicationRef:String(form.applicationRef || '').trim()}
}

export function merchantCertificatePayload(shopId, form) {
  const percent = String(form.contractedFeePercent ?? '').trim(), fee = Number(percent), days = Number(form.settlementDays)
  if (!String(form.serialNo || '').trim() || !form.expiresAt) throw new Error('请填写证书序列号和有效期')
  if (!/^(?:\d{1,2}(?:\.\d{1,2})?|100(?:\.0{1,2})?)$/.test(percent)) throw new Error('签约费率须为 0 至 100%，最多两位小数')
  if (String(form.settlementDays ?? '').trim() === '' || !Number.isInteger(days) || days < 0 || days > 365) throw new Error('结算周期须为 0 至 365 天')
  return {shopId,serialNo:String(form.serialNo).trim(),expiresAt:form.expiresAt,certificateRef:String(form.certificateRef || '').trim(),contractedFeeBps:Math.round(fee * 100),settlementDays:days}
}

export function directAfterSalePayload(shopId, refundId, form) {
  if (!refundId) throw new Error('请先选择客户售后单')
  const wholesaleOrderId = String(form.wholesaleOrderId || '').trim()
  if (!wholesaleOrderId) throw new Error('请填写关联采购订单号')
  return {shopId,customerRefundId:refundId,wholesaleOrderId,wholesaleRefundId:String(form.wholesaleRefundId || '').trim()}
}

export function trackingTimeline(tracking) {
  const events = tracking?.events || []
  if (events.length) return events.map(event => [event.description, event.time].filter(Boolean).join(' · '))
  if (!tracking?.tracking) return ['订单尚未发货']
  return [tracking.status === 'UNAVAILABLE' ? '承运商接口未配置，暂无实时轨迹' : '运单已录入，承运商暂无轨迹']
}
