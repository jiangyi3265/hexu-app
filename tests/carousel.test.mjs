import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

// Exercise the same .js module packaged by HBuilderX (this project uses CommonJS in Node).
const source = await readFile(new URL('../data/carousel.js', import.meta.url), 'utf8')
const {bannerIndex, couponBanner, publishedBanners} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('无可领取券时首页券横幅引导选购，其他横幅不受影响', () => {
  const banner={image:'tea',buttonText:'领券下单',target:'M55'}
  assert.deepEqual(couponBanner(banner,false,true),{...banner,buttonText:'立即选购',target:'M04'})
  assert.equal(couponBanner(banner,true,true),banner)
  assert.equal(couponBanner(banner,false,false),banner)
  assert.equal(couponBanner({...banner,target:'M05'},false,true).target,'M05')
})

test('轮播展示所有已启用图片，按后台顺序排列且不修改原配置', () => {
  const input = [
    {image: 'tea', sort: 3, target: 'M56'},
    {image: 'paper', sort: 2, enabled: false},
    {image: 'hero', sort: '1', target: 'M04'},
    {image: 'cup', sort: 2, target: 'M05'}
  ]
  assert.deepEqual(publishedBanners(input).map(x => x.image), ['hero', 'cup', 'tea'])
  assert.equal(input[0].image, 'tea')
  assert.equal(publishedBanners(input)[0].target, 'M04')
})

test('空配置、单张图片与无效条目不生成虚构轮播', () => {
  assert.deepEqual(publishedBanners(undefined), [])
  assert.deepEqual(publishedBanners({image: 'tea'}), [])
  assert.deepEqual(publishedBanners([null, 'tea', [], {}, {image: 'tea'}]), [{image: 'tea'}])
})

test('轮播切换索引来自 swiper；配置删减后不保留越界索引', () => {
  assert.equal(bannerIndex(2, 3), 2)
  for (const value of [-1, 3, 1.5, undefined, 'invalid']) assert.equal(bannerIndex(value, 3), 0)
  assert.equal(bannerIndex(2, 1), 0)
  assert.equal(bannerIndex(0, 0), 0)
})
