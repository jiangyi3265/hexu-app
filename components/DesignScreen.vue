<template>
  <view class="app-stage">
    <!-- #ifdef H5 -->
    <aside class="desktop-guide"><view class="guide-brand"><Icon name="leaf" :size="30"/><text>禾序商贸</text></view><text class="guide-caption">品质连接美好生活</text><text class="guide-kicker">DESIGN TO EXPERIENCE</text><text class="guide-title">{{pageTitle}}</text><text class="guide-description">{{pageId}} · 画布 {{String(screen.board).padStart(2,'0')}} / 32</text><view class="guide-actions"><button @tap="navigate('catalog')">查看全部 128 个页面 <Icon name="grid" :size="18"/></button><button @tap="navigate(management?'M02':'G01')">{{management?'切换商城端':'切换管理端'}} <Icon name="arrow" :size="18"/></button></view><view class="guide-pager"><button :disabled="index===0" @tap="navigate(catalog[index-1].id)">← 上一页</button><button :disabled="index===127" @tap="navigate(catalog[index+1].id)">下一页 →</button></view><text class="preview-note">{{backend.ready?'商城数据已连接':'正在连接业务服务'}}<br/>支付渠道接入准备中</text></aside>
    <!-- #endif -->
    <view :class="['mobile-app',{management, 'home-screen':screen.layout==='home', 'login-screen':screen.layout==='login','category-page':screen.layout==='category'}]" :data-page-id="pageId">
      <!-- #ifdef H5 -->
      <view class="status-bar"><text>9:41</text><view class="status-icons"><text>▮▮▮</text><text>◒</text><view class="battery"/></view></view>
      <!-- #endif -->
      <view class="native-status-spacer" :style="{height:nativeStatusBarHeight+'px'}"/>
      <!-- #ifndef H5 -->
      <view v-if="nativeStatusBarHeight" class="native-status-mask" :style="{height:nativeStatusBarHeight+'px'}"/>
      <!-- #endif -->
      <view v-if="screen.layout!=='login'&&screen.layout!=='home'" :class="['page-header',{'primary-tab-header':isPrimaryTab}]"><button v-if="!isPrimaryTab" class="icon-button" aria-label="返回" @tap="back"><Icon name="back"/></button><view v-else class="icon-button" aria-hidden="true"/><text>{{pageTitle}}</text><button class="icon-button" aria-label="页面目录" @tap="navigate('catalog')"><Icon name="grid" :size="19"/></button></view>
      <view v-if="screen.layout==='home'" class="store-header"><view class="spread"><view class="store-brand" @tap="screen.dealer&&navigate('M42')">{{decoration.brandName||'禾序商贸'}} <text v-if="!screen.dealer" class="brand-badge">{{decoration.badge||'公司直营'}}</text><view v-else class="dealer-switch"><text class="dealer-name">| {{backend.shopInfo?.name||state.shop}}</text><Icon name="chevron" :size="14" class="dealer-chevron"/></view></view><view class="header-actions"><button class="icon-button" aria-label="购物车" @tap="navigate('M11')"><Icon name="cart"/></button><button class="icon-button" aria-label="客服" @tap="navigate('M29')"><Icon name="headset"/></button></view></view><text class="muted tiny">{{screen.dealer?'◉ '+(backend.shopInfo?.county||'地区待配置'):(decoration.slogan||'正品好货 · 品质生活')}}</text><view class="search-bar" @tap="navigate('M04')"><Icon name="search" :size="17"/><text class="muted">{{screen.dealer?(decoration.dealerSearchPlaceholder||'搜索本店商品'):(decoration.searchPlaceholder||'搜索商品、品牌、生活好物')}}</text></view></view>
      <view :class="['screen-content',{'with-footer':!!screen.footer||specialFooter,'with-nav':screen.nav&&!specialFooter,'cart-content':screen.layout==='cart', 'flush':screen.layout==='login'||screen.layout==='category','category-screen':screen.layout==='category','finance-screen':['G39','G42'].includes(pageId)}]">
        <template v-if="screen.layout==='login'">
          <view class="login-landscape"><Photo asset="loginScene"/></view>
          <view class="login-panel"><view class="login-avatar"><Photo asset="avatar" :radius="60"/></view><text class="login-title">你好，微信用户</text><text class="muted">授权后即可快速登录</text><button class="primary full" @tap="handle('login')">一键登录（微信授权）</button><text v-if="isLocalSandbox()" class="muted tiny">开发环境登录，不调用微信授权</text><view class="consent-box"><view class="consent" @tap="form.consent=!form.consent"><view :class="['checkbox',{checked:form.consent}]">{{form.consent?'✓':''}}</view><text class="tiny">我已阅读并同意 <text class="green" @tap.stop="handle('policy')">《用户协议》《隐私政策》</text></text></view></view><button class="secondary full" @tap="goHome">进入浏览</button><text class="muted tiny">不同意授权也可浏览商城，暂不登录</text></view>
        </template>
        <template v-else-if="screen.layout==='home'&&backend.error&&!backend.ready">
          <view class="card"><text class="section-title">业务数据暂不可用</text><view class="notice">{{backend.error}}</view><button class="primary full" :disabled="!!backend.pageLoading[pageId]" @tap="handle('action-page-refresh')">{{backend.pageLoading[pageId]?'正在重试…':'重试读取'}}</button></view>
        </template>
        <template v-else-if="screen.layout==='home'">
          <HomeCarousel :banners="decoration.banners" :coupons="backend.coupons" :coupons-ready="backend.ready&&state.serverHydrated" :dealer="!!screen.dealer" :active="pageVisible" @action="navigate"/>
          <view class="home-categories"><button v-for="(item,i) in homeCategories" :key="item[0]" @tap="navigate(item[2])"><view :class="['category-icon','category-icon-'+i]"><Icon :name="item[1]" :size="27"/></view><text>{{item[0]}}</text></button></view>
          <view class="section-heading"><view><text class="section-title">{{screen.dealer?'为你推荐':'精选推荐'}}</text><text v-if="!screen.dealer" class="muted tiny">品质好物 · 生活更进一步</text></view><text class="muted tiny" @tap="navigate('M04')">更多 ›</text></view><view v-if="screen.dealer" class="sort-bar"><text :class="{green:sort==='default'}" @tap="sort='default'">综合</text><text @tap="sort='sales'">销量</text><text @tap="sort=sort==='asc'?'desc':'asc'">价格 ↕</text></view>
          <view class="products home-products"><view v-for="p in homeProducts" :key="p.id" class="product-card" @tap="selectProduct(p.id)"><view class="goods-photo"><Photo :asset="p.asset"/></view><view class="goods-info"><text class="product-name">{{p.name}}</text><text class="small">{{p.desc}}</text><view class="product-tags"><text>品质好物</text><text>精选推荐</text></view><view class="spread"><text class="price">¥{{money(p.price)}}</text><button :class="['add-round',{'is-disabled':isSoldOut(p)}]" :disabled="isSoldOut(p)" :aria-label="isSoldOut(p)?'暂时缺货':'加入购物车'" @tap.stop="cartAdd(p.id)"><Icon name="cart" :size="19" color="white"/></button></view></view></view></view>
        </template>
        <template v-else-if="screen.layout==='category'">
          <view class="category-search search-bar"><Icon name="search" :size="16"/><input v-model="search" placeholder="搜索商品" @confirm="searchApplied=search"/><button class="search-button" @tap="searchApplied=search">搜索</button></view>
          <view class="category-layout">
            <scroll-view scroll-y enable-flex class="category-sidebar"><button v-for="item in categories" :key="item" :class="{active:category===item}" @tap="category=item">{{item}}</button></scroll-view>
            <view class="category-pane">
              <view class="sort-bar"><button :class="{green:sort==='default'}" @tap="sort='default'">综合</button><button @tap="sort='sales'">销量</button><button @tap="sort=sort==='asc'?'desc':'asc'">价格 ↕</button></view>
              <scroll-view scroll-y class="category-results">
                <view v-for="p in categoryProducts" :key="p.id" class="category-product" @tap="selectProduct(p.id)"><view class="category-photo"><Photo :asset="p.asset"/></view><view class="flex-one"><text class="product-name">{{p.name}}</text><text class="product-tag">{{p.spec||p.desc}}</text><text class="price">¥{{money(p.price)}}</text><view class="spread"><text v-if="!backend.guest" class="tiny muted">月销 {{p.sales||0}}</text><button :class="['add-round',{'is-disabled':isSoldOut(p)}]" :disabled="isSoldOut(p)" :aria-label="isSoldOut(p)?'暂时缺货':'加入购物车'" @tap.stop="cartAdd(p.id)"><Icon name="cart" color="white" :size="17"/></button></view></view></view>
                <view v-if="!catalogDataReady" class="notice">{{backend.error||'正在读取业务数据'}}</view>
                <text v-else-if="!categoryProducts.length" class="empty-text">暂无相关商品，试试其他分类</text>
                <text v-if="catalogDataReady&&categoryProducts.length" class="end-line">没有更多商品了</text>
              </scroll-view>
            </view>
          </view>
        </template>
        <template v-else-if="(screen.layout==='product'||screen.layout==='sku')&&catalogDataReady&&currentProduct.id">
          <view class="detail-photo"><ProductGallery :product="currentProduct"/></view><view class="card detail-info"><view class="spread"><view><text v-if="screen.agent&&!backend.guest&&!!backend.agent" class="badge">{{agentPriceLabel}}</text><text class="detail-price">¥{{money(currentProduct.price)}}</text><text v-if="screen.agent&&!backend.guest&&!!backend.agent&&agentRetailPrice!==null" class="muted tiny">零售价 ¥{{money(agentRetailPrice)}}</text></view><button class="icon-button" aria-label="分享商品" @tap="handle('share')"><Icon name="share"/></button></view><text class="detail-name">{{currentProduct.name}}</text><text class="muted small">{{currentProduct.desc}}</text><view class="spread muted tiny"><text>快递：结算时核算</text><text v-if="!backend.guest">月销{{currentProduct.sales||0}}</text><text v-if="!backend.guest">库存{{currentProduct.stock}}件</text></view><text v-if="screen.agent&&!backend.agent" class="muted tiny">{{backend.guest?'登录并通过本商城代理审核后可查看代理价':'当前按零售价展示，通过本商城代理审核后可查看代理价'}}</text></view><view class="card"><view class="info-row" @tap="navigate('M07')"><text class="muted">已选</text><text class="flex-one">{{form.spec||currentProduct.spec}} × {{qty}}</text><Icon name="chevron" :size="16"/></view><view class="info-row"><text class="muted">配送</text><text>{{address.region||'请选择收货地址'}}</text></view><view class="service-strip"><text>✓ 正品保障</text><text>✓ 售后无忧</text><text>✓ 安全支付</text></view></view>
          <view v-if="screen.layout==='sku'" class="card sku-panel"><text class="section-title">颜色分类</text><view class="chips"><button v-for="v in productVariants" :key="v.id" :class="{selected:currentProduct.id===v.id}" @tap="selectVariant(v)">{{v.spec||v.name}}</button></view><view class="info-row"><text class="flex-one">购买数量</text><view class="stepper"><button :disabled="qty<=1" @tap="setProductQty(qty-1)">−</button><text>{{qty}}</text><button :disabled="!canIncreaseProductQty" @tap="setProductQty(qty+1)">+</button></view></view><text class="muted tiny">{{backend.guest?'登录后可选购':'库存 '+currentProduct.stock+' 件'}}</text><text v-if="currentProduct.crossPurchaseRemaining!=null" class="green small">跨店授权价剩余可购 {{currentProduct.crossPurchaseRemaining}} 件</text></view><template v-else><view class="card"><view class="spread" @tap="handle('M09')"><text class="section-title">商品评价（{{backend.reviews.length}}）</text><text class="green small">{{backend.reviews.length?Math.round(backend.reviews.filter(r=>r.rating>=4).length/backend.reviews.length*100)+'%好评':'暂无评价'}} ›</text></view><text class="small">{{backend.reviews[0]?.name||'暂无评价'}} <text class="gold">{{'★'.repeat(Number(backend.reviews[0]?.rating)||0)}}</text></text><text class="review-text">{{backend.reviews[0]?.content||'期待您的真实购买评价'}}</text></view><text class="section-title centered">商品详情</text><view class="product-detail-poster"><Photo :asset="currentProduct.asset"/><text>{{currentProduct.description||'品质之选 · 每一处都用心'}}</text></view></template>
        </template>
        <view v-else-if="(screen.layout==='product'||screen.layout==='sku')&&catalogDataReady" class="notice">商品暂不可售，请返回列表重新选择</view>
        <template v-else-if="screen.layout==='cart'">
          <view class="spread cart-title"><text>共 {{accountDataReady?cartQuantity:'—'}} 件商品</text><button v-if="accountDataReady&&state.cart.length" class="plain" @tap="editingCart=!editingCart">{{editingCart?'完成':'管理'}}</button></view>
          <view v-if="state.cart.length" class="card"><view class="shop-heading"><Icon name="shop" :size="20"/><text class="bold">{{state.shop}}</text></view><view v-for="line in state.cart" :key="line.id" class="cart-line"><view :class="['checkbox',{checked:line.selected}]" @tap="toggleLine(line)">{{line.selected?'✓':''}}</view><view class="product-thumb" @tap="selectProduct(line.id)"><Photo :asset="cartDisplayProduct(line,products).asset"/></view><view class="product-copy"><text class="product-name">{{cartDisplayProduct(line,products).name}}</text><text v-if="cartDisplayProduct(line,products).unavailable" class="muted tiny cart-sku">SKU {{line.id}}</text><text class="muted tiny">{{cartDisplayProduct(line,products).spec}}</text><view class="spread"><text class="price">{{cartDisplayProduct(line,products).unavailable?'暂不可售':'¥'+money(cartDisplayProduct(line,products).price)}}</text><view class="stepper"><button @tap="changeQty(line,-1)">−</button><text>{{line.qty}}</text><button @tap="changeQty(line,1)">+</button></view></view></view><button v-if="editingCart" class="icon-button" aria-label="删除商品" @tap="deleteCart(line)"><Icon name="trash" :size="18"/></button></view></view>
          <view v-if="accountDataReady&&selectedLines.length&&!selectedLinesReady" class="notice">所选商品已变化，请取消勾选或删除失效商品后结算</view>
          <view v-if="accountDataReady&&!state.cart.length" class="empty-state"><Icon name="cart" :size="50"/><text>购物车还是空的</text><button class="primary" @tap="goHome">去逛逛</button></view>
          <view class="cart-tip"><UiBlock :block="{type:'notice',title:'温馨提示',body:'库存和价格以下单确认时为准，优惠在结算页计算。'}" :form="form"/></view>
        </template>
        <template v-else-if="screen.layout==='checkout'&&createdCheckoutOrder">
          <view class="notice">订单 {{createdCheckoutOrder.id}} 已创建，金额以订单详情为准。</view>
          <button class="primary full" @tap="returnToOrderDetail">查看订单并继续支付</button>
        </template>
        <template v-else-if="screen.layout==='checkout'&&accountDataReady&&selectedLinesReady">
          <view v-if="quoteError" class="card"><text class="red">{{quoteError}}</text><button class="outline full" @tap="backToCheckoutSource">{{checkoutReturnLabel}}</button></view>
          <view v-if="quoteChangeNotice" class="card"><text class="red">{{quoteChangeNotice}}</text></view>
          <view class="card address-choice" @tap="navigate('M13')"><Icon name="pin" :size="25"/><view class="flex-one"><text class="bold">{{address.name}} {{address.phone}}</text><text class="small muted">{{address.region}} {{address.detail}}</text></view><Icon name="chevron" :size="18"/></view>
          <view class="card">
            <view class="shop-heading"><Icon name="shop"/><text class="bold">{{state.shop}}</text></view>
            <view v-for="line in selectedLines" :key="line.id" class="product-line inner"><view class="product-thumb"><Photo :asset="findProduct(line.id).asset"/></view><view class="product-copy"><text class="product-name">{{findProduct(line.id).name}}</text><text class="tiny muted">{{findProduct(line.id).spec}} × {{line.qty}}</text><text class="price">¥{{money(findProduct(line.id).price)}}</text></view></view>
            <view class="info-row"><text class="row-label">配送方式</text><text class="row-value">{{!checkoutQuote?(quoteError?'运费核算未完成':'正在核算运费'):freight?'普通快递 · ¥'+money(freight):'普通快递 · 包邮'}}</text></view>
            <view class="info-row" @tap="checkoutQuote&&!couponStackBlocked&&!state.buyNow?.groupId&&!state.buyNow?.groupCampaignId&&navigate('M61')"><text class="row-label">优惠券</text><text class="row-value red">{{state.buyNow?.groupId||state.buyNow?.groupCampaignId?'拼团价不叠加优惠券':couponStackBlocked?'当前活动不叠加优惠券':!checkoutQuote?'正在核算优惠':couponDiscount?'−¥'+money(couponDiscount):'选择优惠券'}}</text><Icon v-if="checkoutQuote&&!couponStackBlocked&&!state.buyNow?.groupId&&!state.buyNow?.groupCampaignId" name="chevron" :size="14"/></view>
            <view class="info-row"><text class="row-label">积分抵扣（可用{{state.points}}）</text><switch :checked="!!form.usePoints&&!state.buyNow?.groupId&&!state.buyNow?.groupCampaignId" :disabled="!!state.buyNow?.groupId||!!state.buyNow?.groupCampaignId" color="#155641" @change="onCheckoutPointsChange"/></view>
            <view class="field field-textarea checkout-remark"><text class="field-label">买家留言（选填）</text><textarea :value="form.remark||''" maxlength="200" placeholder="请输入留言，与商家协商一致" aria-label="买家留言" @input="onCheckoutRemarkInput"/></view>
          </view>
          <UiBlock v-if="checkoutQuote" :block="{type:'rows',title:'费用明细',items:[{label:'商品金额',value:'¥'+money(total)},{label:checkoutDiscountLabel(checkoutQuote,!!(state.buyNow?.groupId||state.buyNow?.groupCampaignId)),value:'−¥'+money(discount)},{label:'积分抵扣',value:'−¥'+money(pointsDiscount)},{label:'运费',value:'¥'+money(freight)},{label:'实付款',value:'¥'+money(payTotal)}]}" :form="form"/>
          <view v-if="checkoutQuote" class="consent" @tap="form.orderConsent=!form.orderConsent"><view :class="['checkbox',{checked:form.orderConsent}]">{{form.orderConsent?'✓':''}}</view><text class="tiny muted">已确认商品、地址和金额，并同意购买协议</text></view>
        </template>
        <template v-else-if="screen.layout==='addresses'"><view v-for="(a,i) in state.addresses" :key="i" class="card address-card"><view class="spread" @tap="selectAddress(i)"><text class="bold">{{a.name}} <text class="muted">{{a.phone}}</text></text><text v-if="a.primary" class="badge">默认</text></view><text class="address-detail" @tap="selectAddress(i)">{{a.region}} {{a.detail}}</text><view class="spread address-actions"><button class="plain" @tap="setDefault(i)"><view :class="['radio',{checked:a.primary}]">{{a.primary?'✓':''}}</view>设为默认</button><view class="inline-actions"><button class="plain" @tap="editAddress(i)"><Icon name="edit" :size="16"/>编辑</button><button class="plain" @tap="removeAddress(i)"><Icon name="trash" :size="16"/>删除</button></view></view></view><view v-if="accountDataReady&&!state.addresses.length" class="empty-state"><Icon name="pin" :size="50"/><text>暂无收货地址</text><text class="small muted">点击下方按钮添加收货地址</text></view></template>
        <template v-else-if="screen.layout==='orders'"><UiBlock :block="{type:'tabs',items:['全部','待付款','待发货','待收货','已完成']}" :form="form" :filter="filter" @filter="filter=$event"/><UiBlock :block="{type:'orderList'}" :form="form" :filter="filter" @action="handle"/></template>
        <template v-else-if="screen.layout==='profile'"><view class="profile-hero"><view class="profile-card" @tap="navigate('M26')"><view class="avatar"><Photo :asset="avatarAsset(backend.profileMemberId===backend.member?.id?backend.profile?.avatarId:'')" fallback="avatar" :radius="50"/></view><view><text class="profile-name">{{backend.member?.name||'微信用户'}}</text><text class="small">{{backend.member?.phone?.replace(/(\d{3})\d{4}(\d{4})/,'$1****$2')||'手机号待授权'}} · 悦享品质生活</text></view><Icon name="chevron" color="white" :size="18"/></view><view class="profile-metrics"><view @tap="navigate('M50')"><text>{{backend.ready&&state.serverHydrated?state.points:'—'}}</text><text>我的积分</text></view><view @tap="navigate('M55')"><text>{{backend.ready&&state.serverHydrated?availableCouponCount(backend.coupons):'—'}}</text><text>优惠券</text></view><view @tap="navigate('M08')"><text>{{backend.ready&&state.serverHydrated?state.favorites.length:'—'}}</text><text>我的收藏</text></view></view></view><view class="card"><view class="spread" @tap="navigate('M17')"><text class="section-title">我的订单</text><text class="muted small">全部订单 ›</text></view><UiBlock :block="{type:'links',items:[{title:'待付款',icon:'wallet',target:'orders:待付款'},{title:'待发货',icon:'bag',target:'orders:待发货'},{title:'待收货',icon:'truck',target:'orders:待收货'},{title:'售后',icon:'refresh',target:'orders:售后'}]}" :form="form" @action="handle"/></view><view class="agent-invite" @tap="navigate('M33')"><Icon name="team" :size="30"/><view><text class="bold">代理中心</text><text class="tiny">携手禾序 · 共享成长</text></view><text>立即进入 →</text></view><UiBlock :block="{type:'links',items:profileLinks}" :form="form" @action="handle"/><UiBlock :block="{type:'rows',items:[{label:'隐私授权与协议',target:'M27'},{label:'账号注销',target:'M28'}]}" :form="form" @action="handle"/></template>
        <template v-else-if="screen.layout==='withdrawal'&&accountDataReady"><view class="card"><text class="muted">提现到</text><view class="info-row" @tap="navigate('M48')"><Icon name="wallet"/><text class="flex-one bold">{{withdrawAccountLabel}}</text><Icon name="chevron" :size="16"/></view></view><view class="card withdraw-card"><text class="section-title">提现金额</text><view class="money-input"><text>¥</text><input v-model="form.amount" type="digit" placeholder="0.00" aria-label="提现金额"/></view><view class="spread small"><text class="muted">可提现余额 ¥{{money(state.balance)}}</text><text class="green" @tap="form.amount=money(state.balance)">全部提现</text></view></view><UiBlock :block="{type:'rows',title:'费用明细',items:[{label:'手续费（0.6%）',value:'¥'+money(withdrawQuote.fee||0)},{label:'预计到账',value:'¥'+money(withdrawQuote.net||0)}]}" :form="form"/><UiBlock :block="{type:'notice',title:'提现说明',body:'单次最低1元，手续费0.6%。商城拥有者审核后提交渠道，以实际付款结果为准。',tone:'orange'}" :form="form"/><view class="consent" @tap="form.consent=!form.consent"><view :class="['checkbox',{checked:form.consent}]">{{form.consent?'✓':''}}</view><text>我已阅读并同意《提现服务协议》</text><text class="green" @tap.stop="handle('policy:WITHDRAWAL_AGREEMENT')">查看正文</text></view></template>
        <template v-else-if="screen.layout==='transfer'&&accountDataReady"><UiBlock :block="{type:'options',key:'pointsType',items:['平台积分','商城积分']}" :form="form" @update="update"/><view class="card"><text class="section-title">接收人信息</text><view class="field"><text>手机号</text><input v-model="form.recipient" type="number" placeholder="请输入接收人手机号" aria-label="接收人手机号"/></view><view class="field"><text>接收商城</text><picker :range="receiverShops" disabled><text>{{receiverShops[0]}} ›</text></picker></view></view><view class="card"><text class="section-title">转赠积分</text><input class="points-input" v-model="form.amount" type="number" placeholder="请输入转赠数量" aria-label="转赠积分"/><text class="small muted">可用{{form.pointsType==='商城积分'?state.shopPoints:state.points}}积分 · 单笔最多{{pointTransferLimit}}</text></view><UiBlock :block="{type:'notice',title:'转赠须知',body:'平台积分可跨商城转赠；商城积分仅限本商城用户。确认后不可撤回。'}" :form="form"/></template>
        <view v-if="screen.layout==='checkout'&&accountDataReady&&!selectedLinesReady" class="notice">{{selectedLines.length?'所选商品暂不可售，请返回购物车重新选择':'请先选择结算商品'}}</view>
        <UiBlock v-if="!(screen.layout==='home'&&backend.error&&!backend.ready)" v-for="(block,i) in displayBlocks" :key="pageId+'-'+i+(block.type==='upload'&&pageId==='G46'?(backend.reconciliationLine||''): '')" :block="blockConfig(block)" :form="form" :filter="blockFilter(block)" :search="search" @update="update" @action="handle" @filter="setBlockFilter(block,$event)" @search="search=$event"/>
        <template v-if="screen.layout==='favorites'">
          <UiBlock :block="{type:'productGrid',ids:favoriteTabProducts,orderedIds:filter==='浏览记录',removable:filter!=='浏览记录',includeUnavailable:true,stockStatus:true}" :form="form" @action="handle"/>
          <text v-if="accountDataReady&&!favoriteTabProducts.length" class="empty-text">{{filter==='浏览记录'?'暂无浏览记录，去商城看看吧':'暂无收藏商品，去商城看看吧'}}</text>
        </template>
        <view v-if="state.changes[pageId]?.result" class="notice mint"><Icon name="check"/><text>{{state.changes[pageId].result}}</text></view>
        <view v-if="management" class="data-scope">{{state.shop}} · 数据权限已隔离</view>
      </view>
      <view v-if="(screen.layout==='product'||screen.layout==='sku')&&catalogDataReady&&currentProduct.id" class="bottom-bar product-bottom"><button class="bottom-icon" @tap="navigate('M29')"><Icon name="headset"/><text>客服</text></button><button class="bottom-icon" @tap="toggleFavorite()"><Icon name="heart"/><text>{{state.favorites.includes(currentProduct.id)?'已收藏':'收藏'}}</text></button><button :class="['secondary',{'is-disabled':isSoldOut(currentProduct)}]" :disabled="isSoldOut(currentProduct)" @tap="cartAdd(currentProduct.id,qty)">加入购物车</button><button :class="['primary',{'is-disabled':isSoldOut(currentProduct)}]" :disabled="isSoldOut(currentProduct)" @tap="buy">{{isSoldOut(currentProduct)?'暂时缺货':'立即购买'}}</button></view>
      <view v-else-if="screen.layout==='cart'" class="bottom-bar cart-bottom"><view class="consent" @tap="toggleAll"><view :class="['checkbox',{checked:allSelected}]">{{allSelected?'✓':''}}</view><text>全选</text></view><view class="flex-one right small">合计 <text class="price">{{accountDataReady&&selectedLinesReady?'¥'+money(total):'—'}}</text><text class="tiny muted">不含运费</text></view><button :class="['primary',{'is-disabled':!accountDataReady||!selectedLinesReady||backend.cartMutating||backend.busy}]" :disabled="!accountDataReady||!selectedLinesReady||backend.cartMutating||backend.busy" @tap="cartCheckout">去结算({{accountDataReady?selectedLines.length:'—'}})</button></view>
      <view v-else-if="screen.layout==='checkout'&&accountDataReady&&selectedLinesReady&&!createdCheckoutOrder" class="bottom-bar"><view class="flex-one">合计 <text class="price">{{checkoutQuote?'¥'+money(payTotal):'—'}}</text></view><button :class="['primary',{'is-disabled':!checkoutQuote||backend.cartMutating||backend.busy}]" :disabled="!checkoutQuote||backend.cartMutating||backend.busy" @tap="handle('checkout')">提交订单</button></view>
      <view v-else-if="(screen.layout==='withdrawal'||screen.layout==='transfer')&&accountDataReady" class="bottom-bar"><button class="primary full" @tap="handle(screen.layout==='withdrawal'?'withdraw':'transfer')">{{screen.layout==='withdrawal'?'确认提现':'下一步，核对信息'}}</button></view>
        <view v-else-if="screen.footer||(['M23','M24'].includes(pageId)&&pageFooterItems.length)" class="bottom-bar"><button v-if="pageId==='M18'&&state.cartSyncPendingOrder===state.activeOrder" class="primary flex-one" @tap="handle('payment-refresh')">重试同步购物车</button><template v-else><button v-for="(item,i) in visibleFooterItems" :key="i" :class="[item.tone==='outline'?'outline':'primary','flex-one',{'is-disabled':item.disabled}]" :disabled="item.disabled" @tap="handle(item.target)">{{item.label}}</button></template></view>
      <view v-if="screen.nav&&!specialFooter" class="tabbar"><button v-for="item in navItems" :key="item.id" :class="{active:isNavActive(item.id)}" @tap="navigateTab(item.id)"><Icon :name="item.icon" :size="23"/><text>{{item.title}}</text><text v-if="item.id==='M11'&&state.cart.length" class="tab-dot">{{state.cart.length}}</text></button></view>
      <!-- H5 预览的确认框限制在手机画布内，原生端继续使用系统确认框。 -->
      <!-- #ifdef H5 -->
      <view v-if="addressDeleteIndex!==null" class="address-delete-layer" role="dialog" aria-modal="true" aria-label="删除地址">
        <view class="address-delete-dialog"><text class="section-title">删除地址</text><text class="address-delete-message">确认删除这个收货地址？</text><view class="address-delete-actions"><button class="outline" :disabled="addressDeleting" @tap="addressDeleteIndex=null">取消</button><button class="primary" :disabled="addressDeleting" @tap="confirmRemoveAddress">{{addressDeleting?'删除中…':'确定删除'}}</button></view></view>
      </view>
      <!-- #endif -->
      <view v-if="backend.openPolicy" class="policy-overlay" role="dialog" aria-modal="true" :aria-label="backend.openPolicy.title">
        <view class="policy-panel">
          <view class="policy-heading"><view class="policy-heading-content"><text class="policy-title">{{backend.openPolicy.title}}</text><text class="muted small">版本 {{backend.openPolicy.version}}</text></view><button class="icon-button" aria-label="关闭协议" @tap="backend.openPolicy=null"><Icon name="close"/></button></view>
          <scroll-view scroll-y class="policy-body"><text>{{backend.openPolicy.content}}</text></scroll-view>
          <button class="primary full" @tap="backend.openPolicy=null">关闭并返回</button>
        </view>
      </view>
      <view class="home-indicator"/>
    </view>
  </view>
