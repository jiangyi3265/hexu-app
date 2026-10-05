const {launcher}=require('miniprogram-automator')
;(async()=>{let mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'});try{
 console.log('before',(await mp.currentPage()).path,await mp.evaluate(()=>{let b=require('data/backend.js').backend;return{member:b.member?.id,busy:b.busy,order:b.activeOrder?.id}}))
 const result=await mp.evaluate(async()=>await require('data/backend.js').request('/hexu/app/commands/order-cancel',{shopId:992051,id:'HX7f5747cda1664e8db3f38c27a4f7f511'},'POST','R75C05CANCEL20261005A'))
 console.log('cancel',result)
}finally{await mp.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1})
