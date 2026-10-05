import area from './regions.mjs'

const provinces=Object.entries(area.province_list)
const citiesByProvince=new Map(provinces.map(([code])=>[code,Object.entries(area.city_list).filter(([city])=>city.startsWith(code.slice(0,2)))]))
const countiesByCity=new Map(Object.keys(area.city_list).map(city=>[city,Object.entries(area.county_list).filter(([county,name])=>county.startsWith(city.slice(0,4))&&!['其它区','其他区','市辖区'].includes(name))]))
const clamp=(index,size)=>Math.min(Math.max(Number(index)||0,0),Math.max(size-1,0))

export function isValidRegion(value){
 if(typeof value==='string'&&/[\u0000-\u001f\u007f-\u009f]/.test(value))return false
 const names=Array.isArray(value)?value:String(value||'').trim().split(/\s+/).filter(Boolean)
 if(names.length<2||names.length>3||names.some(name=>typeof name!=='string'))return false
 const province=provinces.find(([,name])=>name===names[0])
 const city=(citiesByProvince.get(province?.[0])||[]).find(([,name])=>name===names[1])
 if(city)return names.length===2||(countiesByCity.get(city[0])||[]).some(([,name])=>name===names[2])
 if(names.length!==2)return false
 return (citiesByProvince.get(province?.[0])||[]).some(([code,name])=>name===names[0]&&(countiesByCity.get(code)||[]).some(([,county])=>county===names[1]))
}

function columns(indices=[0,0,0]){
 const province=clamp(indices[0],provinces.length),cities=citiesByProvince.get(provinces[province][0])||[]
 const city=clamp(indices[1],cities.length),counties=countiesByCity.get(cities[city]?.[0])||[]
 const county=clamp(indices[2],counties.length)
 return {range:[provinces.map(([,name])=>name),cities.map(([,name])=>name),counties.map(([,name])=>name)],indices:[province,city,county]}
}

export function regionColumns(value){
 const names=Array.isArray(value)?value:String(value||'').trim().split(/\s+/).filter(Boolean)
 const province=provinces.findIndex(([,name])=>name===names[0])
 const first=columns([province,0,0]),city=first.range[1].indexOf(names[1])
 const selected=columns([first.indices[0],city,0])
 const county=selected.range[2].indexOf(names[2]||(names.length===2&&selected.range[1][selected.indices[1]]===names[0]?names[1]:''))
 return columns([selected.indices[0],selected.indices[1],county])
}

export function moveRegionColumn(current,column,index){
 const next=[...(current?.indices||[0,0,0])]
 next[column]=index
 if(column===0){next[1]=0;next[2]=0}
 if(column===1)next[2]=0
 return columns(next)
}

export function selectedRegion(current,indices){
 const picker=columns(indices||current?.indices)
 return picker.range.every(values=>values.length)?picker.range.map((values,index)=>values[picker.indices[index]]):[]
}
