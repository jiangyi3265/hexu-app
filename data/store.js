import { reactive } from 'vue'
const key = 'hexu-ui-state-v1'
const defaults = { cart: [{id:'cup',qty:1,selected:true},{id:'paper',qty:2,selected:true},{id:'oil',qty:1,selected:false}], favorites:['stapler','cup','paper'], addresses:[{name:'张三',phone:'13888881234',region:'浙江省 杭州市 西湖区',detail:'文三路258号数码大厦1208室',primary:true},{name:'李四',phone:'13966667788',region:'上海市 浦东新区',detail:'世纪大道100号陆家嘴金融中心A座1806室'}], points:2480, balance:428680, orders:[], notifications:[], changes:{}, signedIn:false, signedToday:false, shop:'安溪禾序商城' }
let saved
try { saved = uni.getStorageSync(key) } catch {}
export const state = reactive({...defaults,...(saved && typeof saved === 'object' ? saved : {})})
export const persist = () => { try { uni.setStorageSync(key,JSON.parse(JSON.stringify(state))) } catch {} }
export function notify(message){ state.notifications.unshift({message,time:new Date().toLocaleString('zh-CN')});persist() }
export const products = reactive([
{id:'stapler',name:'晨光 订书机 ABS9166',desc:'简约商务 · 装订省力 · 办公学习常备',spec:'黑色 / 标准款',price:2000,agent:1000,stock:32,asset:'stapler'},
{id:'cup',name:'禾序 316不锈钢保温杯',desc:'500ml 大容量 | 米白色',spec:'500ml / 米白色',price:8900,agent:5500,stock:120,asset:'cup'},
{id:'paper',name:'清风 抽取式面巾纸',desc:'3层100抽 · 6包',spec:'原木清香 / 6包',price:2990,agent:1800,stock:48,asset:'paper'},
{id:'oil',name:'金龙鱼 食用植物调和油',desc:'5L | 非转基因',spec:'5L',price:7990,agent:5600,stock:3,asset:'oil'},
{id:'lamp',name:'南孚 LED护眼台灯',desc:'三档光 · 柔和护眼',spec:'白色 / 标准款',price:15900,stock:0,asset:'lamp'},
{id:'towel',name:'禾序 纯棉毛巾三件套',desc:'柔软亲肤 · 生活好物',price:6900,stock:200,asset:'towel'},
{id:'umbrella',name:'禾序 晴雨两用伞',desc:'轻巧便携',price:5900,stock:80,asset:'umbrella'},
{id:'sofa',name:'全棉四件套 纯棉床品',desc:'柔软亲肤',price:19900,stock:46,asset:'sofa'}
])
export const money = cents => (Math.round(Number(cents)||0)/100).toFixed(2)
export function navigate(id) { uni.navigateTo({url:'/pages/'+id+'/index',fail:()=>uni.redirectTo({url:'/pages/'+id+'/index'})}) }
export function toast(title) { uni.showToast({title,icon:'none'}) }
export function addCart(id,qty=1) { const product=products.find(p=>p.id===id);if(!product||qty<1||qty>product.stock)return false;const line=state.cart.find(p=>p.id===id);if(line){if(line.qty+qty>product.stock)return false;line.qty+=qty}else state.cart.push({id,qty,selected:true});persist();return true }
export function cartTotal(){return state.cart.filter(p=>p.selected).reduce((sum,line)=>sum+(products.find(p=>p.id===line.id)?.price||0)*line.qty,0)}

