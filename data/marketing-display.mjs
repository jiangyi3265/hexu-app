const typeNames = {
  BUNDLE: '组合套餐', GIFT: '满赠', ADDON: '加价购', EXCHANGE: '换购',
  LIMITED: '限时优惠', FULL_REDUCTION: '满减', FULL_DISCOUNT: '满折',
  FLASH: '秒杀', MEMBER: '会员价', TIER: '阶梯价'
}

const yuan = cents => (Number(cents || 0) / 100).toFixed(2)
const shanghaiTime = value => {
  const time = Number(value)
  return Number.isFinite(time) && time > 0
    ? new Date(time + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ')
    : '时间待确认'
}

export function marketingProductNames(campaign, catalog = []) {
  const body = campaign.body || {}
  const ids = campaign.kind === 'bundle'
    ? (body.items || []).map(item => item.skuId)
    : Array.isArray(body.skuIds) ? body.skuIds : String(body.skuIds || '').split(/[,，]/)
  const selected = ids.map(id => String(id).trim()).filter(id => id && id !== '全部商品')
  if (!selected.length) return '全部商品'
  return selected.map(id => catalog.find(product => product.id === id)?.name || id).join('、')
}

export function marketingOffer(body = {}) {
  if (body.type === 'FULL_REDUCTION') return `满¥${yuan(body.threshold)}减¥${yuan(body.discount)}`
  if (body.type === 'GIFT') return `满¥${yuan(body.threshold)}赠商品`
  if (body.type === 'EXCHANGE') return `满¥${yuan(body.threshold)}换购价¥${yuan(body.price)}`
  if (['BUNDLE', 'ADDON'].includes(body.type)) return `活动价¥${yuan(body.price)}`
  if (body.type === 'TIER') return '阶梯优惠以结算页为准'
  return body.rateBps ? `${Number(body.rateBps) / 1000}折` : '优惠以结算页为准'
}

export function marketingBlocks(campaigns = [], catalog = []) {
  const available = campaigns.some(campaign => campaign.available !== false)
  return [{
    type: 'hero', title: '商城优惠活动',
    subtitle: !campaigns.length ? '暂无进行中的活动' : available ? '有效活动，优惠在结算时核算' : '活动名额已满',
    asset: 'hero'
  }, ...campaigns.map(campaign => {
    const body = campaign.body || {}
    const enabled = campaign.available !== false
    return {
      type: 'rows', title: body.name || '商城活动', items: [
        {label: typeNames[body.type] || '商城活动', value: enabled ? campaign.kind === 'bundle' ? '加入购物车' : '选购商品' : '名额已满', ...(enabled ? {target: `campaign:${campaign.id}`} : {})},
        {label: '活动优惠', value: marketingOffer(body)},
        {label: '活动商品', value: marketingProductNames(campaign, catalog)},
        {label: '活动时间', value: `${shanghaiTime(body.startsAt)} 至 ${shanghaiTime(body.expiresAt)}（北京时间 UTC+08:00）`},
        {label: '活动剩余', value: Number(campaign.remaining) < 0 ? '不限' : String(campaign.remaining)},
        {label: '本人可参与', value: Number(campaign.memberRemaining) < 0 ? '不限' : String(campaign.memberRemaining)}
      ]
    }
  })]
}