</template>

<script setup>
import {computed,reactive,ref,watch,onBeforeUnmount,onMounted} from 'vue'
import {onShow,onHide} from '@dcloudio/uni-app'
import UiBlock from './UiBlock.vue'
import Icon from './Icon.vue'
import Photo from './Photo.vue'
import HomeCarousel from './HomeCarousel.vue'
import ProductGallery from './ProductGallery.vue'
import {avatarAsset} from '../data/profile.js'
import {homeProductList,homeShortcutList,normalizeAddressScreen} from '../data/storefront-display.mjs'
import {availableCouponCount,couponCards,couponStackingBlocked} from '../data/coupons.js'
import {paymentState} from '../data/payment-clock.js'
import {beginCheckout,checkoutLinesReady} from '../data/cart-checkout.js'
import {cartDisplayProduct} from '../data/cart-item-display.mjs'
import {checkoutDiscountLabel} from '../data/checkout-discount.mjs'
import {reviewContextAllowed,reviewButtonLabel} from '../data/reviews.js'
import {screens} from '../data/screens'
import {backend, pageData, handleRemote, liveBlocks, wholesalePagePlan, syncCart, syncFavorites, apiCommand, refresh, request, refreshMobileReport, setReportPeriod, loadMarketingBuyer, homePageId, rememberLoginReturn, clearLoginReturn, enterGuestBrowsing, isLocalSandbox, setDefaultAddress, removeSavedAddress} from '../data/backend'
import {catalog} from '../data/catalog'
import {state,products,money,navigate as storeNavigate,toast,persist,addCart} from '../data/store'
import {withdrawal,withdrawalAccountLabel,validPhone,redemptionPageTitle,refundReviewPresentation,returnTrackingSubmitted,afterSalePageTitle,orderAmountRows} from '../data/business.mjs'
import {productQuantity,purchaseQuantityLimit} from '../data/product-selection.mjs'
import {matchesProduct} from '../data/product-search.mjs'
import {privacyFooter} from '../data/privacy-action.mjs'
import {marketingFooter,purchaseReceiptFooter,unavailableActionFooter} from '../data/action-footer.mjs'
import {addressCheckoutPage,backDeltaTo,backDestination} from '../data/address-navigation.mjs'
const props=defineProps({pageId:{type:String,default:'M02'}})
const nativeStatusBarHeight=ref(0)
onMounted(()=>{
 // #ifdef MP-WEIXIN
 try{const info=typeof uni.getWindowInfo==='function'?uni.getWindowInfo():uni.getSystemInfoSync();nativeStatusBarHeight.value=Math.max(0,Number(info.statusBarHeight)||0)}catch{}
 // #endif
})
const pageId=props.pageId,management=pageId.startsWith('G'),index=catalog.findIndex(x=>x.id===pageId)
// The renderer stays code-based to preserve the current visual language, while
// all copy/blocks/navigation can be replaced by the published tenant schema.
const screen=reactive(JSON.parse(JSON.stringify(screens[pageId]||{id:pageId,title:pageId,layout:'standard',blocks:[],nav:true})))
const pageTitle=computed(()=>{
 if(pageId==='M63')return redemptionPageTitle(backend.redemptionOrder)
 if(pageId==='M21')return afterSalePageTitle(state.afterType)
 if(pageId==='G26')return refundReviewPresentation(backend.refund?.refund_type)?.title||screen.title
 if(pageId==='G28'&&backend.refund?.refund_type==='EXCHANGE'&&filter.value!=='整箱直发关联')return '换货履约详情'
 if(pageId==='M10'&&state.reviewParent)return '追加评价'
 if(pageId==='M14'&&state.addresses[state.editAddress]?.serverId)return '编辑收货地址'
 if(pageId==='G02'&&backend.shopInfo?.kind!=='DIRECT')return '当前商城经营台'
 return pageId==='G01'?'当前商城经营总览':screen.title
})
const decoration=computed(()=>backend.storefront?.decoration||{})
const pageVisible=ref(true)
watch(()=>backend.storefront?.pages, pages=>{const remote=pages?.screens?.[pageId]||pages?.[pageId];if(remote){const published=JSON.parse(JSON.stringify(remote));Object.assign(screen,pageId==='M14'?normalizeAddressScreen(published):published)}},{deep:true,immediate:true})
const guestPages=new Set(['M01','M02','M03','M04','M05','M07'])
function requireLogin(returnPage=pageId){rememberLoginReturn(returnPage);toast('游客可浏览商品；下单和会员功能请先微信登录');storeNavigate('M01')}
function navigate(id){if(id===pageId)return;if(backend.guest&&!guestPages.has(id)){requireLogin(id);return}if(backend.guest)clearLoginReturn();storeNavigate(id)}
function navigateTab(id){
 if(id===pageId)return
 if(backend.guest&&!guestPages.has(id)){requireLogin(id);return}
 if(backend.guest)clearLoginReturn()
 // #ifdef MP-WEIXIN
 uni.reLaunch({url:'/pages/'+id+'/index'})
 return
 // #endif
 storeNavigate(id)
}
function goHome(){const home=homePageId();if(pageId==='M01')enterGuestBrowsing();navigate(home)}
const initial={};for(const block of screen.blocks){if(block.type==='fields')for(const item of block.items)initial[item.key]=item.value;if(block.type==='options')initial[block.key]=block.items[0]}
const form=reactive({...initial,...(pageId==='M12'?{}:state.changes[pageId])}),filter=ref(''),search=ref(''),financeListPage=ref(1),searchApplied=ref(''),category=ref('全部商品'),sort=ref('default'),qty=ref(1),editingCart=ref(false)
const addressDeleteIndex=ref(null),addressDeleting=ref(false)
function restoreCheckoutRemark(){
 if(pageId!=='M12')return
 const draft=state.changes.M12
  const sameAccount=draft&&backend.shopId&&backend.member?.id&&String(draft.shopId)===String(backend.shopId)&&String(draft.memberId)===String(backend.member.id)
  const pointsDraft=state.checkoutPoints
  const samePointsAccount=pointsDraft&&String(pointsDraft.shopId)===String(backend.shopId)&&String(pointsDraft.memberId)===String(backend.member?.id)
  form.remark=sameAccount?String(draft.remark||''):''
  form.usePoints=!!(sameAccount?draft.usePoints:samePointsAccount&&pointsDraft.usePoints)
}
function onCheckoutRemarkInput(event){
 const remark=String(event.detail?.value??'')
 form.remark=remark
  state.changes.M12={shopId:backend.shopId,memberId:backend.member?.id,remark,usePoints:!!form.usePoints}
  persist()
}
function onCheckoutPointsChange(event){
  // 结算草稿按会员和商城保存积分选择，选券返回或刷新后重新报价。
  form.usePoints=!!event.detail.value
  state.changes.M12={shopId:backend.shopId,memberId:backend.member?.id,remark:String(form.remark||''),usePoints:form.usePoints}
  state.checkoutPoints={shopId:backend.shopId,memberId:backend.member?.id,usePoints:form.usePoints}
  persist()
}
const couponFilter=reactive({status:'全部',type:'全部类型'})
const couponTab=block=>block.type==='tabs'&&(block.items||[]).includes('可使用')?'status':block.type==='tabs'&&(block.items||[]).includes('折扣券')?'type':''
const blockFilter=block=>pageId==='M55'?(couponTab(block)==='type'?couponFilter.type:couponFilter.status):filter.value
function setBlockFilter(block,value){if(pageId==='M55'&&couponTab(block))couponFilter[couponTab(block)]=value;else filter.value=value;if(['G39','G42'].includes(pageId))financeListPage.value=1}
const blockConfig=block=>pageId==='M55'&&block.type==='coupons'?{...block,couponType:couponFilter.type}:pageId==='M30'&&block.type==='consent'?{...block,policyType:'AGENT_AGREEMENT'}:block
if(pageId==='M14'&&state.editAddress!==undefined&&state.editAddress!==null){const prior=state.addresses[state.editAddress];if(prior){Object.assign(form,prior);form.addressConsent=!!prior.consent}}
const update=(key,value)=>{form[key]=value;if(pageId==='G14'&&key.startsWith('wholesaleQty:')){const line=state.wholesaleDraft?.lines?.find(item=>item.id===key.slice(13));if(line){line.qty=value;persist()}}if(pageId==='G40'&&['试算商品','归属代理','quantity','rate'].includes(key)){backend.settlementPreview=null;backend.settlementPreviewKey=''}}
const specialFooter=computed(()=>['product','sku','checkout','withdrawal','transfer'].includes(screen.layout))
const privacyFooterItems=computed(()=>privacyFooter(backend))
const visibleFooterItems=computed(()=>{
 if(backend.financeErrors?.[pageId])return [{label:'重新读取业务数据',target:'action-page-refresh'}]
 if(pageId==='M52'&&state.pendingTransfer?.blockedReason)return [{label:'返回积分转赠',target:'M51'}]
 if(pageId==='M27')return privacyFooterItems.value
  if(pageId==='M41'&&(backend.documents.migration||[]).some(d=>['PENDING','SUPPLEMENT','SCHEDULED'].includes(d.status)))return [{label:'迁移申请审核中',disabled:true}]
 if(pageId==='M15'&&paymentState(activeOrder.value,form._paymentNow,backend.busy||backend.paymentResultNavigating===activeOrder.value?.id).processing)return [{label:'支付已确认，正在跳转结果页',disabled:true}]
 if(!['M26','M28'].includes(pageId)){
  const unavailable=unavailableActionFooter(backend,pageId,pageId==='M29'?'客服资料':'业务数据',displayBlocks.value)
  if(unavailable)return unavailable
 }
  if(['G14','G15'].includes(pageId)&&!backend.displayPageErrors?.[pageId]){const plan=wholesalePagePlan(pageId,form);if(plan.error)return [{label:pageId==='G14'?'请调整采购清单':'请返回修改采购商品',disabled:true}]}
 if(pageId==='G26'&&backend.refund?.status==='PENDING'){
  const review=refundReviewPresentation(backend.refund.refund_type)
  if(review)return [{label:review.reject,target:'reject',tone:'outline'},{label:review.approve,target:'approve'}]
 }
 if(pageId==='G27'&&backend.refund?.status==='WAIT_RETURN'&&backend.refund.refund_type==='EXCHANGE')return [{label:'确认验收并安排换货',target:'approve'}]
 if(pageId==='G28'&&backend.refund?.status==='WAIT_EXCHANGE'&&filter.value!=='整箱直发关联')return [{label:'确认换货发货',target:'save'}]
 if(pageId==='M22'&&backend.returnTrackingAllowed&&returnTrackingSubmitted(backend.refund))return [{label:'更新退货运单',target:'return-tracking'}]
  if(pageId==='M61'&&backend.couponPolicy?.blocked)return [{label:'活动不可叠券，返回结算',target:'coupon-skip'}]
  if(pageId==='M61'&&selectedLines.value.length&&!selectableCouponCount.value)return [{label:'不使用优惠券，返回结算',target:'coupon-skip'}]
  if(pageId==='M61'&&state.couponId&&!form.coupon)return [{label:'不使用优惠券，返回结算',target:'choose-coupon'}]
  if(pageId==='G16'&&backend.purchaseReceiveAllowed)return purchaseReceiptFooter(backend.purchaseOrderDetail)
  return pageFooterItems.value
})
const pageFooterItems=computed(()=>{if(pageId==='M09'&&Number(backend.reviewShopId)!==Number(backend.shopId))return [{label:'返回原订单',target:'review-order'}];if(backend.displayPageErrors?.[pageId])return [{label:'读取失败，重新加载',target:'action-page-refresh'}];if(pageId==='G37'&&!backend.promotionReviewAllowed)return [{label:backend.promotionReview?'申请已处理':'暂无待审核晋升申请',disabled:true}];if(pageId==='G16'&&!backend.purchaseReceiveAllowed)return [{label:backend.purchaseOrderDetail?'当前采购单不可确认收货':'请先选择采购订单',disabled:true}];if(pageId==='M22'&&!backend.returnTrackingAllowed)return [{label:backend.refund?'当前售后不可提交运单':'请先选择待退货申请',disabled:true}];if(pageId==='M63'&&backend.redemptionOrder)return [{label:'查看兑换订单',target:'redemption-order'}];if(pageId==='M44'&&(!backend.crossPurchaseTarget||!backend.crossPurchaseProduct))return [{label:'请先选择目标商城及商品',disabled:true}];if(pageId==='M41'&&!backend.migrationContext?.currentBinding)return [{label:'暂无可迁移的归属',disabled:true}];if(pageId==='M62'){const p=products.find(p=>p.id===state.selectedPointProduct),qty=Number(form.兑换数量),valid=!!p&&Number(p.point_price)>0&&Number.isSafeInteger(qty)&&qty>0&&qty<=Number(p.stock)&&p.point_price*qty<=state.points&&state.addresses.length>0;return [{label:valid?'确认兑换 '+(p.point_price*qty)+' 积分':'请核对商品、积分和地址',target:'redeem',disabled:!valid||!!backend.pageLoading[pageId]||!!backend.busy}]}if(pageId==='G20'&&backend.stocktake?.status!=='PENDING')return [{label:backend.stocktake?'盘点单已处理':'创建盘点任务',target:'G19'}];if(pageId==='M10'){const o=backend.activeOrder,locked=(!state.reviewParent&&backend.reviewSubmission&&!['SUPPLEMENT','REJECTED'].includes(backend.reviewSubmission.status))||(state.reviewParent&&!backend.reviewParent?.appendAllowed&&!backend.reviewParent?.appendSupplementAllowed);return [{label:reviewButtonLabel(backend.reviewContext,state.reviewParent,locked),target:'review',disabled:!o||!reviewContextAllowed(backend.reviewContext,state.reviewParent)||o.rawStatus!=='COMPLETED'||!state.reviewSku||locked||!!backend.pageLoading[pageId]||!!backend.busy||backend.uploadingCount>0}]}if(pageId==='M38'&&(!backend.agent||!backend.assessment?.eligible))return [{label:backend.agent?'尚未达到晋升条件':'申请代理后查看晋升',target:backend.agent?undefined:'M30',disabled:!!backend.agent}];if(pageId==='M61'&&!selectedLines.value.length)return [{label:'先选择结算商品',target:homePageId()}];if(pageId==='M63'&&!backend.redemptionOrder)return [{label:'返回积分商城',target:'M54'}];if(pageId==='M49'){const w=backend.withdrawalDetail||state.lastWithdrawal;if(w?.channel==='WECHAT'&&['APPROVED','PROCESSING'].includes(w.status))return [{label:w.status==='APPROVED'?'确认微信零钱收款':'继续确认微信零钱',target:'wechat-transfer'},{label:'刷新付款状态',target:'wechat-transfer-query',tone:'outline'}];if(w?.channel==='WECHAT'&&['PENDING','PAID','FAILED','REJECTED'].includes(w.status))return [{label:'刷新付款状态',target:'wechat-transfer-query'}]}if(pageId==='G08'&&backend.merchant?.transferAuthStatus==='PENDING'&&!backend.merchant?.transferAuthRef)return [{label:'补录商家转账授权凭证',target:'merchant-reference:TRANSFER'}];return finalFooterItems.value})
const finalFooterItems=computed(()=>{if(pageId==='G07'&&backend.merchant?.applicationStatus==='PENDING')return [backend.merchant.applicationRef?{label:'刷新进件状态',target:'merchant-refresh'}:{label:'补录渠道进件申请号',target:'merchant-reference:APPLICATION'}];if(pageId==='G07'&&backend.merchant?.applicationStatus==='VERIFIED')return [{label:'继续 AppID 授权',target:'G08'}];if(pageId==='G28'&&filter.value==='整箱直发关联'){const status=backend.refund?.status,eligible=status&&!['PENDING','REJECTED','CLOSED'].includes(status);return [{label:eligible?'关联采购及公司售后':'客户售后受理后可关联',target:'link-direct',disabled:!eligible||!form.wholesaleOrderId}]}if(pageId==='G23'&&(backend.pickOrders||[]).find(x=>x.orderId===state.managementOrder)?.pickStatus!=='COMPLETED')return [{label:'完成拣货后发货',disabled:true}];if(pageId==='G22'){const order=(backend.management.G22||[]).find(o=>o.id===state.managementOrder);if(order?.rawStatus!=='PAID')return [{label:['SHIPPED','COMPLETED'].includes(order?.rawStatus)?'查看物流':'返回订单中心',target:['SHIPPED','COMPLETED'].includes(order?.rawStatus)?'G24':'G21'}]}return footerItems.value})
const footerItems=computed(()=>{if(pageId==='G45'&&backend.financeErrors.G45)return [];if(pageId==='M56')return marketingFooter(backend.campaigns);if(pageId==='M52'&&!state.pendingTransfer)return [{label:'返回积分转赠',target:'M51'}];if(pageId==='G36'&&backend.assessmentRuleReadOnly)return [{label:'历史方案请在后台管理维护',disabled:true}];if(pageId==='G05')return [{label:'开店申请由平台后台审核',disabled:true}];if(pageId==='M32'&&!backend.agent)return [{label:'查看申请进度',target:'M31'}];if(pageId==='M34'&&!backend.agent)return [{label:'申请代理后分享',target:'M30'}];if(pageId==='M26')return [{label:backend.profileError||!form._hydrated?'重新读取资料':backend.busy?'保存中…':'保存修改',target:backend.profileError||!form._hydrated?'profile-refresh':'save',disabled:!!backend.pageLoading[pageId]||!!backend.busy||backend.uploadingCount>0}];if(pageId==='M15'){const payment=paymentState(activeOrder.value,form._paymentNow);return [{label:payment.payable?'确认支付 ¥'+money(activeOrder.value.total):activeOrder.value?'返回订单查看':'返回订单列表',target:payment.payable?'payment':activeOrder.value?'M18':'M17',disabled:!!backend.pageLoading[pageId]||!!backend.busy}]}if(pageId==='M31'){const d=backend.documents.agent_application?.[0];return d?.status==='APPROVED'?[{label:'查看代理资格',target:'M32'}]:d&&['REJECTED','SUPPLEMENT'].includes(d.status)?[{label:'补齐后重新提交',target:'agent-resubmit',disabled:!!backend.busy||backend.uploadingCount>0}]:[{label:d?'申请审核中':'暂无申请',disabled:true}]}if(pageId==='M48'){const d=backend.settlementAccount;if(d&&['APPROVED','PENDING'].includes(d.status))return [{label:d.status==='APPROVED'?'账户已审核，新账户请重新申请':'账户审核中',disabled:true}]}if(pageId==='M35'){const context=backend.invitationContext;return [{label:context?.bound?'当前归属已锁定':context?.valid===false?context.reason||'邀请已失效':'授权进入商城',target:'bind',disabled:!context||context.bound||context.valid===false||!!backend.pageLoading[pageId]}]} if(backend.pageLoading[pageId])return [{label:'正在读取业务数据',disabled:true}];if(pageId==='G41')return [{label:'由平台发布分红版本',disabled:true}];if(pageId==='G55')return [{label:'核算营销金额',target:'calculate'}];if(pageId==='G39')return [{label:'刷新结算结果',target:'settle'}];if(pageId==='G42')return [{label:'核对冲正记录',target:'reverse'}];if(pageId==='G44')return [{label:'刷新付款记录',target:'query-payment'}];if(pageId==='G43'&&backend.managementWithdrawal?.status!=='PENDING')return [{label:'查看付款记录',target:'G44'}];if(['G31','G33','G35'].includes(pageId)){const list=backend.management[pageId]||[],d=list.find(x=>x.id===backend.selectedDocuments?.[pageId])||list.find(x=>x.status==='PENDING')||list[0];if(pageId==='G35'&&d?.status==='APPROVED')return [{label:'撤销授权',target:'cross-revoke'}];if(!d||!['PENDING','SUPPLEMENT'].includes(d.status))return [{label:'暂无待审核申请',disabled:true}];if(pageId==='G33'&&d.body.targetShopId!==d.shop_id)return [{label:'跨商城迁移待平台审核',disabled:true}];}if(pageId==='G11')return [{label:'待平台审核',target:'',disabled:true}];if(pageId==='G34')return [{label:'团队迁移由平台复核',disabled:true}];if(pageId==='M59'){const d=backend.linkCampaign||{};if(d.participant)return [{label:'查看我的活动',target:'M60'}];return [{label:!d.enabled?'活动尚未开启':d.canJoin?'确认参与活动':'申请代理后参与',target:d.canJoin?'link-join':'M30',disabled:!d.enabled}];}if(pageId==='G46'){const list=backend.management.G46||[],line=list.find(r=>r.id===backend.reconciliationLine)||list.find(r=>!['MATCHED','RESOLVED'].includes(r.status))||list[0];if(!line||['MATCHED','RESOLVED','PENDING'].includes(line.status))return [{label:'返回资金账本',target:'G45'}];return [{label:form.adjustment==='申请账务调整'?'提交复核':'重新核对回执',target:'submit'}];}if(pageId==='G38'){const d=(backend.management.G38||[]).find(d=>d.id===backend.selectedDowngrade)||(backend.management.G38||[]).find(d=>['PENDING','REVIEW_REQUIRED'].includes(d.status));return d&&['PENDING','REVIEW_REQUIRED'].includes(d.status)?[{label:'驳回',target:'reject',tone:'outline'},{label:'审核降级',target:'approve'}]:[{label:'核算已结束周期',target:'assessment-run'}];}if(pageId==='M58'){const g=backend.groupDetail,c=backend.groupCampaign;if(g?.myOrderId)return [{label:'查看我的订单',target:'group-order'},...(g.status==='FORMING'?[{label:'邀请好友参团',target:'group-share'}]:[])];return [{label:g?'立即参团 ¥'+money(g.price):c?'发起拼团 ¥'+money(c.price):'暂无可参与活动',target:'join-group',disabled:!g&&!c||g&&g.status!=='FORMING'}]}if(pageId==='M57'&&!backend.invitation?.canInvite)return [{label:'申请代理后参与邀请',target:'M30'}];if(['G26','G27','G28'].includes(pageId)&&backend.refund?.status!==({G26:'PENDING',G27:'WAIT_RETURN',G28:'WAIT_EXCHANGE'}[pageId]))return [{label:'返回售后列表',target:'G25'}];if(['M23','M24'].includes(pageId)){const r=backend.refund;if(!r)return [];if(r.status==='WAIT_RETURN')return [{label:returnTrackingSubmitted(r)?'查看或修改退货运单':'填写退货运单',target:'M22'}];if(r.status==='EXCHANGE_SHIPPED')return [{label:'确认换货收货',target:'exchange-receive'}];return [{label:'返回订单详情',target:'M18'}]}if(pageId==='M19')return [{label:backend.activeOrder?.rawStatus==='SHIPPED'?'确认收货':'返回订单',target:backend.activeOrder?.rawStatus==='SHIPPED'?'receive':'M18'}];if(pageId==='M28')return [{label:backend.closure?.eligible?'申请注销账户':'完成处理后可申请注销',target:'close-account',disabled:!backend.closure?.eligible}];if(pageId==='M18'){const o=backend.activeOrder;if(state.pendingPaymentOrder&&state.pendingPaymentOrder===o?.id)return ['PAID','SHIPPED','COMPLETED','REFUNDED'].includes(o.rawStatus)?[{label:'确认支付结果',target:'payment-refresh'}]:[{label:'刷新支付结果',target:'payment-refresh'},{label:'重试支付',target:'payment',tone:'outline'}];if(o?.group&&o.group.status!=='FORMED'&&o.rawStatus!=='UNPAID')return [{label:'查看拼团进度',target:'group-progress'}];const item={UNPAID:['继续支付','M15'],PAID:['提醒发货','remind'],SHIPPED:['确认收货','receive'],COMPLETED:['评价订单','M10'],REFUNDED:['查看售后','M23'],CANCELLED:['继续购物',homePageId()]}[o?.rawStatus];return [{label:item?.[0]||'请先选择订单',target:item?.[1],disabled:!item}]}return Array.isArray(screen.footer)?screen.footer:[screen.footer]})
const findProduct=id=>products.find(x=>x.id===id)||{id:'',asset:'',name:'商品暂不可售',price:0,stock:0,spec:'',desc:''}
const currentProduct=computed(()=>findProduct(state.selectedProduct||products[0]?.id))
function isSoldOut(product){return !backend.guest&&purchaseQuantityLimit(product)<1}
const favoriteTabProducts=computed(()=>{
 const ids=filter.value==='浏览记录'?state.browseHistory:state.favorites
 return ids
})
const selectionMemberId=computed(()=>backend.member?.id||null)
const canIncreaseProductQty=computed(()=>!backend.guest&&qty.value<purchaseQuantityLimit(currentProduct.value))
function syncProductQty(){if(screen.layout==='product'||screen.layout==='sku')qty.value=productQuantity(backend.productSelection,backend.shopId,selectionMemberId.value,currentProduct.value.id,purchaseQuantityLimit(currentProduct.value))}
function setProductQty(value){const limit=purchaseQuantityLimit(currentProduct.value);if(!Number.isSafeInteger(value)||value<1||value>limit)return;qty.value=value;backend.productSelection={shopId:backend.shopId,memberId:selectionMemberId.value,productId:currentProduct.value.id,qty:value}}
function selectVariant(variant){state.selectedProduct=variant.id;form.spec=variant.spec;backend.productSelection=null;qty.value=1;if(!backend.guest)persist()}
watch(()=>[backend.productSelection,backend.shopId,selectionMemberId.value,state.selectedProduct,currentProduct.value.stock,currentProduct.value.crossPurchaseRemaining],syncProductQty,{immediate:true})
const agentPriceLabel=computed(()=>({1:'云代理',2:'分货中心',3:'总代理'}[backend.agent?.rank_no]||'代理')+'专享价')
const agentRetailPrice=computed(()=>{const retail=currentProduct.value.retailPrice;return Number.isSafeInteger(retail)&&retail>currentProduct.value.price?retail:null})
const activeOrder=computed(()=>(backend.activeOrder?.id===state.activeOrder?backend.activeOrder:null)||state.orders.find(o=>o.id===state.activeOrder))
const createdCheckoutOrder=computed(()=>pageId==='M12'&&form._createdOrder?.id===activeOrder.value?.id&&Number(form._createdOrder.memberId)===Number(backend.member?.id)&&Number(form._createdOrder.shopId)===Number(backend.shopId)?activeOrder.value:null)
const selectedLines=computed(()=>state.buyNow?[state.buyNow]:state.cart.filter(x=>x.selected))
const checkoutReturnLabel=computed(()=>state.buyNow?.groupId||state.buyNow?.groupCampaignId?'返回拼团页':state.buyNow?'返回修改数量':'返回购物车修改数量')
const selectableCouponCount=computed(()=>couponCards(backend.coupons,{choose:true,orderSkuIds:selectedLines.value.map(line=>line.id),stackBlocked:!!backend.couponPolicy?.blocked}).filter(coupon=>coupon.uiAction==='select'&&Number(coupon.member_id)===Number(backend.member?.id)&&Number(coupon.shop_id)===Number(backend.shopId)).length)
const selectedLinesReady=computed(()=>checkoutLinesReady(selectedLines.value,products))
const total=computed(()=>selectedLines.value.reduce((s,l)=>s+findProduct(l.id).price*l.qty,0))
const address=computed(()=>state.addresses[state.selectedAddress??state.addresses.findIndex(a=>a.primary)]||state.addresses[0]||{name:'请添加收货地址',phone:'',region:'',detail:''})
 const checkoutQuote=ref(null),quoteError=ref(''),quoteChangeNotice=ref('');let quoteVersion=0
