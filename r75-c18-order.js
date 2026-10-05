const {launcher}=require('miniprogram-automator')
const pause=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{const mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'});try{
 let p=await mp.currentPage(),root=(await p.$$(' *'.trim()))[1];console.log('before',p.path)
 if(p.path==='pages/M20/index'){for(const c of await root.$$(' *'.trim()))if(c.tagName==='component'&&(await c.outerWxml()).includes('补充说明')){const t=await c.$('textarea');if(t){await t.input('R75 C18 合成积分兑换仅退款测试，无真实商品寄送');break}}}
 await(await root.$('.bottom-bar button')).tap();await pause(2200)
 p=await mp.currentPage();root=(await p.$$(' *'.trim()))[1];console.log('after',p.path,(await root.outerWxml()).slice(0,10500))
}finally{await mp.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1})
