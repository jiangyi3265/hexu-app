export function stockSku(product) {
  return String(product.id || '')
}

export function productMatchesSearch(product, search) {
  const keyword = String(search || '').trim().toLowerCase()
  if (!keyword) return true
  return [product.name, product.id, stockSku(product), `SKU ${stockSku(product)}`]
    .some(value => String(value || '').toLowerCase().includes(keyword))
}

export function matchesProduct(product, search) {
  const keyword = String(search || '').trim().toLowerCase()
  if (!keyword) return true
  return [product.name, product.id, product.brand, product.spec, product.category, product.description]
    .some(value => String(value || '').toLowerCase().includes(keyword))
}
