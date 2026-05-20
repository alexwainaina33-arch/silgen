// src/hooks/useCheckout.js
// Full checkout flow: address → payment selection → processing → confirm
// Feature #9:  Subscription upsell (isSubscription + 20% discount)
// Feature #13: Saved M-Pesa number (localStorage persist)
import { useState, useCallback } from 'react'
import pb from '../lib/pb.js'
import useCartStore from '../store/cart.js'
import useAuthStore from '../store/auth.js'
import { initiateStkPush, pollStkStatus } from '../lib/mpesa.js'
import { trackEvent } from '../lib/analytics.js'

/**
 * Calculate coupon discount
 */
export function applyCoupon(coupon, subtotal) {
  if (!coupon || !coupon.is_active) return 0
  if (coupon.min_order_kes && subtotal < coupon.min_order_kes) return 0

  let discount = 0
  if (coupon.type === 'percent')       discount = (subtotal * coupon.value) / 100
  if (coupon.type === 'fixed_kes')     discount = coupon.value
  if (coupon.type === 'free_delivery') discount = 0 // handled separately

  if (coupon.max_discount_kes) discount = Math.min(discount, coupon.max_discount_kes)
  return Math.floor(discount)
}

/**
 * Calculate loyalty discount (100 pts = KES 50)
 */
export function calcLoyaltyDiscount(pointsToRedeem) {
  return Math.floor((pointsToRedeem / 100) * 50)
}

