const origin = 'http://127.0.0.1:8088'
const requests = [
  ['guest-own-orders', '/hexu/app/orders?shopId=2', null],
  ['guest-account', '/hexu/app/account?shopId=2', null],
  ['member-own-orders', '/hexu/app/orders?shopId=2', 'member'],
  ['member-foreign-order', '/hexu/app/orders/HX7f5747cda1664e8db3f38c27a4f7f511', 'member'],
  ['member-missing-order', '/hexu/app/orders/HX00000000000000000000000000000000', 'member'],
  ['member-foreign-withdrawal', '/hexu/app/withdrawals/TX6f0a7e7cb0be42c9a07844bad45b58a0', 'member'],
  ['member-foreign-shop-orders', '/hexu/app/orders?shopId=992051', 'member'],
  ['member-foreign-shop-addresses', '/hexu/app/documents/address?shopId=992051', 'member'],
  ['member-finance-management', '/hexu/app/management/financeSummary?shopId=2', 'member'],
  ['member-foreign-shop-points-management', '/hexu/app/management/points?shopId=992051', 'member'],
]

;(async () => {
  const login = await fetch(origin + '/hexu/dev/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hexu-Mp-Dev': '1' },
    body: JSON.stringify({ memberId: 990408 })
  })
  const loginBody = await login.json()
  if (!login.ok || loginBody.code !== 200 || !loginBody.data?.token) throw Error('local test login unavailable')
  const token = loginBody.data.token
  for (const [name, path, role] of requests) {
    const response = await fetch(origin + path, { headers: role ? { Authorization: 'Bearer ' + token } : {} })
    let body
    try { body = await response.json() } catch { body = {} }
    const data = body.data
    console.log(JSON.stringify({ name, status: response.status, code: body.code,
      message: body.msg || body.message || null, count: Array.isArray(data) ? data.length : null,
      object: data && !Array.isArray(data) ? Object.keys(data).filter(k => !['token', 'phone', 'name', 'address'].includes(k)).slice(0, 12) : null }))
  }
})().catch(e => { console.error(e); process.exitCode = 1 })
