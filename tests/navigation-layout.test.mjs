import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {privacyFooter} from '../data/privacy-action.mjs'
import {marketingFooter,purchaseReceiptFooter,unavailableActionFooter} from '../data/action-footer.mjs'

test('整箱直发收货按钮不承诺入库，普通补货仍明确入库',()=>{
  assert.deepEqual(purchaseReceiptFooter({order_type:'DIRECT_SHIP'}),[{label:'确认收货',target:'stock-receive'}])
  assert.deepEqual(purchaseReceiptFooter({order_type:'WHOLESALE'}),[{label:'确认收货并入库',target:'stock-receive'}])
})

const styles = await readFile(new URL('../styles/design.scss', import.meta.url), 'utf8')
const screen = await readFile(new URL('../components/DesignScreen.vue', import.meta.url), 'utf8')
const photo = await readFile(new URL('../components/Photo.vue', import.meta.url), 'utf8')
const uiBlock = await readFile(new URL('../components/UiBlock.vue', import.meta.url), 'utf8')

test('资料头像未配置时使用现有用户图标，真实图片失败仍显式报错',()=>{
  assert.match(photo,/asset==='avatar'&&props\.fallback==='avatar'\)avatarPlaceholder\.value=true/)
  assert.match(photo,/v-else-if="avatarPlaceholder"[^>]*aria-label="默认头像"/)
  assert.match(photo,/function imageFailed\(\)\{imageUrl\.value='';failed\.value=true\}/)
  assert.match(photo,/v-else-if="failed" class="photo-unavailable">图片暂不可用/)
})

test('登录页在装修数据加载前也从服务端读取装饰图和头像',()=>{
  assert.match(screen,/<Photo asset="loginScene"\/>/)
  assert.match(screen,/<Photo asset="avatar" :radius="60"\/>/)
  assert.match(photo,/asset==='avatar'&&props\.fallback==='avatar'\)avatarPlaceholder\.value=true/)
  assert.match(photo,/\^\[A-Za-z\]\[A-Za-z0-9_-\]\{0,63\}\$\/\.test\(asset\)\)imageUrl\.value=apiBase\+'\/hexu\/app\/ui-assets\/'\+asset/)
})

test('经营商品封面使用授权附件读取，会员商品仍走公开图片',async()=>{
  const backend=await readFile(new URL('../data/backend.js',import.meta.url),'utf8')
  assert.match(uiBlock,/<Photo :asset="p\.asset" :private-attachment="!!block\.privateProductAssets"\/>/)
  assert.match(uiBlock,/<Photo :asset="prod\.asset" :private-attachment="!!block\.privateProductAssets"\/>/)
  for(const page of ['G09','G11','G13','G17'])assert.match(backend,new RegExp("pageId==='"+page+"'[\\s\\S]*?privateProductAssets"))
  assert.match(photo,/privateFile\?\[apiBase\+'\/hexu\/app\/attachments\/'\+asset\]/)
  assert.match(uiBlock,/p\.badge\|\|'精选'/)
  assert.match(backend,/PENDING:'待审核'/)
})

test('经营端编辑已有商品的封面与商品列表使用同一公开图片地址',()=>{
  assert.match(uiBlock,/<view class="upload-photo"><Photo :asset="block\.existingAsset" :height="78"\/><\/view>/)
  assert.match(uiBlock,/\.upload-photo\{width:100%;height:100%;flex:none\}/)
  assert.match(photo,/asset\.startsWith\('\/hexu\/'\)\)imageUrl\.value=apiBase\+asset/)
  assert.match(photo,/imageUrl\.value=apiBase\+'\/hexu\/app\/ui-assets\/'\+asset/)
})

test('底部菜单允许购物车角标超出按钮边界，避免被默认 overflow 裁切', () => {
  const rules = [...styles.matchAll(/\.tabbar button\s*\{([^}]+)\}/g)]
  const overflow = rules.flatMap(rule => [...rule[1].matchAll(/overflow\s*:\s*([^;}]+)/g)])
  assert.equal(overflow.at(-1)?.[1].trim(), 'visible')
})

