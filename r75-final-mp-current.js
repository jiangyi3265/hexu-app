const { launcher } = require('miniprogram-automator')
;(async () => {
  const mp = await launcher.connectTool({ wsEndpoint: 'ws://127.0.0.1:9452' })
  try {
    console.log('connected')
    const page = await mp.currentPage()
    console.log('page', page?.path, JSON.stringify(page?.query))
    if (page) console.log((await (await page.$('*')).outerWxml()).slice(0, 12000))
  } finally { await mp.disconnect() }
})().catch(error => { console.error(error); process.exitCode = 1 })
