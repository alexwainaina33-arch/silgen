/// <reference path="../pb_data/types.d.ts" />

// ─── Subscription Cron ─────────────────────────────────────────────────────
// Runs daily at 8am Nairobi time (UTC+3 = 05:00 UTC)
// Handles: auto-renewal reminders, billing, failed payment retries,
//          expiry, past_due escalation

cronAdd('subscriptionDaily', '0 5 * * *', () => {
  const now     = new Date()
  const today   = now.toISOString().split('T')[0]

  // ── 1. Send 24hr reminders for tomorrow's billing ──────────────────────
  try {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]

    const dueTomorrow = $app.dao().findRecordsByFilter(
      'sg_subscriptions',
      `status = "active" && next_billing >= "${tomorrow}T00:00:00" && next_billing <= "${tomorrow}T23:59:59"`,
      '', 100, 0
    )

    dueTomorrow.forEach(sub => {
      try {
        const userId = sub.get('user_id')
        const amount = sub.get('amount_kes') || 0
        if (!userId) return

        $app.dao().saveRecord(
          new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
            user_id: userId,
            type:    'subscription',
            title:   '📅 Subscription billing tomorrow',
            body:    `KES ${amount} will be charged tomorrow for your subscription renewal.`,
            link:    '/subscriptions',
            is_read: false,
          })
        )
      } catch (e) { /* best effort per sub */ }
    })
  } catch (e) { /* never crash cron */ }

  // ── 2. Process due subscriptions (next_billing = today) ───────────────
  try {
    const dueSubs = $app.dao().findRecordsByFilter(
      'sg_subscriptions',
      `(status = "active" || status = "trial") && next_billing >= "${today}T00:00:00" && next_billing <= "${today}T23:59:59"`,
      '', 100, 0
    )

    dueSubs.forEach(sub => {
      try {
        const userId    = sub.get('user_id')
        const planId    = sub.get('plan_id')
        const addressId = sub.get('address_id')
        const amount    = sub.get('amount_kes') || 0
        const method    = sub.get('payment_method') || 'mpesa_stk'
        const cycle     = sub.get('current_cycle') || 0
        const maxCycles = sub.get('max_cycles')    || 0

        if (!userId) return

        // Check max cycles reached
        if (maxCycles > 0 && cycle >= maxCycles) {
          sub.set('status', 'expired')
          $app.dao().saveRecord(sub)

          $app.dao().saveRecord(
            new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
              user_id: userId,
              type:    'subscription',
              title:   'Subscription completed',
              body:    'Your subscription has completed all ' + maxCycles + ' cycles.',
              link:    '/subscriptions',
              is_read: false,
            })
          )
          return
        }

        // Get plan details
        let plan
        try {
          plan = $app.dao().findRecordById('sg_subscription_plans', planId)
        } catch (e) { return }

        const cycleDays = plan.get('cycle_days') || 30
        const productId = sub.get('product_id') || plan.get('product_id')

        // Create order for this cycle
        const orderRef = 'SG-' + new Date().getFullYear() + '-' + String(Math.floor(100000 + Math.random() * 900000))

        const newOrder = new Record($app.dao().findCollectionByNameOrId('sg_orders'), {
          ref:            orderRef,
          user_id:        userId,
          address_id:     addressId || '',
          subtotal_kes:   amount,
          total_kes:      amount,
          payment_method: method,
          payment_status: 'pending',
          status:         'pending',
          source:         'subscription',
          notes:          `Auto-renewal cycle ${cycle + 1}`,
        })
        $app.dao().saveRecord(newOrder)

        // Create order item
        if (productId) {
          try {
            const product = $app.dao().findRecordById('sg_products', productId)
            $app.dao().saveRecord(
              new Record($app.dao().findCollectionByNameOrId('sg_order_items'), {
                order_id:     newOrder.id,
                product_id:   productId,
                product_name: product.get('name_en') || '',
                qty:          1,
                unit_price_kes: amount,
                total_kes:    amount,
              })
            )
          } catch (e) { /* best effort */ }
        }

        // Update subscription
        const nextBilling = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0]

        sub.set('current_cycle', cycle + 1)
        sub.set('last_billed',   today)
        sub.set('next_billing',  nextBilling)
        $app.dao().saveRecord(sub)

        // Notify user
        $app.dao().saveRecord(
          new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
            user_id: userId,
            type:    'subscription',
            title:   '🔄 Subscription renewed',
            body:    `Your subscription (cycle ${cycle + 1}) has been renewed. KES ${amount} charged.`,
            link:    '/orders',
            is_read: false,
          })
        )

      } catch (e) { /* per-sub errors must not stop the loop */ }
    })
  } catch (e) { /* never crash cron */ }

  // ── 3. Retry failed subscriptions (failed_attempts 1-3, retry every 24h) ─
  try {
    const failedSubs = $app.dao().findRecordsByFilter(
      'sg_subscriptions',
      `status = "past_due" && failed_attempts > 0 && failed_attempts < 4`,
      '', 50, 0
    )

    failedSubs.forEach(sub => {
      try {
        const userId   = sub.get('user_id')
        const attempts = sub.get('failed_attempts') || 1

        if (!userId) return

        if (attempts >= 3) {
          // Escalate to cancelled after 3 attempts
          sub.set('status', 'cancelled')
          sub.set('cancelled_at', new Date().toISOString())
          sub.set('cancel_reason', 'Auto-cancelled after 3 failed payment attempts')
          $app.dao().saveRecord(sub)

          $app.dao().saveRecord(
            new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
              user_id: userId,
              type:    'subscription',
              title:   '❌ Subscription cancelled',
              body:    'Your subscription was cancelled after 3 failed payment attempts. Please update your payment method.',
              link:    '/subscriptions',
              is_read: false,
            })
          )
        } else {
          // Increment retry count
          sub.set('failed_attempts', attempts + 1)
          $app.dao().saveRecord(sub)

          $app.dao().saveRecord(
            new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
              user_id: userId,
              type:    'subscription',
              title:   '⚠️ Subscription payment retry',
              body:    `Payment attempt ${attempts + 1}/3 for your subscription. Please ensure your M-Pesa has sufficient balance.`,
              link:    '/subscriptions',
              is_read: false,
            })
          )
        }
      } catch (e) { /* per-sub errors */ }
    })
  } catch (e) { /* never crash cron */ }

  // ── 4. Expire trial subscriptions ──────────────────────────────────────
  try {
    const trialSubs = $app.dao().findRecordsByFilter(
      'sg_subscriptions',
      `status = "trial" && next_billing < "${today}T00:00:00"`,
      '', 50, 0
    )

    trialSubs.forEach(sub => {
      try {
        sub.set('status', 'expired')
        $app.dao().saveRecord(sub)

        const userId = sub.get('user_id')
        if (userId) {
          $app.dao().saveRecord(
            new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
              user_id: userId,
              type:    'subscription',
              title:   'Trial period ended',
              body:    'Your free trial has ended. Subscribe to continue enjoying the service.',
              link:    '/subscriptions',
              is_read: false,
            })
          )
        }
      } catch (e) { /* per-sub */ }
    })
  } catch (e) { /* never crash cron */ }
})