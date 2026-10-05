const { launcher } = require('miniprogram-automator')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

;(async () => {
  const mp = await launcher.connectTool({ wsEndpoint: 'ws://127.0.0.1:9452' })
  console.log('connected')
  try {
    for (const route of ['M03', 'M17', 'M53']) {
      console.log('start', route)
      await mp.reLaunch(`/pages/${route}/index?member=995055&shop=992051`)
      console.log('launched', route)
      await wait(1800)
      const page = await mp.currentPage()
      console.log('page', route, page?.path)
      const roots = await page.$('*')
      const full = await roots.outerWxml()
      console.log(JSON.stringify({ route, path: page.path, wxml: full.slice(0, 16000) }))
    }
    console.log('state', await mp.evaluate(() => {
      const b = require('data/backend.js').backend
      return { member: b.member?.id, shopId: b.shopId, busy: b.busy }
    }))
  } finally {
    await mp.disconnect()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
