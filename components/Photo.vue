<template><view class="photo" :style="outer"><image v-if="imageUrl" class="photo-image" :src="imageUrl" style="width:100%;height:100%;left:0;top:0" mode="aspectFill" @error="imageFailed"/><view v-else-if="avatarPlaceholder" class="photo-avatar-placeholder" aria-label="默认头像"><Icon name="user" :size="30"/></view><text v-else-if="failed" class="photo-unavailable">图片暂不可用</text></view></template>
<script setup>
import {computed,ref,watch} from 'vue'
import {backend,apiBase} from '../data/backend'
import Icon from './Icon.vue'
const props=defineProps({asset:{default:''},height:{default:null},radius:{default:8},fallback:{default:''},privateAttachment:{type:Boolean,default:false}})
const imageUrl=ref(''),failed=ref(false),avatarPlaceholder=ref(false);let version=0
const valueOf=value=>value&&typeof value==='object'?(value.id||value.fileId||value.url):value
function imageFailed(){imageUrl.value='';failed.value=true}
watch(()=>[props.asset,props.privateAttachment,backend.token,backend.storefront],()=>{
 const current=++version;imageUrl.value='';failed.value=false;avatarPlaceholder.value=false
 const configured=backend.storefront?.decoration?.assets?.[props.asset]
 const raw=valueOf(configured||props.asset)||valueOf(backend.storefront?.decoration?.assets?.[props.fallback])
 const asset=String(raw||'')
 if(/^\/hexu\/app\/attachments\/order-cover\/(?:HX|DH)[0-9a-f]{32}\/\d+$/.test(asset)){
  if(!backend.token){failed.value=true;return}
  uni.downloadFile({url:apiBase+asset,header:{Authorization:'Bearer '+backend.token},success:r=>{if(current!==version)return;if(r.statusCode===200)imageUrl.value=r.tempFilePath;else failed.value=true},fail:()=>{if(current===version)failed.value=true}})
 }else if(/^FILE[0-9a-f]{32}$/.test(asset)){
  const privateFile=props.privateAttachment
  const urls=privateFile?[apiBase+'/hexu/app/attachments/'+asset]:['product/','storefront/'].map(scope=>apiBase+'/hexu/app/attachments/'+scope+asset)
  const download=index=>{if(current!==version)return;if(index>=urls.length){failed.value=true;return}uni.downloadFile({url:urls[index],header:privateFile&&backend.token?{Authorization:'Bearer '+backend.token}:{},success:r=>{if(current!==version)return;if(r.statusCode===200)imageUrl.value=r.tempFilePath;else download(index+1)},fail:()=>download(index+1)})}
  download(0)
 }else if(asset==='avatar'&&props.fallback==='avatar')avatarPlaceholder.value=true
 else if(asset.startsWith('/hexu/'))imageUrl.value=apiBase+asset
 else if(/^(blob:|wxfile:|https?:|\/_doc\/|\/tmp\/)/.test(asset))imageUrl.value=asset
 else if(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(asset))imageUrl.value=apiBase+'/hexu/app/ui-assets/'+asset
 else if(asset)failed.value=true
},{immediate:true})
const outer=computed(()=>({height:props.height?props.height+'px':undefined,borderRadius:props.radius+'px'}))
</script>
<style>.photo{position:relative;overflow:hidden;width:100%;height:100%;background:#edf0ed;flex-shrink:0}.photo-image{position:absolute;max-width:none;display:block}.photo-avatar-placeholder{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}.photo-unavailable{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#8b9686}</style>
