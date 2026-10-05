const {launcher}=require('miniprogram-automator')
const pause=ms=>new Promise(r=>setTimeout(r,ms))
const view=async mp=>{const p=await mp.currentPage();return{p,root:(await p.$$(' *'.trim()))[1]}}
;(async()=>{const mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'});try{
 let {p,root}=await view(mp);console.log('before',p.path)
 for(const c of await root.$$(' *'.trim()))if(c.tagName==='component'&&(await c.outerWxml()).includes('兑换数量')){const input=await c.$('input');if(input){await input.input('0');console.log('zero-input',(await c.outerWxml()).slice(0,800));break}}
 await(await root.$('.bottom-bar button')).tap();await pause(1200)
 ;({p,root}=await view(mp));console.log('zero-result',p.path,(await root.outerWxml()).match(/兑换后剩余[^<]*|兑换数量[^<]*/g)?.slice(0,5))
 for(const c of await root.$$(' *'.trim()))if(c.tagName==='component'&&(await c.outerWxml()).includes('兑换数量')){const input=await c.$('input');if(input){await input.input('1');break}}
 await(await root.$('.bottom-bar button')).tap();await pause(2600)
 ;({p,root}=await view(mp));console.log('after',p.path,(await root.outerWxml()).slice(0,6000))
 console.log('state',await mp.evaluate(()=>{let b=require('data/backend.js').backend;return{member:b.member?.id,points:b.account?.platformPoints?.available,redemption:b.redemptionOrder?.id}}))
}finally{await mp.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1})
