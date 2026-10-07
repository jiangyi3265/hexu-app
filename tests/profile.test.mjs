import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const uiSource = await readFile(new URL('../components/UiBlock.vue', import.meta.url), 'utf8')
const {profilePayload, hydrateProfile, profileFields, localDate, canApplyAvatarUpload} = await import('../data/profile.js')
const base = {name:'林小禾', phone:'13888885678', gender:'不透露', birthday:'1995-09-23', region:['浙江省','杭州市','余杭区'], signature:'热爱生活', avatarId:''}
test('生日边界统一按上海业务日期，不依赖设备所在时区',()=>{
 assert.equal(localDate(new Date('2026-09-26T15:59:59Z')),'2026-09-26')
 assert.equal(localDate(new Date('2026-09-26T16:00:00Z')),'2026-09-27')
})
test('资料提交只包含联系手机号，不修改已验证的账号手机号', () => {
  const value = profilePayload({...base, name:' 林小禾 ', uploads:['private'], _hydrated:true})
  assert.deepEqual(Object.keys(value), ['name','contactPhone','gender','birthday','region','signature','avatarId'])
  assert.equal(value.name, '林小禾')
  assert.equal(value.contactPhone, base.phone)
})
test('联系手机号可留空，只接受规范的11位中国大陆手机号', () => {
  assert.equal(profilePayload({...base,contactPhone:' 13900139000 '}).contactPhone,'13900139000')
  assert.equal(profilePayload({...base,contactPhone:''}).contactPhone,'')
  for(const contactPhone of ['12345678901','12900139000','1390013900','139001390000','13900139a00','１３９００１３９０００',null]){
    assert.throws(()=>profilePayload({...base,contactPhone}),String(contactPhone))
  }
})
test('昵称及签名按Unicode字符校验长度，不接受空昵称', () => {
  for (const name of ['', ' ', '林'.repeat(21)]) assert.throws(()=>profilePayload({...base,name}))
  assert.equal(profilePayload({...base,name:'🌱'.repeat(20)}).name, '🌱'.repeat(20))
  assert.throws(()=>profilePayload({...base,signature:'禾'.repeat(101)}))
  assert.equal(profilePayload({...base,signature:'  第一行\n第二行  '}).signature,'  第一行\n第二行  ')
  assert.throws(()=>profilePayload({...base,signature:' '.repeat(101)}))
})
test('拒绝不存在、未来和无效格式的生日', () => {
  for (const birthday of ['2025-02-29','1995-02-30','2027-01-01','昨天','1899-01-01']) assert.throws(()=>profilePayload({...base,birthday},'2026-09-27'))
  assert.equal(profilePayload({...base,birthday:'2024-02-29'}).birthday,'2024-02-29')
  assert.equal(profilePayload({...base,birthday:''}).birthday,'')
})
test('Unicode纯空白昵称与C0/C1拒绝，正常昵称去边缘空白不改变字符上限',()=>{
 for(const name of ['\u3000','\u00a0','\u2003','\ufeff',' \u3000\u00a0\ufeff '])assert.throws(()=>profilePayload({...base,name}))
 for(let point=0;point<=0x9f;point++)if(point<=0x1f||point>=0x7f)assert.throws(()=>profilePayload({...base,name:'林'+String.fromCharCode(point)+'禾'}))
 const name='🌿'.repeat(20);assert.equal(profilePayload({...base,name:'\u3000\ufeff'+name+'\u00a0'}).name,name)
 assert.throws(()=>profilePayload({...base,name:'\u3000'+name+'🌿\u00a0'}))
})
test('地区结构和字符校验；性别头像必须有效', () => {
  for (const region of [['浙江省'],['浙江省','abc'],['浙江省','杭州市',''],['火星省','土星市','木星区'],['浙江省','泉州市','安溪县']]) {
    assert.throws(()=>profilePayload({...base,region}))
  }
  assert.throws(()=>profilePayload({...base,gender:'未知'}))
  assert.throws(()=>profilePayload({...base,name:'禾序\n'}))
  assert.throws(()=>profilePayload({...base,signature:'签名\u0000'}))
  assert.throws(()=>profilePayload({...base,avatarId:'http://tmp/avatar.png'}))
  assert.equal(profilePayload({...base,avatarId:'FILE'+'a'.repeat(32)}).avatarId,'FILE'+'a'.repeat(32))
})
test('个人资料每个可选字段的清空与上限符合保存契约', () => {
  const cleared=profilePayload({...base,gender:'',birthday:'',region:[],signature:'',avatarId:''})
  assert.deepEqual(cleared,{name:'林小禾',contactPhone:base.phone,gender:'',birthday:'',region:[],signature:'',avatarId:''})
  assert.equal(profilePayload({...base,name:'禾'}).name,'禾')
  assert.equal(profilePayload({...base,signature:'🌿'.repeat(100)}).signature,'🌿'.repeat(100))
  assert.equal(profilePayload({...base,region:['北京市','朝阳区']}).region.length,2)
  assert.equal(profilePayload({...base,birthday:'1900-01-01'},'2026-09-27').birthday,'1900-01-01')
  assert.equal(profilePayload({...base,birthday:'2026-09-27'},'2026-09-27').birthday,'2026-09-27')
  for (const gender of ['女','男','不透露']) assert.equal(profilePayload({...base,gender}).gender,gender)
  const fields=Object.fromEntries(profileFields('2026-09-27').map(item=>[item.key,item]))
  assert.equal(fields.name.maxlength,20)
  assert.equal(fields.signature.maxlength,100)
  assert.equal(fields.contactPhone.kind,'phone')
  assert.equal(fields.contactPhone.maxlength,11)
  assert.equal(fields.birthday.start,'1900-01-01')
  assert.equal(fields.birthday.end,'2026-09-27')
  assert.equal(fields.region.kind,'region')
})
test('可选性别和生日可清空，地区选择与其他资料不受影响',()=>{
  const fields=Object.fromEntries(profileFields().map(item=>[item.key,item]))
  assert.equal(fields.gender.kind,'select')
  assert.equal(fields.birthday.kind,'date')
  assert.equal(fields.region.kind,'region')
  assert.equal(fields.gender.clearable,true)
  assert.equal(fields.gender.options[0],'未填写')
  assert.equal(fields.gender.emptyLabel,'未填写')
  assert.equal(fields.birthday.clearable,true)
  assert.equal(fields.region.clearable,undefined)
  assert.equal(profilePayload({...base,gender:'',birthday:''}).birthday,'')
  assert.match(uiSource,/item\.kind==='date'&&item\.clearable/)
  assert.match(uiSource,/@tap\.stop="set\(item\.key,''\)"/)
  assert.match(uiSource,/picker mode="region"/)
})
test('资料字段类型与 Java 契约一致，异常表单不能静默清空已保存资料', () => {
  for(const key of ['name','gender','birthday','signature','avatarId']) {
    for(const value of [null,undefined,123,{},[]]) {
      assert.throws(()=>profilePayload({...base,[key]:value}),String(key)+'='+String(value))
    }
  }
  for(const region of [null,undefined,'浙江省 杭州市',[{toString:()=> '浙江省'},'杭州市']]) {
    assert.throws(()=>profilePayload({...base,region}))
  }
})
test('缺失字段不回填样例资料；回显地区与原对象隔离', () => {
  const form={name:'假资料',region:['样例']};hydrateProfile(form,{name:'新名字',region:base.region})
  assert.equal(form.birthday,'');assert.equal(form.signature,'');assert.equal(form.phone,'');assert.equal(form.contactPhone,'')
  form.region.push('测试');assert.equal(base.region.length,3)
  assert.equal(profileFields('2026-09-27').find(x=>x.key==='birthday').end,'2026-09-27')
})
test('头像上传结果只允许回填发起上传的会员、会话和已读取表单', () => {
  const backend={member:{id:201},token:'old-token',profileError:''}
  const form={_hydrated:true,_profileMemberId:201}
  assert.equal(canApplyAvatarUpload(backend,form,201,'old-token'),true)
  assert.equal(canApplyAvatarUpload({...backend,member:{id:202}},form,201,'old-token'),false)
  assert.equal(canApplyAvatarUpload({...backend,token:'new-token'},form,201,'old-token'),false)
  assert.equal(canApplyAvatarUpload({...backend,profileError:'读取失败'},form,201,'old-token'),false)
  assert.equal(canApplyAvatarUpload(backend,{...form,_profileMemberId:202},201,'old-token'),false)
  assert.equal(canApplyAvatarUpload(backend,{...form,_hydrated:false},201,'old-token'),false)
})
