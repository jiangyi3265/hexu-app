const {launcher}=require('miniprogram-automator')
const pause=ms=>new Promise(r=>setTimeout(r,ms))
const view=async mp=>{let p=await mp.currentPage();return{p,root:(await p.$$(' *'.trim()))[1]}}
;(async()=>{let mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'});try{
 let {p,root}=await view(mp);console.log('before',p.path)
 for(const c of await root.$$(' *'.trim()))if(c.tagName==='component'&&(await c.outerWxml()).includes('申请数量')){await(await c.$('input')).input('2');await(await c.$('textarea')).input('R75 C18 合成兑换积分退款边界，不真实寄件');break}
 await(await root.$('.bottom-bar button')).tap();await pause(700)
 ;({p,root}=await view(mp));console.log('oversize',p.path,(await root.outerWxml()).includes('value="2"'))
 for(const c of await root.$$(' *'.trim()))if(c.tagName==='component'&&(await c.outerWxml()).includes('申请数量')){await(await c.$('input')).input('1');break}
 await(await root.$('.bottom-bar button')).tap();await pause(2200)
 ;({p,root}=await view(mp));console.log('after',p.path,(await root.outerWxml()).slice(0,5500));console.log('refund',await mp.evaluate(()=>{let b=require('data/backend.js').backend;return{refund:b.refund?.id,points:b.account?.platformPoints?.available}}))
}finally{await mp.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1})
