const crypto = require('node:crypto')
;(async () => {
  const url = 'http://127.0.0.1:8088/hexu/app/management/reports/REPORT86fe464cfb014adea19fefe8dcad01b1/export?dimension=ORDER'
  const guest = await fetch(url)
  console.log(JSON.stringify({ role: 'guest', status: guest.status, type: guest.headers.get('content-type'), bytes: (await guest.arrayBuffer()).byteLength }))
  const login = await fetch('http://127.0.0.1:8088/hexu/dev/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hexu-Mp-Dev': '1' },
    body: JSON.stringify({ memberId: 990408 }) }).then(r => r.json())
  const token = login.data?.token
  if (!token) throw Error('local sandbox login unavailable')
  const member = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  console.log(JSON.stringify({ role: 'member990408', status: member.status, type: member.headers.get('content-type'),
    disposition: member.headers.get('content-disposition'), bytes: (await member.arrayBuffer()).byteLength,
    sessionHash: crypto.createHash('sha256').update(token).digest('hex') }))
})().catch(e => { console.error(e); process.exitCode = 1 })