const discount=computed(()=>checkoutQuote.value?.discount||0)
const couponDiscount=computed(()=>checkoutQuote.value?.couponDiscount||0)
const couponStackBlocked=computed(()=>couponStackingBlocked(checkoutQuote.value))
const pointsDiscount=computed(()=>checkoutQuote.value?.pointsDiscount||0)
const pointsUsed=computed(()=>checkoutQuote.value?.pointsUsed||0)
const freight=computed(()=>checkoutQuote.value?.freight||0)
const payTotal=computed(()=>checkoutQuote.value?.total??total.value)
 async function refreshCheckoutQuote(){
 const version=++quoteVersion;checkoutQuote.value=null;quoteError.value='';
 if(pageId!=='M12'||createdCheckoutOrder.value||!backend.ready||!state.serverHydrated||!selectedLinesReady.value)return;
 try{const body={shopId:backend.shopId,address:address.value,items:selectedLines.value.map(l=>({id:l.id,qty:l.qty})),couponId:state.couponId||'',groupId:state.buyNow?.groupId,groupCampaignId:state.buyNow?.groupCampaignId,points:0};let quote=await request('/hexu/app/quote',body,'POST');if(form.usePoints&&!state.buyNow?.groupId&&!state.buyNow?.groupCampaignId){body.points=Math.min(state.points,Math.floor(Math.floor((quote.subtotal-quote.discount)*quote.deductionPercent/100)*quote.pointsPerYuan/100));if(body.points>0)quote=await request('/hexu/app/quote',body,'POST')}if(version===quoteVersion)checkoutQuote.value=quote}catch(e){if(version===quoteVersion){if(state.couponId&&e.message==='当前活动不能叠加优惠券'){state.couponId=null;persist();toast('当前活动不叠加优惠券，已取消原选券');return}quoteError.value=e.message;toast(e.message)}}
 }
 watch(()=>JSON.stringify([backend.ready,backend.shopId,state.serverHydrated,selectedLines.value,selectedLinesReady.value,total.value,state.points,form.usePoints,state.couponId,address.value]),()=>{quoteChangeNotice.value='';refreshCheckoutQuote()},{immediate:true})
