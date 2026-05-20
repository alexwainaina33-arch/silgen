/// <reference path="../pb_data/types.d.ts" />

const STK_CONSUMER_KEY    = $os.getenv('MPESA_CONSUMER_KEY')    || 'TEST_CONSUMER_KEY'
const STK_CONSUMER_SECRET = $os.getenv('MPESA_CONSUMER_SECRET') || 'TEST_CONSUMER_SECRET'
const STK_SHORTCODE       = $os.getenv('MPESA_SHORTCODE')       || '174379'
const STK_PASSKEY         = $os.getenv('MPESA_PASSKEY')         || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'
const STK_ENV             = $os.getenv('MPESA_ENV')             || 'sandbox'
const STK_APP_URL         = $os.getenv('VITE_APP_URL')          || 'https://silgen.vercel.app'
const STK_BASE            = STK_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'

function getStkToken() {
  const creds = $security.base64Encode(STK_CONSUMER_KEY + ':' + STK_CONSUMER_SECRET)
  const res   = $http.send({ url: STK_BASE + '/oauth/v1/generate?grant_type=client_credentials', method: 'GET', headers: { 'Authorization': 'Basic ' + creds }, timeout: 10 })
  if (res.statusCode !== 200) throw new Error('Token fetch failed: ' + res.raw)
  return JSON.parse(res.raw).access_token
}

function getStkPassword() {
  const now = new Date()
  const ts  = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0')
  return { password: $security.base64Encode(STK_SHORTCODE + STK_PASSKEY + ts), timestamp: ts }
}

function normPhone(raw) {
  const d = String(raw).replace(/\D/g, '')
  if (d.startsWith('254') && d.length === 12) return d
  if (d.startsWith('0')   && d.length === 10) return '254' + d.slice(1)
  if (d.startsWith('7')   && d.length === 9)  return '254' + d
  if (d.startsWith('1')   && d.length === 9)  return '254' + d
  throw new Error('Invalid phone: ' + raw)
}

routerAdd('POST', '/api/mpesa/stk-push', (c) => {
  let body
  try { body = $apis.requestInfo(c).data } catch(e) { return c.json(400, { error: 'Invalid body' }) }

  const { phone, amount, order_id, ref } = body
  if (!phone || !amount || !order_id) return c.json(400, { error: 'Missing phone, amount or order_id' })

  let normalisedPhone
  try { normalisedPhone = normPhone(String(phone)) } catch(e) { return c.json(400, { error: e.message }) }

  const amountInt = Math.ceil(Number(amount))
  if (amountInt < 1) return c.json(400, { error: 'Amount must be at least KES 1' })

  if (STK_ENV === 'sandbox' && STK_CONSUMER_KEY === 'TEST_CONSUMER_KEY') {
    const fakeId = 'ws_CO_TEST_' + Date.now()
    try {
      $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_payments'), {
        order_id, user_id: body.user_id || '', method: 'mpesa_stk',
        amount_kes: amountInt, currency: 'KES', status: 'pending',
        mpesa_checkout_id: fakeId, phone_used: normalisedPhone,
        gateway_response: { sandbox: true },
      }))
    } catch(e) {}
    return c.json(200, { success: true, sandbox: true, CheckoutRequestID: fakeId, MerchantRequestID: 'MERCH_' + Date.now(), ResponseCode: '0', CustomerMessage: 'Success (SANDBOX)' })
  }

  try {
    const token = getStkToken()
    const { password, timestamp } = getStkPassword()
    const res = $http.send({
      url: STK_BASE + '/mpesa/stkpush/v1/processrequest', method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: STK_SHORTCODE, Password: password, Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline', Amount: amountInt,
        PartyA: normalisedPhone, PartyB: STK_SHORTCODE, PhoneNumber: normalisedPhone,
        CallBackURL: 'https://fieldtrack-kenya.fly.dev/api/mpesa/stk/callback',
        AccountReference: ref || order_id, TransactionDesc: 'SILGEN Order ' + (ref || order_id),
      }),
      timeout: 30,
    })
    const data = JSON.parse(res.raw)
    if (data.ResponseCode !== '0') return c.json(400, { error: data.ResponseDescription || data.errorMessage, raw: data })
    try {
      $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_payments'), {
        order_id, user_id: body.user_id || '', method: 'mpesa_stk',
        amount_kes: amountInt, currency: 'KES', status: 'pending',
        mpesa_checkout_id: data.CheckoutRequestID, phone_used: normalisedPhone, gateway_response: data,
      }))
    } catch(e) {}
    return c.json(200, { success: true, CheckoutRequestID: data.CheckoutRequestID, MerchantRequestID: data.MerchantRequestID, ResponseCode: data.ResponseCode, CustomerMessage: data.CustomerMessage })
  } catch(e) {
    return c.json(500, { error: 'STK error: ' + e.message })
  }
})

