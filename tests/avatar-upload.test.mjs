import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {loadPure} from './helpers/pure-module.mjs'

const {canApplyAvatarUpload}=await loadPure('profile.js')
const ui=fs.readFileSync(new URL('../components/UiBlock.vue',import.meta.url),'utf8')
const handler=ui.match(/^function chooseAvatar\(\)\{[\s\S]*?^\}/m)?.[0]
assert.ok(handler,'真实头像选择处理器必须存在')

function harness(uploadAttachment=async()=>({id:'FILE'+'a'.repeat(32)})){
 const backend={member:{id:201},token:'member-201-token',profileError:'',busy:false,uploadingCount:0}
 const form={_hydrated:true,_profileMemberId:201,avatarId:''}
 const updates=[],toasts=[],uploads=[]
 let chooser
 const props={form}
 const componentActive={value:true}
 const sandbox={backend,props,componentActive,canApplyAvatarUpload,toast:value=>toasts.push(value),
  set:(key,value)=>updates.push([key,value]),uni:{chooseImage:options=>{chooser=options}},
  uploadAttachment:async(...args)=>{uploads.push(args);return uploadAttachment(...args)}}
 vm.runInNewContext(handler+'\nglobalThis.chooseAvatar=chooseAvatar',sandbox)
 return {backend,form,props,updates,toasts,uploads,chooseAvatar:sandbox.chooseAvatar,select:paths=>chooser.success({tempFilePaths:paths}),unmount:()=>{componentActive.value=false}}
}

test('M26 头像选择成功后只更新当前表单，等待用户保存',async()=>{
 const h=harness()
 h.chooseAvatar()
 await h.select(['/tmp/avatar.png'])
 assert.equal(h.uploads.length,1)
 assert.equal(h.uploads[0][1],'AVATAR')
 assert.deepEqual(h.updates,[['avatarId','FILE'+'a'.repeat(32)]])
 assert.match(h.toasts[0],/请保存修改/)
})

test('M26 上传期间切换会员不把原会员头像写入新表单',async()=>{
 let h
 h=harness(async()=>{h.backend.member={id:202};h.backend.token='member-202-token';return {id:'FILE'+'a'.repeat(32)}})
 h.chooseAvatar()
 await h.select(['/tmp/avatar.png'])
 assert.equal(h.uploads.length,1)
 assert.deepEqual(h.updates,[])
 assert.match(h.toasts[0],/账号已变化/)
})

test('M26 选择器返回前账号变化或未选图片时不发起上传',async()=>{
 const changed=harness()
 changed.chooseAvatar()
 changed.backend.member={id:202}
 await changed.select(['/tmp/avatar.png'])
 assert.deepEqual(changed.uploads,[])
 assert.deepEqual(changed.updates,[])

 const cancelled=harness()
 cancelled.chooseAvatar()
 await cancelled.select([])
 assert.deepEqual(cancelled.uploads,[])
 assert.deepEqual(cancelled.updates,[])
})

test('M26 同账号重新进入资料页后旧选择器不上传到新表单',async()=>{
 const h=harness()
 h.chooseAvatar()
 h.props.form={...h.form}
 await h.select(['/tmp/avatar.png'])
 assert.deepEqual(h.uploads,[])
 assert.deepEqual(h.updates,[])
})

test('M26 同账号上传中重新进入资料页后旧结果不覆盖新表单',async()=>{
 let h
 h=harness(async()=>{h.props.form={...h.form};return {id:'FILE'+'a'.repeat(32)}})
 h.chooseAvatar()
 await h.select(['/tmp/avatar.png'])
 assert.equal(h.uploads.length,1)
 assert.deepEqual(h.updates,[])
 assert.match(h.toasts[0],/资料页已变化/)
})

test('M26 页面卸载后旧选择器及上传回调不更新已销毁页面',async()=>{
 const selecting=harness()
 selecting.chooseAvatar()
 selecting.unmount()
 await selecting.select(['/tmp/avatar.png'])
 assert.deepEqual(selecting.uploads,[])
 assert.deepEqual(selecting.updates,[])

 let uploading
 uploading=harness(async()=>{uploading.unmount();return {id:'FILE'+'a'.repeat(32)}})
 uploading.chooseAvatar()
 await uploading.select(['/tmp/avatar.png'])
 assert.equal(uploading.uploads.length,1)
 assert.deepEqual(uploading.updates,[])
 assert.deepEqual(uploading.toasts,[])
})

test('M26 旧页面或旧账号的上传失败不在新页面弹错，当前页面失败仍提示',async()=>{
 let changed
 changed=harness(async()=>{changed.backend.member={id:202};changed.backend.token='member-202-token';throw new Error('旧账号上传失败')})
 changed.chooseAvatar()
 await changed.select(['/tmp/avatar.png'])
 assert.deepEqual(changed.updates,[])
 assert.deepEqual(changed.toasts,[])

 let unloaded
 unloaded=harness(async()=>{unloaded.unmount();throw new Error('旧页面上传失败')})
 unloaded.chooseAvatar()
 await unloaded.select(['/tmp/avatar.png'])
 assert.deepEqual(unloaded.toasts,[])

 const current=harness(async()=>{throw new Error('图片大小须在5MB以内')})
 current.chooseAvatar()
 await current.select(['/tmp/avatar.png'])
 assert.deepEqual(current.toasts,['图片大小须在5MB以内'])
})
