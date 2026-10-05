const {launcher}=require('miniprogram-automator')
const pause=ms=>new Promise(r=>setTimeout(r,ms))
const current=async mp=>{const p=await mp.currentPage();return{p,root:(await p.$$(' *'.trim()))[1]}}
;(async()=>{
 const mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'})
 try{
  await mp.reLaunch('/pages/M51/index?member=995055&shop=992051');await pause(1500)
  let {p,root}=await current(mp);console.log('p',p.path)
  const blocks=await root.$$(' *'.trim())
  console.log('blocks',blocks.length)
  for(let i=0;i<blocks.length;i++){let w=await blocks[i].outerWxml();if(w.includes('商城积分')&&w.includes('平台积分')){console.log('optionsblock',i,blocks[i].tagName,w.slice(0,650));let buttons=await blocks[i].$$('button');console.log('buttons',buttons.length);if(buttons.length===2){await buttons[1].tap();break}}}
  await pause(500)
  ;({p,root}=await current(mp));console.log('selected',p.path,(await root.outerWxml()).slice(0,3500))
  await (await root.$('input[aria-label="接收人手机号"]')).input('13800005056')
  await (await root.$('input[aria-label="转赠积分"]')).input('20')
  await (await root.$('.bottom-bar button')).tap();await pause(1900)
  ;({p,root}=await current(mp));console.log('before-confirm',p.path,(await root.outerWxml()).slice(0,4400))
  if(p.path==='pages/M52/index'){await(await root.$('.bottom-bar button')).tap();await pause(2600);({p,root}=await current(mp));console.log('after-confirm',p.path,(await root.outerWxml()).slice(0,5000))}
 }finally{await mp.disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1})
