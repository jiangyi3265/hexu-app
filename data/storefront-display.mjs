export function homeProductList(products, decoration = {}, sort = 'default') {
  const configured = decoration.homeProducts
  const ids = Array.isArray(configured)
    ? configured.map(item => typeof item === 'string' ? item : item?.skuId || item?.id).filter(Boolean)
    : null
  const byId = new Map(products.map(product => [product.id, product]))
  const list = ids === null
    ? products.slice(0, 4)
    : [...new Set(ids)].map(id => byId.get(id)).filter(Boolean).slice(0, 4)
  if (sort === 'sales') list.sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0))
  if (sort === 'asc' || sort === 'desc') list.sort((a, b) => sort === 'asc' ? a.price - b.price : b.price - a.price)
  return list
}

export function homeShortcutList(decoration = {}) {
  if (!Array.isArray(decoration.categories)) return []
  return decoration.categories
    .filter(item => item && item.enabled !== false)
    .slice()
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
    .map(item => [item.name || item.title || '', item.icon || 'grid', item.target || 'M04'])
    .filter(item => item[0])
    .slice(0, 5)
}

export function updatedBanners(original = [], uploads, brandName = '') {
  if (original != null && !Array.isArray(original)) throw new Error('轮播配置格式错误，请在后台管理修复')
  const banners = Array.isArray(original) ? original : []
  if (banners.some(banner => !banner || typeof banner !== 'object' || Array.isArray(banner))) throw new Error('轮播配置格式错误，请在后台管理修复')
  if (!Array.isArray(uploads)) return banners.map(banner => ({...banner}))
  if (uploads.some(image => typeof image !== 'string' || !image)) throw new Error('轮播图片格式错误')
  const images = uploads
  const configuredImages = banners.filter(banner => banner.image).map(banner => banner.image)
  if (images.length === configuredImages.length && images.every((image, index) => image === configuredImages[index])) return banners.map(banner => ({...banner}))
  const originals = banners.map(banner => ({...banner}))
  const reserved = new Set(originals.map((banner, index) => images.includes(banner.image) ? index : -1).filter(index => index >= 0))
  const used = new Set()
  const result = images.map((image, index) => {
    let source = originals.findIndex((banner, at) => !used.has(at) && banner.image === image)
    if (source < 0 && originals[index] && !reserved.has(index) && !used.has(index)) source = index
    if (source >= 0) used.add(source)
    const previous = source >= 0 ? originals[source] : {}
    return {...previous, image, title:previous.title || brandName, target:previous.target || 'M04'}
  })
  return [...result, ...originals.filter((banner, index) => !banner.image && !used.has(index))]
}

const addressUsageOptions = ['家', '公司', '学校', '其他']

// Old published page schemas can remain active after a client update.
// Preserve merchant copy/layout while enforcing the current address fields.
export function normalizeAddressScreen(screen) {
  for (const block of screen?.blocks || []) {
    if (block.type !== 'fields') continue
    for (const item of block.items || []) {
      if (item.key === 'region' || item.label === '所在地区') {
        item.key = 'region'
        item.kind = 'addressRegion'
        item.value = ''
        item.options = null
        item.required = true
      } else if (item.key === 'usage' || item.label === '地址用途') {
        item.key = 'usage'
        item.kind = 'select'
        item.options = [...addressUsageOptions]
        item.value = addressUsageOptions.includes(item.value) ? item.value : '家'
      }
    }
  }
  return screen
}
