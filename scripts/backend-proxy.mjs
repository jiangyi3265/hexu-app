import fs from 'node:fs'
import path from 'node:path'

const localHosts = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const localNames = new Set(['127.0.0.1', 'localhost', '[::1]'])
const operationPattern = /^\/(login|payment\/[^/?]+|refund\/[^/?]+|payout\/[^/?]+)$/

function trustedBrowserRequest(req) {
  try {
    const host = new URL(`http://${req.headers.host}`)
    const origin = req.headers.origin
    // 必须是本机 Host，且浏览器来源与当前页面一致；无 Origin 的本机命令行仍可联调。
    return localNames.has(host.hostname) &&
      req.headers['sec-fetch-site'] !== 'cross-site' &&
      (!origin || origin === host.origin)
  } catch {
    return false
  }
}

function resolveBackendDir() {
  const candidates = [process.env.HEXU_BACKEND_DIR, '../fenxiao-backend', '../hexu-backend', '../RuoYi-Vue'].filter(Boolean)
  return candidates.find(candidate => fs.existsSync(path.resolve(candidate, 'pom.xml'))) || '../fenxiao-backend'
}

export default function backendProxy() {
  return {
    name: 'hexu-local-backend',
    configureServer(server) {
      server.middlewares.use('/__hexu_dev', async (req, res, next) => {
        if (!localHosts.has(req.socket.remoteAddress) || !trustedBrowserRequest(req)) {
          res.statusCode = 403
          return res.end('Local origin only')
        }
        const match = req.url?.match(operationPattern)
        if (match && req.method === 'OPTIONS') {
          // 只对同源预检给出允许结果，外部 Origin 不得借 Vite 的通用 CORS 放行。
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', req.headers.origin || `http://${req.headers.host}`)
          res.setHeader('Access-Control-Allow-Methods', 'POST')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.setHeader('Vary', 'Origin')
          return res.end()
        }
        if (!match || req.method !== 'POST') return next()
        try {
          const backendDir = resolveBackendDir()
          const keyPath = path.resolve(backendDir, '.hexu-local/dev-key.txt')
          const key = fs.readFileSync(keyPath, 'utf8').trim()
          let body = ''
          for await (const chunk of req) {
            body += chunk
            if (body.length > 8192) throw new Error('Request too large')
          }
          const result = await fetch(`http://127.0.0.1:8088/hexu/dev/${match[1]}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-Hexu-Dev-Key': key},
            body: body || '{}'
          })
          res.statusCode = result.status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(await result.text())
        } catch {
          res.statusCode = 503
          res.end(JSON.stringify({code: 503, msg: '本地联调服务未启动'}))
        }
      })
    }
  }
}
