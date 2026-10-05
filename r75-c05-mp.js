const {launcher}=require('miniprogram-automator')
const pause=ms=>new Promise(r=>setTimeout(r,ms))
const view=async mp=>{let p=await mp.currentPage();return{p,root:(await p.$$(' *'.trim()))[1]}}
;(async()=>{let mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'});try{
 let {p,root}=await view(mp);console.log('before',p.path)
 if(p.path==='pages/M03/index'){const cards=await root.$$('.home-products .product-card');console.log('cards',cards.length);await cards[1].tap();await pause(2000)}
 else if(p.path==='pages/M05/index'){await(await root.$('.product-bottom button.primary')).tap();await pause(2000)}
 ;({p,root}=await view(mp));console.log('after',p.path,(await root.outerWxml()).slice(0,7200))
}finally{await mp.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1})
