import {isFutureTimestamp} from './datetime.js'

export function sharePayload(pageId,{shopId,shopName,product,invite,agentId,group}={}){
 const shop=Number(shopId)>0?Number(shopId):2
 const home={title:shopName||'禾序商贸',path:`/pages/${shop===1?'M02':'M03'}/index?shop=${shop}`}
 if(['M05','M06','M07'].includes(pageId)&&product?.id){
  return {title:product.name||home.title,path:`/pages/M05/index?shop=${shop}&sku=${encodeURIComponent(product.id)}`}
 }
 if(pageId==='M34'&&invite?.invite&&Number(invite.shopId)===shop&&Number(invite.agentId)===Number(agentId)&&isFutureTimestamp(invite.expiresAt)){
  return {title:`${shopName||'禾序商贸'}邀您选购好物`,path:`/pages/M35/index?shop=${shop}&invite=${encodeURIComponent(invite.invite)}`}
 }
 if(pageId==='M58'&&group?.id&&group.status==='FORMING'){
  return {title:`来${shopName||'禾序商贸'}一起拼团`,path:`/pages/M58/index?shop=${shop}&group=${encodeURIComponent(group.id)}`}
 }
 return home
}
