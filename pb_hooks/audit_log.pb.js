/// <reference path="../pb_data/types.d.ts" />

const AUDITED = [
  'sg_orders','sg_order_items','sg_payments','sg_users',
  'sg_addresses','sg_loyalty_transactions','sg_subscriptions',
  'sg_cart_items','sg_reviews','sg_coupons','sg_referrals',
]

function writeAudit(action, colName, recordId, info, changes) {
  try {
    const adminId = info?.admin?.id  || ''
    const userId  = info?.authRecord?.id || ''
    const ip      = info?.meta?.remoteAddress || ''
    const ua      = (info?.headers || {})['User-Agent'] || ''
    $app.dao().saveRecord(
      new Record($app.dao().findCollectionByNameOrId('sg_audit_logs'), {
        admin_id: adminId, user_id: userId, action,
        collection_name: colName, record_id: recordId,
        ip_address: ip, user_agent: ua,
        changes_json: changes || {}, timestamp: new Date().toISOString(),
      })
    )
  } catch(e) {}
}

AUDITED.forEach((col) => {
  onRecordCreateRequest((e) => {
    writeAudit('create', col, e.record.id, $apis.requestInfo(e.httpContext), { new: e.record.publicExport() })
    e.next()
  }, col)

  onRecordUpdateRequest((e) => {
    writeAudit('update', col, e.record.id, $apis.requestInfo(e.httpContext), { updated: e.record.publicExport() })
    e.next()
  }, col)

  onRecordDeleteRequest((e) => {
    writeAudit('delete', col, e.record.id, $apis.requestInfo(e.httpContext), { deleted_id: e.record.id })
    e.next()
  }, col)
})