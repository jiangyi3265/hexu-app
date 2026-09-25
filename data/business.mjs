export function withdrawal(amount,balance){const cents=Math.round(Number(amount)*100);if(!Number.isFinite(cents)||cents<100)return {error:'单次提现最低1元'};if(cents>balance)return {error:'可提现余额不足'};const fee=Math.round(cents*0.006);return{cents,fee,net:cents-fee}}
export function pointsTransfer(amount,balance,type='platform',sameShop=true,limit=1000){const n=Number(amount);if(!Number.isInteger(n)||n<=0)return{error:'请输入正整数积分'};if(n>limit)return{error:'超过单笔'+limit+'积分上限'};if(n>balance)return{error:'可用积分不足'};if(type==='shop'&&!sameShop)return{error:'商城积分仅限本商城内转赠'};return{amount:n,balance:balance-n}}
export function settlement(quantity=1,rate=0.03){return{retail:1000*quantity,peer:Math.round(1000*quantity*rate),center:200*quantity,ownerGross:200*quantity,ownerCost:-Math.round(1000*quantity*rate),ownerNet:200*quantity-Math.round(1000*quantity*rate)}}
export function validPhone(value){return /^1[3-9]\d{9}$/.test(value)}

