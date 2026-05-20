/// <reference path="../pb_data/types.d.ts" />
onRecordCreateRequest((e) => {
  const record = e.record
  if (record.get('ref')) return
  const year     = new Date().getFullYear()
  const sequence = String(Math.floor(100000 + Math.random() * 900000))
  record.set('ref', `SG-${year}-${sequence}`)
  e.next()
}, 'sg_orders')