const allSelected=computed(()=>state.cart.length>0&&state.cart.every(x=>x.selected))
const cartQuantity=computed(()=>state.cart.reduce((sum,line)=>sum+(Number(line.qty)||0),0))
const accountDataReady=computed(()=>backend.ready&&state.serverHydrated)
const catalogDataReady=computed(()=>accountDataReady.value||backend.guest)
const receiverShops=computed(()=>[form.pointsType==='商城积分'?state.shop:'平台通用'])
const pointTransferLimit=computed(()=>Number(backend.account.pointRisk?.[form.pointsType==='商城积分'?'shopSingle':'platformSingle']||1000))
const withdrawAccountLabel=computed(()=>withdrawalAccountLabel(backend.documents.settlement_account))
const withdrawQuote=computed(()=>withdrawal(form.amount,state.balance))
const productVariants=computed(()=>currentProduct.value.product_group?products.filter(p=>p.product_group===currentProduct.value.product_group):[currentProduct.value])
const categories=computed(()=>['全部商品',...new Set([...(backend.shopInfo?.categories||[]),...products.map(p=>p.category).filter(Boolean)])])
const categoryProducts=computed(()=>{let list=products.filter(p=>matchesProduct(p,searchApplied.value));if(category.value!=='全部商品')list=list.filter(p=>p.category===category.value);if(sort.value==='sales')list.sort((a,b)=>Number(b.sales||0)-Number(a.sales||0));if(sort.value==='asc'||sort.value==='desc')list.sort((a,b)=>sort.value==='asc'?a.price-b.price:b.price-a.price);return list})
const homeProducts=computed(()=>homeProductList(products,decoration.value,sort.value))
const homeCategories=computed(()=>homeShortcutList(decoration.value))
const profileLinks=[['我的积分','gift','M50'],['优惠券','coupon','M55'],['收货地址','pin','M13'],['客服中心','headset','M29'],['代理申请','team','M30'],['选择商城','shop','M42'],['消息中心','bell','M64'],['账户设置','settings','M26']].map(([title,icon,target])=>({title,icon,target}))
const homeTarget=computed(()=>pageId==='M03'?'M03':pageId==='M02'?'M02':homePageId())
const navItems=computed(()=>management?[{id:'G01',title:'工作台',icon:'home'},{id:'G21',title:'订单',icon:'file'},{id:'G29',title:'代理',icon:'team'},{id:'G64',title:'设置',icon:'settings'}]:screen.agentNav?[{id:'M33',title:'工作台',icon:'home'},{id:'M36',title:'客户',icon:'user'},{id:'M37',title:'团队',icon:'team'},{id:'M25',title:'我的',icon:'user'}]:[{id:homeTarget.value,title:'首页',icon:'home'},{id:'M04',title:'分类',icon:'grid'},{id:'M11',title:'购物车',icon:'cart'},{id:'M25',title:'我的',icon:'user'}])
const isPrimaryTab=computed(()=>navItems.value.some(item=>item.id===pageId))
const isNavActive=id=>pageId===id||id==='M02'&&pageId==='M03'||id==='G01'&&['G02','G03'].includes(pageId)
const displayBlocks=computed(()=>{const blocks=JSON.parse(JSON.stringify(screen.blocks));if(pageId==='M15'&&activeOrder.value){blocks.find(x=>x.type==='amount').value=money(activeOrder.value.total);blocks.filter(x=>x.type==='rows')[0].items[0].value=activeOrder.value.id;blocks.filter(x=>x.type==='rows')[0].items[1].value='¥'+money(activeOrder.value.total)}if(pageId==='M16'&&activeOrder.value){blocks[0].value='¥'+money(activeOrder.value.total);blocks[1].items[0].value=activeOrder.value.id}if(pageId==='M18'&&activeOrder.value){const o=activeOrder.value;blocks[0].title=o.status;blocks[1].items[0].value=o.id;blocks[2]={type:'product',...o.items[0],price:money(o.items[0]?.unitPrice||0)};blocks[3].items=orderAmountRows(o,money)}if(pageId==='M50')blocks[0].items[0].value=state.points.toLocaleString();if(pageId==='M52'&&state.pendingTransfer){const t=state.pendingTransfer,profile=blocks.find(b=>b.type==='profile'),rows=blocks.filter(b=>b.type==='rows');if(profile){profile.name=t.recipientName||'已核验接收人';profile.subtitle=t.phone}if(rows[0]){rows[0].items[0].value=t.type+(t.scopeShopId===0?' · 平台通用':' · '+state.shop);rows[0].items[1].value=t.amount;rows[0].items[2].value=t.before;rows[0].items[3].value=t.before-t.amount}if(rows[1]){rows[1].title='转赠流水';rows[1].items=[{label:'转出流水',value:'确认成功后生成'},{label:'接收人流水',value:'确认成功后生成'},{label:'关联号',value:'待确认'}]}}if(pageId==='M49'&&state.lastWithdrawal){const w=state.lastWithdrawal;blocks[0]={type:'success',title:'申请已提交',value:'¥'+money(w.net),body:'等待商城拥有者审核，实际到账以渠道结果为准'};blocks[1].active=0;blocks[2].items[0].value='¥'+money(w.cents);blocks[2].items[1].value='¥'+money(w.fee);blocks[2].items[2].value='¥'+money(w.net)}return liveBlocks(pageId,blocks,form,filter.value,search.value,financeListPage.value)})
let reportTimer,reportPolling=false,paymentTimer,showVersion=0
function stopReportPolling(){clearInterval(reportTimer);reportTimer=null}
onShow(async()=>{const version=++showVersion;if(pageId==='M17'&&state.orderListFilter){filter.value=state.orderListFilter;state.orderListFilter=null;}if(pageId==='G21'&&state.managementOrderListFilter){filter.value=state.managementOrderListFilter;state.managementOrderListFilter=null;}if(pageId==='M11')state.buyNow=null;await pageData(pageId,form);if(!pageVisible.value||version!==showVersion)return;if(pageId==='M12')restoreCheckoutRemark();if(pageId==='M61')form.coupon=state.couponId||'';if(pageId==='G28'&&(backend.afterSaleCandidates.length||backend.afterSaleLinks.some(x=>x.customerRefundId===backend.refund?.id)))filter.value='整箱直发关联';stopReportPolling();if(['G58','G59'].includes(pageId))reportTimer=setInterval(async()=>{if(!pageVisible.value||version!==showVersion||reportPolling||!['QUEUED','RUNNING'].includes(backend.reports?.[pageId]?.status))return;reportPolling=true;try{await refreshMobileReport(pageId,filter.value)}catch(e){if(pageVisible.value&&version===showVersion){stopReportPolling();toast(e.message)}}finally{reportPolling=false}},2000)})
onShow(()=>{pageVisible.value=true;if(pageId==='M15'){form._paymentNow=Date.now();clearInterval(paymentTimer);paymentTimer=setInterval(()=>form._paymentNow=Date.now(),1000)}})
onHide(()=>{showVersion++;pageVisible.value=false;stopReportPolling();clearInterval(paymentTimer);backend.openPolicy=null;if(pageId==='M13')addressDeleteIndex.value=null;if(pageId==='M15')backend.paymentResultNavigating=null});onBeforeUnmount(()=>{showVersion++;pageVisible.value=false;stopReportPolling();clearInterval(paymentTimer);backend.openPolicy=null;if(pageId==='M13')addressDeleteIndex.value=null;if(pageId==='M15')backend.paymentResultNavigating=null})
watch(()=>form.previewCustomer,async()=>{if(pageId==='G55'&&backend.ready)try{await loadMarketingBuyer(form)}catch(e){toast(e.message)}})
watch(()=>[form.previewSku,form.previewQty,form.previewPoints,form.previewScope,form.previewCoupon,form.previewRegion],()=>{if(pageId==='G55')backend.marketingPreview=null})
watch(filter,async(value)=>{if(['G52','G53','G54'].includes(pageId)&&form._marketingTab!==value){form._marketingTab=value;form._marketingKey='';await pageData(pageId,form)}if(pageId==='G58')setReportPeriod(form,value);if(pageId==='G59'){backend.reportPages??={};backend.reportPages.G59=1;try{await refreshMobileReport(pageId,value)}catch(e){toast(e.message)}}})
watch(search,()=>{if(['G39','G42'].includes(pageId))financeListPage.value=1})
watch(()=>form._marketingTab,value=>{if(['G52','G53','G54'].includes(pageId)&&value)filter.value=value})
function back(){
 if(pageId==='M15'&&activeOrder.value){returnToOrderDetail();return}
 if(pageId==='M12'&&createdCheckoutOrder.value){returnToOrderDetail();return}
 if(pageId==='M17'&&backend.crossOrderHomeShopId){
  const home=backend.crossOrderHomeShopId
  backend.crossOrderHomeShopId=null;backend.crossOrderPendingId='';backend.shopId=home
  uni.setStorageSync('hexu-shop-id',home)
  state.activeOrder=null;backend.activeOrder=null
  state.buyNow=null;state.couponId=null
  persist()
  uni.redirectTo({url:'/pages/'+(home===1?'M02':'M03')+'/index'})
  return
 }
 const fallbackUrl='/pages/'+(management?'G01':homePageId())+'/index'
 const {delta,url}=backDestination(getCurrentPages(),'pages/'+pageId+'/index',fallbackUrl)
 if(delta)uni.navigateBack({delta,fail:()=>uni.redirectTo({url})})
 else uni.redirectTo({url})
}
function returnToOrderDetail(){
 const url='/pages/M18/index',delta=backDeltaTo(getCurrentPages(),'M18')
 if(delta)uni.navigateBack({delta,fail:()=>uni.redirectTo({url})})
 else uni.redirectTo({url})
}
function backToCheckoutSource(){
 const target=state.buyNow?.groupId||state.buyNow?.groupCampaignId?'M58':state.buyNow?'M07':'M11'
 const url='/pages/'+target+'/index',delta=backDeltaTo(getCurrentPages(),target)
 if(delta)uni.navigateBack({delta,fail:()=>uni.redirectTo({url})})
 else uni.redirectTo({url})
}
function returnToCheckout(){
  // 选券完成后回到已有结算页，保留积分开关，并由优惠券状态变化触发重新报价。
  const url='/pages/M12/index',delta=backDeltaTo(getCurrentPages(),'M12')
  if(delta)uni.navigateBack({delta,fail:()=>uni.redirectTo({url})})
  else uni.redirectTo({url})
}
function selectProduct(id){state.selectedProduct=id;backend.productSelection=null;if(!backend.guest)persist();navigate('M05')}
async function updateCart(change,successMessage){
 if(backend.guest){requireLogin();return}
 if(backend.cartMutating)return toast('购物车正在同步，请稍候')
 const before=JSON.parse(JSON.stringify(state.cart)),shopId=backend.shopId
 backend.cartMutating=true
 try{if(change()===false)return;persist();await syncCart();if(successMessage)toast(successMessage)}
 catch(e){if(backend.shopId===shopId){try{await refresh()}catch{state.cart=before;persist()}}toast('购物车同步失败：'+e.message)}
 finally{backend.cartMutating=false}
}
async function cartAdd(id,count=1){if(backend.guest){state.selectedProduct=id;backend.productSelection=null;requireLogin('M05');return}return updateCart(()=>{if(!addCart(id,count)){toast('库存不足，无法添加');return false}},'已加入购物车')}
function buy(){if(backend.guest){requireLogin();return}if(isSoldOut(currentProduct.value))return toast('该商品暂时缺货');if(!Number.isSafeInteger(qty.value)||qty.value<1||qty.value>purchaseQuantityLimit(currentProduct.value))return toast('请选择有效购买数量');beginCheckout(state,{id:currentProduct.value.id,qty:qty.value,selected:true});persist();navigate('M12')}
function cartCheckout(){beginCheckout(state);persist();navigate('M12')}
function changeQty(line,d){const n=line.qty+d;if(n<1)return;if(!Number.isSafeInteger(n)||n>findProduct(line.id).stock)return toast('已超过可售库存');return updateCart(()=>line.qty=n)}
function deleteCart(line){return updateCart(()=>state.cart=state.cart.filter(x=>x!==line))}
function toggleAll(){const next=!allSelected.value;return updateCart(()=>state.cart.forEach(x=>x.selected=next))}
function toggleLine(line){return updateCart(()=>{line.selected=!line.selected})}
async function toggleFavorite(id=currentProduct.value.id,removeOnly=false){
 if(backend.guest){requireLogin();return}
 if(backend.favoriteMutating)return
 if(typeof id!=='string'||!id||!removeOnly&&!products.some(product=>product.id===id))return
 if(removeOnly&&!state.favorites.includes(id))return
 const before=[...state.favorites],shopId=backend.shopId
 backend.favoriteMutating=true
 try{state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];await syncFavorites();persist();toast(state.favorites.includes(id)?'已收藏':'已取消收藏')}
 catch(e){if(backend.shopId===shopId){try{await refresh()}catch{state.favorites=before;persist()}}toast('收藏同步失败：'+e.message)}
 finally{backend.favoriteMutating=false}
}
function selectAddress(i){
 const checkout=addressCheckoutPage(getCurrentPages())
 state.selectedAddress=i
 persist()
 if(checkout)uni.navigateBack({delta:1,fail:()=>navigate(checkout)})
 else toast('已选择收货地址')
}
async function setDefault(i){try{await setDefaultAddress(i)}catch(e){toast(e.message)}}
function editAddress(i){state.editAddress=i;persist();navigate('M14')}
async function confirmRemoveAddress(){
  if(addressDeleting.value||addressDeleteIndex.value===null)return
  addressDeleting.value=true
  try{await removeSavedAddress(addressDeleteIndex.value);addressDeleteIndex.value=null}
  catch(e){toast(e.message)}
  finally{addressDeleting.value=false}
}
function removeAddress(i){
  // #ifdef H5
  addressDeleteIndex.value=i
  return
  // #endif
  // #ifndef H5
  uni.showModal({title:'删除地址',content:'确认删除这个收货地址？',success:r=>{if(r.confirm){addressDeleteIndex.value=i;confirmRemoveAddress()}}})
  // #endif
}
function validate(){for(const b of displayBlocks.value)if(b.type==='fields')for(const f of b.items)if(f.required&&!String(form[f.key]??'').trim()){toast('请填写'+f.label);return false}if(form.phone&&!validPhone(form.phone)){toast('请输入正确的手机号码');return false}return true}
async function handle(target){
 if(['G39','G42'].includes(pageId)&&['finance-prev','finance-next'].includes(target)){financeListPage.value=Math.max(1,financeListPage.value+(target==='finance-next'?1:-1));return}
 if(target==='M18'&&['M19','M23','M24'].includes(pageId)){returnToOrderDetail();return}
 if(target?.startsWith('favorite-remove:')){if(pageId==='M08'&&filter.value!=='浏览记录')await toggleFavorite(target.slice(16),true);return}
 if(pageId==='M43'&&target==='M05'){if(!backend.requestedShopId){toast('请先选择目标商城');return}navigate('M44');return;}
 if(target==='M10'){state.reviewParent=null;state.reviewSku=backend.activeOrder?.items?.[0]?.id||'';}
 if(pageId==='M25'&&target?.startsWith('orders:')){state.orderListFilter=target.slice(7);navigate('M17');return}
 if(pageId==='M25'&&['M17','M19','M20'].includes(target)){
  // Status shortcuts open a list, never a stale previously selected order.
  state.orderListFilter=target==='M19'?'待收货':target==='M20'?'售后':'全部'
  navigate('M17');return
 }
 if(pageId==='G02'&&target==='G23'){
  // G23 needs a selected order; the dashboard shortcut starts at the filtered list.
  state.managementOrderListFilter='待发货'
  navigate('G21');return
 }
 if(pageId==='M38'&&target==='M39')target='promotion-apply';
 if(pageId==='G19'&&target==='G20')target='stocktake-propose';
 if(target==='after-type'){state.afterType=form.afterType;backend.afterDraft=JSON.parse(JSON.stringify(form));}
  if(await handleRemote(target,{pageId,form,activeFilter:filter.value,selectedLines:selectedLines.value,payTotal:payTotal.value,pointsDiscount:pointsUsed.value,checkoutQuote:checkoutQuote.value,quoteError:quoteError.value,address:address.value,validate,onQuoteChanged:async()=>{form.orderConsent=false;quoteChangeNotice.value='订单金额已变化，已更新报价。请重新核对金额并确认购买协议。';await refreshCheckoutQuote()}}))return;
 if(!target)return;
  if(pageId==='M61'&&target==='M12'){returnToCheckout();return}
  if(/^[MG]\d{2}$/.test(target)){if(target==='M14')state.editAddress=null;navigate(target);return}
  if(target==='coupon-skip'){state.couponId=null;persist();returnToCheckout();return}
 if(target==='choose-coupon'){
  if(backend.couponSelecting){toast('优惠券校验中，请稍候');return}
   if(!form.coupon&&state.couponId){state.couponId=null;persist();returnToCheckout();return}
  const coupon=backend.coupons.find(c=>c.id===form.coupon&&c.kind==='coupon_claim'&&c.status==='AVAILABLE'&&Number(c.member_id)===Number(backend.member?.id)&&Number(c.shop_id)===Number(backend.shopId)&&Number(c.body?.expiresAt)>Date.now())
  if(!coupon){toast('请先选择当前订单可用的优惠券');return}
   state.couponId=coupon.id;persist();returnToCheckout();return
 }
 if(target==='help'){uni.showModal({title:'提现说明',content:'审核拒绝会说明原因并返还冻结金额。渠道付款失败确认后解冻余额，可核对账户后重新申请。审核通过并不代表到账。',showCancel:false});return}
 if(target==='after-type'){navigate('M21');return}
}
</script>

