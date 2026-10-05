import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {homeProductList,homeShortcutList,updatedBanners} from '../data/storefront-display.mjs'

const products = [
  {id:'paper',price:2990,sales:4},
  {id:'oil',price:7990,sales:8},
  {id:'cup',price:8900,sales:2},
  {id:'towel',price:3900,sales:6},
  {id:'sofa',price:15900,sales:1}
]

test('游客与会员首页都按后台推荐顺序展示，不用写死 SKU 或额外填充', () => {
  const decoration = {homeProducts:['cup',{skuId:'paper'},'unavailable','cup']}
  assert.deepEqual(homeProductList(products,decoration).map(p=>p.id),['cup','paper'])
  assert.deepEqual(homeProductList(products,{homeProducts:[]}),[])
  assert.deepEqual(homeProductList(products,{}).map(p=>p.id),['paper','oil','cup','towel'])
  assert.deepEqual(homeProductList(products,decoration,'asc').map(p=>p.id),['paper','cup'])
  assert.deepEqual(homeProductList(products,decoration,'sales').map(p=>p.id),['paper','cup'])
  const screen = fs.readFileSync(new URL('../components/DesignScreen.vue',import.meta.url),'utf8')
  assert.match(screen,/homeProductList\(products,decoration\.value,sort\.value\)/)
  assert.doesNotMatch(screen,/backend\.guest\?products\.slice\(0,4\)/)
})

test('首页快捷入口只使用后台发布的顺序、图标和目标', () => {
  const categories = [
    {name:'后配置',icon:'leaf',target:'M55',sort:2},
    {name:'已停用',icon:'bag',target:'M04',sort:0,enabled:false},
    {name:'先配置',icon:'home',target:'M04',sort:1}
  ]
  const before = JSON.stringify(categories)
  assert.deepEqual(homeShortcutList({categories}),[['先配置','home','M04'],['后配置','leaf','M55']])
  assert.equal(JSON.stringify(categories),before)
  assert.deepEqual(homeShortcutList({}),[])
  assert.deepEqual(homeShortcutList({categories:[]}),[])
})

test('移动端装修保留轮播的身份、排序和停用状态，不按上传数组位置串配置', () => {
  const original = [
    {image:'A',title:'甲',target:'M55',sort:1,enabled:true},
    {image:'B',title:'乙',target:'M56',sort:2,enabled:false},
    {image:'C',title:'丙',target:'M57',sort:3,enabled:true}
  ]
  assert.deepEqual(updatedBanners(original,['A','B','C'],'品牌'),original)
  assert.deepEqual(updatedBanners(original,['B','C'],'品牌'),[original[1],original[2]])
  assert.deepEqual(updatedBanners(original,['C','A','B'],'品牌'),[original[2],original[0],original[1]])
  assert.deepEqual(updatedBanners(original,['A','D','C'],'品牌'),[original[0],{...original[1],image:'D'},original[2]])
  assert.deepEqual(updatedBanners(original,['A','C','D'],'品牌'),[original[0],original[2],{image:'D',title:'品牌',target:'M04'}])
  assert.deepEqual(updatedBanners(original,undefined,'品牌'),original)
  assert.deepEqual(original.map(b=>b.image),['A','B','C'])
  assert.throws(() => updatedBanners(original,['A',null],'品牌'),/轮播图片格式错误/)
  assert.throws(() => updatedBanners([null],[],'品牌'),/轮播配置格式错误/)
  assert.throws(() => updatedBanners({banners:[]},[],'品牌'),/轮播配置格式错误/)
  const draft = [{image:'A',title:'正式'}, {image:'',title:'待配图'}, {image:'B',title:'第二张'}]
  assert.deepEqual(updatedBanners(draft,['A','B'],'品牌'),draft)
})
