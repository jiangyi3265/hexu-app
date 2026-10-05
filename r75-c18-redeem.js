const {launcher}=require('miniprogram-automator')
const pause=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{
 const mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'})
 try{
  if(!process.argv.includes('--current')){await mp.reLaunch('/pages/'+(process.argv[2]||'M54')+'/index?member=995055&shop=992051');await pause(1800)}
  let p=await mp.currentPage(),root=(await p.$$(' *'.trim()))[1]
  console.log('path',p.path)
  console.log('wxml',(await root.outerWxml()).slice(0,12500))
  console.log('points',await mp.evaluate(()=>{let b=require('data/backend.js').backend;return{member:b.member?.id,shop:b.shopId,points:b.account?.platformPoints?.available,sku:b.redemptionSku?.id,order:b.activeOrder?.id}}))
 }finally{await mp.disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1})
