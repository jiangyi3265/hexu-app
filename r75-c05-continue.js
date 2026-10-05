const {launcher}=require('miniprogram-automator')
const pause=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{let mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'});try{
 let p=await mp.currentPage(),root=(await p.$$(' *'.trim()))[1];console.log('before',p.path)
 const b=await root.$('button.primary.full')||await root.$('.bottom-bar button.primary');console.log('button',b?await b.outerWxml():'none');if(b)await b.tap();await pause(1900)
 p=await mp.currentPage();root=(await p.$$(' *'.trim()))[1];console.log('after',p.path,(await root.outerWxml()).slice(0,9500))
}finally{await mp.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1})
