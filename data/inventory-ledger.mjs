const reasonNames = {
  ORDER_LOCK: '下单锁定',
  PAID: '支付出库',
  CANCEL: '取消订单释放',
  PURCHASE_RECEIVE: '采购收货入库',
  POINTS_REDEEM: '积分兑换出库',
  RETURN: '退货验收入库',
  RETURN_DEFECTIVE: '退货验收转残次',
  EXCHANGE_RETURN: '换货退回入库',
  EXCHANGE_SHIP: '换货发出',
  STOCKTAKE: '盘点调整',
  ADJUST: '人工库存调整',
  SHOP_MERGE_IN: '商城合并转入',
  SHOP_MERGE_OUT: '商城合并转出',
}

const filterReasons = {
  采购入库: ['PURCHASE_RECEIVE'],
  销售出库: ['ORDER_LOCK', 'PAID', 'CANCEL', 'POINTS_REDEEM'],
  售后回库: ['RETURN', 'RETURN_DEFECTIVE', 'EXCHANGE_RETURN', 'EXCHANGE_SHIP'],
  盘点: ['STOCKTAKE', 'ADJUST'],
}

export function inventoryReasonLabel(reason) {
  return reasonNames[reason] || reason || '其他库存变动'
}

export function inventoryMatchesFilter(entry, filter) {
  return !filter || filter === '全部' || (filterReasons[filter] || []).includes(entry.reason)
}

export function inventoryDeltaLabel(entry) {
  const values = [
    ['可售', entry.available_delta],
    ['锁定', entry.locked_delta],
    ['残次', entry.defective_delta],
  ]
  const changes = values.filter(([, value]) => Number.isFinite(Number(value ?? 0)) && Number(value ?? 0) !== 0)
  if (!changes.length) return '+0 库存'
  return changes.map(([name, value]) => `${Number(value) > 0 ? '+' : ''}${Number(value)} ${name}`).join(' · ')
}
