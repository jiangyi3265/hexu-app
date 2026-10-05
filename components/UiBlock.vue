<template>
  <view v-if="block.type==='notice'" :class="['notice',block.tone]"><Icon :name="block.tone==='orange'?'alert':'shield'" :size="18"/><view><text class="notice-title">{{block.title}}</text><text class="notice-body">{{block.body}}</text></view></view>
  <view v-else-if="block.type==='hero'" class="hero-card"><Photo :asset="block.asset"/><view class="hero-shade"/><view class="hero-copy"><text class="eyebrow">HEXU · QUALITY LIFE</text><text class="hero-title">{{block.title}}</text><text class="hero-subtitle">{{block.subtitle}}</text></view></view>
  <view v-else-if="block.type==='stats'" :class="['stats',{'stats-dark':block.dark}]" :style="{gridTemplateColumns:'repeat('+Math.min(block.items.length,block.items.length===4?2:3)+',1fr)'}"><view v-for="item in block.items" :key="item.label" @tap="item.target&&$emit('action',item.target)"><text class="stat-value">{{item.value}}</text><text class="stat-label">{{item.label}}</text></view></view>
  <view v-else-if="block.type==='rows'" class="card"><text v-if="block.title" class="section-title">{{block.title}}</text><view v-for="(item,i) in visibleRowItems" :key="i" :class="['info-row',{'is-link':item.target,'order-id-row':item.wrapIdentifier,'is-multiline':item.multiline}]" @tap="item.target&&$emit('action',item.target)"><text class="row-label">{{item.label}}</text><text class="row-value">{{item.value}}</text><Icon v-if="item.target" name="chevron" :size="16"/></view><text v-if="!visibleRowItems.length&&block.emptyText&&backend.ready&&state.serverHydrated" class="empty-text">{{block.emptyText}}</text></view>
  <view v-else-if="block.type==='proofs'" class="card"><text class="section-title">{{block.title}}</text><view class="uploads"><view v-for="(id,i) in block.items" :key="id" class="upload-thumb" :aria-label="'查看财务凭证 '+(i+1)" @tap="previewProof(id)"><view class="upload-photo"><Photo :asset="id" :private-attachment="true" :height="78"/></view></view></view></view>
  <view v-else-if="block.type==='fields'" class="card form-card">
    <text v-if="block.title" class="section-title">{{block.title}}</text>
    <view v-for="item in block.items" :key="item.key" :class="['field',{'field-textarea':item.kind==='textarea'}]">
      <view class="field-label">{{item.label}}<text v-if="item.required" class="required"> *</text></view>
      <text v-if="block.readonly" class="muted">状态由运维平台维护</text>
      <switch v-else-if="item.kind==='switch'" :checked="!!form[item.key]" color="#155641" @change="set(item.key,$event.detail.value)"/>
      <view v-else-if="item.kind==='select'&&item.clearable" class="profile-picker-control"><picker :range="item.options||[]" :value="Math.max(0,(item.options||[]).indexOf(form[item.key]||item.emptyLabel))" @change="set(item.key,selectOption(item,$event.detail.value))"><view class="picker-value">{{form[item.key]||item.emptyLabel||'请选择'}} <Icon name="chevron" :size="14"/></view></picker><button v-if="form[item.key]" class="optional-picker-clear" :aria-label="'清除'+item.label" @tap.stop="set(item.key,'')">清除</button></view>
      <picker v-else-if="item.kind==='select'" :range="item.options||[]" :value="Math.max(0,(item.options||[]).indexOf(form[item.key]))" @change="set(item.key,item.options[Number($event.detail.value)])"><view class="picker-value">{{form[item.key]||'请选择'}} <Icon name="chevron" :size="14"/></view></picker>
      <view v-else-if="item.kind==='date'&&item.clearable" class="profile-picker-control"><picker mode="multiSelector" :range="datePickers[item.key]?.range||[]" :value="datePickers[item.key]?.indices||[0,0,0]" @columnchange="moveDate(item,$event)" @change="set(item.key,selectedDate(datePickers[item.key],$event.detail.value))" @cancel="resetDate(item)"><view class="picker-value">{{form[item.key]||'请选择'}} <Icon name="chevron" :size="14"/></view></picker><button v-if="form[item.key]" class="optional-picker-clear" :aria-label="'清除'+item.label" @tap.stop="set(item.key,'')">清除</button></view>
      <picker v-else-if="item.kind==='date'" mode="multiSelector" :range="datePickers[item.key]?.range||[]" :value="datePickers[item.key]?.indices||[0,0,0]" @columnchange="moveDate(item,$event)" @change="set(item.key,selectedDate(datePickers[item.key],$event.detail.value))" @cancel="resetDate(item)"><view class="picker-value">{{form[item.key]||'请选择'}} <Icon name="chevron" :size="14"/></view></picker>
      <view v-else-if="item.kind==='region'" class="profile-field-control profile-picker-control">
        <!-- #ifdef MP-WEIXIN -->
        <picker mode="region" :value="form[item.key]||[]" @change="set(item.key,$event.detail.value)"><view class="picker-value">{{(form[item.key]||[]).join(' ')||'请选择'}} <Icon name="chevron" :size="14"/></view></picker>
        <!-- #endif -->
        <!-- #ifdef H5 -->
        <picker mode="multiSelector" :range="regionPickers[item.key]?.range||[]" :value="regionPickers[item.key]?.indices||[0,0,0]" @columnchange="moveRegion(item,$event)" @change="set(item.key,selectedRegion(regionPickers[item.key],$event.detail.value))" @cancel="resetRegion(item)"><view class="picker-value">{{(form[item.key]||[]).join(' ')||'请选择'}} <Icon name="chevron" :size="14"/></view></picker><button v-if="(form[item.key]||[]).length" class="optional-picker-clear" :aria-label="'清除'+item.label" @tap.stop="set(item.key,[])">清除</button>
        <!-- #endif -->
      </view>
      <view v-else-if="item.kind==='addressRegion'" class="profile-field-control profile-picker-control">
        <!-- #ifdef MP-WEIXIN -->
        <picker mode="region" :value="String(form[item.key]||'').trim().split(/\s+/).filter(Boolean)" @change="set(item.key,$event.detail.value.join(' '))"><view class="picker-value">{{form[item.key]||'请选择'}} <Icon name="chevron" :size="14"/></view></picker>
        <!-- #endif -->
        <!-- #ifdef H5 -->
        <picker mode="multiSelector" :range="regionPickers[item.key]?.range||[]" :value="regionPickers[item.key]?.indices||[0,0,0]" @columnchange="moveRegion(item,$event)" @change="set(item.key,selectedRegion(regionPickers[item.key],$event.detail.value).join(' '))" @cancel="resetRegion(item)"><view class="picker-value">{{form[item.key]||'请选择'}} <Icon name="chevron" :size="14"/></view></picker>
        <!-- #endif -->
      </view>
      <view v-else-if="item.kind==='phone'" class="profile-field-control">
        <!-- #ifdef MP-WEIXIN -->
        <button class="profile-phone" open-type="getPhoneNumber" :disabled="backend.busy" @getphonenumber="changePhone">{{form[item.key]||'点击授权手机号'}}</button>
        <!-- #endif -->
        <!-- #ifdef H5 -->
        <text class="muted">{{form[item.key]||'请在微信内授权手机号'}}</text>
        <!-- #endif -->
      </view>
      <view v-else-if="item.kind==='stepper'" class="stepper"><button aria-label="减少数量" :disabled="item.max===0" @tap="setQuantity(item,-1)">−</button><input :value="form[item.key]" type="number" :maxlength="9" :disabled="item.max===0" @input="inputQuantity(item,$event.detail.value)"/><button aria-label="增加数量" :disabled="item.max===0" @tap="setQuantity(item,1)">+</button></view>
      <text v-else-if="item.kind==='readonly'" class="muted">{{form[item.key]}}</text>
      <textarea v-else-if="item.kind==='textarea'" :value="form[item.key]" :placeholder="'请输入'+item.label" :maxlength="item.maxlength??500" :aria-label="item.label" @input="set(item.key,$event.detail.value)"/>
      <input v-else :value="form[item.key]" :type="item.kind==='number'?'digit':'text'" :placeholder="item.label.includes('凭证编号（可后补）')?'请输入编号':'请输入'+item.label" :maxlength="item.maxlength??140" :aria-label="item.label" @input="set(item.key,$event.detail.value)"/>
    </view>
  </view>
  <view v-else-if="block.type==='product'" class="card product-line" @tap="$emit('action',block.target||'product:'+prod.id)"><view class="product-thumb"><Photo :asset="prod.asset" :private-attachment="!!block.privateProductAssets"/></view><view class="product-copy"><text class="product-name">{{block.name||prod.name}}</text><text class="muted small">{{prod.spec||prod.desc}}</text><view class="spread"><text class="price">{{String(block.price||'').includes('积分')?'':'¥'}}{{block.price||money(prod.price)}}</text><text class="muted small">×{{block.qty||1}}</text></view></view></view>
  <view v-else-if="block.type==='wholesaleItem'" class="card wholesale-item">
    <view class="product-line inner"><view class="product-thumb"><Photo :asset="block.product.asset||block.product.gallery?.[0]||''"/></view><view class="product-copy"><text class="product-name">{{block.product.name||'商品资料缺失'}}</text><text class="muted small wholesale-meta">{{block.product.spec||'规格未维护'}} · SKU {{block.product.id}}</text><view class="spread"><text class="price">¥{{money(block.product.price)}}/件</text><text class="muted small">{{block.product.box_size}}件/箱 · {{block.product.min_boxes}}箱起</text></view></view></view>
    <view class="field"><text class="field-label">采购数量（件）</text><view v-if="block.editable" class="stepper"><button aria-label="减少采购数量" @tap="setQuantity({key:block.key,max:block.product.stock??block.product.available},-1)">−</button><input :value="form[block.key]" type="number" maxlength="6" :aria-label="'采购数量 '+block.product.name" @input="inputQuantity({key:block.key},$event.detail.value)"/><button aria-label="增加采购数量" @tap="setQuantity({key:block.key,max:block.product.stock??block.product.available},1)">+</button></view><text v-else>{{block.qty}} 件</text></view>
    <button v-if="block.removable" class="mini-btn" :aria-label="'移除 '+block.product.name" @tap="$emit('action','wholesale-remove:'+block.product.id)">移除商品</button>
  </view>
  <view v-else-if="block.type==='links'" class="card quick-links" :style="{gridTemplateColumns:'repeat('+Math.min(block.items.length,4)+',1fr)'}"><button v-for="item in block.items" :key="item.title" :disabled="item.disabled" @tap="!item.disabled&&$emit('action',item.target)"><view class="icon-tile"><Icon :name="item.icon" :size="25"/></view><text>{{item.title}}</text></button></view>
  <scroll-view v-else-if="block.type==='tabs'" scroll-x class="tabs-scroll"><view class="tabs"><button v-for="(item,i) in block.items" :key="item" :class="{active:tab===i}" @tap="tab=i;$emit('filter',item)">{{item}}</button></view></scroll-view>
  <view v-else-if="block.type==='search'" class="search-bar"><Icon name="search" :size="18"/><input :value="search||''" :placeholder="block.placeholder" @input="$emit('search',$event.detail.value)"/><button v-if="search" @tap="$emit('search','')">×</button></view>
  <view v-else-if="block.type==='timeline'" class="card timeline"><view v-for="(item,i) in block.items" :key="i" :class="['timeline-item',{current:i===block.active,done:i<block.active}]"><view class="timeline-dot"><text v-if="i<block.active">✓</text></view><view><text>{{item.split(' · ')[0]}}</text><text v-if="item.includes(' · ')" class="muted small">{{item.split(' · ').slice(1).join(' · ')}}</text></view></view></view>
  <view v-else-if="block.type==='upload'" class="card"><text class="section-title">{{block.title}}</text><view class="uploads"><view v-if="block.existingAsset&&!uploads.length" class="upload-thumb" @tap="previewExistingCover"><view class="upload-photo"><Photo :asset="block.existingAsset" :height="78"/></view></view><view v-for="(file,i) in uploads" :key="i" class="upload-thumb" @tap="uploadActions(i)"><view class="upload-photo"><Photo :asset="file" :private-attachment="privateUploads" :height="78"/></view></view><button class="upload-button" :disabled="backend.uploadingCount>0||block.disabled" @tap="choose"><Icon name="camera" :size="28"/><text>点击上传</text></button></view><text class="muted tiny">支持 JPG、PNG，每张不超过5MB，最多9张；点击图片可预览或移除</text></view>
  <view v-else-if="block.type==='options'" class="card option-list"><button v-for="item in block.items" :key="item" :class="{selected:(form[block.key]||block.items[0])===item}" @tap="set(block.key,item)"><text>{{item}}</text><view class="radio">{{(form[block.key]||block.items[0])===item?'✓':''}}</view></button></view>
  <view v-else-if="block.type==='profile'" :class="['profile-card',{dark:block.dark}]"><view class="avatar" :aria-label="block.editableAvatar?'更换头像':undefined" @tap="block.editableAvatar&&chooseAvatar()"><Photo :asset="block.avatar||'avatar'" :private-attachment="!!block.privateAvatar" fallback="avatar" :radius="50"/></view><view><text class="profile-name">{{block.name}}</text><text class="small">{{block.subtitle}}</text></view></view>
  <view v-else-if="block.type==='consent'" class="consent" @tap="set(block.key,!form[block.key])"><view :class="['checkbox',{checked:form[block.key]}]">{{form[block.key]?'✓':''}}</view><text>{{block.label}}</text><text v-if="block.policyType" class="green" @tap.stop="$emit('action','policy:'+block.policyType)">查看正文</text></view>
  <view v-else-if="block.type==='checklist'" class="card"><view v-for="(item,i) in block.items" :key="item" class="check-row" @tap="block.editable!==false&&set('check'+i,!form['check'+i])"><view :class="['checkbox',{checked:block.completed||form['check'+i]}]">{{block.completed||form['check'+i]?'✓':''}}</view><text>{{item}}</text></view></view>
  <view v-else-if="block.type==='success'" class="success-card"><view class="success-icon"><Icon :name="block.icon||'check'" :size="42" color="white"/></view><text class="success-title">{{block.title}}</text><text v-if="block.value" class="success-value">{{block.value}}</text><text class="muted">{{block.body}}</text></view>
  <view v-else-if="block.type==='amount'" class="amount-card"><text class="muted">{{block.label}}</text><text class="amount-number"><text class="currency">¥</text>{{block.value}}</text></view>
  <view v-else-if="block.type==='rating'" class="card"><text class="section-title">商品评分</text><view class="rating"><button v-for="i in 5" :key="i" :class="{gold:i<=(form.rating||5)}" @tap="set('rating',i)">★</button><text class="muted">{{form.rating||5}}分 {{ratingLabel(form.rating||5)}}</text></view></view>
  <view v-else-if="block.type==='reviews'" class="card">
    <view v-for="review in (block.items??backend.reviews)" :key="review.id" class="review">
      <view class="spread"><text>{{review.name}}</text><text class="gold">{{'★'.repeat(Number(review.rating)||0)}}</text></view>
      <text class="muted tiny">{{reviewTimeLabel(review.createdAt)}}</text><text>{{review.content}}</text>
      <view v-if="review.images?.length" class="uploads"><view v-for="(url,i) in review.images" :key="url" class="review-photo" @tap="previewReview(review.images,i)"><Photo :asset="url"/></view></view>
      <view v-for="append in review.appends||[]" :key="append.id" class="review-append"><text class="green small">追加评价 · {{reviewTimeLabel(append.createdAt)}}</text><text>{{append.content}}</text><view v-if="append.images?.length" class="uploads"><view v-for="(url,i) in append.images" :key="url" class="review-photo" @tap="previewReview(append.images,i)"><Photo :asset="url"/></view></view></view>
      <button v-if="review.mine&&(review.appendAllowed||review.appendSupplementAllowed)" class="mini-btn" @tap="$emit('action','review-append:'+review.id)">{{review.appendStatus==='SUPPLEMENT'?'补充追评':'追加评价'}}</button><text v-else-if="review.mine&&review.appendStatus" class="muted tiny">追评状态：{{({PENDING:'待审核',APPROVED:'审核通过',SUPPLEMENT:'待补充',REJECTED:'已驳回'}[review.appendStatus]||review.appendStatus)}}</text>
    </view><text v-if="!(block.items??backend.reviews).length" class="muted small">暂无已审核评价</text>
  </view>
  <view v-else-if="block.type==='chart'" class="card"><view class="spread"><text class="section-title">{{block.title}}</text><text class="muted tiny">{{block.periodLabel||(block.values.length===7?'近7天':'本期')}}</text></view><view :class="['chart',{'chart-signed':block.signed}]"><view class="chart-grid"/><view v-for="(value,i) in block.values" :key="i" class="chart-column"><view :class="['bar',{'bar-negative':block.signed&&value<0,'bar-zero':block.signed&&value===0}]" :style="{height:(block.signed?Math.abs(value)/2:value)+'%'}"><text>{{block.actualValues?.[i]??value}}</text></view><text class="chart-label">{{block.labels?.[i]||(''+(i+1)+(block.values.length===7?'日':'月'))}}</text></view></view></view>
  <view v-else-if="block.type==='progress'" class="card"><text class="section-title">考核指标</text><view v-for="item in block.items" :key="item[0]" class="progress-item"><view class="spread"><text>{{item[0]}}</text><text class="green">{{item[1]}}</text></view><view class="progress-track"><view :style="{width:item[2]+'%'}"/></view><text class="tiny green">{{item[2]>=100?'已达标':'继续努力'}}</text></view></view>
  <view v-else-if="block.type==='relation'" class="card relation"><view v-for="(item,i) in block.items" :key="item"><view class="relation-node"><Icon :name="i===0?'shop':'user'"/><text>{{item}}</text></view><view v-if="i<block.items.length-1" class="relation-arrow">↓</view></view></view>
  <view v-else-if="block.type==='people'" class="card"><view v-for="(item,i) in visibleItems" :key="item[0]" class="person" @tap="(item[4]||block.target)&&$emit('action',item[4]||block.target)"><view :class="['initial','initial-'+i%3]">{{item[0].slice(0,1)}}</view><view class="flex-one"><view class="spread"><text class="bold">{{item[0]}}</text><text class="bold">{{item[2]}}</text></view><view class="spread"><text class="badge">{{item[1]}}</text><text class="muted tiny">{{item[3]}}</text></view></view></view><text v-if="!visibleItems.length&&block.emptyText&&backend.ready&&state.serverHydrated" class="empty-text">{{block.emptyText}}</text></view>
  <view v-else-if="block.type==='ledger'" class="card"><view v-for="(item,i) in visibleItems" :key="item[0]+'-'+item[1]+'-'+i" class="ledger-row" @tap="item[3]&&$emit('action',item[3])"><view><text>{{item[0]}}</text><text class="muted tiny">{{item[1]}}</text></view><text :class="['ledger-value',(item[2].startsWith('−')||item[2].startsWith('-'))?'red':'green']">{{item[2]}}</text></view></view>