export default function useCheckout() {
  const { items, clearCart, getSubtotal } = useCartStore()
  const { user }                        = useAuthStore()

  // ── Step management ────────────────────────────────────────
  const [step, setStep] = useState(1) // 1=address, 2=payment, 3=processing, 4=done

  // ── Address ────────────────────────────────────────────────
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [deliveryZone,      setDeliveryZone]       = useState(null)

  // ── Coupon ─────────────────────────────────────────────────
  const [couponCode,    setCouponCode]    = useState('')
  const [couponData,    setCouponData]    = useState(null)
  const [couponError,   setCouponError]   = useState('')
  const [couponLoading, setCouponLoading] = useState(false)

  // ── Loyalty ────────────────────────────────────────────────
  const [loyaltyToRedeem, setLoyaltyToRedeem] = useState(0)

  // ── Payment ────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState('mpesa_stk')

  // ✨ Feature #13: Pre-fill from localStorage, fallback to user's account phone
  const [mpesaPhone, setMpesaPhone] = useState(
    () => localStorage.getItem('sg_mpesa_phone') || user?.phone || ''
  )

  const [isGift,        setIsGift]        = useState(false)
  const [giftDetails,   setGiftDetails]   = useState({ name: '', phone: '', message: '' })
  const [orderNotes,    setOrderNotes]    = useState('')

  // ✨ Feature #9: Subscription upsell — one checkbox converts to recurring order
  const [isSubscription, setIsSubscription] = useState(false)

  // ── Processing state ───────────────────────────────────────
  const [processing,     setProcessing]     = useState(false)
  const [stkStatus,      setStkStatus]      = useState('idle') // idle|waiting|success|failed|timeout
  const [stkSecondsLeft, setStkSecondsLeft] = useState(120)
  const [processingMsg,  setProcessingMsg]  = useState('')
  const [createdOrder,   setCreatedOrder]   = useState(null)
  const [error,          setError]          = useState('')

  // ── Computed totals ────────────────────────────────────────
  const subtotal    = getSubtotal()
  const deliveryFee = deliveryZone
    ? (couponData?.type === 'free_delivery'
        ? 0
        : subtotal >= (deliveryZone.free_above_kes || 0)
        ? 0
        : deliveryZone.fee_kes)
    : 0
  const couponDiscount       = applyCoupon(couponData, subtotal)
  const loyaltyDiscount      = calcLoyaltyDiscount(loyaltyToRedeem)
  // ✨ Feature #9: 20% off when subscribing
  const subscriptionDiscount = isSubscription ? Math.floor(subtotal * 0.2) : 0
  const total                = Math.max(0, subtotal - couponDiscount - loyaltyDiscount - subscriptionDiscount + deliveryFee)
  const loyaltyEarned        = Math.floor(total) // 1 point per KES

  // ── Validate coupon ────────────────────────────────────────
  const validateCoupon = useCallback(async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError('')
    setCouponData(null)

    try {
      const coupon = await pb.collection('sg_coupons').getFirstListItem(
        `code = "${couponCode.trim().toUpperCase()}" && is_active = true`
      )

      const now = new Date()
      if (coupon.starts_at && new Date(coupon.starts_at) > now) {
        setCouponError('This coupon is not yet active')
        setCouponLoading(false)
        return
      }
      if (coupon.expires_at && new Date(coupon.expires_at) < now) {
        setCouponError('This coupon has expired')
        setCouponLoading(false)
        return
      }
      if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
        setCouponError('This coupon has reached its usage limit')
        setCouponLoading(false)
        return
      }
      if (coupon.min_order_kes && subtotal < coupon.min_order_kes) {
        setCouponError(`Minimum order of KES ${coupon.min_order_kes.toLocaleString()} required`)
        setCouponLoading(false)
        return
      }

      setCouponData(coupon)
    } catch {
      setCouponError('Invalid coupon code')
    }
    setCouponLoading(false)
  }, [couponCode, subtotal])

  // ── Create order record ────────────────────────────────────
  const createOrderRecord = useCallback(async (paymentStatus = 'pending') => {
    const tempRef = `SG-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`

    const orderData = {
      ref:              tempRef,
      user_id:          user.id,
      address_id:       selectedAddressId || undefined,
      subtotal_kes:     subtotal,
      discount_kes:     couponDiscount + loyaltyDiscount + subscriptionDiscount,
      delivery_fee_kes: deliveryFee,
      total_kes:        total,
      currency:         'KES',
      coupon_id:        couponData?.id || undefined,
      loyalty_used:     loyaltyToRedeem,
      loyalty_earned:   loyaltyEarned,
      payment_method:   paymentMethod,
      payment_status:   paymentStatus,
      status:           'pending',
      is_gift:          isGift,
      gift_recipient_name:  isGift ? giftDetails.name    : '',
      gift_recipient_phone: isGift ? giftDetails.phone   : '',
      gift_message:         isGift ? giftDetails.message : '',
      delivery_zone_id:     deliveryZone?.id || undefined,
      notes: isSubscription
        ? (orderNotes ? `${orderNotes} [subscribe:monthly]` : '[subscribe:monthly]')
        : (orderNotes || ''),
      source:           'web',
      whatsapp_sent:    false,
    }

    const order = await pb.collection('sg_orders').create(orderData)

    // Create order items
    await Promise.all(
      items.map(item =>
        pb.collection('sg_order_items').create({
          order_id:       order.id,
          product_id:     item.product.id,
          product_name:   item.product.name_en,
          variant_sku:    item.variantSku   || '',
          variant_label:  item.variantLabel || '',
          qty:            item.qty,
          unit_price_kes: item.product.price_kes,
          total_kes:      item.product.price_kes * item.qty,
          thumbnail_url:  item.product.thumbnail_url || '',
        })
      )
    )

    // Deduct loyalty points used
    if (loyaltyToRedeem > 0) {
      await pb.collection('sg_loyalty_transactions').create({
        user_id:      user.id,
        order_id:     order.id,
        type:         'redeem',
        points:       -loyaltyToRedeem,
        balance_after: Math.max(0, (user.loyalty_points || 0) - loyaltyToRedeem),
        description:  `Redeemed for order ${tempRef}`,
      }).catch(() => {})
    }

    return order
  }, [user, selectedAddressId, subtotal, couponDiscount, loyaltyDiscount, subscriptionDiscount,
      deliveryFee, total, couponData, loyaltyToRedeem, loyaltyEarned, paymentMethod, isGift,
      giftDetails, deliveryZone, orderNotes, items, isSubscription])

  // ── Confirm payment success ────────────────────────────────
  const confirmPayment = useCallback(async (order, gatewayRef = '') => {
    await pb.collection('sg_orders').update(order.id, {
      payment_status: 'paid',
      status:         'confirmed',
    })
    await pb.collection('sg_payments').create({
      order_id:    order.id,
      user_id:     user.id,
      method:      paymentMethod,
      amount_kes:  total,
      currency:    'KES',
      status:      'success',
      gateway_ref: gatewayRef,
      phone_used:  mpesaPhone || '',
    }).catch(() => {})

    // Award loyalty points
    await pb.collection('sg_loyalty_transactions').create({
      user_id:       user.id,
      order_id:      order.id,
      type:          'earn',
      points:        loyaltyEarned,
      balance_after: (user.loyalty_points || 0) - loyaltyToRedeem + loyaltyEarned,
      description:   `Earned from order ${order.ref}`,
    }).catch(() => {})

    // Update coupon usage
    if (couponData?.id) {
      await pb.collection('sg_coupons').update(couponData.id, {
        usage_count: (couponData.usage_count || 0) + 1,
      }).catch(() => {})
    }

    // Mark abandoned cart record as recovered (fire-and-forget)
    pb.collection('sg_abandoned_carts')
      .getFirstListItem(`user_id = "${user.id}" && recovered = false`)
      .then(rec => pb.collection('sg_abandoned_carts').update(rec.id, {
        recovered:           true,
        recovered_order_id:  order.id,
      }))
      .catch(() => {})

    // ✨ Feature #13: Persist M-Pesa number for next checkout
    if (mpesaPhone) localStorage.setItem('sg_mpesa_phone', mpesaPhone)

    trackEvent('purchase', order.id, { total, method: paymentMethod })
    clearCart()
    setCreatedOrder(order)
    setStep(4)
  }, [user, paymentMethod, total, mpesaPhone, loyaltyEarned, loyaltyToRedeem, couponData, clearCart])

  // ── Place Order ────────────────────────────────────────────
  const placeOrder = useCallback(async () => {
    if (!user)           { setError('Please sign in to continue'); return }
    if (items.length === 0) { setError('Your cart is empty'); return }

    setError('')
    setProcessing(true)
    setStep(3)

    try {
      // ── M-Pesa STK Push ──────────────────────────────────
      if (paymentMethod === 'mpesa_stk') {
        setProcessingMsg('Creating your order…')
        const order = await createOrderRecord('pending')

        setProcessingMsg('Sending M-Pesa push to ' + mpesaPhone + '…')
        setStkStatus('waiting')

        let checkoutRequestId
        try {
          const stk = await initiateStkPush({
            phone:    mpesaPhone,
            amount:   total,
            orderId:  order.id,
            orderRef: order.ref,
          })
          checkoutRequestId = stk.checkoutRequestId
        } catch (stkErr) {
          await pb.collection('sg_orders').update(order.id, { payment_status: 'failed' })
          throw new Error(stkErr.message || 'Could not send M-Pesa prompt. Check phone number.')
        }

        setProcessingMsg('⏳ Check your phone — enter your M-Pesa PIN')

        // Countdown ticker
        let secondsLeft = 120
        setStkSecondsLeft(secondsLeft)
        const ticker = setInterval(() => {
          secondsLeft -= 1
          setStkSecondsLeft(secondsLeft)
          if (secondsLeft <= 0) clearInterval(ticker)
        }, 1000)

        const finalStatus = await pollStkStatus(checkoutRequestId, (s) => {
          setStkStatus(s)
          if (s === 'success') setProcessingMsg('✅ Payment received!')
          if (s === 'failed')  setProcessingMsg('❌ Payment failed or cancelled')
        })

        clearInterval(ticker)

        if (finalStatus === 'success') {
          await confirmPayment(order, checkoutRequestId)
        } else {
          setStkStatus(finalStatus)
          await pb.collection('sg_orders').update(order.id, { payment_status: 'failed' })
          setStep(2)
          setError(
            finalStatus === 'timeout'
              ? 'M-Pesa timed out. Please try again or choose another payment method.'
              : 'M-Pesa payment was cancelled or failed. Please try again.'
          )
        }
        setProcessing(false)
        return
      }

      // ── M-Pesa Paybill ───────────────────────────────────
      if (paymentMethod === 'mpesa_paybill') {
        setProcessingMsg('Creating order — waiting for Paybill payment…')
        const order = await createOrderRecord('pending')
        setCreatedOrder(order)
        setStep(4)
        setProcessing(false)
        return
      }

      // ── Cash on Delivery ─────────────────────────────────
      if (paymentMethod === 'cod') {
        setProcessingMsg('Placing your order…')
        const order = await createOrderRecord('pending')
        await pb.collection('sg_payments').create({
          order_id: order.id, user_id: user.id,
          method: 'cod', amount_kes: total, currency: 'KES', status: 'pending',
        }).catch(() => {})
        await pb.collection('sg_loyalty_transactions').create({
          user_id:       user.id,
          order_id:      order.id,
          type:          'earn',
          points:        loyaltyEarned,
          balance_after: (user.loyalty_points || 0) - loyaltyToRedeem + loyaltyEarned,
          description:   `Earned from order ${order.ref}`,
        }).catch(() => {})
        trackEvent('purchase', order.id, { total, method: 'cod' })
        setCreatedOrder(order)
        setStep(4)
        clearCart()
        setProcessing(false)
        return
      }

      // ── Loyalty Points Only ──────────────────────────────
      if (paymentMethod === 'loyalty') {
        if (loyaltyDiscount < total) {
          throw new Error('Insufficient loyalty points to cover this order.')
        }
        setProcessingMsg('Redeeming loyalty points…')
        const order = await createOrderRecord('paid')
        await confirmPayment(order, 'loyalty-redemption')
        setProcessing(false)
        return
      }

      // ── PayPal / Flutterwave (Visa/MC) ───────────────────
      if (paymentMethod === 'paypal' || paymentMethod === 'visa_mc') {
        setProcessingMsg('Redirecting to payment gateway…')
        const order = await createOrderRecord('pending')
        setCreatedOrder(order)

        const returnUrl = encodeURIComponent(`${import.meta.env.VITE_APP_URL}/order-confirm/${order.ref}`)
        const cancelUrl = encodeURIComponent(`${import.meta.env.VITE_APP_URL}/checkout?cancelled=1`)

        if (paymentMethod === 'visa_mc') {
          // Flutterwave inline modal — loads SDK on demand, no redirect needed
          const flwConfig = {
            public_key: import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY,
            tx_ref:     order.ref,
            amount:     total,
            currency:   'KES',
            payment_options: 'card',
            customer: {
              email:        user.email,
              phone_number: user.phone || '',
              name:         user.name,
            },
            customizations: {
              title:       'SILGEN',
              description: `Order ${order.ref}`,
              logo:        `${import.meta.env.VITE_APP_URL}/icons/icon-192.png`,
            },
            callback: async (response) => {
              if (response.status === 'successful') {
                await confirmPayment(order, String(response.transaction_id))
              } else {
                await pb.collection('sg_orders')
                  .update(order.id, { payment_status: 'failed' }).catch(() => {})
                setError('Card payment was not completed. Please try again.')
                setStep(2)
              }
              setProcessing(false)
            },
            onclose: () => {
              // User closed modal without paying
              pb.collection('sg_orders')
                .update(order.id, { payment_status: 'failed' }).catch(() => {})
              setError('Payment cancelled. Choose another method or try again.')
              setStep(2)
              setProcessing(false)
            },
          }
          const openFlw = () => window.FlutterwaveCheckout(flwConfig)
          if (window.FlutterwaveCheckout) {
            openFlw()
          } else {
            const s = document.createElement('script')
            s.src = 'https://checkout.flutterwave.com/v3.js'
            s.onload = openFlw
            document.head.appendChild(s)
          }
          return // processing stays true until callback fires
        }

        if (paymentMethod === 'paypal') {
          // PayPal JS SDK — loads on demand, renders buttons in a full-screen overlay
          const currency = user?.is_diaspora ? 'USD' : 'USD' // PayPal settles in USD
          const loadSdk = () => new Promise((res) => {
            if (window.paypal) { res(); return }
            const s = document.createElement('script')
            s.src = `https://www.paypal.com/sdk/js?client-id=${
              import.meta.env.VITE_PAYPAL_CLIENT_ID
            }&currency=${currency}&intent=capture`
            s.onload = res
            document.head.appendChild(s)
          })

          await loadSdk()

          // Render PayPal buttons into a full-screen overlay div
          const overlay = document.createElement('div')
          overlay.id = 'sg-paypal-overlay'
          overlay.style.cssText = [
            'position:fixed','inset:0','z-index:9999',
            'background:rgba(0,0,0,.55)',
            'display:flex','align-items:center','justify-content:center',
          ].join(';')

          const box = document.createElement('div')
          box.style.cssText = [
            'background:#fff','border-radius:16px',
            'padding:24px','width:380px','max-width:calc(100vw - 32px)',
          ].join(';')

          const heading = document.createElement('p')
          heading.textContent = `Pay KES ${total.toLocaleString()} via PayPal`
          heading.style.cssText = 'font-weight:700;margin-bottom:16px;font-size:15px;color:#111'

          const btnContainer = document.createElement('div')
          btnContainer.id = 'sg-paypal-buttons'

          const cancelBtn = document.createElement('button')
          cancelBtn.textContent = 'Cancel'
          cancelBtn.style.cssText = [
            'margin-top:12px','width:100%','padding:10px',
            'border:1.5px solid #d1d5db','border-radius:10px',
            'font-weight:600','color:#555','cursor:pointer','background:#fff',
          ].join(';')

          box.append(heading, btnContainer, cancelBtn)
          overlay.appendChild(box)
          document.body.appendChild(overlay)

          const closeOverlay = () => {
            overlay.remove()
            setProcessing(false)
          }
          cancelBtn.onclick = () => {
            pb.collection('sg_orders')
              .update(order.id, { payment_status: 'failed' }).catch(() => {})
            setError('PayPal payment cancelled. Choose another method or try again.')
            setStep(2)
            closeOverlay()
          }

          window.paypal.Buttons({
            style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
            createOrder: (_data, actions) =>
              actions.order.create({
                purchase_units: [{
                  reference_id: order.ref,
                  amount: {
                    value:         (total / 130).toFixed(2), // approx KES→USD
                    currency_code: currency,
                  },
                  description: `SILGEN Order ${order.ref}`,
                }],
              }),
            onApprove: async (_data, actions) => {
              const capture = await actions.order.capture()
              await confirmPayment(order, capture.id)
              closeOverlay()
            },
            onError: async () => {
              await pb.collection('sg_orders')
                .update(order.id, { payment_status: 'failed' }).catch(() => {})
              setError('PayPal encountered an error. Please try again.')
              setStep(2)
              closeOverlay()
            },
          }).render('#sg-paypal-buttons')

          return // processing state managed by overlay callbacks
        }

        return
      }

    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
      setStep(2)
      setProcessing(false)
    }
  }, [user, items, paymentMethod, mpesaPhone, total, loyaltyDiscount,
      createOrderRecord, confirmPayment, clearCart])

  return {
    // Step
    step, setStep,
    // Address
    selectedAddressId, setSelectedAddressId,
    deliveryZone,      setDeliveryZone,
    // Coupon
    couponCode, setCouponCode, couponData, setCouponData,
    couponError, couponLoading, validateCoupon,
    // Loyalty
    loyaltyToRedeem, setLoyaltyToRedeem,
    // Payment
    paymentMethod, setPaymentMethod,
    mpesaPhone, setMpesaPhone,
    isGift, setIsGift, giftDetails, setGiftDetails,
    orderNotes, setOrderNotes,
    // ✨ Feature #9
    isSubscription, setIsSubscription,
    subscriptionDiscount,
    // Processing
    processing, stkStatus, stkSecondsLeft, processingMsg, error, setError,
    // Totals
    subtotal, deliveryFee, couponDiscount, loyaltyDiscount, total, loyaltyEarned,
    // Result
    createdOrder,
    // Actions
    placeOrder, validateCoupon,
  }
}