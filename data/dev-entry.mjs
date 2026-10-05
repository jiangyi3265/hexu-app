export function sandboxMemberId(entry, enabled) {
  const memberId = Number(entry?.member)
  return enabled && Number.isSafeInteger(memberId) && memberId > 0 ? memberId : 201
}
