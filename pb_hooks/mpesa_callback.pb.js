/// <reference path="../pb_data/types.d.ts" />

// ─── M-Pesa C2B Callback Processor ────────────────────────────────────────
// This file handles the Daraja C2B (Customer to Business) callbacks.
// Safaricom calls these endpoints when a customer pays via:
//   - M-Pesa menu → Lipa na M-Pesa → Pay Bill
//   - USSD *844#
//
// Registration URLs to set on Daraja dashboard:
//   Validation URL:   https://fieldtrack-kenya.fly.dev/api/mpesa/c2b/validation
//   Confirmation URL: https://fieldtrack-kenya.fly.dev/api/mpesa/c2b/confirmation
//
// NOTE: mpesa_paybill.pb.js handles the paybill-specific logic.
// This file handles the raw Daraja C2B webhook format + STK callback format.

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINT 1: POST /api/mpesa/c2b/validation
// Safaricom asks permission before processing. Always say yes.
// ══════════════════════════════════════════════════════════════════════════
routerAdd('POST', '/api/mpesa/c2b/validation', (c) => {
  return c.json(200, {
    ResultCode: 0,
    ResultDesc: 'Accepted',
  })
})

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINT 2: POST /api/mpesa/c2b/confirmation
// Safaricom confirms money has moved. Match to order, update everything.
// ══════════════════════════════════════════════════════════════════════════
routerAdd('POST', '/api/mpesa/c2b/confirmation', (c) => {
  let body
  try {
    body = $apis.requestInfo(c).data
  } catch (e) {
    return c.json(200, { ResultCode: 0, ResultDesc: 'Accepted' })
  }

  try {
    const transId     = body?.TransID          || ''
    const transAmount = Number(body?.TransAmount || 0)
    const billRef     = (body?.BillRefNumber   || '').trim().toUpperCase()
    const msisdn      = body?.MSISDN            || ''
    const firstName   = body?.FirstName         || ''
    const middleName  = body?.MiddleName        || ''
    const lastName    = body?.LastName          || ''
    const transTime   = body?.TransTime         || ''
    const orgBal      = body?.OrgAccountBalance || ''

    // ── Try to find matching order ───────────────────────────────────────
    let matchedOrder = null

    // Strategy 1: exact ref match (e.g. SG-2025-123456)
    if (billRef) {
      try {
        const orders = $app.dao().findRecordsByFilter(
          'sg_orders',
          `ref = "${billRef}"`,
          '', 1, 0
        )
        if (orders.length > 0) matchedOrder = orders[0]
      } catch (e) { /* not found */ }
    }

    // Strategy 2: partial match on last 6 digits
    if (!matchedOrder && billRef.length >= 6) {
      try {
        const suffix = billRef.slice(-6)
        const orders = $app.dao().findRecordsByFilter(
          'sg_orders',
          `ref ~ "${suffix}" && payment_status = "pending"`,
          '-created', 3, 0
        )
        if (orders.length > 0) matchedOrder = orders[0]
      } catch (e) { /* not found */ }
    }

    // Strategy 3: match by phone number on most recent pending order
    if (!matchedOrder && msisdn) {
      try {
        // Find user by phone
        const users = $app.dao().findRecordsByFilter(
          'sg_users',
          `phone ~ "${msisdn.slice(-9)}"`,
          '', 1, 0
        )
        if (users.length > 0) {
          const userId = users[0].id
          const orders = $app.dao().findRecordsByFilter(
            'sg_orders',
            `user_id = "${userId}" && payment_status = "pending"`,
            '-created', 1, 0
          )
          if (orders.length > 0) matchedOrder = orders[0]
        }
      } catch (e) { /* not found */ }
    }

    // ── Save payment record ──────────────────────────────────────────────
    const paymentData = {
      method:           'mpesa_paybill',
      amount_kes:       transAmount,
      currency:         'KES',
      status:           matchedOrder ? 'success' : 'pending',
      gateway_ref:      transId,
      phone_used:       msisdn,
      gateway_response: {
        ...body,
        matched_order: matchedOrder ? matchedOrder.get('ref') : null,
        customer_name: [firstName, middleName, lastName].filter(Boolean).join(' '),
      },
    }

    if (matchedOrder) {
      paymentData.order_id = matchedOrder.id
      paymentData.user_id  = matchedOrder.get('user_id') || ''
    }

    $app.dao().saveRecord(
      new Record($app.dao().findCollectionByNameOrId('sg_payments'), paymentData)
    )

    // ── Update order if matched ──────────────────────────────────────────
    if (matchedOrder) {
      const orderTotal = matchedOrder.get('total_kes') || 0
      const userId     = matchedOrder.get('user_id')
      const orderRef   = matchedOrder.get('ref')

      if (transAmount >= orderTotal) {
        // Full payment
        matchedOrder.set('payment_status', 'paid')
        matchedOrder.set('status',         'confirmed')
        $app.dao().saveRecord(matchedOrder)

        // Loyalty points — 1 pt per KES 1
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
                description:   `Earned from order ${orderRef} via M-Pesa paybill`,
              })
            )
          } catch (e) { /* best effort */ }
        }

        // Notification
        if (userId) {
          try {
            $app.dao().saveRecord(
              new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
                user_id: userId,
                type:    'payment',
                title:   '✅ M-Pesa payment received',
                body:    `KES ${transAmount} received via M-Pesa. Order ${orderRef} confirmed. Receipt: ${transId}`,
                link:    '/orders',
                is_read: false,
              })
            )
          } catch (e) { /* best effort */ }
        }

        // Referral reward — check if first order
        if (userId) {
          try {
            const allOrders = $app.dao().findRecordsByFilter(
              'sg_orders',
              `user_id = "${userId}" && payment_status = "paid"`,
              '', 2, 0
            )
            if (allOrders.length === 1) {
              // This is their first paid order — check referral
              const user = $app.dao().findRecordById('sg_users', userId)
              const referredBy = user.get('referred_by')

              if (referredBy) {
                // Reward referred user: 200 pts
                user.set('loyalty_points', (user.get('loyalty_points') || 0) + 200)
                $app.dao().saveRecord(user)

                $app.dao().saveRecord(
                  new Record($app.dao().findCollectionByNameOrId('sg_loyalty_transactions'), {
                    user_id:       userId,
                    order_id:      matchedOrder.id,
                    type:          'earn',
                    points:        200,
                    balance_after: user.get('loyalty_points'),
                    description:   'Referral bonus — first order reward',
                  })
                )

                // Reward referrer: 500 pts
                try {
                  const referrer = $app.dao().findRecordById('sg_users', referredBy)
                  const refPts   = (referrer.get('loyalty_points') || 0) + 500
                  referrer.set('loyalty_points', refPts)
                  $app.dao().saveRecord(referrer)

                  $app.dao().saveRecord(
                    new Record($app.dao().findCollectionByNameOrId('sg_loyalty_transactions'), {
                      user_id:       referredBy,
                      order_id:      matchedOrder.id,
                      type:          'earn',
                      points:        500,
                      balance_after: refPts,
                      description:   `Referral reward — ${user.get('name')} placed first order`,
                    })
                  )

                  // Update referral record
                  const referrals = $app.dao().findRecordsByFilter(
                    'sg_referrals',
                    `referrer_id = "${referredBy}" && referred_id = "${userId}"`,
                    '', 1, 0
                  )
                  if (referrals.length > 0) {
                    referrals[0].set('status',              'rewarded')
                    referrals[0].set('reward_points',       500)
                    referrals[0].set('qualifying_order_id', matchedOrder.id)
                    referrals[0].set('rewarded_at',         new Date().toISOString())
                    $app.dao().saveRecord(referrals[0])
                  }

                  $app.dao().saveRecord(
                    new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
                      user_id: referredBy,
                      type:    'loyalty',
                      title:   '🎉 Referral reward — 500 points!',
                      body:    `${user.get('name')} just placed their first order. You earned 500 loyalty points!`,
                      link:    '/loyalty',
                      is_read: false,
                    })
                  )
                } catch (e) { /* referrer update best effort */ }
              }
            }
          } catch (e) { /* referral check best effort */ }
        }

      } else {
        // Underpayment
        matchedOrder.set('notes',
          (matchedOrder.get('notes') || '') +
          ` [PARTIAL: KES ${transAmount} of KES ${orderTotal} paid via ${transId}]`
        )
        $app.dao().saveRecord(matchedOrder)

        if (userId) {
          $app.dao().saveRecord(
            new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
              user_id: userId,
              type:    'payment',
              title:   '⚠️ Partial payment received',
              body:    `KES ${transAmount} received but order total is KES ${orderTotal}. Please pay the remaining KES ${orderTotal - transAmount}.`,
              link:    '/orders',
              is_read: false,
            })
          )
        }
      }
    }

  } catch (e) {
    // Always return 200 — never let Safaricom retry unnecessarily
  }

  return c.json(200, { ResultCode: 0, ResultDesc: 'Accepted' })
})

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINT 3: POST /api/mpesa/stk/callback
// Safaricom calls this after STK Push (customer entered PIN or cancelled)
// This is the same as the callback in mpesa_stk.pb.js but registered
// as the Daraja callback URL format
// ══════════════════════════════════════════════════════════════════════════
routerAdd('POST', '/api/mpesa/stk/callback', (c) => {
  let raw
  try {
    raw = $apis.requestInfo(c).data
  } catch (e) {
    return c.json(200, { ResultCode: 0, ResultDesc: 'Accepted' })
  }

  try {
    const stk        = raw?.Body?.stkCallback
    const resultCode = stk?.ResultCode
    const checkoutId = stk?.CheckoutRequestID

    if (!checkoutId) return c.json(200, { ResultCode: 0, ResultDesc: 'Accepted' })

    // Find payment record
    let payment = null
    try {
      const records = $app.dao().findRecordsByFilter(
        'sg_payments',
        `mpesa_checkout_id = "${checkoutId}"`,
        '', 1, 0
      )
      if (records.length > 0) payment = records[0]
    } catch (e) { /* not found */ }

    if (resultCode === 0) {
      // SUCCESS
      const items      = stk?.CallbackMetadata?.Item || []
      const getMeta    = (name) => items.find(i => i.Name === name)?.Value
      const mpesaRef   = getMeta('MpesaReceiptNumber')
      const amount     = getMeta('Amount')
      const phone      = getMeta('PhoneNumber')

      if (payment) {
        payment.set('status',           'success')
        payment.set('gateway_ref',      mpesaRef || '')
        payment.set('gateway_response', stk)
        $app.dao().saveRecord(payment)

        const orderId = payment.get('order_id')
        if (orderId) {
          const order  = $app.dao().findRecordById('sg_orders', orderId)
          const userId = order.get('user_id')
          const total  = order.get('total_kes') || 0

          order.set('payment_status', 'paid')
          order.set('status',         'confirmed')
          $app.dao().saveRecord(order)

          // Loyalty
          const earned = Math.floor(total)
          if (userId && earned > 0) {
            try {
              const user = $app.dao().findRecordById('sg_users', userId)
              const pts  = (user.get('loyalty_points') || 0) + earned
              user.set('loyalty_points', pts)
              $app.dao().saveRecord(user)

              $app.dao().saveRecord(
                new Record($app.dao().findCollectionByNameOrId('sg_loyalty_transactions'), {
                  user_id: userId, order_id: orderId, type: 'earn',
                  points: earned, balance_after: pts,
                  description: `Earned from STK order ${order.get('ref')}`,
                })
              )

              $app.dao().saveRecord(
                new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
                  user_id: userId, type: 'payment',
                  title: '✅ M-Pesa STK payment confirmed',
                  body: `KES ${total} received. Order ${order.get('ref')} confirmed. Receipt: ${mpesaRef}. You earned ${earned} loyalty points!`,
                  link: '/orders', is_read: false,
                })
              )
            } catch (e) { /* best effort */ }
          }
        }
      }

    } else {
      // FAILED / CANCELLED
      if (payment) {
        payment.set('status',           'failed')
        payment.set('failure_reason',   stk?.ResultDesc || 'Cancelled')
        payment.set('gateway_response', stk)
        $app.dao().saveRecord(payment)

        const orderId = payment.get('order_id')
        if (orderId) {
          const order  = $app.dao().findRecordById('sg_orders', orderId)
          const userId = order.get('user_id')
          order.set('payment_status', 'failed')
          $app.dao().saveRecord(order)

          if (userId) {
            $app.dao().saveRecord(
              new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
                user_id: userId, type: 'payment',
                title: '❌ M-Pesa payment failed',
                body: stk?.ResultDesc === 'Request cancelled by user'
                  ? 'You cancelled the M-Pesa payment. Go back to checkout to try again.'
                  : 'Your M-Pesa payment was not successful. Please try again.',
                link: '/checkout', is_read: false,
              })
            )
          }
        }
      }
    }

  } catch (e) { /* never block Safaricom */ }

  return c.json(200, { ResultCode: 0, ResultDesc: 'Accepted' })
})

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINT 4: POST /api/mpesa/register-urls
// Admin tool — register C2B URLs with Safaricom Daraja
// Call this ONCE after deploying to register your callback URLs
// ══════════════════════════════════════════════════════════════════════════
routerAdd('POST', '/api/mpesa/register-urls', (c) => {
  const info = $apis.requestInfo(c)
  if (!info.admin) {
    return c.json(403, { error: 'Admin access required' })
  }

  const MPESA_CONSUMER_KEY    = $os.getenv('MPESA_CONSUMER_KEY')    || 'TEST_KEY'
  const MPESA_CONSUMER_SECRET = $os.getenv('MPESA_CONSUMER_SECRET') || 'TEST_SECRET'
  const MPESA_SHORTCODE       = $os.getenv('MPESA_SHORTCODE')       || '174379'
  const MPESA_ENV             = $os.getenv('MPESA_ENV')             || 'sandbox'

  const MPESA_BASE = MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke'

  if (MPESA_CONSUMER_KEY === 'TEST_KEY') {
    return c.json(200, {
      sandbox: true,
      message: 'Sandbox mode — no real URL registration needed',
      validation_url:   'https://fieldtrack-kenya.fly.dev/api/mpesa/c2b/validation',
      confirmation_url: 'https://fieldtrack-kenya.fly.dev/api/mpesa/c2b/confirmation',
    })
  }

  try {
    const credentials = $security.base64Encode(MPESA_CONSUMER_KEY + ':' + MPESA_CONSUMER_SECRET)
    const tokenRes    = $http.send({
      url:     MPESA_BASE + '/oauth/v1/generate?grant_type=client_credentials',
      method:  'GET',
      headers: { 'Authorization': 'Basic ' + credentials },
      timeout: 10,
    })
    const token = JSON.parse(tokenRes.raw).access_token

    const regRes = $http.send({
      url:     MPESA_BASE + '/mpesa/c2b/v1/registerurl',
      method:  'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        ShortCode:       MPESA_SHORTCODE,
        ResponseType:    'Completed',
        ConfirmationURL: 'https://fieldtrack-kenya.fly.dev/api/mpesa/c2b/confirmation',
        ValidationURL:   'https://fieldtrack-kenya.fly.dev/api/mpesa/c2b/validation',
      }),
      timeout: 15,
    })

    return c.json(200, { success: true, response: JSON.parse(regRes.raw) })
  } catch (e) {
    return c.json(500, { error: e.message })
  }
})