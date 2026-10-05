import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {fileURLToPath} from 'node:url'
import {loadPure} from '../tests/helpers/pure-module.mjs'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const catalogSource = fs.readFileSync(path.join(root, 'data/catalog.js'), 'utf8')
const catalogMatch = catalogSource.match(/export const catalog = (\[[\s\S]*?\])\s*export const groups/)
if (!catalogMatch) throw new Error('catalog.js 格式不符合导出脚本预期')
const catalog = JSON.parse(catalogMatch[1])
let source = fs.readFileSync(path.join(root, 'data/screens.js'), 'utf8')
source = source.replace(/^import .*?\r?\n/gm, '').replace(/export /g, '')
const {profileFields} = await loadPure('profile.js')
const context = { catalog, profileFields, console }
vm.createContext(context)
vm.runInContext(source + '\n;globalThis.__screens=screens', context, { filename: 'screens.js' })
const output = JSON.stringify({ schemaVersion: 1, catalog, screens: context.__screens })
const destination = path.resolve(root, '../fenxiao-backend/ruoyi-admin/src/main/resources/hexu-ui-seed.json')
fs.writeFileSync(destination, output + '\n', 'utf8')
console.log(`exported ${catalog.length} pages to ${destination}`)
