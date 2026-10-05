<template>
  <view class="gallery">
    <swiper class="gallery-swiper" :current="current" :circular="images.length>1" @change="current=Number($event.detail.current)||0">
      <swiper-item v-for="(asset,index) in images" :key="index"><Photo :asset="asset" :radius="0" @tap="preview(index)"/></swiper-item>
    </swiper>
    <text v-if="images.length" class="photo-count">{{current+1}} / {{images.length}}</text>
  </view>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import Photo from './Photo.vue'
import {backend,apiBase} from '../data/backend'
import {toast} from '../data/store'
const props=defineProps({product:{type:Object,required:true}})
const images=computed(()=>{
 const p=props.product,primary=p.id==='stapler'&&p.asset==='stapler'?'product':p.asset
 return [...new Set([primary,...(p.gallery||[])].filter(Boolean))]
})
const current=ref(0)
watch(()=>JSON.stringify(images.value),()=>current.value=0)
function download(url){return new Promise((resolve,reject)=>uni.downloadFile({url,success:r=>r.statusCode===200?resolve(r.tempFilePath):reject(new Error('图片读取失败')),fail:()=>reject(new Error('图片读取失败'))}))}
async function source(asset){
 const configured=backend.storefront?.decoration?.assets?.[asset]||asset
 const value=typeof configured==='object'?configured.id||configured.fileId||configured.url:configured
 if(/^FILE[0-9a-f]{32}$/.test(String(value))){try{return await download(apiBase+'/hexu/app/attachments/product/'+value)}catch{return await download(apiBase+'/hexu/app/attachments/storefront/'+value)}}
 return String(value).startsWith('/hexu/')?apiBase+value:/^(https?:|blob:|wxfile:)/.test(String(value))?value:apiBase+'/hexu/app/ui-assets/'+encodeURIComponent(value)
}
async function preview(index){try{const urls=await Promise.all(images.value.map(source));uni.previewImage({urls,current:urls[index]})}catch(e){toast(e.message)}}
</script>
<style scoped>
.gallery,.gallery-swiper{position:relative;width:100%;height:100%}
</style>
