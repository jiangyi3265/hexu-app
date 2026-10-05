const types = {
  满减券: 'FULL_REDUCTION',
  折扣券: 'DISCOUNT',
  商品券: 'PRODUCT',
  新人券: 'NEWCOMER',
  指定人群券: 'TARGETED'
}

const unexpired = (coupon, now) => Number(coupon.body?.expiresAt) > now

export function availableCouponCount(rows, now = Date.now()) {
  return rows.filter(coupon => coupon.kind === 'coupon_claim' && coupon.status === 'AVAILABLE' && unexpired(coupon, now)).length
}

export function couponStackingBlocked(quote) {
  if (typeof quote?.couponStackable === 'boolean') return !quote.couponStackable
  return Array.isArray(quote?.promotions) && quote.promotions.some(promotion => promotion.body?.stackCoupon !== true)
}

export const toggledCouponId = (selectedId, tappedId) => selectedId === tappedId ? '' : tappedId

export function couponCards(rows, {status = '全部', type = '全部类型', choose = false, orderSkuIds = [], stackBlocked = false, now = Date.now()} = {}) {
  const claimed = new Set(rows.filter(coupon => coupon.kind === 'coupon_claim').map(coupon => coupon.campaign_ref || coupon.body?.campaignId))
  return rows.filter(coupon => {
    if (!coupon.body || (coupon.kind !== 'coupon' && coupon.kind !== 'coupon_claim')) return false
    if (types[type] && coupon.body.type !== types[type]) return false
    const expired = !unexpired(coupon, now)
    if (choose) return coupon.kind === 'coupon_claim' && coupon.status === 'AVAILABLE' && !expired
    if (coupon.kind === 'coupon') return status === '全部' && coupon.status === 'ACTIVE' && !expired && !claimed.has(coupon.id)
    if (status === '可使用') return coupon.status === 'AVAILABLE' && !expired
    if (status === '已使用') return coupon.status === 'USED'
    if (status === '已过期') return expired && coupon.status !== 'USED'
    return status === '全部'
  }).map(coupon => {
    const expired = !unexpired(coupon, now)
    const soldOut = coupon.kind === 'coupon' && Number.isFinite(Number(coupon.remainingQuantity)) && Number(coupon.remainingQuantity) <= 0
    const restrictedSkus = String(coupon.body.skuIds || '').split(',').map(id => id.trim()).filter(id => id && id !== '全部商品')
    const wrongProduct = choose && restrictedSkus.length > 0 && !orderSkuIds.some(id => restrictedSkus.includes(String(id)))
    const action = wrongProduct || choose && stackBlocked ? '' : choose ? 'select' : coupon.kind === 'coupon' && !soldOut ? 'claim' : ''
    const label = soldOut ? '已领完' : choose && stackBlocked ? '不可叠加' : wrongProduct ? '不可用' : action === 'select' ? '选择' : action === 'claim' ? '领取' : coupon.status === 'USED' ? '已使用' : expired ? '已过期' : coupon.status === 'LOCKED' ? '使用中' : '已领取'
    return {
      ...coupon,
      amount: Number(coupon.body.discount || 0) / 100,
      threshold: Number(coupon.body.threshold || 0) / 100,
      title: coupon.body.name || '优惠券',
      scope: coupon.body.skuIds && coupon.body.skuIds !== '全部商品' ? '指定商品' : '全部商品',
      expiryLabel: Number.isFinite(Number(coupon.body.expiresAt)) && Number(coupon.body.expiresAt) > 0
        ? new Date(Number(coupon.body.expiresAt)).toLocaleDateString() : '未配置',
      uiAction: action,
      uiLabel: label,
      uiUnavailable: wrongProduct || choose && stackBlocked || soldOut || expired || ['USED', 'LOCKED'].includes(coupon.status)
    }
  })
}
