// 无可领取券时，横幅引导选购，避免把用户送进无券空态。
export function couponBanner(banner, canClaim, ready) {
  if (!ready || banner.target !== 'M55' || banner.buttonText !== '领券下单') return banner
  return canClaim ? banner : {...banner, buttonText:'立即选购', target:'M04'}
}

// Only published slides are rendered. Never duplicate one image to fake a carousel.
export function publishedBanners(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter(banner => banner && typeof banner === 'object' && !Array.isArray(banner)
      && banner.enabled !== false && banner.image)
    .slice()
    .sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0))
}

export function bannerIndex(value, count) {
  const index = Number(value)
  return Number.isInteger(index) && index >= 0 && index < count ? index : 0
}
