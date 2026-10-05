export function checkoutDiscountLabel(quote, group = false) {
  if (group) return '拼团优惠'
  const promotion = Number(quote?.promotionDiscount) || 0
  const coupon = Number(quote?.couponDiscount) || 0
  return promotion > 0 ? coupon > 0 ? '活动及优惠券' : '活动优惠' : '优惠券'
}
