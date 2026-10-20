import {backend} from './backend.js'
import {products,state} from './store.js'
import {sharePayload} from './share.mjs'

export function currentSharePayload(pageId){
 const product=products.find(item=>item.id===state.selectedProduct)
 return sharePayload(pageId,{
  shopId:backend.shopId,
  shopName:backend.shopInfo?.name||state.shop,
  product,
  invite:backend.activeInvite,
  agentId:backend.agent?.id,
  group:backend.groupDetail
 })
}
