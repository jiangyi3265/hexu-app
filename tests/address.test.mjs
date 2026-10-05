import test from 'node:test'
import assert from 'node:assert/strict'
import {loadPure} from './helpers/pure-module.mjs'

const {normalizeAddressScreen} = await loadPure('storefront-display.mjs')

test('旧版后台 M14 页面配置仍使用完整地区选择和可保存的地址用途', () => {
  const screen = {
    title: '新增收货地址',
    blocks: [{type:'fields',title:'',items:[
      {label:'所在地区',key:'region',kind:'select',value:'浙江省 杭州市 西湖区',options:['浙江省 杭州市 西湖区']},
      {label:'地址用途',key:'地址用途',kind:'select',value:'公司',options:['家','公司']},
      {label:'详细地址',key:'detail',kind:'textarea',value:''}
    ]}]
  }
  normalizeAddressScreen(screen)
  const [region,usage,detail] = screen.blocks[0].items
  assert.equal(screen.title,'新增收货地址')
  assert.equal(region.kind,'addressRegion')
  assert.equal(region.value,'')
  assert.equal(region.required,true)
  assert.equal(region.options,null)
  assert.equal(usage.key,'usage')
  assert.equal(usage.value,'公司')
  assert.deepEqual(usage.options,['家','公司','学校','其他'])
  assert.equal(detail.kind,'textarea')
})
