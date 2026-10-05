const codePattern=/^[A-Za-z0-9_-]{1,64}$/
const groupPattern=/^[A-Za-z0-9_-]{0,64}$/

function cents(value){
 const text=String(value??'').trim()
 if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw new Error('商品价格须为最多两位小数的有效金额')
 const [yuan,fraction='']=text.split('.')
 const amount=Number(yuan)*100+Number(fraction.padEnd(2,'0'))
 if(!Number.isSafeInteger(amount)||amount>100000000)throw new Error('商品价格超出允许范围')
 return amount
}

function integer(value,min,max,label){
 const text=String(value??'').trim()
 if(!/^\d+$/.test(text))throw new Error(label+'须为整数')
 const number=Number(text)
 if(!Number.isSafeInteger(number)||number<min||number>max)throw new Error(label+'超出允许范围')
 return number
}

export function catalogEditorValues(form){
 const sku=String(form.商品编码??'').trim()
 if(!codePattern.test(sku))throw new Error('商品编号须为1至64位字母、数字、横线或下划线')
 const productGroup=String(form.productGroup??'').trim()
 if(!groupPattern.test(productGroup))throw new Error('商品组编号须为最多64位字母、数字、横线或下划线')
 const retail=cents(form.retail),cloud=cents(form.cloud),center=cents(form.center),owner=cents(form.owner)
 if(!(retail>=cloud&&cloud>=center&&center>=owner&&owner>0))throw new Error('价格须为正整数分且零售≥云≥中心≥总代')
 return {sku,productGroup,retail,cloud_price:cloud,center_price:center,owner_price:owner,
  available:integer(form.可售库存,0,2147483647,'可售库存'),weightGrams:integer(form.weightGrams,1,1000000,'单件重量')}
}
