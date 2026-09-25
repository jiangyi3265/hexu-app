<template><view class="photo" :style="outer"><image v-if="imageUrl" :src="imageUrl" style="width:100%;height:100%;left:0;top:0" mode="aspectFill"/><image v-else :src="'/static/design/board'+rect[0]+'.png'" :style="inner" mode="scaleToFill" /></view></template>
<script setup>
import {computed,ref,watch} from 'vue'
import {backend} from '../data/backend'
const props=defineProps({asset:{default:'stapler'},height:{default:null},radius:{default:8}})
const assets={
forest:['01',288,174,77,64],loginScene:['01',50,169,320,172],hero:['01',584,270,155,144],tea:['01',947,274,167,145],
stapler:['02',1180,273,92,106],whiteStapler:['02',883,371,55,56],greenStapler:['02',961,371,64,56],pinkStapler:['02',1041,371,55,56],product:['02',55,325,290,126],agentProduct:['02',431,375,298,204],
cup:['01',435,574,141,129],paper:['01',804,591,140,137],oil:['01',966,591,146,137],sofa:['01',594,574,144,132],
lamp:['14',1207,342,68,125],avatar:['01',171,358,85,83],towel:['14',589,393,142,105],umbrella:['14',433,640,137,96],
gift:['15',201,298,160,81],support:['08',215,182,150,133],success:['08',1166,188,319,178],growth:['10',622,215,111,98],
shopfront:['10',1321,210,160,139],skincare:['30',211,291,155,140],qr:['15',675,387,65,77],server:['32',972,220,140,99]}
const imageUrl=ref('');let version=0
watch(()=>[props.asset,backend.token],async()=>{const current=++version;imageUrl.value='';const asset=String(props.asset||'');if(/^FILE[0-9a-f]{32}$/.test(asset)){const route=getCurrentPages().at(-1)?.route||'',management=/pages\/G/.test(route);const path=(import.meta.env.VITE_HEXU_API||'')+'/hexu/app/attachments/'+(management?'':'product/')+asset;uni.downloadFile({url:path,header:management&&backend.token?{Authorization:'Bearer '+backend.token}:{},success:r=>{if(version===current&&r.statusCode===200)imageUrl.value=r.tempFilePath}})}else if(/^(blob:|wxfile:|https?:|\/_doc\/|\/tmp\/)/.test(asset))imageUrl.value=asset},{immediate:true})
const rect=computed(()=>assets[props.asset]||assets.stapler)
const outer=computed(()=>({height:props.height?props.height+'px':undefined,borderRadius:props.radius+'px'}))
const inner=computed(()=>{let[,x,y,w,h]=rect.value;return{width:(1536/w*100)+'%',height:(1024/h*100)+'%',left:(-x/w*100)+'%',top:(-y/h*100)+'%'}})
</script>
<style>.photo{position:relative;overflow:hidden;width:100%;height:100%;background:#edf0ed;flex-shrink:0}.photo image{position:absolute;max-width:none;display:block}</style>
