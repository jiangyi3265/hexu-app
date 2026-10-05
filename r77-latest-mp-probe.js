const { launcher } = require('miniprogram-automator')

;(async () => {
  const mp = await launcher.connectTool({ wsEndpoint: 'ws://127.0.0.1:9453' })
  console.log('connected')
  try {
    for (const route of ['M03', 'M17']) {
      const path = `/pages/${route}/index?member=995075&shop=992054`
      console.log('launch', path)
      const page = await mp.reLaunch(path)
      console.log('page', page.path)
      const png = `../docs/evidence/r77-native-${route.toLowerCase()}-latest-20261005.png`
      await mp.screenshot({ path: png })
      console.log('screenshot', png)
      const root = await page.$('*')
      console.log('wxml', (await root.outerWxml()).slice(0, 3000))
    }
  } finally {
    mp.disconnect()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
