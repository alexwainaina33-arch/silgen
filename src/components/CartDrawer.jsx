// src/components/CartDrawer.jsx
// ── Ultimate Cart Drawer ──────────────────────────────────────────────────────
// Combines the best of both versions + Feature #3: Smart Upsell in Cart
// Best-of: v1 (full product objects, clear cart, stock warnings, loyalty toggle UX)
//          v2 (offline queue, loyalty slider, subscription upsell, WhatsApp)
// New:     AI-powered "You may also like" upsell section below cart items

import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useCartStore from '../store/cart.js'
import useAuthStore from '../store/auth.js'
import useTranslation from '../hooks/useTranslation.js'
import { useCurrencyStore } from './CurrencySelector.jsx'
import { formatPrice } from '../lib/currency.js'
import { getProductImageUrl } from '../hooks/useProducts.js'
import pb from '../lib/pb.js'

// ── Constants ─────────────────────────────────────────────────────────────────
const FREE_DELIVERY_THRESHOLD = 5000
const DELIVERY_FEE = 300

// ── Free Delivery Progress Bar ────────────────────────────────────────────────
function FreeDeliveryBar({ subtotal }) {
  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal)
  const pct = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)

  if (subtotal >= FREE_DELIVERY_THRESHOLD) {
    return (
      <div className="mx-4 mb-3 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
        <span className="text-base">🎉</span>
        <p className="text-xs font-bold text-emerald-700">You've unlocked FREE delivery!</p>
      </div>
    )
  }

  return (
    <div className="mx-4 mb-3 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
      <p className="text-xs text-amber-800 mb-1.5">
        Add <strong>KES {remaining.toLocaleString()}</strong> more for free delivery 🚚
      </p>
      <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Loyalty Redemption Panel ──────────────────────────────────────────────────
// v1 toggle style (simpler UX) with v2's slider for precision
function LoyaltyRedemption({ points, subtotal, loyaltyToRedeem, onRedeem }) {
  const [expanded, setExpanded] = useState(false)

  if (!points || points < 100) return null

  const maxRedeemPts = Math.min(points, Math.floor((subtotal / 50) * 100))
  const loyaltyDiscount = Math.floor(loyaltyToRedeem / 100) * 50

  return (
    <div className="mx-4 mb-3 rounded-xl border-2 border-amber-200 bg-amber-50 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-3"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">⭐</span>
          <div className="text-left">
            <p className="text-xs font-bold text-amber-900">Use Loyalty Points</p>
            <p className="text-xs text-amber-600">
              {points.toLocaleString()} pts available
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loyaltyToRedeem > 0 && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
              -KES {loyaltyDiscount}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-amber-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-amber-100">
          <div className="flex items-center gap-3 mt-2 mb-1">
            <input
              type="range"
              min={0}
              max={maxRedeemPts}
              step={100}
              value={loyaltyToRedeem}
              onChange={e => onRedeem(Number(e.target.value))}
              className="flex-1 accent-amber-500"
            />
            <span className="text-sm font-black text-amber-900 w-20 text-right shrink-0">
              {loyaltyToRedeem} pts
            </span>
          </div>
          <div className="flex justify-between text-xs text-amber-600">
            <span>0</span>
            <span className="font-semibold">
              {loyaltyToRedeem > 0 ? `Save KES ${loyaltyDiscount}` : 'Slide to redeem'}
            </span>
            <span>{maxRedeemPts} max</span>
          </div>
          {loyaltyToRedeem > 0 && (
            <button
              onClick={() => onRedeem(0)}
              className="mt-2 text-xs text-amber-500 hover:text-amber-700 underline"
            >Clear points</button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Cart Item Row ─────────────────────────────────────────────────────────────
// Best of v1: full product object, stock warnings, smooth remove animation
function CartItem({ item, currency, rates, onRemove, onUpdateQty }) {
  const [removing, setRemoving] = useState(false)

  const handleRemove = () => {
    setRemoving(true)
    setTimeout(() => onRemove(item.product.id, item.variantSku), 300)
  }

  const isLowStock = item.product.track_inventory &&
    item.product.stock_qty > 0 &&
    item.product.stock_qty <= 5

  const isOutOfStock = item.product.track_inventory &&
    item.product.stock_qty <= 0

  const price = item.price || item.product.price_kes

  return (
    <div className={`flex gap-3 px-4 py-3 border-b border-gray-100 transition-all duration-300 ${
      removing ? 'opacity-0 -translate-x-4' : 'opacity-100'
    } ${isOutOfStock ? 'bg-red-50/50' : ''}`}>
      {/* Image */}
      <Link to={`/product/${item.product.slug}`} className="shrink-0">
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
          {item.product.thumbnail ? (
            <img
              src={getProductImageUrl(item.product, item.product.thumbnail, '150x150')}
              alt={item.product.name_en}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">🍼</div>
          )}
        </div>
      </Link>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <Link to={`/product/${item.product.slug}`}>
          <p className="text-sm font-bold text-gray-900 leading-tight line-clamp-2 hover:text-emerald-600 transition-colors">
            {item.product.name_en}
          </p>
        </Link>
        {item.variantLabel && (
          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
            {item.variantLabel}
          </span>
        )}
        {isOutOfStock && (
          <p className="text-xs text-red-500 font-bold mt-0.5">⚠️ Out of stock</p>
        )}
        {isLowStock && !isOutOfStock && (
          <p className="text-xs text-orange-500 font-semibold mt-0.5">
            🔥 Only {item.product.stock_qty} left!
          </p>
        )}

        <div className="flex items-center justify-between mt-2">
          {/* Qty stepper */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => onUpdateQty(item.product.id, item.variantSku, item.qty - 1)}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors font-bold"
            >−</button>
            <span className="w-8 text-center text-sm font-black text-gray-900 select-none">{item.qty}</span>
            <button
              onClick={() => onUpdateQty(item.product.id, item.variantSku, item.qty + 1)}
              disabled={item.product.track_inventory && item.qty >= item.product.stock_qty}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors font-bold disabled:opacity-30"
            >+</button>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-black text-gray-900">
                {formatPrice(price * item.qty, currency, rates)}
              </p>
              {item.qty > 1 && (
                <p className="text-xs text-gray-400">{formatPrice(price, currency, rates)} each</p>
              )}
            </div>
            <button
              onClick={handleRemove}
              className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors rounded-full hover:bg-red-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ✨ NEW: Smart Upsell Section ───────────────────────────────────────────────
// Feature #3: "Customers who bought this also bought..."
// Fetches related products from PocketBase based on category/tags of cart items
function SmartUpsell({ cartItems, open, onAddItem, currency, rates }) {
  const [upsellProducts, setUpsellProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [addedIds, setAddedIds] = useState(new Set())

  const stableCartIds = cartItems
    .map(i => i?.product?.id)
    .filter(Boolean)
    .sort()
    .join(',')

  useEffect(() => {
    if (!open || !cartItems.length) return

    const fetchUpsells = async () => {
      setLoading(true)
      try {
        // Get category_ids from cart items for related product suggestions
        const categoryIds = [...new Set(
          cartItems.filter(i => i?.product?.category_id).map(i => i.product.category_id)
        )]

        // Exclude products already in cart
        const cartProductIds = cartItems.filter(i => i?.product?.id).map(i => i.product.id)
        const excludeParts = cartProductIds.map(id => `id != '${id}'`)

        // PocketBase requires single quotes for string values in filters
        let filter = "status = 'active'"
        if (categoryIds.length) {
          const catParts = categoryIds.map(id => `category_id = '${id}'`).join(' || ')
          filter += ` && (${catParts})`
        }
        if (excludeParts.length) {
          filter += ` && ${excludeParts.join(' && ')}`
        }

        const encoded = encodeURIComponent(filter)
        const r = await fetch(
          `${import.meta.env.VITE_PB_URL}/api/collections/sg_products/records?filter=${encoded}&perPage=9&sort=-sales_count`
        )
        const results = await r.json()
        const shuffled = (results.items || []).sort(() => Math.random() - 0.5).slice(0, 3)
        setUpsellProducts(shuffled)
      } catch (err) {
        // Fail silently — upsell is non-critical
        console.warn('[Upsell] Failed to fetch:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUpsells()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableCartIds, open])

  const handleAdd = (product) => {
    onAddItem(product, 1)
    setAddedIds(prev => new Set([...prev, product.id]))
    // Reset "Added" state after 2s
    setTimeout(() => {
      setAddedIds(prev => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }, 2000)
  }

  if (loading) {
    return (
      <div className="mx-4 my-4 p-4 bg-gray-50 rounded-2xl animate-pulse">
        <div className="h-3 bg-gray-200 rounded w-40 mb-3" />
        <div className="flex gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-1 space-y-2">
              <div className="h-20 bg-gray-200 rounded-xl" />
              <div className="h-2 bg-gray-200 rounded w-3/4" />
              <div className="h-2 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!upsellProducts.length) return null

  return (
    <div className="mx-4 my-4">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap px-2">
          🛍️ Customers also bought
        </p>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </div>

      {/* Product cards */}
      <div className="flex gap-3">
        {upsellProducts.map(product => {
          const isAdded = addedIds.has(product.id)
          const thumbUrl = product.thumbnail
            ? getProductImageUrl(product, product.thumbnail, '150x150')
            : null

          return (
            <div
              key={product.id}
              className="flex-1 flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200 group"
            >
              {/* Image */}
              <Link to={`/product/${product.slug}`} className="block">
                <div className="relative h-20 bg-gray-50 overflow-hidden">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={product.name_en}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200 text-3xl">🍼</div>
                  )}
                  {/* Badge */}
                  {product.sales_count > 50 && (
                    <span className="absolute top-1 left-1 bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                      Popular
                    </span>
                  )}
                </div>
              </Link>

              {/* Info */}
              <div className="p-2 flex flex-col flex-1">
                <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2 mb-1 flex-1">
                  {product.name_en}
                </p>
                <p className="text-xs font-black text-emerald-700 mb-2">
                  {formatPrice(product.price_kes, currency, rates)}
                </p>

                {/* Add button */}
                <button
                  onClick={() => handleAdd(product)}
                  disabled={isAdded}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 ${
                    isAdded
                      ? 'bg-emerald-100 text-emerald-700 cursor-default'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Added!
                    </>
                  ) : (
                    <>
                      <span>+</span> Add
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Subscription Upsell Banner ────────────────────────────────────────────────
// From v2 — shown when a subscribable item is in cart
function SubscriptionUpsell({ items, onClose, navigate }) {
  const hasSubscribable = items.some(i => i.product?.is_subscription)
  if (!hasSubscribable) return null

  return (
    <div className="mx-4 mb-3 px-3 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
      <div className="flex items-start gap-2">
        <span className="text-lg shrink-0">🔄</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-emerald-900">Save 15% — Subscribe & Save</p>
          <p className="text-xs text-emerald-700 mt-0.5">Auto-deliver every month. Cancel anytime.</p>
          <button
            onClick={() => { onClose(); navigate('/subscriptions') }}
            className="mt-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800 underline underline-offset-2"
          >
            Set up subscription →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Empty Cart ────────────────────────────────────────────────────────────────
function EmptyCart({ onClose, navigate }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-5">
        <svg className="w-12 h-12 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <h3 className="text-xl font-black text-gray-900 mb-2">Your cart is empty</h3>
      <p className="text-sm text-gray-500 text-center mb-6">
        Add something amazing for the little ones 👶
      </p>
      <button
        onClick={() => { onClose(); navigate('/shop') }}
        className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors"
      >
        Start Shopping →
      </button>
    </div>
  )
}

// ── Main CartDrawer ───────────────────────────────────────────────────────────
export default function CartDrawer({ open, onClose }) {
  const { items, getSubtotal, getItemCount, clearCart, updateQty, removeItem, addItem } = useCartStore()
  const { user } = useAuthStore()
  const { currency, rates } = useCurrencyStore()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { loyaltyToRedeem, loyaltyDiscount, setLoyaltyRedemption } = useCartStore()
  const setLoyaltyToRedeem = setLoyaltyRedemption
  const loyaltyPoints = user?.loyalty_points || 0

  const subtotal = getSubtotal()
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE
  const total = Math.max(0, subtotal + deliveryFee - loyaltyDiscount)
  const itemCount = getItemCount()
  const loyaltyEarned = Math.floor(total)

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      // Reset loyalty on close
      setLoyaltyToRedeem(0)
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleCheckout = () => {
    onClose()
    navigate('/checkout')
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-black text-gray-900 text-lg leading-none">Your Cart</h2>
              {itemCount > 0 && (
                <p className="text-xs text-gray-500">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={() => { if (window.confirm('Clear your entire cart?')) clearCart() }}
                className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        {items.length === 0 ? (
          <EmptyCart onClose={onClose} navigate={navigate} />
        ) : (
          <>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="pt-3">
                {/* Free delivery bar */}
                <FreeDeliveryBar subtotal={subtotal} />

                {/* Loyalty redemption */}
                {user && (
                  <LoyaltyRedemption
                    points={loyaltyPoints}
                    subtotal={subtotal}
                    loyaltyToRedeem={loyaltyToRedeem}
                    onRedeem={setLoyaltyToRedeem}
                  />
                )}

                {/* Subscription upsell */}
                <SubscriptionUpsell items={items} onClose={onClose} navigate={navigate} />
              </div>

              {/* Cart items — filter guards against stale/malformed persisted data */}
              <div className="divide-y divide-gray-50">
                {items.filter(item => item?.product?.id).map(item => (
                  <CartItem
                    key={`${item.product.id}-${item.variantSku || ''}`}
                    item={item}
                    currency={currency}
                    rates={rates}
                    onRemove={removeItem}
                    onUpdateQty={updateQty}
                  />
                ))}
              </div>

              {/* ✨ Smart Upsell — Feature #3 */}
              <SmartUpsell
                cartItems={items}
                open={open}
                onAddItem={addItem}
                currency={currency}
                rates={rates}
              />

              {/* Loyalty earn preview */}
              {user && (
                <div className="mx-4 mt-2 mb-3 px-3 py-2 bg-amber-50 rounded-xl flex items-center gap-2">
                  <span className="text-sm">⭐</span>
                  <p className="text-xs text-amber-800">
                    You'll earn <strong>{loyaltyEarned} points</strong> on this order
                  </p>
                </div>
              )}

              {/* WhatsApp order option */}
              <div className="mx-4 mb-4">
                <a
                  href={`https://wa.me/${(import.meta.env.VITE_WA_PHONE_NUMBER_ID || '254700000000').replace(/\D/g, '')}?text=${encodeURIComponent(
                    '🛒 I want to order:\n' + items.map(i => `• ${i.qty}× ${i.product.name_en}`).join('\n') +
                    `\n\nTotal: KES ${subtotal.toLocaleString()}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 border-2 border-[#25D366] text-[#25D366] font-semibold rounded-xl hover:bg-[#25D366] hover:text-white transition-all text-sm"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Order via WhatsApp
                </a>
              </div>
            </div>

            {/* ── Footer Summary ──────────────────────────────────────── */}
            <div className="shrink-0 border-t border-gray-100 bg-white">
              <div className="px-4 pt-3 pb-2 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
                  <span className="font-semibold">{formatPrice(subtotal, currency, rates)}</span>
                </div>
                {deliveryFee > 0 ? (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Delivery</span>
                    <span className="font-semibold">{formatPrice(deliveryFee, currency, rates)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Delivery</span>
                    <span className="font-bold">FREE 🎉</span>
                  </div>
                )}
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>⭐ Loyalty discount</span>
                    <span className="font-bold">-{formatPrice(loyaltyDiscount, currency, rates)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="font-black text-gray-900 text-base">Total</span>
                  <span className="font-black text-gray-900 text-xl">
                    {formatPrice(total, currency, rates)}
                  </span>
                </div>
              </div>

              <div className="px-4 pb-safe pb-4 pt-2">
                {user ? (
                  <button
                    onClick={handleCheckout}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black rounded-xl transition-all text-base flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/25"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Secure Checkout · {formatPrice(total, currency, rates)}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => { onClose(); navigate('/login') }}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-colors text-sm"
                    >
                      Sign In to Checkout
                    </button>
                    <button
                      onClick={() => { onClose(); navigate('/register') }}
                      className="w-full py-3.5 border-2 border-emerald-600 text-emerald-700 font-black rounded-xl hover:bg-emerald-50 transition-colors text-sm"
                    >
                      Create Account — Get 200 Bonus Points 🎁
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-center gap-4 mt-3">
                  <span className="text-xs text-gray-400">🔒 SSL Secured</span>
                  <span className="text-xs text-gray-400">↩️ Easy Returns</span>
                  <span className="text-xs text-gray-400">⚡ Fast Delivery</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}