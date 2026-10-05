// Only navigation and recovery context may survive a cold start. Visible
// account data is read again from /hexu/app/bootstrap before being shown.
export function initialState(saved = {}) {
  const cached = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  // 仅保留积分开关的账号范围，真实积分与购物车仍从服务端重新读取。
  return {
    ...cached,
    cart: [], favorites: [], browseHistory: [], addresses: [], orders: [], notifications: [],
    points: 0, shopPoints: 0, balance: 0, shop: '',
    changes: {}, checkoutPoints: cached.checkoutPoints && typeof cached.checkoutPoints === 'object' ? cached.checkoutPoints : null, signedIn: false, signedToday: false,
    serverHydrated: false, serverCartId: null, serverFavoriteId: null,
    couponId: null, lastWithdrawal: null,
    withdrawalView: cached.withdrawalView && /^TX[0-9a-f]{32}$/.test(cached.withdrawalView.id || '')
      && Number.isSafeInteger(cached.withdrawalView.memberId) && Number.isSafeInteger(cached.withdrawalView.shopId)
      ? { id: cached.withdrawalView.id, memberId: cached.withdrawalView.memberId, shopId: cached.withdrawalView.shopId } : null,
    lastTransferReceipt: null,
    lastRedemption: null, pendingTransfer: null,
    wholesaleSku: null, wholesaleCheckout: false
  }
}
