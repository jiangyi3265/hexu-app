const {launcher}=require('miniprogram-automator')
;(async()=>{let mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'});try{
 await mp.evaluate(()=>{require('data/backend.js').backend.busy=false})
 await mp.reLaunch('/pages/M17/index?member=995055&shop=992051')
 let p=await mp.currentPage(),root=(await p.$$(' *'.trim()))[1]
 console.log('page',p.path,(await root.outerWxml()).slice(0,10000))
}finally{await mp.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1})
