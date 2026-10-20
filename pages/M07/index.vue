<template><DesignScreen page-id="M07" /></template>
<script setup>
import {onShareAppMessage} from '@dcloudio/uni-app'
import DesignScreen from '../../components/DesignScreen.vue'
import {currentSharePayload} from '../../data/share.js'
onShareAppMessage(()=>currentSharePayload('M07'))
</script>
