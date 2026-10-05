const {launcher}=require('miniprogram-automator')
const pause=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{const mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'});try{
 let p=await mp.currentPage(),root=(await p.$$(' *'.trim()))[1];console.log('before',p.path)
 for(const c of await root.$$(' *'.trim())){if(c.tagName==='component'){const w=await c.outerWxml();if(w.includes('C18 isolated points redeem item')){const cards=await c.$$('.product-card');console.log('cards',cards.length);for(let i=0;i<cards.length;i++)console.log(i,(await cards[i].outerWxml()).slice(0,300));await cards[1].tap();break}}}
 await pause(2200);p=await mp.currentPage();root=(await p.$$(' *'.trim()))[1];console.log('after',p.path,(await root.outerWxml()).slice(0,8000));console.log('selected',await mp.evaluate(()=>{let b=require('data/backend.js').backend;return{sku:b.redemptionSku?.id,ready:b.redemptionReady,state:b.state?.redemptionSku?.id}}))
}finally{await mp.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1})
