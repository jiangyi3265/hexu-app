import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {runInNewContext} from 'node:vm'

const source = await readFile(new URL('../data/backend.js', import.meta.url), 'utf8')
const start = source.indexOf('export async function refreshMobileReport(')
const end = source.indexOf('\nexport function setReportPeriod(', start)
assert.ok(start >= 0 && end > start)
const implementation = source.slice(start, end).replace('export async', 'async') + '\nthis.refreshMobileReport=refreshMobileReport'

function setup(request) {
 const backend = {
  shopId: 2,
  reports: {G58: {id: 'R1', shop_id: 2, status: 'QUEUED'}},
  reportPages: {G58: 1},
  reportJobs: [{id: 'R1', status: 'QUEUED', filters: {from: '2026-09-01', to: '2026-09-30'}}, {id: 'R2', status: 'DONE'}]
 }
 const context = {backend, request, mobileReportDimension: () => 'AGENT'}
 runInNewContext(implementation, context)
 return {backend, refreshMobileReport: context.refreshMobileReport}
}

test('报表轮询完成后同步最近任务状态，不覆盖其他任务', async () => {
 const detail = {id: 'R1', shop_id: 2, status: 'DONE', progress: 100, processed_rows: 14, total_rows: 14}
 const {backend, refreshMobileReport} = setup(async () => detail)
 await refreshMobileReport('G58')
 assert.equal(backend.reports.G58.status, 'DONE')
 assert.equal(backend.reportJobs[0].status, 'DONE')
 assert.equal(backend.reportJobs[0].progress, 100)
 assert.deepEqual(JSON.parse(JSON.stringify(backend.reportJobs[0].filters)), {from: '2026-09-01', to: '2026-09-30'})
 assert.equal(backend.reportJobs[1].status, 'DONE')
})

test('离开商城后旧报表响应不得写入当前商城的任务列表', async () => {
 let resolve
 const {backend, refreshMobileReport} = setup(() => new Promise(done => {resolve = done}))
 const pending = refreshMobileReport('G58')
 backend.shopId = 3
 resolve({id: 'R1', shop_id: 2, status: 'DONE', progress: 100})
 await pending
 assert.equal(backend.reportJobs[0].status, 'QUEUED')
 assert.equal(backend.reports.G58.status, 'QUEUED')
})
