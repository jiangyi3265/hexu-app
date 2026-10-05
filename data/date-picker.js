const pad = value => String(value).padStart(2, '0')
const sequence = (from, to) => Array.from({length:to-from+1}, (_, index) => from+index)
const format = parts => parts.map((value,index)=>index?pad(value):String(value).padStart(4,'0')).join('-')

export function daysInMonth(year, month) {
  if (month === 2) return year%4===0 && (year%100!==0 || year%400===0) ? 29 : 28
  return [4,6,9,11].includes(month) ? 30 : 31
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null
  const [year, month, day] = value.split('-').map(Number)
  return year>=1 && year<=9999 && month>=1 && month<=12 && day>=1 && day<=daysInMonth(year,month) ? [year,month,day] : null
}

export function dateColumns(value, start='1900-01-01', end='2100-12-31') {
  const lower=parseDate(start)||[1900,1,1], upper=parseDate(end)||[2100,12,31]
  if (format(lower)>format(upper)) throw new Error('日期范围无效')
  const today=new Date(Date.now()+8*60*60*1000).toISOString().slice(0,10)
  const parsed=parseDate(value)||parseDate(today)
  const date=format(parsed)<format(lower)?lower:format(parsed)>format(upper)?upper:parsed
  const year=Math.min(upper[0],Math.max(lower[0],date[0]))
  const months=sequence(year===lower[0]?lower[1]:1,year===upper[0]?upper[1]:12)
  const month=Math.min(months[months.length-1],Math.max(months[0],date[1]))
  const days=sequence(year===lower[0]&&month===lower[1]?lower[2]:1,year===upper[0]&&month===upper[1]?upper[2]:daysInMonth(year,month))
  const day=Math.min(days[days.length-1],Math.max(days[0],date[2]))
  const values=[sequence(lower[0],upper[0]),months,days]
  return {values, range:values.map((column,index)=>column.map(number=>number+['年','月','日'][index])), indices:[year-lower[0],months.indexOf(month),days.indexOf(day)]}
}

export function selectedDate(columns, indices) {
  const values=columns.values.map((column,index)=>column[Number(indices?.[index])])
  if (values.some(value=>!Number.isInteger(value))) throw new Error('请选择有效日期')
  return format(values)
}

export function moveDateColumn(columns, column, value, start, end) {
  const indices=[...columns.indices];indices[column]=Number(value)
  const selected=selectedDate(columns,indices)
  // Changing a leap year or month can invalidate the old day; clamp it numerically.
  const [year,month,day]=selected.split('-').map(Number)
  return dateColumns(`${year}-${pad(month)}-${pad(Math.min(day,daysInMonth(year,month)))}`,start,end)
}