<view v-else-if="['productGrid','pointsProducts','productList','stock'].includes(block.type)" :class="['products',{'product-list':block.type==='productList'||block.type==='stock'}]">
  <view v-for="p in visibleProducts" :key="p.id" class="product-card" @tap="$emit('action',block.productAction?block.productAction+p.id:block.target||(block.type==='pointsProducts'?'points-product:'+p.id:block.type==='stock'?'stock-product:'+p.id:'product:'+p.id))">
    <view class="goods-photo"><Photo :asset="p.asset" :private-attachment="!!block.privateProductAssets"/></view>
    <view class="goods-info"><text class="product-name">{{p.name}}</text><text class="muted tiny">{{block.type==='stock'?'SKU '+stockSku(p):p.desc}}{{block.stockStatus?' · '+(p.unavailable?'已下架':Number(p.stock)<1?'暂时缺货':'有货'):''}}</text>
      <view class="spread"><text class="price">{{p.unavailable?'已下架':block.type==='pointsProducts'?p.point_price+'积分':block.type==='stock'?'可售 '+p.stock:'¥'+money(p.price)}}</text><button v-if="block.removable" class="badge favorite-remove" :aria-label="'取消收藏'+p.name" @tap.stop="$emit('action','favorite-remove:'+p.id)">取消收藏</button><text v-else class="badge">{{block.type==='stock'?(p.stock<=Number(p.warning_qty||0)?'库存预警':'充足'):p.badge||'精选'}}</text></view>
    </view>
  </view>
  <text v-if="!visibleProducts.length&&block.emptyText&&backend.ready&&state.serverHydrated&&!backend.pageLoading[block.type==='stock'?'G17':'G09']" class="empty-text">{{block.emptyText}}</text>
