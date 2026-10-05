const { launcher } = require('miniprogram-automator')

;(async () => {
  const mp = await launcher.connectTool({ wsEndpoint: 'ws://127.0.0.1:9453' })
  console.log('connected')
  try {
    for (const route of ['M03', 'M17', 'M56']) {
      const page = await mp.reLaunch(`/pages/${route}/index?member=995075&shop=992054`)
      const root = await page.$('*')
      const wxml = await root.outerWxml()
      console.log(JSON.stringify({ route, path: page.path, length: wxml.length, containsShop: wxml.includes('R77活动到期'), containsOrder: wxml.includes('HXf89debe8cb1a47cd91e7f9d082b1862f'), emptyCampaign: wxml.includes('暂无进行中的活动'), snippet: wxml.slice(0, 1200) }))
    }
  } finally { mp.disconnect() }
})().catch(error => { console.error(error); process.exitCode = 1 })
