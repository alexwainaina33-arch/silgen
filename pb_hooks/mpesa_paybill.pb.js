/// <reference path="../pb_data/types.d.ts" />

// ─── M-Pesa Paybill C2B Auto-Detection ────────────────────────────────────
// Safaricom calls /api/mpesa/paybill/validation and /api/mpesa/paybill/confirmation
// when a customer pays via their M-Pesa menu using the paybill number.
//
// Registration (run once on Daraja dashboard or via API):
//   Validation URL:   https://fieldtrack-kenya.fly.dev/api/mpesa/paybill/validation
//   Confirmation URL: https://fieldtrack-kenya.fly.dev/api/mpesa/paybill/confirmation

const MPESA_ENV = $os.getenv('MPESA_ENV') || 'sandbox'

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINT 1: GET /api/mpesa/paybill/validation
// Safaricom asks: "should I accept this payment?"
// Always return 0 (accept) to avoid blocking customer payments
// ══════════════════════════════════════════════════════════════════════════
routerAdd('POST', '/api/mpesa/paybill/validation', (c) => {
  // Always accept — never block a payment
  return c.json(200, {
    ResultCode: 0,
    ResultDesc: 'Accepted',
  })
})

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINT 2: POST /api/mpesa/paybill/confirmation
// Safaricom confirms payment was made — match to order by AccountReference
// ══════════════════════════════════════════════════════════════════════════
routerAdd('POST', '/api/mpesa/paybill/confirmation', (c) => {
  let body
  try {
    body = $apis.requestInfo(c).data
  } catch (e) {
    return c.json(200, { ResultCode: 0, ResultDesc: 'Accepted' })
  }

  try {
    // Safaricom C2B fields
    const transactionId   = body?.TransID          || ''
    const transAmount     = body?.TransAmount       || 0
    const billRef         = body?.BillRefNumber     || '' // customer enters order ref
    const msisdn          = body?.MSISDN            || '' // customer phone
    const firstName       = body?.FirstName         || ''
    const transTime       = body?.TransTime         || ''
    const orgAccountBal   = body?.OrgAccountBalance || ''

    if (!billRef) {
      return c.json(200, { ResultCode: 0, ResultDesc: 'Accepted' })
    }

    // ── Try to match order by ref (customer enters SG-2025-XXXXXX) ─────────
    let matchedOrder = null
    try {
      // Try exact match first
      const orders = $app.dao().findRecordsByFilter(
        'sg_orders',
        `ref = "${billRef.toUpperCase()}"`,
        '', 1, 0
      )
      if (orders.length > 0) matchedOrder = orders[0]
    } catch (e) { /* not found */ }

    // ── Try partial match (customer may enter last 6 digits only) ──────────
    if (!matchedOrder && billRef.length >= 6) {
      try {
        const orders = $app.dao().findRecordsByFilter(
          'sg_orders',
          `ref ~ "${billRef.slice(-6)}"`,
          '-created', 5, 0
        )
        if (orders.length > 0) matchedOrder = orders[0]
      } catch (e) { /* not found */ }
    }

    // ── Create payment record regardless of order match ────────────────────
    const paymentData = {
      method:           'mpesa_paybill',
      amount_kes:       Number(transAmount),
      currency:         'KES',
      status:           matchedOrder ? 'success' : 'pending',
      gateway_ref:      transactionId,
      phone_used:       msisdn,
      gateway_response: body,
    }

    if (matchedOrder) {
      paymentData.order_id = matchedOrder.id
      paymentData.user_id  = matchedOrder.get('user_id') || ''
    }

    const paymentRecord = new Record(
      $app.dao().findCollectionByNameOrId('sg_payments'),
      paymentData
    )
    $app.dao().saveRecord(paymentRecord)

    // ── Update order if matched ────────────────────────────────────────────
    if (matchedOrder) {
      const orderTotal = matchedOrder.get('total_kes') || 0
      const paid       = Number(transAmount)

      // Accept if paid amount >= order total (allow overpayment)
      if (paid >= orderTotal) {
        matchedOrder.set('payment_status', 'paid')
        matchedOrder.set('status',         'confirmed')
        $app.dao().saveRecord(matchedOrder)

        // Loyalty points
        const userId = matchedOrder.get('user_id')
        const earned = Math.floor(orderTotal)

        if (userId && earned > 0) {
          try {
            const user    = $app.dao().findRecordById('sg_users', userId)
            const current = user.get('loyalty_points') || 0
            user.set('loyalty_points', current + earned)
            $app.dao().saveRecord(user)

            $app.dao().saveRecord(
              new Record($app.dao().findCollectionByNameOrId('sg_loyalty_transactions'), {
                user_id:       userId,
                order_id:      matchedOrder.id,
                type:          'earn',
                points:        earned,
                balance_after: current + earned,
                description:   'Earned from paybill order ' + matchedOrder.get('ref'),
              })
            )

            // Notification
            $app.dao().saveRecord(
              new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
                user_id: userId,
                type:    'payment',
                title:   'Paybill payment received ✓',
                body:    'KES ' + paid + ' received via M-Pesa paybill. Ref: ' + transactionId,
                link:    '/orders',
                is_read: false,
              })
            )
          } catch (e) { /* best effort */ }
        }

      } else {
        // Underpayment — mark as partial
        matchedOrder.set('notes',
          (matchedOrder.get('notes') || '') +
          ` [PARTIAL PAYMENT: KES ${paid} received of KES ${orderTotal} via ${transactionId}]`
        )
        $app.dao().saveRecord(matchedOrder)
      }
    }

  } catch (e) {
    // Always return 200 to Safaricom
  }

  return c.json(200, { ResultCode: 0, ResultDesc: 'Accepted' })
})

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINT 3: GET /api/mpesa/paybill/unmatched
// Admin tool — list payments that came in but couldn't be matched to an order
// ══════════════════════════════════════════════════════════════════════════
routerAdd('GET', '/api/mpesa/paybill/unmatched', (c) => {
  // Require admin auth
  const info = $apis.requestInfo(c)
  if (!info.admin) {
    return c.json(403, { error: 'Admin access required' })
  }

  try {
    const records = $app.dao().findRecordsByFilter(
      'sg_payments',
      `method = "mpesa_paybill" && order_id = ""`,
      '-created', 50, 0
    )

    const items = records.map(r => ({
      id:          r.id,
      amount_kes:  r.get('amount_kes'),
      gateway_ref: r.get('gateway_ref'),
      phone_used:  r.get('phone_used'),
      created:     r.get('created'),
      raw:         r.get('gateway_response'),
    }))

    return c.json(200, { total: items.length, items })
  } catch (e) {
    return c.json(500, { error: e.message })
  }
})

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINT 4: POST /api/mpesa/paybill/match
// Admin tool — manually match an unmatched payment to an order
// Body: { payment_id, order_id }
// ══════════════════════════════════════════════════════════════════════════
routerAdd('POST', '/api/mpesa/paybill/match', (c) => {
  const info = $apis.requestInfo(c)
  if (!info.admin) {
    return c.json(403, { error: 'Admin access required' })
  }

  const body      = $apis.requestInfo(c).data
  const paymentId = body?.payment_id
  const orderId   = body?.order_id

  if (!paymentId || !orderId) {
    return c.json(400, { error: 'Missing payment_id or order_id' })
  }

  try {
    const payment = $app.dao().findRecordById('sg_payments', paymentId)
    const order   = $app.dao().findRecordById('sg_orders',   orderId)

    payment.set('order_id', orderId)
    payment.set('user_id',  order.get('user_id') || '')
    payment.set('status',   'success')
    $app.dao().saveRecord(payment)

    order.set('payment_status', 'paid')
    order.set('status',         'confirmed')
    $app.dao().saveRecord(order)

    return c.json(200, { success: true, message: 'Payment matched to order ' + order.get('ref') })
  } catch (e) {
    return c.json(500, { error: e.message })
  }
})