routerAdd('POST', '/api/mpesa/callback', (c) => {
  let raw
  try { raw = $apis.requestInfo(c).data } catch(e) { return c.json(200, { ResultCode: 0, ResultDesc: 'Accepted' }) }
  try {
    const stk        = raw?.Body?.stkCallback
    const resultCode = stk?.ResultCode
    const checkoutId = stk?.CheckoutRequestID
    if (!checkoutId) return c.json(200, { ResultCode: 0, ResultDesc: 'Accepted' })
    let payment = null
    try {
      const recs = $app.dao().findRecordsByFilter('sg_payments', `mpesa_checkout_id = "${checkoutId}"`, '', 1, 0)
      if (recs.length > 0) payment = recs[0]
    } catch(e) {}
    if (resultCode === 0) {
      const items    = stk?.CallbackMetadata?.Item || []
      const getMeta  = (name) => items.find(i => i.Name === name)?.Value
      const mpesaRef = getMeta('MpesaReceiptNumber')
      if (payment) {
        payment.set('status', 'success')
        payment.set('gateway_ref', mpesaRef || '')
        payment.set('gateway_response', stk)
        $app.dao().saveRecord(payment)
        const orderId = payment.get('order_id')
        if (orderId) {
          try {
            const order  = $app.dao().findRecordById('sg_orders', orderId)
            const userId = order.get('user_id')
            const total  = order.get('total_kes') || 0
            order.set('payment_status', 'paid')
            order.set('status', 'confirmed')
            $app.dao().saveRecord(order)
            const earned = Math.floor(total)
            if (userId && earned > 0) {
              try {
                const user = $app.dao().findRecordById('sg_users', userId)
                const pts  = (user.get('loyalty_points') || 0) + earned
                user.set('loyalty_points', pts)
                $app.dao().saveRecord(user)
                $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_loyalty_transactions'), {
                  user_id: userId, order_id: orderId, type: 'earn', points: earned, balance_after: pts,
                  description: 'Earned from STK order ' + order.get('ref'),
                }))
                $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
                  user_id: userId, type: 'payment', title: '✅ M-Pesa payment confirmed',
                  body: `KES ${total} received. Order ${order.get('ref')} confirmed. Receipt: ${mpesaRef}. You earned ${earned} pts!`,
                  link: '/orders', is_read: false,
                }))
              } catch(e) {}
            }
          } catch(e) {}
        }
      }
    } else {
      if (payment) {
        payment.set('status', 'failed')
        payment.set('failure_reason', stk?.ResultDesc || 'Cancelled')
        payment.set('gateway_response', stk)
        $app.dao().saveRecord(payment)
        const orderId = payment.get('order_id')
        if (orderId) {
          try {
            const order  = $app.dao().findRecordById('sg_orders', orderId)
            const userId = order.get('user_id')
            order.set('payment_status', 'failed')
            $app.dao().saveRecord(order)
            if (userId) {
              $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
                user_id: userId, type: 'payment', title: '❌ M-Pesa payment failed',
                body: 'Your M-Pesa payment was not successful. Please try again.',
                link: '/checkout', is_read: false,
              }))
            }
          } catch(e) {}
        }
      }
    }
  } catch(e) {}
  return c.json(200, { ResultCode: 0, ResultDesc: 'Accepted' })
})

