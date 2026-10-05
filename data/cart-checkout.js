export function consumePurchasedCartLines(cart, purchased) {
  const quantities = new Map()
  for (const item of purchased || []) {
    const qty = Number(item.qty)
    if (Number.isSafeInteger(qty) && qty > 0) {
      const id = String(item.id)
      quantities.set(id, (quantities.get(id) || 0) + qty)
    }
  }
  return (cart || []).flatMap(line => {
    const used = quantities.get(String(line.id)) || 0
    if (!used) return [line]
    const remaining = Number(line.qty) - used
    return remaining > 0 ? [{...line, qty: remaining}] : []
  })
}

export function checkoutLinesReady(lines, catalog) {
  if (!Array.isArray(lines) || !lines.length) return false
  const products = new Map((catalog || []).map(product => [product.id, product]))
  return lines.every(line => {
    const product = products.get(line.id)
    const qty = Number(line.qty)
    const price = Number(product?.price)
    return !!product && product.price != null && Number.isSafeInteger(qty) && qty > 0 &&
      Number.isSafeInteger(price) && price >= 0
  })
}

export function beginCheckout(state, buyNow = null) {
  // 新结算单不继承上一单的优惠券、积分选择和留言。
  state.buyNow = buyNow
  state.couponId = null
  state.checkoutPoints = null
  if (state.changes?.M12) delete state.changes.M12
}
