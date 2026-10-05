const { launcher } = require('miniprogram-automator')
;(async () => {
  const mp = await launcher.connectTool({ wsEndpoint: 'ws://127.0.0.1:9453' })
  try {
    const page = await mp.reLaunch('/pages/M03/index?member=995075&shop=992054')
    console.log(`launched ${page.path}`)
    await new Promise(resolve => setTimeout(resolve, 3000))
  } finally { mp.disconnect() }
})().catch(e => { console.error(e); process.exitCode = 1 })
