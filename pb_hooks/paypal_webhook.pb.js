/// <reference path="../pb_data/types.d.ts" />

// ─── PayPal Webhook + Order Capture Handler ────────────────────────────────
// Endpoints:
//   POST /api/paypal/capture        → capture a PayPal order after approval
//   POST /api/paypal/webhook        → PayPal IPN/webhook for async events
//   GET  /api/paypal/client-token   → get client token for PayPal JS SDK

const PAYPAL_CLIENT_ID     = $os.getenv('VITE_PAYPAL_CLIENT_ID')     || 'TEST_PAYPAL_CLIENT_ID'
const PAYPAL_CLIENT_SECRET = $os.getenv('PAYPAL_CLIENT_SECRET')      || 'TEST_PAYPAL_SECRET'
const PAYPAL_ENV           = $os.getenv('PAYPAL_ENV')                || 'sandbox'

const PAYPAL_BASE = PAYPAL_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

// ── Helper: get PayPal access token ──────────────────────────────────────
function getPayPalToken() {
  if (PAYPAL_CLIENT_ID === 'TEST_PAYPAL_CLIENT_ID') {
    return 'SANDBOX_TEST_TOKEN'
  }
  const credentials = $security.base64Encode(PAYPAL_CLIENT_ID + ':' + PAYPAL_CLIENT_SECRET)
  const res = $http.send({
    url:     PAYPAL_BASE + '/v1/oauth2/token',
    method:  'POST',
    headers: {
      'Authorization': 'Basic ' + credentials,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body:    'grant_type=client_credentials',
    timeout: 15,
  })
  const data = JSON.parse(res.raw)
  if (!data.access_token) throw new Error('PayPal token failed: ' + res.raw)
  return data.access_token
}

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINT 1: POST /api/paypal/create-order
// Body: { amount_usd, order_id, currency, description }
// Returns: { paypal_order_id } — frontend uses this to open PayPal modal
// ══════════════════════════════════════════════════════════════════════════
routerAdd('POST', '/api/paypal/create-order', (c) => {
  const body = $apis.requestInfo(c).data
  const { amount_usd, order_id, currency, description } = body

  if (!amount_usd || !order_id) {
    return c.json(400, { error: 'Missing amount_usd or order_id' })
  }

  // ── SANDBOX: return fake PayPal order ID ──────────────────────────────
  if (PAYPAL_CLIENT_ID === 'TEST_PAYPAL_CLIENT_ID') {
    const fakeOrderId = 'PAYPAL_TEST_' + Date.now()
    return c.json(200, {
      sandbox:        true,
      paypal_order_id: fakeOrderId,
      message:        'SANDBOX: Use /api/paypal/capture to simulate capture',
      approve_link:   `https://www.sandbox.paypal.com/checkoutnow?token=${fakeOrderId}`,
    })
  }

  // ── LIVE ──────────────────────────────────────────────────────────────
  try {
    const token = getPayPalToken()
    const curr  = currency || 'USD'

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: order_id,
        description:  description || 'SILGEN Order ' + order_id,
        amount: {
          currency_code: curr,
          value:         Number(amount_usd).toFixed(2),
        },
      }],
      application_context: {
        brand_name:          'SILGEN',
        landing_page:        'BILLING',
        shipping_preference: 'NO_SHIPPING',
        user_action:         'PAY_NOW',
        return_url:          'https://silgen.vercel.app/checkout?paypal=success',
        cancel_url:          'https://silgen.vercel.app/checkout?paypal=cancel',
      },
    }

    const res = $http.send({
      url:     PAYPAL_BASE + '/v2/checkout/orders',
      method:  'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'application/json',
      },
      body:    JSON.stringify(payload),
      timeout: 15,
    })

    const data = JSON.parse(res.raw)
    if (!data.id) return c.json(400, { error: 'PayPal order creation failed', raw: data })

    const approveLink = (data.links || []).find(l => l.rel === 'approve')?.href || ''

    return c.json(200, {
      paypal_order_id: data.id,
      approve_link:    approveLink,
      status:          data.status,
    })
  } catch (e) {
    return c.json(500, { error: 'PayPal create order error: ' + e.message })
  }
})

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINT 2: POST /api/paypal/capture
// Body: { paypal_order_id, order_id }
// Called after customer approves payment in PayPal modal
// ══════════════════════════════════════════════════════════════════════════
routerAdd('POST', '/api/paypal/capture', (c) => {
  const body           = $apis.requestInfo(c).data
  const paypalOrderId  = body?.paypal_order_id
  const silgenOrderId  = body?.order_id

  if (!paypalOrderId || !silgenOrderId) {
    return c.json(400, { error: 'Missing paypal_order_id or order_id' })
  }

  // ── SANDBOX: simulate successful capture ──────────────────────────────
  if (paypalOrderId.startsWith('PAYPAL_TEST_')) {
    try {
      const order = $app.dao().findRecordById('sg_orders', silgenOrderId)
      const total = order.get('total_kes') || 0

      // Create payment record
      $app.dao().saveRecord(
        new Record($app.dao().findCollectionByNameOrId('sg_payments'), {
          order_id:         silgenOrderId,
          user_id:          order.get('user_id') || '',
          method:           'paypal',
          amount_kes:       total,
          currency:         'USD',
          amount_foreign:   Number(body.amount_usd || 0),
          status:           'success',
          gateway_ref:      paypalOrderId,
          gateway_response: { sandbox: true, paypal_order_id: paypalOrderId },
        })
      )

      // Update order
      order.set('payment_status', 'paid')
      order.set('status',         'confirmed')
      $app.dao().saveRecord(order)

      // Loyalty
      const userId = order.get('user_id')
      const earned = Math.floor(total)
      if (userId && earned > 0) {
        try {
          const user = $app.dao().findRecordById('sg_users', userId)
          const pts  = (user.get('loyalty_points') || 0) + earned
          user.set('loyalty_points', pts)
          $app.dao().saveRecord(user)

          $app.dao().saveRecord(
            new Record($app.dao().findCollectionByNameOrId('sg_loyalty_transactions'), {
              user_id:       userId,
              order_id:      silgenOrderId,
              type:          'earn',
              points:        earned,
              balance_after: pts,
              description:   'Earned from PayPal order ' + order.get('ref'),
            })
          )

          $app.dao().saveRecord(
            new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
              user_id: userId,
              type:    'payment',
              title:   'PayPal payment confirmed ✓',
              body:    'Your PayPal payment was successful. Order ' + order.get('ref') + ' confirmed.',
              link:    '/orders',
              is_read: false,
            })
          )
        } catch (e) { /* best effort */ }
      }

      return c.json(200, {
        success:  true,
        sandbox:  true,
        status:   'COMPLETED',
        order_id: silgenOrderId,
        ref:      order.get('ref'),
      })
    } catch (e) {
      return c.json(500, { error: 'Sandbox capture error: ' + e.message })
    }
  }

  // ── LIVE: capture real PayPal order ───────────────────────────────────
  try {
    const token = getPayPalToken()
    const res   = $http.send({
      url:     PAYPAL_BASE + '/v2/checkout/orders/' + paypalOrderId + '/capture',
      method:  'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'application/json',
      },
      body:    '{}',
      timeout: 30,
    })

    const data   = JSON.parse(res.raw)
    const status = data?.status

    if (status !== 'COMPLETED') {
      return c.json(400, { error: 'PayPal capture not completed', status, raw: data })
    }

    const capture      = data?.purchase_units?.[0]?.payments?.captures?.[0]
    const captureId    = capture?.id
    const amountValue  = capture?.amount?.value
    const currencyCode = capture?.amount?.currency_code || 'USD'

    // Update order and create payment record
    const order = $app.dao().findRecordById('sg_orders', silgenOrderId)

    $app.dao().saveRecord(
      new Record($app.dao().findCollectionByNameOrId('sg_payments'), {
        order_id:         silgenOrderId,
        user_id:          order.get('user_id') || '',
        method:           'paypal',
        amount_kes:       order.get('total_kes') || 0,
        currency:         currencyCode,
        amount_foreign:   Number(amountValue || 0),
        status:           'success',
        gateway_ref:      captureId,
        gateway_response: data,
      })
    )

    order.set('payment_status', 'paid')
    order.set('status',         'confirmed')
    $app.dao().saveRecord(order)

    // Loyalty
    const userId = order.get('user_id')
    const total  = order.get('total_kes') || 0
    const earned = Math.floor(total)
    if (userId && earned > 0) {
      try {
        const user = $app.dao().findRecordById('sg_users', userId)
        const pts  = (user.get('loyalty_points') || 0) + earned
        user.set('loyalty_points', pts)
        $app.dao().saveRecord(user)

        $app.dao().saveRecord(
          new Record($app.dao().findCollectionByNameOrId('sg_loyalty_transactions'), {
            user_id:       userId,
            order_id:      silgenOrderId,
            type:          'earn',
            points:        earned,
            balance_after: pts,
            description:   'Earned from PayPal order ' + order.get('ref'),
          })
        )

        $app.dao().saveRecord(
          new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
            user_id: userId,
            type:    'payment',
            title:   'PayPal payment confirmed ✓',
            body:    'Payment of ' + currencyCode + ' ' + amountValue + ' received. Order confirmed.',
            link:    '/orders',
            is_read: false,
          })
        )
      } catch (e) { /* best effort */ }
    }

    return c.json(200, {
      success:    true,
      status:     'COMPLETED',
      capture_id: captureId,
      order_id:   silgenOrderId,
      ref:        order.get('ref'),
    })
  } catch (e) {
    return c.json(500, { error: 'PayPal capture error: ' + e.message })
  }
})

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINT 3: POST /api/paypal/webhook
// PayPal sends async events (refunds, disputes, etc.)
// ══════════════════════════════════════════════════════════════════════════
routerAdd('POST', '/api/paypal/webhook', (c) => {
  let body
  try {
    body = $apis.requestInfo(c).data
  } catch (e) {
    return c.json(200, { received: true })
  }

  try {
    const eventType = body?.event_type
    const resource  = body?.resource

    if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      const captureId = resource?.id
      if (captureId) {
        const records = $app.dao().findRecordsByFilter(
          'sg_payments',
          `gateway_ref = "${captureId}"`,
          '', 1, 0
        )
        if (records.length > 0) {
          const payment = records[0]
          payment.set('status', 'refunded')
          $app.dao().saveRecord(payment)

          const orderId = payment.get('order_id')
          if (orderId) {
            const order = $app.dao().findRecordById('sg_orders', orderId)
            order.set('payment_status', 'refunded')
            order.set('status',         'returned')
            $app.dao().saveRecord(order)
          }
        }
      }
    }
  } catch (e) { /* best effort */ }

  return c.json(200, { received: true })
})