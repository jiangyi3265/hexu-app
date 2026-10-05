const { launcher } = require('miniprogram-automator')
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
;(async () => {
  const mp = await launcher.connectTool({ wsEndpoint: 'ws://127.0.0.1:9450' })
  try {
    if (process.argv.includes('--nav-only')) {
      await mp.reLaunch('/pages/M51/index?member=995055&shop=992051')
      await pause(1800)
      const current = await mp.currentPage()
      console.log('path', current.path)
      console.log('wxml', (await (await current.$$(' *'.trim()))[1].outerWxml()).slice(0, 12000))
      console.log('account', await mp.evaluate(() => { const b = require('data/backend.js').backend; return { member: b.member?.id, shopId: b.shopId, platform: b.account?.platformPoints?.available, shop: b.account?.shopPoints?.available } }))
      return
    }
    await mp.reLaunch('/pages/M01/index?member=995055&shop=992051')
    await pause(1800)
    let page = await mp.currentPage()
    console.log('start', page.path)
    let root = (await page.$$(' *'.trim()))[1]
    console.log('startwxml', (await root.outerWxml()).slice(0, 300))
    const consent = await root.$('.consent')
    console.log('consent', !!consent)
    if (consent) await consent.tap()
    console.log('consent-tapped')
    const login = await root.$('button.primary')
    console.log('login', !!login)
    if (login) await login.tap()
    console.log('login-tapped')
    await pause(3500)
    console.log('nav1')
    await mp.reLaunch('/pages/M51/index?member=995055&shop=992051')
    console.log('nav1-done')
    await pause(3500)
    console.log('nav2')
    await mp.reLaunch('/pages/M51/index?member=995055&shop=992051')
    console.log('nav2-done')
    await pause(2500)
    page = await mp.currentPage()
    root = (await page.$$(' *'.trim()))[1]
    console.log('path', page.path)
    console.log('wxml', (await root.outerWxml()).slice(0, 12000))
    console.log('account', await mp.evaluate(() => { const b = require('data/backend.js').backend; return { member: b.member?.id, shopId: b.shopId, platform: b.account?.platformPoints?.available, shop: b.account?.shopPoints?.available } }))
  } finally { await mp.disconnect() }
})().catch(e => { console.error(e); process.exitCode = 1 })
