/// <reference path="../pb_data/types.d.ts" />

const WA_FLOW_NUM_ID      = $os.getenv('VITE_WA_PHONE_NUMBER_ID') || 'TEST_WA_ID'
const WA_FLOW_TOKEN       = $os.getenv('VITE_WA_ACCESS_TOKEN')    || 'TEST_WA_TOKEN'
const WA_FLOW_VERIFY      = $os.getenv('WA_VERIFY_TOKEN')         || 'silgen_webhook_verify'
const WA_FLOW_BASE        = 'https://graph.facebook.com/v19.0'

const flowSessions = {}

function flowReply(phone, text) {
  if (WA_FLOW_NUM_ID === 'TEST_WA_ID') { console.log(`[WA FLOW → ${phone}]: ${text.slice(0, 100)}`); return }
  try {
    $http.send({
      url: `${WA_FLOW_BASE}/${WA_FLOW_NUM_ID}/messages`, method: 'POST',
      headers: { 'Authorization': 'Bearer ' + WA_FLOW_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text, preview_url: false } }),
      timeout: 10,
    })
  } catch(e) { console.log('[WA] Reply error:', e.message) }
}

function getFlowSession(phone) {
  if (!flowSessions[phone]) {
    flowSessions[phone] = { state: 'idle', cart: [], userId: null, userName: null, address: null, lastSeen: Date.now() }
  }
  flowSessions[phone].lastSeen = Date.now()
  return flowSessions[phone]
}

function resetFlowSession(phone) {
  flowSessions[phone] = { state: 'idle', cart: [], userId: null, userName: null, address: null, lastSeen: Date.now() }
}

