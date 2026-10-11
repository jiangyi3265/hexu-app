import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {resolveBackendDir} from '../scripts/backend-proxy.mjs'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const seedPath = path.join(resolveBackendDir(appRoot), 'ruoyi-admin/src/main/resources/hexu-ui-seed.json')
const {screens} = JSON.parse(readFileSync(seedPath, 'utf8'))

test('G27 服务端页面标签与验收表单键各司其职', () => {
  const [received, good] = screens.G27.blocks[2].items
  assert.deepEqual([received.label, received.key], ['实际收货', '退回数量'])
  assert.deepEqual([good.label, good.key], ['合格回库', '实际验收'])
})

test('G06 交接目标和生效时间不预填虚构资料', () => {
  const fields = screens.G06.blocks[2].items
  assert.deepEqual(fields.slice(0, 3).map(field => field.value), ['', '', ''])
})
