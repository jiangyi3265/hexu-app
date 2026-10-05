export function cartProductSnapshot(product) {
  return {
    name: String(product?.name || ''),
    spec: String(product?.spec || ''),
    asset: String(product?.asset || ''),
  }
}

export function cartDisplayProduct(line, catalog) {
  const current = (catalog || []).find(product => product.id === line?.id)
  if (current) return {...current, unavailable: false}
  const saved = line?.snapshot && typeof line.snapshot === 'object' ? line.snapshot : {}
  return {
    id: '',
    name: typeof saved.name === 'string' && saved.name.trim() ? saved.name : '商品暂不可售',
    spec: typeof saved.spec === 'string' ? saved.spec : '',
    asset: typeof saved.asset === 'string' ? saved.asset : '',
    unavailable: true,
  }
}
