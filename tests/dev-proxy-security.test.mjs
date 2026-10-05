import assert from 'node:assert/strict'
import test from 'node:test'
import backendProxy from '../scripts/backend-proxy.mjs'

async function callProxy({origin, host = '127.0.0.1:4177', method = 'OPTIONS', fetchSite} = {}) {
  let middleware
  backendProxy().configureServer({middlewares: {use(path, handler) {
    assert.equal(path, '/__hexu_dev')
    middleware = handler
  }}})
  const headers = {host}
  if (origin) headers.origin = origin
  if (fetchSite) headers['sec-fetch-site'] = fetchSite
  const request = {headers, method, url: '/login', socket: {remoteAddress: '127.0.0.1'}}
  const response = {statusCode: 200, headers: {}, setHeader(name, value) {this.headers[name] = value}, end(body) {this.body = body}}
  await middleware(request, response, () => {throw new Error('请求不应进入后续中间件')})
  return response
}

test('外部网页的预检和登录请求不会进入联调代理', async () => {
  for (const method of ['OPTIONS', 'POST']) {
    const response = await callProxy({origin: 'https://attacker.example', method})
    assert.equal(response.statusCode, 403)
    assert.equal(response.headers['Access-Control-Allow-Origin'], undefined)
  }
})

test('本机同源预检可用，跨站元数据和非本机 Host 被拒绝', async () => {
  const allowed = await callProxy({origin: 'http://127.0.0.1:4177'})
  assert.equal(allowed.statusCode, 204)
  assert.equal(allowed.headers['Access-Control-Allow-Origin'], 'http://127.0.0.1:4177')
  assert.equal((await callProxy({origin: 'http://127.0.0.1:4177', fetchSite: 'cross-site'})).statusCode, 403)
  assert.equal((await callProxy({host: 'attacker.example'})).statusCode, 403)
})
