// Parse API timestamps without relying on platform-specific string Date parsing.
export function timestamp(value) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return new Date(value).getTime()
  if (typeof value !== 'string' || !value.trim()) return NaN
  const text = value.trim()
  if (/^-?\d+$/.test(text)) return new Date(Number(text)).getTime()
  const parts = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})?)?$/.exec(text)
  if (!parts) return NaN
  const [,y,m,d,h='00',min='00',s='00',fraction='',zone] = parts
  const year = Number(y), month = Number(m), day = Number(d)
  const hour = Number(h), minute = Number(min), second = Number(s)
  if (year < 1 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return NaN
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(hour, minute, second, Number(fraction.slice(0,3).padEnd(3,'0')))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return NaN
  if (!parts[4] || zone === 'Z') return date.getTime()
  if (zone) {
    const hours = Number(zone.slice(1,3)), minutes = Number(zone.slice(4,6))
    if (hours > 23 || minutes > 59) return NaN
    const offset = (hours * 60 + minutes) * 60000 * (zone[0] === '+' ? 1 : -1)
    return date.getTime() - offset
  }
  // SQL datetime without a zone retains its existing device-local semantics.
  const local = new Date(0)
  local.setFullYear(year, month - 1, day)
  local.setHours(hour, minute, second, date.getUTCMilliseconds())
  return local.getTime()
}

export function dateTimeLabel(value, options) {
  const time = timestamp(value)
  return Number.isFinite(time) ? new Date(time).toLocaleString('zh-CN', options) : '—'
}

export function isFutureTimestamp(value, now = Date.now()) {
  const time = timestamp(value)
  return Number.isFinite(time) && time > now
}
