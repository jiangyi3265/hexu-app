import {reactive} from 'vue'
import {state,products,persist,toast,navigate,money} from './store'
import {currentPolicyVersions,merchantApplicationPayload,merchantCertificatePayload,directAfterSalePayload,trackingTimeline} from './compliance.js'
import {profilePayload,hydrateProfile,profileFields} from './profile.js'
import {isValidRegion} from './region-picker.mjs'
import {paymentNotice,paymentState} from './payment-clock.js'
import {timestamp,dateTimeLabel,isFutureTimestamp} from './datetime.js'
import {inventoryReasonLabel,inventoryMatchesFilter,inventoryDeltaLabel} from './inventory-ledger.mjs'
import {managementSnapshotDetails,managementOrderNotice} from './order-management-snapshot.mjs'
import {filterReviews,reviewPayload} from './reviews.js'
import {supportPayload,visibleSupportRecords} from './support.js'
import {sandboxMemberId} from './dev-entry.mjs'
import {refundApplicationPayload} from './aftersale.js'
import {beginCheckout,checkoutLinesReady,consumePurchasedCartLines} from './cart-checkout.js'
import {cartProductSnapshot} from './cart-item-display.mjs'
import {couponStackingBlocked} from './coupons.js'
import {updatedBanners} from './storefront-display.mjs'
import {catalogEditorValues} from './catalog-editor.mjs'
import {notificationText,notificationTemplateForEditor,notificationTemplateForSave} from './notification-display.mjs'
import {pointRiskPayload} from './point-risk.mjs'
import {pointsRulePayload} from './points-rule.mjs'
import {marketingBlocks} from './marketing-display.mjs'
import {financePage,settlementInputKey,signedCurrency,financeActor} from './finance-view.mjs'
import {wholesalePlan,wholesaleQtyKey} from './wholesale-order.mjs'
import {withdrawal,withdrawalOutcome,refundInspectionForm,afterSaleDetailPage,managementAfterSalePage,afterSaleStatusLabel,afterSaleReductionRows} from './business.mjs'
// H5 本地开发依赖 Vite 代理；微信开发者工具不会经过该代理，因此本地小程序需要直连 Java 服务。
// 真机/生产环境请通过 VITE_HEXU_API 配置可访问的 HTTPS 地址覆盖此默认值。
let apiBase=import.meta.env.VITE_HEXU_API||''
// #ifdef MP-WEIXIN
if(!apiBase)apiBase='http://127.0.0.1:8088'
// #endif
const localSandbox=()=>/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(apiBase)||(!apiBase&&import.meta.env.DEV)
const WHOLESALE_SHOP_ID=900
const PURCHASE_AGREEMENT='PURCHASE_AGREEMENT'
const PURCHASE_ORDER_TYPES=new Set(['WHOLESALE','DIRECT_SHIP'])
const PURCHASE_ORDER_ID_PATTERN=/^[A-Za-z0-9_-]{4,128}$/
function ownPurchaseOrder(order,memberId,shopId){
 return PURCHASE_ORDER_TYPES.has(order?.order_type)&&
  Number(order.shop_id)===WHOLESALE_SHOP_ID&&
  Number(order.destination_shop_id)===Number(shopId)&&
  Number(order.buyer_id)===Number(memberId)
}
export const isLocalSandbox=()=>localSandbox()
export function wholesalePagePlan(pageId,form={}){
 const context=pageId==='G14'?state.wholesaleDraft:state.wholesaleContext
 const plan=wholesalePlan(context,backend.wholesaleProducts||[],pageId==='G14'?form:{},backend.wholesaleRules)
 if(pageId==='G15'&&!plan.error&&context.lines.some(line=>Number(line.price)!==Number(plan.lines.find(item=>item.sku.id===line.id)?.sku.price)))return {...plan,error:'采购价格已变化，请返回采购清单重新确认'}
 return plan
}
function displayOrderPhone(phone,masked){
 const value=typeof phone==='string'?phone:''
 if(!masked||!value)return value
 return /^1[3-9]\d{9}$/.test(value)?value.replace(/^(\d{3})\d{4}(\d{4})$/,'$1****$2'):'****'
}
export {apiBase}
export const backend=reactive({pageLoading:{},financeErrors:{},staffAccounts:[],staffLookup:null,auditDetail:null,ruleVersions:null,marketingPreview:null,marketingBuyer:null,previewCustomers:[],previewCatalog:[],operationError:'',systemDoc:null,notificationTemplates:[],reports:{},reportPages:{},reportJobs:[],reportErrors:{},ready:false,guest:false,loading:false,paymentResultNavigating:null,token:'',shopId:2,catalogShopId:null,loginReturn:null,productSelection:null,shopInfo:null,storefront:{decoration:{},pages:{},categories:[]},member:null,agent:null,agentData:null,account:{},management:{},shops:[],campaigns:[],coupons:[],couponPolicy:null,reviews:[],documents:{},supportRecords:[],selectedSupportId:'',error:'',activeOrder:null,refund:null,merchant:null,tracking:null,policies:{},consents:[],openPolicy:null,afterSaleLinks:[],afterSaleCandidates:[],afterSaleCandidateError:'',pickOrders:[],pickPrint:null,withdrawalDetail:null})
export function homePageId(){return backend.shopInfo?.kind==='DEALER'||Number(backend.shopId)===2?'M03':'M02'}
export function rememberLoginReturn(pageId){
 if(!/^[MG]\d{2}$/.test(pageId)||pageId==='M01')return;
 backend.loginReturn={pageId,shopId:backend.shopId,sku:state.selectedProduct||'',invite:state.invite||'',group:state.selectedGroup||'',at:Date.now()};
}
export function clearLoginReturn(){backend.loginReturn=null}
function pendingLoginReturn(){const pending=backend.loginReturn;return pending&&Date.now()>=pending.at&&Date.now()-pending.at<=15*60*1000&&Number(pending.shopId)===Number(backend.shopId)?pending:null}
function consumeLoginReturn(){
 const pending=pendingLoginReturn();clearLoginReturn();
 if(!pending)return homePageId();
 if(pending.sku)state.selectedProduct=pending.sku;
 if(pending.invite)state.invite=pending.invite;
 if(pending.group)state.selectedGroup=pending.group;
 persist();
 return pending.pageId;
}
function entryOptions(){try{return getCurrentPages().at(-1)?.options||{}}catch{return {}}}
function clearAccountOrderContext(){
  state.activeOrder=null;state.purchaseOrder=null;state.selectedRefund=null;state.reviewBrowse=null;state.reviewParent=null;state.directAfterSale=null;state.checkoutPoints=null;
  state.withdrawalView=null;
 backend.activeOrder=null;backend.refund=null;backend.crossPurchaseDraft=null;backend.crossPurchaseProduct=null;backend.crossOrderHomeShopId=null;backend.crossOrderPendingId='';
}
function clearMemberView(){
 clearAccountOrderContext();backend.ready=false;backend.member=null;backend.agent=null;backend.profile=null;backend.profileMemberId=null;backend.account={};backend.coupons=[];backend.management={};
 backend.shopInfo=null;backend.storefront={decoration:{},pages:{},categories:[]};backend.catalogShopId=null;backend.documents={};backend.supportRecords=[];backend.agentData=null;
 backend.withdrawalDetail=null;backend.managementWithdrawal=null;backend.earningDetail=null;backend.merchant=null;backend.reviews=[];backend.tracking=null;backend.redemptionOrder=null;
 state.serverHydrated=false;state.signedIn=false;state.lastHydratedIdentity=null;state.cart=[];state.orders=[];state.addresses=[];state.favorites=[];state.browseHistory=[];state.notifications=[];
  state.serverCartId=null;state.serverFavoriteId=null;state.couponId=null;state.checkoutPoints=null;state.cartCheckouts={};state.pendingPaymentOrder=null;state.wholesaleContext=null;state.wholesaleDraft=null;state.wholesaleSku=null;backend.wholesaleProducts=[];backend.wholesaleRules=null;
 state.lastRedemption=null;state.lastWithdrawal=null;state.selectedWithdrawal=null;state.selectedEarning=null;state.points=0;state.shopPoints=0;state.balance=0;state.shop='';products.splice(0,products.length);
}
export function enterGuestBrowsing(){
 renewedSession=null;backend.token='';clearMemberView();backend.guest=true;backend.error='';
 uni.removeStorageSync('hexu-api-token');uni.setStorageSync('hexu-guest-browse',true);persist();
}
let bootPromise
backend.profile=null
backend.profileMemberId=null
backend.profileError=''
let profileLoadVersion=0
let renewedSession=null
function sameProfileAccount(memberId,token){
 return Number(backend.member?.id)===Number(memberId)&&
  (backend.token===token||localSandbox()&&renewedSession?.from===token&&renewedSession.to===backend.token&&Number(renewedSession.memberId)===Number(memberId))
}
export async function loadProfile(form,replaceForm=false){
 const version=++profileLoadVersion
 backend.profileError=''
 const memberId=backend.member?.id,token=backend.token
 if(backend.profileMemberId!=null&&Number(backend.profileMemberId)!==Number(memberId)){backend.profile=null;backend.profileMemberId=null}
 try{const profile=await request('/hexu/app/profile');if(version!==profileLoadVersion)return backend.profile;if(!sameProfileAccount(memberId,token))throw new Error('登录账号已变化，请重新读取个人资料');backend.profile=profile;backend.profileMemberId=memberId;if(form&&(replaceForm||!form._hydrated||Number(form._profileMemberId)!==Number(memberId))){hydrateProfile(form,profile);form._profileMemberId=memberId}return profile}
 catch(e){if(version!==profileLoadVersion)return backend.profile;if(sameProfileAccount(memberId,token))backend.profileError=e.message;throw e}
}
export async function authorizeProfilePhone(code,form){
 const memberId=backend.member?.id,token=backend.token
 if(form&&Number(form._profileMemberId)!==Number(memberId))throw new Error('登录账号已变化，请重新读取个人资料')
 const profile=await request('/hexu/app/profile/phone',{code},'POST')
 if(!sameProfileAccount(memberId,token)){if(form)form._hydrated=false;toast('原账号手机号已更新，请切回原账号核对');return null}
 profileLoadVersion++
 backend.profileError=''
 if(form)form.phone=profile.phone
 if(backend.profile&&Number(backend.profileMemberId)===Number(memberId))backend.profile.phone=profile.phone
 if(backend.member)backend.member.phone=profile.phone
 toast('手机号已更新')
 return profile
}
export const operationRoles={'商城负责人':'OWNER','商品人员':'CATALOG','订单人员':'ORDER','财务人员':'FINANCE','仓储人员':'WAREHOUSE','客服人员':'SUPPORT','运营人员':'OPERATOR'}
export const notificationEvents={'订单支付':'ORDER_PAID','订单发货':'ORDER_SHIPPED','订单完成':'ORDER_COMPLETED','售后状态':'REFUND_UPDATED','提现结果':'WITHDRAW_UPDATED','库存预警':'INVENTORY_LOW','积分变动':'POINTS_UPDATED','代理业务':'AGENT_UPDATED','系统消息':'SYSTEM'}
const statusNames={QUEUED:'排队中',RUNNING:'生成中',RELEASED:'已解除冻结',RETAINED:'继续冻结',ACTIVE:'正常',INACTIVE:'已停用',FROZEN:'已冻结',AGENT:'营销代理',BOSS:'营销老板',LINK_DIRECT:'联动直推订单奖',LINK_ORDER:'联动本人订单奖',LINK_PEER:'联动平级奖',LINK_COST:'商城联动奖励支出',REFUND_LINK_DIRECT:'联动直推奖冲正',REFUND_LINK_ORDER:'联动订单奖冲正',REFUND_LINK_PEER:'联动平级奖冲正',REFUND_LINK_COST:'联动支出冲正',MATCHED:'账单一致',AMOUNT_MISMATCH:'金额差异',STATUS_MISMATCH:'回执待核验',REFERENCE_MISMATCH:'渠道流水不符',MERCHANT_MISMATCH:'商户号不符',OUT_OF_SCOPE:'商城归属不符',UNKNOWN_BUSINESS:'未找到业务单',RESOLVED:'调整已入账',RECON_ADJUST:'对账调整',RECEIPT:'销售收款',REFUND:'退款支出',UNPAID:'待付款',PAID:'待发货',SHIPPED:'待收货',COMPLETED:'已完成',CANCELLED:'已取消',REFUNDED:'已退款',PENDING:'待审核',SUPPLEMENT:'待补充资料',APPROVED:'审核通过',REJECTED:'已驳回',REVIEW_REQUIRED:'生效条件变化待复核',WAIT_RETURN:'待退货',WAIT_EXCHANGE:'待换货发出',EXCHANGE_SHIPPED:'换货已发出',CLOSED:'已关闭',SUCCESS:'已退款',FAILED:'失败',AVAILABLE:'可提现'}
const withdrawalLabel=s=>({PENDING:'待审核',SUPPLEMENT:'待补充资料',APPROVED:'审核通过，待付款',PROCESSING:'付款处理中',PAID:'已到账',FAILED:'付款失败，已退回余额',REJECTED:'审核驳回，已退回余额'}[s]||s);
async function openMerchantTransfer(data){
  if(!data?.package)throw new Error('渠道未返回收款确认参数，请稍后查询');
  // #ifdef MP-WEIXIN
  if(!wx.canIUse('requestMerchantTransfer'))throw new Error('当前微信版本不支持商家转账收款确认，请升级微信');
  await new Promise((resolve,reject)=>wx.requestMerchantTransfer({mchId:data.mchId,subMchId:data.subMchId||undefined,appId:data.appId,package:data.package,success:resolve,fail:reject}));
  return true;
  // #endif
  throw new Error('请在微信小程序内确认微信零钱收款');
}
const label=s=>statusNames[s]||({RETAIL:'零售毛利',LEVEL:'级差收益',PEER:'同级分红',GROUP_FAILED:'拼团失败自动退款',FORMING:'待成团',FORMED:'已成团',INVITE_REWARD:'邀请订单奖励',INVITE_COST:'商城邀请奖励支出',REFUND_INVITE_REWARD:'邀请奖励冲正',REFUND_INVITE_COST:'邀请奖励支出冲正',PROMOTION_COST:'商城优惠承担',REFUND_PROMOTION_COST:'优惠成本冲正',PEER_COST:'商城分红支出',REFUND_RETAIL:'零售收益冲正',REFUND_LEVEL:'级差收益冲正',REFUND_PEER:'分红收入冲正',REFUND_PEER_COST:'分红支出冲正',PAYOUT:'提现付款',ORDER_REWARD:'购物赠送',ORDER_USE:'订单抵扣',REFUND_RETURN:'退款返还',REFUND_RECLAIM:'退款追回',TRANSFER_IN:'转赠收入',TRANSFER_OUT:'转赠支出',CHECKIN:'每日签到',REDEMPTION:'积分兑换',REVIEW_REWARD:'评价赠送',EXPIRE:'积分到期',RETURN_EXPIRED:'返还积分已超过原有效期',DEBT_OFFSET:'抵扣待追回积分',SCHEDULED:'待生效',APPLIED:'已生效'}[s])||s
function uuid(){return 'req-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,14)}
function requestOnce(path,data,method,idempotency,token){return new Promise((resolve,reject)=>uni.request({url:apiBase+path,method,data,header:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(path.startsWith('/hexu/dev/')?{'X-Hexu-Mp-Dev':'1'}:{}),...(idempotency?{'Idempotency-Key':idempotency}:{})},success:r=>{if(r.statusCode>=200&&r.statusCode<300&&r.data?.code===200){resolve(r.data.data);return}const error=new Error(r.data?.msg||'接口请求失败');error.authExpired=r.statusCode===401||r.data?.code===401;reject(error)},fail:()=>reject(new Error('无法连接业务服务，请检查后台是否启动'))}))}
let devSessionRenewal
function requestIdentity(memberId){return {memberId:Number(memberId||backend.member?.id||uni.getStorageSync('hexu-member-id'))||0,shopId:Number(backend.shopId),token:backend.token,guest:!!backend.guest}}
function sameRequestIdentity(identity){
 const currentMemberId=Number(backend.member?.id||uni.getStorageSync('hexu-member-id'))||0
 return (!currentMemberId||currentMemberId===identity.memberId)&&Number(backend.shopId)===identity.shopId&&backend.token===identity.token&&!!backend.guest===identity.guest
}
function renewedRequestToken(identity){
 // 仅允许本次请求所属会员及商城的本地沙盒续期；外部登录换 token 不能继承旧请求。
 const currentMemberId=Number(backend.member?.id||uni.getStorageSync('hexu-member-id'))||0
 return !backend.guest&&renewedSession?.from===identity.token&&renewedSession.to===backend.token&&renewedSession.memberId===identity.memberId&&renewedSession.shopId===identity.shopId&&(!currentMemberId||currentMemberId===identity.memberId)&&Number(backend.shopId)===identity.shopId?backend.token:null
}
export async function request(path,data,method='GET',idempotency,memberId){
 const identity=requestIdentity(memberId)
 // JSON 请求正文在发起时定稿，续期重试不能读取之后被页面改动的草稿。
 const payload=data==null?data:JSON.parse(JSON.stringify(data))
 try{return await requestOnce(path,payload,method,idempotency,identity.token)}catch(error){
  if(!error.authExpired||path.startsWith('/hexu/dev/')||path.startsWith('/__hexu_dev/'))throw error
  if(!sameRequestIdentity(identity)){
   const token=renewedRequestToken(identity)
   if(!token)throw new Error('登录账号或商城已变化，请重新操作')
   const result=await requestOnce(path,payload,method,idempotency,token)
   if(!renewedRequestToken(identity))throw new Error('登录账号或商城已变化，请重新操作')
   return result
  }
  if(!localSandbox()){
   renewedSession=null;backend.token='';backend.ready=false;backend.error='登录已失效，请重新登录';state.serverHydrated=false
   backend.member=null;backend.profile=null;backend.profileMemberId=null;backend.agent=null;backend.account={};backend.coupons=[];backend.activeOrder=null;backend.management={}
   state.cart=[];state.orders=[];state.addresses=[];state.favorites=[];state.browseHistory=[];state.notifications=[]
   uni.removeStorageSync('hexu-api-token')
   throw new Error(backend.error)
  }
  // 游客不能使用留在本地的旧会员 ID 续期；空 token 也不应触发开发登录。
  if(identity.guest||!identity.token||!identity.memberId)throw error
  if(!devSessionRenewal||!sameRequestIdentity(devSessionRenewal.identity)){
   const renewal={identity,promise:null}
   devSessionRenewal=renewal
   renewal.promise=(async()=>{
    const loginPath=apiBase?'/hexu/dev/login':'/__hexu_dev/login'
    const result=await requestOnce(loginPath,{memberId:identity.memberId},'POST',undefined,'')
    if(!result?.token)throw new Error('开发环境登录失败')
    if(!sameRequestIdentity(identity))throw new Error('登录账号或商城已变化，请重新操作')
    renewedSession={from:identity.token,to:result.token,memberId:identity.memberId,shopId:identity.shopId}
    backend.token=result.token;uni.setStorageSync('hexu-api-token',result.token)
   })().finally(()=>{if(devSessionRenewal===renewal)devSessionRenewal=null})
  }
  await devSessionRenewal.promise
  const token=renewedRequestToken(identity)
  if(!token)throw new Error('登录账号或商城已变化，请重新操作')
  const result=await requestOnce(path,payload,method,idempotency,token)
  if(!renewedRequestToken(identity))throw new Error('登录账号或商城已变化，请重新操作')
  return result
 }
}
export async function apiCommand(operation,data={},management=false,key){
 const body={shopId:backend.shopId,...data};const signature=JSON.stringify([backend.member?.id,management,operation,body]);let hash=2166136261;for(const ch of signature)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
 const cacheKey='hexu-retry-'+(hash>>>0);const idempotency=key||uni.getStorageSync(cacheKey)||uuid();uni.setStorageSync(cacheKey,idempotency);
 const result=await request('/hexu/app/'+(management?'management/':'commands/')+operation,body,'POST',idempotency);uni.removeStorageSync(cacheKey);return result;
}
export async function connect(){if(bootPromise)return bootPromise;bootPromise=(async()=>{backend.loading=true;try{const entry=entryOptions();let memberId=sandboxMemberId(entry,localSandbox()),shopId=Number(entry.shop)||Number(uni.getStorageSync('hexu-shop-id'))||2;if(entry.sku)state.selectedProduct=entry.sku;if(entry.invite)state.invite=entry.invite;if(entry.group)state.selectedGroup=entry.group;
 // #ifdef H5
 const params=new URLSearchParams(location.search);const hashQuery=location.hash.split('?')[1];const hp=new URLSearchParams(hashQuery||'');if(params.get('sku')||hp.get('sku'))state.selectedProduct=params.get('sku')||hp.get('sku');memberId=Number(params.get('member')||hp.get('member')||uni.getStorageSync('hexu-member-id'))||201;shopId=Number(params.get('shop')||hp.get('shop'))||shopId;state.selectedGroup=params.get('group')||hp.get('group')||state.selectedGroup||'';state.invite=params.get('invite')||hp.get('invite')||state.invite||'';
 // #endif
 if(localSandbox()){const previousMemberId=Number(uni.getStorageSync('hexu-member-id'));if(previousMemberId>0&&previousMemberId!==memberId)clearAccountOrderContext()}
 backend.shopId=shopId;uni.setStorageSync('hexu-shop-id',shopId);renewedSession=null;backend.token=uni.getStorageSync('hexu-api-token')||'';
 if(localSandbox()){
  // H5 通过 Vite 代理转发并补开发密钥；MP 开发构建直接访问本机 Java 服务。
  const devLoginPath=apiBase?'/hexu/dev/login':'/__hexu_dev/login';
  const r=await request(devLoginPath,{memberId},'POST');backend.token=r.token;uni.setStorageSync('hexu-api-token',r.token);uni.setStorageSync('hexu-member-id',memberId)
 }
 if(!backend.token)throw new Error('请先通过微信授权登录');await refresh();backend.ready=true;backend.guest=false;backend.error='';uni.removeStorageSync('hexu-guest-browse');return true}catch(e){if(e instanceof StaleRefreshError)return false;backend.error=e.message;toast(e.message);return false}finally{backend.loading=false;bootPromise=null}})();return bootPromise}
function normalizedOrder(o){return {...o,rawStatus:o.status,status:o.status==='PAID'&&o.group?.status==='FORMING'?'待成团':label(o.status),items:(o.items||[]).map(l=>({...l,lineId:l.id,id:l.sku_id,qty:l.qty,unitPrice:l.unit_price})),total:Number(o.total),subtotal:Number(o.subtotal)}}
const reviewLineProduct=line=>({id:line.id,name:line.name,price:line.unitPrice,asset:typeof line.asset==='string'?line.asset:'',spec:typeof line.spec==='string'?line.spec:''});
const guestPages=['M02','M03','M04','M05','M07'];
async function guestCatalog(){
 backend.guest=false;backend.ready=false;backend.member=null;backend.account={};backend.reviews=[];backend.shopInfo=null;backend.storefront={decoration:{},pages:{},categories:[]};backend.catalogShopId=null;
 state.cart=[];state.orders=[];state.addresses=[];state.favorites=[];state.browseHistory=[];state.notifications=[];state.points=0;state.shopPoints=0;state.balance=0;
 state.shop='';products.splice(0,products.length);
 const shops=await request('/hexu/app/shops'),shop=shops.find(x=>Number(x.id)===Number(backend.shopId));
 if(!shop||shop.kind==='WHOLESALE')throw new Error('该商城暂不支持游客浏览');
 const [catalog,storefront]=await Promise.all([request('/hexu/app/guest/products',{shopId:backend.shopId}),request('/hexu/app/storefront',{shopId:backend.shopId})]);
 backend.shops=shops;backend.shopInfo=shop;backend.storefront=storefront||{decoration:{},pages:{},categories:[]};backend.catalogShopId=backend.shopId;backend.guest=true;backend.error='';state.shop=shop.name;
 products.splice(0,products.length,...catalog.map(p=>({...p,price:Number(p.price),stock:0,desc:p.description||p.spec||''})));
}
const paidOrderStatuses=['PAID','SHIPPED','COMPLETED','REFUNDED'];
async function confirmedPayment(id){const order=normalizedOrder(await request('/hexu/app/orders/'+encodeURIComponent(id)));backend.activeOrder=order;return paidOrderStatuses.includes(order.rawStatus)}
async function finishPaidOrder(id){
 const checkout=state.cartCheckouts?.[id],fromCart=checkout&&Number(checkout.shopId)===Number(backend.shopId)&&Number(checkout.memberId)===Number(backend.member?.id);
 state.pendingPaymentOrder=null;if(state.activeOrder===id)state.buyNow=null;state.activeOrder=id;persist();
 try{
  await refresh();
  if(fromCart){state.cart=consumePurchasedCartLines(state.cart,checkout.items);persist();await syncCart();delete state.cartCheckouts[id];state.cartSyncPendingOrder=null;persist()}
 }catch(e){if(fromCart){state.cartSyncPendingOrder=id;persist()}toast((fromCart?'支付已确认，购物车同步失败，请从订单详情重试：':'支付已确认，资料刷新失败：')+e.message)}
 navigate(state.purchaseOrder===id?'G16':'M16')
}
class StaleRefreshError extends Error{constructor(){super('资料读取已过期')}}
export async function refresh(){
 const token=backend.token,shopId=backend.shopId,memberId=backend.member?.id
 const current=()=>Number(backend.shopId)===Number(shopId)&&
  (backend.token===token||localSandbox()&&memberId!=null&&renewedSession?.from===token&&renewedSession.to===backend.token&&Number(renewedSession.memberId)===Number(memberId)&&(backend.member==null||Number(backend.member.id)===Number(memberId)))
 const requireCurrent=()=>{if(!current())throw new StaleRefreshError()}
 const rethrowCurrent=e=>{if(!backend.token&&backend.error==='登录已失效，请重新登录')throw e;requireCurrent();throw e}
 if(backend.catalogShopId!==backend.shopId){
  if(backend.catalogShopId!=null)state.selectedRefund=null;
  backend.shopInfo=null;backend.storefront={decoration:{},pages:{},categories:[]};backend.catalogShopId=null;backend.member=null;backend.agent=null;backend.account={};backend.activeOrder=null;backend.refund=null;backend.merchant=null;backend.management={};backend.coupons=[];backend.withdrawalDetail=null;backend.managementWithdrawal=null;backend.earningDetail=null;backend.afterSaleLinks=[];backend.afterSaleCandidates=[];
  state.shop='';state.orders=[];state.cart=[];state.addresses=[];state.favorites=[];state.browseHistory=[];state.couponId=null;state.lastWithdrawal=null;state.selectedWithdrawal=null;state.selectedEarning=null;state.points=0;state.shopPoints=0;state.balance=0;state.serverCartId=null;state.serverFavoriteId=null;state.serverHydrated=false;products.splice(0,products.length)
 }let data
 try{data=await request('/hexu/app/bootstrap',{shopId},'GET',undefined,memberId)}catch(e){rethrowCurrent(e)}
 requireCurrent() // 旧账号或旧商城的异步响应不得回写全局资料。
 const previousMemberId=backend.member?.id,previousIdentity=state.lastHydratedIdentity;if(previousIdentity&&(Number(previousIdentity.memberId)!==Number(data.member.id)||Number(previousIdentity.shopId)!==Number(data.shop.id)))clearAccountOrderContext();state.lastHydratedIdentity={memberId:Number(data.member.id),shopId:Number(data.shop.id)};backend.member=data.member;if(previousMemberId!=null&&Number(previousMemberId)!==Number(data.member.id)){backend.coupons=[];state.couponId=null;backend.refund=null;state.selectedRefund=null;backend.withdrawalDetail=null;backend.managementWithdrawal=null;backend.earningDetail=null;state.lastWithdrawal=null;state.selectedWithdrawal=null;state.selectedEarning=null}if(state.wholesaleContext&&(Number(state.wholesaleContext.memberId)!==Number(data.member.id)||Number(state.wholesaleContext.shopId)!==Number(backend.shopId))){state.wholesaleContext=null;state.wholesaleSku=null;state.purchaseBoxes=null}if(state.wholesaleDraft&&(Number(state.wholesaleDraft.memberId)!==Number(data.member.id)||Number(state.wholesaleDraft.shopId)!==Number(backend.shopId)))state.wholesaleDraft=null;if(backend.profileMemberId!=null&&Number(backend.profileMemberId)!==Number(data.member.id)){backend.profile=null;backend.profileMemberId=null}backend.shopInfo=data.shop;backend.storefront=data.storefront||{decoration:{},pages:{},categories:[]};backend.catalogShopId=backend.shopId;backend.checkinRewards=data.checkinRewards;backend.agent=data.agent;backend.account=data.account;state.shop=data.shop.name;state.points=Number(data.account.platformPoints.available||0);state.shopPoints=Number(data.account.shopPoints.available||0);state.balance=Number(data.account.wallet.available||0);state.addresses=data.addresses.filter(d=>d.status==='ACTIVE').map(d=>({...d.body,serverId:d.id}));
 products.splice(0,products.length,...data.products.map(p=>({...p,price:Number(p.price),retailPrice:p.retailPrice==null?null:Number(p.retailPrice),stock:p.stock,desc:p.spec})));
 if(state.lastWithdrawal){const latest=data.account.withdrawals?.find(w=>w.id===state.lastWithdrawal.id);if(latest)state.lastWithdrawal={...latest,cents:latest.amount};}state.orders=data.orders.map(normalizedOrder);
 const route=getCurrentPages().at(-1)?.route||'';
 if(/^pages\/G0[124]\/index$/.test(route)&&state.activeOrder&&!state.orders.some(order=>order.id===state.activeOrder)){
  const checkout=state.cartCheckouts?.[state.activeOrder];
  const sameCheckout=checkout&&Number(checkout.memberId)===Number(data.member.id)&&Number(checkout.shopId)===Number(data.shop.id);
  if(!sameCheckout&&state.pendingPaymentOrder!==state.activeOrder)clearAccountOrderContext();
 }
 state.notifications=data.notifications.map(n=>({id:n.id,message:notificationText(n.title,n.reference_kind),body:notificationText(n.body_text||n.title,n.reference_kind),event:n.reference_kind==='agent_application'?'AGENT_UPDATED':['review','review_append','support'].includes(n.reference_kind)?'SYSTEM':n.event_type,referenceKind:n.reference_kind||'',time:n.created_at,reference:n.reference_id,read:!!n.is_read}));state.signedIn=true;
 let shops,coupons
 try{[shops,coupons]=await Promise.all([request('/hexu/app/shops'),request('/hexu/app/coupons',{shopId})])}catch(e){rethrowCurrent(e)}
 requireCurrent()
 backend.shops=shops;backend.coupons=coupons;
 if(backend.refund&&Number(backend.refund.member_id)===Number(backend.member.id))backend.refund=data.account.refunds.find(r=>r.id===backend.refund.id)||null;
 const carts=data.cart.filter(d=>d.status==='ACTIVE');if(carts.length){const c=carts[0];state.cart=(c.body.items||[]).map(l=>({...l,selected:l.selected!==false}));state.serverCartId=c.id}else{state.cart=[];state.serverCartId=null}
 const favorite=data.favorites.filter(d=>d.status==='ACTIVE')[0];state.favorites=Array.isArray(favorite?.body?.ids)?favorite.body.ids.filter(id=>typeof id==='string'&&id):[];state.serverFavoriteId=favorite?.id;
 const browse=data.browseHistory?.find(d=>d.status==='ACTIVE');state.browseHistory=Array.isArray(browse?.body?.ids)?browse.body.ids:[];state.serverHydrated=true;persist();
 if(state.activeOrder){const orderId=state.activeOrder;try{const order=normalizedOrder(await request('/hexu/app/orders/'+orderId));requireCurrent();if(state.activeOrder!==orderId)throw new StaleRefreshError();backend.activeOrder=order;const i=state.orders.findIndex(x=>x.id===order.id);if(i>=0)state.orders[i]=order}catch(e){if(e instanceof StaleRefreshError)throw e;if(!current())rethrowCurrent(e);if(state.activeOrder===orderId)backend.activeOrder=null}}
}
let cartWrite=Promise.resolve()
export function syncCart(){
 if(!backend.ready)return Promise.resolve()
 const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
 const data={kind:'cart',shopId,id:state.serverCartId,items:JSON.parse(JSON.stringify(state.cart))}
 cartWrite=cartWrite.catch(()=>{}).then(async()=>{
  // 排队期间换号或换店，旧购物车快照不得以新身份提交。
  if(!sameMemberShop(memberId,shopId,token))return
  const saved=await apiCommand('document-save',data)
  if(sameMemberShop(memberId,shopId,token)){state.serverCartId=saved.id;persist()}
 })
 return cartWrite
}
export async function syncFavorites(){
 if(!backend.ready)return
 const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
 const data={kind:'favorite',shopId,id:state.serverFavoriteId,ids:[...state.favorites]}
 if(!sameMemberShop(memberId,shopId,token))return
 const saved=await apiCommand('document-save',data)
 if(sameMemberShop(memberId,shopId,token)){state.serverFavoriteId=saved.id;persist()}
}
async function recordBrowse(sku){
 const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token;
 const result=await request('/hexu/app/browse/'+encodeURIComponent(sku)+'?shopId='+shopId,{},'POST');
 if(sameMemberShop(memberId,shopId,token)&&Array.isArray(result.ids)){state.browseHistory=result.ids;persist()}
}
function sameMemberShop(memberId,shopId,token){return Number(backend.member?.id)===Number(memberId)&&Number(backend.shopId)===Number(shopId)&&backend.token===token}
export async function claimCoupon(id){
 const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
 const campaign=backend.coupons.find(c=>c.id===id&&c.kind==='coupon'&&c.status==='ACTIVE')
 if(!campaign||!(Number(campaign.body?.expiresAt)>Date.now()))throw new Error('优惠券活动已变化，请刷新后再领取')
 const claimed=rows=>rows.some(c=>c.kind==='coupon_claim'&&(c.campaign_ref===id||c.body?.campaignId===id))
 if(claimed(backend.coupons)){toast('已领取该优惠券');return}
 const receipt=await apiCommand('coupon-claim',{id})
 if(!sameMemberShop(memberId,shopId,token)){toast('原账号优惠券已领取，请切回原账号核对');return}
 if(!receipt?.id){toast('领取已提交但回执缺少编号，请刷新优惠券列表核对');return}
 const local={...receipt,kind:'coupon_claim',status:receipt.status||'AVAILABLE',campaign_ref:id,member_id:memberId,shop_id:shopId,body:receipt.body&&typeof receipt.body==='object'?receipt.body:{...campaign.body,campaignId:id}}
 if(!claimed(backend.coupons))backend.coupons=[local,...backend.coupons]
 try{
  const latest=await request('/hexu/app/coupons',{shopId})
  if(!sameMemberShop(memberId,shopId,token)){toast('原账号优惠券已领取，请切回原账号核对');return}
  backend.coupons=claimed(latest)?latest:[local,...latest]
  toast(claimed(latest)?'优惠券已领取':'优惠券已领取，列表同步稍有延迟')
 }catch(e){toast('优惠券已领取，列表刷新失败，请稍后核对：'+e.message)}
}
export async function validateCheckoutCoupon(id){
 if(backend.couponSelecting)throw new Error('优惠券校验中，请稍候')
 const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
 const coupon=backend.coupons.find(c=>c.id===id&&c.kind==='coupon_claim'&&c.status==='AVAILABLE'&&Number(c.member_id)===Number(memberId)&&Number(c.shop_id)===Number(shopId))
 if(!coupon||!(Number(coupon.body?.expiresAt)>Date.now()))throw new Error('优惠券已失效，请刷新后重新选择')
 const currentItems=()=>state.buyNow?[state.buyNow]:(state.cart||[]).filter(line=>line.selected)
 const items=currentItems().map(line=>({id:line.id,qty:line.qty})),itemKey=JSON.stringify(items)
 if(!items.length)throw new Error('请先选择结算商品')
 if(!checkoutLinesReady(currentItems(),products))throw new Error('所选商品暂不可售，请返回购物车重新选择')
 const address=state.addresses[state.selectedAddress??state.addresses.findIndex(a=>a.primary)]||state.addresses[0]||{name:'请添加收货地址',phone:'',region:'',detail:''}
 backend.couponSelecting=true
 try{
  const quote=await request('/hexu/app/quote',{shopId,address,items,couponId:id,groupId:state.buyNow?.groupId,groupCampaignId:state.buyNow?.groupCampaignId,points:0},'POST')
  if(!sameMemberShop(memberId,shopId,token)||itemKey!==JSON.stringify(currentItems().map(line=>({id:line.id,qty:line.qty}))))throw new Error('账号、商城或结算商品已变化，请重新选择优惠券')
  return quote
 }finally{backend.couponSelecting=false}
}
export async function setDefaultAddress(index){
 const selected=state.addresses[index]
 if(!selected?.serverId)throw new Error('请重新选择收货地址')
 if(selected.primary)return
 const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
 await apiCommand('document-save',{kind:'address',id:selected.serverId,name:selected.name,phone:selected.phone,region:selected.region,detail:selected.detail,usage:selected.usage||'家',primary:true,consent:true})
 if(!sameMemberShop(memberId,shopId,token)){toast('原账号默认地址已提交，请切回原账号核对');return}
 state.addresses.forEach((address,i)=>{address.primary=i===index})
 state.selectedAddress=index
 persist()
 try{await refresh()}catch(e){toast('默认地址已设置，列表刷新失败：'+e.message)}
}
export async function removeSavedAddress(index){
 const selected=state.addresses[index]
 if(!selected?.serverId)throw new Error('请重新选择收货地址')
 const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
 await apiCommand('document-remove',{id:selected.serverId})
 if(!sameMemberShop(memberId,shopId,token)){toast('原账号地址已删除，请切回原账号核对');return}
 const current=state.addresses.findIndex(address=>address.serverId===selected.serverId)
 if(current>=0){
  state.addresses.splice(current,1)
  state.selectedAddress=state.addresses.length?Math.min(state.selectedAddress>current?state.selectedAddress-1:state.selectedAddress,state.addresses.length-1):0
  persist()
 }
 try{await refresh()}catch(e){toast('地址已删除，列表刷新失败：'+e.message)}
}
function returnToAddressList(){
 const pages=typeof getCurrentPages==='function'?getCurrentPages():[]
 if(pages.at(-2)?.route==='pages/M13/index'&&typeof uni.navigateBack==='function'){
  uni.navigateBack({delta:1,fail:()=>uni.redirectTo({url:'/pages/M13/index'})})
 }else if(typeof uni.redirectTo==='function')uni.redirectTo({url:'/pages/M13/index'})
 else navigate('M13')
}
export async function uploadAttachment(filePath,purpose='IDENTITY',shopId=backend.shopId){
 if(!backend.ready&&!(await connect()))throw new Error('请先登录')
 if(purpose==='REVIEW'&&(!backend.reviewContext||Number(shopId)!==Number(backend.reviewContext.shopId)||backend.reviewContext.orderId!==backend.activeOrder?.id||backend.reviewContext.skuId!==state.reviewSku||backend.actionPageErrors?.M10))throw new Error('请重新读取本人订单评价后上传')
 backend.uploadingCount=(backend.uploadingCount||0)+1
 try{
  return await new Promise((resolve,reject)=>uni.uploadFile({
   url:apiBase+'/hexu/app/attachments',filePath,name:'file',formData:{shopId,purpose},header:{Authorization:'Bearer '+backend.token},
   success:r=>{
    let body
    try{body=JSON.parse(r.data)}catch{return reject(new Error('图片上传响应无效，请重试'))}
    if((r.statusCode!=null&&(r.statusCode<200||r.statusCode>=300))||body?.code!==200)return reject(new Error(body?.msg||'图片上传失败，请重试'))
    if(!/^FILE[0-9a-f]{32}$/.test(body.data?.id||''))return reject(new Error('图片上传回执无效，请重试'))
    resolve(body.data)
   },
   fail:()=>reject(new Error('图片上传失败，请重试'))
  }))
 }finally{backend.uploadingCount=Math.max(0,(backend.uploadingCount||1)-1)}
}
const documentKinds={M31:'agent_application',M30:'agent_application',M40:'shop_application',M41:'migration',M48:'settlement_account',M22:'return_tracking'}
const actionPages=new Set(['M09','M10','M31','M32','M33','M34','M35','M36','M37','M38','M41','M43','M44','M48','M61','M62','M63','G01','G02','G04','G05','G17','G18','G19','G20','G21','G25','G36','G43','G44','G48','G51','G52','G53','G54','G60'])
const displayPages=new Set(['M29','G14','G15','G22','G37','G16','M22','M23','M24'])
function displayJson(value){if(value&&typeof value==='object')return value;try{return JSON.parse(value||'{}')}catch{return {}}}
const marketingLabels={LIMITED:'限时折扣',FULL_REDUCTION:'满减',FLASH:'秒杀',GIFT:'满赠',EXCHANGE:'换购',BUNDLE:'组合套餐',ADDON:'加价购',group_campaign:'拼团活动',invitation_campaign:'邀请有礼'}
const marketingType=(pageId,tab)=>pageId==='G52'?({'限时折扣':'LIMITED','满减':'FULL_REDUCTION','秒杀':'FLASH','满赠':'GIFT','换购':'EXCHANGE'}[tab]||'LIMITED'):pageId==='G53'?(tab==='加价购'?'ADDON':'BUNDLE'):(tab==='拼团活动'?'group_campaign':'invitation_campaign')
const dateOnly=value=>value?new Date(Number(value)||value).toLocaleDateString('en-CA'):''
const shanghaiDate=value=>new Date(Number(value)+8*3600000).toISOString().slice(0,10)
const marketingDateOnly=value=>{if(!value)return '';const time=Number(value)||timestamp(value);return Number.isFinite(time)?shanghaiDate(time):''}
function calendarDate(value,label,optional=false){
 const date=typeof value==='string'?value.trim():'';
 if(optional&&!date&&(value==null||typeof value==='string'))return '';
 const parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date),year=Number(parts?.[1]),month=Number(parts?.[2]),day=Number(parts?.[3]),days=month===2?(year%4===0&&(year%100!==0||year%400===0)?29:28):[4,6,9,11].includes(month)?30:31;
 if(!parts||year<1||month<1||month>12||day<1||day>days)throw new Error('请填写有效的'+label+'（YYYY-MM-DD）');
 return date;
}
function businessDateTimestamp(value,label,end=false){
 const date=calendarDate(value,label)
 return Date.parse(date+(end?'T23:59:59+08:00':'T00:00:00+08:00'))
}
function inputNumber(value,label,integer=false){
 const number=Number(value);
 if(!['string','number'].includes(typeof value)||String(value).trim()===''||(typeof value==='string'&&!/^(?:\d+\.?\d*|\.\d+)$/.test(value.trim()))||!Number.isFinite(number)||number<0||(integer&&!Number.isSafeInteger(number)))throw new Error(label+(integer?'须为非负整数':'须为有效的非负数字'));
 return number;
}
function inputCents(value,label){
 const amount=['string','number'].includes(typeof value)?String(value).trim():'';
 if(!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(amount))throw new Error(label+'须为非负金额，最多2位小数');
 const [yuan,fraction='']=amount.split('.'),whole=Number(yuan||0);
 if(!Number.isSafeInteger(whole)||whole>Math.floor(Number.MAX_SAFE_INTEGER/100))throw new Error(label+'超出安全金额范围');
 const cents=whole*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents))throw new Error(label+'超出安全金额范围');
 return cents;
}
function groupCampaignPayload(form,prior,dates){
 const enabled=!!form.拼团开关,skuId=String(form.活动商品||'').trim();
 const price=enabled?inputCents(form.拼团价格,'拼团价格'):Number(form.拼团价格||0)*100;
 const size=enabled?inputNumber(form.成团人数,'成团人数',true):Number(form.成团人数||2);
 const hours=enabled?inputNumber(form['成团时限（小时）'],'成团时限',true):Number(form['成团时限（小时）']||24);
 if(enabled){
  const product=products.find(p=>p.id===skuId);
  if(!product)throw new Error('请选择本商城在售的拼团商品');
  if(price<1||price>Number(product.retailPrice??product.price))throw new Error('拼团价格须大于0且不超过商品零售价');
  if(size<2||size>20)throw new Error('成团人数须为2至20人');
  if(hours<1||hours>168)throw new Error('成团时限须为1至168小时');
 }
 return {kind:'group_campaign',id:prior?.id,name:String(form.活动名称||'').trim(),enabled,skuId,price:Math.round(price),size,hours,...dates};
}
function invitationCampaignPayload(form,prior,dates){
 const firstOrderReward=inputCents(form.完成首单奖励,'首单奖励'),thirdOrderReward=inputCents(form.完成三单奖励,'三单奖励');
 const rewardCap=inputCents(form.单人奖励上限,'单人奖励上限'),minOrderAmount=inputCents(form.有效订单门槛,'有效订单门槛');
 if(firstOrderReward===0&&thirdOrderReward===0)throw new Error('请配置首单或三单奖励上限');
 if(rewardCap<1||minOrderAmount<100)throw new Error('个人累计奖励上限须大于0，有效订单门槛至少1元');
 return {kind:'invitation_campaign',id:prior?.id,name:String(form.活动名称||'').trim(),enabled:true,firstOrderReward,thirdOrderReward,rewardCap,minOrderAmount,...dates};
}
function marketingPreviewPayload(form){
 const customerId=Number(String(form.previewCustomer||'').split(' · ')[0]);
 const skuId=String(form.previewSku||'').split(' · ')[0],quantity=inputNumber(form.previewQty,'购买数量',true);
 const points=inputNumber(form.previewPoints,'抵扣积分数',true);
 if(!(backend.previewCustomers||[]).some(c=>Number(c.member_id)===customerId))throw new Error('请选择本商城试算客户');
 if(!(backend.previewCatalog||[]).some(p=>p.id===skuId&&p.status==='ACTIVE'))throw new Error('请选择本商城在售商品');
 if(quantity<1||quantity>100000)throw new Error('购买数量须为1至100000的整数');
 if(!['平台积分','商城积分'].includes(form.previewScope))throw new Error('请选择积分类型');
 const couponId=form.previewCoupon==='不使用优惠券'?'':String(form.previewCoupon||'').split(' · ')[0];
 if(couponId&&!(currentMarketingBuyer(form)?.coupons||[]).some(c=>c.id===couponId&&c.status==='AVAILABLE'))throw new Error('请选择当前客户可用的优惠券');
 const region=String(form.previewRegion||'').trim();if(!region)throw new Error('请填写收货地区');
 return {customerId,items:[{id:skuId,qty:quantity}],points,pointsScope:form.previewScope==='商城积分'?backend.shopId:0,couponId,address:{name:'金额试算',region,detail:'试算地址，不创建订单'}};
}
function linkCampaignPayload(form){
 const enabled=!!form.enabled,fields=['minOrderAmount','rewardCap','maxRewardPerOrder','totalRewardBps','directReward','directBps','orderReward','orderBps','peerReward','peerBps'];
 const input={kind:'link_campaign',id:form._linkId,enabled,name:String(form.name||'').trim(),skuIds:String(form.skuIds||'').trim(),directCount:2,entryFee:0,relationshipMode:form.relationshipMode||'KEEP_RELATION',passedChild:form.passedChild||'EARLIEST',writtenConfirmed:!!form.writtenConfirmed,confirmationFile:form.uploads?.[0]||form.confirmationFile||''};
 for(const key of fields)input[key]=enabled?(String(form[key]??'').trim()===''?0:inputNumber(form[key],key,true)):Number(form[key]||0);
 input.startsAt=form.startDate?businessDateTimestamp(form.startDate,'开始日期'):form.startsAt;
 input.expiresAt=form.endDate?businessDateTimestamp(form.endDate,'截止日期',true):form.expiresAt;
 if(!enabled)return input;
 if(!input.name||!input.writtenConfirmed)throw new Error('启用前请填写活动名称并确认书面运营规则');
 if(!['KEEP_RELATION','EXIT_KEEP_TEAM','EXIT_PASS_ONE'].includes(input.relationshipMode)||!['EARLIEST','LATEST'].includes(input.passedChild))throw new Error('请选择明确的营销关系处置方式');
 if(!Number.isFinite(input.startsAt)||!Number.isFinite(input.expiresAt)||input.expiresAt<=input.startsAt||input.minOrderAmount<100)throw new Error('请确认有效期及至少1元的真实商品订单条件');
 if(input.rewardCap<1||input.maxRewardPerOrder<1||input.totalRewardBps<1||input.totalRewardBps>10000)throw new Error('必须配置个人累计上限及包含原三级收益的单笔总奖励上限');
 let hasReward=false;
 for(const name of ['direct','order','peer']){
  const fixed=input[name+'Reward'],bps=input[name+'Bps'];
  if(fixed>9000000000000||bps>10000||(fixed>0&&bps>0))throw new Error('每项奖励只能选择固定金额或比例，且不得超过上限');
  hasReward ||= fixed>0||bps>0;
 }
 if(!hasReward)throw new Error('至少启用一个真实订单奖励项目');
 if(!input.skuIds.split(',').some(sku=>sku.trim()))throw new Error('请明确选择参与商品');
 if(!input.confirmationFile)throw new Error('请上传书面确认图片');
 return input;
}
function couponPayload(form){
 const name=String(form.优惠券名称||'').trim();
 if(!name)throw new Error('请填写优惠券名称');
 if(name.length>80)throw new Error('优惠券名称最多80字');
 const type=({'满减券':'FULL_REDUCTION','折扣券':'DISCOUNT','商品券':'PRODUCT','新人券':'NEWCOMER','指定人群券':'TARGETED'})[form.优惠券类型];
 if(!type)throw new Error('请选择有效的优惠券类型');
 const expiresAt=businessDateTimestamp(form.有效期至,'有效期至',true);
 if(expiresAt<=Date.now())throw new Error('有效期须晚于当前时间');
 const quantity=inputNumber(form.发放数量,'发放数量',true);
 if(quantity<1)throw new Error('发放数量须为正整数');
 const threshold=type==='DISCOUNT'&&String(form.使用门槛??'').trim()===''?0:inputCents(form.使用门槛,'使用门槛');
 let discount=0,rateBps=0;
 if(type==='DISCOUNT'){
  const rate=inputNumber(form.优惠金额,'折扣');rateBps=Math.round(rate*1000);
  if(!Number.isSafeInteger(rateBps)||rateBps<1||rateBps>=10000)throw new Error('折扣须大于0且小于10折');
 }else{
  discount=inputCents(form.优惠金额,'优惠金额');
  if(discount<1||discount>threshold)throw new Error('优惠金额须大于0且不超过使用门槛');
 }
 return {kind:'coupon',type,rateBps,skuIds:form.适用商品,memberIds:form.目标人群,name,threshold,discount,quantity,expiresAt};
}
function finiteIntegerFields(data,keys){for(const key of keys)if(data[key]!==undefined&&!Number.isSafeInteger(data[key]))throw new Error(key+'须为有效整数');}
const stocktakeKey=id=>'stocktake:'+id
const assessmentReadOnlyReason=b=>b.operator==='WEIGHTED'?'当前方案使用加权指标，完整权重与达标分数不在本页维护。':b.operator&&!['AND','OR'].includes(b.operator)?'当前方案的指标关系不在本页支持范围。':((b.periodKind&&!['MONTH','QUARTER','ROLLING'].includes(b.periodKind))||((!b.periodKind||b.periodKind==='ROLLING')&&Number(b.periodMonths??3)!==3))?'当前方案的考核周期不在本页支持范围。':''
function hydrateMarketing(pageId,form){
 const type=marketingType(pageId,form._marketingTab),list=(backend.marketingConfigs?.[pageId]||[]).filter(d=>(d.body?.type||d.kind)===type),selected=backend.selectedMarketingConfig?.[pageId],d=selected==='NEW'?null:list.find(x=>x.id===selected)||list.find(x=>x.status==='ACTIVE')||list[0],key=backend.shopId+':'+type+':'+(d?.id||'NEW')+':'+(d?.updated_at||'');if(form._marketingKey===key)return;const b=d?.body||{},today=marketingDateOnly(Date.now()),later=marketingDateOnly(Date.now()+30*86400000);backend.marketingDetails??={};backend.marketingDetails[pageId]=d;
 if(pageId==='G52')Object.assign(form,{活动名称:b.name||'',开始时间:marketingDateOnly(b.startsAt)||today,结束时间:marketingDateOnly(b.expiresAt)||later,活动折扣:type==='GIFT'?0:!d?'':type==='FULL_REDUCTION'?Number(b.discount||0)/100:type==='EXCHANGE'?Number(b.price||0)/100:Number(b.rateBps||0)/1000,活动门槛:Number(b.threshold||0)/100,活动商品:b.items?.[0]?.skuId||'',促销商品:b.skuIds||'',每人限购:b.perMember??1,活动库存:b.quantity??0,允许优惠券叠加:!!b.stackCoupon,允许积分抵扣:d?b.stackPoints!==false:false});
 if(pageId==='G53')Object.assign(form,{套餐名称:b.name||'',套餐商品:(b.items||[]).map(x=>x.skuId+':'+x.qty).join('\n'),套餐价格:Number(b.price||0)/100,活动门槛:Number(b.threshold||0)/100,活动库存:b.quantity??0,每人限购:b.perMember??1,开始时间:marketingDateOnly(b.startsAt)||today,结束时间:marketingDateOnly(b.expiresAt)||later});
 if(pageId==='G54')Object.assign(form,{活动名称:b.name||'',开始时间:marketingDateOnly(b.startsAt)||today,截止日期:marketingDateOnly(b.expiresAt)||later,完成首单奖励:Number(b.firstOrderReward||0)/100,完成三单奖励:Number(b.thirdOrderReward||0)/100,单人奖励上限:Number(b.rewardCap||0)/100,有效订单门槛:Number(b.minOrderAmount||100)/100,拼团开关:d?b.enabled!==false:false,活动商品:b.skuId||'',拼团价格:b.price==null?'':Number(b.price)/100,成团人数:b.size??2,'成团时限（小时）':b.hours??24});
 form._marketingKey=key;
}
const managementPages={G05:'documents_shop_application',G06:'shopReadiness',G01:'dashboard',G02:'dashboard',G03:'dashboard',G09:'products',G17:'products',G18:'inventory',G19:'products',G21:'orders',G25:'refunds',G29:'agents',G30:'agents',G32:'customers',G39:'earnings',G43:'withdrawals',G44:'withdrawals',G33:'documents_migration',G34:'documents_team_migration',G35:'documents_cross_purchase',G42:'earnings',G45:'financeSummary',G46:'reconciliationLines',G57:'linkParticipants',G47:'points',G49:'pointTransfers',G62:'audit'}
export function mobileReportDimension(pageId,filter=''){return pageId==='G58'?'AGENT':filter==='商品分析'?'SKU':filter==='客户分析'?'CUSTOMER':'ORDER'}
export async function refreshMobileReport(pageId,filter=''){
 const report=backend.reports?.[pageId];
 if(!report||report.shop_id!==backend.shopId)return;
 const id=report.id,shop=backend.shopId;
 const data=await request('/hexu/app/management/reports/'+id,{dimension:mobileReportDimension(pageId,filter),page:backend.reportPages?.[pageId]||1,size:20});
 if(shop!==backend.shopId||backend.reports?.[pageId]?.id!==id)return;
 backend.reports[pageId]=data;
 backend.reportJobs=(backend.reportJobs||[]).map(job=>job.id===id?{
  ...job,status:data.status,progress:data.progress,processed_rows:data.processed_rows,total_rows:data.total_rows
 }:job);
}
export function setReportPeriod(form,choice){const now=new Date(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),year=Number(day.slice(0,4)),month=Number(day.slice(5,7));form.reportTo=day;form.reportFrom=day.slice(0,8)+'01';if(choice==='上月'){form.reportFrom=new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,10);form.reportTo=new Date(Date.UTC(year,month-1,0)).toISOString().slice(0,10)}if(choice==='近90天')form.reportFrom=new Date(Date.parse(day+'T00:00:00Z')-89*86400000).toISOString().slice(0,10);}
async function downloadReport(id,dimension){const url=apiBase+'/hexu/app/management/reports/'+encodeURIComponent(id)+'/export?dimension='+dimension;
 // #ifdef H5
 const response=await fetch(url,{headers:{Authorization:'Bearer '+backend.token}});if(!response.ok||response.headers.get('content-type')?.includes('json')){const e=await response.json();throw new Error(e.msg||'导出失败')}const blob=await response.blob(),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='经营报表-'+dimension+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
 // #endif
 // #ifdef MP-WEIXIN
 const file=await new Promise((resolve,reject)=>uni.downloadFile({url,header:{Authorization:'Bearer '+backend.token},success:r=>r.statusCode===200?resolve(r.tempFilePath):reject(new Error('报表下载失败')),fail:e=>reject(new Error(e?.errMsg||'报表下载失败'))}));
 if(typeof wx.shareFileMessage!=='function')throw new Error('当前环境不支持文件分享，请在微信真机导出');
 await new Promise((resolve,reject)=>wx.shareFileMessage({filePath:file,fileName:'经营报表-'+dimension+'.csv',success:resolve,fail:e=>reject(new Error(e?.errMsg||'当前环境无法分享报表，请在微信真机导出'))}));
 // #endif
}
let marketingBuyerVersion=0
let marketingBuyerScope=''
let marketingPageVersion=0
function currentMarketingBuyer(form){
 const customerId=Number(String(form.previewCustomer||'').split(' · ')[0])
 const scope=JSON.stringify([backend.member?.id,backend.shopId,backend.token,customerId])
 return marketingBuyerScope===scope?backend.marketingBuyer:null
}
export async function loadMarketingBuyer(form){
 const version=++marketingBuyerVersion,customerId=Number(String(form.previewCustomer||'').split(' · ')[0])
 const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
 const scope=JSON.stringify([memberId,shopId,token,customerId])
 backend.marketingPreview=null
 if(!customerId){backend.marketingBuyer=null;marketingBuyerScope='';return}
 if(backend.marketingBuyer&&marketingBuyerScope===scope)return
 backend.marketingBuyer=null;marketingBuyerScope=''
 const data=await request('/hexu/app/management/operations/marketing-buyer',{shopId,customerId})
 // 同一客户可能属于多个商城，迟到的旧响应不得覆盖当前商城券与试算缓存。
 if(version!==marketingBuyerVersion||!sameMemberShop(memberId,shopId,token)||customerId!==Number(String(form.previewCustomer||'').split(' · ')[0]))return
 backend.marketingBuyer={...data,customerId};marketingBuyerScope=scope;form.previewCoupon='不使用优惠券'
}
function reviewDraftScope(order,skuId){return JSON.stringify([backend.member?.id,backend.shopId,state.activeOrder,order?.id,order?.shop_id,skuId,state.reviewParent||''])}
function sameReviewDraft(form){
 const order=backend.activeOrder,skuId=(order?.items||[]).some(line=>line.id===state.reviewSku)?state.reviewSku:order?.items?.[0]?.id||'',context=backend.reviewContext
 return !!context&&form?._reviewScope===reviewDraftScope(order,skuId)&&context.orderId===order?.id&&context.skuId===skuId&&Number(context.shopId)===Number(order?.shop_id)&&(!state.reviewParent||context.parent?.id===state.reviewParent)
}
let reviewPageVersion=0
const financePages=new Set(['G39','G40','G42','G45'])
const financePageVersions={}
export async function pageData(id,form){
 const reviewVersion=id==='M10'?++reviewPageVersion:0
 const financeVersion=financePages.has(id)?financePageVersions[id]=(financePageVersions[id]||0)+1:0
 let financeStart=null
 const financeCurrent=()=>!financeVersion||financeVersion===financePageVersions[id]&&(!financeStart||sameMemberShop(...financeStart))
 const marketingVersion=id==='G55'?++marketingPageVersion:0
 let marketingStart=null
 const reviewStart=id==='M10'&&backend.ready?[backend.member?.id,backend.token,backend.shopId,state.activeOrder,state.reviewSku,state.reviewParent]:null
 let reviewCurrent=()=>reviewVersion===reviewPageVersion&&(!reviewStart||
  Number(backend.member?.id)===Number(reviewStart[0])&&backend.token===reviewStart[1]&&Number(backend.shopId)===Number(reviewStart[2])&&state.activeOrder===reviewStart[3]&&state.reviewSku===reviewStart[4]&&state.reviewParent===reviewStart[5])
 backend.pageLoading[id]=id==='M10'?1:(backend.pageLoading[id]||0)+1;
 if(id==='M12'){backend.policies={};backend.purchaseAgreementError=''}
 if(id==='M29')backend.supportRecords=[];
 if(id==='M61')backend.couponPolicy=null;
 if(financeVersion){
  backend.financeErrors[id]='';backend.management[id]=[]
  if(id==='G39')backend.earningSummary=null
  if(id==='G40'){backend.previewAgents=[];backend.settlementPreview=null;backend.settlementPreviewKey=''}
  if(id==='G42')backend.reversal=null
 }
 if(displayPages.has(id)){backend.displayPageErrors??={};backend.displayPageErrors[id]='';}
 if(id==='G16'){backend.purchaseOrderDetail=null;backend.purchaseReceiveAllowed=false;backend.purchaseOrders=[];backend.purchaseOrderScope=null;}
 if(id==='G37'){backend.promotionReview=null;backend.promotionReviewAllowed=false;backend.promotionReviewContext=null;}
 if(id==='M22')backend.returnTrackingAllowed=false;
 if(actionPages.has(id)){backend.actionPageErrors??={};backend.actionPageErrors[id]='';}
 if(id==='M10'){
  // 原生选图返回可能触发同页 onShow；同一评价重读期间保留上传组件和草稿。
  if(!sameReviewDraft(form)){backend.reviewContext=null;backend.reviewParent=null;backend.reviewSubmission=null;backend.reviewAppendSubmission=null;}
 }
 if(id==='M09'){backend.reviews=[];backend.reviewProduct=null;backend.reviewBrowseOrder=null;backend.reviewShopId=backend.shopId;}
 if(['G07','G08','G23','G24','G26','G27','G28','M19','M27','G41','G55','G61','G62','G64'].includes(id))backend.operationError='';
 if(['M19','G24'].includes(id))backend.tracking=null;
 if(['G26','G27','G28'].includes(id)){backend.afterSaleLinks=[];backend.afterSaleCandidates=[];backend.afterSaleCandidateError='';}
 try{const entry=entryOptions();if(Number(entry.shop)>0){backend.shopId=Number(entry.shop);uni.setStorageSync('hexu-shop-id',backend.shopId)}if(entry.sku)state.selectedProduct=entry.sku;if(entry.invite)state.invite=entry.invite;if(entry.group)state.selectedGroup=entry.group;
  if(id==='M02'){backend.shopId=1;uni.setStorageSync('hexu-shop-id',1)}
  if(id==='M03'&&backend.shopId===1){backend.shopId=2;uni.setStorageSync('hexu-shop-id',2)}
  if(id==='M01'){backend.policies=await request('/hexu/app/policies',{shopId:backend.shopId});return;}
  // 本地沙盒显式指定测试会员时进入登录流程；普通无会话访问仍按游客展示。
  const sandboxMember=Number(entry.member)
  const explicitSandboxMember=localSandbox()&&Number.isSafeInteger(sandboxMember)&&sandboxMember>0
  const guestBrowsing=uni.getStorageSync('hexu-guest-browse')
  if(guestPages.includes(id)&&(guestBrowsing||(!explicitSandboxMember&&(backend.guest||!uni.getStorageSync('hexu-api-token')&&!import.meta.env.DEV)))){await guestCatalog();return;}
  if(uni.getStorageSync('hexu-guest-browse')){backend.guest=true;rememberLoginReturn(id);navigate('M01');return;}
  if(!backend.ready&&!(await connect())){if(guestPages.includes(id))await guestCatalog();return;}
  if(['M02','M03','M42'].includes(id)){const access=await request('/hexu/app/shop-access',{shopId:backend.shopId});if(!access.allowed){if(access.crossOrderHistory){backend.crossOrderHomeShopId=Number(access.homeShopId);backend.crossOrderPendingId=access.pendingOrderId||'';state.orderListFilter='全部';uni.redirectTo({url:'/pages/M17/index'});return true}backend.requestedShopId=backend.shopId;backend.shopId=Number(access.homeShopId);uni.setStorageSync('hexu-shop-id',backend.shopId);state.buyNow=null;state.couponId=null;toast('您已归属'+access.homeShopName+'，跨店访问需先确认');await refresh();if(id==='M02'&&entryOptions().sku===entry.sku&&getCurrentPages().at(-1)?.route==='pages/M02/index')navigate('M43');return}backend.crossOrderHomeShopId=null;backend.crossOrderPendingId=''}
  let crossOrderHomeShopId=null
  let crossOrderPendingId=''
  if(id==='M17'){const access=await request('/hexu/app/shop-access',{shopId:backend.shopId});crossOrderHomeShopId=!access.allowed&&access.crossOrderHistory?Number(access.homeShopId):null;crossOrderPendingId=crossOrderHomeShopId?access.pendingOrderId||'':''}
  await refresh();
  if(id==='M17'){backend.crossOrderHomeShopId=crossOrderHomeShopId;backend.crossOrderPendingId=crossOrderPendingId}
  if(!financeCurrent())return false
  if(financeVersion)financeStart=[backend.member?.id,backend.shopId,backend.token]
  if(id==='M10'&&!reviewCurrent())return false
  if(id==='M12'){
   // 协议、商城或账号变化时清除旧勾选，防止旧版本确认被带入新订单。
   const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
   const policies=await request('/hexu/app/policies',{shopId})
   if(!sameMemberShop(memberId,shopId,token))throw new Error('账号或商城已变化，请重新进入结算')
   backend.policies=policies;backend.purchaseAgreementError=''
   const agreement=policies?.[PURCHASE_AGREEMENT]
   const key=[memberId,shopId,agreement?.id||'',agreement?.version||''].join(':')
   if(form&&form._purchaseAgreementKey!==key){form.orderConsent=false;form._purchaseAgreementKey=key}
  }
  if(id==='M29'){
   const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token;
   const records=await request('/hexu/app/documents/support',{shopId});
   if(!sameMemberShop(memberId,shopId,token))throw new Error('登录账号或商城已变化，请重新读取本人留言');
   backend.supportRecords=visibleSupportRecords(records,memberId,shopId);
   if(!backend.supportRecords.some(record=>record.id===backend.selectedSupportId))backend.selectedSupportId=backend.supportRecords[0]?.id||'';
  }
  if(id==='M61'){
   const lines=state.buyNow?[state.buyNow]:(state.cart||[]).filter(line=>line.selected)
   if(checkoutLinesReady(lines,products)&&lines.length){
    const address=state.addresses[state.selectedAddress??state.addresses.findIndex(item=>item.primary)]||state.addresses[0]||{name:'请添加收货地址',phone:'',region:'',detail:''}
    const quote=await request('/hexu/app/quote',{shopId:backend.shopId,address,items:lines.map(line=>({id:line.id,qty:line.qty})),points:0},'POST')
    const blocked=couponStackingBlocked(quote)
    backend.couponPolicy={blocked}
    if(blocked&&state.couponId){state.couponId=null;persist()}
   }
  }
  if(id==='G02'&&backend.shopInfo?.kind!=='DIRECT'){backend.management.G02=null;return true}
  if(['M33','M36','M37','M38'].includes(id)&&!backend.agent){backend.agentData=null;backend.assessment=null;}
  if(id==='M41'){
   backend.migrationContext=null;backend.migrationContext=await request('/hexu/app/invitation-context',{shopId:backend.shopId,invite:''});
    backend.documents.migration=await request('/hexu/app/documents/migration',{shopId:backend.shopId});
   if(form&&form._migrationShop!==backend.shopId)Object.assign(form,{目标商城:'',目标代理:'',期望生效时间:'',reason:'',_migrationShop:backend.shopId});
  }
  if(id==='M44'){
   backend.crossPurchaseTarget=backend.shops.find(s=>Number(s.id)===Number(backend.requestedShopId)&&Number(s.id)!==Number(backend.shopId)&&s.kind!=='WHOLESALE')||null;
   const scope=[backend.member?.id,backend.shopId,backend.crossPurchaseTarget?.id].join(':');
   if(form&&form._crossDraftScope!==scope){
    if(form._crossDraftScope){form.采购数量=1;form.reason='';}
    else if(form.采购数量==null)form.采购数量=1;
    form._crossDraftScope=scope;
   }
   backend.crossPurchaseProduct=null;backend.crossPurchaseCatalog=[];
   if(backend.crossPurchaseTarget){
    const catalog=await request('/hexu/app/guest/products',{shopId:backend.crossPurchaseTarget.id});
    if(scope!==[backend.member?.id,backend.shopId,backend.crossPurchaseTarget?.id].join(':'))return false;
    backend.crossPurchaseCatalog=catalog.map(p=>({...p,price:Number(p.price),desc:p.spec||p.description||''}));
    backend.crossPurchaseProduct=backend.crossPurchaseDraft?.scope===scope?backend.crossPurchaseCatalog.find(p=>p.id===backend.crossPurchaseDraft.skuId)||null:null;
   }
  }
  if(id==='M63'){
   const receipt=backend.redemptionOrder
   const currentReceipt=receipt&&state.lastRedemption?.id&&receipt.id===state.lastRedemption.id&&receipt.order_type==='POINTS'&&Number(receipt.buyer_id)===Number(backend.member?.id)&&Number(receipt.shop_id)===Number(backend.shopId)?receipt:null
   backend.redemptionOrder=null
   const latest=state.orders.find(order=>order.order_type==='POINTS'&&Number(order.points_used)>0&&Number(order.buyer_id)===Number(backend.member?.id)&&Number(order.shop_id)===Number(backend.shopId))
   const receiptId=state.lastRedemption?.id||latest?.id
   if(receiptId){
    try{const order=await request('/hexu/app/orders/'+encodeURIComponent(receiptId));if(order.order_type==='POINTS'&&Number(order.points_used)>0&&Number(order.buyer_id)===Number(backend.member?.id)&&Number(order.shop_id)===Number(backend.shopId))backend.redemptionOrder=normalizedOrder(order)}
    catch(e){if(!currentReceipt)throw e;backend.redemptionOrder=currentReceipt;toast('兑换订单刷新失败，当前展示刚提交的订单：'+e.message)}
   }
  }
  if(id==='G21'&&form&&form._orderTypeShop!==backend.shopId)Object.assign(form,{orderType:'全部类型',_orderTypeShop:backend.shopId});
  if(id==='M27'){[backend.policies,backend.consents]=await Promise.all([request('/hexu/app/policies',{shopId:backend.shopId}),request('/hexu/app/consents',{shopId:backend.shopId})]);}
  if(['M30','M31'].includes(id)){
   // 商城或协议版本变化时清除旧勾选，避免旧授权被绑定到新版协议。
   backend.policies=await request('/hexu/app/policies',{shopId:backend.shopId})
   const agreement=backend.policies?.AGENT_AGREEMENT
   const key=[backend.shopId,agreement?.id||'',agreement?.version||''].join(':')
   if(form&&form._agentAgreementKey!==key){form.consent=false;form.agreementReconsent=false;form._agentAgreementKey=key}
  }
  if(id==='M20'&&state.directAfterSale&&state.directAfterSale.wholesaleOrderId===state.activeOrder&&form)form.afterType=state.directAfterSale.refundType;
  if(id==='M21'&&state.directAfterSale&&state.directAfterSale.wholesaleOrderId===state.activeOrder&&form)form.申请数量=state.directAfterSale.qty;
 if(['G07','G08'].includes(id)){backend.merchant=await request('/hexu/app/management/merchant',{shopId:backend.shopId});if(form&&form._merchantShop!==backend.shopId){const m=backend.merchant;if(id==='G07')Object.assign(form,{主体类型:m.subjectType==='INDIVIDUAL'?'个体工商户':'企业',subjectName:m.subjectName||'',legalRepresentative:'',licenseNo:'',contactPhone:'',settlementBank:m.settlementBank||'',settlementAccountRef:m.settlementAccountRef||'',applicationRef:m.applicationRef||'',uploads:m.attachmentIds||[]});else Object.assign(form,{appId:m.appId||'',merchantNo:m.merchantNo||'',authorizationRef:m.authorizationRef||'',transferAuthRef:m.transferAuthRef||'',serialNo:m.certificateSerial||'',expiresAt:m.expiresAt?String(m.expiresAt).slice(0,10):'',certificateRef:m.certificateRef||'',contractedFeePercent:m.contractedFeeBps==null?'':Number(m.contractedFeeBps)/100,settlementDays:m.settlementDays??''});form._merchantShop=backend.shopId;}}
  if(['M19','G24'].includes(id)){const current=backend.activeOrder,orderId=id==='M19'?(current?.id===state.activeOrder&&Number(current.buyer_id)===Number(backend.member?.id)?current.id:null):state.managementOrder;backend.tracking=orderId?await request('/hexu/app/'+(id==='G24'?'management/':'')+'orders/'+encodeURIComponent(orderId)+'/tracking',{shopId:backend.shopId}):null;}
  if(id==='G23'){backend.pickOrders=await request('/hexu/app/management/fulfillment/pick',{shopId:backend.shopId});backend.pickPrint=null;}
  if(['G26','G27','G28'].includes(id)){backend.afterSaleLinks=await request('/hexu/app/management/aftersale-links',{shopId:backend.shopId});}
  if(id==='G62'&&backend.auditDetail?.shop_id!==backend.shopId)backend.auditDetail=null;
  if(id==='G41')backend.ruleVersions=await request('/hexu/app/management/operations/rules',{shopId:backend.shopId});
  if(id==='G55'){
   const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
   marketingStart=[memberId,shopId,token]
   const current=()=>marketingVersion===marketingPageVersion&&sameMemberShop(memberId,shopId,token)
   const scope=JSON.stringify([memberId,shopId,token])
   if(form._previewScope!==scope){backend.previewCustomers=[];backend.previewCatalog=[];backend.marketingBuyer=null;marketingBuyerScope='';backend.marketingPreview=null;form.previewCoupon='不使用优惠券'}
   const customers=await request('/hexu/app/management/customers',{shopId})
   if(!current())return false
   const catalog=await request('/hexu/app/management/products',{shopId})
   if(!current())return false
   backend.previewCustomers=customers;backend.previewCatalog=catalog
   if(form._previewScope!==scope){Object.assign(form,{previewCustomer:customers[0]?customers[0].member_id+' · '+customers[0].name:'',previewSku:catalog[0]?catalog[0].id+' · '+catalog[0].name:'',previewQty:1,previewPoints:0,previewScope:'平台积分',previewRegion:backend.shopInfo?.county||'',previewCoupon:'不使用优惠券',_previewShop:shopId,_previewScope:scope});backend.marketingBuyer=null;marketingBuyerScope='';backend.marketingPreview=null}
   await loadMarketingBuyer(form)
   if(!current())return false
  }
  if(id==='G61'){backend.staffAccounts=await request('/hexu/app/management/operations/staff',{shopId:backend.shopId});if(form._staffShop!==backend.shopId){Object.assign(form,{staffLogin:'',staffEnabled:true,staffReason:'',role:'仓储人员',_staffShop:backend.shopId});backend.staffLookup=null;}}
  if(id==='G64'){const records=await request('/hexu/app/management/documents_system_parameter',{shopId:backend.shopId});backend.systemDoc=records.find(x=>x.status==='ACTIVE');backend.notificationTemplates=await request('/hexu/app/management/documents_notification_template',{shopId:backend.shopId});if(form._systemShop!==backend.shopId){const b=backend.systemDoc?.body||{};Object.assign(form,{'未支付订单关闭（分钟）':b.unpaidMinutes||15,'自动收货（天）':b.autoReceiveDays||7,'售后申请期限（天）':b.afterSalesDays||7,'订单支付通知':b.notifyPaid!==false,'发货物流通知':b.notifyShipped!==false,'售后状态通知':b.notifyRefund!==false,'提现结果通知':b.notifyWithdrawal!==false,'库存预警通知':b.notifyInventory!==false,templateEvent:'订单支付',templateTitle:'',templateContent:notificationTemplateForEditor('{{message}}，关联单号 {{reference}}'),_systemShop:backend.shopId});}}
  if(['G58','G59'].includes(id)){backend.reportErrors[id]='';backend.reports??={};backend.reportPages??={};if(form&&form._reportShop!==backend.shopId){setReportPeriod(form,'本月');Object.assign(form,{reportAgent:0,reportCustomer:0,reportSku:'',reportRank:'全部职级',includeTeam:true,_reportShop:backend.shopId});}const jobs=await request('/hexu/app/management/reports',{shopId:backend.shopId});backend.reportJobs=jobs;backend.reports[id]=jobs.find(j=>j.id===backend.reports[id]?.id)||jobs[0]||null;backend.reportPages[id]=1;await refreshMobileReport(id);}
  if(['M33','M36','M37','M38'].includes(id)&&backend.agent)backend.agentData=await request('/hexu/app/agent-data',{shopId:backend.shopId});
  if(['M05','M06','M07','M09'].includes(id)){
   if(!state.selectedProduct)state.selectedProduct=products[0]?.id||'';
   let shopId=backend.shopId;
   if(id==='M09'&&state.reviewBrowse){
    const browse=state.reviewBrowse,order=backend.activeOrder?.id===browse.orderId?backend.activeOrder:normalizedOrder(await request('/hexu/app/orders/'+encodeURIComponent(browse.orderId))),line=order.items?.find(l=>l.id===browse.skuId);
    if(!line||browse.skuId!==state.selectedProduct||Number(browse.shopId)!==Number(order.shop_id))throw new Error('订单商品评价上下文已变化，请从实际订单重新进入');
    shopId=order.shop_id;backend.reviewProduct=reviewLineProduct(line);backend.reviewBrowseOrder=order;
   }
   backend.reviewShopId=shopId;
   backend.reviews=state.selectedProduct?await request('/hexu/app/reviews',{shopId,skuId:state.selectedProduct}):[];
   if(['M05','M06'].includes(id)&&!backend.guest&&products.some(p=>p.id===state.selectedProduct))try{await recordBrowse(state.selectedProduct)}catch(e){toast('浏览记录保存失败：'+e.message)}
  }
  if(id==='M10'&&form){
   const order=backend.activeOrder,skuId=(order?.items||[]).some(l=>l.id===state.reviewSku)?state.reviewSku:order?.items?.[0]?.id||'';
   state.reviewSku=skuId;
   if(!order||!skuId){if(state.reviewParent)throw new Error('请从本人实际订单重新进入追评');return;}
   const memberId=backend.member?.id,token=backend.token,shopId=backend.shopId,orderId=order.id,selectedOrder=state.activeOrder,parentId=state.reviewParent
   reviewCurrent=()=>reviewVersion===reviewPageVersion&&Number(backend.member?.id)===Number(memberId)&&backend.token===token&&Number(backend.shopId)===Number(shopId)&&backend.activeOrder?.id===orderId&&state.activeOrder===selectedOrder&&state.reviewSku===skuId&&state.reviewParent===parentId
   const context=await request('/hexu/app/review-context',{shopId:order.shop_id,orderId:order.id,skuId,...(state.reviewParent?{parentId:state.reviewParent}:{})});
   if(!reviewCurrent())return false
   if(context.orderId!==order.id||context.skuId!==skuId||Number(context.shopId)!==Number(order.shop_id)||(state.reviewParent&&context.parent?.id!==state.reviewParent))throw new Error('订单评价上下文已变化，请重新读取');
   backend.reviewContext=context;backend.reviewParent=context.parent;backend.reviewSubmission=context.submission;backend.reviewAppendSubmission=context.appendSubmission;
   const prior=state.reviewParent?backend.reviewAppendSubmission:backend.reviewSubmission,key=[context.shopId,order.id,skuId,state.reviewParent||'',prior?.id||'',prior?.status||''].join(':');
   if(form._reviewKey!==key){const body=prior?.status==='SUPPLEMENT'?prior.body:{};Object.assign(form,{评价内容:body.content||'',rating:body.rating||5,匿名评价:!!body.anonymous,uploads:[...(body.uploads||[])],_reviewKey:key});}
   form._reviewScope=reviewDraftScope(order,skuId)
  }
  if(['M33','M37','M38'].includes(id)&&backend.agent)backend.assessment=await request('/hexu/app/assessment',{shopId:backend.shopId});
  if(id==='M52'&&state.pendingTransfer){const t=state.pendingTransfer,scope=t.type==='商城积分'?backend.shopId:0;if(Number(t.senderId)!==Number(backend.member.id)||Number(t.scopeShopId)!==scope||!Number.isSafeInteger(t.amount)||t.amount<=0){state.pendingTransfer=null;persist();throw new Error('转赠信息已变化，请从转赠页重新核对')}t.before=Number(scope===0?state.points:state.shopPoints);if(!t.recipientId){const r=await request('/hexu/app/recipient',{phone:t.phone});Object.assign(t,{recipientId:r.id,recipientName:r.name})}persist();}
  if(id==='M46'){
   const selection=state.selectedEarning,memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
   const selected=selection!=null&&selection!==''
   const earningId=selected?Number(selection):(backend.account.earnings||[])[0]?.id
   backend.earningDetail=null
   if(selected&&(!Number.isSafeInteger(earningId)||earningId<=0))throw new Error('收益记录编号无效')
   if(earningId){
    const detail=await request('/hexu/app/earnings/'+encodeURIComponent(earningId))
    if(Number(backend.member?.id)!==Number(memberId)||Number(backend.shopId)!==Number(shopId)||backend.token!==token||state.selectedEarning!==selection)throw new Error('账号或收益记录已变化，请重新读取')
    if(Number(detail.member_id)!==Number(memberId)||Number(detail.shop_id)!==Number(shopId))throw new Error('收益记录不属于当前账号或商城')
    backend.earningDetail=detail
   }
  }
  if(id==='M49'){
   const view=state.withdrawalView
   const savedId=Number(view?.memberId)===Number(backend.member?.id)&&Number(view?.shopId)===Number(backend.shopId)?view.id:''
   const selectedId=state.lastWithdrawal?.id||savedId
   const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
   const sameScope=()=>Number(backend.member?.id)===Number(memberId)&&Number(backend.shopId)===Number(shopId)&&backend.token===token&&(state.lastWithdrawal?.id||savedId)===selectedId
   const receipt=backend.withdrawalDetail
   const currentReceipt=receipt&&selectedId&&receipt.id===selectedId&&Number(receipt.member_id)===Number(memberId)&&Number(receipt.shop_id)===Number(shopId)?receipt:null
   const withdrawalId=selectedId||(backend.account.withdrawals||[])[0]?.id
   backend.withdrawalDetail=null
   if(withdrawalId){
    let detail
    try{detail=await request('/hexu/app/withdrawals/'+encodeURIComponent(withdrawalId))}
    catch(e){if(!sameScope())throw new Error('账号或提现单已变化，请重新读取');if(!currentReceipt||currentReceipt.id!==withdrawalId)throw e;detail=currentReceipt;toast('提现详情刷新失败，当前展示刚提交的申请：'+e.message)}
    if(!sameScope())throw new Error('账号或提现单已变化，请重新读取')
    if(Number(detail.member_id)!==Number(memberId)||Number(detail.shop_id)!==Number(shopId))throw new Error('提现单不属于当前账号或商城')
    backend.withdrawalDetail=detail
    state.lastWithdrawal={...detail,cents:detail.amount}
   }
  }
  if(['G09','G10','G11','G12','G13'].includes(id)){
   const [catalog,settings,freight,categoryDocs]=await Promise.all([request('/hexu/app/management/products',{shopId:backend.shopId}),request('/hexu/app/management/catalog-settings',{shopId:backend.shopId}),request('/hexu/app/management/documents_freight',{shopId:backend.shopId}),request('/hexu/app/management/documents_category',{shopId:backend.shopId})]);backend.catalog=catalog;backend.catalogSettings=settings;backend.freightTemplates=freight.filter(d=>d.status==='ACTIVE');backend.categoryDoc=categoryDocs.find(d=>d.status==='ACTIVE');
   if(id==='G10'&&form){const selected=state.editSku?catalog.find(p=>p.id===state.editSku):null,key=backend.shopId+':'+(selected?.id||'NEW');if(form._catalogId!==key){Object.assign(form,{商品名称:selected?.name||'',商品分类:selected?.category||settings.categories?.[0]||'',商品编码:selected?.id||'',商品状态:selected?.status==='ACTIVE',可售库存:selected?.available||0,运费模板:selected?.freight_id?selected.freight_id+' · '+(backend.freightTemplates.find(d=>d.id===selected.freight_id)?.body.name||'模板'):'默认模板',商品详情:selected?.description||'',规格:selected?.spec||'',retail:(selected?.retail||0)/100,cloud:(selected?.cloud_price||0)/100,center:(selected?.center_price||0)/100,owner:(selected?.owner_price||0)/100,weightGrams:selected?.weight_grams||1000,productGroup:selected?.product_group||'',stockReason:'',uploads:selected?.gallery||[],_catalogId:key,_expectedStock:selected?.available||0});backend.editProduct=selected;}}
   if(id==='G12'&&form){const chosen=backend.selectedFreight==='NEW'?null:backend.freightTemplates.find(x=>x.id===backend.selectedFreight)||backend.freightTemplates[0],key=backend.shopId+':'+(chosen?.id||'NEW');if(form._freightId!==key){Object.assign(form,{categoryNames:(settings.categories||[]).join('\n'),sortOrder:settings.categories||[],模板名称:chosen?.body.name||'',计费方式:({COUNT:'按件',WEIGHT:'按重量',FLAT:'固定运费'}[chosen?.body.billing]||'固定运费'),首件运费:(chosen?.body.freightCents||0)/100,续件运费:(chosen?.body.extraFee||0)/100,偏远地区加收:(chosen?.body.remoteFee||0)/100,满额包邮门槛:(chosen?.body.freeThreshold||0)/100,firstUnits:chosen?.body.firstUnits||1,stepUnits:chosen?.body.stepUnits||1,remoteRegions:chosen?.body.remoteRegions||'',_freightId:key,_freightDoc:chosen?.id});}}
   if(id==='G13'&&form){const selected=catalog.find(x=>x.id===state.boxSku)||catalog[0],key=backend.shopId+':'+(selected?.id||'');if(form._boxId!==key&&selected){Object.assign(form,{boxSize:selected.box_size,minBoxes:selected.min_boxes,minQty:selected.min_qty,mixGroup:selected.mix_group||'',mixUnits:selected.mix_units||1,allowLoose:!!selected.allow_loose,混批开关:!!settings.mixedEnabled,mixCapacity:settings.mixCapacity||24,minMixBoxes:settings.minMixBoxes||2,_boxId:key});backend.boxProduct=selected;}}
  }
  if(id==='G49')backend.pointTransferSummary=(await request('/hexu/app/management/pointTransferSummary',{shopId:backend.shopId}))[0];
  if(id==='G50'){const records=await request('/hexu/app/management/documents_points_risk',{shopId:backend.shopId}),rule=records.find(x=>x.status==='ACTIVE');backend.pointRiskCases=await request('/hexu/app/management/pointRiskCases',{shopId:backend.shopId});if(form&&form._pointRiskShop!==backend.shopId){Object.assign(form,{单笔上限:rule?.body.singleLimit||1000,每日累计上限:rule?.body.dailyLimit||5000,月累计上限:rule?.body.monthlyLimit||30000,每日最多次数:rule?.body.dailyCount||10,异常账户冻结:!!rule?.body.autoFreeze,frequencyEnabled:!!rule?.body.frequencyEnabled,windowCount:rule?.body.windowCount||5,windowSeconds:rule?.body.windowSeconds||60,_pointRiskId:rule?.id,_pointRiskShop:backend.shopId});}}
  if(id==='G29')backend.agentCounts=await request('/hexu/app/management/agentCounts',{shopId:backend.shopId});
  if(id==='G39'){const summary=await request('/hexu/app/management/earningSummary',{shopId:backend.shopId});if(!financeCurrent())return false;backend.earningSummary=summary[0];}
  if(['M47','M48'].includes(id))backend.documents.settlement_account=await request('/hexu/app/documents/settlement_account',{shopId:backend.shopId});
  if(id==='M47'){
   backend.policies=await request('/hexu/app/policies',{shopId:backend.shopId})
   const policy=backend.policies?.WITHDRAWAL_AGREEMENT
   const key=[backend.member?.id,backend.shopId,policy?.id||'',policy?.version||''].join(':')
   if(form&&form._withdrawalPolicyKey!==key){form.consent=false;form._withdrawalPolicyKey=key}
  }
  if(id==='M48'&&form){const records=backend.documents.settlement_account||[],selected=backend.selectedSettlementAccount==='NEW'?null:records.find(d=>d.id===backend.selectedSettlementAccount)||records[0],key=backend.shopId+':'+(selected?.id||'NEW')+':'+(selected?.updated_at||selected?.status||'');backend.settlementAccount=selected;if(form._settlementKey!==key){const b=selected?.body||{};Object.assign(form,{channel:({BALANCE:'系统余额',WECHAT:'微信零钱',BANK:'银行卡'}[b.channel]||'银行卡'),开户姓名:b.accountName||backend.member.name||'',银行卡号:b.bank||'',开户银行:b.bankName||'',_settlementKey:key,_settlementId:selected?.id});}}
  if(id==='G60'&&form&&form._decorationShop!==backend.shopId){const d=backend.storefront?.decoration||{};backend.decorationSnapshot=JSON.parse(JSON.stringify(d));Object.assign(form,{商城名称:d.brandName||d.name||state.shop,品牌标语:d.slogan||'',主题颜色:d.themeColor||'#155641',客服电话:d.customerPhone||d.servicePhone||'',店铺公告:d.announcement||'',uploads:(d.banners||[]).map(b=>b.image).filter(Boolean),sortOrder:d.moduleOrder||['品牌轮播','金刚区分类','品质推荐','限时活动','猜你喜欢'],_decorationShop:backend.shopId});}
  if(id==='G48'&&form){const records=await request('/hexu/app/management/documents_points_rule',{shopId:backend.shopId}),d=records.find(x=>x.status==='ACTIVE'),b=d?.body||{};if(form._pointsRuleShop!==backend.shopId){Object.assign(form,{消费每1元赠送:b.purchaseRate??1,每日签到赠送:b.checkinPoints??5,评价赠送:b.reviewPoints??10,'有效期（天）':b.expiryDays??365,每1元所需积分:b.pointsPerYuan??100,'最高抵扣比例（%）':b.deductionPercent??20,_pointsRuleShop:backend.shopId});}}
  if(id==='G18'&&form){const p=products.find(x=>x.id===state.selectedProduct)||products[0];if(p){if(form._warningSku!==backend.shopId+':'+p.id){form.预警阈值=p.warning_qty??0;form._warningSku=backend.shopId+':'+p.id;}form._warningSkuId=p.id;}}
  if(id==='M34'&&backend.agent){const cached=backend.activeInvite;if(!cached||cached.shopId!==backend.shopId||cached.agentId!==backend.agent.id||!isFutureTimestamp(cached.expiresAt))backend.activeInvite={...await apiCommand('invite'),agentId:backend.agent.id};}
  if(id==='M35'){
   backend.invitationContext=null
   const [context,policies]=await Promise.all([
    request('/hexu/app/invitation-context',{shopId:backend.shopId,invite:state.invite||''}),
    request('/hexu/app/policies',{shopId:backend.shopId})
   ])
   backend.invitationContext=context
   backend.policies=policies
   const policy=backend.policies?.CUSTOMER_AUTHORIZATION
   const key=[backend.member?.id,backend.shopId,policy?.id||'',policy?.version||''].join(':')
   if(form&&form._customerPolicyKey!==key){form.consent=false;form._customerPolicyKey=key}
  }
  if(id==='G51'&&form){if(form._couponShop!==backend.shopId){Object.assign(form,{优惠券名称:'',优惠券类型:'满减券',使用门槛:'',优惠金额:'',发放数量:'',适用商品:'全部商品',目标人群:'全部用户',有效期至:'',_couponShop:backend.shopId});}form.每人限领=1;form.适用商城=state.shop;}
  if(id==='G20'){backend.stocktakes=await request('/hexu/app/management/documents_stocktake',{shopId:backend.shopId});backend.stocktake=backend.stocktakes.find(d=>d.id===state.selectedStocktake)||backend.stocktakes.find(d=>d.status==='PENDING')||backend.stocktakes[0]||null;if(backend.stocktake)state.selectedStocktake=backend.stocktake.id;if(form&&form._stocktakeId!==backend.stocktake?.id){form.原因说明='';form._stocktakeId=backend.stocktake?.id||'';}}
  if(id==='G36'&&form){const records=await request('/hexu/app/management/documents_assessment_rule',{shopId:backend.shopId}),d=records.find(x=>x.status==='ACTIVE'),b=d?.body||{};backend.assessmentRule=d;backend.assessmentRuleReadOnly=assessmentReadOnlyReason(b);if(form._assessmentRuleShop!==backend.shopId){Object.assign(form,{方案名称:b.name||'',考核周期:({MONTH:'自然月',QUARTER:'自然季度',ROLLING:'滚动90天',YEAR:'自然年',CUSTOM:'自定义周期'}[b.periodKind]||(d?'滚动90天':'自然月')),销售业绩门槛:Number(b.salesThreshold||0)/100,有效直推人数:b.directCount??0,'客户复购率（%）':b.repeatRate??0,生效时间:shanghaiDate(b.effectiveAt||Date.now()),metricMode:b.operator==='WEIGHTED'?'加权指标':b.operator==='OR'?'任一指标满足':'全部指标同时满足',_assessmentRuleShop:backend.shopId});}}
  if(['G52','G53','G54'].includes(id)&&form){const kinds=id==='G52'?['promotion_rule','bundle']:id==='G53'?['bundle']:['invitation_campaign','group_campaign'];backend.marketingConfigs??={};backend.marketingConfigs[id]=(await Promise.all(kinds.map(kind=>request('/hexu/app/management/documents_'+kind,{shopId:backend.shopId})))).flat();hydrateMarketing(id,form);}
  if(['M59','M60'].includes(id))backend.linkCampaign=await request('/hexu/app/link-campaign',{shopId:backend.shopId});
  if(id==='G56'){const records=await request('/hexu/app/management/documents_link_campaign',{shopId:backend.shopId});const current=records.find(r=>r.status==='ACTIVE');if(form&&!form._linkHydrated){Object.assign(form,{...current?.body,_linkId:current?.id,enabled:!!current?.body?.enabled,directCount:2,entryFee:0,relationshipMode:current?.body?.relationshipMode||'KEEP_RELATION',passedChild:current?.body?.passedChild||'EARLIEST',startDate:current?.body?.startsAt?marketingDateOnly(current.body.startsAt):'',endDate:current?.body?.expiresAt?marketingDateOnly(current.body.expiresAt):'',_linkHydrated:true});}}
  if(id==='G57'){backend.linkRelations=await request('/hexu/app/management/documents_link_relation',{shopId:backend.shopId});backend.linkRewards=await request('/hexu/app/management/linkRewards',{shopId:backend.shopId});}
  if(id==='M58'){backend.groups=await request('/hexu/app/groups',{shopId:backend.shopId});backend.groupDetail=state.selectedGroup?await request('/hexu/app/groups/'+state.selectedGroup,{shopId:backend.shopId}):state.selectedGroupCampaign?null:backend.groups.groups[0]||null;backend.groupCampaign=backend.groups.campaigns.find(c=>c.campaignId===state.selectedGroupCampaign)||backend.groups.campaigns[0]||null;}
  if(['G06','G38'].includes(id)&&form){const key=id==='G06'?'生效时间':'执行日期';if(form[key]&&new Date(form[key]+'T00:00:00').getTime()<Date.now())form[key]='';}
  if(id==='G54'&&form)form.有效订单门槛??=1;
  if(id==='G46'){backend.adjustments=await request('/hexu/app/management/reconciliationAdjustments',{shopId:backend.shopId});}
  if(id==='M57')backend.invitation=await request('/hexu/app/invitation-campaign',{shopId:backend.shopId});
  if(id==='M56')backend.campaigns=await request('/hexu/app/marketing',{shopId:backend.shopId});
  if(id==='M39')backend.documents.promotion=await request('/hexu/app/documents/promotion',{shopId:backend.shopId});
  if(id==='M28')backend.closure=await request('/hexu/app/account-closure');
  if(['M25','M26'].includes(id))await loadProfile(id==='M26'?form:null)
  if(id==='G14'){
    state.wholesaleSku=null;backend.wholesaleProducts=[];backend.wholesaleRules=null
    const identity=[backend.member.id,backend.shopId,backend.token]
    const [items,rules]=await Promise.all([request('/hexu/app/products',{shopId:WHOLESALE_SHOP_ID,destinationShopId:backend.shopId}),request('/hexu/app/wholesale-rules',{shopId:WHOLESALE_SHOP_ID,destinationShopId:backend.shopId})])
    if(!sameMemberShop(...identity))return false
    backend.wholesaleProducts=items;backend.wholesaleRules=rules
    const chosen=items.find(p=>p.id===(state.selectedProduct||'stapler'))||items[0]
    if(!state.wholesaleDraft||!Array.isArray(state.wholesaleDraft.lines)||Number(state.wholesaleDraft.memberId)!==Number(backend.member.id)||Number(state.wholesaleDraft.shopId)!==Number(backend.shopId))state.wholesaleDraft={memberId:backend.member.id,shopId:backend.shopId,lines:chosen?[{id:chosen.id,qty:Number(chosen.box_size)*Number(chosen.min_boxes)}]:[]}
    state.wholesaleDraft.lines=state.wholesaleDraft.lines.filter(line=>items.some(p=>p.id===line.id))
    if(!state.wholesaleDraft.lines.length&&chosen)state.wholesaleDraft.lines=[{id:chosen.id,qty:Number(chosen.box_size)*Number(chosen.min_boxes)}]
    state.wholesaleSku=items.find(p=>p.id===state.wholesaleDraft.lines[0]?.id)||null
    if(form){
     for(const line of state.wholesaleDraft.lines)form[wholesaleQtyKey(line.id)]=line.qty
     const available=items.filter(item=>!state.wholesaleDraft.lines.some(line=>line.id===item.id))
     if(!available.some(item=>item.name+' · '+item.id===form.wholesaleAdd))form.wholesaleAdd=available[0]?available[0].name+' · '+available[0].id:''
    }
    persist()
  }
  if(id==='G15'){
   const context=state.wholesaleContext
    state.wholesaleSku=null;backend.wholesaleProducts=[];backend.wholesaleRules=null
   if(context&&Number(context.memberId)===Number(backend.member.id)&&Number(context.shopId)===Number(backend.shopId)){
     const identity=[backend.member.id,backend.shopId,backend.token]
     const [items,rules]=await Promise.all([request('/hexu/app/products',{shopId:WHOLESALE_SHOP_ID,destinationShopId:backend.shopId}),request('/hexu/app/wholesale-rules',{shopId:WHOLESALE_SHOP_ID,destinationShopId:backend.shopId})])
     if(!sameMemberShop(...identity))return false
     backend.wholesaleProducts=items;backend.wholesaleRules=rules
     state.wholesaleSku=items.find(p=>p.id===(context.lines?.[0]?.id||context.skuId))||null
     state.purchaseBoxes=context.boxes
   }
  }
  if(id==='G40'){const agents=await request('/hexu/app/management/agents',{shopId:backend.shopId});if(!financeCurrent())return false;backend.previewAgents=agents;if(form){const agent=agents.at(-1);if(!form.归属代理&&agent)form.归属代理=agent.id+' · '+({1:'云代理',2:'分货中心',3:'总代理'}[agent.rank_no]||'');if(!products.some(p=>p.id===form.试算商品))form.试算商品=products.find(p=>p.id===state.selectedProduct)?.id||products[0]?.id||'';}}
  if(id==='G16'){
   const memberId=backend.member.id,shopId=backend.shopId,token=backend.token
   if(state.purchaseOrder){
    const order=normalizedOrder(await request('/hexu/app/orders/'+encodeURIComponent(state.purchaseOrder)))
    if(!sameMemberShop(memberId,shopId,token)||!ownPurchaseOrder(order,memberId,shopId))throw new Error('该订单不是本人当前商城的采购订单')
    backend.purchaseOrderDetail=order;backend.activeOrder=order;backend.purchaseReceiveAllowed=order.rawStatus==='SHIPPED'
   }else{
    // 重进页面时从服务端恢复本人采购单，不依赖本机保存的上一笔订单编号。
    const orders=await request('/hexu/app/orders',{shopId:WHOLESALE_SHOP_ID})
    if(!sameMemberShop(memberId,shopId,token))throw new Error('账号或商城已变化，请重新读取采购订单')
    backend.purchaseOrders=orders.map(normalizedOrder).filter(order=>ownPurchaseOrder(order,memberId,shopId))
    backend.purchaseOrderScope={memberId,shopId,token}
   }
  }
  if(['M31','M32'].includes(id))backend.documents.agent_application=await request('/hexu/app/documents/agent_application',{shopId:backend.shopId});
  if(id==='M31'&&form){const d=backend.documents.agent_application?.[0],key=backend.shopId+':'+(d?.id||'')+':'+(d?.updated_at||d?.status||'');if(form._applicationKey!==key){form.uploads=[...(d?.body?.uploads||[])];form._applicationKey=key;}}
  if(['M22','M23','M24'].includes(id)&&!backend.refund)backend.refund=backend.account.refunds?.find(r=>r.id===state.selectedRefund&&r.order_id===state.activeOrder)||backend.account.refunds?.find(r=>r.order_id===state.activeOrder)||null;
  if(['M23','M24'].includes(id)){
   // 售后详情必须归属当前订单；旧选中记录只能在同单内复用。
   const refunds=backend.account.refunds||[],orderId=state.activeOrder;
   const refund=refunds.find(r=>r.id===state.selectedRefund&&r.order_id===orderId)||refunds.find(r=>r.id===backend.refund?.id&&r.order_id===orderId)||refunds.find(r=>r.order_id===orderId);
   backend.refund=refund&&Number(refund.member_id)===Number(backend.member.id)&&Number(refund.shop_id)===Number(backend.shopId)?refund:null;
   state.selectedRefund=backend.refund?.id||null;
  }
  if(['M23','M24'].includes(id)&&backend.refund){const detailPage=afterSaleDetailPage(backend.refund.refund_type);if(detailPage!==id){uni.redirectTo({url:'/pages/'+detailPage+'/index'});return true}}
  if(id==='M22'){
   const refunds=backend.account.refunds||[],selected=state.selectedRefund?refunds.find(r=>r.id===state.selectedRefund):state.activeOrder?refunds.find(r=>r.order_id===state.activeOrder&&r.status==='WAIT_RETURN')||refunds.find(r=>r.order_id===state.activeOrder):refunds.find(r=>r.id===backend.refund?.id);
   backend.refund=selected&&Number(selected.member_id)===Number(backend.member.id)&&Number(selected.shop_id)===Number(backend.shopId)?selected:null;
   backend.returnTrackingAllowed=backend.refund?.status==='WAIT_RETURN';
   if(form){const r=backend.refund,key=(r?.id||'')+':'+(r?.updated_at||'')+':'+(r?.status||'')+':'+(typeof r?.return_json==='string'?r.return_json:JSON.stringify(r?.return_json||{}));if(form._returnKey!==key||form._returnId!==r?.id){const returned=displayJson(r?.return_json);Object.assign(form,{快递公司:returned.carrier||'顺丰速运',tracking:returned.tracking||'',uploads:Array.isArray(returned.uploads)?[...returned.uploads]:[],_returnId:r?.id||'',_returnKey:key});}}
  }
  const resource=managementPages[id]||({G22:'orders',G23:'orders',G24:'orders',G26:'refunds',G27:'refunds',G28:'refunds',G31:'documents_agent_application',G37:'documents_promotion',G38:'documents_downgrade'}[id]);
  if(resource){const records=await request('/hexu/app/management/'+resource,{shopId:backend.shopId});if(!financeCurrent())return false;backend.management[id]=records;if(resource==='orders')backend.management[id]=backend.management[id].map(normalizedOrder);if(resource==='refunds'&&(backend.refund||state.selectedRefund)){backend.refund=backend.management[id].find(r=>r.id===(backend.refund?.id||state.selectedRefund))||null;if(backend.refund&&['G26','G27','G28'].includes(id)){const orders=await request('/hexu/app/management/orders',{shopId:backend.shopId});backend.refundOrder=orders.map(normalizedOrder).find(o=>o.id===backend.refund.order_id);if(form&&form._refundId!==backend.refund.id){form.实际验收=backend.refund.qty;form.退回数量=backend.refund.qty;form._refundId=backend.refund.id}}}}
  if(id==='G19'&&form){const items=backend.management.G19||[],snapshot=backend.shopId+':'+items.map(p=>[p.id,p.available,p.locked||0].join(':')).join('|');if(form._stocktakeSnapshot!==snapshot){for(const p of items)form[stocktakeKey(p.id)]=Number(p.available)+Number(p.locked||0);Object.assign(form,{盘点仓库:'本商城库存（接口无仓库维度）',盘点范围:'仅下方列出的真实商品',盘点负责人:backend.member.name||'当前登录会员',盘点日期:'提交时由服务端记录',_stocktakeSnapshot:snapshot});}}
  if(id==='G27'&&form&&backend.refund){
   const refund=backend.refund;
   const key=refund.id+':'+refund.status+':'+(typeof refund.evidence_json==='string'?refund.evidence_json:JSON.stringify(refund.evidence_json||{}));
   if(form._inspectionKey!==key){
    Object.assign(form,refundInspectionForm(refund),{_inspectionKey:key});
   }
  }
  if(id==='G22'){backend.management.G22=state.managementOrder?[normalizedOrder(await request('/hexu/app/management/orders/'+encodeURIComponent(state.managementOrder),{shopId:backend.shopId}))]:[]}
  if(id==='G37'){const list=backend.management.G37||[],d=list.find(d=>d.id===backend.selectedDocuments?.G37)||list.find(d=>['PENDING','SUPPLEMENT'].includes(d.status))||list[0]||null;backend.promotionReview=d;backend.promotionReviewAllowed=!!d&&['PENDING','SUPPLEMENT'].includes(d.status);backend.promotionReviewContext={memberId:backend.member.id,shopId:backend.shopId,token:backend.token};if(form){const key=(d?.id||'')+':'+(d?.updated_at||d?.status||'');if(form._promotionKey!==key){Object.assign(form,{审核意见:d?.review_note||'',职级生效时间:d?.body?.effectiveAt?dateOnly(d.body.effectiveAt):'',_promotionKey:key});}}}
  if(['G26','G27','G28'].includes(id)&&backend.refund&&backend.refundOrder?.order_type==='DEALER_RETAIL'&&!['PENDING','REJECTED','CLOSED'].includes(backend.refund.status)){try{backend.afterSaleCandidates=await request('/hexu/app/management/aftersale-links/candidates',{shopId:backend.shopId,customerRefundId:backend.refund.id})}catch(e){backend.afterSaleCandidateError=e.message}}
  if(id==='G28'&&form&&backend.refund&&form._afterSaleRefund!==backend.refund.id){const link=backend.afterSaleLinks.find(x=>x.customerRefundId===backend.refund.id),pending=state.pendingDirectLink?.customerRefundId===backend.refund.id?state.pendingDirectLink:null,chosen=state.pendingDirectOrder?.customerRefundId===backend.refund.id?state.pendingDirectOrder:null;Object.assign(form,{wholesaleOrderId:pending?.wholesaleOrderId||link?.wholesaleOrderId||chosen?.wholesaleOrderId||'',wholesaleRefundId:pending?.wholesaleRefundId||link?.wholesaleRefundId||'',_afterSaleRefund:backend.refund.id});}
  if(id==='G28'&&form&&backend.refund){
   const refund=backend.refund,shipped=displayJson(refund.exchange_json)||{};
   const key=refund.id+':'+refund.status+':'+(typeof refund.exchange_json==='string'?refund.exchange_json:JSON.stringify(refund.exchange_json||{}));
   if(form._exchangeKey!==key)Object.assign(form,{新发快递:shipped.carrier||'',tracking:shipped.tracking||'',_exchangeKey:key});
  }
  if(id==='G35'&&form){const list=backend.management.G35||[],d=list.find(x=>x.id===backend.selectedDocuments?.G35)||list.find(x=>x.status==='PENDING')||list[0];if(d&&form._scopeId!==d.id){form['有效期至']=new Date(timestamp(d.body.expiresAt)).toLocaleDateString('en-CA');form['可采购数量上限']=d.body.items?.[0]?.qty;form['撤销原因']='';form._scopeId=d.id;}}
  if(id==='G30'){const rows=backend.management.G30||[],chosen=rows.find(a=>a.id===state.selectedAgent)||rows[0];backend.agentSummary=chosen?await request('/hexu/app/management/agent-summary/'+chosen.id,{shopId:backend.shopId}):null;}
  if(['G43','G44'].includes(id)){
   const selection=state.selectedWithdrawal||'',rows=backend.management[id]||[]
   const chosen=selection?{id:selection}:rows.find(w=>w.status==='PENDING')||rows[0]
   const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
   backend.managementWithdrawal=null
   if(chosen){
    const detail=await request('/hexu/app/management/withdrawals/'+encodeURIComponent(chosen.id))
    if(Number(backend.member?.id)!==Number(memberId)||Number(backend.shopId)!==Number(shopId)||backend.token!==token||(state.selectedWithdrawal||'')!==selection)throw new Error('管理账号或提现申请已变化，请重新读取')
    if(Number(detail.shop_id)!==Number(shopId))throw new Error('提现申请不属于当前商城')
    backend.managementWithdrawal=detail
   }
  }
  if(id==='G42'){const rows=backend.management.G42||[],chosen=rows.find(e=>e.order_id===state.reversalOrder)||rows.find(e=>e.reversed)||rows[0],reversal=chosen?await request('/hexu/app/management/reversals/'+chosen.order_id,{shopId:backend.shopId}):null;if(!financeCurrent())return false;backend.reversal=reversal;}
  return true
  }catch(e){
   if(e instanceof StaleRefreshError)return false
   if(id==='G55'&&(marketingVersion!==marketingPageVersion||marketingStart&&!sameMemberShop(...marketingStart)))return false
   if(id==='M10'&&!reviewCurrent())return false
   if(!financeCurrent())return false
   const receipt=backend.withdrawalDetail
   if(id==='M49'&&receipt&&state.lastWithdrawal?.id&&receipt.id===state.lastWithdrawal.id&&Number(receipt.member_id)===Number(backend.member?.id)&&Number(receipt.shop_id)===Number(backend.shopId)){
    toast('提现详情刷新失败，当前展示刚提交的申请：'+e.message)
    return true
   }
   const redeemed=backend.redemptionOrder
   if(id==='M63'&&redeemed&&state.lastRedemption?.id&&redeemed.id===state.lastRedemption.id&&redeemed.order_type==='POINTS'&&Number(redeemed.buyer_id)===Number(backend.member?.id)&&Number(redeemed.shop_id)===Number(backend.shopId)){
    toast('兑换订单刷新失败，当前展示刚提交的订单：'+e.message)
    return true
   }
   if(id==='M10'){backend.reviewContext=null;backend.reviewParent=null;backend.reviewSubmission=null;backend.reviewAppendSubmission=null;}
   if(id==='M12'){backend.policies={};backend.purchaseAgreementError=e.message;if(form){form.orderConsent=false;form._purchaseAgreementKey=''}}if(displayPages.has(id)){backend.displayPageErrors[id]=e.message;if(id==='G16'){backend.purchaseOrderDetail=null;backend.purchaseReceiveAllowed=false;}if(id==='G37'){backend.promotionReview=null;backend.promotionReviewAllowed=false;}if(id==='M22'){backend.refund=null;backend.returnTrackingAllowed=false;}}if(actionPages.has(id))backend.actionPageErrors[id]=e.message;if(guestPages.includes(id)){backend.error=e.message;backend.ready=false;backend.guest=false;backend.shopInfo=null;backend.catalogShopId=null;state.shop='';products.splice(0,products.length)}if(['G07','G08','G23','G24','G26','G27','G28','M19','M27','G41','G55','G61','G62','G64'].includes(id))backend.operationError=e.message;if(financeVersion){backend.financeErrors[id]=e.message;backend.settlementPreview=null;backend.settlementPreviewKey=''}if(['G58','G59'].includes(id)){backend.reportErrors[id]=e.message;backend.reports[id]=null;}backend.management[id]=[];for(const key of ({M46:['earningDetail'],M49:['withdrawalDetail'],G30:['agentSummary'],G39:['earningSummary'],G42:['reversal'],G43:['managementWithdrawal'],G44:['managementWithdrawal']}[id]||[]))backend[key]=null;toast(e.message);return false
  }finally{if(id==='M10'){if(reviewVersion===reviewPageVersion)backend.pageLoading.M10=0}else backend.pageLoading[id]=Math.max(0,(backend.pageLoading[id]||1)-1)}
}
export function selectOrder(o,management=false){if(!management){backend.afterLineId=null;backend.refund=null;state.selectedRefund=null;state.reviewParent=null;state.reviewSku=o.items?.[0]?.sku_id||o.items?.[0]?.id||'';}state[management?'managementOrder':'activeOrder']=o.id;if(!management)backend.activeOrder=o;persist();navigate(management?'G22':'M18')}
export function selectRefund(r){backend.refund=r;state.selectedRefund=r.id;state.managementOrder=r.order_id;persist();navigate(managementAfterSalePage(r))}
function modal(title,content){return new Promise(resolve=>uni.showModal({title,content,success:r=>resolve(r.confirm),fail:()=>resolve(false)}))}
function openProductTarget(target){const skuId=target.slice(8);if(!products.some(p=>p.id===skuId)){toast('商品已变化，请刷新后重试');return true}state.selectedProduct=skuId;backend.productSelection=null;if(backend.guest)clearLoginReturn();else persist();navigate('M05');return true}
function shareProduct(){const skuId=state.selectedProduct;if(!products.some(p=>p.id===skuId)){toast('商品已变化，请刷新后重试');return true}uni.setClipboardData({data:'/pages/M05/index?shop='+backend.shopId+'&sku='+encodeURIComponent(skuId),success:()=>toast('商品链接已复制')});return true}
export async function handleRemote(target,ctx){const {pageId,form,selectedLines,pointsDiscount,address,validate}=ctx;
  if(pageId==='G14'&&(target==='wholesale-add'||target.startsWith('wholesale-remove:'))){
   const draft=state.wholesaleDraft,items=backend.wholesaleProducts||[]
   if(!draft||Number(draft.memberId)!==Number(backend.member?.id)||Number(draft.shopId)!==Number(backend.shopId)){toast('采购商品已变化，请重新读取');return true}
   if(target==='wholesale-add'){
    const sku=items.find(item=>item.id===form.wholesaleAdd||item.name+' · '+item.id===form.wholesaleAdd)
    if(!sku||draft.lines.some(line=>line.id===sku.id)){toast('请选择尚未添加的公司批发商品');return true}
    const qty=Number(sku.box_size)*Number(sku.min_boxes)
    draft.lines.push({id:sku.id,qty});form[wholesaleQtyKey(sku.id)]=qty
    form.wholesaleAdd=''
   }else{
    if(draft.lines.length<2){toast('请至少保留一件采购商品');return true}
    draft.lines=draft.lines.filter(line=>line.id!==target.slice('wholesale-remove:'.length))
   }
   state.wholesaleSku=items.find(item=>item.id===draft.lines[0]?.id)||null
   persist();return true
  }
 if(pageId==='M29'&&target.startsWith('support-select:')){
  const id=target.slice(15);
  if(!(backend.supportRecords||[]).some(record=>record.id===id))throw new Error('留言已变化，请刷新后重试');
  backend.selectedSupportId=id;return true;
 }
 if(pageId==='G09'&&target==='G10'){state.editSku=null;navigate('G10');return true}
 if(pageId==='G14'&&target==='G13'){
  const sku=state.wholesaleSku;
  if(!sku){toast('请先读取当前批发商品');return true}
  const group=String(sku.mix_group||'').trim();
  const content=`${sku.name||sku.id}\n${Number(sku.box_size)||0}件/箱，${Number(sku.min_boxes)||0}箱起批。\n${group?'混批组：'+group+'；是否可混批以平台配置和结算校验为准。':'未配置混批组，按当前商品整箱起订。'}`;
  uni.showModal({title:'公司批发商品箱规',content,showCancel:false,success:()=>{}});
  return true;
 }
 if(target==='M09'){state.reviewBrowse=null;persist();navigate('M09');return true;}
  const pure=['after-type','choose-coupon','coupon-skip','help'];if(!target||/^[MG]\d{2}$/.test(target)||pure.includes(target))return false;
  if(target==='policy'||target.startsWith('policy:')){try{let type=target.slice(7);const cached=backend.policies||{},policies=Object.keys(cached).length&&(!type||cached[type])?cached:await request('/hexu/app/policies',{shopId:backend.shopId});backend.policies=policies;const types=['USER_AGREEMENT','PRIVACY_POLICY','THIRD_PARTY_SHARING'];if(!type){const choice=await new Promise(resolve=>uni.showActionSheet({itemList:['用户协议','隐私政策','第三方共享清单'],success:r=>resolve(r.tapIndex),fail:()=>resolve(-1)}));if(choice<0)return true;type=types[choice]}const doc=policies[type];if(!doc)throw new Error('该协议尚未发布');backend.openPolicy=doc}catch(e){toast(e.message)}return true}
  if(target==='login'&&localSandbox()){
   if(!form.consent){toast('请阅读并同意登录协议');return true;}
   try{
    if(await connect()){
     const policies=await request('/hexu/app/policies',{shopId:backend.shopId}),versions=currentPolicyVersions(policies);
     backend.policies=policies;
     backend.consents=await apiCommand('privacy-consent',{versions});
     navigate(consumeLoginReturn());
    }
   }catch(e){toast(e.message||'协议同意记录失败')}
   return true;
  }
  if(target==='login'&&!localSandbox()){
   let sessionIssued=false;
   try{
    if(!form.consent)throw new Error('请阅读并同意登录协议');
    const policies=await request('/hexu/app/policies',{shopId:backend.shopId}),versions=currentPolicyVersions(policies);
    backend.policies=policies;
    const login=await new Promise((resolve,reject)=>uni.login({provider:'weixin',success:resolve,fail:reject}));
    const session=await request('/hexu/app/wechat/login',{code:login.code,consent:true,versions,shopId:backend.shopId,invite:pendingLoginReturn()?.invite||state.invite||''},'POST');
    renewedSession=null;backend.token=session.token;sessionIssued=true;uni.setStorageSync('hexu-api-token',session.token);
    await refresh();backend.ready=true;backend.guest=false;uni.removeStorageSync('hexu-guest-browse');navigate(consumeLoginReturn());
   }catch(e){if(sessionIssued){renewedSession=null;backend.token='';clearMemberView();backend.guest=false;backend.error=e.message||'登录资料读取失败';uni.removeStorageSync('hexu-api-token');persist()}toast(e.message||e.errMsg||'微信授权未完成')}
   return true
 }
 if(target.startsWith('product:')&&backend.guest)return openProductTarget(target)
 if(target==='share'&&backend.guest&&['M05','M07'].includes(pageId))return shareProduct()
 if(backend.guest){rememberLoginReturn(pageId);toast('请先微信登录，再使用会员功能');navigate('M01');return true}
 if(!backend.ready&&!(await connect()))return true;
 if(backend.busy)return true;if(backend.uploadingCount>0){toast('图片上传中，请稍候再提交');return true}backend.busy=true;
  try{
   if(target==='action-page-refresh'){await pageData(pageId,form);return true;}
   if(pageId==='G16'&&target==='purchase-orders'){
    state.purchaseOrder=null;persist();await pageData('G16',form);return true
   }
   if(pageId==='G16'&&target==='purchase-order-search'){
    const id=String(form.purchaseOrderId||'').trim(),memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
    if(!PURCHASE_ORDER_ID_PATTERN.test(id))throw new Error('请填写有效的采购订单编号')
    // 历史订单可能超出最近200单列表，按编号读取详情后仍逐项核对购买人和商城。
    const order=normalizedOrder(await request('/hexu/app/orders/'+encodeURIComponent(id)))
    if(!sameMemberShop(memberId,shopId,token)||!ownPurchaseOrder(order,memberId,shopId)||order.id!==id)throw new Error('该订单不是本人当前商城的采购订单')
    state.purchaseOrder=id;persist();await pageData('G16',form);return true
   }
   if(pageId==='G16'&&target.startsWith('purchase-order:')){
    const id=target.slice('purchase-order:'.length),scope=backend.purchaseOrderScope
    // 只接受刚从本人当前商城采购列表读到的订单，再由详情接口复核权限和状态。
    if(!scope||!sameMemberShop(scope.memberId,scope.shopId,scope.token)||!(backend.purchaseOrders||[]).some(order=>order.id===id))throw new Error('采购订单列表已变化，请重新读取')
    state.purchaseOrder=id;persist();await pageData('G16',form);return true
   }
   if(target==='review-order'){const order=pageId==='M10'?backend.activeOrder:pageId==='M09'?backend.reviewBrowseOrder:null;if(!order||order.id!==(pageId==='M10'?state.activeOrder:state.reviewBrowse?.orderId))throw new Error('请从本人实际订单重新进入');state.activeOrder=order.id;persist();navigate('M18');return true;}
   if(target==='redemption-order'){const order=backend.redemptionOrder;if(!order||order.order_type!=='POINTS')throw new Error('请先完成真实积分兑换');state.activeOrder=order.id;persist();navigate('M18');return true;}
   if(target.startsWith('cross-product:')){const skuId=target.slice(14);if(!(backend.crossPurchaseCatalog||[]).some(p=>p.id===skuId))throw new Error('目标商城商品已变化，请刷新后再选');backend.crossPurchaseDraft={scope:[backend.member?.id,backend.shopId,backend.crossPurchaseTarget?.id].join(':'),skuId};await pageData('M44',form);return true;}
   if(pageId==='M43'&&(target==='M44'||target==='M05')){if(!backend.requestedShopId)throw new Error('请先选择目标商城');await pageData('M44',{});navigate('M44');return true;}
   if(pageId==='M44'&&['cross-store','submit'].includes(target)){
    const shop=backend.crossPurchaseTarget,p=backend.crossPurchaseProduct,qty=Number(form.采购数量);
    if(!shop||!p||Number(shop.id)!==Number(backend.requestedShopId))throw new Error('请先选择目标商城及其可售商品');
    if(!validate())return true;
    if(!Number.isSafeInteger(qty)||qty<1)throw new Error('采购数量必须为正整数');
    const reason=String(form.reason||'').trim();if(!reason||[...reason].length>500)throw new Error('申请原因须为1–500个字符');
    await apiCommand('document-save',{kind:'cross_purchase',shopId:shop.id,sourceShopId:backend.shopId,name:backend.member.name,expiresAt:Date.now()+86400000,singleUse:true,items:[{skuId:p.id,qty}],reason});
    toast('跨店采购申请已提交，等待审核');return true;
   }
   if(pageId==='M41'&&target==='migration'&&!backend.migrationContext?.currentBinding)throw new Error('当前没有可迁移的归属');
   if(target.startsWith('product-reviews:')){const skuId=target.slice(16),order=backend.activeOrder;state.reviewBrowse=pageId==='M10'&&order?.items?.some(l=>l.id===skuId)?{shopId:order.shop_id,orderId:order.id,skuId}:null;state.selectedProduct=skuId;persist();navigate('M09');return true;}
   if(target.startsWith('review-append:')){
    const parent=backend.reviews.find(r=>r.id===target.slice(14)&&r.mine&&(r.appendAllowed||r.appendSupplementAllowed));
    if(!parent)throw new Error('当前评价不可追加，请刷新后再试');
    state.activeOrder=parent.orderId;state.reviewSku=parent.skuId;state.reviewParent=parent.id;persist();navigate('M10');return true;
   }
   if(pageId==='M10'&&target.startsWith('review-line:')){state.reviewParent=null;state.reviewSku=target.slice(12);await pageData(pageId,form);return true;}
   if(pageId==='M10'&&target==='review'){
    const context=backend.reviewContext,order=backend.activeOrder;
    if(backend.pageLoading.M10||backend.actionPageErrors?.M10||!context||context.orderId!==order?.id||context.skuId!==state.reviewSku||Number(context.shopId)!==Number(order.shop_id)||(state.reviewParent?context.parent?.id!==state.reviewParent:!context.reviewAllowed))throw new Error('当前订单评价不可提交，请重新读取本人订单评价');
    if(!state.reviewParent&&backend.reviewSubmission&&backend.reviewSubmission.status!=='SUPPLEMENT')throw new Error('此商品已提交评价，请等待审核或在评价列表追加');
    const payload=reviewPayload(form,backend.activeOrder,state.reviewSku,backend.reviewParent,state.reviewParent?backend.reviewAppendSubmission:backend.reviewSubmission);
    await apiCommand('document-save',{...payload,shopId:context.shopId});state.selectedProduct=state.reviewSku;state.reviewBrowse={shopId:context.shopId,orderId:context.orderId,skuId:context.skuId};state.reviewParent=null;backend.reviewContext=null;form._reviewKey='';persist();
    toast(payload.kind==='review_append'?'追评已提交，审核通过后展示':'评价已提交，审核通过后展示');navigate('M09');return true;
   }
   if(target.startsWith('stocktake-select:')){state.selectedStocktake=target.slice(17);persist();await pageData('G20',form);return true;}
   if(target.startsWith('agent-customer:')){const id=Number(target.slice(15));if(!(backend.agentData?.customers||[]).some(c=>Number(c.member_id)===id))throw new Error('客户记录已变化，请刷新');backend.selectedAgentCustomer=id;return true;}
   if(target.startsWith('marketing-config:')){const id=target.slice(17),d=(backend.marketingConfigs?.[pageId]||[]).find(d=>d.id===id);backend.selectedMarketingConfig??={};backend.selectedMarketingConfig[pageId]=id;if(d)form._marketingTab=marketingLabels[d.body.type||d.kind];form._marketingKey='';hydrateMarketing(pageId,form);return true;}
   if(pageId==='G36'&&target==='save'){
    if(backend.actionPageErrors?.G36)throw new Error('请先重新读取考核方案');const prior=backend.assessmentRule?.body||{},readonly=assessmentReadOnlyReason(prior);if(readonly)throw new Error(readonly+' 原方案已保护，请在支持完整参数的管理端维护。');
    if(!String(form.方案名称||'').trim())throw new Error('请填写方案名称');if(!['全部指标同时满足','任一指标满足'].includes(form.metricMode))throw new Error('请选择本页支持的指标关系');if(!['自然月','自然季度','滚动90天'].includes(form.考核周期))throw new Error('请选择本页支持的考核周期');
    const date=calendarDate(form.生效时间,'生效日期');if(date<shanghaiDate(Date.now())||date>'2100-12-31')throw new Error('生效日期不能早于上海今天且须在2100年以内');
    const data={...prior,kind:'assessment_rule',name:String(form.方案名称||'').trim(),periodMonths:form.考核周期==='自然月'?1:3,periodKind:({'自然月':'MONTH','自然季度':'QUARTER','滚动90天':'ROLLING'}[form.考核周期]),salesThreshold:inputCents(form.销售业绩门槛,'销售业绩门槛'),directCount:inputNumber(form.有效直推人数,'有效直推人数',true),repeatRate:inputNumber(form['客户复购率（%）'],'客户复购率',true),operator:form.metricMode==='任一指标满足'?'OR':'AND',effectiveAt:Date.parse(date+'T00:00:00+08:00')};
    finiteIntegerFields(data,['salesThreshold','directCount','repeatRate','effectiveAt']);delete data.id;await apiCommand('document-save',data,true);form._assessmentRuleShop=null;await pageData(pageId,form);toast('考核方案已保存');return true;
   }
   if(['G52','G53','G54'].includes(pageId)&&['save','publish'].includes(target)){
    const type=marketingType(pageId,ctx.activeFilter||form._marketingTab),prior=backend.marketingDetails?.[pageId];
    if(prior&&!['DRAFT','ACTIVE','REJECTED','SUPPLEMENT'].includes(prior.status))throw new Error('该活动已归档或审核中，不能覆盖；请在下方新建当前类型活动');
    if(pageId==='G54'&&!String(form.活动名称||'').trim())throw new Error('请填写活动名称');
    const dates={startsAt:businessDateTimestamp(form.开始时间,'开始时间'),expiresAt:businessDateTimestamp(pageId==='G54'?form.截止日期:form.结束时间,'结束时间',true)};let data;
    if(pageId==='G52'){const combo=['GIFT','EXCHANGE'].includes(type),currency=['FULL_REDUCTION','EXCHANGE'].includes(type),amount=currency?inputCents(form.活动折扣,type==='FULL_REDUCTION'?'满减金额':'换购金额'):0;data={kind:combo?'bundle':'promotion_rule',id:prior?.id,name:String(form.活动名称||'').trim(),type,skuIds:form.促销商品||'',qualifierSkuIds:combo?form.促销商品||'':undefined,items:combo?[{skuId:form.活动商品,qty:1}]:undefined,price:type==='GIFT'?0:currency?amount:Math.round(Number(form.活动折扣)*100),threshold:['FULL_REDUCTION','GIFT','EXCHANGE'].includes(type)?inputCents(form.活动门槛,'活动门槛'):Math.round(Number(form.活动门槛||0)*100),discount:type==='FULL_REDUCTION'?amount:0,rateBps:currency||type==='GIFT'?0:Math.round(Number(form.活动折扣)*1000),quantity:Number(form.活动库存),perMember:Number(form.每人限购),...dates,stackCoupon:!!form.允许优惠券叠加,stackPoints:!!form.允许积分抵扣};}
    if(pageId==='G53'){const items=String(form.套餐商品||'').split(/[,，\n]/).map(x=>x.trim()).filter(Boolean).map(x=>{const [skuId,n='1']=x.split(/[:：]/);return {skuId:skuId.trim(),qty:Number(n)}});if(!items.length||items.some(x=>!x.skuId||!Number.isInteger(x.qty)||x.qty<1))throw new Error('请填写套餐商品SKU和正整数数量，例如 SKU:1');data={kind:'bundle',id:prior?.id,name:String(form.套餐名称||'').trim(),type,items,threshold:type==='ADDON'?inputCents(form.活动门槛,'活动门槛'):0,price:inputCents(form.套餐价格,'套餐价格'),quantity:Number(form.活动库存),perMember:Number(form.每人限购),...dates};}
    if(pageId==='G54')data=type==='group_campaign'?groupCampaignPayload(form,prior,dates):invitationCampaignPayload(form,prior,dates);
    if(['G52','G53'].includes(pageId)){
     data.quantity=inputNumber(form.活动库存,'活动库存',true);data.perMember=inputNumber(form.每人限购,'每人限购',true);
     if(pageId==='G52'&&['LIMITED','FLASH'].includes(type))inputNumber(form.活动折扣,'活动折扣');
     finiteIntegerFields(data,['price','threshold','discount','rateBps','quantity','perMember']);
    }
    if(!data.name)throw new Error('请填写活动名称');if(!Number.isFinite(dates.startsAt)||!Number.isFinite(dates.expiresAt)||dates.startsAt>=dates.expiresAt)throw new Error('请填写有效的活动起止日期');const saved=await apiCommand('document-save',data,true);backend.selectedMarketingConfig??={};backend.marketingDetails??={};backend.marketingDetails[pageId]={...saved,body:data};backend.selectedMarketingConfig[pageId]=saved.id;form._marketingKey='';toast(await pageData(pageId,form)?'活动配置已保存并同步':'活动配置已保存，列表读取失败，请刷新');return true;
   }
   if(pageId==='M48'&&target.startsWith('settlement-account:')){const id=target.slice(19);backend.selectedSettlementAccount=id;form._settlementKey='';await pageData(pageId,form);return true}
   if(pageId==='M48'&&target==='save'){
    const prior=backend.settlementAccount;if(prior&&['PENDING','APPROVED'].includes(prior.status))throw new Error(prior.status==='PENDING'?'账户正在审核，请等待审核结果':'已审核账户如需更换，请先选择新增账户');
    const channel={系统余额:'BALANCE',微信零钱:'WECHAT',银行卡:'BANK'}[form.channel],accountName=String(form.开户姓名||'').trim(),bank=String(form.银行卡号||'').trim(),bankName=String(form.开户银行||'').trim();
    if(!channel)throw new Error('请选择结算渠道');if(!accountName||accountName.length>40)throw new Error('请填写40字以内的开户姓名');
    const unchangedMask=prior&&bank===prior.body?.bank&&bank.includes('*');if(channel==='BANK'&&(!bankName||bankName.length>60||(!unchangedMask&&(!/^\d{16,19}$/.test(bank)||/^(\d)\1+$/.test(bank)))))throw new Error('请填写开户银行和16至19位有效银行卡号');
    const saved=await apiCommand('document-save',{kind:'settlement_account',id:prior?.id,channel,accountName,bank:channel==='BANK'?bank:'',bankName:channel==='BANK'?bankName:'',phone:backend.member.phone||''});backend.settlementAccount=saved;backend.documents.settlement_account=[saved,...(backend.documents.settlement_account||[]).filter(d=>d.id!==saved.id)];backend.selectedSettlementAccount=saved.id;form._settlementKey='';toast(await pageData(pageId,form)?'账户已提交审核':'账户已提交，状态读取失败，请刷新');return true;
   }
   if(pageId==='M31'&&target==='agent-resubmit'){
    const prior=backend.documents.agent_application?.[0]
    if(!prior||!['REJECTED','SUPPLEMENT'].includes(prior.status))throw new Error('当前申请不需要重新提交')
    if(!form.uploads?.length)throw new Error('请上传需要补充的资料')
    const data={...prior.body,id:prior.id,kind:'agent_application',uploads:form.uploads}
    if(!prior.body?.agreementVersion){
     // 仅历史无签署版本的申请需要在补件时单独确认现行协议。
     const agreement=backend.policies?.AGENT_AGREEMENT
     if(!form.agreementReconsent||!agreement?.id||!agreement?.version||form._agentAgreementKey!==[backend.shopId,agreement.id,agreement.version].join(':'))throw new Error('请阅读并同意当前代理合作协议')
     Object.assign(data,{agreementReconsent:true,agreementVersion:agreement.version,agreementPolicyId:agreement.id})
    }
    await apiCommand('document-save',data);form._applicationKey='';await pageData(pageId,form);toast('补充资料已重新提交审核');return true
   }
   if(pageId==='G60'&&target==='decorate'){
    const original=backend.decorationSnapshot||backend.storefront?.decoration||{},brandName=String(form.商城名称||'').trim(),phone=String(form.客服电话||'').trim();if(!brandName)throw new Error('请填写商城名称');if(phone&&!/^[0-9+() -]{5,30}$/.test(phone))throw new Error('请填写正确的客服电话');
    const data={...original,kind:'decoration',name:brandName,brandName,slogan:String(form.品牌标语||'').trim(),customerPhone:phone,announcement:String(form.店铺公告||'').trim(),banners:updatedBanners(original.banners,form.uploads,brandName)};delete data.id;delete data.uploads;delete data.servicePhone;await apiCommand('document-save',data,true);form._decorationShop=null;toast(await pageData(pageId,form)?'装修已保存，商城展示已同步':'装修已保存，商城展示读取失败，请刷新');return true;
   }
   if(pageId==='G48'&&target==='save'){await apiCommand('document-save',pointsRulePayload(form),true);form._pointsRuleShop=null;await pageData(pageId,form);toast('本商城积分规则已保存');return true;}
   if(pageId==='G05'&&['approve','reject'].includes(target))throw new Error('开店申请由平台后台审核，请在此查看处理进度');
   if(target.startsWith('shop-details:')){const shop=backend.shops.find(s=>String(s.id)===target.slice(13));if(!shop)throw new Error('商城资料已变化，请刷新');await modal(shop.name,[shop.county,shop.kind==='DIRECT'?'公司直营商城':'经销商商城',label(shop.status),Number(shop.id)===Number(backend.shopId)?'当前管理商城':'其他商城的公开信息'].filter(Boolean).join('\n'));return true;}
  if(pageId==='M26'&&target==='profile-refresh'){await loadProfile(form,true);return true}
  if(pageId==='M27'&&target==='privacy-refresh'){await pageData(pageId,form);return true}
  if(pageId==='M26'&&target==='save'){
   if(backend.profileError||!form._hydrated||Number(form._profileMemberId)!==Number(backend.member?.id))throw new Error('请先重新读取个人资料')
   const memberId=backend.member?.id,token=backend.token
   const profile=await request('/hexu/app/profile',profilePayload(form),'POST',uuid())
   if(!sameProfileAccount(memberId,token)){form._hydrated=false;toast('原账号资料已保存，请切回原账号核对');return true}
   profileLoadVersion++
   backend.profileError=''
   backend.profile=profile;backend.profileMemberId=memberId;hydrateProfile(form,profile);form._profileMemberId=memberId
   if(backend.member)backend.member.name=profile.name
   toast('保存成功');return true
  }
   if(pageId==='G07'&&target==='merchant-submit'){if(!validate())return true;backend.merchant=await request('/hexu/app/management/merchant/submit',merchantApplicationPayload(backend.shopId,form),'POST',uuid());toast('进件资料已提交，等待渠道核实');return true}
   if(['G07','G08'].includes(pageId)&&target.startsWith('merchant-reference:')){const stage=target.slice(19),key={APPLICATION:'applicationRef',AUTHORIZATION:'authorizationRef',CERTIFICATE:'certificateRef',TRANSFER:'transferAuthRef'}[stage];if(!key)throw new Error('渠道编号类型无效');const reference=String(form[key]||'').trim();if(!reference)throw new Error('请填写真实渠道凭证编号');backend.merchant=await request('/hexu/app/management/merchant/reference',{shopId:backend.shopId,stage,reference},'POST',uuid());toast('渠道凭证已补录，等待平台核验');return true}
   if(pageId==='M27'&&target==='privacy-consent'){if(!form.policyConsent)throw new Error('请先阅读并确认当前版本协议');const policies=await request('/hexu/app/policies',{shopId:backend.shopId}),versions=currentPolicyVersions(policies);backend.policies=policies;backend.consents=await apiCommand('privacy-consent',{versions});form.policyConsent=false;toast('当前版本授权已记录');return true}
   if(['G07','G08'].includes(pageId)&&target==='merchant-refresh'){backend.merchant=await request('/hexu/app/management/merchant',{shopId:backend.shopId});toast('已同步商户状态');return true}
   if(pageId==='G08'&&target==='authorize'){if(!/^wx[a-fA-F0-9]{16}$/.test(String(form.appId||'')))throw new Error('请输入正确的小程序 AppID');if(!/^[0-9]{8,20}$/.test(String(form.merchantNo||'')))throw new Error('请输入 8 至 20 位微信支付商户号');backend.merchant=await request('/hexu/app/management/merchant/authorize',{shopId:backend.shopId,appId:form.appId,merchantNo:form.merchantNo,authorizationRef:String(form.authorizationRef||'').trim()},'POST',uuid());toast('授权资料已提交，等待渠道核实');return true}
   if(pageId==='G08'&&target==='upload-cert'){backend.merchant=await request('/hexu/app/management/merchant/certificate',merchantCertificatePayload(backend.shopId,form),'POST',uuid());toast('证书与签约参数已登记，等待渠道核实');return true}
   if(['M19','G24'].includes(pageId)&&target==='tracking-refresh'){await pageData(pageId,form);toast('物流轨迹已刷新');return true}
   if(pageId==='G23'&&['pick-start','pick-complete','pick-print'].includes(target)){if(!state.managementOrder)throw new Error('请先选择订单');const id=encodeURIComponent(state.managementOrder),base='/hexu/app/management/fulfillment/pick/'+id;if(target==='pick-print'){backend.pickPrint=await request(base+'/print',{shopId:backend.shopId});toast('拣货单已读取')}else{await request(base+'/'+(target==='pick-start'?'start':'complete'),{shopId:backend.shopId},'POST',uuid());backend.pickOrders=await request('/hexu/app/management/fulfillment/pick',{shopId:backend.shopId});toast(target==='pick-start'?'已开始拣货':'拣货完成，可填写运单发货')}return true}
   if(pageId==='G28'&&target==='link-direct'){const linked=await request('/hexu/app/management/aftersale-links',directAfterSalePayload(backend.shopId,backend.refund?.id,form),'POST',uuid());backend.afterSaleLinks=[linked,...backend.afterSaleLinks.filter(x=>x.customerRefundId!==linked.customerRefundId)];if(state.pendingDirectLink?.customerRefundId===linked.customerRefundId){state.pendingDirectLink=null;persist()}toast('客户售后与公司采购售后已关联');return true}
   if(['G26','G27','G28'].includes(pageId)&&target.startsWith('direct-candidate:')){const wholesaleOrderId=target.slice(17),candidate=backend.afterSaleCandidates.find(x=>x.wholesaleOrderId===wholesaleOrderId);if(!candidate||!backend.refund)throw new Error('直发采购候选已变化，请刷新售后单');if(pageId==='G28'){form.wholesaleOrderId=wholesaleOrderId;toast('已选择匹配的直发采购订单')}else{state.pendingDirectOrder={customerRefundId:backend.refund.id,wholesaleOrderId};persist();navigate('G28')}return true}
   if(pageId==='G28'&&target==='direct-wholesale-refund'){const link=backend.afterSaleLinks.find(x=>x.customerRefundId===backend.refund?.id);if(!link?.wholesaleOrderId)throw new Error('请先关联公司批发采购订单');if(Number(link.wholesaleBuyerId)!==Number(backend.member?.id))throw new Error('请由该采购订单的购买人发起公司售后，再关联售后单号');const order=normalizedOrder(await request('/hexu/app/orders/'+encodeURIComponent(link.wholesaleOrderId)));if(!['PAID','SHIPPED','COMPLETED'].includes(order.rawStatus))throw new Error('公司采购订单当前不能申请售后');const customerLine=backend.refundOrder?.items?.find(x=>x.lineId===backend.refund.line_id),purchaseLine=order.items.find(x=>x.id===customerLine?.id);if(!purchaseLine)throw new Error('公司采购订单中没有对应售后商品');state.directAfterSale={shopId:backend.shopId,customerRefundId:backend.refund.id,wholesaleOrderId:link.wholesaleOrderId,previousOrderId:state.activeOrder,qty:backend.refund.qty,refundType:({EXCHANGE:'换货',RETURN:'退货退款',PARTIAL:'部分退款',REFUND_ONLY:'仅退款'}[backend.refund.refund_type]||'仅退款')};state.activeOrder=link.wholesaleOrderId;backend.activeOrder=order;backend.afterLineId=purchaseLine.lineId;backend.afterDraft=null;persist();navigate('M20');return true}
  if(target.startsWith('switch-shop:')){
   const shops=await request('/hexu/app/shops')
   const selectedId=target.slice('switch-shop:'.length),shop=shops.find(s=>String(s.id)===selectedId)
   if(!shop)throw new Error('该商城尚未开通')
   const access=await request('/hexu/app/shop-access',{shopId:shop.id})
   if(!access.allowed&&!access.crossOrderHistory){
    backend.requestedShopId=shop.id
    toast('您已归属'+access.homeShopName+'，请确认跨店访问方式')
    navigate('M43');return true
   }
   backend.shopId=shop.id;uni.setStorageSync('hexu-shop-id',shop.id)
   state.buyNow=null;state.couponId=null;state.serverHydrated=false;state.serverCartId=null
   const orderHistory=!access.allowed&&access.crossOrderHistory
   if(orderHistory){state.activeOrder=null;backend.activeOrder=null;state.orderListFilter='全部'}
   await refresh()
   if(orderHistory){backend.crossOrderHomeShopId=Number(access.homeShopId);backend.crossOrderPendingId=access.pendingOrderId||'';navigate('M17')}
   else navigate(homePageId())
   return true
  }
  if(target==='promotion-apply'){const a=await request('/hexu/app/assessment',{shopId:backend.shopId});if(!a.eligible)throw new Error(a.configured?'尚未达到晋升条件':'请等待商城配置考核方案');await apiCommand('document-save',{kind:'promotion',rank:a.targetRank});navigate('M39');return true}
  if(target.startsWith('view-proof:')){const id=target.slice(11);const file=await new Promise((resolve,reject)=>uni.downloadFile({url:apiBase+'/hexu/app/attachments/'+id,header:{Authorization:'Bearer '+backend.token},success:r=>r.statusCode===200?resolve(r.tempFilePath):reject(new Error('无权读取该资料')),fail:()=>reject(new Error('资料读取失败'))}));uni.previewImage({urls:[file]});return true}
  if(pageId==='G55'&&['save','calculate'].includes(target)){backend.marketingPreview=null;backend.marketingPreview=await apiCommand('marketing-preview',marketingPreviewPayload(form),true);toast('已按真实规则完成核算');return true;}
  if(pageId==='G61'&&target==='staff-lookup'){backend.staffLookup=await request('/hexu/app/management/operations/staff-lookup',{shopId:backend.shopId,login:form.staffLogin});const old=backend.staffAccounts.find(x=>x.user_id===backend.staffLookup.user_id);if(old){form.role=Object.keys(operationRoles).find(k=>operationRoles[k]===old.role_code);form.staffEnabled=true;}toast('账号已核对');return true;}
  if(pageId==='G61'&&target.startsWith('staff-open:')){const row=backend.staffAccounts.find(x=>x.user_id===Number(target.slice(11)));if(row){backend.staffLookup=row;Object.assign(form,{staffLogin:row.user_name,role:Object.keys(operationRoles).find(k=>operationRoles[k]===row.role_code),staffEnabled:true,staffReason:''});}return true;}
  if(pageId==='G61'&&target==='save'){if(!backend.staffLookup||backend.staffLookup.user_name!==form.staffLogin)throw new Error('请先核对后台账号');await apiCommand('staff-assign',{userId:backend.staffLookup.user_id,role:operationRoles[form.role],enabled:!!form.staffEnabled,reason:form.staffReason},true);toast(await pageData(pageId,form)?'商城岗位权限已更新':'岗位权限已保存，列表读取失败，请刷新');return true;}
  if(pageId==='G62'&&target.startsWith('audit-open:')){backend.auditDetail=await request('/hexu/app/management/operations/audit/'+Number(target.slice(11)),{shopId:backend.shopId});return true;}
  if(pageId==='G64'&&target==='template-save'){await apiCommand('document-save',{kind:'notification_template',event:notificationEvents[form.templateEvent],name:form.templateEvent+'通知',title:notificationTemplateForSave(form.templateTitle),content:notificationTemplateForSave(form.templateContent)},true);try{backend.notificationTemplates=await request('/hexu/app/management/documents_notification_template',{shopId:backend.shopId});toast('新通知模板已保存')}catch(e){toast('模板已保存，列表刷新失败：'+e.message)}return true;}
  if(pageId==='G64'&&target.startsWith('template-open:')){const t=backend.notificationTemplates.find(x=>x.id===target.slice(14));if(t)Object.assign(form,{templateEvent:Object.keys(notificationEvents).find(k=>notificationEvents[k]===t.body.event),templateTitle:notificationTemplateForEditor(t.body.title),templateContent:notificationTemplateForEditor(t.body.content)});return true;}
  if(target.startsWith('message-open:')){
   const memberId=backend.member?.id,token=backend.token,shopId=backend.shopId
   const sameScope=()=>Number(backend.member?.id)===Number(memberId)&&backend.token===token&&Number(backend.shopId)===Number(shopId)
   const m=await apiCommand('message-read',{id:Number(target.slice(13))})
   if(!sameScope()){toast('原账号消息已标记已读，请切回原账号查看');return true}
   const local=state.notifications.find(x=>Number(x.id)===Number(m.id))
   if(local)local.read=true
   const kind=m.reference_kind||'',title=notificationText(m.title,kind),body=notificationText(m.body_text||m.title,kind)
   if(['review','review_append'].includes(kind))await modal(title,body)
   else if(kind==='support'||(!kind&&m.event_type==='SYSTEM'&&/^DOC[0-9a-f]{32}$/.test(m.reference_id||'')&&['客服留言已处理','客服留言已收到'].includes(m.title))){
    let loaded=false
    try{loaded=await pageData('M29',{})}catch{}
    if(!sameScope()){toast('账号或商城已切换，请重新打开消息');return true}
    const support=loaded?backend.supportRecords.find(record=>record.id===m.reference_id):null
    if(support){backend.selectedSupportId=support.id;navigate('M29')}
    else await modal(title,body+'\n客服留言详情暂不可查看，请到客服页刷新。')
   }else if(kind==='agent_application'){
    let applications=null
    try{if(m.reference_id)applications=await request('/hexu/app/documents/agent_application',{shopId})}catch{}
    if(!sameScope()){toast('账号或商城已切换，请重新打开消息');return true}
    const current=Array.isArray(applications)?applications[0]:null
    if(current?.id===m.reference_id&&Number(current.member_id)===Number(memberId)&&Number(current.shop_id)===Number(shopId)){
     backend.documents.agent_application=applications;navigate('M31')
    }else await modal(title,body+'\n关联申请暂不可查看，请到代理申请进度页刷新。')
   }else if(m.event_type?.startsWith('ORDER_')){
    let order=null
    try{if(m.reference_id)order=await request('/hexu/app/orders/'+encodeURIComponent(m.reference_id))}catch{}
    if(!sameScope()){toast('账号或商城已切换，请重新打开消息');return true}
    if(order){state.activeOrder=m.reference_id;backend.activeOrder=normalizedOrder(order);navigate('M18')}
    else await modal(title,body+'\n关联订单暂不可查看')
   }else if(m.event_type==='REFUND_UPDATED'){
    const r=backend.account.refunds?.find(x=>x.id===m.reference_id)
    if(r){state.selectedRefund=r.id;state.activeOrder=r.order_id;backend.refund=r;backend.activeOrder=state.orders.find(order=>order.id===r.order_id)||null;persist();navigate(afterSaleDetailPage(r.refund_type))}
    else await modal(title,body)
   }else if(m.event_type==='WITHDRAW_UPDATED'||(m.event_type==='SYSTEM'&&/^TX[0-9a-f]{32}$/.test(m.reference_id||''))){state.lastWithdrawal={id:m.reference_id};state.withdrawalView={id:m.reference_id,memberId:Number(memberId),shopId:Number(shopId)};persist();navigate('M49')}
   else await modal(title,body)
   return true
  }
  if(['G58','G59'].includes(pageId)){
   if(target==='report-generate'){const data=await apiCommand('report-create',{from:form.reportFrom,to:form.reportTo,agentId:Number(form.reportAgent)||0,customerId:Number(form.reportCustomer)||0,skuId:form.reportSku||'',rank:['全部职级','云代理','分货中心','总代理'].indexOf(form.reportRank),includeTeam:!!form.includeTeam},true);backend.reports??={};backend.reportPages??={};backend.reports[pageId]=data;backend.reportJobs=[data,...(backend.reportJobs||[])].slice(0,50);backend.reportPages[pageId]=1;await refreshMobileReport(pageId,ctx.activeFilter);toast('报表任务已提交');return true;}
   if(target==='report-refresh'){await refreshMobileReport(pageId,ctx.activeFilter);return true;}
   if(['report-next','report-prev'].includes(target)){backend.reportPages[pageId]=Math.max(1,(backend.reportPages?.[pageId]||1)+(target==='report-next'?1:-1));await refreshMobileReport(pageId,ctx.activeFilter);return true;}
   if(target.startsWith('report-open:')){backend.reports[pageId]=backend.reportJobs?.find(j=>j.id===target.slice(12))||{id:target.slice(12),shop_id:backend.shopId,filters:{}};backend.reportPages[pageId]=1;await refreshMobileReport(pageId,ctx.activeFilter);return true;}
   if(['export','report-inventory'].includes(target)){const r=backend.reports?.[pageId];if(r?.status!=='COMPLETED')throw new Error('请先生成并等待报表完成');await downloadReport(r.id,target==='report-inventory'?'INVENTORY':mobileReportDimension(pageId,ctx.activeFilter));toast('报表已导出');return true;}
  }
  if(target.startsWith('point-member:')){state.selectedPointMember=Number(target.slice(13));persist();await pageData(pageId,form);return true}
  if(target.startsWith('point-transfer:')){backend.selectedPointTransfer=target.slice(15);return true}
  if(target.startsWith('point-thaw:')){if(!form.复核依据?.trim())throw new Error('请填写冻结复核依据');await apiCommand('point-freeze-review',{id:target.slice(11),release:true,reason:form.复核依据},true);await pageData(pageId,form);toast('账户冻结已解除，日累计与频率上限仍有效');return true}
  if(target.startsWith('catalog-edit:')){state.editSku=target.slice(13);persist();navigate('G10');return true}
  if(target.startsWith('catalog-box:')){state.boxSku=target.slice(12);persist();form._boxId='';await pageData(pageId,form);return true}
  if(target.startsWith('catalog-review:')){backend.reviewSku=target.slice(15);await pageData(pageId,form);return true}
  if(target.startsWith('freight-select:')){backend.selectedFreight=target.slice(15);form._freightId='';await pageData(pageId,form);return true}
  if(target.startsWith('earning:')){state.selectedEarning=Number(target.slice(8));persist();navigate('M46');return true}
  if(target.startsWith('agent-select:')){state.selectedAgent=Number(target.slice(13));persist();navigate('G30');return true}
  if(target.startsWith('customer-select:')){state.selectedCustomer=Number(target.slice(16));persist();return true}
  if(target.startsWith('withdrawal-select:')){state.selectedWithdrawal=target.slice(18);persist();await pageData(pageId,form);return true}
  if(target.startsWith('reversal-order:')){state.reversalOrder=target.slice(15);persist();if(pageId==='G42')await pageData('G42',form);else navigate('G42');return true}
  if(target.startsWith('document-select:')){backend.selectedDocuments??={};backend.selectedDocuments[pageId]=target.slice(16);form.审核意见='';await pageData(pageId,form);return true}
  if(target==='link-join'){await apiCommand('link-join');await pageData('M60');navigate('M60');return true}
  if(target.startsWith('link-member:')){backend.linkSelectedAgent=Number(target.slice(12));return true}
  if(target.startsWith('reconciliation-line:')){backend.reconciliationLine=target.slice(20);form.uploads=[];form.reason='';form.adjustment='重新核对业务回执';return true}
  if(target.startsWith('group-select:')){state.selectedGroup=target.slice(13);persist();await pageData('M58',form);return true}
  if(target.startsWith('group-campaign:')){state.selectedGroup='';state.selectedGroupCampaign=target.slice(15);persist();await pageData('M58',form);backend.groupDetail=null;return true}
  if(target.startsWith('downgrade-record:')){backend.selectedDowngrade=target.slice(17);return true}
  if(target==='group-progress'){state.selectedGroup=backend.activeOrder?.group?.id;persist();navigate('M58');return true}
  if(target==='group-order'){const id=backend.groupDetail?.myOrderId;if(!id)throw new Error('暂无本人拼团订单');state.activeOrder=id;persist();navigate('M18');return true}
  if(target==='group-share'){if(!backend.groupDetail)throw new Error('请先选择拼团');uni.setClipboardData({data:'/pages/M58/index?shop='+backend.shopId+'&group='+backend.groupDetail.id,success:()=>toast('拼团链接已复制')});return true}
  if(target==='join-group'){const g=backend.groupDetail,c=backend.groupCampaign;if(g?.myOrderId){state.activeOrder=g.myOrderId;persist();navigate('M18');return true}if(!g&&!c)throw new Error('暂无可参与的拼团');if(g&&g.status!=='FORMING')throw new Error('该团已结束');state.selectedProduct=g?.skuId||c.skuId;beginCheckout(state,{id:state.selectedProduct,qty:1,selected:true,...(g?{groupId:g.id}:{groupCampaignId:c.campaignId})});form.usePoints=false;persist();navigate('M12');return true}
  if(target==='checkout'){
   const prior=form._createdOrder
   if(prior){if(Number(prior.memberId)!==Number(backend.member?.id)||Number(prior.shopId)!==Number(backend.shopId))throw new Error('账号或商城已变化，请重新结算');state.activeOrder=prior.id;navigate('M15');return true}
   if(!ctx.checkoutQuote)throw new Error(ctx.quoteError||'请等待订单金额核算完成')
   const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
   let policies
   try{policies=await request('/hexu/app/policies',{shopId})}
   catch(e){backend.policies={};backend.purchaseAgreementError=e.message;form.orderConsent=false;form._purchaseAgreementKey='';throw e}
   if(!sameMemberShop(memberId,shopId,token))throw new Error('账号或商城已变化，请重新进入结算')
   backend.policies=policies;backend.purchaseAgreementError=''
   const agreement=policies?.[PURCHASE_AGREEMENT],key=[memberId,shopId,agreement?.id||'',agreement?.version||''].join(':')
   if(form._purchaseAgreementKey!==key){form.orderConsent=false;form._purchaseAgreementKey=key;throw new Error('购买协议已更新，请阅读最新版本后重新确认')}
   if(!agreement?.id||!agreement?.version)throw new Error('购买协议正文尚未发布')
   if(!form.orderConsent)throw new Error('请确认购买协议')
   if(!state.addresses.length)throw new Error('请先添加收货地址')
   if(!selectedLines.length)throw new Error('请选择商品')
   if([...String(form.remark||'')].length>200)throw new Error('买家留言最多200个字符')
   const fromCart=!state.buyNow,items=selectedLines.map(l=>({id:l.id,qty:l.qty})),submittedRemarkDraft=state.changes?.M12
    let order
    try{order=await apiCommand('order-create',{remark:String(form.remark||'').trim(),invite:state.invite||'',groupId:state.buyNow?.groupId,groupCampaignId:state.buyNow?.groupCampaignId,items,address,points:pointsDiscount,couponId:state.couponId||'',orderConsent:true,agreementPolicyId:agreement.id,agreementVersion:agreement.version,expectedTotal:ctx.checkoutQuote.total})}
    catch(e){if(e.message?.includes('订单金额已变化'))await ctx.onQuoteChanged?.();throw e}
    if(submittedRemarkDraft&&state.changes?.M12===submittedRemarkDraft)delete state.changes.M12
    state.checkoutPoints=null
   if(fromCart){state.cartCheckouts??={};state.cartCheckouts[order.id]={shopId:backend.shopId,memberId:backend.member.id,items}}
   state.activeOrder=order.id;backend.activeOrder=normalizedOrder(order);form._createdOrder={id:order.id,memberId:backend.member.id,shopId:backend.shopId};persist()
   try{await refresh()}catch(e){toast('订单已创建，资料刷新失败，请到收银台核对：'+e.message)}
   navigate('M15');return true
  }
  if(target==='payment'){if(!state.activeOrder)throw new Error('请先创建订单');if(!paymentState(backend.activeOrder).payable)throw new Error('当前订单不可付款，请返回订单刷新');const id=state.activeOrder,pay=await apiCommand('payment-create',{id});if(localSandbox()){if(!(await modal('模拟支付','当前使用本地模拟渠道，不会实际扣款。确认后由后端更新订单与库存。')))return true;const devPaymentPath=apiBase?'/hexu/dev/payment/'+pay.id:'/__hexu_dev/payment/'+pay.id;await request(devPaymentPath,{},'POST')}else{const parameters=await request('/hexu/app/wechat/payment/'+id,{},'POST');await new Promise((resolve,reject)=>uni.requestPayment({...parameters,success:resolve,fail:reject}))}state.pendingPaymentOrder=id;persist();let confirmed=false;for(let attempt=0;attempt<5;attempt++){if(attempt)await new Promise(resolve=>setTimeout(resolve,800));try{confirmed=await confirmedPayment(id);if(confirmed)break}catch{}}if(confirmed){backend.paymentResultNavigating=id;await finishPaidOrder(id)}else{navigate('M18');toast('支付结果确认中，请刷新订单状态；未确认前不会显示支付成功')}return true}
  if(target==='payment-refresh'){const id=state.activeOrder||state.pendingPaymentOrder||state.cartSyncPendingOrder;if(!id)throw new Error('请先选择订单');if(await confirmedPayment(id)){await finishPaidOrder(id)}else toast('渠道回调尚未确认，请稍后刷新；如支付失败可重试');return true}
  if(target==='remind'){await apiCommand('order-remind',{id:state.activeOrder});toast('提醒已发送给商城拥有者');return true}
  if(target==='receive'){
   const id=state.activeOrder,order=backend.activeOrder,memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
   if(!id||order?.id!==id||order.rawStatus!=='SHIPPED'||Number(order.buyer_id)!==Number(memberId))throw new Error('请重新读取本人待收货订单')
   if(!(await modal('确认收货','请确认已收到商品。确认后订单将完成并结算收益。')))return true
   if(!sameMemberShop(memberId,shopId,token)||state.activeOrder!==id||backend.activeOrder?.id!==id||backend.activeOrder?.rawStatus!=='SHIPPED')throw new Error('订单或账号已变化，请重新读取')
   const received=normalizedOrder(await apiCommand('order-receive',{id}));backend.activeOrder=received;state.reviewParent=null;state.reviewSku=received.items?.[0]?.id||'';persist();await refresh();navigate('M10');return true
  }
   if(target==='wholesale'){
    const draft=state.wholesaleDraft,memberId=backend.member.id,shopId=backend.shopId,token=backend.token
    if(!draft||Number(draft.memberId)!==Number(memberId)||Number(draft.shopId)!==Number(shopId))throw new Error('请重新读取采购购物车')
    const [items,rules]=await Promise.all([request('/hexu/app/products',{shopId:WHOLESALE_SHOP_ID,destinationShopId:shopId}),request('/hexu/app/wholesale-rules',{shopId:WHOLESALE_SHOP_ID,destinationShopId:shopId})])
    if(!sameMemberShop(memberId,shopId,token))throw new Error('账号或商城已变化，请重新读取采购购物车')
    backend.wholesaleProducts=items;backend.wholesaleRules=rules
    const plan=wholesalePlan(draft,items,form,rules)
    if(plan.error)throw new Error(plan.error)
    draft.lines=plan.lines.map(({sku,qty})=>({id:sku.id,qty}))
    state.wholesaleSku=plan.lines[0].sku
    state.wholesaleContext={memberId,shopId,lines:plan.lines.map(({sku,qty})=>({id:sku.id,qty,price:sku.price}))}
    persist();navigate('G15');return true
   }
   if(target==='purchase'){
    if(!state.addresses.length)throw new Error('请先添加实际收货地址')
    const context=state.wholesaleContext,memberId=backend.member.id,shopId=backend.shopId,token=backend.token
    if(!context||Number(context.memberId)!==Number(memberId)||Number(context.shopId)!==Number(shopId))throw new Error('采购商品或箱规已变化，请返回采购购物车重新确认')
    const [items,rules]=await Promise.all([request('/hexu/app/products',{shopId:WHOLESALE_SHOP_ID,destinationShopId:shopId}),request('/hexu/app/wholesale-rules',{shopId:WHOLESALE_SHOP_ID,destinationShopId:shopId})])
    if(!sameMemberShop(memberId,shopId,token))throw new Error('账号或商城已变化，请重新读取采购订单')
    backend.wholesaleProducts=items;backend.wholesaleRules=rules
    const plan=wholesalePlan(context,items,{},rules)
    if(plan.error)throw new Error(plan.error)
    if(context.lines.some(line=>Number(line.price)!==Number(items.find(item=>item.id===line.id)?.price)))throw new Error('采购价格已变化，请返回采购购物车重新确认')
    const remark=String(form.订单备注||'').trim()
    if([...remark].length>200||remark.includes('\u0000'))throw new Error('采购备注最多200个字符且不能包含空字符')
    const order=await apiCommand('order-create',{shopId:WHOLESALE_SHOP_ID,destinationShopId:shopId,directShip:form.delivery==='整箱直发',items:plan.lines.map(({sku,qty})=>({id:sku.id,qty})),address,remark,expectedTotal:plan.total})
    state.purchaseOrder=order.id;state.activeOrder=order.id;backend.activeOrder=normalizedOrder(order);persist();navigate('M15');return true
   }
  if(target==='stock-receive'){
   const order=backend.purchaseOrderDetail;
   if(pageId!=='G16'||backend.pageLoading.G16||backend.displayPageErrors?.G16||!backend.purchaseReceiveAllowed||!order||order.id!==state.purchaseOrder||order.rawStatus!=='SHIPPED'||!['WHOLESALE','DIRECT_SHIP'].includes(order.order_type)||Number(order.shop_id)!==900||Number(order.buyer_id)!==Number(backend.member?.id)||Number(order.destination_shop_id)!==Number(backend.shopId))throw new Error('请重新读取本人当前商城的待收货采购订单');
   backend.purchaseOrderDetail=normalizedOrder(await apiCommand('order-receive',{id:order.id}));backend.purchaseReceiveAllowed=false;await refresh();toast('采购收货已确认，库存按订单类型处理');return true;
  }
  if(target.startsWith('stock-product:')){state.selectedProduct=target.split(':')[1];persist();navigate('G18');return true}
  if(target.startsWith('points-product:')){state.selectedPointProduct=target.split(':')[1];persist();navigate('M62');return true}
  if(target==='redeem'){
   const prior=form._redeemedOrder
   if(prior){if(Number(prior.memberId)!==Number(backend.member?.id)||Number(prior.shopId)!==Number(backend.shopId))throw new Error('账号或商城已变化，请重新选择兑换商品');state.lastRedemption={id:prior.id,cost:prior.cost,skuId:prior.skuId};navigate('M63');return true}
   const p=products.find(p=>p.id===state.selectedPointProduct),qty=Number(form.兑换数量);
   if(!p||!Number.isSafeInteger(qty)||qty<1||Number(p.point_price)<=0)throw new Error('请选择可兑换商品并填写正整数数量');
   if(qty>Number(p.stock)||Number(p.point_price)*qty>state.points)throw new Error('商品库存或平台积分不足');
   if(!address||!state.addresses.some(a=>a.name===address.name&&a.phone===address.phone&&a.region===address.region&&a.detail===address.detail))throw new Error('请先选择真实收货地址');
   const order=await apiCommand('points-redeem',{skuId:p.id,qty,scope:0,address});
   state.lastRedemption={id:order.id,cost:order.points_used,skuId:order.items[0].sku_id};state.activeOrder=order.id;backend.activeOrder=normalizedOrder(order);backend.redemptionOrder=backend.activeOrder;form._redeemedOrder={...state.lastRedemption,memberId:backend.member.id,shopId:backend.shopId};persist();try{await refresh()}catch(e){toast('积分兑换已提交，资料刷新失败，请到兑换订单核对：'+e.message)}navigate('M63');return true;
  }
  if(target==='close-account'){if(!(await modal('确认注销账户','注销后当前登录失效，剩余积分将放弃，历史交易和账务保留审计记录。是否继续？')))return true;await apiCommand('account-close',{confirm:true,forfeitPoints:true});uni.removeStorageSync('hexu-api-token');backend.token='';backend.ready=false;state.signedIn=false;toast('账户已注销');navigate('M01');return true}
  if(target==='checkin'){
   const receipt=backend.checkinReceipt
   if(receipt?.date===new Date().toISOString().slice(0,10)&&Number(receipt.memberId)===Number(backend.member?.id)&&Number(receipt.shopId)===Number(backend.shopId)){toast('今天已签到');return true}
   const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
   const result=await apiCommand('checkin')
   backend.checkinReceipt={date:result.date,memberId,shopId}
   if(!sameMemberShop(memberId,shopId,token)){toast('原账号签到已完成，请切回原账号核对积分');return true}
   backend.checkinRewards={platform:0,shop:0}
   try{await refresh();toast('签到积分已到账')}catch(e){toast('签到已完成，积分刷新失败，请到积分明细核对：'+e.message)}
   return true
  }
  if(target==='cancel-order'||target.startsWith('cancel-order:')){
   const id=target==='cancel-order'?state.activeOrder:target.slice('cancel-order:'.length);
   const currentOrder=()=>state.orders.find(o=>o.id===id)||(backend.activeOrder?.id===id?backend.activeOrder:null);
   let order=currentOrder();
   const memberId=backend.member?.id,token=backend.token;
   const cancellable=()=>!!order&&order.rawStatus==='UNPAID'&&Number(order.buyer_id)===Number(memberId);
   if(!cancellable())throw new Error('请重新读取本人待付款订单');
   if(!(await modal('取消订单','取消后本订单不可继续付款，锁定库存将释放。确认取消？')))return true;
   if(backend.member?.id!==memberId||backend.token!==token)throw new Error('登录账号已变化，请重新确认订单');
   order=currentOrder();
   if(!cancellable())throw new Error('订单状态已变化，请刷新后重试');
   await apiCommand('order-cancel',{id});
   order.rawStatus='CANCELLED';order.status=label('CANCELLED');
   if(backend.activeOrder?.id===id){backend.activeOrder.rawStatus='CANCELLED';backend.activeOrder.status=label('CANCELLED');}
   if(state.pendingPaymentOrder===id)state.pendingPaymentOrder=null;
   if(state.cartSyncPendingOrder===id)state.cartSyncPendingOrder=null;
   if(state.cartCheckouts)delete state.cartCheckouts[id];
   persist();
   try{
    await refresh()
    if(pageId==='M17'&&backend.crossOrderHomeShopId){
     const access=await request('/hexu/app/shop-access',{shopId:backend.shopId})
     backend.crossOrderHomeShopId=!access.allowed&&access.crossOrderHistory?Number(access.homeShopId):null
     backend.crossOrderPendingId=backend.crossOrderHomeShopId?access.pendingOrderId||'':''
    }
   }catch(e){toast('订单已取消，资料刷新失败：'+e.message);return true}
   toast('订单已取消');return true;
  }
  if(target==='return-tracking'){
   const refund=backend.refund,latest=(backend.account.refunds||[]).find(r=>r.id===refund?.id);
   if(pageId!=='M22'||backend.pageLoading.M22||backend.displayPageErrors?.M22||!backend.returnTrackingAllowed||!refund||!latest||refund.status!=='WAIT_RETURN'||latest.status!=='WAIT_RETURN'||Number(refund.member_id)!==Number(backend.member?.id)||Number(latest.member_id)!==Number(backend.member?.id)||Number(refund.shop_id)!==Number(backend.shopId)||Number(latest.shop_id)!==Number(backend.shopId)||form._returnId!==refund.id||(state.selectedRefund?state.selectedRefund!==refund.id:state.activeOrder&&state.activeOrder!==refund.order_id))throw new Error('请重新读取本人当前商城的待退货申请');
   const carrier=String(form.快递公司||'').trim(),tracking=String(form.tracking||''),uploads=form.uploads??[];
   if(!carrier||[...carrier].length>60||/[\u0000-\u001f\u007f-\u009f]/.test(carrier)||!/^[A-Za-z0-9]{8,40}$/.test(tracking))throw new Error('请填写有效快递公司和8至40位字母数字运单号');
   if(!Array.isArray(uploads)||uploads.length>9||new Set(uploads).size!==uploads.length||uploads.some(id=>typeof id!=='string'||!/^FILE[^\s/:\\]+$/.test(id)))throw new Error('运单凭证须为已上传的图片，最多9张且不能重复');
   backend.refund=await apiCommand('return-tracking',{id:refund.id,carrier,tracking,uploads:[...uploads]});backend.returnTrackingAllowed=false;form._returnId='';navigate(afterSaleDetailPage(refund.refund_type));return true;
  }
  if(target==='cancel-after'){
   const id=backend.refund?.id,memberId=backend.member?.id,shopId=backend.shopId,token=backend.token;
   const currentRefund=()=>backend.account.refunds?.find(r=>r.id===id);
   const cancellable=()=>{
    const refund=currentRefund();
    return !!refund&&backend.refund?.id===id&&['PENDING','WAIT_RETURN'].includes(refund.status)&&['PENDING','WAIT_RETURN'].includes(backend.refund.status)&&refund.return_json==null&&backend.refund.return_json==null&&Number(refund.member_id)===Number(memberId)&&Number(refund.shop_id)===Number(shopId)&&(!state.selectedRefund||state.selectedRefund===id);
   };
   if(!id||!cancellable())throw new Error('请重新读取本人当前商城可撤销的售后申请');
   if(!(await modal('撤销售后申请','撤销后本次售后申请将关闭，是否继续？')))return true;
   if(backend.token!==token||backend.member?.id!==memberId||backend.shopId!==shopId)throw new Error('登录账号或商城已变化，请重新确认售后申请');
   if(!cancellable())throw new Error('售后状态已变化，请刷新后重试');
   const cancelled=await apiCommand('refund-cancel',{id});
   backend.refund=cancelled;
   const cached=currentRefund();if(cached)Object.assign(cached,cancelled);
   try{await refresh()}catch(e){toast('售后申请已撤销，资料刷新失败：'+e.message);return true}
   toast('售后申请已撤销');return true;
  }
  if(target==='save-address'){
   const committed=form._savedAddress
   if(committed){if(Number(committed.memberId)!==Number(backend.member?.id)||Number(committed.shopId)!==Number(backend.shopId))throw new Error('账号或商城已变化，请重新选择地址');returnToAddressList();return true}
   if(!validate())return true
   if(!form.addressConsent)throw new Error('请授权使用地址信息')
   const name=String(form.name||'').trim(),phone=String(form.phone||'').trim()
   const region=String(form.region||'').trim(),detail=String(form.detail||'').trim()
   const usage=String(form.usage||'家').trim()
   if(!name||[...name].length>30)throw new Error('收货人请输入1–30个字符')
   if(!/^1[3-9]\d{9}$/.test(phone))throw new Error('请输入正确的手机号码')
   if(!isValidRegion(region))throw new Error('请选择有效的省、市、区')
   if([...region].length>100)throw new Error('所在地区最多100个字符')
   if(!detail||[...detail].length>150)throw new Error('详细地址请输入1–150个字符')
   if(!['家','公司','学校','其他'].includes(usage))throw new Error('请选择有效的地址用途')
   if([name,region,detail].some(value=>/[\u0000-\u001f\u007f-\u009f]/.test(value)))throw new Error('地址信息不能包含控制字符')
   const index=state.editAddress,prior=index==null?null:state.addresses[index]
   if(index!=null&&!prior?.serverId)throw new Error('请重新选择需要编辑的地址')
   const draft={name,phone,region,detail,usage,primary:!!form.primary,consent:true}
   const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token
   const saved=await apiCommand('document-save',{kind:'address',id:prior?.serverId,...draft})
   form._savedAddress={id:saved.id,memberId,shopId}
   if(!sameMemberShop(memberId,shopId,token)){toast('原账号地址已保存，请切回原账号核对');return true}
   const address={...draft,...saved.body,serverId:saved.id}
   const savedIndex=index==null?state.addresses.length:index
   if(index==null)state.addresses.push(address);else state.addresses[index]=address
   if(address.primary){state.addresses.forEach((item,i)=>{if(i!==savedIndex)item.primary=false});state.selectedAddress=savedIndex}
   state.editAddress=null
   persist()
   try{await refresh()}catch(e){toast('地址已保存，列表刷新失败，当前显示刚保存的地址：'+e.message)}
   returnToAddressList();return true
  }
   if(target==='withdraw'){
    const policies=await request('/hexu/app/policies',{shopId:backend.shopId})
    backend.policies=policies
    const policy=policies?.WITHDRAWAL_AGREEMENT
    if(!policy?.id||!policy?.version)throw new Error('提现服务协议正文尚未发布')
    if(form._withdrawalPolicyKey!==[backend.member?.id,backend.shopId,policy.id,policy.version].join(':')){form.consent=false;throw new Error('提现服务协议已更新，请重新阅读并确认')}
    if(!form.consent)throw new Error('请阅读并同意提现服务协议')
    const quote=withdrawal(form.amount,state.balance)
    if(quote.error)throw new Error(quote.error)
    const accounts=await request('/hexu/app/documents/settlement_account',{shopId:backend.shopId})
    const account=accounts.find(d=>d.status==='APPROVED')
    if(!account)throw new Error('请先提交并审核结算账户')
    const w=await apiCommand('withdraw',{amount:quote.cents,channel:account.body.channel,accountRef:account.id})
    backend.withdrawalDetail=w
    state.lastWithdrawal={...w,cents:w.amount}
    state.withdrawalView={id:w.id,memberId:Number(backend.member.id),shopId:Number(backend.shopId)}
    form.amount='';form.consent=false
    persist()
    try{await refresh()}catch(e){toast('提现申请已提交，资料刷新失败，请到提现详情核对：'+e.message)}
    navigate('M49');return true
   }
   if(target==='wechat-transfer'){const id=backend.withdrawalDetail?.id||state.lastWithdrawal?.id;if(!id)throw new Error('请先选择提现申请');const data=await request('/hexu/app/wechat/withdrawals/'+encodeURIComponent(id)+'/transfer',{},'POST',uuid());const sandboxPaid=localSandbox()&&data?.sandbox===true&&data.status==='PAID';if(!sandboxPaid)await openMerchantTransfer(data);const refreshed=await pageData('M49',form);toast(sandboxPaid?refreshed?'本地模拟到账':'本地模拟已处理，详情读取失败，请刷新核对':'已拉起微信零钱收款确认；页面成功不等于到账，请稍后刷新状态');return true}
   if(target==='wechat-transfer-query'){const id=backend.withdrawalDetail?.id||state.lastWithdrawal?.id;if(!id)throw new Error('请先选择提现申请');const data=await request('/hexu/app/wechat/withdrawals/'+encodeURIComponent(id)+'/transfer');backend.withdrawalDetail=data.withdrawal||backend.withdrawalDetail;if(data.withdrawal)state.lastWithdrawal={...state.lastWithdrawal,...data.withdrawal,cents:data.withdrawal.amount};const status=data.withdrawal?.status||data.provider?.status;if(status==='PAID')toast('微信零钱已确认到账');else if(status==='FAILED'||status==='REJECTED')toast('微信零钱转账失败，余额已退回');else toast('渠道尚未返回最终结果，请稍后刷新');return true}
  if(target==='transfer'){const isShop=form.pointsType==='商城积分',amount=Number(form.amount),balance=Number(isShop?state.shopPoints:state.points),limit=Number(backend.account.pointRisk?.[isShop?'shopSingle':'platformSingle']||1000);if(!/^1[3-9][0-9]{9}$/.test(form.recipient||''))throw new Error('请输入正确接收人手机号');if(!Number.isSafeInteger(amount)||amount<=0||amount>balance||amount>limit)throw new Error('转赠数量须为正整数，且不超过可用积分和单笔限额');const receiver=await request('/hexu/app/recipient',{phone:form.recipient});if(Number(receiver.id)===Number(backend.member.id))throw new Error('不能转赠给自己');state.pendingTransfer={phone:form.recipient,recipientId:receiver.id,recipientName:receiver.name,amount,before:balance,type:isShop?'商城积分':'平台积分',scopeShopId:isShop?backend.shopId:0,senderId:backend.member.id};persist();navigate('M52');return true}
  if(target==='confirm-transfer'){const t=state.pendingTransfer;if(!t)throw new Error('请先填写转赠信息');if(t.blockedReason)throw new Error('本次转赠已被拦截，请返回重新填写');const scope=t.type==='商城积分'?backend.shopId:0,balance=Number(scope===0?state.points:state.shopPoints),limit=Number(backend.account.pointRisk?.[scope===0?'platformSingle':'shopSingle']||1000);if(Number(t.senderId)!==Number(backend.member?.id)||Number(t.scopeShopId)!==scope)throw new Error('转赠账号或商城已变化，请重新填写');if(!Number.isSafeInteger(t.amount)||t.amount<=0||t.amount>balance||t.amount>limit)throw new Error('可用积分或转赠限额已变化，请返回重新核对');const receiver=await request('/hexu/app/recipient',{phone:t.phone});if(Number(t.recipientId)!==Number(receiver.id))throw new Error('接收人绑定已变化，请重新核对');const result=await apiCommand('points-transfer',{shopId:scope,recipientId:receiver.id,amount:t.amount});if(result.blocked){t.blockedReason=result.reason||'积分转赠已被风控拦截';persist();throw new Error(t.blockedReason)}state.lastTransferReceipt={...result,scopeShopId:scope,senderId:t.senderId};state.pendingTransfer=null;persist();try{await refresh()}catch(e){toast('转赠已提交，资料刷新失败，请到积分明细核对：'+e.message)}navigate('M53');return true}
  if(target.startsWith('after-line:')){backend.afterLineId=Number(target.split(':')[1]);form.申请数量=1;toast('已选择售后商品');return true}
  if(target.startsWith('refund-record:')){backend.refund=backend.account.refunds.find(r=>r.id===target.slice(14));if(!backend.refund||Number(backend.refund.member_id)!==Number(backend.member?.id)||Number(backend.refund.shop_id)!==Number(backend.shopId))throw new Error('请重新选择本人当前商城的售后记录');state.selectedRefund=backend.refund.id;state.activeOrder=backend.refund.order_id;persist();navigate(backend.refund.refund_type==='EXCHANGE'?'M24':'M23');return true}
  if(target==='exchange-receive'){
   const id=backend.refund?.id,memberId=backend.member?.id,shopId=backend.shopId,token=backend.token;
   const currentRefund=()=>backend.account.refunds?.find(item=>item.id===id);
   const receivable=()=>{
    const refund=currentRefund();
    return !!refund&&backend.refund?.id===id&&refund.refund_type==='EXCHANGE'&&refund.status==='EXCHANGE_SHIPPED'&&backend.refund.status==='EXCHANGE_SHIPPED'&&Number(refund.member_id)===Number(memberId)&&Number(refund.shop_id)===Number(shopId)&&(!state.selectedRefund||state.selectedRefund===id);
   };
   if(!id||!receivable())throw new Error('请重新读取本人当前商城待确认收货的换货单');
   if(!(await modal('确认换货收货','确认已收到换货商品？确认后该售后单将关闭。')))return true;
   if(backend.token!==token||backend.member?.id!==memberId||backend.shopId!==shopId)throw new Error('登录账号或商城已变化，请重新确认换货单');
   if(!receivable())throw new Error('换货状态已变化，请刷新后重试');
   const received=await apiCommand('exchange-receive',{id});
   backend.refund=received;
   backend.account.refunds=[received,...(backend.account.refunds||[]).filter(item=>item.id!==id)];
   try{await refresh()}catch(e){toast('换货已完成，资料刷新失败：'+e.message);return true}
   if(!backend.refund)backend.refund=received;
   if(!(backend.account.refunds||[]).some(item=>item.id===id))backend.account.refunds=[received,...(backend.account.refunds||[])];
   toast('换货已完成');return true;
  }
  if(pageId==='G40'&&target==='calculate'){
   backend.settlementPreview=null;backend.settlementPreviewKey=''
   if(!products.some(p=>p.id===form.试算商品))throw new Error('请选择本商城在售商品')
   const memberId=backend.member?.id,shopId=backend.shopId,token=backend.token,key=settlementInputKey(form,memberId,shopId,token)
   const result=await apiCommand('settlement-preview',{skuId:form.试算商品,qty:Number(form.quantity),cloudBps:Math.round(Number(form.rate)*100),agentId:Number(String(form.归属代理||'').split(' · ')[0])},true)
   if(!sameMemberShop(memberId,shopId,token)||key!==settlementInputKey(form,memberId,shopId,token))return true
   backend.settlementPreview=result;backend.settlementPreviewKey=key;toast('已按真实价格和关系核算');return true
  }
  if(target==='refund'){
   if(!state.activeOrder||!backend.activeOrder?.items?.length)throw new Error('请先从真实订单发起售后');
   const direct=state.directAfterSale?.wholesaleOrderId===state.activeOrder?state.directAfterSale:null;
   if(state.directAfterSale&&!direct){state.directAfterSale=null;persist()}
   if(backend.activeOrder.id!==state.activeOrder)throw new Error('订单已变化，请重新选择售后商品');
   const uploads=[...new Set([...(backend.afterDraft?.uploads||[]),...(form.uploads||[])])];
   const payload=refundApplicationPayload({order:backend.activeOrder,lineId:backend.afterLineId,quantity:form.申请数量,type:state.afterType,reason:form.退款原因,description:form.问题描述||backend.afterDraft?.补充说明||'',uploads,directQuantity:direct?.qty||0,refunds:backend.account.refunds||[]});
   const r=await apiCommand('refund-apply',payload);
   if(direct){
    state.pendingDirectLink={shopId:direct.shopId,customerRefundId:direct.customerRefundId,wholesaleOrderId:direct.wholesaleOrderId,wholesaleRefundId:r.id};
    try{const linked=await request('/hexu/app/management/aftersale-links',state.pendingDirectLink,'POST',uuid());backend.afterSaleLinks=[linked,...backend.afterSaleLinks.filter(x=>x.customerRefundId!==linked.customerRefundId)];state.pendingDirectLink=null;toast('公司售后已创建并关联客户售后')}
    catch(e){toast('公司售后已创建，关联待补：'+e.message)}
    state.selectedRefund=direct.customerRefundId;state.activeOrder=direct.previousOrderId||null;state.directAfterSale=null;backend.refund=null;persist();navigate('G28');return true;
   }
   backend.refund=r;state.selectedRefund=r.id;
   backend.account.refunds=[r,...(backend.account.refunds||[]).filter(item=>item.id!==r.id)];persist();
   let refreshError=null;
   try{await refresh()}catch(e){refreshError=e}
   if(!backend.refund)backend.refund=r;
   if(!(backend.account.refunds||[]).some(item=>item.id===r.id))backend.account.refunds=[r,...(backend.account.refunds||[])];
   navigate(r.refund_type==='EXCHANGE'?'M24':'M23');
   if(refreshError)toast('售后申请已提交，资料刷新失败：'+refreshError.message);
   return true
  }
  if(target==='bind'){
   const context=backend.invitationContext
   if(pageId==='M35'&&(!context||!context.valid||context.bound))throw new Error(context?.bound?'当前归属已锁定':context?.reason||'请先核对有效邀请信息')
   const policies=await request('/hexu/app/policies',{shopId:backend.shopId})
   backend.policies=policies
   const policy=policies?.CUSTOMER_AUTHORIZATION
   if(!policy?.id||!policy?.version)throw new Error('客户归属授权协议正文尚未发布')
   if(form._customerPolicyKey!==[backend.member?.id,backend.shopId,policy.id,policy.version].join(':')){form.consent=false;throw new Error('客户归属授权协议已更新，请重新阅读并确认')}
   if(!form.consent)throw new Error('请阅读并同意客户归属授权协议')
   await apiCommand('bind',{invite:state.invite||''})
   await refresh();await pageData('M35',form);navigate(homePageId());return true
  }
  if(target==='share'){
   if(['M05','M06','M07'].includes(pageId))return shareProduct()
   if(!backend.agent)throw new Error('审核通过的代理才能生成邀请链接')
   let invite=backend.activeInvite
   if(!invite||invite.shopId!==backend.shopId||invite.agentId!==backend.agent.id||!isFutureTimestamp(invite.expiresAt)){invite={...await apiCommand('invite'),agentId:backend.agent.id};backend.activeInvite=invite}
   uni.setClipboardData({data:'/pages/M35/index?shop='+backend.shopId+'&invite='+invite.invite,success:()=>toast('邀请信息已复制')});return true
  }
   if(target.startsWith('campaign:')){const campaign=backend.campaigns.find(c=>c.id===target.slice(9));if(!campaign)throw new Error('活动已失效');if(campaign.available===false)throw new Error('活动名额已满，请刷新后重试');if(campaign.kind==='bundle'){for(const item of campaign.body.items||[]){const line=state.cart.find(l=>l.id===item.skuId),product=products.find(p=>p.id===item.skuId);if(line){line.qty=Math.max(line.qty,Number(item.qty));line.selected=true;if(product)line.snapshot=cartProductSnapshot(product)}else state.cart.push({id:item.skuId,qty:Number(item.qty),selected:true,...(product?{snapshot:cartProductSnapshot(product)}:{})})}state.buyNow=null;await syncCart();persist();navigate('M11')}else navigate('M04');return true}
  if(target.startsWith('product:'))return openProductTarget(target)
  if(pageId==='M29'&&target==='message'){
   if(!validate())return true;
   const saved=await apiCommand('document-save',{...supportPayload(form),kind:'support'});
   if(saved?.id)backend.selectedSupportId=saved.id;
   // Clear only after confirmed persistence; failed writes retain the draft and retry key.
   Object.assign(form,{message:'',关联订单:'',uploads:[]});
   toast(await pageData('M29',form)?'已提交后台':'留言已提交，资料刷新失败，请稍后重试');return true;
  }
   if(documentKinds[pageId]&&['save','message','agent-apply','store-apply','migration','submit'].includes(target)){const kind=documentKinds[pageId];if(kind==='migration'&&(backend.documents.migration||[]).some(d=>['PENDING','SUPPLEMENT','SCHEDULED'].includes(d.status)))throw new Error('已有进行中的迁移申请，请等待审核或补充原申请');if(!validate())return true;const data={...form,kind,name:form.name||form.昵称||form.company||form.开户姓名,phone:form.phone||form.手机号码,rank:{云代理:1,分货中心:2,总代理:3}[form.拟申请职级]||1};if(kind==='agent_application'){
    if(!form.consent&&pageId!=='M31')throw new Error('请同意代理合作协议');
    if(pageId==='M30'){
     if(!String(form.所在县域||'').trim()||!String(form.accountName||'').trim())throw new Error('请填写所在县域和开户姓名');
     if(form.账户类型==='银行卡'&&!/^[1-9][0-9]{15,18}$/.test(String(form.bank||'')))throw new Error('请填写16至19位有效银行卡号');
     if(!Array.isArray(form.uploads)||!form.uploads.length)throw new Error('请上传证件或营业资料');
     // 服务端会再次核对版本与协议编号，禁止旧页提交后被默认为同意新版。
     const agreement=backend.policies?.AGENT_AGREEMENT;
     if(!agreement?.id||!agreement?.version)throw new Error('代理合作协议正文尚未发布');
     if(form._agentAgreementKey!==[backend.shopId,agreement.id,agreement.version].join(':'))throw new Error('代理协议已更新，请重新阅读并确认');
     data.agreementVersion=agreement.version;
     data.agreementPolicyId=agreement.id;
    }
   }if(kind==='shop_application'){data.county=String(form.所属县域||'').split(' ').pop();data.name=form.company+'商城';data.representative=form.name}if(kind==='settlement_account'){data.bank=form.银行卡号;data.accountName=form.开户姓名;data.channel={系统余额:'BALANCE',微信零钱:'WECHAT',银行卡:'BANK'}[form.channel];data.bankName=form.开户银行}if(kind==='migration'){const date=calendarDate(form.期望生效时间,'期望生效日期',true),targetShop=backend.shops.find(s=>s.name===form.目标商城||(String(form.目标商城).includes('直营')&&s.kind==='DIRECT'));if(!targetShop)throw new Error('目标商城尚未开通');const agents=await request('/hexu/app/agent-lookup',{shopId:targetShop.id,query:String(form.目标代理)});if(agents.length!==1)throw new Error('请填写目标商城的准确代理姓名或编号');data.targetShopId=targetShop.id;data.targetAgentId=agents[0].id;data.effectiveAt=date?date+' 00:00:00':''}await apiCommand('document-save',data);await refresh();if(kind==='migration')await pageData('M41',form);toast('已提交后台');if(kind==='agent_application')navigate('M31');return true}
  
  if(pageId.startsWith('G')){
   const rows=backend.management[pageId]||[];const record=Array.isArray(rows)?rows.find(x=>x.id===backend.selectedDocuments?.[pageId])||rows.find(x=>x.status==='PENDING')||rows[0]:null;
   if(pageId==='G56'&&target==='enable-link'){const input=linkCampaignPayload(form),d=await apiCommand('document-save',input,true);form._linkId=d.id;toast(form.enabled?'联动规则已保存，按完成订单计奖':'联动活动已关闭');return true}
   if(pageId==='G46'&&target==='submit'){
    const line=rows.find(r=>r.id===backend.reconciliationLine)||rows.find(r=>!['MATCHED','RESOLVED'].includes(r.status))||rows[0];
    if(!line)throw new Error('暂无对账明细');
    if(form.adjustment!=='申请账务调整'){
     await apiCommand('reconcile-recheck',{id:line.id},true);
     toast('已按最新回执和原单重新核对');
    }else{
     const reason=String(form.reason||'').trim(),uploads=form.uploads||[];
     if(reason.length<2||reason.length>500)throw new Error('复核原因须为2–500个字符');
     if(!Array.isArray(uploads)||uploads.length<1||uploads.length>9)throw new Error('请上传1至9份财务凭证');
     await apiCommand('adjustment-propose',{id:line.id,reason,uploads},true);
     toast('调整申请已提交，等待其他财务人员复核');
     form.adjustment='重新核对业务回执';form.reason='';form.uploads=[];
    }
    await pageData(pageId,form);return true;
   }
   if(['G33','G35'].includes(pageId)&&['approve','reject'].includes(target)){if(!record||!['PENDING','SUPPLEMENT'].includes(record.status))throw new Error('请先选择待审核申请');await apiCommand('document-review',{id:record.id,decision:target==='approve'?'APPROVED':'REJECTED',reason:form.审核意见||form.审批备注||'',...(pageId==='G35'&&target==='approve'?{approvedExpiresAt:form['有效期至']===new Date(timestamp(record.body.expiresAt)).toLocaleDateString('en-CA')?record.body.expiresAt:new Date(form['有效期至']+'T23:59:59').getTime(),approvedItems:record.body.items.length===1?[{skuId:record.body.items[0].skuId,qty:Number(form['可采购数量上限'])}]:record.body.items}:{})},true);await pageData(pageId,form);toast('处理结果已同步');return true}
   if(pageId==='G35'&&target==='cross-revoke'){
    if(!record||record.status!=='APPROVED')throw new Error('请先选择已批准的跨店采购授权');
    const reason=String(form['撤销原因']||'').trim();
    if(reason.length<2||reason.length>500)throw new Error('撤销原因须为2–500个字符');
    await apiCommand('document-revoke',{id:record.id,reason},true);
    await pageData(pageId,form);toast('授权已撤销，新报价和建单即时失效');return true;
   }
   if(pageId==='G39'&&target==='settle'||pageId==='G42'&&target==='reverse'||pageId==='G44'&&target==='query-payment'){if(await pageData(pageId,form))toast('已同步最新业务记录');return true}
   if(pageId==='G10'&&target==='save'){
    const old=backend.editProduct,sku=String(form.商品编码||'').trim();if(!sku||!form.商品名称)throw new Error('请填写商品编码和名称');if(!old&&!form.uploads?.[0])throw new Error('请先上传商品主图');const values=catalogEditorValues(form);const saved=await apiCommand('sku-save',{...(old||{}),id:values.sku,name:form.商品名称,spec:form.规格,category:form.商品分类,product_group:values.productGroup,description:form.商品详情,freight_id:form.运费模板==='默认模板'?'':String(form.运费模板||'').split(' · ')[0],weight_grams:values.weightGrams,asset:form.uploads?.[0]||old?.asset||'',gallery:form.uploads||[],retail:values.retail,cloud_price:values.cloud_price,center_price:values.center_price,owner_price:values.owner_price,box_size:old?.box_size||1,min_boxes:old?.min_boxes||1,min_qty:old?.min_qty||1,available:values.available,expectedAvailable:form._expectedStock,stockReason:form.stockReason,publish:!!form.商品状态},true);state.editSku=saved.id;form._catalogId='';await pageData(pageId,form);toast(saved.status==='PENDING'?'商品已提交平台审核':'商品已保存');return true;
   }
   if(pageId==='G12'&&target==='save'){
    const name=typeof form.模板名称==='string'?form.模板名称.trim():'';
    const items=String(form.categoryNames||'').split(/[,，\n]/).map(x=>x.trim()).filter(Boolean);
    const original=backend.catalogSettings?.categories||[];
    const categoryChanged=JSON.stringify(items)!==JSON.stringify(original);
    const emptyFreightDraft=!form._freightDoc&&!name&&form.计费方式==='固定运费'&&['首件运费','续件运费','偏远地区加收','满额包邮门槛'].every(key=>Number(form[key])===0)&&Number(form.firstUnits)===1&&Number(form.stepUnits)===1&&!String(form.remoteRegions||'').trim();
    if(emptyFreightDraft&&categoryChanged){await apiCommand('catalog-settings-save',{categoryId:backend.categoryDoc?.id,categories:items},true);form._freightId='';await pageData(pageId,form);toast('商品分类已保存');return true;}
    if(!name||[...name].length>80||/[\u0000-\u001f\u007f-\u009f]/u.test(name))throw new Error('请填写1至80字的运费模板名称');
    await apiCommand('catalog-settings-save',{categoryId:backend.categoryDoc?.id,categories:items,freight:{id:form._freightDoc,name,billing:({'按件':'COUNT','按重量':'WEIGHT','固定运费':'FLAT'}[form.计费方式]||'COUNT'),freightCents:Math.round(Number(form.首件运费)*100),extraFee:Math.round(Number(form.续件运费)*100),remoteFee:Math.round(Number(form.偏远地区加收)*100),freeThreshold:Math.round(Number(form.满额包邮门槛)*100),firstUnits:Number(form.firstUnits),stepUnits:Number(form.stepUnits),remoteRegions:form.remoteRegions}},true);form._freightId='';await pageData(pageId,form);toast('分类顺序和运费模板已保存');return true;
   }
   if(pageId==='G13'&&target==='save'){
    if(!backend.boxProduct)throw new Error('请先选择商品');
    const positiveInteger=(value,max)=>/^\d+$/.test(String(value).trim())&&Number(value)>=1&&Number(value)<=max;
    if([form.boxSize,form.minBoxes,form.minQty,form.mixUnits].some(value=>!positiveInteger(value,100000)))throw new Error('箱规、起订量和箱容积分须为正整数');
    const mixGroup=String(form.mixGroup||'').trim();
    if(!/^[A-Za-z0-9_-]{0,64}$/.test(mixGroup))throw new Error('混批组编号格式错误');
    if(form.混批开关&&(!positiveInteger(form.mixCapacity,1000000)||!positiveInteger(form.minMixBoxes,100000)))throw new Error('混批箱容与最低箱数无效');
    await apiCommand('sku-box-rules',{skuId:backend.boxProduct.id,box_size:Number(form.boxSize),min_boxes:Number(form.minBoxes),min_qty:Number(form.minQty),mix_units:Number(form.mixUnits),mix_group:mixGroup,allow_loose:!!form.allowLoose,mixedEnabled:!!form.混批开关,mixCapacity:Number(form.mixCapacity),minMixBoxes:Number(form.minMixBoxes)},true);form._boxId='';await pageData(pageId,form);toast('箱规和混批校验已生效');return true;
   }
   if(pageId==='G36'&&target==='save'){await apiCommand('document-save',{kind:'assessment_rule',name:form.方案名称,periodMonths:form.考核周期==='自然月'?1:3,periodKind:({'自然月':'MONTH','自然季度':'QUARTER','滚动90天':'ROLLING'}[form.考核周期]||'ROLLING'),salesThreshold:Math.round(Number(form.销售业绩门槛)*100),directCount:Number(form.有效直推人数),repeatRate:Number(form['客户复购率（%）']),operator:form.metricMode==='任一指标满足'?'OR':'AND',effectiveAt:new Date(form.生效时间+'T00:00:00').getTime()},true);toast('考核方案已保存');return true}
   if(pageId==='G06'&&target==='submit'){if(!validate())return true;const operation={'商城转移':'TRANSFER','合并商城':'MERGE','暂停经营':'CLOSE'}[form.operation];const input={kind:'shop_transfer',operation,reason:form.reason||'',effectiveAt:form.生效时间||'',uploads:form.uploads||[]};if(operation==='TRANSFER'){const matches=await request('/hexu/app/agent-lookup',{shopId:backend.shopId,query:String(form.新拥有者||'')});if(matches.length!==1)throw new Error('请填写本商城新拥有者的准确代理姓名或代理编号');input.newOwnerAgentId=matches[0].id;}if(operation==='MERGE'){const target=backend.shops.find(s=>s.name===form.目标商城||String(s.id)===String(form.目标商城));if(!target)throw new Error('请填写准确目标商城名称或编号');input.targetShopId=target.id;}await apiCommand('document-save',input,true);toast('已生成交接清单，等待平台审核');return true}
   if(pageId==='G38'&&['approve','reject'].includes(target)){const d=(backend.management.G38||[]).find(d=>d.id===backend.selectedDowngrade)||(backend.management.G38||[]).find(d=>['PENDING','REVIEW_REQUIRED'].includes(d.status));if(!d||!['PENDING','REVIEW_REQUIRED'].includes(d.status))throw new Error('请先选择待审核降级记录');await apiCommand('document-review',{id:d.id,decision:target==='approve'?'APPROVED':'REJECTED',reason:form.disposition||'',effectiveAt:form.执行日期},true);await pageData(pageId);toast('降级审核已处理');return true}
   if(pageId==='G38'&&target==='assessment-run'){const r=await apiCommand('assessment-run',{},true);await pageData(pageId);toast('已核算 '+r.periodsCreated+' 个结束周期');return true}
   if(pageId==='G37'&&['approve','reject'].includes(target)){
    const application=backend.promotionReview,scope=backend.promotionReviewContext,latest=rows.find(x=>x.id===application?.id);
    if(backend.pageLoading.G37||backend.displayPageErrors?.G37||!backend.promotionReviewAllowed||!application||!latest||!scope||scope.token!==backend.token||Number(scope.memberId)!==Number(backend.member?.id)||Number(scope.shopId)!==Number(backend.shopId)||application.kind!=='promotion'||latest.kind!=='promotion'||Number(application.shop_id)!==Number(backend.shopId)||Number(latest.shop_id)!==Number(backend.shopId)||!['PENDING','SUPPLEMENT'].includes(application.status)||!['PENDING','SUPPLEMENT'].includes(latest.status)||(backend.selectedDocuments?.G37&&backend.selectedDocuments.G37!==application.id)||!String(form._promotionKey||'').startsWith(application.id+':'))throw new Error('请重新读取当前商城的待审核晋升申请');
    const reason=String(form.审核意见||'').trim(),effectiveAt=target==='approve'?String(form.职级生效时间||'').trim():'';
    if(target==='reject'&&!reason)throw new Error('请填写驳回原因');
    if(effectiveAt){const date=new Date(effectiveAt+'T00:00:00');if(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveAt)||!Number.isFinite(date.getTime())||date.getFullYear()!==Number(effectiveAt.slice(0,4))||date.getMonth()+1!==Number(effectiveAt.slice(5,7))||date.getDate()!==Number(effectiveAt.slice(8,10))||date.getTime()<Date.now()-60000)throw new Error('生效日期须为真实的未来日期，留空立即生效');}
    await apiCommand('document-review',{id:application.id,decision:target==='approve'?'APPROVED':'REJECTED',reason,effectiveAt},true);backend.promotionReviewAllowed=false;await pageData(pageId,form);toast('审核结果已保存');return true;
   }
   if(pageId==='G19'&&target==='stocktake-propose'){const catalog=backend.management.G19||[];if(backend.actionPageErrors?.G19)throw new Error('请先重新读取盘点数据');if(!catalog.length)throw new Error('当前列表没有可盘点商品');if(catalog.some(p=>!String(form[stocktakeKey(p.id)]??'').trim()))throw new Error('请填写列表商品的实盘数量');const items=catalog.map(p=>({skuId:p.id,actual:Number(form[stocktakeKey(p.id)]),expectedAvailable:Number(p.available),expectedLocked:Number(p.locked||0)}));if(items.some((item,index)=>!Number.isSafeInteger(item.actual)||item.actual<Number(catalog[index].locked||0)))throw new Error('实盘库存须为不小于已锁定库存的整数');backend.stocktake=await apiCommand('document-save',{kind:'stocktake',items},true);form._stocktakeSnapshot='';state.selectedStocktake=backend.stocktake.id;persist();navigate('G20');return true}
   if(pageId==='G20'&&['approve','reject'].includes(target)){if(!backend.stocktake)throw new Error('请先选择真实盘点单');if(backend.stocktake.status!=='PENDING')throw new Error('盘点单已经审核，请选择待审核记录');const reason=String(form.原因说明||'').trim();if(!reason)throw new Error('请填写本张盘点单的审核原因');const reviewed=backend.stocktake;await apiCommand('document-review',{id:reviewed.id,decision:target==='approve'?'APPROVED':'REJECTED',reason},true);reviewed.status=target==='approve'?'APPROVED':'REJECTED';form.原因说明='';toast(await pageData(pageId,form)?'盘点审核已完成':'盘点审核已保存，列表读取失败，请刷新');return true}
   if(pageId==='G18'&&target==='save'){if(!form._warningSkuId||!products.some(p=>p.id===form._warningSkuId))throw new Error('请先选择本商城库存商品');const raw=String(form.预警阈值??'').trim();if(!/^(0|[1-9]\d*)$/.test(raw)||Number(raw)>2147483647)throw new Error('预警阈值须为0至2147483647的整数');await apiCommand('stock-warning',{skuId:form._warningSkuId,warningQty:Number(raw)},true);await refresh();toast('库存预警已保存');return true}
   if(pageId==='G31'&&['approve','reject','supplement'].includes(target)){if(!record)throw new Error('暂无待审核申请');await apiCommand('document-review',{id:record.id,decision:{approve:'APPROVED',reject:'REJECTED',supplement:'SUPPLEMENT'}[target],reason:form.审核意见||''},true);await pageData(pageId);toast('审核结果已保存');return true}
   if(pageId==='G64'&&target==='save'){
    for(const [key,min,max] of [['未支付订单关闭（分钟）',1,1440],['自动收货（天）',1,90],['售后申请期限（天）',1,365]]){
     const value=Number(form[key]);
     if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(key+'须为'+min+'至'+max+'的整数');
    }
   }
   if(['G50','G51','G64'].includes(pageId)&&['save','publish'].includes(target)){
    const data=pageId==='G50'
     ?{kind:'points_risk',id:form._pointRiskId,...pointRiskPayload(form)}
     :pageId==='G51'
      ?couponPayload(form)
      :{kind:'system_parameter',unpaidMinutes:Number(form['未支付订单关闭（分钟）']),autoReceiveDays:Number(form['自动收货（天）']),afterSalesDays:Number(form['售后申请期限（天）']),notifyPaid:!!form['订单支付通知'],notifyShipped:!!form['发货物流通知'],notifyRefund:!!form['售后状态通知'],notifyWithdrawal:!!form['提现结果通知'],notifyInventory:!!form['库存预警通知']}
    await apiCommand('document-save',data,true)
    if(pageId==='G50'){form._pointRiskShop=null;await pageData(pageId,form)}
    toast('配置已保存');return true
   }
   if(pageId==='G43'&&['approve','reject'].includes(target)){const withdrawal=backend.managementWithdrawal;if(!withdrawal||withdrawal.status!=='PENDING')throw new Error('暂无待审核提现');await apiCommand('withdraw-review',{id:withdrawal.id,approve:target==='approve',reason:form.审核意见||''},true);await pageData(pageId);toast('审核结果已保存');return true}
   if(pageId==='G23'&&target==='ship'){
    if(!state.managementOrder)throw new Error('请先选择待发货订单')
    const carrier=String(form.快递公司||'').trim(),tracking=String(form.tracking||'')
    if(!carrier||[...carrier].length>60||/[\u0000-\u001f\u007f-\u009f]/.test(carrier)||!/^[A-Za-z0-9]{8,40}$/.test(tracking))throw new Error('请填写有效快递公司和8至40位字母数字运单号')
    await apiCommand('ship',{id:state.managementOrder,carrier,tracking},true)
    toast('订单已发货');navigate('G24');return true
   }
   if(pageId==='G26'&&['approve','reject'].includes(target)){if(!backend.refund)throw new Error('请先选择售后申请');backend.refund=await apiCommand('refund-review',{id:backend.refund.id,approve:target==='approve',reason:form.审核意见||''},true);toast('审核已保存');return true}
   if(pageId==='G27'&&target==='approve'){if(!backend.refund)throw new Error('请先选择售后申请');backend.refund=await apiCommand('return-inspect',{id:backend.refund.id,goodQty:form.外观状态==='完好可再次销售'?Number(form.实际验收):0,receivedQty:Number(form.退回数量),note:form.验收备注||'',uploads:form.uploads||[]},true);toast('验收记录已保存');return true}
   if(pageId==='G28'&&target==='save'){if(!backend.refund)throw new Error('请先选择换货申请');backend.refund=await apiCommand('exchange-ship',{id:backend.refund.id,carrier:form.新发快递,tracking:form.tracking},true);toast('换货已发出');return true}
  }
  // Never fall back to the former local success simulation for unsupported service operations.
  throw new Error('此操作的服务端流程尚未接通，未执行数据变更');
 }catch(e){toast(e?.message||e?.errMsg||'操作失败，请稍后重试');return true}finally{backend.busy=false}
}
export function liveBlocks(pageId,blocks,form={},activeFilter='',query='',requestedPage=1){if(pageId==='M01')return blocks;if(backend.pageLoading[pageId]&&!(pageId==='M10'&&sameReviewDraft(form)))return [{type:'notice',title:'正在读取业务数据',body:'请稍候'}];if(backend.guest&&guestPages.includes(pageId))return blocks;if(!backend.ready)return [{type:'notice',title:backend.error?'业务数据暂不可用':'正在读取业务数据',body:backend.error||'请稍候'}];if(financePages.has(pageId)&&backend.financeErrors?.[pageId])return [{type:'notice',title:'业务数据读取失败',body:backend.financeErrors[pageId]}];if(pageId==='G02'&&backend.shopInfo?.kind!=='DIRECT')return [{type:'notice',title:'当前商城不是公司直营商城',body:'直营经营数据仅在公司直营商城范围内查看。'},{type:'rows',items:[{label:'当前商城经营台',value:state.shop,target:'G03'}]}];if(['G07','G08','G23','G24','G26','G27','G28','M19','M27','G41','G55','G61','G62','G64'].includes(pageId)&&backend.operationError)return [{type:'notice',title:'业务数据读取失败',body:backend.operationError}];if(pageId==='M16'&&!paidOrderStatuses.includes(backend.activeOrder?.rawStatus))return [{type:'notice',title:'支付结果尚未确认',body:'请返回订单详情刷新支付状态；未确认前不会显示支付成功。'}];if(['G26','G27','G28'].includes(pageId)&&!backend.refund)return [{type:'notice',title:'请先选择售后单',body:'从售后列表进入对应申请后办理审核与验收'}];if(['G01','G02'].includes(pageId)&&(!backend.management[pageId]||Array.isArray(backend.management[pageId])))return [{type:'notice',title:'经营数据暂不可用',body:backend.actionPageErrors?.[pageId]||'请重新读取当前商城的经营数据。'},{type:'rows',items:[{label:'重新读取',value:'重试',target:'action-page-refresh'}]}];const out=JSON.parse(JSON.stringify(blocks));const account=backend.account;
 if(pageId==='M12'){
  const agreement=backend.policies?.[PURCHASE_AGREEMENT]
  out.push(agreement?.id&&agreement?.version?
   {type:'rows',title:'购买协议',items:[{label:'查看协议正文',value:agreement.title+' · 版本 '+agreement.version,target:'policy:'+PURCHASE_AGREEMENT}]}:
   {type:'notice',title:backend.purchaseAgreementError?'购买协议读取失败':'购买协议未发布',body:backend.purchaseAgreementError||'请等待当前商城发布购买协议后再提交订单。'})
 }
 if(pageId==='G16'&&backend.displayPageErrors?.G16)return [{type:'notice',title:'业务数据读取失败',body:backend.displayPageErrors.G16},{type:'rows',items:[{label:'重新读取',value:'重试',target:'action-page-refresh'},{label:'选择其他采购单',value:'查看',target:'purchase-orders'}]}];
 if(displayPages.has(pageId)&&backend.displayPageErrors?.[pageId])return [{type:'notice',title:'业务数据读取失败',body:backend.displayPageErrors[pageId]},{type:'rows',items:[{label:'重新读取',value:'重试',target:'action-page-refresh'}]}];
 if(['G14','G15'].includes(pageId)&&!state.wholesaleSku)return [{type:'notice',title:'暂无可采购商品',body:pageId==='G14'?'当前账号或商城没有可采购的公司批发商品。':'请从采购购物车选择商品与箱数后再结算。'}];
 if(pageId==='G03')out.push({type:'rows',title:'采购订单',items:[{label:'查看批发补货与整箱直发订单',value:'查看',target:'G16'}]});
 if(pageId==='M29'){
  const decoration=backend.storefront?.decoration||{},phone=String(decoration.customerPhone||decoration.servicePhone||'').trim(),announcement=String(decoration.announcement||'').trim();
  for(const block of out){if(block.type==='hero'){block.title='您好，有什么\n可以帮您？';block.subtitle='客服信息与服务安排以商城实际公告为准';}if(block.type==='rows'&&block.title==='客服营业时间'){block.title='商城客服';block.items=[{label:'客服电话',value:phone||'商家尚未配置客服电话'},{label:'服务安排',value:'请查看店铺公告或提交留言咨询'}];}if(block.type==='notice'&&block.title==='店铺公告'){block.body=announcement||'商家暂未发布店铺公告';}}
  const records=backend.supportRecords||[],selected=records.find(record=>record.id===backend.selectedSupportId)||records[0];
  out.push({type:'rows',title:'我的留言',emptyText:'尚无留言',items:records.map(record=>({label:(record.body?.question||'客服留言')+' · '+dateTimeLabel(record.created_at),value:label(record.status),target:'support-select:'+record.id}))});
  if(selected){
   out.push({type:'rows',title:'留言进度',items:[{label:'关联订单',value:selected.body?.orderId||'未关联订单'},{label:'提交时间',value:dateTimeLabel(selected.created_at)},{label:'处理状态',value:label(selected.status)}]});
   out.push({type:'notice',title:'客服回复',body:selected.review_note||(['PENDING','SUPPLEMENT'].includes(selected.status)?'留言已提交，等待客服处理。':'暂无处理意见'),tone:selected.status==='APPROVED'?'':'orange'});
   const proofs=Array.isArray(selected.body?.uploads)?selected.body.uploads:[];
   out.push({type:'rows',title:'留言图片',emptyText:'未上传图片',items:proofs.map((id,index)=>({label:'已提交图片 '+(index+1),value:'查看图片',target:'view-proof:'+id}))});
   out.push({type:'notice',title:'我的留言内容',body:selected.body?.message||'—'});
  }
  return out;
 }
 if(pageId==='G37'){
  const d=backend.promotionReview;if(!d)return [{type:'notice',title:'暂无晋升申请',body:'代理提交真实晋升申请后，申请资料和考核快照会在这里同步。'}];
  const body=d.body||{},assessment=body.assessment||{},ranks={1:'云代理',2:'分货中心',3:'总代理'},editable=backend.promotionReviewAllowed;
  for(const block of out){if(block.type==='profile'){block.name=body.name||'会员 '+d.member_id;block.subtitle='当前：'+(ranks[body.fromRank??assessment.rank]||'待核实')+' → 申请：'+(ranks[body.rank??assessment.targetRank]||'待核实');}if(block.type==='progress')block.items=(Array.isArray(assessment.metrics)?assessment.metrics:[]).filter(m=>m.enabled!==false).map(m=>[m.label,m.key==='sales'?'¥'+money(m.value)+' / ¥'+money(m.threshold):m.key==='repeat'?Number(m.value)/100+'% / '+Number(m.threshold)/100+'%':String(m.value??0)+' / '+String(m.threshold??0),Number(m.threshold)>0?Math.min(100,Math.max(0,Number(m.value)/Number(m.threshold)*100)):m.passed?100:0]);if(block.type==='rows'){block.title='真实申请与考核快照';block.items=[{label:'申请编号',value:d.id},{label:'申请商城',value:state.shop},{label:'提交时间',value:d.created_at||'—'},{label:'审核状态',value:label(d.status)},{label:'考核开始',value:assessment.periodStart||'未提供'},{label:'考核结束',value:assessment.periodEnd||'未提供'},{label:'生效时间',value:body.effectiveAt?dateTimeLabel(body.effectiveAt):'审核后立即（可另行指定）'},{label:'处理意见',value:d.review_note||'尚未处理'}];}if(block.type==='fields')block.items=block.items.map(field=>({...field,...(!editable?{kind:'readonly',required:false}:{}),...(field.key==='职级生效时间'?{label:'职级生效时间（选填，留空立即）'}:{})}));}
  out.push({type:'rows',title:'选择晋升记录',items:(backend.management.G37||[]).map(record=>({label:'会员 '+record.member_id+' · '+record.id,value:label(record.status),target:'document-select:'+record.id}))});return out;
 }
 if(pageId==='G16'){
  const order=backend.purchaseOrderDetail
  if(!order){
   const orders=backend.purchaseOrders||[]
   return [
    {type:'notice',title:orders.length?'请选择本人采购订单':'暂无近期采购订单',body:orders.length?'选择待收货采购单后核对物流与库存处理。':'近期列表没有本人采购单，可输入历史订单编号查找。'},
    {type:'fields',title:'按采购单号查找',items:[{label:'采购订单编号',key:'purchaseOrderId',kind:'input',maxlength:128}]},
    {type:'rows',items:[{label:'查找采购订单',value:'查询',target:'purchase-order-search'}]},
    {type:'rows',title:'我的采购订单',items:orders.map(item=>({label:(item.order_type==='DIRECT_SHIP'?'整箱直发':'批发补货')+' · '+item.id,value:label(item.rawStatus),target:'purchase-order:'+item.id}))}
   ]
  }
  const shipping=displayJson(order.shipping_json),items=order.items||[],type=order.order_type==='DIRECT_SHIP'?'整箱直发':'批发补货';
  for(const block of out){if(block.type==='notice'){block.title=type+' · '+label(order.rawStatus);block.body=({UNPAID:'请在订单支付期限内完成付款',PAID:'等待公司批发仓发货',SHIPPED:'公司批发仓已发货，请核对实物后确认收货',COMPLETED:order.order_type==='DIRECT_SHIP'?'直发订单已完成，不增加商城可售库存':'采购已完成，按订单明细登记库存',CANCELLED:'采购订单已关闭',REFUNDED:'采购退款已处理'}[order.rawStatus]||'以服务端订单状态为准');}if(block.type==='timeline'){block.items=['待付款','待公司发货','运输中','采购完成'];block.active=({UNPAID:0,PAID:1,SHIPPED:2,COMPLETED:3}[order.rawStatus]??0);}if(block.type==='rows'){block.items=block.title==='物流信息'?[{label:'物流公司',value:shipping.carrier||'尚未发货'},{label:'运单编号',value:shipping.tracking||'尚未发货'},{label:'采购数量',value:items.reduce((sum,line)=>sum+Number(line.qty||0),0)+'件'},{label:'订单编号',value:order.id},{label:'采购类型',value:type},{label:'订单金额',value:'¥'+money(order.total)}]:[{label:'本单库存处理',value:order.order_type==='DIRECT_SHIP'?'整箱直发，不计入商城可售库存':'确认收货后按实际订单数量增加可售库存'}];}}
  const productIndex=out.findIndex(block=>block.type==='product');if(productIndex>=0)out.splice(productIndex,1,...items.map(line=>({type:'product',id:line.id,product:reviewLineProduct(line),name:line.name,qty:line.qty,price:money(line.unitPrice)})));out.push({type:'rows',items:[{label:'选择其他采购单',value:'查看',target:'purchase-orders'}]});return out;
 }
 if(pageId==='M22'){
  const refund=backend.refund;if(!refund)return [{type:'notice',title:'尚未选择退货申请',body:'请从本人订单中的真实售后记录进入，商家同意退货后再填写物流。'}];
  const address=backend.shopInfo?.returnAddress||{},returned=displayJson(refund.return_json),editable=backend.returnTrackingAllowed,exchange=refund.refund_type==='EXCHANGE';
  for(const block of out){
   if(block.type==='notice'){
    block.title=editable&&returned.tracking?'运单已提交，待商家验收':label(refund.status);
    block.body=editable?returned.tracking?'已提交退货运单；商家验收前可以修改物流信息。':'请确认商家实际收货地址后寄回商品；退货时限以商家审核说明为准':refund.review_note||'当前售后状态不能修改退货物流，已填写资料仅供核对。';
   }
   if(block.type==='timeline'){block.items=[exchange?'商家同意换货':'商家同意退货','填写寄回运单','商家验收',exchange?'换货发出':'渠道处理'];block.active=({PENDING:0,WAIT_RETURN:returned.tracking?1:0,WAIT_EXCHANGE:2,EXCHANGE_SHIPPED:3,APPROVED:3,SUCCESS:3,CLOSED:3}[refund.status]??0);}
   if(block.type==='rows')block.items=[{label:'收货人',value:address.name||'待商家配置'},{label:'联系电话',value:address.phone||'请联系商城客服'},{label:'收货地址',value:address.address||'请确认退货地址后寄出'},{label:'售后单号',value:refund.id},{label:'原订单',value:refund.order_id}];
   if(block.type==='fields'){
    if(editable&&returned.tracking)block.title='修改退货物流信息';
    if(!editable)block.items=block.items.map(field=>({...field,kind:'readonly',required:false}));
   }
   if(block.type==='upload'&&!editable){block.type='rows';block.title='已提交运单凭证';block.items=(Array.isArray(returned.uploads)?returned.uploads:[]).map((id,i)=>({label:'运单凭证 '+(i+1),value:'查看',target:'view-proof:'+id}));}
  }
  return out;
 }
 const merchantStatus=s=>({PENDING:'待渠道核实',VERIFIED:'已核实',REJECTED:'已驳回'}[s]||'尚未提交');
 if(backend.actionPageErrors?.[pageId])return [{type:'notice',tone:'orange',title:'业务资料暂时无法读取',body:backend.actionPageErrors[pageId]},{type:'rows',items:[{label:'重新读取资料',value:'重试',target:'action-page-refresh'}]}];
 if(pageId==='M43'){
  const target=backend.shops.find(s=>Number(s.id)===Number(backend.requestedShopId));
  for(const b of out){if(b.type==='relation')b.items=[state.shop,target?.name||'尚未选择目标商城'];if(b.type==='notice'&&b.tone==='orange'){b.title='您已归属'+state.shop;b.body='当前归属不会因浏览其他商城自动迁移。跨店采购需按目标商城规则确认。';}if(b.type==='rows')b.items=[{label:'访问目标',value:target?.name||'请先在商城列表选择'},{label:'跨店购买',value:'不自动迁移代理归属，审核或访问权限以后台规则为准'}];}
  return out;
 }
 if(pageId==='M54'){
  for(const b of out){
   if(b.type==='notice'){b.title='积分兑换规则';b.body='本页兑换使用平台积分，商城积分使用规则请查看发行商城配置。积分不可提现。';}
   if(b.type==='tabs'&&Array.isArray(backend.shopInfo?.categories)&&backend.shopInfo.categories.length)b.items=['全部',...backend.shopInfo.categories];
   if(b.type==='pointsProducts'){
    b.products=products.filter(p=>Number(p.point_price)>0&&(!activeFilter||activeFilter==='全部'||p.category===activeFilter));
    b.ids=b.products.map(p=>p.id);
   }
  }
  const list=out.find(b=>b.type==='pointsProducts');
  if(activeFilter&&activeFilter!=='全部'&&!list?.products.length)out.push({type:'notice',title:'暂无此分类兑换商品',body:'请选择其他分类查看当前可兑换商品。'});
 }
 if(['M33','M38'].includes(pageId)&&!backend.agent)return [{type:'notice',title:'当前尚未获得本店代理身份',body:'申请审核通过后可查看真实业绩与晋升条件。'},{type:'rows',items:[{label:'查看代理申请',target:'M30'}]}];
 if(pageId==='M33')for(const b of out){
  if(b.type==='profile'){b.name=backend.member.name;b.subtitle=({1:'云代理',2:'分货中心',3:'总代理'}[backend.agent.rank_no]||'代理')+' · '+state.shop;}
  if(b.type==='stats'&&b===out.filter(x=>x.type==='stats')[1])b.items=[{label:'已绑定客户',value:backend.agentData?.customers?.length||0},{label:'本期成交客户',value:backend.assessment?.customers||0},{label:'本期有效订单',value:backend.assessment?.orders||0},{label:'本期复购率',value:(Number(backend.assessment?.repeatBps||0)/100)+'%'}];
  if(b.type==='chart'){b.type='notice';b.title='业绩统计范围';b.body=backend.assessment?(backend.assessment.periodStart+' 至 '+backend.assessment.periodEnd+'，按真实完成订单扣除退款统计。当前接口未提供近6个月趋势。'):'考核资料待读取，不显示示例趋势。';delete b.values;}
 }
 if(pageId==='M38'){
  const a=backend.assessment,ranks={1:'云代理',2:'分货中心',3:'总代理'};
  if(!a)return [{type:'notice',title:'晋升资料尚未读取',body:'请重新进入页面查看当前考核结果。'}];
  for(const b of out){if(b.type==='relation')b.items=[ranks[a.rank||backend.agent.rank_no]||'当前代理',ranks[a.targetRank]||'暂无可晋升职级'];if(b.type==='hero')b.subtitle='以当前商城真实考核结果为准';if(b.type==='progress')b.items=[];}
 }
 if(pageId==='M41'){
  const c=backend.migrationContext;
  if(!c?.bound||!c.currentBinding)return [{type:'notice',title:'暂无可迁移的商城归属',body:'当前会员没有本店有效绑定关系，不显示示例代理。'}];
  for(const b of out){if(b.type==='rows')b.items=[{label:'原商城',value:c.shop?.name||state.shop},{label:'当前代理',value:c.currentBinding.name+' · '+c.currentBinding.agentId}];if(b.type==='fields')for(const i of b.items)if(i.key==='目标商城')i.options=backend.shops.filter(s=>Number(s.id)!==Number(backend.shopId)&&s.kind!=='WHOLESALE').map(s=>s.name);}
   const pending=(backend.documents.migration||[]).find(d=>['PENDING','SUPPLEMENT','SCHEDULED'].includes(d.status));
   if(pending){out.push({type:'notice',title:'迁移申请进行中',body:'申请 '+pending.id+' · '+label(pending.status)+'。请等待审核或按审核意见补充原申请。'});out.splice(out.findIndex(b=>b.type==='fields'),1);}
 }
 if(pageId==='M44'){
  const target=backend.crossPurchaseTarget,p=backend.crossPurchaseProduct;
  if(!target)return [{type:'notice',title:'请先选择要访问的商城',body:'从商城列表选择实际目标店后，才能申请单次跨店采购。'},{type:'rows',items:[{label:'查看商城列表',target:'M42'}]}];
  const choices={type:'rows',title:'选择访问店商品',items:(backend.crossPurchaseCatalog||[]).map(item=>({label:item.name,value:(p?.id===item.id?'已选择 · ':'')+'¥'+money(item.price),target:'cross-product:'+item.id}))};
  if(!p)return [{type:'notice',title:'请先选择目标商城的可售商品',body:choices.items.length?'选择商品后填写采购数量和申请说明。':'当前目标商城暂无可售商品。'},choices];
  for(const b of out){if(b.type==='product')Object.assign(b,{id:p.id,product:p,name:p.name,qty:Number(form.采购数量)||1,price:money(p.price)});if(b.type==='rows')b.items=[{label:'原店',value:state.shop},{label:'访问店',value:target.name}];if(b.type==='fields')for(const field of b.items)if(field.key==='reason')field.maxlength=500;if(b.type==='options'){b.type='rows';b.items=[{label:'申请方式',value:'单次特批采购'},{label:'关系迁移申请',value:'另行办理',target:'M41'}];}}
  out.splice(1,0,choices);
 }
 if(pageId==='M52'&&!state.pendingTransfer)return [{type:'notice',title:'暂无待确认转赠',body:'请先填写真实接收人和转赠积分，再核对后提交。'},{type:'rows',items:[{label:'返回积分转赠',target:'M51'}]}]
 if(pageId==='M61'){
  const lines=state.buyNow?[state.buyNow]:(state.cart||[]).filter(x=>x.selected),ready=checkoutLinesReady(lines,products);backend.checkoutHasItems=ready;
  if(!ready)return [{type:'notice',title:lines.length?'所选商品暂不可售':'暂无待结算商品',body:lines.length?'请返回购物车取消勾选或删除失效商品，再重新选择优惠券。':'选择真实商品后，优惠券会按当前订单商品和金额核算。'},{type:'rows',items:[{label:lines.length?'返回购物车':'去商城选购',target:lines.length?'M11':homePageId()}]}];
  const total=lines.reduce((sum,line)=>sum+Number(products.find(p=>p.id===line.id).price)*Number(line.qty),0);
  for(const b of out)if(b.type==='rows'&&b.title==='订单商品')b.items=[{label:'商品总额',value:'¥'+money(total)},...lines.map(l=>({label:products.find(p=>p.id===l.id).name,value:l.qty+'件'}))];
  if(backend.couponPolicy?.blocked)for(const b of out)if(b.type==='notice'&&b.title==='优惠券使用规则')b.body='当前活动不叠加优惠券，返回结算页按活动价下单。';
 }
 if(pageId==='M62'){
  const p=products.find(p=>p.id===state.selectedPointProduct),qty=Number(form.兑换数量),address=state.addresses[state.selectedAddress||0],cost=Number(p?.point_price||0)*qty;backend.redemptionReady=!!p&&Number(p.point_price)>0&&Number.isInteger(qty)&&qty>0&&state.points>=cost&&!!address;
  if(!p||Number(p.point_price)<=0)return [{type:'notice',title:'请先选择积分兑换商品',body:'积分商城展示当前真实可兑换商品，不会默认提交样例商品。'},{type:'rows',items:[{label:'查看积分商城',target:'M54'}]}];
  for(const b of out){if(b.type==='product')Object.assign(b,{id:p.id,product:p,name:p.name,qty:Number.isInteger(qty)&&qty>0?qty:1,price:p.point_price+'积分'});if(b.type==='rows')b.items=[{label:'可用平台积分',value:state.points},{label:'所需平台积分',value:Number.isInteger(qty)&&qty>0?cost:'请填写正整数数量'},{label:'兑换后剩余',value:state.points>=cost?state.points-cost:'积分不足'},{label:'收货地址',value:address?[address.name,address.region,address.detail].filter(Boolean).join(' · '):'请先添加收货地址'},{label:'配送方式',value:'快递发货 · 包邮'}];if(b.type==='notice'){b.title=backend.redemptionReady?'确认兑换':'请核对兑换条件';b.body=Number.isInteger(qty)&&qty>0?'共'+qty+'件商品，合计'+cost+'平台积分；提交后以真实订单结果为准。':'兑换数量必须为正整数。';}}
 }
 if(pageId==='M63'){
  const order=backend.redemptionOrder;
  if(!order)return [{type:'notice',title:'暂无已确认的兑换订单',body:'完成真实兑换后才会展示订单号、扣除积分和订单状态。'},{type:'rows',items:[{label:'查看积分商城',target:'M54'}]}];
  const line=order.items[0],confirmed=['PAID','SHIPPED','COMPLETED'].includes(order.rawStatus);
  for(const b of out){if(b.type==='success'){b.icon=confirmed?'check':'alert';b.title=confirmed?'兑换订单已确认':order.status;b.body='订单状态以服务端回读为准，不表示已签收。';}if(b.type==='product')Object.assign(b,{id:line?.id,name:line?.name,qty:line?.qty||0,price:order.points_used+'积分'});if(b.type==='rows')b.items=[{label:'原兑换扣除积分',value:order.points_used},{label:'当前可用平台积分',value:state.points},{label:'兑换单号',value:order.id},{label:'订单状态',value:order.status}];if(b.type==='notice'){b.title='兑换订单状态';b.body='物流与售后以真实兑换订单详情为准。';}}
  return out;
 }
 if(pageId==='G17'){
  const list=backend.management.G17||[];
  for(const b of out){if(b.type==='stats')b.items=[{label:'在库商品',value:list.length},{label:'可售库存',value:list.reduce((s,p)=>s+Number(p.available||0),0)},{label:'预警商品',value:list.filter(p=>Number(p.available)<=Number(p.warning_qty)).length},{label:'锁定库存',value:list.reduce((s,p)=>s+Number(p.locked||0),0)}];if(b.type==='stock'){b.products=list.map(p=>({...p,stock:Number(p.available||0),price:Number(p.retail||0)}));b.ids=list.map(p=>p.id);b.emptyText='暂无符合条件的库存商品';b.privateProductAssets=true;}}
  if(!list.length)out.push({type:'notice',title:'暂无库存商品',body:'库存数量以本商城管理接口为准。'});
 }
 if(pageId==='G25')for(const b of out)if(b.type==='stats'){const list=backend.management.G25||[];b.items=[{label:'待审核',value:list.filter(x=>x.status==='PENDING').length},{label:'待退货',value:list.filter(x=>x.status==='WAIT_RETURN').length},{label:'待换货/退款',value:list.filter(x=>['WAIT_EXCHANGE','APPROVED'].includes(x.status)).length}];}
 if(pageId==='M09'){
  const all=backend.reviews||[],product=backend.reviewProduct?.id===state.selectedProduct?backend.reviewProduct:products.find(p=>p.id===(state.selectedProduct||products[0]?.id));
  if(!product)return [{type:'notice',title:'商品暂不可售',body:'请返回商城选择当前可售商品'}];
  for(const b of out){
   if(b.type==='product')Object.assign(b,{id:product.id,product,name:product.name,price:money(product.price),qty:1,target:Number(backend.reviewShopId)!==Number(backend.shopId)?'review-order':'product:'+product.id});
   if(b.type==='stats')b.items=[{label:'综合评分',value:all.length?(all.reduce((s,r)=>s+Number(r.rating||0),0)/all.length).toFixed(1):'暂无'},{label:'好评率',value:all.length?Math.round(all.filter(r=>r.rating>=4).length/all.length*100)+'%':'暂无'},{label:'已公开评价',value:all.length}];
   if(b.type==='reviews')b.items=filterReviews(all,activeFilter);
  }
  return out;
 }
 if(pageId==='M10'){
  const order=backend.activeOrder,skuId=state.reviewSku,line=order?.items?.find(l=>l.id===skuId),parent=backend.reviewParent;
  if(!order)return [{type:'notice',title:'请先选择订单',body:'请从订单列表选择已完成的真实订单后评价'}];
  if(order.rawStatus!=='COMPLETED'||!line)return [{type:'notice',title:'请选择已完成订单中的商品',body:'完成收货后才能评价，评价对象以真实订单为准'}];
  const context=backend.reviewContext;
  if(!context||context.orderId!==order.id||context.skuId!==skuId||Number(context.shopId)!==Number(order.shop_id)||(state.reviewParent&&context.parent?.id!==state.reviewParent))return [{type:'notice',title:'本人评价上下文尚未读取',body:'请重新读取该订单商品的本人评价后继续'}];
  const prior=state.reviewParent?backend.reviewAppendSubmission:backend.reviewSubmission,supplement=prior?.status==='SUPPLEMENT'&&prior.body?.orderId===context.orderId&&prior.body?.skuId===context.skuId&&(!state.reviewParent||prior.body?.parentId===state.reviewParent);
  if(Number(order.refunded||0)!==0)return [{type:'notice',title:'当前订单已有退款',body:'已公开评价仍保留；退款后不可新增或补充评价'}];
  if(state.reviewParent&&(!parent||(!parent.appendAllowed&&!parent.appendSupplementAllowed)))return [{type:'notice',title:'当前评价不可追加',body:'请从商品评价列表选择本人仍可追加或补充的实际评价'}];
  if(!state.reviewParent&&backend.reviewSubmission&&backend.reviewSubmission.status!=='SUPPLEMENT')return [{type:'notice',title:'评价已提交',body:label(backend.reviewSubmission.status)+'，通过审核的评价在商品评价页展示'},{type:'rows',items:[{label:'查看商品评价',target:'product-reviews:'+skuId}]}];
  for(const b of out){
   if(b.type==='upload'&&backend.pageLoading.M10)b.disabled=true;
   if(b.type==='product')Object.assign(b,{id:skuId,product:reviewLineProduct(line),name:line.name,qty:line.qty,price:money(line.unitPrice),target:Number(order.shop_id)!==Number(backend.shopId)?'review-order':'product:'+skuId});
   if(b.type==='fields')b.items=b.items.map(i=>({...i,required:i.key==='评价内容',maxlength:500}));
   if(b.type==='notice'){b.title=supplement?(state.reviewParent?'追评待补充':'评价待补充'):parent?'追加评价':'评价审核说明';b.body=supplement?(String(prior.review_note||'').trim()||'请补充评价文字或凭证，提交后将重新审核。'):parent?'追评独立审核，通过后展示；不会重复赠送评价积分。':'真实评价审核通过后公开，是否赠送积分以商城配置为准。';}
  }
  if(parent)return out.filter(b=>b.type!=='rating'&&!(b.type==='fields'&&b.items.some(i=>i.key==='匿名评价')));
  if(order.items.length>1)out.unshift({type:'rows',title:'选择评价商品',items:order.items.map(l=>({label:l.name,value:l.id===skuId?'当前评价商品':'选择',target:'review-line:'+l.id}))});
  return out;
 }
 if(pageId==='M53'){const all=account.pointLedger||[],visible=all.filter(x=>!activeFilter||activeFilter==='全部'||activeFilter==='获得'&&Number(x.amount)>0&&!/TRANSFER|REFUND|RETURN/.test(x.kind)||activeFilter==='抵扣'&&['ORDER_USE','REDEMPTION','DEBT_OFFSET'].includes(x.kind)||activeFilter==='转入/转出'&&['TRANSFER_IN','TRANSFER_OUT'].includes(x.kind)||activeFilter==='到期'&&['EXPIRE','RETURN_EXPIRED'].includes(x.kind)||activeFilter==='退款'&&/^REFUND|RETURN_EXPIRED/.test(x.kind));for(const b of out){if(b.type==='stats')b.items.forEach((s,i)=>s.value=[state.points+state.shopPoints,state.points,state.shopPoints][i]);if(b.type==='ledger')b.items=visible.map(x=>[label(x.kind)+' · '+(Number(x.shop_id)===0?'平台积分':'商城积分'),dateTimeLabel(x.created_at),(Number(x.amount)>=0?'+':'')+x.amount]);}if(!visible.length)out.push({type:'notice',title:'暂无此类积分流水',body:'实际积分变动后会在这里展示。'});return out;}
 if(['M36','M37'].includes(pageId)){if(!backend.agent||!backend.agentData)return [{type:'notice',title:'申请代理后查看客户与团队',body:'当前尚未获得本店代理身份。'},{type:'rows',items:[{label:'查看代理申请',target:'M30'}]}];const data=backend.agentData,rankName=r=>({1:'云代理',2:'分货中心',3:'总代理'}[r]||'代理');if(pageId==='M36'){const all=data.customers||[],recent=p=>timestamp(p.bound_at)>=Date.now()-30*86400000,list=activeFilter.startsWith('最近30天')?all.filter(recent):activeFilter.startsWith('历史绑定')?all.filter(p=>!recent(p)):all,chosen=list.find(x=>Number(x.member_id)===backend.selectedAgentCustomer)||list[0];for(const b of out){if(b.type==='tabs')b.items=['全部客户（'+all.length+'）','最近30天绑定（'+all.filter(recent).length+'）','历史绑定（'+all.filter(p=>!recent(p)).length+'）'];if(b.type==='search')b.placeholder='搜索客户昵称、会员编号';if(b.type==='people')b.items=list.map(p=>[p.name,'会员 '+p.member_id,'',dateTimeLabel(p.bound_at),'agent-customer:'+p.member_id]);if(b.type==='rows')b.items=chosen?[{label:'当前客户',value:chosen.name+' · '+chosen.member_id},{label:'商城归属',value:state.shop},{label:'代理归属',value:backend.member.name+' · '+backend.agent.id},{label:'有效绑定时间',value:dateTimeLabel(chosen.bound_at)},{label:'申请客户迁移',target:'M41'}]:[{label:'客户记录',value:'暂无真实绑定客户'}];}if(!list.length)out.push({type:'notice',title:'暂无匹配客户',body:'当前筛选范围没有已绑定客户。'});}else{const all=data.children||[],list=activeFilter==='同级直推'?all.filter(p=>Number(p.rank_no)===Number(backend.agent.rank_no)):activeFilter==='停用下级'?all.filter(p=>p.status!=='ACTIVE'):all;for(const b of out){if(b.type==='profile'){b.name=backend.member.name;b.subtitle=rankName(backend.agent.rank_no)+' · 代理 '+backend.agent.id;}if(b.type==='tabs')b.items=['直属下级','同级直推','停用下级'];if(b.type==='stats')b.items=[{label:'直属客户',value:(data.customers||[]).length},{label:'直属下级',value:all.length},{label:'有效下级',value:all.filter(p=>p.status==='ACTIVE').length},{label:'本期团队业绩',value:backend.assessment?'¥'+money(backend.assessment.sales||0):'待读取'}];if(b.type==='people')b.items=list.map(p=>[p.name,rankName(p.rank_no)+' · '+p.id,'',label(p.status)]);}out.push({type:'notice',title:'团队展示范围',body:'此处展示当前代理的直属下级关系，经营业绩以真实完成订单扣除退款统计。'});if(!list.length)out.push({type:'notice',title:'暂无匹配下级',body:'当前筛选范围没有代理记录。'});}return out;}
 if(pageId==='M48'){
  const d=backend.settlementAccount,b=d?.body||{},locked=d&&['PENDING','APPROVED'].includes(d.status);for(const block of out){if(block.type==='profile'){block.name=backend.member.name;block.subtitle=d?'账户状态 · '+label(d.status):'请填写本人结算资料';}if(block.type==='options'&&locked){block.type='rows';block.items=[{label:'结算渠道',value:({BALANCE:'系统余额',WECHAT:'微信零钱',BANK:'银行卡'}[b.channel]||b.channel)}];}if(block.type==='fields'){block.items=block.items.filter(x=>form.channel==='银行卡'||x.key==='开户姓名').map(x=>({...x,kind:locked?'readonly':x.key==='开户银行'?'input':x.key==='银行卡号'?'input':x.kind}));}if(block.type==='notice')block.body=d?(d.review_note||'申请由商城拥有者审核，审核通过后可选择该账户提现。'):'账户提交后需要审核；银行卡仅回显尾号，不展示完整卡号。';}
  out.push({type:'rows',title:'已提交结算账户',items:[...(backend.documents.settlement_account||[]).map(x=>({label:({BANK:'银行卡',WECHAT:'微信零钱',BALANCE:'系统余额'}[x.body.channel]||x.body.channel)+' · '+(x.body.bank||x.body.accountName||''),value:label(x.status),target:'settlement-account:'+x.id})),...(!(backend.documents.settlement_account||[]).some(x=>x.status==='PENDING')?[{label:'新增或更换结算账户',value:'填写',target:'settlement-account:NEW'}]:[])]});return out;
 }
 if(pageId==='G60'){const d=backend.decorationSnapshot||backend.storefront?.decoration||{};for(const b of out){if(b.type==='hero'){b.title=form.商城名称||state.shop;b.subtitle=form.品牌标语||'';}if(b.type==='fields')b.items=b.items.filter(i=>i.key!=='主题颜色');if(b.type==='sortable'){b.type='notice';b.title='首页布局';b.body='首页按当前页面布局展示，轮播内容可在上方更新。';}}return out;}
 if(pageId==='G23')for(const b of out){if(b.type==='fields'){b.items=b.items.filter(i=>i.key!=='发货备注');for(const i of b.items)if(i.key==='tracking')i.maxlength=40;}if(b.type==='notice'&&b.title==='发货后通知买家')b.body='当前发货接口保存快递公司和运单号，不支持单独发货备注；操作记录关联订单。';}
 if(pageId==='G15')for(const b of out)if(b.type==='fields')for(const i of b.items)if(i.key==='订单备注')i.maxlength=200;
 if(pageId==='G36')for(const b of out)if(b.type==='fields')for(const i of b.items)if(i.key==='生效时间'){i.start=shanghaiDate(Date.now());i.end='2100-12-31';i.required=true;}
 if(pageId==='M41')for(const b of out)if(b.type==='fields')for(const i of b.items)if(i.key==='期望生效时间')i.label='期望生效时间（选填，留空立即）';
 if(['G52','G53','G54'].includes(pageId)){
  const tab=activeFilter||form._marketingTab,type=marketingType(pageId,tab),records=(backend.marketingConfigs?.[pageId]||[]).filter(d=>(d.body.type||d.kind)===type);out.push({type:'rows',title:'已保存活动',items:[...records.map(d=>({label:d.body.name||d.id,value:label(d.status),target:'marketing-config:'+d.id})),{label:'新建当前类型活动',value:'填写',target:'marketing-config:NEW'}]});
  if(pageId==='G52'){const combo=['GIFT','EXCHANGE'].includes(type);for(const b of out){if(b.type==='fields'&&b.title==='促销信息')b.items.push({label:combo?'参与门槛商品SKU（逗号分隔，空表示全部）':'促销商品SKU（逗号分隔，空表示全部）',key:'促销商品',kind:'input'});if(b.type==='fields'&&b.title==='叠加规则'&&combo){b.type='notice';b.title='组合活动规则';b.body='赠品/换购按指定商品及门槛计算，优惠在确认订单时核算。';}if(b.type==='product'){const sku=combo?String(form.活动商品||'').trim():String(form.促销商品||'').split(',')[0].trim(),p=products.find(item=>item.id===sku);if(p)Object.assign(b,{id:p.id,product:p,name:p.name,price:money(p.retailPrice??p.price)});else Object.assign(b,{type:'notice',title:sku?'商品编号未匹配':'活动商品预览',body:sku?'请核对当前商城商品SKU：'+sku:combo?'请填写赠品/换购SKU后核对商品。':'促销商品SKU留空时适用全部商品。'});}}
  }
  if(pageId==='G53'){const items=String(form.套餐商品||'').split(/[,，\n]/).map(x=>x.trim()).filter(Boolean).map(x=>{const [id,n='1']=x.split(/[:：]/);return {id:id.trim(),qty:Number(n)}}),sum=items.reduce((s,x)=>{const product=products.find(p=>p.id===x.id);return s+Number(product?.retailPrice??product?.price??0)*x.qty},0);form.原价合计=money(sum);for(const b of out){if(b.type==='hero'){b.title=form.套餐名称||'组合活动';b.subtitle=type==='ADDON'?'满足门槛后加价换购':'指定商品组合优惠';}if(b.type==='productGrid'){b.ids=items.map(x=>x.id);b.products=products.filter(p=>b.ids.includes(p.id)).map(p=>({...p,price:p.retailPrice??p.price}));}if(b.type==='fields')b.items=[{label:'套餐名称',key:'套餐名称',kind:'input',required:true},{label:'商品SKU与数量（每行SKU:数量）',key:'套餐商品',kind:'textarea',required:true},{label:'原价合计（元）',key:'原价合计',kind:'readonly'},{label:type==='ADDON'?'换购金额（元）':'套餐价格（元）',key:'套餐价格',kind:'number'},...(type==='ADDON'?[{label:'门槛金额（元）',key:'活动门槛',kind:'number'}]:[]),{label:'活动库存',key:'活动库存',kind:'number'},{label:'每人限购',key:'每人限购',kind:'number'},{label:'开始时间',key:'开始时间',kind:'date'},{label:'结束时间',key:'结束时间',kind:'date'}];if(b.type==='rows'&&b.title==='加价购规则')b.items=type==='ADDON'?[{label:'门槛',value:'商品实付满¥'+Number(form.活动门槛||0).toFixed(2)},{label:'加价金额',value:'¥'+Number(form.套餐价格||0).toFixed(2)},{label:'换购商品',value:items.map(x=>x.id+' × '+x.qty).join('、')}]:[{label:'组合商品',value:items.map(x=>x.id+' × '+x.qty).join('、')||'请填写商品'}];}}
  if(pageId==='G54'){const b=out.find(x=>x.type==='fields');if(b)b.items.splice(1,0,{label:'开始时间',key:'开始时间',kind:'date'});}
  if(['G52','G53'].includes(pageId))for(const b of out)if(b.type==='fields')for(const i of b.items)if(['活动库存','每人限购'].includes(i.key)){i.label=i.key+'（0表示不限）';i.required=true;}
 }
 if(pageId==='G48'){for(const b of out){if(b.type==='tabs')b.items=['本商城积分规则'];if(b.type==='fields')b.items=b.items.filter(i=>i.key!=='允许跨商城使用');if(b.type==='notice')b.body='此处配置本商城积分。平台积分规则由平台后台维护；商城积分始终仅限本店使用。';}}
 if(pageId==='G51'){for(const b of out)if(b.type==='fields')for(const i of b.items){if(['每人限领','适用商城'].includes(i.key))i.kind='readonly';if(i.key==='优惠金额')i.label=form.优惠券类型==='折扣券'?'折扣（大于0且小于10折）':'优惠金额（元）';}out.push({type:'notice',title:'领取与范围',body:'每人每张券限领1次，仅本商城使用。适用商品填写SKU编号，多个用逗号分隔；全部商品和全部用户表示不限。'});}
 if(pageId==='G18')for(const b of out)if(b.type==='fields')b.items=b.items.filter(i=>i.key!=='启用通知');
 if(pageId==='G21'){const types={'经销商零售':'DEALER_RETAIL','公司直营零售':'DIRECT_RETAIL','代理采购':'AGENT_PURCHASE','批发补货':'WHOLESALE','整箱直发':'DIRECT_SHIP'};for(const b of out){if(b.type==='options'){b.items=Object.keys(types);b.items.unshift('全部类型');}if(b.type==='orderList')b.orders=(backend.management.G21||[]).filter(o=>!types[form.orderType]||o.order_type===types[form.orderType]);}}
 if(pageId==='G04'){const all=backend.shops||[],counties=[...new Set(all.map(s=>s.county).filter(Boolean))],list=all.filter(s=>(!form.shopCounty||form.shopCounty==='全部地区'||s.county===form.shopCounty)&&(!form.shopQuery||[s.name,s.county].join(' ').includes(String(form.shopQuery).trim())));return [{type:'fields',title:'筛选商城',items:[{label:'商城名称或县域',key:'shopQuery',kind:'input'},{label:'所在地区',key:'shopCounty',kind:'select',options:['全部地区',...counties]}]},{type:'stats',items:[{label:'公开商城',value:all.length},{label:'匹配商城',value:list.length},{label:'当前管理商城',value:state.shop}]},{type:'rows',title:'商城列表',items:list.length?list.map(s=>({label:s.name,value:s.county||'地区未配置',target:'shop-details:'+s.id})):[{label:'查询结果',value:'暂无匹配商城'}]},{type:'notice',title:'商城管理范围',body:'当前账号管理 '+state.shop+'，其他商城仅显示公开资料；独立开店申请由平台审核。'},{type:'rows',items:[{label:'当前商城经营台',target:'G03'},{label:'开店申请与进度',target:'G05'},{label:'当前商城转移/合并/停业',target:'G06'}]}];}
 if(pageId==='G05'){const list=backend.management.G05||[],d=list.find(x=>x.id===backend.selectedDocuments?.G05)||list[0],b=d?.body||{};return [{type:'notice',title:d?label(d.status):'暂无独立商城申请',body:'开店资格及商户主体由平台后台审核，当前页面用于查看真实申请与处理进度。'},{type:'rows',title:'申请信息',items:d?[{label:'申请编号',value:d.id},{label:'申请人',value:b.representative||b.name||'会员 '+d.member_id},{label:'申请商城',value:b.name||'—'},{label:'所属县域',value:b.county||'—'},{label:'主体名称',value:b.company||b.主体名称||'—'},{label:'提交时间',value:d.created_at},{label:'处理意见',value:d.review_note||'等待平台审核'}]:[]},{type:'rows',title:'申请材料',items:(b.uploads||[]).map((id,i)=>({label:'主体资质 '+(i+1),value:'查看',target:'view-proof:'+id}))},{type:'rows',title:'选择申请记录',items:list.map(x=>({label:x.body.name||x.id,value:label(x.status),target:'document-select:'+x.id}))}];}
 if(pageId==='M32'){const a=backend.agent,d=backend.documents.agent_application?.[0];if(!a||a.status!=='ACTIVE')return [{type:'notice',title:d?label(d.status):'尚未获得本商城代理身份',body:d?.review_note||'请查看申请进度，审核通过后才能进入代理中心。'},{type:'rows',items:[{label:'查看申请进度',target:'M31'}]}];return [{type:'success',title:'代理身份已生效',body:backend.member.name+'，欢迎加入'+state.shop},{type:'rows',title:'代理信息',items:[{label:'代理编号',value:a.id},{label:'代理身份',value:({1:'云代理',2:'分货中心',3:'总代理'}[a.rank_no]||'代理')},{label:'所属商城',value:state.shop},{label:'直接上级编号',value:a.parent_id||'无'},{label:'生效时间',value:a.approved_at||a.created_at?dateTimeLabel(a.approved_at||a.created_at):'以审核记录为准'}]}];}
 if(pageId==='M34'){if(!backend.agent)return [{type:'notice',title:'申请代理后可分享邀请',body:'审核通过的代理才能创建专属邀请。'},{type:'rows',items:[{label:'申请代理',target:'M30'}]}];const invite=backend.activeInvite;return [{type:'hero',title:'分享真实商城邀请',subtitle:backend.member.name+' · '+state.shop,asset:'hero'},{type:'rows',title:'邀请信息',items:[{label:'邀请人',value:backend.member.name},{label:'代理编号',value:backend.agent.id},{label:'所属商城',value:state.shop},{label:'有效期至',value:invite?dateTimeLabel(invite.expiresAt):'等待生成'},{label:'邀请链接',value:invite?'/pages/M35/index?shop='+invite.shopId+'&invite='+invite.invite:'尚未生成',target:invite?'share':undefined}]},{type:'notice',title:'首次授权归属',body:'点击分享复制专属邀请链接，好友打开后可先核对真实邀请人和商城。已绑定客户的归属保持锁定。'}];}
 if(pageId==='M35'){const c=backend.invitationContext;if(!c)return [{type:'notice',title:'正在核对邀请信息',body:'请稍候或重新打开邀请链接'}];const inviter=c.bound?c.currentBinding:c.inviter;return [{type:'relation',items:[c.shop?.name||state.shop,inviter?.name||'归属待核对']},{type:'notice',title:c.bound?'当前客户归属已锁定':c.valid?'请确认授权绑定':c.reason||'邀请链接不可用',body:c.bound?'您已有有效客户归属，再次打开邀请不会改变商城和代理。':c.valid?'确认后绑定下方商城和代理，首次有效归属生效后保持锁定。':'该链接不能建立新的归属，请返回原商城。'},{type:'rows',title:c.bound?'当前归属':'邀请信息',items:[{label:'所属商城',value:c.shop?.name||state.shop},{label:c.bound?'当前代理':'邀请人',value:inviter?.name||'不可用'},{label:'代理编号',value:inviter?.agentId||inviter?.id||'—'},...(!c.bound&&c.expiresAt?[{label:'有效期至',value:dateTimeLabel(c.expiresAt)}]:[])]},...(!c.bound&&c.valid?[{type:'consent',key:'consent',label:'我已阅读并同意《客户归属授权协议》',policyType:'CUSTOMER_AUTHORIZATION'}]:[])];}
 if(pageId==='M26'){
  if(backend.profileError||!form._hydrated||Number(form._profileMemberId)!==Number(backend.member?.id))return [{type:'notice',title:'个人资料读取失败',body:backend.profileError||'请重新读取个人资料'}]
  for(const b of out){if(b.type==='profile'){b.name=form.name||backend.profile?.name||'微信用户';b.avatar=form.avatarId||'avatar';b.privateAvatar=!!form.avatarId;b.editableAvatar=true}if(b.type==='fields')b.items=profileFields()}
  return out
 }
 if(pageId==='G07'){const m=backend.merchant||{},timeline=out.find(b=>b.type==='timeline');if(timeline)timeline.active=m.paymentReady?3:m.applicationStatus==='VERIFIED'?2:m.applicationStatus==='PENDING'?1:0;if(localSandbox()&&m.sandboxReady===true)out.unshift({type:'notice',title:'本地模拟已就绪，正式渠道待配置',body:'仅本地沙盒订单、退款与提现联调可用；正式进件、微信支付及商家转账仍待配置。',tone:'orange'});out.push({type:'rows',title:'进件状态',items:[{label:'主体进件',value:merchantStatus(m.applicationStatus)},{label:'法人',value:m.legalRepresentative||'尚未提交'},{label:'统一社会信用代码',value:m.licenseNo||'尚未提交'},{label:'联系人手机',value:m.contactPhone||'尚未提交'},{label:'渠道申请编号',value:m.applicationRef||'待补，暂不可核验'},{label:'AppID 授权',value:merchantStatus(m.authorizationStatus),target:'G08'},{label:'收款权限',value:m.paymentReady?'已开通':'待渠道核实'},...(m.rejectionReason?[{label:'驳回原因',value:m.rejectionReason}]:[])]});return out;}
 if(pageId==='G08'){const m=backend.merchant||{},stats=out.find(b=>b.type==='stats');if(stats){stats.items[0].value=merchantStatus(m.applicationStatus);stats.items[1].value=merchantStatus(m.authorizationStatus)}if(localSandbox()&&m.sandboxReady===true)out.unshift({type:'notice',title:'本地模拟已就绪，正式渠道待配置',body:'仅本地沙盒订单、退款与提现联调可用；正式进件、微信支付及商家转账仍待配置。',tone:'orange'});const rows=out.filter(b=>b.type==='rows');rows[0].items=[{label:'商户号',value:m.merchantNo||'尚未登记'},{label:'关联 AppID',value:m.appId||'尚未登记'},{label:'授权凭证',value:m.authorizationRef||'待补，暂不可核验'},{label:'收款权限',value:m.paymentReady?'已开通':'待渠道核实'}];rows[1].items=[{label:'证书序列号',value:m.certificateSerial||'尚未登记'},{label:'证书有效期',value:m.expiresAt?String(m.expiresAt).slice(0,10):'尚未登记'},{label:'证书凭证',value:m.certificateRef||'待补，暂不可核验'},{label:'证书状态',value:merchantStatus(m.certificateStatus)},{label:'签约费率',value:m.contractedFeeBps==null?'尚未登记':Number(m.contractedFeeBps)/100+'%'},{label:'结算周期',value:m.settlementDays==null?'尚未登记':m.settlementDays+'天'},...(m.rejectionReason?[{label:'驳回原因',value:m.rejectionReason}]:[])];const links=out.find(b=>b.type==='links');if(links)links.items=[m.authorizationStatus==='PENDING'?m.authorizationRef?{title:'刷新授权状态',icon:'refresh',target:'merchant-refresh'}:{title:'补录授权凭证',icon:'refresh',target:'merchant-reference:AUTHORIZATION'}:m.applicationStatus!=='VERIFIED'?{title:'先完成主体进件',icon:'shop',target:'G07'}:{title:'提交 AppID 授权',icon:'refresh',target:'authorize'},m.certificateStatus==='PENDING'?m.certificateRef?{title:'刷新证书状态',icon:'refresh',target:'merchant-refresh'}:{title:'补录证书凭证',icon:'shield',target:'merchant-reference:CERTIFICATE'}:{title:'登记证书元数据',icon:'shield',target:'upload-cert'}];return out;}
 if(['G26','G27'].includes(pageId)&&backend.refund){const linked=backend.afterSaleLinks.find(x=>x.customerRefundId===backend.refund.id),candidates=backend.afterSaleCandidates.map(x=>({label:x.wholesaleOrderId,value:'可关联 '+x.availableQty+' 件 · '+label(x.orderStatus),target:'direct-candidate:'+x.wholesaleOrderId}));if(linked&&!candidates.some(x=>x.label===linked.wholesaleOrderId))candidates.unshift({label:linked.wholesaleOrderId,value:'已关联 · 查看公司售后',target:'G28'});if(candidates.length)out.push({type:'rows',title:'匹配的整箱直发采购 · 进入关联',items:candidates});if(backend.afterSaleCandidateError)out.push({type:'notice',title:'直发采购候选未读取',body:backend.afterSaleCandidateError});}
 if(pageId==='M27'){const names={USER_AGREEMENT:'用户协议',PRIVACY_POLICY:'隐私政策',THIRD_PARTY_SHARING:'第三方共享清单'},policies=backend.policies||{},consents=backend.consents||[];const rows=out.filter(b=>b.type==='rows');rows[0].items=[{label:'手机号用途',value:backend.member?.phone?'已授权':'未授权'},{label:'收货地址',value:state.addresses.length?'已提供':'未提供'}];rows[1].items=Object.entries(names).map(([type,name])=>{const doc=policies[type],consent=consents.find(c=>c.type===type&&c.version===doc?.version);return {label:name,value:doc?doc.version+(consent?' · 已同意':' · 未同意'):'尚未发布',target:doc?'policy:'+type:undefined}});return out;}
 if(['M20','M21'].includes(pageId)&&state.directAfterSale&&state.directAfterSale.wholesaleOrderId===state.activeOrder)out.unshift({type:'notice',title:'公司批发采购售后',body:'当前针对采购订单 '+state.directAfterSale.wholesaleOrderId+' 向公司发起售后，提交后将关联原客户售后。',tone:'orange'});
 if(pageId==='G28'){
  const link=(backend.afterSaleLinks||[]).find(x=>x.customerRefundId===backend.refund?.id);
  if(backend.refund?.refund_type!=='EXCHANGE'&&!link&&!backend.afterSaleCandidates.length)return [{type:'notice',title:'暂无可关联的整箱直发售后',body:'当前售后单没有匹配的直发采购订单；请从售后列表选择对应申请。'},{type:'rows',items:[{label:'返回售后列表',value:'查看',target:'G25'}]}];
  const tabs=out.find(b=>b.type==='tabs'),relation=out.find(b=>b.type==='relation'),rows=out.find(b=>b.type==='rows'),timeline=out.find(b=>b.type==='timeline'),fields=out.find(b=>b.type==='fields');
  if(tabs&&(link||backend.afterSaleCandidates.length))tabs.items=['整箱直发关联','换货售后'];
  if(relation)relation.items=[backend.refund?.order_id||'客户订单待确认',link?.wholesaleOrderId||'采购订单未关联',link?.wholesaleRefundId||'公司售后单未关联'];
  if(rows)rows.items=[{label:'客户售后单',value:backend.refund?.id||'—'},{label:'客户订单',value:link?.customerOrderId||backend.refund?.order_id||'—'},{label:'采购订单',value:link?.wholesaleOrderId||'未关联'},{label:'公司售后单',value:link?.wholesaleRefundId||'未关联'},{label:'公司售后状态',value:link?.wholesaleRefundStatus||'暂无'}];
  if(timeline){timeline.items=['客户申请 · '+label(backend.refund?.status),link?'关联采购 · '+link.wholesaleOrderId:'待关联采购订单',link?.wholesaleRefundId?'公司售后 · '+(link.wholesaleRefundStatus||'处理中'):'待关联公司售后',backend.refund?.status==='CLOSED'?'客户确认完成':'等待客户确认'];timeline.active=link?.wholesaleRefundId?2:link?1:0}
  if(fields){fields.title=activeFilter==='整箱直发关联'?'关联公司采购及售后':'换货履约';fields.items=activeFilter==='整箱直发关联'?[{label:'公司批发采购订单号',key:'wholesaleOrderId',kind:'readonly',required:true},{label:'公司售后单号（已创建时填写）',key:'wholesaleRefundId',kind:'input'}]:fields.items;if(activeFilter!=='整箱直发关联'&&backend.refund?.status!=='WAIT_EXCHANGE')fields.items=fields.items.map(item=>({...item,kind:'readonly'}));}
  if(backend.refund?.refund_type==='EXCHANGE'&&!link&&!backend.afterSaleCandidates.length&&activeFilter!=='整箱直发关联'){
   const returned=displayJson(backend.refund.return_json)||{},shipped=displayJson(backend.refund.exchange_json)||{},status=backend.refund.status;
   if(relation)relation.items=['旧货寄回 · '+(returned.tracking||'待填写'),'商家验收 · '+(status==='WAIT_RETURN'?'待验收':'已完成'),'新货发出 · '+(shipped.tracking||'待发货')];
   if(rows){rows.title='换货单据';rows.items=[{label:'客户售后单',value:backend.refund.id},{label:'原订单',value:backend.refund.order_id},{label:'旧货运单',value:returned.tracking||'待填写'},{label:'验收合格',value:backend.refund.restock_qty??'待验收'},{label:'新货运单',value:shipped.tracking||'待发货'}];}
   if(timeline){timeline.items=['旧货寄回','商家验收','新货发出','客户确认'];timeline.active=({WAIT_RETURN:0,WAIT_EXCHANGE:1,EXCHANGE_SHIPPED:2,CLOSED:3}[status]??0);}
   const notice=out.find(b=>b.type==='notice'&&b.title.includes('整箱直发'));
   if(notice){notice.title='换货库存处理';notice.body='合格旧货按验收数量回库，换出新货发货时扣减库存；本单不需要关联批发采购。';}
  }
  if(activeFilter==='整箱直发关联'){
   out.push({type:'rows',title:'可关联直发采购订单',items:backend.afterSaleCandidates.map(x=>({label:x.wholesaleOrderId,value:'可关联 '+x.availableQty+' 件 · '+label(x.orderStatus),target:'direct-candidate:'+x.wholesaleOrderId}))});
   if(backend.afterSaleCandidateError)out.push({type:'notice',title:'采购候选未读取',body:backend.afterSaleCandidateError});
   const canApply=link?.wholesaleOrderId&&Number(link.wholesaleBuyerId)===Number(backend.member?.id);
   out.push({type:'rows',title:'公司售后操作',items:link?.wholesaleOrderId?[{label:'向公司申请采购售后',value:link.wholesaleRefundId?'已创建 · '+link.wholesaleRefundId:canApply?'前往申请':'请由采购人本人申请，完成后关联售后单号',target:!link.wholesaleRefundId&&canApply?'direct-wholesale-refund':undefined}]:[{label:'下一步',value:'先关联公司批发采购订单'}]});
  }
  return out;
 }



 if(pageId==='G55'){
  const q=backend.marketingPreview,p=backend.previewCatalog.find(p=>p.id===String(form.previewSku||'').split(' · ')[0]);for(const b of out){if(b.type==='product'){b.product=p?{...p,price:q?Math.round(q.subtotal/Number(form.previewQty)):p.retail}:null;b.id=p?.id;b.price=q?money(q.subtotal/Number(form.previewQty)):'待核算';b.qty=Number(form.previewQty)||1;}if(b.type==='table')b.rows=q?[['商品金额',money(q.subtotal)],['活动优惠','−'+money(q.promotionDiscount)],['优惠券','−'+money(q.couponDiscount)],['积分抵扣','−'+money(q.pointsDiscount)],['运费',money(q.freight)],['最终应付',money(q.total)]]:[['填写条件后点击核算','—']];if(b.type==='stats')b.items=[{label:'商品实付',value:q?money(q.productPaid):'—'},{label:'历史口径成本',value:q?money(q.cost):'—'},{label:'价差毛利',value:q?money(q.margin):'—'}];if(b.type==='notice'){b.title=q?'金额校验通过':'等待核算';b.body=q?'已按所选客户的实际职级、商品价格、活动、优惠券、积分和运费规则校验，未创建订单或占用库存。':'选择真实客户和商品，地址地区用于偏远运费核算。';}if(b.type==='checklist')b.items=q?['优惠与叠加规则已核对','积分可用余额和抵扣上限已核对','库存、起订量及分红承担已校验']:['等待服务端核算结果'];}
  out.splice(1,0,{type:'fields',title:'试算条件',items:[{label:'试算客户',key:'previewCustomer',kind:'select',options:backend.previewCustomers.map(x=>x.member_id+' · '+x.name)},{label:'试算商品',key:'previewSku',kind:'select',options:backend.previewCatalog.filter(x=>x.status==='ACTIVE').map(x=>x.id+' · '+x.name)},{label:'购买数量',key:'previewQty',kind:'number'},{label:'使用优惠券',key:'previewCoupon',kind:'select',options:['不使用优惠券',...(currentMarketingBuyer(form)?.coupons||[]).filter(x=>x.kind==='coupon_claim'&&x.status==='AVAILABLE').map(x=>x.id+' · '+x.body.name)]},{label:'积分类型',key:'previewScope',kind:'select',options:['平台积分','商城积分']},{label:'抵扣积分数',key:'previewPoints',kind:'number'},{label:'收货地区',key:'previewRegion',kind:'text'}]});return out;
 }
 if(pageId==='G61'){
  const permissions={OWNER:['本商城全部岗位业务（平台全局权限除外）'],CATALOG:['商品、分类、运费与营销配置'],ORDER:['订单查看与发货'],FINANCE:['收益、提现审核、积分与对账'],WAREHOUSE:['库存、盘点、发货与验收'],SUPPORT:['订单与售后处理'],OPERATOR:['客户与代理查看、营销及经营分析']};for(const b of out){if(b.type==='options')b.items=Object.keys(operationRoles);if(b.type==='checklist'){b.editable=false;b.items=permissions[operationRoles[form.role]]||[];}if(b.type==='fields')b.items=[{label:'后台登录账号',key:'staffLogin',kind:'text'},{label:'启用本商城岗位',key:'staffEnabled',kind:'switch'},{label:'变更原因',key:'staffReason',kind:'textarea',required:true}];if(b.type==='notice')b.body='为已有后台账号分配本商城岗位，停用仅撤销该商城权限。平台管理员及新后台账号由平台账号管理维护。';}
  out.push({type:'rows',title:'核对账号',items:[{label:'查询完整登录账号',value:'核对',target:'staff-lookup'},...(backend.staffLookup?[{label:'后台账号编号',value:backend.staffLookup.user_id},{label:'账号昵称',value:backend.staffLookup.nick_name},{label:'全局账号状态',value:backend.staffLookup.status==='0'?'正常':'已停用'}]:[])]},{type:'rows',title:'当前岗位名单',items:backend.staffAccounts.map(x=>({label:x.nick_name+' · '+x.user_name,value:Object.keys(operationRoles).find(k=>operationRoles[k]===x.role_code)||x.role_code,target:'staff-open:'+x.user_id}))});return out;
 }
 if(pageId==='G62'){
  const category=x=>/WITHDRAW|PAYOUT|REFUND|RECON|ADJUST|POINT/.test(x)?'资金':/AGENT|MIGRAT|PROMOT|DOWNGRADE|BIND|LINK_RELATION/.test(x)?'代理':/STOCK|INVENTORY|SHIP|INSPECT/.test(x)?'库存':'配置';const list=(backend.management.G62||[]).filter(x=>!activeFilter||activeFilter==='全部'||category(x.action)===activeFilter),selected=backend.auditDetail;for(const b of out){if(b.type==='ledger')b.items=list.map(x=>[x.actorName+' · '+x.action,x.reference_id+' · '+dateTimeLabel(x.created_at),category(x.action),'audit-open:'+x.id]);if(b.type==='rows')b.items=selected?[{label:'操作人',value:selected.actorName+' · '+selected.actor_kind},{label:'操作来源',value:({APP:'商城管理端',ADMIN:'平台后台',SYSTEM:'系统任务'}[selected.source]||'旧记录未采集')},{label:'请求编号',value:selected.request_id||'无请求编号'},{label:'操作IP',value:selected.ip_masked||'旧记录未采集'},{label:'关联单据',value:selected.reference_id},{label:'执行时间',value:dateTimeLabel(selected.created_at)}]:[{label:'查看真实变更详情',value:'请选择上方记录'}];}if(selected)out.push({type:'notice',title:'修改前（敏感字段已脱敏）',body:JSON.stringify(selected.before,null,2)},{type:'notice',title:'修改后（敏感字段已脱敏）',body:JSON.stringify(selected.after,null,2)});return out;
 }
 if(pageId==='G41'){
  const list=backend.ruleVersions?.rules||[],current=list.find(x=>timestamp(x.effective_at)<=Date.now());return [{type:'rows',title:'当前分红版本',items:current?[{label:'版本编号',value:current.id},{label:'云代理同级比例',value:(current.cloud_bps/100)+'%'},{label:'分货中心同级比例',value:(current.center_bps/100)+'%'},{label:'总代理同级比例',value:(current.owner_bps/100)+'%'},{label:'承担方',value:'订单所属商城拥有者'},{label:'生效时间',value:dateTimeLabel(current.effective_at)}]:[{label:'当前版本',value:'正在读取'}]},{type:'rows',title:'已发布版本',items:list.map(x=>({label:'版本 '+x.id+' · '+x.cloud_bps/100+'% / '+x.center_bps/100+'% / '+x.owner_bps/100+'%',value:dateTimeLabel(x.effective_at)}))},{type:'notice',title:'新旧订单独立',body:'平台后台发布分红版本，生效后新订单采用新规则，旧订单及退款继续按下单快照执行。'}];
 }
 if(pageId==='G64'){
  for(const b of out){if(b.type==='fields'&&b.title==='交易参数')b.items=b.items.filter(x=>!['最低提现（元）','提现手续费（%）'].includes(x.key));if(b.type==='notice')b.body='交易期限仅用于新订单；消息开关控制对应站内业务通知，历史消息保留原内容。提现最低1元、手续费0.6%。';}
  out.push({type:'fields',title:'站内消息模板',items:[{label:'触发事件',key:'templateEvent',kind:'select',options:Object.keys(notificationEvents)},{label:'消息标题（可不填）',key:'templateTitle',kind:'text'},{label:'通知内容',key:'templateContent',kind:'textarea'}]},{type:'notice',title:'发送时自动填写',body:'在标题或通知内容中写入【商城名称】【关联单号】【业务说明】，发送时会替换成这条消息的实际信息。'},{type:'rows',title:'模板操作',items:[{label:'保存所选事件的新模板',value:'保存',target:'template-save'},...backend.notificationTemplates.filter(x=>x.status==='ACTIVE').map(x=>({label:Object.keys(notificationEvents).find(k=>notificationEvents[k]===x.body.event)||x.body.event,value:x.body.name||'查看',target:'template-open:'+x.id}))]});return out;
 }
 if(['G58','G59'].includes(pageId)){
  if(backend.reportErrors[pageId])return [{type:'notice',title:'报表读取失败',body:backend.reportErrors[pageId]}];
  const r=backend.reports?.[pageId],done=r?.status==='COMPLETED'&&!!r.summary,sum=done?r.summary:{},data=done?r.rows||[]:[],trend=done?(r.trend||[]).slice(-7):[];for(const b of out){
   if(b.type==='stats'){const values=pageId==='G58'?[['团队净销售额',money(sum.net_sales)],['有效订单',sum.orders||0],['成交代理',done?r.totalGroups:0],['客户复购率',((sum.repeatBps||0)/100).toFixed(2)+'%']]:[['净销售额',money(sum.net_sales)],['净销售件数',sum.quantity||0],['客单价',money(sum.orders?Math.round(sum.net_sales/sum.orders):0)],['商品退款率',((sum.gross_sales?sum.refunds/sum.gross_sales:0)*100).toFixed(2)+'%']];b.items=values.map(x=>({label:x[0],value:x[1]}));}
   if(b.type==='chart'){b.title='净销售额趋势';b.periodLabel=r?.trendGrain==='MONTH'?'最近7个月度统计点':'最近7个日统计点';b.values=trend.map(t=>Number(t.net_sales)/Math.max(1,...trend.map(x=>Number(x.net_sales)))*95);b.actualValues=trend.map(t=>money(t.net_sales));b.labels=trend.map(t=>t.day.slice(5));}
   if(b.type==='people')b.items=data.map((x,i)=>[x.agent_name||'历史代理',x.agent_id+' · '+({1:'云代理',2:'分货中心',3:'总代理'}[x.rank_no]||'未记录职级'),'¥'+money(x.net_sales),'有效订单 '+x.orders+' · 净销量 '+x.quantity]);
   if(b.type==='productList'){b.type='rows';b.title='经营明细';b.items=data.map(x=>({label:x.sku_name||x.buyer_name||x.order_id,value:'¥'+money(x.net_sales)+' · '+x.quantity+'件'}));}
   if(b.type==='rows'&&b.title==='报表操作')b.items=[{label:'导出当前维度全部结果',value:'CSV',target:'export'},{label:'导出全部库存与周转',value:'CSV',target:'report-inventory'}];
  }
  out.splice(1,0,{type:'fields',title:'统计条件',items:[{label:'开始日期',key:'reportFrom',kind:'date'},{label:'结束日期',key:'reportTo',kind:'date'},{label:'代理编号（0为全部）',key:'reportAgent',kind:'number'},{label:'客户编号（0为全部）',key:'reportCustomer',kind:'number'},{label:'商品编号',key:'reportSku',kind:'text'},{label:'订单历史职级',key:'reportRank',kind:'select',options:['全部职级','云代理','分货中心','总代理']},{label:'包含历史下级团队',key:'includeTeam',kind:'switch'}]},{type:'rows',title:'报表任务',items:[{label:'按以上条件生成',value:'生成报表',target:'report-generate'},{label:'任务进度',value:r?label(r.status)+' '+(r.progress||0)+'%':'尚未生成',target:'report-refresh'},...(r?[{label:'统计区间',value:r.filters.from+' 至 '+r.filters.to},{label:'已处理明细',value:r.processed_rows+' / '+r.total_rows}]:[])]});
  if(r?.status==='FAILED')out.push({type:'notice',title:'报表生成失败',body:r.error_message});
  if(done){out.push({type:'rows',title:'结果分页 · 共'+r.totalGroups+'项',items:[...(backend.reportPages[pageId]>1?[{label:'上一页',target:'report-prev'}]:[]),...((backend.reportPages[pageId]||1)*20<r.totalGroups?[{label:'下一页',target:'report-next'}]:[]),{label:'导出本维度全部数据',value:'CSV',target:'export'}]},{type:'notice',title:'统计口径',body:'商品实付扣除退款，采用订单历史关系；快照生成后发生的退款需重新生成报表。库存按所选商城全量统计，个人业绩筛选不缩小实存库存。'});}
  if(backend.reportJobs?.length)out.push({type:'rows',title:'最近报表',items:backend.reportJobs.slice(0,5).map(j=>({label:j.filters.from+' 至 '+j.filters.to,value:label(j.status),target:'report-open:'+j.id}))});return out;
 }
 if(pageId==='M52'){const t=state.pendingTransfer;if(!t)return [{type:'notice',title:'尚未选择接收人',body:'请先填写积分转赠信息'}];for(const b of out){if(b.type==='profile'){b.name=t.recipientName||'接收人待核对';b.subtitle=t.phone.replace(/(\d{3})\d{4}(\d{4})/,'$1****$2');}if(b.type==='rows'){const balance=t.type==='商城积分'?state.shopPoints:state.points;b.items=b.title?[{label:t.blockedReason?'实际转出':'本次拟转出',value:t.blockedReason?'0':'−'+t.amount},{label:'拟接收用户',value:t.recipientName},{label:'关联号',value:t.blockedReason?'未生成':'实际转赠成功后生成'}]:[{label:'转赠积分类型',value:t.type},{label:'转赠数量',value:t.amount},{label:'当前可用积分',value:balance},{label:'状态',value:t.blockedReason?'已拦截，本次未扣除':'待您确认'}];}if(b.type==='notice'&&t.blockedReason){b.title='转赠已拦截';b.body=t.blockedReason;}}}
 if(pageId==='G47'){const list=backend.management.G47||[],p=list.find(x=>Number(x.member_id)===Number(state.selectedPointMember))||list[0];if(!p)return [{type:'notice',title:'暂无商城积分账户',body:'用户获得本商城积分后会在此显示，平台积分由平台后台独立管理。'}];for(const b of out){if(b.type==='search')b.placeholder='输入用户昵称或会员编号';if(b.type==='tabs')b.items=['商城积分'];if(b.type==='profile'){b.name=p.name;b.subtitle='会员 '+p.member_id+' · '+state.shop;}if(b.type==='stats')b.items.forEach((x,i)=>x.value=[p.frozen?0:p.available,p.frozen?p.available:0,p.pending_reclaim][i]);if(b.type==='rows')b.items=[{label:'流水累计收入',value:p.gained},{label:'流水累计支出',value:p.used},{label:'累计到期',value:p.expired||0},{label:'30天内到期',value:p.expiring||0},{label:'账户状态',value:p.frozen?'已冻结':'正常'}];}out.push({type:'rows',title:'选择积分账户',searchable:true,emptyText:'暂无符合条件的积分账户',items:list.map(x=>({label:x.name+' · '+x.member_id,value:x.frozen?'已冻结':x.available+'积分',target:'point-member:'+x.member_id}))});}
 if(pageId==='G49'){const list=backend.management.G49||[],t=list.find(x=>x.reference_id===backend.selectedPointTransfer)||list[0];for(const b of out){if(b.type==='stats')b.items.forEach((x,i)=>x.value=i?backend.pointTransferSummary?.amount||0:backend.pointTransferSummary?.transfers||0);if(b.type==='rows')b.items=t?[{label:'关联号',value:t.reference_id},{label:'积分类型',value:state.shop+' · 商城积分'},{label:'转出用户',value:t.sender_name+' · '+t.sender_id},{label:'转出记录',value:'−'+t.amount},{label:'接收用户',value:t.recipient_name+' · '+t.recipient_id},{label:'转入记录',value:'+'+t.credit},{label:'处理状态',value:t.amount===t.credit?'双方已入账':'金额差异待核验'}]:[{label:'转赠记录',value:'暂无商城积分转赠'}];if(b.type==='ledger')b.items=list.map(x=>[x.sender_name+' → '+x.recipient_name,x.reference_id+' · '+x.created_at,String(x.amount),'point-transfer:'+x.reference_id]);}}
 if(pageId==='G50'){for(const b of out){if(b.type==='fields'&&b.title==='转赠风控'){b.items=b.items.filter(x=>x.key!=='商城积分仅限同店');b.items.splice(2,0,{label:'月累计上限',key:'月累计上限',kind:'number'},{label:'启用转赠频率限制',key:'frequencyEnabled',kind:'switch'});b.items.push({label:'短时窗口（秒）',key:'windowSeconds',kind:'number'},{label:'短时最多次数',key:'windowCount',kind:'number'});}if(b.type==='fields'&&b.title==='预警通知'){b.type='notice';b.title='冻结通知';b.body='触发冻结后发送站内消息，复核解冻不清零日累计和频率计数。';}if(b.type==='notice'&&b.tone==='orange')b.body='平台与商城积分独立限制。超过频率上限时，本次不扣款；启用自动冻结后须管理人员复核解除。';if(b.type==='rows')b.items=(backend.pointRiskCases||[]).map(x=>({label:x.name+' · '+x.reason,value:label(x.status),target:['PENDING','RETAINED'].includes(x.status)?'point-thaw:'+x.id:undefined}));}out.push({type:'fields',title:'冻结复核',items:[{label:'复核依据（填写后点击待复核记录解冻）',key:'复核依据',kind:'textarea'}]});}
 if(pageId==='G09'){for(const b of out){if(b.type==='productList'){b.products=(backend.catalog||[]).filter(p=>!activeFilter||activeFilter==='全部'||({'在售':'ACTIVE','待上架':'PENDING','已下架':'INACTIVE'}[activeFilter]===p.status)).map(p=>({...p,price:p.retail,stock:p.available,desc:p.spec,badge:({ACTIVE:'在售',PENDING:'待审核',INACTIVE:'已下架',REJECTED:'已驳回',FROZEN:'已冻结'})[p.status]||p.status}));b.productAction='catalog-edit:';b.ids=b.products.map(p=>p.id);b.emptyText='暂无符合条件的商品';b.privateProductAssets=true;}if(b.type==='rows')for(const row of b.items)if(row.target==='G11')row.value=(backend.catalog||[]).filter(p=>p.status==='PENDING').length+' 待审核';}}
 if(pageId==='G10'){
  for(const b of out){if(b.type==='upload')b.existingAsset=backend.editProduct&&!String(backend.editProduct.asset||'').startsWith('FILE')?backend.editProduct.asset||'':'';if(b.type==='fields'&&b.title==='商品信息'){b.items.find(x=>x.key==='商品分类').options=backend.catalogSettings?.categories||[];b.items.find(x=>x.key==='商品编码').kind=backend.editProduct?'readonly':'text';b.items.push({label:'商品组编码（同组可选规格）',key:'productGroup',kind:'text'});for(const [key,maxlength] of Object.entries({商品名称:160,商品编码:64,productGroup:64}))b.items.find(x=>x.key===key).maxlength=maxlength;}if(b.type==='table'){b.rows=[[form.规格,form.retail,form.cloud,form.center,form.owner]];b.editKeys=['规格','retail','cloud','center','owner'];b.disabledKeys=backend.editProduct?.standard?['cloud','center','owner']:[];}if(b.type==='fields'&&b.title==='库存与履约'){b.items.find(x=>x.key==='运费模板').options=['默认模板',...(backend.freightTemplates||[]).map(d=>d.id+' · '+(d.body.name||'模板'))];b.items.find(x=>x.key==='商品详情').maxlength=10000;b.items.push({label:'单件重量（克）',key:'weightGrams',kind:'number'},{label:'库存调整原因',key:'stockReason',kind:'textarea'});}}
  if(backend.editProduct)out.push({type:'notice',title:label(backend.editProduct.status),body:backend.editProduct.standard?'总部标准商品职级价由平台维护。库存修改须填写原因，库存变化时请重新读取。':'自建商品保存后须经平台审核，才会在用户商城展示。'});
 }
 if(pageId==='G11'){const pending=(backend.catalog||[]).filter(p=>['PENDING','REJECTED','FROZEN'].includes(p.status)),p=pending.find(x=>x.id===backend.reviewSku)||pending[0];if(!p)return [{type:'notice',title:'暂无待审核商品',body:'商家提交自建商品后在这里展示，平台后台进行审核。'}];for(const b of out){if(b.type==='notice'&&b.tone==='orange'){b.title=label(p.status);b.body=state.shop;}if(b.type==='product')Object.assign(b,{product:{...p,price:p.retail},name:p.name,price:money(p.retail),target:'catalog-edit:'+p.id,privateProductAssets:true});if(b.type==='rows')b.items=[{label:'商品编号',value:p.id},{label:'规格',value:p.spec},{label:'分类',value:p.category||'未分类'},{label:'零售价',value:'¥'+money(p.retail)},{label:'云 / 中心 / 总代价',value:[p.cloud_price,p.center_price,p.owner_price].map(money).join(' / ')},{label:'实际可售库存',value:p.available},{label:'审核状态',value:label(p.status)}];}out.push({type:'rows',title:'选择提报商品',items:pending.map(x=>({label:x.name,value:label(x.status),target:'catalog-review:'+x.id}))});}
 if(pageId==='G12'){for(const b of out){if(b.type==='sortable')b.items=form.sortOrder||[];if(b.type==='fields'){b.items.find(x=>x.key==='计费方式').options=['固定运费','按件','按重量'];b.items.push({label:'首件单位（按重量填克）',key:'firstUnits',kind:'number'},{label:'续件单位（按重量填克）',key:'stepUnits',kind:'number'},{label:'偏远省市（逗号分隔）',key:'remoteRegions',kind:'textarea'});}if(b.type==='notice')b.body='每种模板分别合并计费。包邮门槛按优惠后商品金额计算；配置的偏远地区附加费仍保留，积分不抵扣运费。';}out.splice(1,0,{type:'fields',title:'分类名称与顺序',items:[{label:'商品分类（每行一个）',key:'categoryNames',kind:'textarea'}]});out.push({type:'rows',title:'选择运费模板',items:[...(backend.freightTemplates||[]).map(d=>({label:d.body.name||d.id,value:d.id,target:'freight-select:'+d.id})),{label:'新增运费模板',value:'添加',target:'freight-select:NEW'}]});}
 if(pageId==='G13'){const p=backend.boxProduct;if(!p)return [{type:'notice',title:'暂无可配置商品',body:'请先新增商品SKU'}];for(const b of out){if(b.type==='product')Object.assign(b,{product:{...p,price:p.retail},name:p.name,price:money(p.retail),target:'catalog-edit:'+p.id,privateProductAssets:true});if(b.type==='fields'){b.items=b.items.filter(x=>x.key!=='混批范围');b.items.push({label:'最低件数',key:'minQty',kind:'number'},{label:'允许散卖',key:'allowLoose',kind:'switch'},{label:'混批组编码（空为独立整箱）',key:'mixGroup',kind:'text'},{label:'单件箱容积分',key:'mixUnits',kind:'number'},{label:'每箱容量积分',key:'mixCapacity',kind:'number'},{label:'混批最低箱数',key:'minMixBoxes',kind:'number'});}if(b.type==='rows'){const count=Number(form.boxSize||0)*Number(form.minBoxes||0);b.items=[{label:'独立整箱起订',value:count+'件'},{label:'当前SKU',value:p.id},{label:'混批规则',value:form.混批开关?'同组积分必须整箱，至少 '+form.minMixBoxes+'箱':'逐SKU整箱校验'}];}if(b.type==='notice')b.body='本商城参数作用于本店SKU。公司批发补货的混批开关与分组由平台在总中台商品库配置。';}out.push({type:'rows',title:'选择SKU',items:(backend.catalog||[]).map(p=>({label:p.name,value:p.spec||p.id,target:'catalog-box:'+p.id}))});}

  const shop=backend.shops.find(s=>s.id===backend.shopId);const order=['G26','G27','G28'].includes(pageId)?backend.refundOrder:pageId.startsWith('G')&&pageId!=='G16'?(backend.management[pageId]||[]).find?.(o=>o.id===state.managementOrder):['M23','M24'].includes(pageId)&&backend.refund?state.orders.find(o=>o.id===backend.refund.order_id)||(backend.activeOrder?.id===backend.refund.order_id?backend.activeOrder:null):backend.activeOrder;
  if(['M15','M18','M10','M20','M21','G22','G23','G24'].includes(pageId)&&!order)return [{type:'notice',title:'请先选择订单',body:'请从订单列表选择真实订单后继续操作'}]
  if(pageId==='G23'){const pick=(backend.pickOrders||[]).find(x=>x.orderId===state.managementOrder),status=pick?.pickStatus||'NOT_STARTED';for(const b of out)if(b.type==='checklist'){b.items=pick?.items?.map(i=>i.name+' · '+i.skuId+' × '+i.qty)||['请从订单中心选择待拣货订单'];b.editable=false;b.completed=status==='COMPLETED'}out.push({type:'rows',title:'拣货进度',items:[{label:'状态',value:({NOT_STARTED:'待拣货',IN_PROGRESS:'拣货中',COMPLETED:'已完成'}[status]||status)},{label:'开始拣货',value:'登记',target:status==='NOT_STARTED'&&pick?'pick-start':undefined},{label:'完成拣货',value:'登记',target:status==='IN_PROGRESS'?'pick-complete':undefined},{label:'查看拣货单',value:'查看',target:pick?'pick-print':undefined}]});if(backend.pickPrint?.orderId&&backend.pickPrint.orderId===state.managementOrder){const address=backend.pickPrint.address||{};out.push({type:'rows',title:'拣货单 · '+backend.pickPrint.orderId,items:[{label:'收货人',value:backend.pickPrint.recipient||'—'},{label:'收货地址',value:typeof address==='string'?address:[address.region,address.detail].filter(Boolean).join(' ')||'—'},...(backend.pickPrint.items||[]).map(i=>({label:i.name+' · '+i.skuId,value:i.qty+'件'}))]})}}
 if(['M15','M16','M18','M19','M10','M20','M21','M23','M24','G22','G23','G24','G16'].includes(pageId)&&order){
  for(const b of out){
   if(b.type==='product'&&order.items?.length)Object.assign(b,{id:order.items[0].id,product:reviewLineProduct(order.items[0]),name:order.items[0].name,qty:order.items[0].qty,price:money(order.items[0].unitPrice)});
   if(b.type==='rows')for(const i of b.items){
    if(i.label==='订单编号'){i.value=order.id;if(pageId==='M18')i.wrapIdentifier=true;}
    if(i.label==='订单类型')i.value=({DEALER_RETAIL:'经销商商城零售',DIRECT_RETAIL:'公司直营零售',AGENT_PURCHASE:'代理采购',WHOLESALE:'批发补货',DIRECT_SHIP:'整箱直发',POINTS:'积分兑换'}[order.order_type]||order.order_type);
    if(i.label==='购买客户')i.value=backend.member.name;
    if(i.label==='所属代理')i.value=order.customerAgentName||'以订单绑定快照为准';
    if(['收款商家','所属商城','商户主体'].includes(i.label))i.value=order.shop_id===900?'公司批发中台':backend.shops.find(s=>Number(s.id)===Number(order.shop_id))?.name||(Number(order.shop_id)===Number(backend.shopId)?state.shop:'订单所属商城');
    if(i.label==='商城类型')i.value=shop?.kind==='DIRECT'?'公司直营':'经销商商城';
    if(['下单时间','支付时间'].includes(i.label))i.value=i.label==='支付时间'?(order.paid_at?dateTimeLabel(order.paid_at):paidOrderStatuses.includes(order.rawStatus)?'以渠道流水为准':'未付款'):dateTimeLabel(order.created_at);
    if(i.label==='支付方式')i.value=order.order_type==='POINTS'?'平台积分':paidOrderStatuses.includes(order.rawStatus)?'微信支付':'未付款';
    if(['订单金额','实付金额','实付款'].includes(i.label))i.value='¥'+money(order.total);
    if(pageId==='M18'&&i.label==='实付款'&&['UNPAID','CANCELLED'].includes(order.rawStatus))i.label=order.rawStatus==='UNPAID'?'待付金额':'订单金额';
    if(i.label==='商品总额')i.value='¥'+money(order.subtotal);
    if(i.label==='运费')i.value='¥'+money(order.freight);
    if(['收货人','收货地址'].includes(i.label)){const a=JSON.parse(order.address_json||'{}');i.value=i.label==='收货人'?(a.name||'')+' '+displayOrderPhone(a.phone,pageId==='M19'):(a.region||'')+' '+(a.detail||'')}
   }
  }
  if(pageId==='G22'){
   const details=managementSnapshotDetails(order,money),notice=out.find(b=>b.type==='notice');
   if(notice){notice.title=order.status;notice.body=managementOrderNotice(order.rawStatus);}
   const product=out.find(b=>b.type==='product'),line=order.items?.[0];
   if(product&&line)Object.assign(product,{name:line.name,product:{...line,asset:line.asset||'',spec:line.spec||'',price:line.unitPrice}});
   const snapshot=out.find(b=>b.type==='rows'&&b.title==='订单快照');
   if(snapshot)snapshot.items=[{label:'订单编号',value:order.id},{label:'商城拥有者',value:details.owner},{label:'购买人',value:details.buyer},{label:'客户归属',value:details.customer},{label:'同级上级',value:details.peer},{label:'同级分红版本',value:details.rule},{label:'云 / 中心 / 总代价',value:details.prices},{label:'规则生效时间',value:details.ruleEffectiveAt}];
   const amounts=out.find(b=>b.type==='rows'&&b.title==='金额快照');
   if(amounts){const refunded=order.order_type!=='POINTS'&&Number(order.refunded)>0,unpaid=['UNPAID','CANCELLED'].includes(order.rawStatus);amounts.title=refunded?'金额快照与已退款':'金额快照';amounts.items=[{label:'商品总额',value:'¥'+money(order.subtotal)},{label:order.rawStatus==='UNPAID'?'待付金额':unpaid?'订单金额':'实付金额',value:'¥'+money(order.total)},...(refunded?[{label:'已退款',value:'¥'+money(order.refunded)}]:[]),{label:'支付渠道',value:unpaid?'未付款':order.order_type==='POINTS'?'平台积分':'微信支付'}]}
  }
  if(pageId==='M18'&&order.group&&order.group.status!=='FORMED'){const n=out.find(b=>b.type==='notice');if(n){n.title=order.group.status==='FAILED'?'拼团失败':'等待成团';n.body=order.group.status==='FAILED'?'退款已进入处理流程，以渠道回执为准':'成团后商家发货，可进入拼团页查看进度';}}
  if(pageId==='M18'&&!order.group){const notice=out.find(b=>b.type==='notice');if(notice)notice.body=state.cartSyncPendingOrder===order.id?'付款已确认，但购物车尚未同步；请使用下方按钮重试。':state.pendingPaymentOrder===order.id?'支付结果确认中，请刷新服务端状态；未确认前不要重复付款。':({UNPAID:'请在支付期限内完成付款',PAID:'商家正在准备发货',SHIPPED:'商品已发出，可查看物流并确认收货',COMPLETED:'交易已完成，收益已结算',REFUNDED:'退款已处理完成',CANCELLED:'订单已关闭'}[order.rawStatus]||'')}
  if(pageId==='M15'){
   const notice=out.find(b=>b.type==='notice');
   if(notice)Object.assign(notice,paymentNotice(order,form._paymentNow,backend.busy||backend.paymentResultNavigating===order.id,notice.body));
   const amount=out.find(b=>b.type==='amount');
   const merchant=order.shop_id===900?'公司批发中台':backend.shops.find(s=>Number(s.id)===Number(order.shop_id))?.name||state.shop;
   if(amount){amount.value=money(order.total);amount.label=merchant+'商品订单';}
  }
 }
  if(['M19','G24'].includes(pageId)){if(!order)return [{type:'notice',title:'请先选择订单',body:'从订单列表进入对应物流详情'}];const tracking=backend.tracking||{},notice=out.find(b=>b.type==='notice'),trackingStatus={UNAVAILABLE:'承运商轨迹暂不可用',IN_TRANSIT:'运输中',DELIVERED:'已签收',EXCEPTION:'物流异常'}[tracking.status];if(notice){notice.title=pageId==='M19'&&order.rawStatus==='COMPLETED'?'订单已收货':trackingStatus||order.status;notice.body=tracking.tracking?[tracking.carrier,tracking.tracking,pageId==='M19'&&order.rawStatus==='COMPLETED'&&trackingStatus?'承运商轨迹：'+trackingStatus:''].filter(Boolean).join(' · '):pageId==='M19'&&order.rawStatus==='COMPLETED'?'承运商暂无运单信息':'订单尚未发货'}for(const b of out)if(b.type==='rows'){if(pageId==='M19'&&b.title!=='收货信息'){b.title=tracking.carrier||'物流信息';b.items=[{label:'运单号',value:tracking.tracking||(order.rawStatus==='COMPLETED'?'暂无运单信息':'尚未发货')},{label:'承运商电话',value:tracking.contact||'暂未提供'}]}if(pageId==='G24')b.items=[{label:'订单编号',value:order.id},{label:'快递公司',value:tracking.carrier||'尚未发货'},{label:'运单号',value:tracking.tracking||'尚未发货'},{label:'承运商电话',value:tracking.contact||'暂未提供'}]}const timeline=out.find(b=>b.type==='timeline');if(timeline){timeline.items=trackingTimeline(tracking);timeline.active=0}if(pageId==='M19')out.push({type:'rows',title:'操作',items:[{label:'刷新物流轨迹',value:'刷新',target:'tracking-refresh'}]})}
 if(['G14','G15'].includes(pageId)){
  const editing=pageId==='G14',context=editing?state.wholesaleDraft:state.wholesaleContext,source=backend.wholesaleProducts||[]
  const plan=wholesalePagePlan(pageId,form),selected=(context?.lines||[]).map(line=>({sku:source.find(item=>item.id===line.id),qty:editing?form[wholesaleQtyKey(line.id)]??line.qty:line.qty})).filter(line=>line.sku)
  const items=selected.map(({sku,qty})=>({type:'wholesaleItem',product:sku,qty,key:wholesaleQtyKey(sku.id),editable:editing,removable:editing&&selected.length>1}))
  const amount=plan.error?'—':'¥'+money(plan.total)
  if(editing){
   const available=source.filter(sku=>!selected.some(line=>line.sku.id===sku.id))
   return [{type:'notice',title:'公司批发 · 采购补货',body:'当前身份：'+({1:'云代理',2:'分货中心',3:'总代理'}[backend.agent?.rank_no]||'商城经营者')},
     ...items,...(available.length?[{type:'fields',title:'添加其他商品',items:[{label:'公司批发商品',key:'wholesaleAdd',kind:'select',options:available.map(sku=>sku.name+' · '+sku.id)}]},{type:'rows',items:[{label:'添加所选商品',value:'加入采购清单',target:'wholesale-add'}]}]:[]),
    {type:'rows',title:'采购金额',items:[{label:'商品总额',value:amount},{label:'配送费用',value:'¥0.00'},{label:'合计',value:amount}]},
    {type:'notice',title:backend.wholesaleRules?.mixedEnabled?'混批采购规则':'整箱采购规则',body:backend.wholesaleRules?.mixedEnabled?'同组商品可混批；每组至少 '+backend.wholesaleRules.minMixBoxes+' 箱，每箱 '+backend.wholesaleRules.mixCapacity+' 单位。未加入混批组的 SKU 仍按各自箱规起订。':'每个 SKU 分别满足箱规和最低箱数。',tone:'orange'},
    ...(plan.error?[{type:'notice',title:'请调整采购清单',body:plan.error,tone:'orange'}]:[]),{type:'links',items:[{title:'查看混批规则',icon:'file',target:'G13'}]}]
  }
  const address=state.addresses[state.selectedAddress||0]
   return [out.find(block=>block.type==='options')||{type:'options',key:'delivery',items:['采购入库','整箱直发']},{type:'rows',title:'收货信息',items:[{label:'收货人',value:address?address.name+' '+address.phone:'请选择实际收货地址',target:'M13'},{label:'收货地址',value:address?address.region+' '+address.detail:'请选择实际收货地址',target:'M13'}]},
   ...items,{type:'rows',title:'采购结算',items:[{label:'商品总额',value:amount},{label:'配送费用',value:'¥0.00'},{label:'实付款',value:amount}]},
   {type:'fields',items:[{label:'订单备注',key:'订单备注',kind:'textarea',maxlength:200}]},
   {type:'notice',title:'整箱直发说明',body:'公司直接发给终端收货人，不增加商城可售库存；保留关联采购及售后记录。',tone:'orange'},
   ...(plan.error?[{type:'notice',title:'无法提交采购订单',body:plan.error,tone:'orange'}]:[]),{type:'rows',items:[{label:'修改商品或数量',value:'返回采购清单',target:'G14'}]}]
 }
 if(pageId==='G16'&&order){const notice=out.find(b=>b.type==='notice');if(notice){notice.title=order.status;notice.body=order.id}const timeline=out.find(b=>b.type==='timeline');if(timeline){timeline.items=['待付款','待公司发货','运输中','采购完成'];timeline.active={UNPAID:0,PAID:1,SHIPPED:2,COMPLETED:3}[order.rawStatus]||0}}

 if(pageId==='G31'){const r=(backend.management.G31||[]).find(r=>['PENDING','SUPPLEMENT'].includes(r.status));for(const b of out){if(b.type==='profile'){b.name=r?.body?.name||'暂无待审核申请';b.subtitle=r?.body?.phone||''}if(b.type==='notice'){b.title=r?label(r.status):'暂无待审核申请';b.body=r?.id||'新的代理申请会自动同步'}if(b.type==='rows')b.items.forEach(i=>i.value=r?({'申请职级':{1:'云代理',2:'分货中心',3:'总代理'}[r.body.rank],'归属商城':state.shop,'结算账户':r.body.bank||'待补充'}[i.label]||'—'):'—')}}
 if(['M20','M21'].includes(pageId)&&order?.items?.length){
  const line=order.items.find(l=>l.lineId===backend.afterLineId)||order.items.find(l=>l.qty>Number(l.refunded_qty||0))||order.items[0];
  const pending=(account.refunds||[]).some(r=>r.line_id===line.lineId&&!['SUCCESS','REJECTED','CLOSED'].includes(r.status));
  const remaining=pending?0:line.qty-Number(line.refunded_qty||0);
  const rawQty=typeof form.申请数量==='number'?String(form.申请数量):form.申请数量;
  const enteredQty=typeof rawQty==='string'&&/^[1-9]\d*$/.test(rawQty)?Number(rawQty):0;
  const qty=Number.isSafeInteger(enteredQty)&&enteredQty<=remaining?enteredQty:0;
  const refund=qty?Math.max(0,Math.round(line.paid*(Number(line.refunded_qty||0)+qty)/line.qty)-Number(line.refunded_paid||0)):0;
  for(const block of out){
   if(block.type==='product')Object.assign(block,{id:line.id,product:reviewLineProduct(line),name:line.name,qty:line.qty,price:money(line.unitPrice),target:'after-line:'+line.lineId});
   if(block.type==='notice'&&block.title.includes('剩余'))block.title='剩余可售后数量：'+remaining;
   if(block.type==='rows')for(const item of block.items){
    if(item.label==='责任方')item.value=state.shop;
    if(item.label==='商品金额')item.value='¥'+money(line.unitPrice*line.qty);
    if(item.label==='本次最多可退')item.value=qty?'¥'+money(refund):'请填写有效数量';
   }
   if(block.type==='fields')for(const item of block.items){
    if(pageId==='M21'&&item.key==='申请数量')item.max=Math.max(0,remaining);
    if(item.key==='退款金额'){item.kind='readonly';form.退款金额=qty?money(refund):'—'}
   }
  }
  if(pageId==='M21'){
   const amounts=out.find(block=>block.type==='rows'&&block.title==='退款金额');
   if(amounts)amounts.items=[{label:'商品金额',value:'¥'+money(line.unitPrice*line.qty)},...afterSaleReductionRows(order,line,money),{label:'本次最多可退',value:qty?'¥'+money(refund):'请填写有效数量'}];
  }
  if(order.items.length>1)out.splice(1,0,{type:'rows',title:'选择售后商品',items:order.items.map(item=>({label:item.name,value:item.lineId===line.lineId?'已选择':'选择 · '+(item.qty-Number(item.refunded_qty||0))+'件',target:'after-line:'+item.lineId}))});
  if(order.order_type==='POINTS'){
   const unitPoints=Number(order.points_used)/Number(line.qty),returnedPoints=unitPoints*qty;
   for(const block of out){
    if(block.type==='product')block.price=unitPoints+'积分';
    if(pageId==='M21'&&block.type==='fields')for(const item of block.items)if(item.key==='退款金额'){item.label='退回积分';form.退款金额=qty?returnedPoints+'积分':'—'}
    if(pageId==='M21'&&block.type==='rows'&&block.title==='退款金额'){block.title='积分退回';block.items=[{label:'商品积分',value:unitPoints*line.qty},{label:'本次退回积分',value:qty?returnedPoints:'请填写有效数量'}]}
    if(pageId==='M21'&&block.type==='notice'&&block.title==='商家审核后退款'){block.title='商家审核后退回积分';block.body='审核通过后积分退回原积分账户。'}
   }
  }
  if(pageId==='M21'&&['退货退款','换货'].includes(state.afterType)){
   const notice=out.find(block=>block.type==='notice'&&block.title.includes('商家审核后'));
   if(notice){notice.title=state.afterType==='换货'?'商家验收后换货':order.order_type==='POINTS'?'商家验收后退回积分':'商家验收后退款';notice.body=state.afterType==='换货'?'商家同意后请寄回商品，验收通过后安排换出商品。':'商家同意后请寄回商品；验收通过后'+(order.order_type==='POINTS'?'积分退回原账户。':'发起退款，到账以渠道回执为准。')}
  }
  if(pageId==='M21'&&state.afterType==='换货')for(const block of out){
   if(block.type==='fields')for(const item of block.items){if(item.key==='退款原因')item.label='换货原因';if(item.key==='退款金额')item.label=order.order_type==='POINTS'?'换货商品积分价值':'换货商品价值';}
   if(block.type==='rows'&&['退款金额','积分退回'].includes(block.title)){
    block.title=order.order_type==='POINTS'?'换货商品积分价值':'换货商品价值';
    for(const item of block.items){if(item.label==='本次最多可退')item.label='本次换货商品价值';if(item.label==='本次退回积分')item.label='本次换货积分价值';}
   }
  }
 }
if(pageId==='M18'&&order){const pointsOrder=order.order_type==='POINTS',i=out.findIndex(b=>b.type==='product');if(i>=0)out.splice(i,1,...order.items.map(l=>({type:'product',id:l.id,product:reviewLineProduct(l),name:l.name,qty:l.qty,price:pointsOrder?Number(order.points_used)/Number(l.qty)+'积分':money(l.unitPrice)})));const amounts=out.find(b=>b.type==='rows'&&b.items.some(item=>item.label==='实付款'));if(pointsOrder&&amounts)amounts.items.push({label:Number(order.points_scope)===0?'扣除平台积分':'扣除商城积分',value:order.points_used});if(!pointsOrder&&Number(order.refunded)>0&&amounts)amounts.items.push({label:'已退款',value:'¥'+money(order.refunded)});const refunds=(account.refunds||[]).filter(r=>r.order_id===order.id);if(refunds.length)out.push({type:'rows',title:'售后记录',items:refunds.map(r=>({label:r.id,value:afterSaleStatusLabel(r,label(r.status)),target:'refund-record:'+r.id}))});for(const b of out)if(b.type==='links')b.items=b.items.filter(i=>i.target!=='M20'||['PAID','SHIPPED','COMPLETED'].includes(order.rawStatus))}
if(['M23','M24'].includes(pageId)){const r=backend.refund;if(!r)return [{type:'notice',title:'尚未选择售后记录',body:'请从订单详情查看对应售后记录'}];const l=order?.items?.find(l=>l.lineId===r.line_id),pointReturn=order?.order_type==='POINTS'&&l?Number(order.points_used)/Number(l.qty)*Number(r.qty):null;for(const b of out)if(b.type==='product'&&l)Object.assign(b,{id:l.id,product:reviewLineProduct(l),name:l.name,qty:r.qty,price:pointReturn!=null?Number(order.points_used)/Number(l.qty)+'积分':money(l.unitPrice)});const notice=out.find(b=>b.type==='notice');if(notice){notice.title=afterSaleStatusLabel(r,label(r.status));notice.body=r.status==='SUCCESS'?'退款已完成，具体金额见下方退款信息。':r.status==='CLOSED'&&r.refund_type==='EXCHANGE'?'换货已完成，物流信息见下方明细。':r.refund_type==='EXCHANGE'&&r.status==='WAIT_RETURN'?(r.return_json?'退回运单已提交，等待商家验收。':'请填写退回物流信息，等待商家验收。'):r.refund_type==='EXCHANGE'&&r.status==='WAIT_EXCHANGE'?'商家已验收，等待寄出换货商品。':r.refund_type==='EXCHANGE'&&r.status==='EXCHANGE_SHIPPED'?'换货商品已发出，请核对物流并确认收货。':r.review_note||r.reason}const timeline=out.find(b=>b.type==='timeline');if(timeline){const exchange=r.refund_type==='EXCHANGE';timeline.items=exchange?['申请换货','等待寄回','商家验收','新货发出','换货完成']:['申请提交','商家审核','退货验收',pointReturn!=null?'积分退回':'渠道退款','退款完成'];timeline.active=({PENDING:0,WAIT_RETURN:1,WAIT_EXCHANGE:2,EXCHANGE_SHIPPED:3,APPROVED:3,SUCCESS:4,CLOSED:4}[r.status]||0);if(r.status==='SUCCESS'||exchange&&r.status==='CLOSED')timeline.active=timeline.items.length;if(r.status==='CLOSED'&&!exchange){timeline.items=['申请提交','售后已关闭'];timeline.active=1}}for(const b of out){if(b.type==='links')b.items=b.items.filter(i=>i.target==='M29'||i.target==='cancel-after'&&['PENDING','WAIT_RETURN'].includes(r.status)&&!r.return_json);if(b.type==='rows'){const returned=JSON.parse(r.return_json||'{}'),shipped=JSON.parse(r.exchange_json||'{}');b.items=b.title==='退回物流'?[{label:'物流公司',value:returned.carrier||'尚未填写'},{label:'运单号',value:returned.tracking||'尚未填写'}]:[{label:'售后单号',value:r.id,wrapIdentifier:true},{label:'处理状态',value:afterSaleStatusLabel(r,label(r.status))},{label:'申请数量',value:r.qty+'件'},{label:pointReturn!=null?'退回积分':r.refund_type==='EXCHANGE'?'商品价值':'退款金额',value:pointReturn!=null?pointReturn+'积分':'¥'+money(r.amount)},{label:'换出物流',value:shipped.carrier||'尚未发出'},{label:'换出运单',value:shipped.tracking||'尚未发出'}]}}}
 if(pageId==='M23'&&backend.refund){
  const r=backend.refund,timeline=out.find(b=>b.type==='timeline');
  const returned=displayJson(r.return_json),notice=out.find(b=>b.type==='notice');
  if(r.status==='WAIT_RETURN'&&returned.tracking&&notice){notice.title='运单已提交，待商家验收';notice.body=r.review_note||'商家验收前可在退货物流页修改已提交运单。';}
  if(timeline&&['REFUND_ONLY','PARTIAL'].includes(r.refund_type)){
   timeline.items=r.status==='REJECTED'?['申请提交','商家已驳回']:r.status==='CLOSED'?['申请提交','售后已关闭']:['申请提交','商家审核','渠道退款','退款完成'];
   timeline.active=r.status==='SUCCESS'?timeline.items.length:({PENDING:0,APPROVED:2,REJECTED:1,CLOSED:1}[r.status]||0);
  }
  const line=order?.items?.find(item=>item.lineId===r.line_id),points=order?.order_type==='POINTS'&&line?Number(order.points_used)/Number(line.qty)*Number(r.qty):null;
  if(points!=null&&timeline)timeline.items=timeline.items.map(item=>item==='渠道退款'?'积分退回':item);
  const completed=r.status==='SUCCESS',ended=['CLOSED','REJECTED'].includes(r.status),pointRefund=points!=null;
  const amountLabel=pointRefund?completed?'已退积分':ended?'原申请退回积分':'申请退回积分':completed?'已退金额':ended?'原申请金额':'申请退款金额';
  if(notice){
   if(completed)notice.body=pointRefund?'积分已退回，具体数量见下方退回信息。':'退款已完成，具体金额见下方退款信息。';
   else if(ended)notice.body=(r.status==='CLOSED'?'本笔售后申请已关闭，':'本笔售后申请已驳回，')+(pointRefund?'积分未退回。':'未发生退款。')+(r.review_note?'处理意见：'+r.review_note:'');
   else notice.body=(notice.body||'售后申请正在处理。')+' '+(pointRefund?'积分尚未退回。':'尚未退款。');
  }
  out.splice(2,0,{type:'rows',title:completed?pointRefund?'积分退回信息':'退款信息':'售后申请',items:[{label:'售后单号',value:r.id,wrapIdentifier:true},{label:'处理状态',value:label(r.status)},{label:'申请数量',value:r.qty+'件'},{label:amountLabel,value:pointRefund?points+'积分':'¥'+money(r.amount)},{label:'退款原因',value:r.reason},...(returned.tracking?[{label:'退货运单',value:(returned.carrier||'快递')+' · '+returned.tracking}]:[])]});
  if(['PENDING','WAIT_RETURN'].includes(r.status)&&!r.return_json)out.push({type:'rows',title:'申请操作',items:[{label:'撤销售后',value:'撤销申请',target:'cancel-after'}]});
 }
 if(pageId==='M22'){const r=backend.refund,info=backend.shopInfo?.returnAddress;for(const b of out){if(b.type==='notice'){b.title=r?label(r.status):'尚未选择退货申请';b.body='寄回前请与商城客服确认地址'}if(b.type==='rows')b.items=[{label:'收货人',value:info?.name||'待商家配置'},{label:'联系电话',value:info?.phone||'请联系商城客服'},{label:'收货地址',value:info?.address||'请确认退货地址后寄出'}]}}

 if(pageId==='M28'&&backend.closure){const c=backend.closure;for(const b of out){if(b.type==='rows')for(const i of b.items)i.value=({'未完成订单':c.orders+' 个','售后/退款':c.refunds+' 个','可提现余额':c.wallets+' 个账户待处理','我的积分':c.points+' 积分','代理店铺关系':c.agents+' 个有效身份'}[i.label]||'—');if(b.type==='notice'&&b.title.includes('满足')){b.title=c.eligible?'已满足注销条件':'暂不满足注销条件';b.body='请核对未完结业务和剩余积分'}}}
 if(pageId==='M31'){
  const d=backend.documents.agent_application?.[0],editable=d&&['REJECTED','SUPPLEMENT'].includes(d.status)
  const time=out.find(b=>b.type==='timeline')
  if(time){time.items=d?['申请已提交 · '+dateTimeLabel(d.created_at),label(d.status),d.review_note||'等待审核处理']:['尚未提交申请'];time.active=d?d.status==='APPROVED'?2:1:0}
  const notice=out.find(b=>b.type==='notice')
  if(notice){notice.title=d?label(d.status):'尚未提交申请';notice.body=d?.review_note||'处理结果由商城拥有者或平台审核后同步';notice.tone=d?.status==='APPROVED'?'mint':d?.status==='REJECTED'?'red':'orange'}
  for(const block of out){
   if(block.type==='rows'){block.title='真实申请资料';block.items=d?[{label:'申请编号',value:d.id},{label:'申请姓名',value:d.body.name},{label:'申请职级',value:({1:'云代理',2:'分货中心',3:'总代理'}[d.body.rank]||'代理')},{label:'提交资料',value:(d.body.uploads||[]).length+'张'},{label:'处理意见',value:d.review_note||'待审核'}]:[{label:'申请状态',value:'尚未提交'}]}
   if(block.type==='upload'&&!editable){block.type='rows';block.title='已提交资料';block.items=(d?.body?.uploads||[]).map((id,i)=>({label:'资料 '+(i+1),value:'查看',target:'view-proof:'+id}))}
  }
  // 旧申请缺少签署版本时，仅在可补件状态显示协议与单独勾选。
  if(editable&&!d.body?.agreementVersion)out.push({type:'consent',key:'agreementReconsent',label:'我已阅读并同意《代理合作协议》当前版本',policyType:'AGENT_AGREEMENT'})
 }
if(['G26','G27','G28'].includes(pageId)&&backend.refund){const r=backend.refund;const line=backend.refundOrder?.items?.find(l=>l.lineId===r.line_id);const points=r.order_type==='POINTS';const refundAmount=points?Number(r.points_return||0)+'积分':'¥'+money(r.amount);for(const b of out)if(b.type==='product'&&line)Object.assign(b,{id:line.id,name:line.name,price:points?Number(r.points_return||0)/Number(r.qty)+'积分':money(line.unitPrice),qty:r.qty});const notice=out.find(b=>b.type==='notice');if(notice){notice.title=afterSaleStatusLabel(r,label(r.status));notice.body=r.id}for(const b of out){if(b.type==='rows'){if(r.refund_type==='EXCHANGE'&&b.title==='退款申请')b.title='换货申请';for(const i of b.items){if(i.label==='申请退款'){i.label=r.refund_type==='EXCHANGE'?'换货商品价值':points?'申请退回积分':i.label;i.value=refundAmount}if(i.label==='退款数量'){if(r.refund_type==='EXCHANGE')i.label='换货数量';i.value=r.qty+' 件'}if(i.label==='退款原因'){if(r.refund_type==='EXCHANGE')i.label='换货原因';i.value=r.reason}if(['收件人','电话','地址'].includes(i.label)){const info=backend.shopInfo?.returnAddress||{};i.value=({'收件人':info.name,'电话':info.phone,'地址':info.address}[i.label]||'待商城配置')}if(i.label==='责任方')i.value=state.shop}}if(b.type==='table'){b.type='notice';b.title=r.refund_type==='EXCHANGE'?'换货后收益核对':points?'积分退回后收益冲正':'退款后收益冲正';b.body=r.status==='SUCCESS'?'实际冲正金额请在收益结算工作台核对；本页不展示估算值。':points?'积分退回后按原订单快照冲正；审核时不展示估算值。':r.refund_type==='RETURN'?'退货验收并经渠道退款成功后按原订单快照冲正；审核时不展示估算值。':r.refund_type==='EXCHANGE'?'换货完成后按原订单快照核对收益；审核时不展示估算值。':'渠道退款成功后按原订单快照冲正；审核时不展示估算值。'}if(b.type==='notice'&&b.title.includes('不回库存')&&['RETURN','EXCHANGE'].includes(r.refund_type)){b.title='退回商品验收后处理';b.body='合格品恢复可售库存，残次品单独登记'}}}
if(pageId==='G26'&&backend.refund?.status!=='PENDING')for(const block of out)if(block.type==='fields'&&block.title==='审核意见'){
 block.type='rows';block.title='审核记录';block.items=[{label:'审核意见',value:backend.refund.review_note||'—'}]
}
 if(pageId==='G27'&&backend.refund?.status!=='WAIT_RETURN')for(const b of out){
  if(b.type==='fields')b.items=b.items.map(item=>({...item,kind:'readonly'}));
  if(b.type==='upload'){
   b.type='notice';
   const exchange=backend.refund?.refund_type==='EXCHANGE',status=backend.refund?.status;
   b.title=exchange?status==='CLOSED'?'换货已完成':status==='EXCHANGE_SHIPPED'?'换货已发出':'旧品已验收，待发新货':status==='SUCCESS'?'验收及退款已完成':'验收记录已提交';
   b.body=exchange?'换货验收记录已保存，不能重复提交；后续请到换货详情核对新货物流。':status==='SUCCESS'?'该售后已处理完成，不能重复验收。':'实物已验收，等待退款渠道确认；不能重复提交验收。';
  }
 }
 if(pageId==='G27'&&backend.refund?.status!=='WAIT_RETURN'){
  const uploads=(displayJson(backend.refund?.evidence_json)||{}).inspection?.uploads;
  if(Array.isArray(uploads)&&uploads.length)out.push({type:'rows',title:'已提交验收照片',items:uploads.map((id,index)=>({label:'验收照片 '+(index+1),value:'查看',target:'view-proof:'+id}))});
 }
 if(pageId==='G26'&&backend.refund?.status!=='PENDING')for(const b of out)if(b.type==='fields')b.items=b.items.map(item=>({...item,kind:'readonly'}));
 if(['M33','M37','M38'].includes(pageId)&&backend.assessment){const a=backend.assessment;if(pageId==='M38'){const progress=out.find(b=>b.type==='progress');if(progress)progress.items=a.metrics.map(m=>[m.label,(m.key==='sales'?money(m.value):m.key==='repeat'?m.value/100+'%':m.value)+' / '+(m.key==='sales'?money(m.threshold):m.key==='repeat'?m.threshold/100+'%':m.threshold),m.threshold?Math.min(100,m.value/m.threshold*100):0]);const text=out.find(b=>b.type==='notice');if(text){text.title=a.eligible?'已达到晋升条件':a.configured?'尚未达到晋升条件':'尚未配置考核方案';text.body=a.configured?'按已完成订单和退款后的有效金额统计':'请等待商城拥有者配置具体考核条件'}}else{const stats=out.filter(b=>b.type==='stats')[pageId==='M33'?1:0];if(stats)stats.items.forEach((s,i)=>s.value=(pageId==='M33'?[backend.agentData?.customers?.length||0,a.customers,a.orders,(a.repeatBps/100)+'%']:[backend.agentData?.customers?.length||0,a.direct,a.team,money(a.sales)])[i])}}
 if(pageId==='G37'){const d=(backend.management.G37||[]).find(r=>r.status==='PENDING');const a=d?.body?.assessment;for(const block of out){if(block.type==='profile'){block.name=d?'会员 '+d.member_id:'暂无待审核晋升';block.subtitle=a?'当前职级 '+a.rank+' → 申请职级 '+a.targetRank:'请从真实申请进入'}if(block.type==='progress')block.items=a?a.metrics.map(m=>[m.label,String(m.value)+' / '+m.threshold,m.threshold?Math.min(100,m.value/m.threshold*100):0]):[]}}
 if(pageId==='M39'){const d=backend.documents.promotion?.[0];const hero=out.find(b=>b.type==='hero');if(hero){hero.title=d?label(d.status):'尚未提交晋升申请';hero.subtitle=d?.review_note||'以实际申请与审核记录为准'}const timeline=out.find(b=>b.type==='timeline');if(timeline)timeline.active=d?({PENDING:1,SCHEDULED:2,APPROVED:3,APPLIED:3}[d.status]||0):0;for(const b of out)if(b.type==='rows')for(const i of b.items)i.value=d?({'当前职级':{1:'云代理',2:'分货中心',3:'总代理'}[d.body.fromRank],'申请职级':{1:'云代理',2:'分货中心',3:'总代理'}[d.body.rank],'申请时间':d.created_at,'审核状态':label(d.status)}[i.label]||'以申请资料为准'):'—'}
 if(['M33','M45'].includes(pageId)){const stats=out.find(x=>x.type==='stats');if(stats){const pending=Number(account.summary?.pendingEarnings||0);stats.items.forEach((item,i)=>item.value=money(i===0?state.balance:i===1?pending:pageId==='M33'?Number(account.summary?.settledEarnings||0):i===2?account.wallet?.frozen||0:Number(account.withdrawnTotal||0)))}}
 if(pageId==='G40'){const selected=products.find(p=>p.id===form.试算商品);if(!selected)return [{type:'notice',title:'暂无可试算商品',body:'请先在本商城上架商品'}];const fields=out.find(b=>b.type==='fields');if(fields)fields.items.unshift({key:'试算商品',label:'本商城商品',kind:'select',options:products.map(p=>p.id)},{key:'归属代理',label:'客户归属代理',kind:'select',options:(backend.previewAgents||[]).map(a=>a.id+' · '+({1:'云代理',2:'分货中心',3:'总代理'}[a.rank_no]||''))});const product=out.find(b=>b.type==='product');if(product)Object.assign(product,{id:selected.id,product:selected,name:selected.name,price:money(selected.retailPrice??selected.price),qty:Number(form.quantity)>0?Number(form.quantity):'—'});const result=backend.settlementPreviewKey===settlementInputKey(form,backend.member?.id,backend.shopId,backend.token)?backend.settlementPreview:null;const b=out.find(b=>b.type==='settlement');if(b)b.items=result?result.items.map(i=>[i.name+' · '+label(i.type),(i.amount<0?'−':'')+'¥'+money(Math.abs(i.amount))]):[['参数已变化，请重新试算','—']];const relation=out.find(b=>b.type==='relation');if(relation)relation.items=result?result.chain.map(i=>'代理 '+i.agentId+' · '+({1:'云代理',2:'分货中心',3:'总代理'}[i.rank]||'')):[];const notice=out.find(b=>b.type==='notice'&&b.title==='承担方确认');if(notice)notice.body='同级分红由本商城拥有者承担，不扣减被推荐人的零售毛利；试算仅供核对，成交以订单生成时的规则快照为准。';}
 if(pageId==='G54'&&activeFilter==='拼团活动'){const b=out.find(b=>b.type==='fields');if(b){b.title='拼团活动';b.items=b.items.filter(i=>!['完成首单奖励','完成三单奖励','单人奖励上限'].includes(i.key));b.items.splice(1,0,{key:'活动商品',label:'活动商品SKU',kind:'select',options:products.map(p=>p.id)},{key:'拼团价格',label:'拼团价格（元，包邮）',kind:'number'});}const n=out.find(b=>b.type==='notice');if(n){n.title='付款人数达到要求后成团';n.body='每人每团1件，拼团包邮且不叠加券与积分。未成团不发货，超时自动进入原路退款。';}}
 if(pageId==='G54'&&activeFilter!=='拼团活动'){const b=out.find(b=>b.type==='fields');if(b){b.items=b.items.filter(i=>!['拼团开关','成团人数','成团时限（小时）'].includes(i.key));b.items.splice(4,0,{key:'有效订单门槛',label:'有效商品实付门槛（元）',kind:'number'});for(const i of b.items)if(['完成首单奖励','完成三单奖励'].includes(i.key))i.label+='最高（元）';}const n=out.find(b=>b.type==='notice');if(n)n.body='奖励以原商城可分配毛利和累计额度为上限。每位好友每个阶段只触发一次，退款后不重复激活。';}
 if(pageId==='G52'){const type=activeFilter||form._marketingTab||'限时折扣';const b=out.find(b=>b.type==='fields');const discount=b?.items.find(i=>i.key==='活动折扣');if(discount){discount.label=type==='满赠'?'赠品金额（固定0元）':type==='满减'?'优惠金额（元）':type==='换购'?'换购金额（元）':'活动折扣';if(type==='满赠'){discount.kind='readonly';discount.required=false;form.活动折扣=0;}}if(['满减','满赠','换购'].includes(type))b.items.splice(4,0,{key:'活动门槛',label:'门槛金额（元）',kind:'number',required:true});if(['满赠','换购'].includes(type))b.items.splice(5,0,{key:'活动商品',label:'赠品/换购SKU编号',kind:'input',required:true});}
 if(pageId==='M44'){const field=out.find(b=>b.type==='fields');if(field)field.items.unshift({key:'采购数量',label:'申请采购数量',kind:'stepper'});}
 if(pageId==='M58'){const g=backend.groupDetail,c=backend.groupCampaign,p=products.find(p=>p.id===(g?.skuId||c?.skuId));const states={FORMING:'等待成团',FORMED:'拼团成功',FAILED:'未成团，进入退款流程'};if(!g&&!c)return [{type:'notice',title:'暂无拼团活动',body:'商家尚未启用拼团，请稍后查看'}];for(const b of out){if(b.type==='hero'){b.title=p?.name||'拼团商品';b.subtitle=g?states[g.status]:c.name;}if(b.type==='amount'){b.value=money(g?.price??c.price);b.label='拼团包邮价';}if(b.type==='notice'){b.title=g?states[g.status]:'发起新拼团';b.body=(g?(g.paidCount+' / '+g.targetSize+' 人已付款'):(c.size+' 人团'))+' · 截止 '+dateTimeLabel(g?.expiresAt||c.expiresAt);}if(b.type==='people')b.items=(g?.members||[]).map(m=>[m.name,m.status==='PAID'&&g.status==='FORMING'?'已付款，待成团':label(m.status),'',m.leader?'团长':'团员']);if(b.type==='rows')b.items=[{label:'成团规则',value:'真实付款人数达到 '+(g?.targetSize||c.size)+' 人'},{label:'活动价格',value:'包邮，不叠加券与积分，每人1件'},{label:'未成团处理',value:'自动原路退款，到账以渠道回执为准'},{label:'订单归属',value:'保持原商城代理归属'}];}out.push({type:'rows',title:'选择拼团',items:[...(backend.groups?.groups||[]).map(x=>({label:(x.myOrderId?'我的团 · ':'参团 · ')+(products.find(p=>p.id===x.skuId)?.name||x.skuId),value:(states[x.status]||x.status)+' '+x.paidCount+'/'+x.targetSize,target:'group-select:'+x.id})),...(backend.groups?.campaigns||[]).map(x=>({label:'新开团 · '+x.name,value:'¥'+money(x.price),target:'group-campaign:'+x.campaignId}))]});}

 if(pageId==='M46'){const e=backend.earningDetail;if(!e)return [{type:'notice',title:'暂无收益明细',body:'请从收益中心选择真实订单收益'}];for(const b of out){if(b.type==='product')Object.assign(b,{id:e.line.sku_id,name:e.line.name,qty:e.line.qty,price:money(e.line.unit_price)});if(b.type==='rows'&&b.title!=='订单信息')b.title='收益计算（原订单快照）';if(b.type==='rows')b.items=b.title==='订单信息'?[{label:'订单编号',value:e.order_id},{label:'购买数量',value:e.line.qty+'件'},{label:'成交单价',value:'¥'+money(e.line.unit_price)},{label:'商品实付',value:'¥'+money(e.line.paid)}]:[{label:'收益类型',value:label(e.earning_type)},{label:'本人原结算价',value:e.settlementPrice==null?'按订单活动快照':'¥'+money(e.settlementPrice)},{label:'原始收益',value:'¥'+money(e.amount)},{label:'已退款数量',value:e.line.refunded_qty+'件'},{label:'收益冲正',value:'¥'+money(-e.reversed)},{label:'剩余收益',value:'¥'+money(e.remaining)},{label:'结算状态',value:e.remaining===0&&e.reversed!==0?'已全部冲正':label(e.status)}];if(b.type==='notice')b.body='本明细来自原订单价格和规则快照。商城承担分红与营销成本，退款沿原收益冲正。';}}
 if(['M49','G43','G44'].includes(pageId)){const w=pageId==='M49'?backend.withdrawalDetail:backend.managementWithdrawal;if(!w)return [{type:'notice',title:'暂无提现记录',body:'新的申请提交后会自动同步'}];const outcome=withdrawalOutcome(w.status,w.net),payoutFinished=['PAID','FAILED'].includes(w.status);for(const b of out){if(b.type==='success'){b.icon=w.status==='PAID'?'check':'alert';b.title=withdrawalLabel(w.status);b.value='¥'+money(w.status==='PAID'?w.net:0);b.body=outcome.body;}if(b.type==='notice'&&(b.tone==='orange'||pageId==='G43')){b.title=withdrawalLabel(w.status);b.body=pageId==='M49'&&payoutFinished?w.payout_reason||'打款结果暂无说明':w.reason||w.id;}if(b.type==='profile'){b.name=w.memberName;b.subtitle=state.shop;}if(b.type==='rows'&&b.title!=='常见问题')b.items=[{label:'申请单号',value:w.id},{label:'申请金额',value:'¥'+money(w.amount)},{label:'手续费（0.6%）',value:'¥'+money(w.fee)},{label:'预计到账',value:'¥'+money(w.net)},{label:'实际到账',value:outcome.actual},{label:'提现渠道',value:({BANK:'银行卡',WECHAT:'微信零钱',BALANCE:'系统余额'}[w.channel]||w.channel)},{label:'结算账户',value:String(w.accountLabel||'').trim()||'以已审核账户为准'},{label:'渠道流水',value:w.channel_ref||'尚无成功回执'},...(pageId==='M49'&&payoutFinished?[{label:'审核说明',value:w.reason||'—'},{label:'打款说明',value:w.payout_reason||'暂无打款说明'}]:[{label:'处理说明',value:w.reason||'—'}])];if(b.type==='timeline')b.active=({PENDING:0,APPROVED:1,PROCESSING:2,PAID:3,FAILED:2,REJECTED:1}[w.status]||0);if(b.type==='tabs')b.items=[withdrawalLabel(w.status)];}if(pageId!=='M49')out.push({type:'rows',title:'选择提现申请',items:(backend.management[pageId]||[]).map(x=>({label:x.id,value:withdrawalLabel(x.status),target:'withdrawal-select:'+x.id}))});}
 if(pageId==='G39'){const summary=backend.earningSummary||{},all=backend.management.G39||[],view=all.filter(e=>activeFilter==='退款冲正'?e.reversed!==0:activeFilter==='已结算'?e.status==='AVAILABLE':e.status==='PENDING');const page=financePage(view.map(e=>['代理 '+e.agent_id+' · '+label(e.earning_type),e.order_id,(activeFilter==='退款冲正'?'':'')+money(activeFilter==='退款冲正'?-e.reversed:e.amount-e.reversed),'reversal-order:'+e.order_id]),query,requestedPage);for(const b of out){if(b.type==='stats')b.items.forEach((x,i)=>x.value=money([summary.pending,summary.settled,summary.frozen][i]||0));if(b.type==='ledger')b.items=page.items;}const index=out.findIndex(b=>b.type==='ledger');out.splice(index,0,{type:'search',placeholder:'搜索订单号或代理'});out.splice(index+2,0,{type:'rows',title:`第 ${page.page}/${page.pages} 页 · 共 ${page.total} 条`,items:[...(page.page>1?[{label:'上一页',value:'查看',target:'finance-prev'}]:[]),...(page.page<page.pages?[{label:'下一页',value:'查看',target:'finance-next'}]:[])],emptyText:page.total?'已到末页':'没有匹配的收益记录'});}
 if(pageId==='G42'){const r=backend.reversal;if(!r)return [{type:'notice',title:'暂无可核对的订单',body:'完成订单和退款后可查看原收益及冲正记录'}];for(const b of out){if(b.type==='rows'&&b.title==='原始订单')b.items=[{label:'订单编号',value:r.id},{label:'原实付款',value:'¥'+money(r.total)},{label:'已退款',value:'¥'+money(r.refunded)},{label:'状态',value:label(r.status)}];if(b.type==='table')b.rows=(r.earnings||[]).map(e=>['代理 '+e.agent_id+' · '+label(e.earning_type),money(e.amount),money(-e.reversed),money(e.remaining)]);if(b.type==='notice'){b.title='按原快照冲正';b.body='退款成功回执自动冲正，核对页面保留原收益、冲正和剩余金额。';}}const page=financePage([...new Set((backend.management.G42||[]).map(e=>e.order_id))],query,requestedPage);out.push({type:'search',placeholder:'搜索订单号'},{type:'rows',title:`选择订单 · 第 ${page.page}/${page.pages} 页 · 共 ${page.total} 单`,items:page.items.map(id=>({label:id,value:'查看',target:'reversal-order:'+id,wrapIdentifier:true})),emptyText:'没有匹配的订单'},{type:'rows',items:[...(page.page>1?[{label:'上一页',value:'查看',target:'finance-prev'}]:[]),...(page.page<page.pages?[{label:'下一页',value:'查看',target:'finance-next'}]:[])],emptyText:page.total?'已到末页':''});}
 if(pageId==='G29'){const all=backend.management.G29||[],ranks={1:'云代理',2:'分货中心',3:'总代理'};for(const b of out){if(b.type==='stats')b.items.forEach((x,i)=>x.value=(backend.agentCounts||[]).find(r=>r.rank_no===3-i)?.total||0);if(b.type==='people'){b.items=all.filter(a=>!activeFilter||activeFilter==='全部'||ranks[a.rank_no]===activeFilter).map(a=>[a.name,ranks[a.rank_no]+' · '+label(a.status),'直属客户 '+a.customer_count,'下级 '+a.child_count+' · '+a.phone,'agent-select:'+a.id]);b.emptyText='暂无符合条件的代理';}if(b.type==='rows')for(const x of b.items)if(x.target==='G31')x.value='查看申请';}}
 if(pageId==='G30'){const a=backend.agentSummary;if(!a)return [{type:'notice',title:'暂无代理资料',body:'请从代理名册选择记录'}];const ranks={1:'云代理',2:'分货中心',3:'总代理'};for(const b of out){if(b.type==='relation')b.items=[...(a.chain||[])].reverse().map(n=>n.name+' · '+ranks[n.rank]);if(b.type==='rows')b.items=[{label:'代理姓名',value:a.name},{label:'所属商城',value:state.shop},{label:'直接上级',value:a.chain?.[1]?.name||'无'},{label:'身份生效',value:dateTimeLabel(a.approved_at)}];if(b.type==='stats')b.items.forEach((x,i)=>x.value=[a.customers,a.assessment?.team||0,'¥'+money(a.assessment?.sales||0)][i]);}out.push({type:'notice',title:'业绩统计周期',body:dateTimeLabel(a.assessment?.periodStart)+' 至 '+dateTimeLabel(a.assessment?.periodEnd)+'，以完成订单扣除退款统计'});}
 if(pageId==='G32'){const list=backend.management.G32||[],c=list.find(x=>x.member_id===state.selectedCustomer)||list[0];if(!c)return [{type:'notice',title:'暂无客户绑定',body:'客户首次授权绑定后显示'}];for(const b of out){if(b.type==='profile'){b.name=c.name;b.subtitle='会员 '+c.member_id+' · '+c.phone;}if(b.type==='rows')b.items=b.title==='首次绑定信息'?[{label:'所属商城',value:state.shop},{label:'当前归属代理',value:'代理 '+c.agent_id},{label:'首次有效邀请',value:c.inviter_agent_id?'代理 '+c.inviter_agent_id:'以首次绑定审计为准'},{label:'当前绑定生效',value:dateTimeLabel(c.bound_at)}]:[{label:'历史订单',value:c.order_count+'笔',target:'G21'}];if(b.type==='ledger')b.items=[];}out.push({type:'rows',title:'选择客户',items:list.map(x=>({label:x.name+' · '+x.phone,value:'代理 '+x.agent_id,target:'customer-select:'+x.member_id}))});}
 if(pageId==='G35'){
  const list=backend.management.G35||[],d=list.find(x=>x.id===backend.selectedDocuments?.G35)||list.find(x=>x.status==='PENDING')||list[0];
  if(!d)return [{type:'notice',title:'暂无相关申请',body:'新的申请提交后会在此同步'}];
  const b=d.body||{},shopName=id=>backend.shops.find(s=>Number(s.id)===Number(id))?.name||'商城',memberName=b.name||'会员';
  const items=(b.items||[]).map(x=>{const sku=products.find(p=>p.id===x.skuId);return (sku?.name||'商品')+(sku?.spec?' · '+sku.spec:'')+'（'+x.skuId+'）×'+x.qty;});
  const details=[{label:'申请人',value:memberName+'（会员 '+d.member_id+'）'},{label:'原商城',value:shopName(b.sourceShopId)+'（'+b.sourceShopId+'）'},{label:'采购商城',value:shopName(d.shop_id)+'（'+d.shop_id+'）'},{label:'申请商品数量',value:items.join('、'),wrapIdentifier:true},{label:'批准截止',value:dateTimeLabel(b.expiresAt)},{label:'申请原因',value:b.reason||'—'},{label:'审核意见',value:d.review_note||'待处理'}];
  if(d.status==='REVOKED')details.push({label:'撤销原因',value:b.revokeReason||'见审计记录'},{label:'撤销时间',value:dateTimeLabel(b.revokedAt)});
  const pending=['PENDING','SUPPLEMENT'].includes(d.status);
  const statusName=status=>({REVOKED:'已撤销',ARCHIVED:'已归档'}[status]||label(status));
  const panels=[{type:'notice',title:statusName(d.status),body:d.id,tone:'orange'},{type:'rows',title:'申请详情',items:details}];
  if(pending)panels.push({type:'fields',title:'审批限制',items:[
   {label:'有效期至',key:'有效期至',kind:'date'},
   ...(b.items?.length===1?[{label:'可采购数量上限',key:'可采购数量上限',kind:'number'}]:[]),
   {label:'审批备注',key:'审批备注',kind:'textarea'}
  ]});
  if(d.status==='APPROVED')panels.push({type:'fields',title:'提前撤销授权',items:[{label:'撤销原因',key:'撤销原因',kind:'textarea',maxlength:500}]});
  panels.push({type:'notice',title:'审批边界',body:'仅本次授权范围有效，原代理关系不变。'},
   {type:'rows',title:'选择申请记录',items:list.map(x=>({label:(x.body?.name||'会员')+'（'+x.member_id+'）· '+x.id,value:statusName(x.status),target:'document-select:'+x.id,wrapIdentifier:true}))});
  return panels;
 }
 if(['G31','G33','G34'].includes(pageId)){const list=backend.management[pageId]||[],d=list.find(x=>x.id===backend.selectedDocuments?.[pageId])||list.find(x=>x.status==='PENDING')||list[0];if(!d)return [{type:'notice',title:'暂无相关申请',body:'新的申请提交后会在此同步'}];const b=d.body||{};for(const block of out){if(block.type==='notice'&&block.tone==='orange'){block.title=label(d.status);block.body=d.id;}if(block.type==='profile'){block.name=b.name||'会员 '+d.member_id;block.subtitle=(b.phone||'')+' · '+label(d.status);}if(block.type==='relation')block.items=pageId==='G34'?['原商城 '+d.shop_id,'团队代理 '+b.rootAgentId,'新商城 '+b.targetShopId]:['原商城 '+(b.sourceShopId||d.shop_id),'目标商城 '+(b.targetShopId||d.shop_id)];if(block.type==='rows')block.items=pageId==='G34'?[{label:'团队负责人',value:'代理 '+b.rootAgentId},{label:'完整代理名单',value:(b.agentIds||[]).join('、')},{label:'客户数量',value:b.customerCount},{label:'目标商城',value:b.targetShopId},{label:'生效时间',value:b.effectiveAt}]:pageId==='G31'?[{label:'申请职级',value:({1:'云代理',2:'分货中心',3:'总代理'}[b.rank]||'待补充')},{label:'推荐代理',value:b.parentId||'商城拥有者'},{label:'申请商城',value:state.shop},{label:'资料状态',value:label(d.status)},{label:'处理意见',value:d.review_note||'待审核'}]:[{label:'申请会员',value:d.member_id},{label:'目标商城',value:b.targetShopId},{label:'目标代理',value:b.targetAgentId},{label:'预期生效',value:b.effectiveAt||'审核后立即'},{label:'审核意见',value:d.review_note||'待处理'}];if(block.type==='upload'){block.type='rows';block.items=(b.uploads||[]).length?(b.uploads||[]).map((id,i)=>({label:'已提交资料 '+(i+1),value:'查看图片',target:'view-proof:'+id})):[{label:'已提交资料',value:'尚无图片'}];}}out.push({type:'rows',title:'选择申请记录',items:list.map(x=>({label:'会员 '+x.member_id+' · '+x.id,value:label(x.status),target:'document-select:'+x.id}))});}

 if(['M59','M60'].includes(pageId)){const data=backend.linkCampaign||{},c=data.campaign||{},p=data.participant;if(pageId==='M59'){for(const b of out){if(b.type==='hero'){b.title=c.name||'联动2加1';b.subtitle=data.enabled?'独立营销活动 · 以完成订单计奖':'活动尚未开启或已结束';}if(b.type==='rows'){b.title='参与资格与活动规则';b.items=[{label:'审核通过的代理',value:data.canJoin?'已通过':'尚未申请'},{label:'活动参与状态',value:p?'已参与':'尚未参与'},{label:'本人有效商品订单',value:data.qualified?'已完成':'尚未满足'},{label:'有效新直推',value:(data.validDirect||0)+' / 2'},{label:'有效订单门槛',value:c.minOrderAmount?'¥'+money(c.minOrderAmount):'待配置'},{label:'参与商品',value:Array.isArray(c.skuIds)?c.skuIds.join('、'):c.skuIds||'待配置'},{label:'本人订单奖',value:c.orderBps?c.orderBps/100+'%':'最高¥'+money(c.orderReward||0)},{label:'新代理首单直推奖',value:c.directBps?c.directBps/100+'%':'最高¥'+money(c.directReward||0)},{label:'第二层老板平级奖',value:c.peerBps?c.peerBps/100+'%':'最高¥'+money(c.peerReward||0)},{label:'个人累计上限',value:'¥'+money(c.rewardCap||0)},{label:'每单总奖励上限',value:'¥'+money(c.maxRewardPerOrder||0)+' / '+(c.totalRewardBps||0)/100+'%'},{label:'升级营销关系',value:({KEEP_RELATION:'保持当前关系',EXIT_KEEP_TEAM:'升移并带走团队',EXIT_PASS_ONE:'升移并留下1名有效直推'}[c.relationshipMode]||'待确认')},{label:'截止时间',value:c.expiresAt?dateTimeLabel(c.expiresAt):'待配置'},{label:'计奖条件',value:'仅本人及有效新代理完成真实订单；同时受商城毛利上限约束'}];}}}else{if(!p)return [{type:'notice',title:data.enabled?'尚未参与联动活动':'联动活动尚未开启',body:'可在活动入口查看完整规则，审核通过的代理参与后按真实有效订单计奖。'},{type:'rows',items:[{label:'查看活动资格',value:'进入',target:'M59'}]}];for(const b of out){if(b.type==='profile'){b.name=backend.member.name;b.subtitle=data.qualified?label(p.role):'已参与，等待完成有效订单';}if(b.type==='stats')b.items.forEach((x,i)=>x.value=money([data.earned||0,Math.max(0,(c.rewardCap||0)-(data.gross||0)),c.rewardCap||0][i]));if(b.type==='people')b.items=(data.children||[]).map(x=>['代理 '+x.agent_id,label(x.role),'',x.qualified?'有效订单已完成':'尚未满足']);if(b.type==='ledger')b.items=(data.records||[]).flatMap(x=>[[label(x.earning_type),x.order_id,'+'+money(x.amount)],...(x.reversed?[['退款冲正 · '+label(x.earning_type),x.order_id,'−'+money(x.reversed)]]:[])]);if(b.type==='rows')b.items=[{label:'有效新直推',value:(data.validDirect||0)+'人'},{label:'原直接推荐',value:p.origin_parent_id?'代理 '+p.origin_parent_id:'无'},{label:'当前营销上级',value:p.marketing_parent_id?'代理 '+p.marketing_parent_id:'无'},{label:'活动状态',value:data.enabled?'进行中':'已结束，保留历史'}];}}}
 if(pageId==='G56'){const fields=out.find(b=>b.type==='fields');if(fields)fields.items=[{key:'enabled',label:'启用联动2加1',kind:'switch'},...['name:活动名称','skuIds:参与商品SKU（逗号分隔）','minOrderAmount:有效订单门槛（分）','rewardCap:个人累计上限（分）','maxRewardPerOrder:含三级收益的单笔总上限（分）','totalRewardBps:总奖励比例上限（基点）','directReward:首笔有效订单直推奖（分）','directBps:直推奖比例（基点）','orderReward:本人订单奖（分）','orderBps:本人订单奖比例（基点）','peerReward:第二层老板平级奖（分）','peerBps:平级奖比例（基点）'].map(s=>{const [key,label]=s.split(':');return {key,label,kind:['name','skuIds'].includes(key)?'input':'number'}}),{key:'relationshipMode',label:'升级关系方案',kind:'select',options:['KEEP_RELATION','EXIT_KEEP_TEAM','EXIT_PASS_ONE']},{key:'passedChild',label:'留人顺序（最早 / 最近）',kind:'select',options:['EARLIEST','LATEST']},{key:'startDate',label:'开始日期',kind:'date'},{key:'endDate',label:'截止日期',kind:'date'}];const notice=out.find(b=>b.type==='notice');if(notice){notice.title='联动2加1 · 默认关闭';notice.body='KEEP_RELATION保持；EXIT_KEEP_TEAM升移并保留团队；EXIT_PASS_ONE升移并留下1名有效直推给原营销上级。关系调整另经审核。固定金额与比例每项只能填一种。';}}
 if(pageId==='G57'){const list=backend.management.G57||[],p=list.find(x=>x.agent_id===backend.linkSelectedAgent)||list[0];if(!p)return [{type:'notice',title:'暂无联动参与人',body:'活动默认关闭，参与人和关系均来自真实业务记录。'}];for(const b of out){if(b.type==='profile'){b.name='代理 '+p.agent_id;b.subtitle=label(p.role)+' · 活动 '+p.campaign_id;}if(b.type==='relation')b.items=['原推荐 '+(p.origin_parent_id||'无'),'代理 '+p.agent_id,'当前营销上级 '+(p.marketing_parent_id||'无')];if(b.type==='stats')b.items=[{label:'参与代理',value:list.length},{label:'营销老板',value:list.filter(x=>x.role==='BOSS').length},{label:'待审关系',value:(backend.linkRelations||[]).filter(x=>x.status==='PENDING').length}];if(b.type==='ledger')b.items=(backend.linkRewards||[]).filter(x=>x.recipient_agent_id===p.agent_id).map(x=>[label(x.reward_type),x.order_id,'+'+money(x.amount)]);}out.push({type:'rows',title:'选择参与代理',items:list.map(x=>({label:'代理 '+x.agent_id,value:label(x.role),target:'link-member:'+x.agent_id}))},{type:'rows',title:'营销关系审核记录',items:(backend.linkRelations||[]).map(d=>({label:'代理 '+d.body.agentId,value:label(d.status)}))});}
 if(pageId==='G45'){
  const summary=backend.management.G45?.[0]||{},totals=summary.totals||[],income=totals.find(x=>x.category==='RECEIPT')?.amount||0;
  for(const b of out){
   if(b.type==='tabs')b.items=[state.shop];
   if(b.type==='stats')b.items.forEach((x,i)=>Object.assign(x,[{label:'累计账面收款',value:money(income)},{label:'导入账单明细',value:summary.statementRows||0},{label:'待核对明细',value:summary.pendingRows||0}][i]));
   if(b.type==='rows')b.items=totals.map(x=>({label:label(x.category),value:signedCurrency(x.amount)}));
   if(b.type==='chart'){
    const history=summary.history||[],peak=Math.max(1,...history.map(x=>Math.abs(Number(x.amount)||0)));
    b.title='账本净收支趋势';b.signed=true;
    b.values=history.map(x=>(Number(x.amount)||0)/peak*100);
    b.labels=history.map(x=>x.day.slice(5));
    b.actualValues=history.map(x=>signedCurrency(x.amount));
   }
  }
 }
 if(pageId==='G46'){
  const list=backend.management.G46||[];
  const line=list.find(r=>r.id===backend.reconciliationLine)||list.find(r=>!['MATCHED','RESOLVED'].includes(r.status))||list[0];
  if(!line)return [{type:'notice',title:'暂无对账明细',body:'请在后台资金与结算中导入账单，处理结果会同步到这里。'}];
  const adjustment=(backend.adjustments||[]).find(a=>a.line_id===line.id);
  for(const b of out){
   if(b.type==='notice'&&b.tone==='orange'){b.title=label(line.status);b.body=line.note||'账单处理中';}
   if(b.type==='rows')b.items=[{label:'业务单号',value:line.business_id},{label:'业务金额',value:line.expected_amount==null?'待核实':signedCurrency(line.expected_amount)},{label:'账单金额',value:signedCurrency(line.channel_amount)},{label:'账本差额',value:line.difference==null?'待核实':signedCurrency(line.difference)},{label:'处理状态',value:adjustment?label(adjustment.status):'尚未申请调整'}];
   if(b.type==='options')b.items=line.status==='AMOUNT_MISMATCH'&&!['PENDING','APPLIED'].includes(adjustment?.status)?['重新核对业务回执','申请账务调整']:['重新核对业务回执'];
  }
  if(adjustment){
   const evidence=displayJson(adjustment.evidence_json),proofs=Array.isArray(evidence.uploads)?evidence.uploads.filter(id=>/^FILE[0-9a-f]{32}$/.test(id)):[];
   const items=[{label:'调整单号',value:adjustment.id},{label:'申请理由',value:adjustment.reason||'—',multiline:true},{label:'申请人',value:financeActor(adjustment.requested_by)}];
   if(adjustment.reviewed_by)items.push({label:'复核人',value:financeActor(adjustment.reviewed_by)},{label:'复核意见',value:adjustment.review_reason||'—',multiline:true});
   out.splice(out.findIndex(b=>b.type==='options'),0,{type:'rows',title:'调整申请记录',items},...(proofs.length?[{type:'proofs',title:'已提交财务凭证',items:proofs}]:[]));
  }
  if(form.adjustment==='申请账务调整'&&line.status==='AMOUNT_MISMATCH'&&!['PENDING','APPLIED'].includes(adjustment?.status))out.splice(out.length-1,0,{type:'upload',title:'上传财务凭证'});
  out.push({type:'rows',title:'选择对账明细（最近500条）',items:list.map(r=>({label:r.business_id,value:label(r.status),target:'reconciliation-line:'+r.id}))});
 }
 if(pageId==='G06'){const r=backend.management.G06?.[0];if(r)for(const block of out){if(block.type==='rows')block.items=[{label:'商城名称',value:r.shop.name},{label:'当前拥有者',value:'会员 '+r.shop.ownerId},{label:'未完成订单',value:r.openOrders+'笔'},{label:'未完成售后',value:r.openRefunds+'笔'},{label:'售后期限未结束',value:r.afterSalesWindows+'项'},{label:'待清算收益账户',value:r.unsettledWallets+'个'},{label:'未完成提现',value:r.openWithdrawals+'笔'},{label:'待处理商城积分账户',value:r.pointAccounts+'个'}];if(block.type==='notice'){block.title=r.ready?'可提交交接清单':'请先完成未结业务处置';block.body='转让须重新完成商户授权；同拥有者合并转移库存与未来关系；历史订单和资金记录保留原归属。停业前须清空实物库存与商城积分。';}if(block.type==='fields')for(const field of block.items)if(field.key==='生效时间')field.label='生效时间（选填，留空立即）';}}
 if(pageId==='G38'){const list=backend.management.G38||[],d=list.find(d=>d.id===backend.selectedDowngrade)||list.find(d=>['PENDING','REVIEW_REQUIRED'].includes(d.status)),c=d?.body;const ranks={1:'云代理',2:'分货中心',3:'总代理'};if(!d)return [{type:'notice',title:'暂无待审核降级',body:'启用降级方案后，系统按已结束的完整季度或年度核算。可在后台配置方案并查看周期证据。'},{type:'rows',items:list.map(d=>({label:d.body?.name||d.id,value:label(d.status),target:'downgrade-record:'+d.id}))}];for(const block of out){if(block.type==='notice'){block.title=c.name;block.body='按原方案复核真实订单，审核后新订单使用新职级。';}if(block.type==='profile'){block.name='会员 '+d.member_id;block.subtitle=ranks[c.fromRank]+' → '+ranks[c.rank];}if(block.type==='rows')block.items=[{label:'考核周期',value:c.periodStart+' 至 '+c.periodEnd},{label:'连续未达标',value:c.failures+'期'},{label:'原职级',value:ranks[c.fromRank]},{label:'拟降职级',value:ranks[c.rank]},{label:'商城处置',value:c.rank===1?'经营中的商城须先完成处置':'可保留商城，需保证上下级职级有效'}];if(block.type==='options'){block.items=[ranks[c.rank]];}}out.push({type:'rows',title:'降级记录',items:list.map(x=>({label:'会员 '+x.member_id,value:label(x.status),target:'downgrade-record:'+x.id}))});}
 if(pageId==='M57'){const data=backend.invitation||{},c=data.campaign||{};for(const b of out){if(b.type==='hero')b.subtitle=data.enabled?'完成有效商品订单后计奖':'暂无进行中的邀请奖励活动';if(b.type==='rows')b.items=data.enabled?[{label:'好友完成首单',value:'最高¥'+money(c.firstOrderReward)},{label:'好友完成三单',value:'最高¥'+money(c.thirdOrderReward)},{label:'累计发放上限',value:'¥'+money(c.rewardCap)},{label:'有效商品门槛',value:'¥'+money(c.minOrderAmount)},{label:'截止时间（完成订单为准）',value:new Date(c.expiresAt).toLocaleDateString()},{label:'奖励承担',value:'以商城剩余可分配毛利为上限；每阶段仅一次'}]:[{label:'当前状态',value:'尚未启用'}];if(b.type==='stats')b.items.forEach((i,n)=>i.value=[data.invited||0,data.qualified||0,'¥'+money(data.earned||0)][n]);}}
 if(pageId==='M56')return marketingBlocks(backend.campaigns,products)
 if(pageId==='M50'){for(const b of out)if(b.type==='rows')for(const i of b.items)if(i.target==='checkin'){const r=backend.checkinRewards||{};i.value=(Number(r.platform||0)+Number(r.shop||0))>0?'可领平台'+(r.platform||0)+' / 商城'+(r.shop||0)+'积分':'今日已签到';}const stats=out.filter(b=>b.type==='stats');[account.platformPoints,account.shopPoints].forEach((p,i)=>{if(stats[i])stats[i].items.forEach((s,j)=>{s.value=String([p.available,p.frozen?p.available:0,p.expiring||0][j]||0);if(j===0)s.target='M53'})})}
 if(pageId==='M53'){const stats=out.find(b=>b.type==='stats');if(stats)stats.items.forEach((s,i)=>s.value=[state.points+state.shopPoints,state.points,state.shopPoints][i])}
 if(['M45','M53'].includes(pageId)){const b=out.find(x=>x.type==='ledger');if(b)b.items=(pageId==='M53'?account.pointLedger||[]:account.ledger||[]).filter(x=>pageId==='M53'||!activeFilter||activeFilter==='全部'||({'零售毛利':['RETAIL','REFUND_RETAIL'],'级差收益':['LEVEL','REFUND_LEVEL'],'同级分红':['PEER','REFUND_PEER']}[activeFilter]||[]).includes(x.category)).map(x=>[label(x.kind||x.category)+(pageId==='M53'?' · '+(x.shop_id===0?'平台积分':'商城积分'):''),dateTimeLabel(x.created_at),(x.amount>=0?'+':'')+(pageId==='M53'?x.amount:money(x.amount)),pageId==='M45'&&(account.earnings||[]).find(e=>e.order_id===x.reference_id&&e.earning_type===x.category)?'earning:'+(account.earnings||[]).find(e=>e.order_id===x.reference_id&&e.earning_type===x.category).id:undefined])}
 
 if(pageId==='M16'&&backend.activeOrder){const status=backend.activeOrder.rawStatus;out[0].title=['PAID','SHIPPED','COMPLETED','REFUNDED'].includes(status)?'支付成功':label(status);out[0].value='¥'+money(backend.activeOrder.total);out.splice(3)}

 if(pageId==='M17'){out.length=0;if(backend.crossOrderHomeShopId)out.push({type:'notice',title:'跨店订单',body:backend.crossOrderPendingId?'本次授权已用于订单；可在下方继续支付或取消。再次采购需要重新申请授权。':'本次授权已用于订单；可在下方查看历史。再次采购需要重新申请授权。'});}
 if(['M36','M37'].includes(pageId)&&backend.agentData){const people=out.find(x=>x.type==='people');if(people)people.items=(pageId==='M36'?backend.agentData.customers:backend.agentData.children).map(p=>[p.name,p.rank_no?{1:'云代理',2:'分货中心',3:'总代理'}[p.rank_no]:'已绑定客户','',p.bound_at||label(p.status)])}
 if(pageId==='G18'){const sku=products.find(p=>p.id===form._warningSkuId);if(!sku)return [{type:'notice',title:'暂无可核对的库存商品',body:'请先在本商城上架商品'}];const stats=out.find(b=>b.type==='stats');if(stats)stats.items.forEach((x,i)=>x.value=[sku.stock,sku.locked||0,sku.warning_qty][i]);const ledger=out.find(b=>b.type==='ledger');if(ledger){ledger.items=(backend.management.G18||[]).filter(l=>l.sku_id===sku.id&&inventoryMatchesFilter(l,activeFilter)).map(l=>[inventoryReasonLabel(l.reason),l.reference_id+' · '+dateTimeLabel(l.created_at,{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}),inventoryDeltaLabel(l)]);if(!ledger.items.length){out.splice(out.indexOf(ledger),1);out.push({type:'notice',title:'暂无此类库存流水',body:'库存变动后会在这里显示。'});}}const product=out.find(b=>b.type==='product');if(product)product.id=sku.id}
 if(pageId==='G19'){const items=backend.management.G19||[];for(const b of out){if(b.type==='table')b.rows=items.map(p=>[p.name,String(Number(p.available||0)+Number(p.locked||0)),String(form[stocktakeKey(p.id)]??0)]);if(b.type==='fields'&&b.title==='盘点任务')b.items=b.items.map(i=>({...i,kind:'readonly',required:false}));if(b.type==='fields'&&b.title==='实盘录入')b.items=items.map(p=>({label:p.name+'实盘',key:stocktakeKey(p.id),kind:'number'}));}out.push({type:'notice',title:items.length?'盘点登记范围':'暂无可盘点商品',body:'仅提交下方列表商品的实盘数量。接口没有独立仓库、指定分类及指派负责人字段，提交人和时间由服务端记录。'});}
 if(pageId==='G36'&&backend.assessmentRuleReadOnly){const b=backend.assessmentRule?.body||{};if(!b.periodKind||b.periodKind==='ROLLING')form.考核周期='滚动'+Number(b.periodMonths??3)+'个月';if(b.periodKind==='CUSTOM')form.考核周期='自定义：'+b.startDate+' 至 '+b.endDate;for(const block of out){if(block.type==='fields')block.items=block.items.map(i=>({...i,kind:'readonly',required:false}));if(block.type==='options'){block.type='rows';block.items=[{label:'指标关系',value:b.operator==='WEIGHTED'?'加权指标':b.operator||'未配置'},{label:'周期类型',value:b.periodKind||'ROLLING'},{label:'周期月数',value:b.periodMonths??3}];}}out.push({type:'notice',title:'历史方案只读保护',body:backend.assessmentRuleReadOnly+' 原方案未修改，请在支持完整参数的管理端维护。'});if(b.operator==='WEIGHTED')out.push({type:'rows',title:'原加权参数',items:[{label:'销售指标权重',value:b.salesWeight??0},{label:'人数指标权重',value:b.peopleWeight??0},{label:'复购指标权重',value:b.repeatWeight??0},{label:'达标分数',value:b.scoreThreshold??'未配置'}]});}
 // 展示层标记盘点表格，原始明细和审核提交数据保持不变。
 if(pageId==='G20'){const d=backend.stocktake;if(!d)return [{type:'notice',title:'暂无盘点单',body:'从库存盘点任务提交真实盘点后，在这里进行差异复核。'},{type:'rows',items:[{label:'创建盘点任务',target:'G19'}]}];const body=d.body||JSON.parse(d.body_json||'{}'),items=body.items||[];const table=out.find(b=>b.type==='table');if(table){table.rows=items.map(i=>[i.name||i.skuId,String(Number(i.available)+Number(i.locked)),String(i.actual),String(i.delta)]);table.stocktakeReview=true;table.stocktakeId=d.id;}const stats=out.find(b=>b.type==='stats');if(stats)stats.items.forEach((s,i)=>s.value=[items.length,items.filter(i=>i.delta!==0).length,items.reduce((s,i)=>s+Number(i.delta),0)][i]);for(const b of out)if(b.type==='notice'){b.title=label(d.status);b.body=d.review_note||'盘点单 '+d.id+'，差异审核后更新库存。';}out.push({type:'rows',title:'选择真实盘点单',items:(backend.stocktakes||[]).map(x=>({label:x.id,value:label(x.status),target:'stocktake-select:'+x.id}))});}
 if(['G01','G02','G03'].includes(pageId)){const d=backend.management[pageId];if(d&&!Array.isArray(d)){const stats=out.find(x=>x.type==='stats');if(stats)stats.items.forEach((x,i)=>x.value=[money(d.history?.at(-1)?.amount||0),d.history?.at(-1)?.orders||0,pageId==='G01'?d.activeShops:pageId==='G02'?d.activeProducts:d.pendingShip,pageId==='G01'?d.agents:pageId==='G02'?d.newCustomers:d.pendingRefunds][i]??0);if(pageId==='G03'){const profile=out.find(b=>b.type==='profile');if(profile){profile.name=state.shop;profile.subtitle='拥有者 '+backend.member.name+' · '+({1:'云代理',2:'分货中心',3:'总代理'}[backend.agent?.rank_no]||'')}const notice=out.find(b=>b.type==='notice');if(notice){notice.title='今日经营提醒';notice.body=Number(d.stockWarnings)>0?d.stockWarnings+'件商品达到库存预警阈值，请及时补货。':'当前商品库存未触发预警。'}}const chart=out.find(b=>b.type==='chart');if(chart){const h=d.history||[];const max=Math.max(1,...h.map(x=>Number(x.amount)));chart.values=h.map(x=>Number(x.amount)/max*100);chart.labels=h.map(x=>x.day.slice(5));chart.actualValues=h.map(x=>money(x.amount))}}}
 if(['G01','G02'].includes(pageId)){
  const dashboard=backend.management[pageId],history=Array.isArray(dashboard.history)?dashboard.history:[];
  const amounts=history.map(day=>Math.max(0,Number(day.amount)||0)),peak=Math.max(1,...amounts);
  const chart=out.find(block=>block.type==='chart');
  if(chart){chart.values=amounts.map(amount=>amount/peak*100);chart.labels=history.map(day=>String(day.day||'').slice(5));chart.actualValues=amounts.map(amount=>money(amount));chart.periodLabel=history.length?'近'+history.length+'天':'暂无数据';}
 }
 if(pageId==='G01'){
  const d=backend.management.G01||{},day=d.history?.at(-1)?.day;
  for(const b of out){if(b.type==='profile'){b.name=state.shop+' · 管理总览';b.subtitle=(day||dateOnly(Date.now()))+' · 当前商城范围';}if(b.type==='rows'&&b.title==='待办事项')b.items=[{label:'独立商城申请',value:'平台负责审核',target:'G05'},{label:'提现申请',value:'查看实际申请',target:'G43'},{label:'库存预警',value:Number(d.stockWarnings||0)+'件达到阈值',target:'G17'}];}
 }
 return out;
}
