import test from 'node:test'
import assert from 'node:assert/strict'
import {isValidRegion,regionColumns,moveRegionColumn,selectedRegion} from '../data/region-picker.mjs'

test('地区只接受真实且层级匹配的省市区，保留直辖市两级旧资料',()=>{
 for(const region of ['福建省 泉州市 安溪县','福建省 泉州市','北京市 朝阳区','香港特别行政区 香港岛'])
  assert.equal(isValidRegion(region),true,region)
 for(const region of ['火星省 土星市 木星区','浙江省 泉州市 安溪县','福建省 杭州市','福建省\n泉州市 安溪县'])
  assert.equal(isValidRegion(region),false,region)
})

test('切换省市时区县选项重置，选择结果属于当前层级',()=>{
 const initial=regionColumns('福建省 泉州市 安溪县')
 assert.deepEqual(selectedRegion(initial),['福建省','泉州市','安溪县'])
 const province=moveRegionColumn(initial,0,initial.range[0].indexOf('浙江省'))
 assert.deepEqual(province.indices.slice(1),[0,0])
 assert.equal(isValidRegion(selectedRegion(province)),true)
 const city=moveRegionColumn(province,1,province.range[1].indexOf('杭州市'))
 assert.equal(city.indices[2],0)
 assert.equal(isValidRegion(selectedRegion(city)),true)
})
