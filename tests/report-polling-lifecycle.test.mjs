import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {runInNewContext} from 'node:vm'

const source = await readFile(new URL('../components/DesignScreen.vue', import.meta.url), 'utf8')
const start = source.indexOf('let reportTimer,')
const end = source.indexOf('\nwatch(', start)
assert.ok(start >= 0 && end > start)
const lifecycle = source.slice(start, end)

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return {promise, resolve, reject}
}

function setup(pageId = 'G58') {
  const show = [], hide = [], unmount = [], timers = new Map(), loads = [], reports = [], messages = []
  let nextTimer = 0
  const backend = {reports: {[pageId]: {status: 'RUNNING'}}, openPolicy: null}
  const context = {
    pageId, backend, state: {}, form: {}, filter: {value: '本月'}, pageVisible: {value: false},
    onShow: fn => show.push(fn), onHide: fn => hide.push(fn), onBeforeUnmount: fn => unmount.push(fn),
    pageData: () => { const task = deferred(); loads.push(task); return task.promise },
    refreshMobileReport: () => { const task = deferred(); reports.push(task); return task.promise },
    setInterval: fn => { const id = ++nextTimer; timers.set(id, fn); return id },
    clearInterval: id => timers.delete(id), toast: message => messages.push(message), Date
  }
  runInNewContext(lifecycle, context)
  function enter() { const pending = show[0](); show[1](); return pending }
  return {enter, leave: () => hide[0](), unmount: () => unmount[0](), timers, loads, reports, messages}
}

test('报表页加载未完成就离开或卸载，不再启动轮询', async () => {
  for (const leave of ['leave', 'unmount']) {
    const page = setup()
    const pending = page.enter()
    page[leave]()
    page.loads[0].resolve()
    await pending
    assert.equal(page.timers.size, 0)
  }
})

test('报表页快速离开又返回，旧加载不得覆盖新一轮轮询', async () => {
  const page = setup()
  const oldLoad = page.enter()
  page.leave()
  const newLoad = page.enter()
  page.loads[1].resolve()
  await newLoad
  assert.equal(page.timers.size, 1)
  const activeTimer = [...page.timers.keys()][0]
  page.loads[0].resolve()
  await oldLoad
  assert.deepEqual([...page.timers.keys()], [activeTimer])
})

test('报表轮询请求途中离开，不在隐藏页提示错误', async () => {
  const page = setup()
  const load = page.enter()
  page.loads[0].resolve()
  await load
  const poll = [...page.timers.values()][0]()
  page.leave()
  page.reports[0].reject(new Error('网络失败'))
  await poll
  assert.equal(page.timers.size, 0)
  assert.deepEqual(page.messages, [])
})
