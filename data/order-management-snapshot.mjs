const rankNames = {1:'C 云代理', 2:'B 分货中心', 3:'A 总代理'}

function snapshotOf(order) {
  const raw = order.items?.[0]?.snapshot_json
  if (raw && typeof raw === 'object') return raw
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

function agentLabel(agent) {
  if (!agent) return '快照未记录'
  return `${rankNames[agent.rank] || '代理'} · 代理 ${agent.agentId} / 会员 ${agent.memberId}`
}

export function managementSnapshotDetails(order, money) {
  const snapshot = snapshotOf(order)
  const chain = Array.isArray(snapshot.chain) ? snapshot.chain : []
  const customer = chain[0]
  const peer = chain.slice(1).find(agent => Number(agent.rank) === Number(customer?.rank))
  const owner = chain.at(-1)
  const ruleId = snapshot.ruleId || order.rule_id
  const peerBps = Array.isArray(snapshot.bps) ? Number(snapshot.bps[Number(customer?.rank)]) : NaN
  const prices = Array.isArray(snapshot.prices) ? snapshot.prices.slice(1, 4) : []
  const priceLabel = prices.length === 3 && prices.every(Number.isFinite)
    ? prices.map(price => '¥' + money(price)).join(' / ') : '快照未记录'
  return {
    owner: agentLabel(owner),
    buyer: order.buyerName ? `${order.buyerName} · 会员 ${order.buyer_id}` : `会员 ${order.buyer_id}`,
    customer: agentLabel(customer),
    peer: peer ? agentLabel(peer) : '无同级上级',
    rule: ruleId ? `规则 #${ruleId}${Number.isFinite(peerBps) ? ' · ' + peerBps / 100 + '%' : ''}` : '快照未记录',
    prices: priceLabel,
    ruleEffectiveAt: order.ruleEffectiveAt || '快照未记录',
  }
}

export function managementOrderNotice(status) {
  const descriptions = {
    UNPAID:'等待买家完成支付', PAID:'买家已付款，请及时安排发货',
    SHIPPED:'商品已发出，可查看物流', COMPLETED:'交易已完成，历史快照不随当前配置变化',
    REFUNDED:'退款已处理，请核对售后记录', CANCELLED:'订单已关闭',
  }
  return descriptions[status] || '请核对订单当前状态'
}
