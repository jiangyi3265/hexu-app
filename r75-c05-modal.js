const {launcher}=require('miniprogram-automator')
;(async()=>{let mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'});try{
 console.log('before', (await mp.currentPage()).path, await mp.evaluate(()=>{let b=require('data/backend.js').backend;return{busy:b.busy,order:b.activeOrder?.id}}))
 try{console.log('cancelModal',await mp.native().cancelModal())}catch(e){console.log('cancelModalError',e.message)}
 console.log('after',(await mp.currentPage()).path,await mp.evaluate(()=>{let b=require('data/backend.js').backend;return{busy:b.busy,order:b.activeOrder?.id}}))
}finally{await mp.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1})