function processFlowMessage(phone, messageText) {
  const session = getFlowSession(phone)
  const text    = (messageText || '').trim().toLowerCase()

  if (!session.userId) {
    try {
      const users = $app.dao().findRecordsByFilter('sg_users', `phone ~ "${phone.slice(-9)}"`, '', 1, 0)
      if (users.length > 0) { session.userId = users[0].id; session.userName = users[0].get('name') || 'Customer' }
    } catch(e) {}
  }

  if (['hi','hello','hey','start','menu','shop','order','habari','hujambo'].includes(text)) {
    resetFlowSession(phone)
    const s = getFlowSession(phone)
    s.state = 'browsing'
    flowReply(phone, `🛍️ *Welcome to SILGEN!*\n\n${session.userName ? 'Hi ' + session.userName + '! ' : ''}Kenya\'s favourite online shop.\n\nReply with a number:\n\n1️⃣ Shop Products\n2️⃣ View My Orders\n3️⃣ My Loyalty Points\n4️⃣ Track Order\n5️⃣ Talk to Support\n\nOr visit: https://silgen.vercel.app`)
    return
  }

  if (['stop','cancel','quit','exit'].includes(text)) {
    resetFlowSession(phone)
    flowReply(phone, '✅ Session ended. Text *Hi* anytime to shop again! 👋')
    return
  }

  switch (session.state) {
    case 'browsing': {
      if (text === '1' || text.includes('shop')) {
        try {
          const cats = $app.dao().findRecordsByFilter('sg_categories', 'is_active = true && is_service = false', 'sort_order', 10, 0)
          let msg = `🛍️ *Browse Categories*\n\nReply with a number:\n\n`
          cats.forEach((cat, i) => { msg += `${i + 1}️⃣ ${cat.get('name_en')}\n` })
          msg += `\nOr type a product name to search.`
          session.state      = 'category_select'
          session.categories = cats.map(c => ({ id: c.id, name: c.get('name_en') }))
          flowReply(phone, msg)
        } catch(e) { flowReply(phone, 'Visit https://silgen.vercel.app to shop.') }
      } else if (text === '2') {
        if (!session.userId) {
          flowReply(phone, '📱 Register at: https://silgen.vercel.app/register')
        } else {
          try {
            const orders = $app.dao().findRecordsByFilter('sg_orders', `user_id = "${session.userId}"`, '-created', 3, 0)
            if (orders.length === 0) { flowReply(phone, 'No orders yet.\n\nText *1* to start shopping! 🛍️') }
            else {
              let msg = `📦 *Your Recent Orders*\n\n`
              orders.forEach(o => { msg += `📦 *${o.get('ref')}*\nKES ${o.get('total_kes')} — ${o.get('status')}\n\n` })
              msg += `Full history: https://silgen.vercel.app/orders`
              flowReply(phone, msg)
            }
          } catch(e) { flowReply(phone, 'Visit https://silgen.vercel.app/orders') }
        }
      } else if (text === '3') {
        if (!session.userId) { flowReply(phone, 'Register to view loyalty points.\nhttps://silgen.vercel.app/register') }
        else {
          try {
            const user = $app.dao().findRecordById('sg_users', session.userId)
            const pts  = user.get('loyalty_points') || 0
            flowReply(phone, `⭐ *Loyalty Points*\n\nBalance: *${pts} points*\nValue: KES ${Math.floor(pts / 100) * 50}\n\n(100 pts = KES 50)\n\nhttps://silgen.vercel.app/loyalty`)
          } catch(e) { flowReply(phone, 'Visit https://silgen.vercel.app/loyalty') }
        }
      } else if (text === '4') {
        flowReply(phone, '📦 Enter your order reference:\n(e.g. SG-2025-123456)')
        session.state = 'track_order'
      } else if (text === '5') {
        flowReply(phone, '💬 *Support*\n\n📞 +254700000000\n🌐 https://silgen.vercel.app\n📧 support@silgen.co.ke')
      } else {
        flowSearchProducts(phone, session, text)
      }
      break
    }
    case 'category_select': {
      const num = parseInt(text, 10)
      if (num > 0 && session.categories && num <= session.categories.length) {
        const cat = session.categories[num - 1]
        flowShowCategory(phone, session, cat.id, cat.name)
      } else { flowSearchProducts(phone, session, text) }
      break
    }
    case 'product_list': {
      const num = parseInt(text, 10)
      if (num > 0 && session.products && num <= session.products.length) {
        const p = session.products[num - 1]
        session.selectedProduct = p
        session.state = 'select_qty'
        flowReply(phone, `🛍️ *${p.name}*\n\n💰 KES ${p.price}\n📦 Stock: ${p.stock > 0 ? p.stock + ' units' : '❌ Out of stock'}\n\n${p.stock > 0 ? 'How many? (e.g. *2*)' : 'Out of stock. Text *back* to browse.'}`)
      } else if (text === 'back' || text === '0') { session.state = 'browsing'; flowReply(phone, 'Text *1* to browse or search a product.') }
      else { flowReply(phone, 'Reply with a number from the list or text *back*.') }
      break
    }
    case 'select_qty': {
      if (text === 'back') { session.state = 'product_list'; flowReply(phone, 'Text the product number.'); break }
      const qty = parseInt(text, 10)
      if (isNaN(qty) || qty < 1) { flowReply(phone, 'Enter a valid quantity (e.g. *1*)'); break }
      const p = session.selectedProduct
      if (!p) { session.state = 'browsing'; break }
      const existing = session.cart.find(i => i.productId === p.id)
      if (existing) existing.qty += qty
      else session.cart.push({ productId: p.id, name: p.name, price: p.price, qty })
      const total = session.cart.reduce((s, i) => s + i.price * i.qty, 0)
      const lines = session.cart.map(i => `• ${i.name} × ${i.qty} = KES ${i.price * i.qty}`).join('\n')
      flowReply(phone, `✅ Added!\n\n🛒 *Cart:*\n${lines}\n\n💰 *Total: KES ${total}*\n\n*1* Add more | *2* Checkout | *3* Clear cart`)
      session.state = 'cart_review'
      break
    }
    case 'cart_review': {
      if (text === '1') { session.state = 'browsing'; flowReply(phone, 'Text *1* to browse or search.') }
      else if (text === '2') {
        if (session.cart.length === 0) { flowReply(phone, 'Cart is empty. Text *1* to shop!'); session.state = 'browsing'; break }
        if (!session.userId) { flowReply(phone, '📱 Register to checkout:\nhttps://silgen.vercel.app/register\n\nOr complete at:\nhttps://silgen.vercel.app/checkout') }
        else {
          try {
            const addrs = $app.dao().findRecordsByFilter('sg_addresses', `user_id = "${session.userId}"`, '', 5, 0)
            if (addrs.length > 0) {
              let msg = `🏠 *Delivery Address*\n\n`
              addrs.forEach((a, i) => { msg += `${i + 1}. ${a.get('label') || ''} — ${a.get('estate') || ''}, ${a.get('town') || ''}\n` })
              msg += `\n${addrs.length + 1}. New address\n\nReply with number:`
              session.addresses = addrs.map(a => ({ id: a.id, label: `${a.get('estate')}, ${a.get('town')}` }))
              session.state = 'select_address'
              flowReply(phone, msg)
            } else { flowReply(phone, '📍 Enter delivery address:\n(Estate, Town — e.g. *Karen, Nairobi*)'); session.state = 'enter_address' }
          } catch(e) { flowReply(phone, 'Enter delivery address:\n(Estate, Town)'); session.state = 'enter_address' }
        }
      } else if (text === '3') { session.cart = []; session.state = 'browsing'; flowReply(phone, '🗑️ Cart cleared. Text *1* to shop again.') }
      else { const t = session.cart.reduce((s, i) => s + i.price * i.qty, 0); flowReply(phone, `Total: KES ${t}\n\n*1* Add more | *2* Checkout | *3* Clear`) }
      break
    }
    case 'select_address': {
      const num = parseInt(text, 10)
      if (num > 0 && session.addresses && num <= session.addresses.length) {
        session.address = session.addresses[num - 1]; session.addressLabel = session.address.label
        flowProceedPayment(phone, session)
      } else { flowReply(phone, 'Enter new delivery address:\n(Estate, Town)'); session.state = 'enter_address' }
      break
    }
    case 'enter_address': {
      if (text.length < 5) { flowReply(phone, 'Please enter a valid address (Estate, Town)'); break }
      session.addressLabel = messageText.trim(); session.address = null
      flowProceedPayment(phone, session)
      break
    }
    case 'confirm_order': {
      if (['yes','confirm','ndio','ok','okay','1'].includes(text)) { flowCreateOrder(phone, session) }
      else { resetFlowSession(phone); flowReply(phone, 'Order cancelled. Text *Hi* to start again.') }
      break
    }
    case 'awaiting_payment': {
      if (text === 'cancel') { session.state = 'browsing'; flowReply(phone, 'Payment cancelled. Text *2* to retry checkout.') }
      else { flowReply(phone, 'Waiting for M-Pesa payment...\n\nText *cancel* to go back.') }
      break
    }
    case 'track_order': {
      const ref = messageText.trim().toUpperCase()
      try {
        const orders = $app.dao().findRecordsByFilter('sg_orders', `ref = "${ref}"`, '', 1, 0)
        if (orders.length === 0) { flowReply(phone, `❌ Order *${ref}* not found.\n\nhttps://silgen.vercel.app/orders`) }
        else {
          const o = orders[0]
          flowReply(phone, `📦 *Order ${ref}*\n\nStatus: *${o.get('status').replace(/_/g, ' ')}*\nTotal: KES ${o.get('total_kes')}\nPayment: ${o.get('payment_status')}\n\nhttps://silgen.vercel.app/orders\n\nText *Hi* for main menu.`)
        }
      } catch(e) { flowReply(phone, 'Visit https://silgen.vercel.app/orders') }
      session.state = 'browsing'
      break
    }
    default: {
      session.state = 'browsing'
      flowReply(phone, 'Text *Hi* to start shopping or visit https://silgen.vercel.app')
    }
  }
}

