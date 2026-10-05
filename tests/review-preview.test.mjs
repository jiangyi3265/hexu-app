import test from 'node:test'
import assert from 'node:assert/strict'
import {loadPure} from './helpers/pure-module.mjs'
const {reviewPreviewTarget}=await loadPure('reviews.js')

const image='/hexu/app/attachments/review/FILE'+'f'.repeat(32)

test('微信本地 HTTP 评价图走页内预览，使用与缩略图相同的公开地址',()=>{
 const result=reviewPreviewTarget([image],0,'http://127.0.0.1:8088','mp-weixin')
 assert.equal(result.mode,'inline')
 assert.deepEqual(result.urls,['http://127.0.0.1:8088'+image])
 assert.equal(result.current,0)
})

test('HTTPS 小程序沿用系统预览，H5 在手机画布内预览，多图索引保持有效',()=>{
 const images=[image,image.replace('f'.repeat(32),'e'.repeat(32))]
 assert.equal(reviewPreviewTarget(images,1,'https://example.test','mp-weixin').mode,'native')
 const h5=reviewPreviewTarget(images,1,'http://127.0.0.1:8088','h5')
 assert.equal(h5.mode,'inline')
 assert.equal(h5.current,1)
 assert.equal(reviewPreviewTarget(images,20,'http://127.0.0.1:8088','mp-weixin').current,1)
 assert.throws(()=>reviewPreviewTarget([],0,'http://127.0.0.1:8088','mp-weixin'),/图片暂不可用/)
})
