export function privacyFooter(backend) {
  if (backend.pageLoading?.M27 || backend.busy) {
    return [{label: '正在读取协议', disabled: true}]
  }
  const policies = backend.policies
  const available = backend.ready && !backend.operationError
    && policies?.USER_AGREEMENT?.version && policies?.PRIVACY_POLICY?.version
  return available
    ? [{label: '确认当前版本授权', target: 'privacy-consent'}]
    : [{label: '重新读取协议', target: 'privacy-refresh'}]
}
