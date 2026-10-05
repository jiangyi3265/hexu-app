<template><DesignScreen :page-id="pageId" /></template>
<script setup>
import DesignScreen from '../../components/DesignScreen.vue'

// 入口先沿用上次已确认的商城；没有记录时使用默认的本地商城，避免先渲染 M02 再重定向到 M03。
const pageId=Number(uni.getStorageSync('hexu-shop-id'))===1?'M02':'M03'
</script>
