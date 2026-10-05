const {launcher}=require('miniprogram-automator')
const pause=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{const mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'});try{
 let p=await mp.currentPage(),root=(await p.$$(' *'.trim()))[1];console.log('before',p.path)
 for(const c of await root.$$(' *'.trim()))if(c.tagName==='component'&&(await c.outerWxml()).includes('申请售后')){const bs=await c.$$('button');console.log('buttons',bs.length);if(bs.length===3){await bs[1].tap();break}}
 await pause(2200);p=await mp.currentPage();root=(await p.$$(' *'.trim()))[1];console.log('after',p.path,(await root.outerWxml()).slice(0,10000))
}finally{await mp.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1})
