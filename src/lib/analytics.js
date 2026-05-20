import pb from './pb.js'

/**
 * Track an analytics event in sg_analytics_events.
 * Fire-and-forget — never blocks the UI.
 */
export async function trackEvent(event, entityId = '', metaJson = {}) {
  try {
    const userId = pb.authStore.model?.id ?? ''
    const sessionKey = getSessionKey()
    const device = getDevice()
    const country = 'KE' // default; enriched server-side if needed

    await pb.collection('sg_analytics_events').create({
      user_id:     userId || undefined,
      session_key: sessionKey,
      event,
      entity_id:   entityId,
      meta_json:   metaJson,
      country,
      device,
    })
  } catch {
    // silent fail — analytics must never break the app
  }
}

function getSessionKey() {
  let key = sessionStorage.getItem('sg_session_key')
  if (!key) {
    key = crypto.randomUUID()
    sessionStorage.setItem('sg_session_key', key)
  }
  return key
}

function getDevice() {
  const ua = navigator.userAgent
  if (/Mobi|Android/i.test(ua)) return 'mobile'
  if (/Tablet|iPad/i.test(ua)) return 'tablet'
  return 'desktop'
}

// Convenience wrappers
export const trackPageView    = (path)      => trackEvent('page_view',       path)
export const trackProductView = (productId) => trackEvent('product_view',    productId)
export const trackSearch      = (query)     => trackEvent('search',          '',        { query })
export const trackAddToCart   = (productId) => trackEvent('add_to_cart',     productId)
export const trackCheckout    = ()          => trackEvent('checkout_start',  '')
export const trackPurchase    = (orderId)   => trackEvent('purchase',        orderId)
export const trackDealView    = (dealId)    => trackEvent('deal_view',       dealId)
export const trackChatOpen    = ()          => trackEvent('chat_open',       '')