function flowShowCategory(phone, session, categoryId, categoryName) {
  try {
    const products = $app.dao().findRecordsByFilter('sg_products', `category_id = "${categoryId}" && status = "active"`, '-sales_count', 10, 0)
    if (products.length === 0) { flowReply(phone, `No products in ${categoryName}. Text *1* to browse.`); session.state = 'browsing'; return }
    let msg = `📦 *${categoryName}*\n\n`
    const data = []
    products.forEach((p, i) => {
      const price = p.get('price_kes') || 0; const stock = p.get('stock_qty') || 0
      msg += `${i + 1}. *${p.get('name_en')}*${stock === 0 ? ' ❌' : stock < 5 ? ` (${stock} left!)` : ''}\n   KES ${price}\n\n`
      data.push({ id: p.id, name: p.get('name_en'), price, stock })
    })
    msg += `0. Back`
    session.products = data; session.state = 'product_list'
    flowReply(phone, msg)
  } catch(e) { flowReply(phone, 'Visit https://silgen.vercel.app/shop'); session.state = 'browsing' }
}

function flowSearchProducts(phone, session, query) {
  try {
    const products = $app.dao().findRecordsByFilter('sg_products', `status = "active" && (name_en ~ "${query}" || name_sw ~ "${query}" || tags ~ "${query}")`, '-sales_count', 8, 0)
    if (products.length === 0) { flowReply(phone, `❌ No results for "*${query}*".\n\nTry another search or text *1* to browse.`); session.state = 'browsing'; return }
    let msg = `🔍 *"${query}"* — ${products.length} result(s):\n\n`
    const data = []
    products.forEach((p, i) => {
      const price = p.get('price_kes') || 0; const stock = p.get('stock_qty') || 0
      msg += `${i + 1}. *${p.get('name_en')}* — KES ${price}${stock === 0 ? ' ❌' : ''}\n`
      data.push({ id: p.id, name: p.get('name_en'), price, stock })
    })
    msg += `\nReply with number to select.`
    session.products = data; session.state = 'product_list'
    flowReply(phone, msg)
  } catch(e) { flowReply(phone, 'Search failed. Visit https://silgen.vercel.app/shop'); session.state = 'browsing' }
}

