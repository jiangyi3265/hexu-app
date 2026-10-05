import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const blockSource=fs.readFileSync(new URL('../components/UiBlock.vue',import.meta.url),'utf8')
const screenSource=fs.readFileSync(new URL('../components/DesignScreen.vue',import.meta.url),'utf8')

test('M08 已下架收藏保留不可售占位并能直接取消，浏览记录显示库存状态',()=>{
 const snippet=blockSource.match(/const visibleProducts=computed\(\(\)=>\{[\s\S]*?\n\}\)/)?.[0]
 assert.ok(snippet)
 const props={block:{type:'productGrid',ids:['missing','cup','missing'],includeUnavailable:true,orderedIds:true}}
 const products=[{id:'cup',name:'保温杯',stock:2,price:89}]
 const context={props,products,computed:fn=>({get value(){return fn()}})}
 vm.runInNewContext(snippet+'\nglobalThis.visibleProducts=visibleProducts',context)
 assert.deepEqual(Array.from(context.visibleProducts.value,p=>p.id),['missing','cup'])
 assert.equal(context.visibleProducts.value[0].unavailable,true)
 assert.equal(context.visibleProducts.value[0].name,'商品已下架')
 props.block.includeUnavailable=false
 assert.deepEqual(Array.from(context.visibleProducts.value,p=>p.id),['cup'])
 assert.match(screenSource,/includeUnavailable:true,stockStatus:true/)
 assert.match(blockSource,/block\.stockStatus\?' · '\+/)
 assert.match(blockSource,/block\.removable[^\n]*favorite-remove:/)
 assert.match(screenSource,/if\(target\?\.startsWith\('favorite-remove:'\)\)/)
 assert.match(screenSource,/@tap="toggleFavorite\(\)"/)
 assert.match(screenSource,/if\(typeof id!=='string'\|\|!id\|\|!removeOnly&&!products\.some\(/)
})
