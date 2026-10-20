<template><DesignScreen page-id="M02" /></template>
<script setup>
import {onShareAppMessage} from '@dcloudio/uni-app'
import DesignScreen from '../../components/DesignScreen.vue'
import {currentSharePayload} from '../../data/share.js'
onShareAppMessage(()=>currentSharePayload('M02'))
</script>
