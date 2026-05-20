/// <reference path="../pb_data/types.d.ts" />

const WA_NUM_ID = $os.getenv('VITE_WA_PHONE_NUMBER_ID') || 'TEST_WA_ID'
const WA_TOKEN  = $os.getenv('VITE_WA_ACCESS_TOKEN')    || 'TEST_WA_TOKEN'
const WA_URL    = 'https://graph.facebook.com/v19.0'

function waPhone(raw) {
  if (!raw) return null
  const d = String(raw).replace(/\D/g, '')
  if (d.startsWith('254') && d.length === 12) return d
  if (d.startsWith('0')   && d.length === 10) return '254' + d.slice(1)
  if (d.startsWith('7')   && d.length === 9)  return '254' + d
  if (d.startsWith('1')   && d.length === 9)  return '254' + d
  if (d.length >= 10) return d
  return null
}

function sendWA(phone, payload) {
  const p = waPhone(phone)
  if (!p) return { success: false, error: 'Invalid phone' }
  if (WA_NUM_ID === 'TEST_WA_ID') {
    console.log('[WA SANDBOX →', p, ']:', JSON.stringify(payload).slice(0, 150))
    return { success: true, sandbox: true, phone: p }
  }
  try {
    const res = $http.send({
      url: `${WA_URL}/${WA_NUM_ID}/messages`, method: 'POST',
      headers: { 'Authorization': 'Bearer ' + WA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }), timeout: 10,
    })
    const data = JSON.parse(res.raw)
    return { success: true, wamid: data?.messages?.[0]?.id }
  } catch(e) { return { success: false, error: e.message } }
}

function logWA(userId, phone, template, payload, result) {
  try {
    $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_whatsapp_logs'), {
      user_id: userId || '', phone: phone || '', template,
      payload_json: payload, status: result.success ? 'sent' : 'failed',
      wamid: result.wamid || '', error: result.error || '', retry_count: 0,
    }))
  } catch(e) {}
}

function waSendOrderConfirm(userId, phone, name, orderRef, total, payMethod, itemCount) {
  const payload = { to: waPhone(phone), type: 'text', text: { body: `✅ *Order Confirmed — SILGEN*\n\nHi ${name || 'Customer'}!\n\nYour order *${orderRef}* has been confirmed.\n\n📦 ${itemCount} item(s)\n💰 Total: KES ${total}\n💳 Payment: ${payMethod}\n\nThank you for shopping with SILGEN! 🛍️` } }
  const r = sendWA(phone, payload); logWA(userId, phone, 'order_confirmation', payload, r); return r
}

function waSendPaymentFailed(userId, phone, name, orderRef, total, reason) {
  const payload = { to: waPhone(phone), type: 'text', text: { body: `❌ *Payment Failed — SILGEN*\n\nHi ${name || 'Customer'},\n\nPayment for order *${orderRef}* (KES ${total}) failed.\n\n*Reason:* ${reason || 'Payment cancelled'}\n\n👉 Retry: https://silgen.vercel.app/checkout` } }
  const r = sendWA(phone, payload); logWA(userId, phone, 'payment_failed', payload, r); return r
}

function waSendShipped(userId, phone, name, orderRef, trackingCode, estimatedDate) {
  const payload = { to: waPhone(phone), type: 'text', text: { body: `🚚 *Order Shipped — SILGEN*\n\n${name || 'Customer'}, your order *${orderRef}* is on its way!\n\n📍 Tracking: ${trackingCode || 'Updating soon'}\n📅 ETA: ${estimatedDate || '24-48 hours'}\n\nTrack: https://silgen.vercel.app/orders` } }
  const r = sendWA(phone, payload); logWA(userId, phone, 'order_shipped', payload, r); return r
}

function waSendOutForDelivery(userId, phone, name, orderRef, riderName, riderPhone) {
  const payload = { to: waPhone(phone), type: 'text', text: { body: `🏍️ *Out for Delivery — SILGEN*\n\n${name || 'Customer'}, your order *${orderRef}* is being delivered NOW!\n\n🚴 Rider: ${riderName || 'Our agent'}\n📞 ${riderPhone || 'Will call you'}\n\nPlease be available to receive. 😊` } }
  const r = sendWA(phone, payload); logWA(userId, phone, 'out_for_delivery', payload, r); return r
}

