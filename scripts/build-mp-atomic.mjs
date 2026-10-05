import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { releaseApiOrigin } from './release-api.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RELEASES = path.join(ROOT, 'dist', 'releases', 'mp-weixin')
const UNI_CLI = path.join(ROOT, 'node_modules', '@dcloudio', 'vite-plugin-uni', 'bin', 'uni.js')
const MANIFEST = 'build-manifest.sha256'
const SCOPE = /\bdata-v-[0-9a-f]+\b/gi

function requireReleaseChild(target) {
  // 目录发布和失败清理只允许作用于本次 releases 目录的直接子目录。
  if (path.dirname(path.resolve(target)) !== path.resolve(RELEASES)) {
    throw new Error(`版本目录越界：${target}`)
  }
}

function build(output, apiOrigin) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [UNI_CLI, 'build', '-p', 'mp-weixin'], {
      cwd: ROOT,
      env: { ...process.env, ...(apiOrigin ? { VITE_HEXU_API: apiOrigin } : {}), UNI_INPUT_DIR: ROOT, UNI_OUTPUT_DIR: output },
      stdio: 'inherit',
    })
    const stop = () => child.kill('SIGTERM')
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
    child.once('error', reject)
    child.once('close', (code, signal) => {
      process.off('SIGINT', stop)
      process.off('SIGTERM', stop)
      if (code === 0) resolve()
      else reject(new Error(`MP 构建失败：${signal || code}`))
    })
  })
}

async function filesUnder(directory, relative = '') {
  const files = []
  for (const entry of await fs.readdir(path.join(directory, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative.replaceAll('\\', '/'), entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(directory, name))
    else if (entry.isFile()) files.push(name)
    else throw new Error(`构建包含非普通文件：${name}`)
  }
  return files
}

function scopes(content) {
  return [...new Set(content.match(SCOPE) || [])].sort().join(',')
}

async function verifyAndManifest(directory) {
  const files = (await filesUnder(directory)).sort()
  if (!files.includes('app.js') || !files.includes('app.json')) throw new Error('MP 构建包不完整')
  if (files.includes(MANIFEST)) throw new Error(`构建包已有 ${MANIFEST}`)

  // 只要 WXML 或 WXSS 含 scope，就要求同路径配对且 scope 完全一致。
  const scoped = new Map()
  for (const name of files.filter(name => /\.(?:wxml|wxss)$/.test(name))) {
    const value = scopes(await fs.readFile(path.join(directory, name), 'utf8'))
    if (value) scoped.set(name, value)
  }
  for (const [name, value] of scoped) {
    const pair = name.replace(/\.(wxml|wxss)$/, (_, ext) => ext === 'wxml' ? '.wxss' : '.wxml')
    if (scoped.get(pair) !== value) throw new Error(`WXML/WXSS scope 不一致：${name} ↔ ${pair}`)
  }

  // 清单只列构建文件，避免把清单自身纳入哈希。
  const lines = []
  for (const name of files) {
    const data = await fs.readFile(path.join(directory, name))
    lines.push(`${name} ${createHash('sha256').update(data).digest('hex').toUpperCase()}`)
  }
  await fs.writeFile(path.join(directory, MANIFEST), `${lines.join('\n')}\n`, { flag: 'wx' })
  return { fileCount: files.length, scopedPairs: scoped.size / 2 }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--release') || args.length > 1) throw new Error('仅支持可选参数 --release')
  const apiOrigin = args.includes('--release')
    ? releaseApiOrigin(process.env.VITE_HEXU_API || loadEnv('production', ROOT, 'VITE_').VITE_HEXU_API)
    : ''
  await fs.mkdir(RELEASES, { recursive: true })
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`
  const temporary = await fs.mkdtemp(path.join(RELEASES, `.building-${id}-`))
  const published = path.join(RELEASES, id)
  requireReleaseChild(temporary)
  requireReleaseChild(published)
  let renamed = false
  try {
    await build(temporary, apiOrigin)
    const result = await verifyAndManifest(temporary)
    // 新版本名不复用；校验完成后只做一次同卷目录改名。
    try { await fs.lstat(published); throw new Error(`版本目录已存在：${published}`) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    await fs.rename(temporary, published)
    renamed = true
    console.log(`已发布：${published}（${result.fileCount} 文件，${result.scopedPairs} 组 scoped WXML/WXSS）`)
  } finally {
    if (!renamed) {
      requireReleaseChild(temporary)
      await fs.rm(temporary, { recursive: true, force: true })
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