</view>
  <view v-else-if="block.type==='shops'" class="shop-list"><view v-for="shop in backend.shops" :key="shop.id" class="card" @tap="$emit('action',block.management?'G05':'switch-shop:'+shop.id)"><view class="shop-heading"><view class="shop-icon"><Icon name="shop" :size="28"/></view><view class="flex-one"><text class="bold">{{shop.name}}</text><text class="small muted">{{shop.kind==='DIRECT'?'公司直营':'经销商商城'}} · {{shop.status==='ACTIVE'?'正常经营':shop.status}}</text></view><Icon name="chevron" :size="18"/></view><text class="small muted">{{shop.county}}</text><view class="spread"><text class="badge">{{shop.id===backend.shopId?'我的商城':'独立商城'}}</text><text class="green small">{{block.management?'查看详情':'进入商城'}} →</text></view></view></view>
  <view v-else-if="block.type==='coupons'" class="coupons"><view v-for="(coupon,i) in coupons" :key="coupon.id" :class="['coupon',{unavailable:coupon.uiUnavailable}]" @tap="selectCoupon(i)"><view class="coupon-amount"><text><text class="small">{{coupon.body.type==='DISCOUNT'?'':'¥'}}</text>{{coupon.body.type==='DISCOUNT'?Number(coupon.body.rateBps)/1000+'折':coupon.amount}}</text><text class="tiny">满{{coupon.threshold}}元可用</text></view><view class="coupon-copy"><text class="bold">{{coupon.title}}</text><text class="tiny muted">{{state.shop}} · {{coupon.scope}}</text><text class="tiny muted">有效期至 {{coupon.expiryLabel}}</text></view><button class="coupon-button" :disabled="coupon.uiAction===''||claimingCoupon===coupon.id">{{block.choose?(form.coupon===coupon.id?'已选择':coupon.uiLabel):claimingCoupon===coupon.id?'领取中…':coupon.uiLabel}}</button></view><view v-if="!coupons.length&&backend.ready&&state.serverHydrated&&!backend.pageLoading[block.choose?'M61':'M55']" class="empty-state"><Icon name="coupon" :size="44"/><text>{{couponEmptyText}}</text></view></view>
  <view v-else-if="block.type==='messages'" class="card"><view v-for="(message,i) in messages" :key="i" class="message-item" @tap="$emit('action',message.target)"><view class="icon-tile"><Icon :name="message.icon"/></view><view class="flex-one"><view class="spread"><text class="bold">{{message.title}}</text><text class="tiny muted">{{message.time}}</text></view><text class="small muted">{{message.body}}</text></view><view v-if="!message.read" class="unread-dot"/></view><text v-if="!messages.length&&backend.ready&&state.serverHydrated&&!backend.pageLoading.M64" class="small muted">暂无符合条件的消息</text></view>
  <view v-else-if="block.type==='poster'" class="card poster"><text class="eyebrow">禾序商贸 · 品质好生活</text><text class="poster-title">好物有序<br/>美好生活</text><view class="poster-image"><Photo asset="hero"/></view><view class="spread"><view><text class="bold">C 云代理邀您同行</text><text class="muted tiny">识别专属邀请二维码</text></view><view class="qr"><Photo asset="qr"/></view></view></view>
  <view v-else-if="block.type==='table'" class="card table-card"><text class="section-title">{{block.title}}</text><view v-if="block.stocktakeReview" class="stocktake-table-toolbar"><text>{{showAllStocktake?'已优先列出':'仅显示'}} {{differenceRows.length}} 条差异 · 共 {{block.rows.length}} 条</text><button class="mini-btn" @tap="showAllStocktake=!showAllStocktake">{{showAllStocktake?'仅看差异':'查看全部'}}</button></view><text v-if="block.stocktakeReview&&!tableRows.length" class="muted small">本次无差异，可查看全部盘点项。</text><scroll-view v-if="tableRows.length||!block.stocktakeReview" scroll-x><view class="data-table"><view class="table-row table-head"><text v-for="head in block.heads" :key="head">{{head}}</text></view><view v-for="(row,i) in tableRows" :key="i" :class="['table-row',{'stocktake-difference':block.stocktakeReview&&Number(row[3])!==0,'stocktake-negative':block.stocktakeReview&&Number(row[3])<0}]"><template v-for="(cell,j) in row" :key="j"><input v-if="block.editKeys" :aria-label="block.heads[j]" :value="form[block.editKeys[j]]" :type="j?'digit':'text'" :maxlength="block.editKeys[j]==='规格'?160:-1" :disabled="block.disabledKeys?.includes(block.editKeys[j])" style="width:100%;font-size:inherit;text-align:center" @input="set(block.editKeys[j],$event.detail.value)"/><text v-else>{{cell}}</text></template></view></view></scroll-view></view>
  <view v-else-if="block.type==='sortable'" class="card"><view v-for="(item,i) in sortItems" :key="item" class="info-row"><text class="muted">☰</text><text class="flex-one">{{item}}</text><button class="mini-btn" :disabled="i===0" @tap="move(i,-1)">↑</button><button class="mini-btn" :disabled="i===sortItems.length-1" @tap="move(i,1)">↓</button></view></view>
  <view v-else-if="block.type==='settlement'" class="card"><text class="section-title">分账试算明细</text><view v-for="item in settlementRows" :key="item[0]" class="info-row"><text class="row-label">{{item[0]}}</text><text class="row-value green">{{item[1]}}</text></view></view>
  <view v-else-if="block.type==='orderList'" class="orders"><view v-for="o in visibleOrders" :key="o.id" class="card" @tap="selectOrder(o,!!block.management)"><view class="spread order-heading"><text class="small order-number">{{o.id}}</text><text class="green order-status">{{o.status}}</text></view><view v-for="line in o.items" :key="line.lineId" class="product-line inner"><view class="product-thumb"><Photo :asset="line.asset||''"/></view><view class="product-copy"><text class="product-name">{{line.name}}</text><text class="muted small">{{line.spec||''}} × {{line.qty}}</text><text class="price">{{orderLineDisplayAmount(o,line,money)}}</text></view></view><view class="order-actions"><button v-if="o.rawStatus==='UNPAID'&&!block.management" class="mini-btn" @tap.stop="cancelOrder(o)">取消订单</button><button class="mini-btn" @tap.stop="openOrderAction(o)">{{block.management&&o.rawStatus==='PAID'?'去发货':o.rawStatus==='UNPAID'?'去付款':o.rawStatus==='SHIPPED'?'查看物流':'查看订单'}}</button></view></view><view v-if="!visibleOrders.length&&backend.ready&&state.serverHydrated" class="empty-state"><Icon name="file" :size="48"/><text>暂无相关订单</text></view></view>
