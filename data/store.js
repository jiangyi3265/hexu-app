import { reactive } from 'vue'
import { initialState } from './store-state.mjs'
import { cartProductSnapshot } from './cart-item-display.mjs'
const key = 'hexu-ui-state-v2'
// Cached navigation/recovery context is retained, but visible account data
// must be verified by /hexu/app/bootstrap after every cold start.
let saved
try { saved = uni.getStorageSync(key) } catch {}
export const state = reactive(initialState(saved))
export const persist = () => { try { uni.setStorageSync(key,JSON.parse(JSON.stringify(state))) } catch {} }
export function notify(message){ state.notifications.unshift({message,time:new Date().toLocaleString('zh-CN')});persist() }
export const products = reactive([])
export const money = cents => (Math.round(Number(cents)||0)/100).toFixed(2)
export function navigate(id) { uni.navigateTo({url:'/pages/'+id+'/index',fail:()=>uni.redirectTo({url:'/pages/'+id+'/index'})}) }
export function toast(title) { uni.showToast({title,icon:'none'}) }
export function addCart(id,qty=1) { const product=products.find(p=>p.id===id);if(!product||!Number.isSafeInteger(qty)||qty<1||qty>product.stock)return false;const line=state.cart.find(p=>p.id===id);if(line){if(!Number.isSafeInteger(line.qty)||line.qty+qty>product.stock)return false;line.qty+=qty;line.snapshot=cartProductSnapshot(product)}else state.cart.push({id,qty,selected:true,snapshot:cartProductSnapshot(product)});persist();return true }
export function cartTotal(){return state.cart.filter(p=>p.selected).reduce((sum,line)=>sum+(products.find(p=>p.id===line.id)?.price||0)*line.qty,0)}