routerAdd('GET', '/api/mpesa/status', (c) => {
  const checkoutId = c.queryParam('checkout_request_id')
  if (!checkoutId) return c.json(400, { error: 'Missing checkout_request_id' })

  if (checkoutId.startsWith('ws_CO_TEST_')) {
    const createdAt = parseInt(checkoutId.replace('ws_CO_TEST_', ''), 10)
    const elapsed   = Date.now() - createdAt
    if (elapsed < 8000) return c.json(200, { status: 'pending', message: 'Waiting for PIN (sandbox)' })
    try {
      const recs = $app.dao().findRecordsByFilter('sg_payments', `mpesa_checkout_id = "${checkoutId}"`, '', 1, 0)
      if (recs.length > 0 && recs[0].get('status') === 'pending') {
        const payment = recs[0]
        payment.set('status', 'success')
        payment.set('gateway_ref', 'SBX' + Date.now())
        $app.dao().saveRecord(payment)
        const orderId = payment.get('order_id')
        if (orderId) {
          const order  = $app.dao().findRecordById('sg_orders', orderId)
          const userId = order.get('user_id')
          const total  = order.get('total_kes') || 0
          order.set('payment_status', 'paid')
          order.set('status', 'confirmed')
          $app.dao().saveRecord(order)
          const earned = Math.floor(total)
          if (userId && earned > 0) {
            try {
              const user = $app.dao().findRecordById('sg_users', userId)
              const pts  = (user.get('loyalty_points') || 0) + earned
              user.set('loyalty_points', pts)
              $app.dao().saveRecord(user)
              $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_loyalty_transactions'), {
                user_id: userId, order_id: orderId, type: 'earn', points: earned, balance_after: pts,
                description: 'Earned from sandbox STK order ' + order.get('ref'),
              }))
              $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
                user_id: userId, type: 'payment', title: '✅ Payment confirmed ✓',
                body: `KES ${total} received. You earned ${earned} loyalty points!`,
                link: '/orders', is_read: false,
              }))
            } catch(e) {}
          }
        }
      }
    } catch(e) {}
    return c.json(200, { status: 'success', sandbox: true, message: 'SANDBOX: Payment auto-confirmed', mpesa_ref: 'SBX' + Date.now() })
  }

  try {
    const recs = $app.dao().findRecordsByFilter('sg_payments', `mpesa_checkout_id = "${checkoutId}"`, '', 1, 0)
    if (recs.length === 0) return c.json(200, { status: 'pending', message: 'Not yet confirmed' })
    const status = recs[0].get('status')
    if (status === 'success') return c.json(200, { status: 'success', mpesa_ref: recs[0].get('gateway_ref'), order_id: recs[0].get('order_id') })
    if (status === 'failed')  return c.json(200, { status: 'failed',  message: recs[0].get('failure_reason') || 'Failed' })
    return c.json(200, { status: 'pending', message: 'Waiting for confirmation' })
  } catch(e) {
    return c.json(500, { error: e.message })
  }
})

routerAdd('POST', '/api/mpesa/simulate-callback', (c) => {
  if (STK_ENV === 'production') return c.json(403, { error: 'Not available in production' })
  const body       = $apis.requestInfo(c).data
  const checkoutId = body?.checkout_request_id
  const result     = body?.result || 'success'
  if (!checkoutId) return c.json(400, { error: 'Missing checkout_request_id' })
  const fake = result === 'success'
    ? { Body: { stkCallback: { MerchantRequestID: 'M_' + Date.now(), CheckoutRequestID: checkoutId, ResultCode: 0, ResultDesc: 'Success', CallbackMetadata: { Item: [{ Name: 'Amount', Value: 100 }, { Name: 'MpesaReceiptNumber', Value: 'SBX' + Date.now() }, { Name: 'TransactionDate', Value: 20260510120000 }, { Name: 'PhoneNumber', Value: 254712345678 }] } } } }
    : { Body: { stkCallback: { MerchantRequestID: 'M_' + Date.now(), CheckoutRequestID: checkoutId, ResultCode: 1032, ResultDesc: 'Request cancelled by user.' } } }
  try {
    const res = $http.send({ url: 'https://fieldtrack-kenya.fly.dev/api/mpesa/callback', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fake), timeout: 10 })
    return c.json(200, { success: true, simulated: result, response: JSON.parse(res.raw) })
  } catch(e) {
    return c.json(500, { error: e.message })
  }
})