<view v-else-if="block.type==='cases'" class="cases"><view v-for="r in visibleRefunds" :key="r.id" class="card" @tap="selectRefund(r)"><view class="spread"><text class="bold">{{refundTypes[r.refund_type]}} · {{r.member_id}}</text><text class="badge">{{afterSaleStatusLabel(r,refundStatuses[r.status]||r.status)}}</text></view><view class="product-line inner"><view class="product-thumb"><Photo :asset="refundProduct(r).asset"/></view><view class="product-copy"><text>{{r.order_id}}</text><text class="muted small">{{r.reason}} · 申请数量{{r.qty}}件</text><text class="price">{{refundDisplayAmount(r,money)}}</text></view></view><view class="spread"><text class="tiny muted">{{r.id}}</text><text class="green">查看详情 →</text></view></view><view v-if="!visibleRefunds.length&&backend.ready&&state.serverHydrated&&!backend.pageLoading.G25" class="empty-state"><Icon name="file" :size="48"/><text>暂无相关售后申请</text></view></view>
<view v-if="reviewPreview.urls.length" class="review-preview-layer" :style="reviewPreviewStyle">
  <view class="review-preview-head"><button class="review-preview-close" aria-label="关闭图片预览" @tap="closeReviewPreview">×</button><text>{{reviewPreview.current+1}} / {{reviewPreview.urls.length}}</text></view>
  <swiper class="review-preview-swiper" :current="reviewPreview.current" :circular="reviewPreview.urls.length>1" @change="reviewPreview.current=Number($event.detail.current)||0">
    <swiper-item v-for="(url,i) in reviewPreview.urls" :key="url+'-'+i"><image class="review-preview-image" :src="url" mode="aspectFit" @error="toast('图片暂不可用')"/></swiper-item>
  </swiper>
