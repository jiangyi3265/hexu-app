import {isValidRegion} from './region-picker.mjs'

const length = value => [...value].length
const field = (form, key) => {
  if (typeof form[key] !== 'string') throw new Error(`个人资料字段须为文本：${key}`)
  return form[key]
}

export function localDate(now = new Date()) {
  // Birthdays use the same business date as the Java service (Asia/Shanghai).
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function profilePayload(form, today = localDate()) {
  const rawName = field(form, 'name'), name = rawName.trim()
  const signature = field(form, 'signature'), gender = field(form, 'gender'), birthday = field(form, 'birthday')
  const avatarId = field(form, 'avatarId')
  if (!Array.isArray(form.region)) throw new Error('所在地区须通过地区选择器提交')
  const region = [...form.region]
  if (!name || length(name) > 20 || /[\u0000-\u001f\u007f-\u009f]/.test(rawName)) throw new Error('昵称请输入1–20个字符，不能包含换行或控制字符')
  if (length(signature) > 100 || signature.includes('\u0000')) throw new Error('个性签名最多100个字符，不能包含空字符')
  if (!['', '女', '男', '不透露'].includes(gender)) throw new Error('请选择有效的性别')
  if (birthday) {
    const date = new Date(birthday + 'T00:00:00Z')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== birthday || birthday < '1900-01-01' || birthday > today) throw new Error('请选择有效且不晚于今天的生日')
  }
  if (region.length && !isValidRegion(region)) throw new Error('请选择有效的省、市、区')
  if (avatarId && !/^FILE[0-9a-f]{32}$/.test(avatarId)) throw new Error('头像上传尚未完成，请重新选择')
  return {name, gender, birthday, region, signature, avatarId}
}

export function hydrateProfile(form, profile) {
  for (const key of ['name', 'phone', 'gender', 'birthday', 'signature', 'avatarId']) form[key] = profile?.[key] || ''
  form.region = Array.isArray(profile?.region) ? [...profile.region] : []
  form._hydrated = true
}

export function profileFields(today = localDate()) {
  return [
    {label:'昵称', key:'name', kind:'input', required:true, maxlength:20},
    {label:'手机号', key:'phone', kind:'phone'},
    {label:'性别', key:'gender', kind:'select', options:['未填写','女','男','不透露'], emptyLabel:'未填写', clearable:true},
    {label:'生日', key:'birthday', kind:'date', start:'1900-01-01', end:today, clearable:true},
    {label:'所在地区', key:'region', kind:'region'},
    {label:'个性签名', key:'signature', kind:'textarea', maxlength:100}
  ]
}

export const avatarAsset = id => id ? '/hexu/app/attachments/avatar/' + id : 'avatar'

export function canApplyAvatarUpload(backend, form, memberId, token) {
  return memberId != null && Number(memberId) > 0 &&
    Number(backend.member?.id) === Number(memberId) && backend.token === token &&
    form?._hydrated === true && Number(form._profileMemberId) === Number(memberId) &&
    !backend.profileError
}
