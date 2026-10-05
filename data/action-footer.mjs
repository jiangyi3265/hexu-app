const unavailableTitles = new Set(['正在读取业务数据', '业务数据暂不可用', '业务数据读取失败'])

export function unavailableActionFooter(backend, pageId, subject = '业务数据', blocks = []) {
  const loading = !!backend.pageLoading?.[pageId]
  const bodyUnavailable = blocks.length === 1 && blocks[0].type === 'notice'
    && unavailableTitles.has(blocks[0].title)
  if (backend.ready && !loading && !backend.actionPageErrors?.[pageId] && !bodyUnavailable) return null
  if (backend.guest) return [{label: '登录后继续', target: 'M01'}]
  return [{
    label: loading ? `正在读取${subject}` : `重新读取${subject}`,
    target: 'action-page-refresh',
    disabled: loading || !!backend.busy
  }]
}

export function marketingFooter(campaigns) {
  if (!Array.isArray(campaigns) || !campaigns.length) return [{label: '暂无进行中的活动', disabled: true}]
  return campaigns.some(campaign => campaign.available !== false)
    ? [{label: '立即购买', target: 'M04'}]
    : [{label: '活动名额已满', disabled: true}]
}

export function purchaseReceiptFooter(order) {
  return [{
    label: order?.order_type === 'DIRECT_SHIP' ? '确认收货' : '确认收货并入库',
    target: 'stock-receive'
  }]
}
