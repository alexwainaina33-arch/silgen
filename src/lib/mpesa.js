// src/lib/mpesa.js
// M-Pesa STK Push initiation + polling (calls PocketBase hooks)
// All actual Daraja API calls happen server-side in pb_hooks/mpesa_stk.pb.js

/**
 * Initiate M-Pesa STK Push via PocketBase hook
 * Returns { checkoutRequestId, merchantRequestId } on success
 */
export async function initiateStkPush({ phone, amount, orderId, orderRef }) {
  const normalised = normaliseMpesaPhone(phone)
  if (!normalised) throw new Error('Invalid M-Pesa phone number. Use 07XX or 01XX format.')

  const res = await fetch(
    `${import.meta.env.VITE_PB_URL}/api/mpesa/stk-push`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone:    normalised,
        amount:   Math.ceil(amount),
        order_id: orderId,
        ref:      orderRef,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message || `STK Push failed (${res.status})`)
  }

  const data = await res.json()
  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
  }
}

/**
 * Poll payment status every 3 seconds for up to 2 minutes
 * Calls: GET /api/mpesa/status?checkout_request_id=XXX
 *
 * onUpdate(status) called on each poll:
 *   status: 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout'
 *
 * Returns final status string
 */
export async function pollStkStatus(checkoutRequestId, onUpdate, timeoutMs = 120_000) {
  const INTERVAL = 3000
  const started  = Date.now()

  return new Promise((resolve) => {
    const tick = async () => {
      if (Date.now() - started > timeoutMs) {
        onUpdate('timeout')
        resolve('timeout')
        return
      }

      try {
        const res = await fetch(
          `${import.meta.env.VITE_PB_URL}/api/mpesa/status?checkout_request_id=${checkoutRequestId}`
        )
        const data = await res.json()

        const status = data?.status || 'pending'
        onUpdate(status)

        if (status === 'success' || status === 'failed' || status === 'cancelled') {
          resolve(status)
          return
        }
      } catch {
        // Network hiccup — keep polling
      }

      setTimeout(tick, INTERVAL)
    }

    setTimeout(tick, INTERVAL)
  })
}

/**
 * Normalise phone to 2547XXXXXXXX format for Daraja API
 */
export function normaliseMpesaPhone(raw = '') {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('254') && digits.length === 12) return digits
  if (digits.startsWith('0')   && digits.length === 10) return '254' + digits.slice(1)
  if (digits.startsWith('7')   && digits.length === 9)  return '254' + digits
  if (digits.startsWith('1')   && digits.length === 9)  return '254' + digits
  return null
}

/**
 * Format phone for display
 */
export function formatMpesaPhone(raw = '') {
  const n = normaliseMpesaPhone(raw)
  if (!n) return raw
  return '+' + n.slice(0, 3) + ' ' + n.slice(3, 6) + ' ' + n.slice(6, 9) + ' ' + n.slice(9)
}