test('原生禁用底部按钮使用显式class保留背景文字，不依赖属性选择器继承白底',()=>{
  assert.match(screen, /'is-disabled':item\.disabled/)
  assert.match(screen, /'is-disabled':!accountDataReady\|\|!selectedLinesReady\|\|backend\.cartMutating\|\|backend\.busy/)
  assert.match(styles,/\.mobile-app \.primary\.is-disabled\{background:#155641;color:#fff;opacity:\.42\}/)
  assert.match(styles,/\.mobile-app \.outline\.is-disabled\{background:#fff;color:#37613d;opacity:\.42\}/)
})

test('空购物车不渲染空的店铺卡片或无效管理按钮',()=>{
  const cart = screen.match(/<template v-else-if="screen\.layout==='cart'">([\s\S]*?)<\/template>/)?.[1]
  assert.ok(cart)
  assert.match(cart, /<view v-if="state\.cart\.length" class="card">/)
  assert.match(cart, /<button v-if="accountDataReady&&state\.cart\.length" class="plain"/)
  assert.match(cart, /<view v-if="accountDataReady&&!state\.cart\.length" class="empty-state">/)
})

test('地址清空后显示说明，读取完成前不误报空地址',()=>{
 const addresses=screen.match(/<template v-else-if="screen\.layout==='addresses'">([\s\S]*?)<\/template>/)?.[1]
 assert.ok(addresses)
 assert.match(addresses, /v-if="accountDataReady&&!state\.addresses\.length" class="empty-state"/)
 assert.match(addresses, /暂无收货地址/)
 assert.match(addresses, /点击下方按钮添加收货地址/)
})

test('个人资料未读取成功时底部操作引导重新读取而非误导保存',()=>{
  assert.match(screen, /label:backend\.profileError\|\|!form\._hydrated\?'重新读取资料'/)
  assert.match(screen, /target:backend\.profileError\|\|!form\._hydrated\?'profile-refresh':'save'/)
})

test('隐私协议未载入或请求失败时只能重试，不能误提交授权', async()=>{
  const policies={USER_AGREEMENT:{version:'V2.3'},PRIVACY_POLICY:{version:'V1.4'}}
  const loaded={ready:true,policies,pageLoading:{M27:0},operationError:'',busy:false}
  assert.deepEqual(privacyFooter(loaded),[{label:'确认当前版本授权',target:'privacy-consent'}])
  for(const state of [
    {...loaded,ready:false},
    {...loaded,operationError:'读取失败'},
    {...loaded,policies:{}},
    {...loaded,policies:{USER_AGREEMENT:{version:'V2.3'}}}
  ]) assert.deepEqual(privacyFooter(state),[{label:'重新读取协议',target:'privacy-refresh'}])
  assert.deepEqual(privacyFooter({...loaded,pageLoading:{M27:1}}),[{label:'正在读取协议',disabled:true}])
  assert.match(screen, /if\(pageId==='M27'\)return privacyFooterItems\.value/)
  assert.match(screen, /v-for="\(item,i\) in visibleFooterItems"/)
  const backend=await readFile(new URL('../data/backend.js',import.meta.url),'utf8')
  assert.match(backend,/pageId==='M27'&&target==='privacy-refresh'\)\{await pageData\(pageId,form\);return true\}/)
})

test('标准页业务内容不可用时只可重试或登录，不展示提交按钮',()=>{
  const offline={ready:false,guest:false,busy:false,pageLoading:{M30:0}}
  assert.deepEqual(unavailableActionFooter(offline,'M30'),[{label:'重新读取业务数据',target:'action-page-refresh',disabled:false}])
  assert.deepEqual(unavailableActionFooter({...offline,pageLoading:{M30:1}},'M30'),[{label:'正在读取业务数据',target:'action-page-refresh',disabled:true}])
  assert.deepEqual(unavailableActionFooter({...offline,busy:true},'M29','客服资料'),[{label:'重新读取客服资料',target:'action-page-refresh',disabled:true}])
  assert.deepEqual(unavailableActionFooter({...offline,guest:true},'M30'),[{label:'登录后继续',target:'M01'}])
  assert.equal(unavailableActionFooter({...offline,ready:true},'M30'),null)
  assert.deepEqual(unavailableActionFooter({...offline,ready:true,pageLoading:{M30:1}},'M30'),[{label:'正在读取业务数据',target:'action-page-refresh',disabled:true}])
  assert.deepEqual(unavailableActionFooter({...offline,ready:true},'M30','业务数据',[{type:'notice',title:'业务数据读取失败'}]),[{label:'重新读取业务数据',target:'action-page-refresh',disabled:false}])
  assert.equal(unavailableActionFooter({...offline,ready:true},'M30','业务数据',[{type:'notice',title:'支付结果尚未确认'}]),null)
  assert.deepEqual(unavailableActionFooter({...offline,ready:true,actionPageErrors:{M30:'读取失败'}},'M30'),[{label:'重新读取业务数据',target:'action-page-refresh',disabled:false}])
  assert.match(screen,/unavailableActionFooter\(backend,pageId,pageId==='M29'\?'客服资料':'业务数据',displayBlocks\.value\)/)
  assert.match(screen,/!\['M26','M28'\]\.includes\(pageId\)/)
})

test('限时活动无活动时禁用购买，有活动时先引导选品而非空单结算',()=>{
  assert.deepEqual(marketingFooter([]),[{label:'暂无进行中的活动',disabled:true}])
  assert.deepEqual(marketingFooter(undefined),[{label:'暂无进行中的活动',disabled:true}])
  assert.deepEqual(marketingFooter([{id:'campaign-1'}]),[{label:'立即购买',target:'M04'}])
  assert.deepEqual(marketingFooter([{id:'campaign-1',available:false}]),[{label:'活动名额已满',disabled:true}])
  assert.match(screen,/if\(pageId==='M56'\)return marketingFooter\(backend\.campaigns\)/)
})

test('消息分类为空时显示真实空态，加载或读取失败时不冒充空数据',()=>{
  assert.match(uiBlock,/!messages\.length&&backend\.ready&&state\.serverHydrated&&!backend\.pageLoading\.M64/)
  assert.match(uiBlock,/暂无符合条件的消息/)
})
