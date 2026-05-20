// src/store/cart.js
// ── Ultimate Cart Store ───────────────────────────────────────────────────────
// Combines the best of both versions:
// v1 (full product objects on items, getDeliveryFee, clean getTotal signature)
// v2 (offline queue, loyalty redemption in store, coupon system, loadFromPb)
// Feature #4: buyNow action

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import pb from '../lib/pb.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOnline() {
  return typeof navigator !== 'undefined' && navigator.onLine
}

function itemKey(productId, variantSku = '') {
  return `${productId}__${variantSku}`
}

// Safe analytics call — won't crash if lib doesn't exist
async function safeTrack(event, data) {
  try {
    const { trackAddToCart } = await import('../lib/analytics.js')
    if (event === 'add') trackAddToCart(data)
  } catch {
    // analytics optional
  }
}

// Safe offline queue — won't crash if lib doesn't exist
async function safeEnqueue(action, payload) {
  try {
    const { enqueue } = await import('../lib/offlineQueue.js')
    await enqueue(action, payload)
  } catch {
    // offline queue optional
  }
}

async function safeFlushQueue(handlers) {
  try {
    const { flushQueue } = await import('../lib/offlineQueue.js')
    await flushQueue(handlers)
  } catch {
    // offline queue optional
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

const useCartStore = create(
  persist(
    (set, get) => ({
      // ── State ───────────────────────────────────────────────────────────────
      items:           [],    // [{ product, qty, variantSku, variantLabel, price }]
      couponCode:      '',
      couponRecord:    null,
      discountKes:     0,
      loyaltyToRedeem: 0,
      loyaltyDiscount: 0,
      deliveryFeeKes:  0,
      deliveryZoneId:  '',
      loading:         false,
      error:           null,
      synced:          false,

      // ── Computed ─────────────────────────────────────────────────────────────

      getItemCount: () =>
        get().items.reduce((sum, i) => sum + i.qty, 0),

      // Uses item.price (set at add-time) — same as v1
      getSubtotal: () =>
        get().items.reduce((sum, i) => sum + (i.price || i.product?.price_kes || 0) * i.qty, 0),

      // Dynamic delivery like v1 — overridden by setDelivery after zone selection
      getDeliveryFee: () => {
        const { deliveryFeeKes, getSubtotal } = get()
        if (deliveryFeeKes > 0) return deliveryFeeKes
        return getSubtotal() >= 5000 ? 0 : 300
      },

      // Clean signature like v1 — uses store's loyalty + coupon discounts
      getTotal: () => {
        const { getSubtotal, getDeliveryFee, discountKes, loyaltyDiscount } = get()
        return Math.max(0, getSubtotal() + getDeliveryFee() - discountKes - loyaltyDiscount)
      },

      // ── Add Item ──────────────────────────────────────────────────────────────
      addItem: async (product, qty = 1, variantSku = '', variantLabel = '') => {
        const userId = pb.authStore.model?.id
        const key = itemKey(product.id, variantSku)
        const price = product.price_kes

        set((state) => {
          const existing = state.items.find(
            i => itemKey(i.product.id, i.variantSku) === key
          )
          if (existing) {
            return {
              items: state.items.map(i =>
                itemKey(i.product.id, i.variantSku) === key
                  ? { ...i, qty: i.qty + qty }
                  : i
              ),
            }
          }
          return {
            items: [
              ...state.items,
              {
                product,        // full product object (v1 approach)
                qty,
                variantSku,
                variantLabel,
                price,          // snapshot price at add-time
                addedAt: new Date().toISOString(),
              },
            ],
          }
        })

        safeTrack('add', product.id)

        if (!userId) return // guest — local only

        const payload = { userId, productId: product.id, variantSku, qty, priceKes: price }

        if (!isOnline()) {
          await safeEnqueue('cart_add', payload)
          return
        }

        try {
          const existing = await pb
            .collection('sg_cart_items')
            .getFirstListItem(
              `user_id = "${userId}" && product_id = "${product.id}" && variant_sku = "${variantSku}"`,
              { $cancelKey: `cart_add_${product.id}` }
            )
            .catch(() => null)

          if (existing) {
            await pb.collection('sg_cart_items').update(existing.id, { qty: existing.qty + qty })
          } else {
            await pb.collection('sg_cart_items').create({
              user_id:     userId,
              product_id:  product.id,
              variant_sku: variantSku,
              qty,
              price_kes:   price,
              added_at:    new Date().toISOString(),
            })
          }
        } catch (err) {
          console.warn('[Cart] addItem sync failed:', err)
        }
      },

      // ── ✨ Feature #4: Buy Now ─────────────────────────────────────────────────
      // Replaces entire cart with a single item for instant checkout.
      // Caller is responsible for navigating to /checkout after calling this.
      // Usage: const { buyNow } = useCartStore()
      //        buyNow(product); navigate('/checkout')
      buyNow: (product, qty = 1, variantSku = '', variantLabel = '') => {
        set({
          items: [{
            product,
            qty,
            variantSku,
            variantLabel,
            price:    product.price_kes,
            addedAt:  new Date().toISOString(),
          }],
          // Reset all discounts so checkout starts clean
          couponCode:      '',
          couponRecord:    null,
          discountKes:     0,
          loyaltyToRedeem: 0,
          loyaltyDiscount: 0,
        })
      },

      // ── Remove Item ───────────────────────────────────────────────────────────
      removeItem: async (productId, variantSku = '') => {
        const userId = pb.authStore.model?.id
        const key = itemKey(productId, variantSku)

        set(state => ({
          items: state.items.filter(i => itemKey(i.product.id, i.variantSku) !== key),
        }))

        if (!userId) return

        if (!isOnline()) {
          await safeEnqueue('cart_remove', { userId, productId, variantSku })
          return
        }

        try {
          const rec = await pb
            .collection('sg_cart_items')
            .getFirstListItem(
              `user_id = "${userId}" && product_id = "${productId}" && variant_sku = "${variantSku}"`,
              { $cancelKey: `cart_remove_${productId}` }
            )
            .catch(() => null)
          if (rec) await pb.collection('sg_cart_items').delete(rec.id)
        } catch (err) {
          console.warn('[Cart] removeItem sync failed:', err)
        }
      },

      // ── Update Qty ────────────────────────────────────────────────────────────
      updateQty: async (productId, variantSku = '', qty) => {
        if (qty <= 0) return get().removeItem(productId, variantSku)

        const userId = pb.authStore.model?.id
        const key = itemKey(productId, variantSku)

        set(state => ({
          items: state.items.map(i =>
            itemKey(i.product.id, i.variantSku) === key ? { ...i, qty } : i
          ),
        }))

        if (!userId) return

        if (!isOnline()) {
          await safeEnqueue('cart_update', { userId, productId, variantSku, qty })
          return
        }

        try {
          const rec = await pb
            .collection('sg_cart_items')
            .getFirstListItem(
              `user_id = "${userId}" && product_id = "${productId}" && variant_sku = "${variantSku}"`,
              { $cancelKey: `cart_update_${productId}` }
            )
            .catch(() => null)
          if (rec) await pb.collection('sg_cart_items').update(rec.id, { qty })
        } catch (err) {
          console.warn('[Cart] updateQty sync failed:', err)
        }
      },

      // ── Load From PocketBase (on login) ───────────────────────────────────────
      loadServerCart: async () => {
        const userId = pb.authStore.model?.id
        if (!userId) return

        try {
          const records = await pb.collection('sg_cart_items').getFullList({
            filter: `user_id = "${userId}"`,
            expand: 'product_id',
          })

          const serverItems = records
            .filter(r => r.expand?.product_id)
            .map(r => ({
              product:      r.expand.product_id,  // full product object
              qty:          r.qty,
              variantSku:   r.variant_sku || '',
              variantLabel: '',
              price:        r.price_kes || r.expand.product_id?.price_kes || 0,
              addedAt:      r.added_at || r.created,
              pbId:         r.id,
            }))

          // Merge: server is source of truth for logged-in users; add any local-only items
          const { items: localItems } = get()
          const merged = [...serverItems]

          for (const local of localItems) {
            const exists = merged.find(
              s => s.product.id === local.product?.id && s.variantSku === local.variantSku
            )
            if (!exists && local.product) merged.push(local)
          }

          set({ items: merged, synced: true })
        } catch (err) {
          console.warn('[Cart] loadServerCart failed:', err)
        }
      },

      // ── Clear Cart ────────────────────────────────────────────────────────────
      clearCart: async () => {
        const userId = pb.authStore.model?.id
        set({
          items:           [],
          couponCode:      '',
          couponRecord:    null,
          discountKes:     0,
          loyaltyToRedeem: 0,
          loyaltyDiscount: 0,
          deliveryFeeKes:  0,
          deliveryZoneId:  '',
          synced:          false,
        })

        if (!userId || !isOnline()) return

        try {
          const recs = await pb.collection('sg_cart_items').getFullList({
            filter: `user_id = "${userId}"`,
          })
          await Promise.all(recs.map(r => pb.collection('sg_cart_items').delete(r.id)))
        } catch (err) {
          console.warn('[Cart] clearCart sync failed:', err)
        }
      },

      // ── Apply Coupon ──────────────────────────────────────────────────────────
      applyCoupon: async (code) => {
        set({ loading: true, error: null })
        try {
          const coupon = await pb
            .collection('sg_coupons')
            .getFirstListItem(`code = "${code}" && is_active = true`)

          const now = new Date()
          if (coupon.starts_at && new Date(coupon.starts_at) > now) {
            set({ loading: false, error: 'Coupon not yet valid' })
            return { success: false }
          }
          if (coupon.expires_at && new Date(coupon.expires_at) < now) {
            set({ loading: false, error: 'Coupon has expired' })
            return { success: false }
          }
          if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
            set({ loading: false, error: 'Coupon usage limit reached' })
            return { success: false }
          }

          const subtotal = get().getSubtotal()
          if (coupon.min_order_kes && subtotal < coupon.min_order_kes) {
            set({ loading: false, error: `Minimum order of KES ${coupon.min_order_kes} required` })
            return { success: false }
          }

          let discount = 0
          if (coupon.type === 'percent') {
            discount = (subtotal * coupon.value) / 100
            if (coupon.max_discount_kes) discount = Math.min(discount, coupon.max_discount_kes)
          } else if (coupon.type === 'fixed_kes') {
            discount = coupon.value
          }
          // free_delivery handled at checkout when fee is known

          set({ couponCode: code, couponRecord: coupon, discountKes: discount, loading: false })
          return { success: true, coupon, discount }
        } catch {
          set({ loading: false, error: 'Invalid or expired coupon' })
          return { success: false }
        }
      },

      removeCoupon: () => set({ couponCode: '', couponRecord: null, discountKes: 0 }),

      // ── Loyalty Redemption ────────────────────────────────────────────────────
      // 100 points = KES 50
      setLoyaltyRedemption: (points) => {
        set({ loyaltyToRedeem: points, loyaltyDiscount: Math.floor(points / 100) * 50 })
      },

      clearLoyaltyRedemption: () => set({ loyaltyToRedeem: 0, loyaltyDiscount: 0 }),

      // ── Set Delivery Zone ─────────────────────────────────────────────────────
      setDelivery: (feeKes, zoneId) => {
        set({ deliveryFeeKes: feeKes, deliveryZoneId: zoneId })
        // Free delivery coupon offsets the fee
        const { couponRecord } = get()
        if (couponRecord?.type === 'free_delivery') {
          set({ discountKes: feeKes })
        }
      },

      // ── Flush Offline Queue ───────────────────────────────────────────────────
      flushOfflineQueue: async () => {
        const store = get()

        await safeFlushQueue({
          cart_add: async ({ userId, productId, variantSku, qty, priceKes }) => {
            const existing = await pb
              .collection('sg_cart_items')
              .getFirstListItem(
                `user_id = "${userId}" && product_id = "${productId}" && variant_sku = "${variantSku}"`
              )
              .catch(() => null)

            if (existing) {
              await pb.collection('sg_cart_items').update(existing.id, { qty: existing.qty + qty })
            } else {
              await pb.collection('sg_cart_items').create({
                user_id: userId, product_id: productId, variant_sku: variantSku,
                qty, price_kes: priceKes, added_at: new Date().toISOString(),
              })
            }
          },
          cart_remove: async ({ userId, productId, variantSku }) => {
            const rec = await pb
              .collection('sg_cart_items')
              .getFirstListItem(`user_id = "${userId}" && product_id = "${productId}" && variant_sku = "${variantSku}"`)
              .catch(() => null)
            if (rec) await pb.collection('sg_cart_items').delete(rec.id)
          },
          cart_update: async ({ userId, productId, variantSku, qty }) => {
            const rec = await pb
              .collection('sg_cart_items')
              .getFirstListItem(`user_id = "${userId}" && product_id = "${productId}" && variant_sku = "${variantSku}"`)
              .catch(() => null)
            if (rec) await pb.collection('sg_cart_items').update(rec.id, { qty })
          },
        })

        await store.loadServerCart()
      },
    }),
    {
      name: 'sg_cart',
      partialize: (state) => ({
        items:           state.items,
        couponCode:      state.couponCode,
        loyaltyToRedeem: state.loyaltyToRedeem,
        loyaltyDiscount: state.loyaltyDiscount,
      }),
      // Scrub any malformed items from old storage formats on hydration
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.items)) {
          state.items = state.items.filter(i => i?.product?.id)
        }
      },
    }
  )
)

// Auto flush offline queue when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useCartStore.getState().flushOfflineQueue()
  })
}

export default useCartStore