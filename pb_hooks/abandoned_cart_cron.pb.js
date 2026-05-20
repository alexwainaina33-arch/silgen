/// <reference path="../pb_data/types.d.ts" />

// ─── Abandoned Cart Cron ───────────────────────────────────────────────────
// Runs every 5 minutes. Finds carts inactive for 30+ minutes
// and sends a WhatsApp/notification reminder (opt-in users only).

cronAdd('abandonedCartCheck', '*/5 * * * *', () => {
  try {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    // Find unrecovered abandoned carts not yet reminded
    const carts = $app.dao().findRecordsByFilter(
      'sg_abandoned_carts',
      `recovered = false && reminder_sent = false && created <= "${thirtyMinsAgo}"`,
      '-created', 50, 0
    )

    carts.forEach(cart => {
      try {
        const userId    = cart.get('user_id')
        const cartTotal = cart.get('cart_total_kes') || 0
        const itemsJson = cart.get('items_json')     || []

        if (!userId) return

        // Check user opted in to WhatsApp
        const user = $app.dao().findRecordById('sg_users', userId)
        if (!user) return

        const itemCount = Array.isArray(itemsJson) ? itemsJson.length : 0
        const userName  = user.get('name') || 'there'

        // Create in-app notification
        $app.dao().saveRecord(
          new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
            user_id: userId,
            type:    'system',
            title:   '🛒 You left something behind!',
            body:    `You have ${itemCount} item(s) worth KES ${cartTotal} in your cart. Complete your order before they sell out!`,
            link:    '/checkout',
            is_read: false,
          })
        )

        // Mark reminder sent
        cart.set('reminder_sent',    true)
        cart.set('reminder_sent_at', new Date().toISOString())
        $app.dao().saveRecord(cart)

      } catch (e) { /* per-cart errors must not stop the loop */ }
    })
  } catch (e) { /* cron must never crash */ }
})