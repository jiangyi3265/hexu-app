export function financePage(rows, query = '', requestedPage = 1, pageSize = 8) {
 const term = String(query).trim().toLowerCase()
 const matches = term ? rows.filter(row => String(row).toLowerCase().includes(term)) : rows
 const pages = Math.max(1, Math.ceil(matches.length / pageSize))
 const page = Math.min(pages, Math.max(1, Number(requestedPage) || 1))
 return {items: matches.slice((page - 1) * pageSize, page * pageSize), page, pages, total: matches.length}
}

export function settlementInputKey(form, memberId, shopId, token) {
 return JSON.stringify([memberId, shopId, token, form.试算商品, form.归属代理, String(form.quantity ?? ''), String(form.rate ?? '')])
}

export function signedCurrency(cents) {
 const amount = Number(cents) || 0
 return (amount < 0 ? '−' : '') + '¥' + (Math.abs(amount) / 100).toFixed(2)
}

export function financeActor(key) {
 const value = String(key || '')
 return value.replace(/^member:/i, '会员 ').replace(/^staff:/i, '后台人员 ') || '—'
}
