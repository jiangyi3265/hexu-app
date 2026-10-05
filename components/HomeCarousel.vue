<template>
  <view v-if="slides.length" class="home-carousel">
    <swiper class="home-swiper" :current="current" :autoplay="active && slides.length > 1"
      :circular="slides.length > 1" :interval="4000" :duration="350" @change="onChange">
      <swiper-item v-for="(banner, index) in slides" :key="index">
        <view class="home-banner" @tap="open(banner)">
          <Photo :asset="banner.image" :radius="0"/>
          <view class="banner-gradient"/>
          <view class="banner-copy">
            <text>{{banner.title}}</text>
            <text v-if="banner.subtitle" class="small">{{banner.subtitle}}</text>
            <button v-if="banner.buttonText" :class="dealer ? 'red-pill' : 'cream-pill'"
              @tap.stop="open(banner)">{{banner.buttonText}}</button>
          </view>
        </view>
      </swiper-item>
    </swiper>
    <view v-if="slides.length > 1" class="banner-dots carousel-dots">
      <text v-for="(_, index) in slides" :key="index">{{index === current ? '●' : '○'}}</text>
    </view>
  </view>
</template>

<script setup>
import {computed, ref, watch} from 'vue'
import Photo from './Photo.vue'
import {bannerIndex, couponBanner, publishedBanners} from '../data/carousel.js'
import {couponCards} from '../data/coupons.js'

const props = defineProps({
  banners: {type: Array, default: () => []},
  coupons: {type: Array, default: () => []},
  couponsReady: {type: Boolean, default: false},
  dealer: {type: Boolean, default: false},
  active: {type: Boolean, default: true}
})
const emit = defineEmits(['action'])
const canClaim = computed(() => couponCards(props.coupons).some(coupon => coupon.uiAction === 'claim'))
const slides = computed(() => publishedBanners(props.banners).map(banner => couponBanner(banner, canClaim.value, props.couponsReady)))
const current = ref(0)

// New shop/configuration starts on its own first slide, not the old shop's index.
watch(() => JSON.stringify(slides.value), () => { current.value = 0 })
function onChange(event) {
  current.value = bannerIndex(event.detail?.current, slides.value.length)
}
function open(banner) {
  if (banner.target) emit('action', banner.target)
}
</script>

<style scoped>
.home-carousel {height:184px;position:relative;overflow:hidden;border-radius:12px;flex-shrink:0}
.home-swiper {width:100%;height:100%}
.home-banner {height:100%}
.carousel-dots {left:50%;transform:translateX(-50%);display:flex;gap:4px;letter-spacing:0;pointer-events:none}
</style>
