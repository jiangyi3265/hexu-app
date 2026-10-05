function integer(value, label, allowEmpty = false) {
  const raw = String(value ?? '').trim()
  if (allowEmpty && !raw) return 0
  if (!/^(0|[1-9]\d*)$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new Error(label + '须为非负整数')
  }
  return Number(raw)
}

export function pointRiskPayload(form) {
  const singleLimit = integer(form.单笔上限, '单笔上限')
  const dailyLimit = integer(form.每日累计上限, '每日累计上限')
  const monthlyLimit = integer(form.月累计上限, '月累计上限')
  if (singleLimit <= 0 || dailyLimit < singleLimit || monthlyLimit < dailyLimit) {
    throw new Error('积分风控限额需依次递增且为正数')
  }

  const frequencyEnabled = !!form.frequencyEnabled
  const dailyCount = integer(form.每日最多次数, '每日最多次数', !frequencyEnabled)
  const windowCount = integer(form.windowCount, '短时最多次数', !frequencyEnabled)
  const windowSeconds = integer(form.windowSeconds, '短时窗口', !frequencyEnabled)
  if (frequencyEnabled) {
    if (dailyCount < 1 || dailyCount > 10000) throw new Error('每日次数须为1至10000')
    if (windowCount < 1 || windowCount > dailyCount) throw new Error('短时次数须为正数且不超过每日次数')
    if (windowSeconds < 10 || windowSeconds > 86400) throw new Error('短时窗口须为10至86400秒')
  }

  return {
    singleLimit, dailyLimit, monthlyLimit, frequencyEnabled,
    dailyCount, windowCount, windowSeconds,
    autoFreeze: !!form.异常账户冻结,
  }
}
