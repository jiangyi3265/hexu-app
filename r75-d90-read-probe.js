const crypto = require('node:crypto')
;(async () => {
  const origin = 'http://127.0.0.1:8088'
  const login = await fetch(origin + '/hexu/dev/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hexu-Mp-Dev': '1' },
    body: JSON.stringify({ memberId: 990410 })
  }).then(r => r.json())
  const token = login.data?.token
  if (!token) throw Error('local test login unavailable')
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const response = await fetch(origin + '/hexu/app/coupons?shopId=2', { headers: { Authorization: 'Bearer ' + token } })
  const body = await response.json()
  const rows = body.data || []
  console.log(JSON.stringify({ status: response.status, code: body.code, count: rows.length,
    deletedClaimInResponse: rows.some(r => r.id === 'CP2c956562dedc4aaaaecec2ff3b087502'),
    target: rows.filter(r => r.id === 'CP2c956562dedc4aaaaecec2ff3b087502').map(r => ({ id: r.id, status: r.status, kind: r.kind })),
    sessionHash: hash }))
})().catch(e => { console.error(e); process.exitCode = 1 })
