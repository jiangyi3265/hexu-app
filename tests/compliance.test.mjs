import test from 'node:test'
import assert from 'node:assert/strict'
import {
  currentPolicyVersions,
  merchantApplicationPayload,
  merchantCertificatePayload,
  directAfterSalePayload,
  trackingTimeline
} from '../data/compliance.mjs'

test('登录只提交当前已发布的准确协议版本', () => {
  const versions = currentPolicyVersions({
    USER_AGREEMENT: {version: 'V2.3'},
    PRIVACY_POLICY: {version: 'V1.4'},
    THIRD_PARTY_SHARING: {version: 'V1.0'}
  })
  assert.deepEqual(versions, {
    USER_AGREEMENT: 'V2.3', PRIVACY_POLICY: 'V1.4', THIRD_PARTY_SHARING: 'V1.0'
  })
  assert.throws(() => currentPolicyVersions({USER_AGREEMENT: {version: 'V2.3'}}), /尚未发布/)
})

test('商户进件映射主体、附件和渠道申请号，不传明文银行卡', () => {
  const payload = merchantApplicationPayload(2, {
    主体类型: '个体工商户', subjectName: '青木商行', legalRepresentative: '张三',
    licenseNo: '91350100ma2a1b2c3d', contactPhone: '13800000000',
    settlementBank: '工商银行', settlementAccountRef: 'BANK-VERIFIED-01',
    applicationRef: 'WX-APPLY-01', uploads: ['FILE-01']
  })
  assert.deepEqual(payload, {
    shopId: 2, subjectType: 'INDIVIDUAL', subjectName: '青木商行',
    legalRepresentative: '张三', licenseNo: '91350100MA2A1B2C3D',
    contactPhone: '13800000000', settlementBank: '工商银行',
    settlementAccountRef: 'BANK-VERIFIED-01', attachmentIds: ['FILE-01'],
    applicationRef: 'WX-APPLY-01'
  })
  assert.throws(() => merchantApplicationPayload(2, {...payload, uploads: []}), /上传/)
})

test('证书提交将签约费率百分数转换为基点并保留结算周期', () => {
  assert.deepEqual(merchantCertificatePayload(2, {
    serialNo: 'SERIAL1234', expiresAt: '2028-09-25', certificateRef: 'WX-CERT-01',
    contractedFeePercent: '0.25', settlementDays: '7'
  }), {
    shopId: 2, serialNo: 'SERIAL1234', expiresAt: '2028-09-25',
    certificateRef: 'WX-CERT-01', contractedFeeBps: 25, settlementDays: 7
  })
  assert.throws(() => merchantCertificatePayload(2, {
    serialNo: 'SERIAL1234', expiresAt: '2028-09-25', certificateRef: 'WX-CERT-01',
    contractedFeePercent: '', settlementDays: '7'
  }), /签约费率/)
})

test('整箱直发售后关联使用所选客户售后与真实采购单', () => {
  assert.deepEqual(directAfterSalePayload(2, 'SH1001', {
    wholesaleOrderId: 'CG1002', wholesaleRefundId: 'GS1003'
  }), {
    shopId: 2, customerRefundId: 'SH1001', wholesaleOrderId: 'CG1002', wholesaleRefundId: 'GS1003'
  })
  assert.throws(() => directAfterSalePayload(2, 'SH1001', {}), /采购订单号/)
})

test('物流只显示接口返回的轨迹，未配置时不模拟运输节点', () => {
  assert.deepEqual(trackingTimeline({tracking: 'SF12345678', status: 'UNAVAILABLE', events: []}),
    ['承运商接口未配置，暂无实时轨迹'])
  assert.deepEqual(trackingTimeline({events: [{description: '已揽收', time: '2026-09-25 10:00'}]}),
    ['已揽收 · 2026-09-25 10:00'])
})
