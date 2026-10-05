export function purchaseQuantityLimit(product) {
  const stock = Number(product?.stock)
  if (!Number.isSafeInteger(stock) || stock < 1) return 0
  if (product.crossPurchaseRemaining == null) return stock
  const remaining = Number(product.crossPurchaseRemaining)
  return Number.isSafeInteger(remaining) && remaining >= 0 ? Math.min(stock, remaining) : 0
}

export function productQuantity(selection, shopId, memberId, productId, stock) {
  const sameProduct = selection?.shopId === shopId && selection?.memberId === memberId && selection?.productId === productId
  const quantity = sameProduct ? selection.qty : 1
  if (!Number.isSafeInteger(quantity) || quantity < 1) return 1
  return Number.isSafeInteger(stock) && stock > 0 ? Math.min(quantity, stock) : 1
}
