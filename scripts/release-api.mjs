import { isIP } from 'node:net'

export function releaseApiOrigin(value) {
  let url
  try {
    url = new URL(String(value || '').trim())
  } catch {
    throw new Error('发布小程序前请配置 VITE_HEXU_API 为公网 HTTPS 接口域名')
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  if (url.protocol !== 'https:' || !host.includes('.') || isIP(host)
    || /\.(?:local|localhost|internal)$/.test(host)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('VITE_HEXU_API 必须是 HTTPS 接口域名，不得包含 IP、本地域名、账号或路径')
  }
  return url.origin
}