function waSendDelivered(userId, phone, name, orderRef, total, loyaltyEarned) {
  const payload = { to: waPhone(phone), type: 'text', text: { body: `✅ *Delivered! — SILGEN*\n\n${name || 'Customer'}, order *${orderRef}* delivered!\n\n⭐ You earned *${loyaltyEarned || 0} loyalty points*\n\n💬 Leave a review: https://silgen.vercel.app/orders\n\nThank you! 🛍️` } }
  const r = sendWA(phone, payload); logWA(userId, phone, 'order_delivered', payload, r); return r
}

function waSendAbandonedCart(userId, phone, name, cartTotal, itemCount) {
  const payload = { to: waPhone(phone), type: 'text', text: { body: `🛒 *You forgot something! — SILGEN*\n\n${name || 'there'}, you left *${itemCount} item(s)* worth *KES ${cartTotal}* in your cart.\n\n👉 Complete order: https://silgen.vercel.app/checkout\n\n💡 Use *SAVE10* for 10% off!` } }
  const r = sendWA(phone, payload); logWA(userId, phone, 'abandoned_cart', payload, r); return r
}

function waSendSubReminder(userId, phone, name, amount, nextDate, planName) {
  const payload = { to: waPhone(phone), type: 'text', text: { body: `📅 *Subscription Reminder — SILGEN*\n\n${name || 'Customer'}, your *${planName || 'subscription'}* renews tomorrow.\n\n💰 KES ${amount} on ${nextDate}\n\nEnsure M-Pesa balance is sufficient.\n\nManage: https://silgen.vercel.app/subscriptions` } }
  const r = sendWA(phone, payload); logWA(userId, phone, 'subscription_reminder', payload, r); return r
}

function waSendSubFailed(userId, phone, name, amount, attemptNum, planName) {
  const payload = { to: waPhone(phone), type: 'text', text: { body: `⚠️ *Subscription Payment Failed — SILGEN*\n\n${name || 'Customer'}, KES ${amount} charge for *${planName || 'subscription'}* failed (attempt ${attemptNum}/3).\n\n${attemptNum < 3 ? 'We will retry. Ensure M-Pesa has sufficient balance.' : 'Subscription cancelled after 3 failures.'}\n\nManage: https://silgen.vercel.app/subscriptions` } }
  const r = sendWA(phone, payload); logWA(userId, phone, 'subscription_failed', payload, r); return r
}

function waSendGiftSender(userId, phone, senderName, recipientName, orderRef, status, currency, amount) {
  const msgs = { confirmed: '✅ Confirmed', processing: '📦 Being packed', shipped: '🚚 Shipped', out_for_delivery: '🏍️ Out for delivery!', delivered: '✅ Delivered!' }
  const payload = { to: waPhone(phone), type: 'text', text: { body: `🎁 *Gift Update — SILGEN*\n\n${senderName || 'Hi'}, your gift to *${recipientName}* (${orderRef}):\n\n${msgs[status] || status}\n💰 ${currency || 'KES'} ${amount}\n\nTrack: https://silgen.vercel.app/gift-tracking/${orderRef}` } }
  const r = sendWA(phone, payload); logWA(userId, phone, 'gift_sender_update', payload, r); return r
}

function waSendGiftRecipient(phone, recipientName, senderName, giftMessage, orderRef) {
  const payload = { to: waPhone(phone), type: 'text', text: { body: `🎁 *You have a gift! — SILGEN*\n\n${recipientName || 'Hi'}, *${senderName || 'Someone'}* sent you a gift! 🎉\n\n💌 "${giftMessage || 'Enjoy your gift!'}"\n\nTrack: https://silgen.vercel.app/gift-tracking/${orderRef}` } }
  const r = sendWA(phone, payload); logWA('', phone, 'gift_recipient_notify', payload, r); return r
}

// ── Auto-trigger on order paid ─────────────────────────────────────────────
onRecordUpdateRequest((e) => {
  e.next()
  const record = e.record
  if (record.get('payment_status') !== 'paid' || record.get('whatsapp_sent')) return
  try {
    const userId = record.get('user_id')
    const ref    = record.get('ref')
    const total  = record.get('total_kes') || 0
    const method = record.get('payment_method') || 'M-Pesa'
    const isGift = record.get('is_gift')
    let phone = '', name = '', user = null
    if (userId) {
      try { user = $app.dao().findRecordById('sg_users', userId); phone = user.get('phone') || ''; name = user.get('name') || '' } catch(e) {}
    }
    let itemCount = 1
    try { const items = $app.dao().findRecordsByFilter('sg_order_items', `order_id = "${record.id}"`, '', 20, 0); itemCount = items.length || 1 } catch(e) {}
    if (phone && (user?.get('whatsapp_opt_in') || WA_NUM_ID === 'TEST_WA_ID')) {
      waSendOrderConfirm(userId, phone, name, ref, total, method, itemCount)
    }
    if (isGift) {
      const rPhone = record.get('gift_recipient_phone')
      const rName  = record.get('gift_recipient_name')
      const gMsg   = record.get('gift_message')
      if (rPhone) waSendGiftRecipient(rPhone, rName, name, gMsg, ref)
      if (phone)  waSendGiftSender(userId, phone, name, rName, ref, 'confirmed', 'KES', total)
    }
    record.set('whatsapp_sent', true)
    $app.dao().saveRecord(record)
  } catch(e) {}
}, 'sg_orders')