<style scoped>
.page-header>.icon-button{margin:0}
.primary-tab-header>text{position:absolute;left:50%;transform:translateX(-50%);max-width:calc(100% - 110px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.checkout-remark>textarea{box-sizing:border-box;display:block;width:100%;min-height:96px;text-align:left}
.policy-overlay{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(15,35,27,.55);padding:20px;box-sizing:border-box}
.policy-panel{display:flex;flex-direction:column;gap:16px;width:100%;max-width:430px;max-height:calc(100vh - 40px);padding:20px;border-radius:20px;background:#fff;box-sizing:border-box}
.policy-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
.policy-heading-content{display:flex;flex-direction:column;gap:4px}
.policy-title{font-size:20px;font-weight:700;color:#16392e}
.policy-body{flex:1;min-height:0;height:60vh;color:#243d35;font-size:15px;line-height:1.7;white-space:pre-wrap;word-break:break-word}
.category-page{height:100vh;min-height:0;display:flex;flex-direction:column}
.category-page .status-bar,.category-page .native-status-spacer,.category-page .page-header{flex-shrink:0}
.native-status-mask{position:fixed;top:0;left:0;right:0;z-index:8;background:#f6f7f5;pointer-events:none}
.category-page .category-screen{flex:1;min-height:0!important;height:0;overflow:hidden}
.category-pane{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}
.category-pane .sort-bar{flex-shrink:0;padding:0 10px}
.category-pane .category-results{flex:1;min-height:0;height:0}
.cart-line .product-copy{min-width:0}
.cart-sku{display:block;overflow-wrap:anywhere;word-break:break-all;line-height:1.35}
@media(max-width:359px){.category-pane .sort-bar{padding:0 7px}}
</style>