function flowProceedPayment(phone, session) {
  const total = session.cart.reduce((s, i) => s + i.price * i.qty, 0)
  const lines = session.cart.map(i => `• ${i.name} × ${i.qty} — KES ${i.price * i.qty}`).join('\n')
  flowReply(phone, `🛒 *Order Summary*\n\n${lines}\n\n📍 Delivery: ${session.addressLabel}\n💰 *Total: KES ${total}*\n\nReply *YES* to confirm and pay or *NO* to cancel.`)
  session.state = 'confirm_order'; session.cartTotal = total
}

function flowCreateOrder(phone, session) {
  try {
    const ref = 'SG-' + new Date().getFullYear() + '-' + String(Math.floor(100000 + Math.random() * 900000))
    const orderData = { ref, subtotal_kes: session.cartTotal, total_kes: session.cartTotal, payment_method: 'mpesa_stk', payment_status: 'pending', status: 'pending', source: 'whatsapp', notes: `WhatsApp order. Delivery: ${session.addressLabel}` }
    if (session.userId) orderData.user_id = session.userId
    if (session.address?.id) orderData.address_id = session.address.id
    const order = new Record($app.dao().findCollectionByNameOrId('sg_orders'), orderData)
    $app.dao().saveRecord(order)
    session.cart.forEach(item => {
      try {
        $app.dao().saveRecord(new Record($app.dao().findCollectionByNameOrId('sg_order_items'), {
          order_id: order.id, product_id: item.productId, product_name: item.name,
          qty: item.qty, unit_price_kes: item.price, total_kes: item.price * item.qty,
        }))
      } catch(e) {}
    })
    session.orderId = order.id; session.orderRef = ref; session.state = 'awaiting_payment'
    flowReply(phone, `✅ *Order Created: ${ref}*\n\n💰 Total: KES ${session.cartTotal}\n\n📱 *Pay via M-Pesa Paybill:*\nPaybill: 522533\nAccount: ${ref}\n\nYour order confirms automatically once payment received.\n\n_Text CANCEL to cancel_`)
  } catch(e) { flowReply(phone, '❌ Couldn\'t create order. Visit https://silgen.vercel.app'); session.state = 'browsing' }
}

routerAdd('GET', '/api/whatsapp/webhook', (c) => {
  const mode = c.queryParam('hub.mode'); const token = c.queryParam('hub.verify_token'); const challenge = c.queryParam('hub.challenge')
  if (mode === 'subscribe' && token === WA_FLOW_VERIFY) return c.string(200, challenge)
  return c.json(403, { error: 'Verification failed' })
})

routerAdd('POST', '/api/whatsapp/webhook', (c) => {
  let body
  try { body = $apis.requestInfo(c).data } catch(e) { return c.json(200, { received: true }) }
  try {
    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    if (!message) return c.json(200, { received: true })
    const phone = message?.from
    if (!phone) return c.json(200, { received: true })
    let text = ''
    if (message?.type === 'text') text = message?.text?.body || ''
    else if (message?.type === 'interactive') {
      const ia = message?.interactive
      text = ia?.list_reply?.title || ia?.button_reply?.title || ''
    } else if (message?.type === 'button') { text = message?.button?.text || '' }
    processFlowMessage(phone, text)
  } catch(e) { console.log('[WA Webhook] Error:', e.message) }
  return c.json(200, { received: true })
})

routerAdd('POST', '/api/whatsapp/test', (c) => {
  const body = $apis.requestInfo(c).data
  const phone = body?.phone || '254712345678'; const message = body?.message || 'Hi'
  processFlowMessage(phone, message)
  return c.json(200, { success: true, phone, message, session: flowSessions[phone] || {} })
})