const { launcher }=require('miniprogram-automator')
const pause=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{
  const mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'})
  try{
    let p=await mp.currentPage();console.log('before',p.path)
    let root=(await p.$$(' *'.trim()))[1]
    let b=await root.$('.bottom-bar button')
    console.log('button',await b.outerWxml())
    await b.tap()
    await pause(2200)
    p=await mp.currentPage();root=(await p.$$(' *'.trim()))[1]
    console.log('after',p.path,(await root.outerWxml()).slice(0,6500))
    console.log('account',await mp.evaluate(()=>{const b=require('data/backend.js').backend;return{member:b.member?.id,platform:b.account?.platformPoints?.available,shop:b.account?.shopPoints?.available}}))
  }finally{await mp.disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1})
