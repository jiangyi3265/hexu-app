const {launcher}=require('miniprogram-automator')
;(async()=>{let mp=await launcher.connectTool({wsEndpoint:'ws://127.0.0.1:9450'});try{
 const x=await mp.evaluate(async()=>{try{return{ok:true,result:await require('data/backend.js').request('/hexu/dev/payment/PAY248e180f6bbb4856bdb9d92a37c180b3',{},'POST')}}catch(e){return{ok:false,error:e.message}}})
 console.log(x)
}finally{await mp.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1})
