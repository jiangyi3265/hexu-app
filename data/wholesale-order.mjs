export const wholesaleQtyKey=id=>'wholesaleQty:'+id

export function wholesalePlan(draft,products,form={},rules){
 const entries=Array.isArray(draft?.lines)?draft.lines:[]
 if(!entries.length)return {lines:[],total:0,error:'请先选择采购商品'}
 if(entries.length>100)return {lines:[],total:0,error:'一次最多采购 100 种商品'}
 const lines=[],groups=new Map(),seen=new Set()
 let total=0
 for(const entry of entries){
  const sku=products.find(item=>item.id===entry.id)
  if(!sku)return {lines,total,error:'采购商品已变化，请重新选择'}
  if(seen.has(sku.id))return {lines,total,error:'采购商品重复，请重新选择'}
  seen.add(sku.id)
  const rawQty=form[wholesaleQtyKey(sku.id)]??entry.qty,qty=Number(rawQty)
  if(!/^[1-9]\d*$/.test(String(rawQty))||!Number.isSafeInteger(qty)||qty>100000)return {lines,total,error:'请填写 1 至 100000 件的采购数量'}
  if(qty<Number(sku.min_qty||1))return {lines,total,error:sku.name+'未达到最小起订数量'}
  if(qty>Number(sku.stock??sku.available??0))return {lines,total,error:sku.name+'库存不足'}
  if(!String(sku.name||'').trim()||!String(sku.asset||sku.gallery?.[0]||'').trim()||!String(sku.spec||'').trim())return {lines,total,error:'商品 '+sku.id+' 的名称、图片或规格缺失，请联系公司维护后再采购'}
  if(!Number.isSafeInteger(Number(sku.price))||Number(sku.price)<0)return {lines,total,error:sku.name+'价格资料不可用'}
  const group=rules?.mixedEnabled&&String(sku.mix_group||'').trim()
  if(group){
   const units=qty*Number(sku.mix_units||0)
   if(!Number.isSafeInteger(units)||units<1)return {lines,total,error:sku.name+'混批单位配置无效'}
   groups.set(group,(groups.get(group)||0)+units)
  }else{
   const size=Number(sku.box_size),minimum=Number(sku.min_boxes)
   if(!Number.isSafeInteger(size)||size<1||!Number.isSafeInteger(minimum)||minimum<1)return {lines,total,error:sku.name+'箱规未配置'}
   if(qty%size||qty<size*minimum)return {lines,total,error:sku.name+'须满足 '+minimum+' 箱起、'+size+' 件/箱'}
  }
  lines.push({sku,qty})
  total+=qty*Number(sku.price)
  if(!Number.isSafeInteger(total))return {lines,total:0,error:'采购金额超出允许范围'}
 }
 for(const [group,units] of groups){
  const capacity=Number(rules.mixCapacity),minimum=Number(rules.minMixBoxes)
  if(!Number.isSafeInteger(capacity)||capacity<1||!Number.isSafeInteger(minimum)||minimum<1)return {lines,total,error:'公司混批规则暂不可用'}
  if(units%capacity||units<capacity*minimum){const next=Math.max(capacity*minimum,Math.ceil(units/capacity)*capacity);return {lines,total,error:'混批组 '+group+' 当前 '+units+' 单位，还差 '+(next-units)+' 单位；须满足 '+minimum+' 箱起、每箱 '+capacity+' 单位'}}
 }
 return {lines,total,error:''}
}
