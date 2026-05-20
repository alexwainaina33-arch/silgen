/// <reference path="../pb_data/types.d.ts" />

const FLW_SECRET = $os.getenv('FLUTTERWAVE_SECRET_KEY') || 'TEST_FLW_SECRET'
const FLW_API    = 'https://api.flutterwave.com/v3'

// ── COD: confirm order ────────────────────────────────────────────────────
routerAdd('POST', '/api/cod/confirm', (c) => {
  const body     = $apis.requestInfo(c).data
  const order_id = body?.order_id
  if (!order_id) return c.json(400, { error: 'Missing order_id' })
  try {
    const order = $app.dao().findRecordById('sg_orders', order_id)
    $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_payments'), {
      order_id, user_id: order.get('user_id') || '',
      method: 'cod', amount_kes: order.get('total_kes') || 0,
      currency: 'KES', status: 'pending',
      gateway_response: { method: 'cash_on_delivery', confirmed_at: new Date().toISOString() },
    }))
    order.set('payment_method', 'cod')
    order.set('payment_status', 'pending')
    order.set('status', 'confirmed')
    $app.dao().saveRecord(order)
    const userId = order.get('user_id')
    if (userId) {
      try {
        $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
          user_id: userId, type: 'order',
          title: '📦 Order confirmed — pay on delivery',
          body: `Order ${order.get('ref')} confirmed. Pay KES ${order.get('total_kes')} to the rider upon delivery.`,
          link: '/orders', is_read: false,
        }))
      } catch(e) {}
    }
    return c.json(200, { success: true, order_id, ref: order.get('ref'), status: 'confirmed', message: 'Order confirmed. Payment collected on delivery.' })
  } catch(e) {
    return c.json(500, { error: e.message })
  }
})

// ── COD: auto-update payment when order delivered ─────────────────────────
onRecordUpdateRequest((e) => {
  e.next()
  const record    = e.record
  const newStatus = record.get('status')
  const payMethod = record.get('payment_method')
  if (newStatus !== 'delivered' || payMethod !== 'cod') return
  try {
    const payments = $app.dao().findRecordsByFilter('sg_payments', `order_id = "${record.id}" && method = "cod"`, '', 1, 0)
    if (payments.length > 0) { payments[0].set('status', 'success'); $app.dao().saveRecord(payments[0]) }
    record.set('payment_status', 'paid')
    record.set('delivered_at', new Date().toISOString())
    $app.dao().saveRecord(record)
    const userId = record.get('user_id')
    const total  = record.get('total_kes') || 0
    const earned = Math.floor(total)
    if (userId && earned > 0) {
      try {
        const user = $app.dao().findRecordById('sg_users', userId)
        const pts  = (user.get('loyalty_points') || 0) + earned
        user.set('loyalty_points', pts)
        $app.dao().saveRecord(user)
        $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_loyalty_transactions'), {
          user_id: userId, order_id: record.id, type: 'earn',
          points: earned, balance_after: pts,
          description: 'Earned from COD order ' + record.get('ref'),
        }))
        $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
          user_id: userId, type: 'order',
          title: '✅ Order delivered!',
          body: `Order ${record.get('ref')} delivered. You earned ${earned} loyalty points!`,
          link: '/orders', is_read: false,
        }))
      } catch(e) {}
    }
  } catch(e) {}
}, 'sg_orders')

// ── Flutterwave verify ────────────────────────────────────────────────────
routerAdd('POST', '/api/flutterwave/verify', (c) => {
  const body          = $apis.requestInfo(c).data
  const transactionId = body?.transaction_id
  const orderId       = body?.order_id
  const expectedAmt   = Number(body?.expected_amount || 0)
  const expectedCurr  = body?.expected_currency || 'KES'
  if (!transactionId || !orderId) return c.json(400, { error: 'Missing transaction_id or order_id' })

  if (FLW_SECRET === 'TEST_FLW_SECRET') {
    try {
      const order  = $app.dao().findRecordById('sg_orders', orderId)
      const total  = order.get('total_kes') || 0
      const userId = order.get('user_id')
      $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_payments'), {
        order_id: orderId, user_id: userId || '', method: 'visa_mc',
        amount_kes: total, currency: expectedCurr, amount_foreign: expectedAmt,
        status: 'success', gateway_ref: 'FLW_TEST_' + transactionId,
        gateway_response: { sandbox: true, transaction_id: transactionId },
      }))
      order.set('payment_status', 'paid')
      order.set('status', 'confirmed')
      $app.dao().saveRecord(order)
      if (userId) {
        const earned = Math.floor(total)
        try {
          const user = $app.dao().findRecordById('sg_users', userId)
          const pts  = (user.get('loyalty_points') || 0) + earned
          user.set('loyalty_points', pts)
          $app.dao().saveRecord(user)
          $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_loyalty_transactions'), {
            user_id: userId, order_id: orderId, type: 'earn',
            points: earned, balance_after: pts,
            description: 'Earned from card payment ' + order.get('ref'),
          }))
          $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
            user_id: userId, type: 'payment',
            title: '💳 Card payment confirmed ✓',
            body: `Payment received. Order ${order.get('ref')} confirmed.`,
            link: '/orders', is_read: false,
          }))
        } catch(e) {}
      }
      return c.json(200, { success: true, sandbox: true, status: 'successful', order_id: orderId, ref: order.get('ref') })
    } catch(e) {
      return c.json(500, { error: e.message })
    }
  }

  try {
    const res    = $http.send({ url: FLW_API + '/transactions/' + transactionId + '/verify', method: 'GET', headers: { 'Authorization': 'Bearer ' + FLW_SECRET }, timeout: 15 })
    const data   = JSON.parse(res.raw)
    const txData = data?.data
    if (!txData || txData.status !== 'successful') return c.json(400, { error: 'Payment not successful', status: txData?.status })
    if (Math.abs(txData.amount - expectedAmt) > 1 || txData.currency !== expectedCurr) return c.json(400, { error: 'Amount or currency mismatch' })
    const order  = $app.dao().findRecordById('sg_orders', orderId)
    $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_payments'), {
      order_id: orderId, user_id: order.get('user_id') || '', method: 'visa_mc',
      amount_kes: order.get('total_kes') || 0, currency: txData.currency, amount_foreign: txData.amount,
      status: 'success', gateway_ref: txData.flw_ref || String(transactionId), gateway_response: txData,
    }))
    order.set('payment_status', 'paid')
    order.set('status', 'confirmed')
    $app.dao().saveRecord(order)
    return c.json(200, { success: true, status: 'successful', order_id: orderId, ref: order.get('ref') })
  } catch(e) {
    return c.json(500, { error: e.message })
  }
})

// ── Flutterwave webhook ───────────────────────────────────────────────────
routerAdd('POST', '/api/flutterwave/webhook', (c) => {
  let body
  try { body = $apis.requestInfo(c).data } catch(e) { return c.json(200, { received: true }) }
  try {
    if (body?.event === 'charge.completed' && body?.data?.status === 'successful') {
      const txRef = body?.data?.tx_ref
      try {
        const orders = $app.dao().findRecordsByFilter('sg_orders', `ref = "${txRef}"`, '', 1, 0)
        if (orders.length > 0 && orders[0].get('payment_status') !== 'paid') {
          orders[0].set('payment_status', 'paid')
          orders[0].set('status', 'confirmed')
          $app.dao().saveRecord(orders[0])
        }
      } catch(e) {}
    }
  } catch(e) {}
  return c.json(200, { received: true })
})