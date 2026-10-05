import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const source=fs.readFileSync(new URL('../data/date-picker.js',import.meta.url),'utf8')
const {dateColumns,selectedDate,moveDateColumn}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
test('年月日纯数字解析，初始选择和未滚动确认不会因时区少一天',()=>{
 const columns=dateColumns('1995-09-23','1900-01-01','2026-09-27')
 assert.equal(selectedDate(columns,columns.indices),'1995-09-23')
 assert.equal(selectedDate(dateColumns('2024-02-29'),dateColumns('2024-02-29').indices),'2024-02-29')
})
test('切换月份或闰年时裁剪日期，起止月日不越界',()=>{
 const original=dateColumns('2024-02-29','2023-01-01','2026-09-27')
 const nonLeap=moveDateColumn(original,0,0,'2023-01-01','2026-09-27')
 assert.equal(selectedDate(nonLeap,nonLeap.indices),'2023-02-28')
 const april=moveDateColumn(dateColumns('2024-01-31'),1,3)
 assert.equal(selectedDate(april,april.indices),'2024-04-30')
 for(const value of ['2027-12-31','2026-10-20','2026-09-30']) {
  const columns=dateColumns(value,'1900-01-01','2026-09-27')
  assert.equal(selectedDate(columns,columns.indices),'2026-09-27')
 }
 const lower=dateColumns('1900-01-01','2020-03-15','2020-04-20')
 assert.equal(selectedDate(lower,lower.indices),'2020-03-15')
 assert.throws(()=>selectedDate(lower,[-1,0,0]))
})
