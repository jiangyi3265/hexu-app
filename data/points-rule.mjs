function boundedInteger(value, label, min, max) {
  const raw = String(value ?? '').trim()
  if (!/^(0|[1-9]\d*)$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < min || Number(raw) > max) {
    throw new Error(label + '须为' + min + '至' + max + '的整数')
  }
  return Number(raw)
}

export function pointsRulePayload(form) {
  return {
    kind: 'points_rule',
    purchaseRate: boundedInteger(form.消费每1元赠送, '消费每1元赠送', 0, 100),
    checkinPoints: boundedInteger(form.每日签到赠送, '每日签到赠送', 0, 100),
    reviewPoints: boundedInteger(form.评价赠送, '评价赠送', 0, 100),
    expiryDays: boundedInteger(form['有效期（天）'], '有效期', 0, 36500),
    pointsPerYuan: boundedInteger(form.每1元所需积分, '每1元所需积分', 1, 100000),
    deductionPercent: boundedInteger(form['最高抵扣比例（%）'], '最高抵扣比例', 0, 20),
  }
}
