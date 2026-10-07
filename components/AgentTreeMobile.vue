<template>
  <view class="card agent-tree-mobile">
    <text class="section-title">上下级代理明细</text>
    <text v-if="error" class="agent-tree-error">{{error}}</text>
    <template v-if="detail">
      <view class="agent-tree-ancestors">
        <text v-if="detail.ancestors[0]?.parent_id" class="agent-tree-external">{{detail.externalParent?`${detail.externalParent.name} · #${detail.externalParent.id}（跨商城）`:`代理 #${detail.ancestors[0].parent_id}（当前商城外）`}} ›</text>
        <button v-for="(item,index) in detail.ancestors" :key="item.id" class="agent-tree-link" @tap="$emit('select',item.id)">{{index?'› ':''}}{{item.name}}</button>
      </view>
      <text class="agent-tree-summary">直接下级 {{detail.childCount}} 人 · 全部下级 {{detail.descendantCount}} 人</text>
      <text class="agent-tree-region">经营区域：{{detail.regions?.join('、')||'未配置'}}</text>
      <view class="agent-tree-list">
        <button v-for="item in children" :key="item.id" class="agent-tree-child" @tap="$emit('select',item.id)">
          <text>{{item.name}} · {{rankName(item.rank_no)}} · #{{item.id}}</text>
          <text class="agent-tree-child-meta">{{item.regions?.join('、')||'区域未配置'}} · 下级 {{item.childCount}} 人</text>
        </button>
        <text v-if="!loading&&!children.length" class="muted small">暂无直接下级代理</text>
        <button v-if="cursor" class="agent-tree-more" :disabled="loading" @tap="loadChildren">{{loading?'读取中…':'加载更多下级'}}</button>
      </view>
    </template>
    <text v-else-if="loading" class="muted small">正在读取代理关系…</text>
  </view>
</template>

<script setup>
import {ref,watch} from 'vue'
import {request} from '../data/backend'

const props=defineProps({shopId:{type:Number,required:true},agentId:{type:Number,default:0}})
defineEmits(['select'])
const rankName=rank=>({1:'云代理',2:'分货中心',3:'总代理'})[rank]||'未知职级'
const detail=ref(null),children=ref([]),cursor=ref(0),loading=ref(false),error=ref('')
let version=0

async function loadChildren(){
  if(loading.value||!props.agentId)return
  const current=version,after=cursor.value
  loading.value=true
  try{
    const page=await request('/hexu/app/management/agent-tree/children',{shopId:props.shopId,parentId:props.agentId,afterId:after})
    if(current!==version)return
    children.value.push(...page.items)
    cursor.value=page.nextCursor||0
  }catch(e){if(current===version)error.value=e.message||'读取下级失败'}
  finally{if(current===version)loading.value=false}
}

watch(()=>[props.shopId,props.agentId],async()=>{
  const current=++version
  detail.value=null;children.value=[];cursor.value=0;error.value=''
  if(!props.agentId)return
  loading.value=true
  try{
    const node=await request('/hexu/app/management/agent-tree/'+props.agentId,{shopId:props.shopId})
    if(current!==version)return
    detail.value=node
  }catch(e){if(current===version)error.value=e.message||'读取代理关系失败'}
  finally{if(current===version){loading.value=false;if(detail.value)loadChildren()}}
},{immediate:true})
</script>

<style scoped>
.agent-tree-mobile{display:flex;flex-direction:column;gap:10px}
.agent-tree-ancestors{display:flex;flex-wrap:wrap;gap:3px}
.agent-tree-external{align-self:center;color:#838b83;font-size:11px}
.agent-tree-link{margin:0;padding:5px;background:transparent;color:#155641;font-size:12px;line-height:1.4}
.agent-tree-link::after,.agent-tree-child::after,.agent-tree-more::after{border:0}
.agent-tree-summary,.agent-tree-region{font-size:12px;color:#5a675d}
.agent-tree-list{border-top:1px solid #eef1eb;padding-top:8px}
.agent-tree-child{display:flex;flex-direction:column;align-items:flex-start;gap:4px;width:100%;margin:0;padding:12px 0;border-bottom:1px solid #eef1eb;background:transparent;text-align:left;font-size:13px}
.agent-tree-child-meta{font-size:11px;color:#838b83}
.agent-tree-more{margin:8px 0 0;padding:8px;color:#155641;background:transparent;font-size:12px}
.agent-tree-error{font-size:12px;color:#c33729}
</style>
