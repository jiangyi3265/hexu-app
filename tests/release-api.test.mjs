import test from 'node:test'
import assert from 'node:assert/strict'
import { releaseApiOrigin } from '../scripts/release-api.mjs'

test('小程序发布接口拒绝非 HTTPS、本地或 IP 源站', () => {
  assert.equal(releaseApiOrigin('https://api.example.com/'), 'https://api.example.com')
  for (const value of ['', 'http://api.example.com', 'http://127.0.0.1:8088',
    'https://localhost', 'https://192.168.1.8', 'https://10.0.0.1',
    'https://172.16.0.1', 'https://8.8.8.8', 'https://[::1]',
    'https://api.internal', 'https://api.example.com/hexu',
    'https://user:pass@api.example.com', 'https://api.example.com?x=1']) {
    assert.throws(() => releaseApiOrigin(value), value)
  }
})