// ── Auto-trigger on status changes ────────────────────────────────────────
onRecordUpdateRequest((e) => {
  e.next()
  const record = e.record
  const status = record.get('status')
  const userId = record.get('user_id')
  const ref    = record.get('ref')
  const isGift = record.get('is_gift')
  if (!['shipped', 'out_for_delivery', 'delivered'].includes(status)) return
  try {
    let phone = '', name = '', user = null
    if (userId) {
      try { user = $app.dao().findRecordById('sg_users', userId); phone = user.get('phone') || ''; name = user.get('name') || '' } catch(e) {}
    }
    const shouldSend = phone && (user?.get('whatsapp_opt_in') || WA_NUM_ID === 'TEST_WA_ID')
    if (status === 'shipped') {
      if (shouldSend) waSendShipped(userId, phone, name, ref, record.get('tracking_code') || '', record.get('estimated_delivery') || '')
      if (isGift && phone) waSendGiftSender(userId, phone, name, record.get('gift_recipient_name'), ref, 'shipped', 'KES', record.get('total_kes'))
    }
    if (status === 'out_for_delivery') {
      let rName = '', rPhone = ''
      try {
        const tr = $app.dao().findRecordsByFilter('sg_delivery_tracking', `order_id = "${record.id}"`, '-created', 1, 0)
        if (tr.length > 0 && tr[0].get('rider_id')) {
          const rider = $app.dao().findRecordById('sg_admins', tr[0].get('rider_id'))
          rName = rider.get('name') || ''; rPhone = rider.get('phone') || ''
        }
      } catch(e) {}
      if (shouldSend) waSendOutForDelivery(userId, phone, name, ref, rName, rPhone)
      if (isGift && phone) waSendGiftSender(userId, phone, name, record.get('gift_recipient_name'), ref, 'out_for_delivery', 'KES', record.get('total_kes'))
    }
    if (status === 'delivered') {
      const total  = record.get('total_kes') || 0
      if (shouldSend) waSendDelivered(userId, phone, name, ref, total, Math.floor(total))
      if (isGift && phone) waSendGiftSender(userId, phone, name, record.get('gift_recipient_name'), ref, 'delivered', 'KES', total)
    }
  } catch(e) {}
}, 'sg_orders')

// ── Admin manual send ─────────────────────────────────────────────────────
routerAdd('POST', '/api/whatsapp/send', (c) => {
  const info = $apis.requestInfo(c)
  if (!info.admin) return c.json(403, { error: 'Admin access required' })
  const { phone, message, user_id } = info.data
  if (!phone || !message) return c.json(400, { error: 'Missing phone or message' })
  const payload = { to: waPhone(phone), type: 'text', text: { body: message } }
  const result  = sendWA(phone, payload)
  logWA(user_id || '', phone, 'admin_manual', payload, result)
  return c.json(result.success ? 200 : 500, result)
})

routerAdd('GET', '/api/whatsapp/status', (c) => {
  return c.json(200, {
    configured: WA_NUM_ID !== 'TEST_WA_ID', sandbox: WA_NUM_ID === 'TEST_WA_ID',
    phone_number_id: WA_NUM_ID === 'TEST_WA_ID' ? 'Not configured' : WA_NUM_ID.slice(0, 6) + '...',
    message: WA_NUM_ID === 'TEST_WA_ID' ? 'WhatsApp in sandbox mode. Set VITE_WA_PHONE_NUMBER_ID and VITE_WA_ACCESS_TOKEN to go live.' : 'WhatsApp configured and ready.',
    templates: ['order_confirmation','payment_failed','order_shipped','out_for_delivery','order_delivered','abandoned_cart','subscription_reminder','subscription_failed','gift_sender_update','gift_recipient_notify'],
  })
})