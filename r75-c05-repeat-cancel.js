const crypto = require('node:crypto')
;(async () => {
  const origin = 'http://127.0.0.1:8088'
  const login = await fetch(origin + '/hexu/dev/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hexu-Mp-Dev': '1' },
    body: JSON.stringify({ memberId: 995055 }) }).then(r => r.json())
  const token = login.data?.token
  if (!token) throw Error('local sandbox login unavailable')
  const sessionHash = crypto.createHash('sha256').update(token).digest('hex')
  const id = 'HX7f5747cda1664e8db3f38c27a4f7f511'
  for (let n = 1; n <= 2; n++) {
    const response = await fetch(origin + '/hexu/app/commands/order-cancel', { method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
        'Idempotency-Key': `r75-c05-repeat-cancel-${n}-20261005` },
      body: JSON.stringify({ shopId: 992051, id }) })
    const body = await response.json()
    console.log(JSON.stringify({ n, status: response.status, code: body.code, message: body.msg || body.message }))
  }
  console.log('sessionHash', sessionHash)
})().catch(e => { console.error(e); process.exitCode = 1 })