</view>
</template>

<script setup>
import {computed,ref,watch,onUnmounted} from 'vue'
import Icon from './Icon.vue'
import Photo from './Photo.vue'
import {dateColumns,moveDateColumn,selectedDate} from '../data/date-picker'
import {regionColumns,moveRegionColumn,selectedRegion} from '../data/region-picker.mjs'
import {ratingLabel,reviewTimeLabel,reviewPreviewTarget} from '../data/reviews'
import {dateTimeLabel} from '../data/datetime'
import {couponCards,toggledCouponId} from '../data/coupons'
import {productMatchesSearch,stockSku} from '../data/product-search.mjs'
import {canApplyAvatarUpload} from '../data/profile'
import {stepperInput,shiftStepper} from '../data/stepper-input.mjs'
import {products,money,state,toast} from '../data/store'
import {orderLineDisplayAmount,refundDisplayAmount,afterSaleStatusLabel,settlement} from '../data/business.mjs'
import {backend,apiBase,selectOrder,selectRefund,uploadAttachment,authorizeProfilePhone,claimCoupon,validateCheckoutCoupon} from '../data/backend'
const props=defineProps({block:Object,form:Object,filter:String,search:String})
const emit=defineEmits(['action','update','filter','search'])
const set=(key,value)=>emit('update',key,value)
const selectOption=(item,index)=>{const value=item.options?.[Number(index)];return item.emptyLabel&&value===item.emptyLabel?'':value}
const componentActive=ref(true)
const reviewPreview=ref({urls:[],current:0})
const reviewPreviewStyle=ref({})
function openInlinePreview(urls,current=0){
 reviewPreview.value={urls,current}
 // #ifdef H5
 fitReviewPreview()
 window.addEventListener('resize',fitReviewPreview)
 window.addEventListener('scroll',fitReviewPreview,true)
 // #endif
}
// #ifdef H5
function fitReviewPreview(){
 const canvas=document.querySelector('.mobile-app')?.getBoundingClientRect()
 if(!canvas)return
 const top=Math.max(0,canvas.top)
 reviewPreviewStyle.value={left:`${canvas.left}px`,top:`${top}px`,width:`${canvas.width}px`,height:`${Math.max(0,Math.min(window.innerHeight,canvas.bottom)-top)}px`,right:'auto',bottom:'auto'}
}
// #endif
function closeReviewPreview(){
 reviewPreview.value={urls:[],current:0}
 // #ifdef H5
 window.removeEventListener('resize',fitReviewPreview)
 window.removeEventListener('scroll',fitReviewPreview,true)
 // #endif
}
onUnmounted(()=>{componentActive.value=false;closeReviewPreview()})
const datePickers=ref({})
function resetDate(item){datePickers.value[item.key]=dateColumns(props.form[item.key],item.start,item.end)}
function moveDate(item,event){datePickers.value[item.key]=moveDateColumn(datePickers.value[item.key],event.detail.column,event.detail.value,item.start,item.end)}
watch(()=>JSON.stringify((props.block.items||[]).filter(item=>item.kind==='date').map(item=>[item.key,props.form[item.key],item.start,item.end])),()=>{for(const item of props.block.items||[])if(item.kind==='date')resetDate(item)},{immediate:true})
const regionPickers=ref({})
function resetRegion(item){regionPickers.value[item.key]=regionColumns(props.form[item.key])}
function moveRegion(item,event){regionPickers.value[item.key]=moveRegionColumn(regionPickers.value[item.key],event.detail.column,event.detail.value)}
watch(()=>JSON.stringify((props.block.items||[]).filter(item=>['region','addressRegion'].includes(item.kind)).map(item=>[item.key,props.form[item.key]])),()=>{for(const item of props.block.items||[])if(['region','addressRegion'].includes(item.kind))resetRegion(item)},{immediate:true})
function inputQuantity(item,value){const input=stepperInput(value);set(item.key,input.value);if(!input.valid)toast('数量请输入1–999999999之间的整数')}
function setQuantity(item,delta){inputQuantity(item,shiftStepper(props.form[item.key],delta,item.max))}
const tab=ref(0),uploads=ref([]),claimed=ref([]);const sortItems=computed(()=>props.form.sortOrder||props.block.items||[])
// 盘点审核先呈现差异项，展开时仍保留完整原始清单。
const showAllStocktake=ref(false)
const differenceRows=computed(()=>(props.block.rows||[]).filter(row=>Number(row[3])!==0))
const tableRows=computed(()=>!props.block.stocktakeReview?props.block.rows||[]:showAllStocktake.value?[...differenceRows.value,...(props.block.rows||[]).filter(row=>Number(row[3])===0)]:differenceRows.value)
watch(()=>props.block.stocktakeId,()=>{showAllStocktake.value=false})
watch(()=>[props.filter,props.block.items],()=>{if(props.block.type==='tabs'){const index=(props.block.items||[]).indexOf(props.filter);if(index>=0)tab.value=index}},{immediate:true})
watch(()=>props.form._catalogId,()=>{if(props.form._catalogId)uploads.value=[...(props.form.uploads||[])]},{immediate:true})
watch(()=>props.form.uploads,value=>{if(props.block.type==='upload')uploads.value=[...(value||[])]},{immediate:true})
const prod=computed(()=>props.block.product||products.find(p=>p.id===props.block.id)||{id:props.block.id||'',asset:'',name:props.block.name||'商品资料待读取',spec:'',desc:'',price:0})
const visibleItems=computed(()=>(props.block.items||[]).filter(x=>!props.search||x.join(' ').includes(props.search)))
const visibleRowItems=computed(()=>!props.block.searchable?props.block.items||[]:(props.block.items||[]).filter(item=>(String(item.label||'')+' '+String(item.value||'')).toLowerCase().includes(String(props.search||'').trim().toLowerCase())))
const visibleProducts=computed(()=>{
 let p=(props.block.products||products).filter(item=>!props.block.ids||props.block.ids.includes(item.id))
 if(props.block.includeUnavailable&&Array.isArray(props.block.ids)){
  const present=new Set(p.map(item=>item.id))
  for(const id of props.block.ids){
   if(typeof id!=='string'||!id||present.has(id))continue
   p.push({id,name:'商品已下架',desc:'该商品暂不可售',asset:'',stock:0,unavailable:true})
   present.add(id)
  }
 }
 if(props.block.orderedIds){const order=new Map();props.block.ids.forEach((id,index)=>{if(!order.has(id))order.set(id,index)});p.sort((a,b)=>order.get(a.id)-order.get(b.id))}
 if(props.block.type==='pointsProducts')p=p.filter(item=>Number(item.point_price)>0)
 if(props.search)p=p.filter(item=>productMatchesSearch(item,props.search))
 if(props.filter==='零库存')p=p.filter(item=>!item.stock)
 if(props.filter==='低库存')p=p.filter(item=>props.block.type==='stock'?item.stock<=Number(item.warning_qty||0):item.stock<50)
 return p
})
const coupons=computed(()=>couponCards(backend.coupons,{status:props.filter,type:props.block.couponType,choose:!!props.block.choose,orderSkuIds:props.block.choose?(state.buyNow?[state.buyNow.id]:state.cart.filter(line=>line.selected).map(line=>line.id)):[],stackBlocked:!!props.block.choose&&!!backend.couponPolicy?.blocked}))
const couponEmptyText=computed(()=>{
 if(props.block.choose)return '当前订单暂无可用优惠券'
 const filtered=props.filter&&props.filter!=='全部'||props.block.couponType&&props.block.couponType!=='全部类型'
 return filtered?'暂无符合条件的优惠券':'暂无优惠券，关注商城活动获取优惠'
})
const claimingCoupon=ref('')
const messages=computed(()=>state.notifications.map(x=>{const type=x.event||'SYSTEM',category=type.startsWith('ORDER_')?'订单':type==='REFUND_UPDATED'?'售后':type==='AGENT_UPDATED'?'代理':['WITHDRAW_UPDATED','POINTS_UPDATED'].includes(type)?'资金':'系统';return {title:x.message,body:x.body||x.message,category,icon:category==='资金'?'wallet':category==='订单'?'file':'bell',target:'message-open:'+x.id,read:x.read,time:dateTimeLabel(x.time,{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}}).filter(m=>!props.filter||props.filter==='全部'||m.category===props.filter))
const settlementRows=computed(()=>{if(props.block.items)return props.block.items;const s=settlement(Math.max(1,Number(props.form.quantity)||1),(Number(props.form.rate)||0)/100);return [['C1 零售毛利','¥'+money(s.retail)],['C 同级分红','¥'+money(s.peer)],['B 中心毛利','¥'+money(s.center)],['A 总代毛利','¥'+money(s.ownerGross)],['A 分红承担','−¥'+money(-s.ownerCost)],['A 实际净收益','¥'+money(s.ownerNet)]]})
const privateUploads=computed(()=>true)
function choose(){
 const count=Math.max(uploads.value.length,props.form.uploads?.length||0)
 if(count>=9){toast('最多上传9张');return}
 const form=props.form,memberId=backend.member?.id,token=backend.token,shopId=backend.shopId
 const route=getCurrentPages().slice(-1)[0]?.route||''
 const purpose=route.includes('G60')?'STOREFRONT':route.includes('G07')?'MERCHANT':/M2[0-4]|G2[5-8]/.test(route)?'RETURN':route.includes('M10')?'REVIEW':route.includes('M29')?'SUPPORT':route.includes('G10')?'PRODUCT':route.includes('G46')?'FINANCE':route.includes('G56')?'LINK_CONFIRMATION':'IDENTITY'
  const review=purpose==='REVIEW'?backend.reviewContext:null
  const reviewKey=review?JSON.stringify([review.shopId,review.orderId,review.skuId,state.reviewParent||'']):''
  const draftScope=form._reviewScope
  const current=()=>props.form===form&&backend.member?.id===memberId&&Number(backend.shopId)===Number(shopId)&&
   (getCurrentPages().slice(-1)[0]?.route||'')===route&&
   (purpose==='REVIEW'
    ? !!backend.token&&!!draftScope&&form._reviewScope===draftScope&&backend.activeOrder?.id===review?.orderId&&state.activeOrder===review?.orderId&&state.reviewSku===review?.skuId&&
      JSON.stringify([backend.reviewContext?.shopId,backend.reviewContext?.orderId,backend.reviewContext?.skuId,state.reviewParent||''])===reviewKey
    : componentActive.value&&backend.token===token)
 uni.chooseImage({count:9-count,success:async r=>{
  if(!current())return
  for(const file of r.tempFilePaths||[]){
   if(!current())return
   try{
    const uploaded=await uploadAttachment(file,purpose,purpose==='REVIEW'?review.shopId:shopId)
    if(!current())return
    // 原生选图可重建同页上传组件；评价草稿属于页面，核对业务范围后直接写回。
    if(purpose==='REVIEW')form.uploads=[...(form.uploads||[]),uploaded.id]
    else set('uploads',[...(form.uploads||[]),uploaded.id])
   }catch(e){if(current())toast(e.message);else return}
  }
 }})
}
function removeUpload(i){uploads.value.splice(i,1);const ids=[...(props.form.uploads||[])];ids.splice(i,1);set('uploads',ids)}
function previewUpload(id){
 // #ifdef H5
 if((getCurrentPages().slice(-1)[0]?.route||'').includes('M10')){
  const form=props.form,memberId=backend.member?.id,shopId=backend.shopId,token=backend.token,scope=form._reviewScope
  const current=()=>componentActive.value&&props.form===form&&backend.member?.id===memberId&&backend.shopId===shopId&&backend.token===token&&
   form._reviewScope===scope&&form.uploads?.includes(id)&&(getCurrentPages().slice(-1)[0]?.route||'').includes('M10')
  uni.downloadFile({url:apiBase+'/hexu/app/attachments/'+id,header:{Authorization:'Bearer '+token},success:r=>{
   if(!current())return
   if(r.statusCode!==200){toast('无权读取该资料');return}
   openInlinePreview([r.tempFilePath])
  },fail:()=>{if(current())toast('资料读取失败')}})
  return
 }
 // #endif
 emit('action','view-proof:'+id)
}
function uploadActions(i){uni.showActionSheet({itemList:['预览图片','移除图片'],success:r=>{if(r.tapIndex===0)previewUpload(props.form.uploads[i]);else if(r.tapIndex===1)uni.showModal({title:'移除图片',content:'仅移除此表单中的图片，是否继续？',success:result=>{if(result.confirm)removeUpload(i)}})}})}
function previewExistingCover(){
 const asset=props.block.existingAsset,configured=backend.storefront?.decoration?.assets?.[asset]||asset
 const source=typeof configured==='object'?configured.id||configured.fileId||configured.url:configured
 const value=String(source||'')
 const url=value.startsWith('/hexu/')?apiBase+value:/^https?:/.test(value)?value:apiBase+'/hexu/app/ui-assets/'+encodeURIComponent(value)
 uni.downloadFile({url,success:r=>r.statusCode===200?uni.previewImage({urls:[r.tempFilePath]}):toast('商品图片暂不可用'),fail:()=>toast('商品图片暂不可用')})
}
function previewProof(id){
 const token=backend.token,memberId=backend.member?.id,shopId=backend.shopId
 const current=()=>componentActive.value&&backend.token===token&&backend.member?.id===memberId&&backend.shopId===shopId
 uni.downloadFile({url:apiBase+'/hexu/app/attachments/'+id,header:{Authorization:'Bearer '+token},success:r=>{
  if(!current())return
  if(r.statusCode!==200){toast('无权读取该凭证');return}
  // #ifdef H5
  openInlinePreview([r.tempFilePath]);return
  // #endif
  // #ifdef MP-WEIXIN
  uni.previewImage({urls:[r.tempFilePath],fail:()=>toast('凭证预览失败')})
  // #endif
 },fail:()=>{if(current())toast('凭证读取失败')}})
}
function chooseAvatar(){
 if(backend.uploadingCount||backend.busy)return
 const memberId=backend.member?.id,token=backend.token,form=props.form
 const currentForm=()=>componentActive.value&&props.form===form&&canApplyAvatarUpload(backend,form,memberId,token)
 if(!currentForm())return
 uni.chooseImage({count:1,sizeType:['compressed'],sourceType:['album','camera'],success:async r=>{
  if(!r.tempFilePaths?.[0]||!currentForm())return
  try{
   const uploaded=await uploadAttachment(r.tempFilePaths[0],'AVATAR')
   if(!currentForm()){if(componentActive.value)toast(props.form!==form?'资料页已变化，头像未写入当前表单':'账号已变化，头像未写入当前表单');return}
   set('avatarId',uploaded.id)
   toast('头像已上传，请保存修改')
  }catch(e){if(currentForm())toast(e.message)}
 }})
}
async function previewReview(images,index){
 try{
  let platform='other'
  // #ifdef H5
  platform='h5'
  // #endif
  // #ifdef MP-WEIXIN
  platform='mp-weixin'
  // #endif
  const target=reviewPreviewTarget(images,index,apiBase,platform)
  if(target.mode==='inline'){
   openInlinePreview(target.urls,target.current)
   return
  }
  const urls=await Promise.all(target.urls.map(url=>new Promise((resolve,reject)=>uni.downloadFile({url,success:r=>r.statusCode===200?resolve(r.tempFilePath):reject(new Error('图片暂不可用')),fail:()=>reject(new Error('图片暂不可用'))}))))
  uni.previewImage({urls,current:urls[target.current],fail:()=>toast('图片预览失败')})
 }catch(e){toast(e.message)}
}
async function changePhone(event){
 if(!event.detail?.code||backend.busy)return
 const form=props.form,memberId=backend.member?.id,token=backend.token
 backend.busy=true
 try{await authorizeProfilePhone(event.detail.code,form)}
 catch(e){if(componentActive.value&&props.form===form&&Number(backend.member?.id)===Number(memberId)&&backend.token===token)toast(e.message)}
 finally{backend.busy=false}
}
async function selectCoupon(i){const c=coupons.value[i];if(!c||!c.uiAction)return;if(c.uiAction==='select'){if(props.form.coupon===c.id){set('coupon','');return}try{await validateCheckoutCoupon(c.id);set('coupon',toggledCouponId(props.form.coupon,c.id))}catch(e){toast(e.message)}return}if(claimingCoupon.value)return;claimingCoupon.value=c.id;try{await claimCoupon(c.id)}catch(e){toast(e.message)}finally{claimingCoupon.value=''}}
function move(i,d){const a=[...sortItems.value];[a[i],a[i+d]]=[a[i+d],a[i]];set('sortOrder',a);set('categoryNames',a.join('\n'))}
const visibleOrders=computed(()=>(props.block.orders||(props.block.management?backend.management.G21||[]:state.orders)).filter(o=>!props.filter||props.filter==='全部'||(props.filter==='售后'?(backend.account.refunds||[]).some(r=>r.order_id===o.id):o.status===props.filter)).filter(o=>!props.search||JSON.stringify(o).includes(props.search)))
const refundTypes={REFUND_ONLY:'仅退款',RETURN:'退货退款',PARTIAL:'部分退款',EXCHANGE:'换货'}
const refundStatuses={PENDING:'待审核',WAIT_RETURN:'待退货',APPROVED:'待渠道退款',SUCCESS:'已退款',CLOSED:'已关闭',EXCHANGE_SHIPPED:'换货已发出',WAIT_EXCHANGE:'待换货发出',REJECTED:'已驳回'}
const visibleRefunds=computed(()=>(backend.management.G25||[]).filter(r=>!props.filter||props.filter==='全部'||refundTypes[r.refund_type]===props.filter))
const refundProduct=refund=>products.find(product=>product.id===refund.sku_id)||{asset:''}
function openOrderAction(o){state[props.block.management?'managementOrder':'activeOrder']=o.id;if(!props.block.management)backend.activeOrder=o;emit('action',props.block.management?(o.rawStatus==='PAID'?'G23':'G22'):o.rawStatus==='UNPAID'?'M15':o.rawStatus==='SHIPPED'?'M19':'M18')}
function cancelOrder(o){emit('action','cancel-order:'+o.id)}
</script>
<style scoped>
.info-row.is-multiline{flex-direction:column;align-items:stretch}
.info-row.is-multiline .row-label{max-width:none}
.info-row.is-multiline .row-value{text-align:left;white-space:pre-wrap}
.upload-photo{width:100%;height:100%;flex:none}
.profile-field-control{margin-left:auto;max-width:75%;text-align:right}
.profile-phone{margin:0;padding:0;background:transparent;color:inherit;font-size:inherit;line-height:inherit;text-align:right;border-radius:0}
.profile-phone::after{border:0}
.review-append{display:flex;flex-direction:column;gap:9px;padding-top:10px;border-top:1px dashed #e8ede4}
.review-preview-layer{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;background:#111;color:#fff}
.review-preview-head{height:64px;padding:10px 18px;display:flex;align-items:center;justify-content:space-between;flex:none;font-size:13px}
.review-preview-close{margin:0;padding:0 12px;background:transparent;color:#fff;font-size:32px;line-height:44px;border:0}
.review-preview-close::after{border:0}
.review-preview-swiper{flex:1;min-height:0;width:100%}
.review-preview-image{width:100%;height:100%}
/* #ifdef H5 */
@media(min-width:901px){.review-preview-layer{border-radius:28px;overflow:hidden}}
/* #endif */
.order-id-row{flex-direction:column;align-items:stretch;gap:4px}
.order-id-row .row-label{max-width:none}
.order-id-row .row-value{display:block;width:100%;min-width:0;flex:none;text-align:left;white-space:normal;overflow-wrap:anywhere;word-break:break-all;line-height:1.5}
.wholesale-meta{display:block;overflow-wrap:anywhere;word-break:break-all}
.wholesale-item .spread{flex-wrap:wrap}
</style>
