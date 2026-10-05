export function addressCheckoutPage(pages) {
  const previous = pages?.at(-2)?.route
  if (previous === 'pages/M12/index') return 'M12'
  if (previous === 'pages/G15/index') return 'G15'
  return null
}

export function backDeltaTo(pages, pageId) {
  const route = `pages/${pageId}/index`
  for (let index = pages.length - 2; index >= 0; index--) {
    if (pages[index]?.route === route) return pages.length - 1 - index
  }
  return 0
}

export function backDestination(pages, currentRoute, fallbackUrl) {
  const current = String(currentRoute || '').replace(/^\/+/, '')
  for (let index = (pages?.length || 0) - 2; index >= 0; index--) {
    const route = String(pages[index]?.route || '').replace(/^\/+/, '')
    if (route && route !== current) {
      return {delta: pages.length - 1 - index, url: `/${route}`}
    }
  }
  return {delta: 0, url: fallbackUrl}
}
