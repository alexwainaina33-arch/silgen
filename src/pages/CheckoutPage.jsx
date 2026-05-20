// src/pages/CheckoutPage.jsx
// Full checkout: address → payment (5 gateways) → STK push polling → confirm
// Feature #9:  Subscription upsell banner in payment step
// Feature #13: Remembered M-Pesa number badge
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import useCheckout, { calcLoyaltyDiscount } from '../hooks/useCheckout.js'
import useAuthStore from '../store/auth.js'
import useCartStore from '../store/cart.js'
import useTranslation from '../hooks/useTranslation.js'
import { useCurrencyStore } from '../components/CurrencySelector.jsx'
import { formatPrice } from '../lib/currency.js'
import { normaliseMpesaPhone } from '../lib/mpesa.js'
import { getProductImageUrl } from '../hooks/useProducts.js'
import pb from '../lib/pb.js'
import Btn from '../components/ui/Btn.jsx'
import toast from 'react-hot-toast'

// ─── Step indicator ────────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = ['Address', 'Payment', 'Processing', 'Done']
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const num    = i + 1
        const active = step === num
        const done   = step > num
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
                done    ? 'bg-emerald-600 text-white'
                : active ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                : 'bg-gray-100 text-gray-400'
              }`}>
                {done ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : num}
              </div>
              <span className={`text-xs mt-1 font-semibold hidden sm:block ${
                active || done ? 'text-emerald-700' : 'text-gray-400'
              }`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 sm:w-20 h-0.5 mx-1 transition-colors duration-500 ${
                step > num ? 'bg-emerald-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Address card ──────────────────────────────────────────────
function AddressCard({ address, selected, onSelect, zones }) {
  const zone = zones.find(z => z.id === address.delivery_zone_id)
  return (
    <button
      onClick={() => onSelect(address)}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
        selected
          ? 'border-emerald-600 bg-emerald-50 shadow-sm'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="font-bold text-gray-900 text-sm">{address.full_name}</p>
            {address.label && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {address.label}
              </span>
            )}
            {address.is_default && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                Default
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">{address.line1}{address.line2 ? `, ${address.line2}` : ''}</p>
          <p className="text-sm text-gray-500">{[address.estate, address.county, address.town].filter(Boolean).join(', ')}</p>
          <p className="text-sm text-gray-500">{address.phone}</p>
          {zone && (
            <p className="text-xs text-emerald-600 mt-1 font-medium">
              🚚 {zone.name} — {zone.fee_kes <= 1 ? 'FREE pickup' : `KES ${zone.fee_kes} delivery`}
              {zone.fee_kes > 1 && zone.free_above_kes > 0 && ` (free above KES ${zone.free_above_kes.toLocaleString()})`}
            </p>
          )}
        </div>
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
          selected ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'
        }`}>
          {selected && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Address form ──────────────────────────────────────────────
function AddressForm({ userId, zones, onSaved }) {
  const [form,   setForm]   = useState({ label:'Home', full_name:'', phone:'', line1:'', line2:'', estate:'', county:'', town:'Kenya', country:'Kenya', delivery_zone_id:'', is_default: false })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const rec = await pb.collection('sg_addresses').create({ ...form, user_id: userId })
      onSaved(rec)
      toast.success('Address saved!')
    } catch {
      toast.error('Failed to save address')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={save} className="space-y-3 mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
      <p className="font-bold text-gray-900 text-sm mb-3">New Delivery Address</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Label</label>
          <select value={form.label} onChange={e => set('label', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            {['Home','Work','Partner','Parents','Other'].map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Delivery Zone *</label>
          <select required value={form.delivery_zone_id} onChange={e => set('delivery_zone_id', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            <option value="">Select zone…</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name} — {z.fee_kes <= 1 ? 'FREE' : `KES ${z.fee_kes}`}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Full Name *</label>
          <input required value={form.full_name} onChange={e => set('full_name', e.target.value)}
            placeholder="Jane Wanjiku"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Phone *</label>
          <input required value={form.phone} onChange={e => set('phone', e.target.value)}
            placeholder="0712 345 678"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Address Line 1 *</label>
        <input required value={form.line1} onChange={e => set('line1', e.target.value)}
          placeholder="House/Apt number, Street name"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Estate/Area</label>
          <input value={form.estate} onChange={e => set('estate', e.target.value)}
            placeholder="Westlands"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">County *</label>
          <input required value={form.county} onChange={e => set('county', e.target.value)}
            placeholder="Nairobi"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_default} onChange={e => set('is_default', e.target.checked)}
          className="w-4 h-4 accent-emerald-600 rounded" />
        <span className="text-sm text-gray-600">Set as default address</span>
      </label>
      <Btn type="submit" loading={saving} variant="primary" size="md">Save Address</Btn>
    </form>
  )
}

// ─── Payment method card ───────────────────────────────────────
function PaymentCard({ id, selected, onSelect, icon, title, subtitle, badge }) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
        selected ? 'border-emerald-600 bg-emerald-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
          selected ? 'bg-emerald-100' : 'bg-gray-100'
        }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-gray-900 text-sm">{title}</p>
            {badge && (
              <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
          selected ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'
        }`}>
          {selected && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── M-Pesa STK Waiting screen ─────────────────────────────────
function MpesaStkWaiting({ status, secondsLeft, phone, onCancel }) {
  const pct = ((120 - secondsLeft) / 120) * 100

  return (
    <div className="flex flex-col items-center text-center py-8 px-6">
      <div className="relative mb-6">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-2xl ${
          status === 'success' ? 'bg-emerald-100 shadow-emerald-200' :
          status === 'failed'  ? 'bg-red-100 shadow-red-200' :
          'bg-amber-50 shadow-amber-200'
        }`}>
          {status === 'success' ? '✅' : status === 'failed' ? '❌' : '📱'}
        </div>
        {status === 'waiting' && (
          <>
            <div className="absolute inset-0 rounded-full border-4 border-amber-300 animate-ping opacity-40" />
            <div className="absolute inset-0 rounded-full border-2 border-amber-400 animate-pulse" />
          </>
        )}
      </div>

      {status === 'waiting' && (
        <>
          <h2 className="text-xl font-black text-gray-900 mb-2">Check Your Phone</h2>
          <p className="text-gray-500 mb-1 text-sm">M-Pesa prompt sent to</p>
          <p className="font-bold text-gray-900 mb-1">{phone}</p>
          <p className="text-sm text-gray-500 mb-6">Enter your <strong>M-Pesa PIN</strong> to complete payment</p>

          <div className="relative w-20 h-20 mb-4">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={secondsLeft > 30 ? '#059669' : secondsLeft > 10 ? '#f59e0b' : '#ef4444'}
                strokeWidth="2.5"
                strokeDasharray={`${pct} 100`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-black ${
                secondsLeft > 30 ? 'text-gray-800' : secondsLeft > 10 ? 'text-amber-600' : 'text-red-600'
              }`}>{secondsLeft}s</span>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-6">Checking automatically every 3 seconds…</p>

          <div className="w-full bg-gray-100 rounded-2xl p-4 mb-6 text-left space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Having trouble?</p>
            <p className="text-xs text-gray-600">1. Check if your M-Pesa is registered on <strong>{phone}</strong></p>
            <p className="text-xs text-gray-600">2. Make sure you have enough M-Pesa balance</p>
            <p className="text-xs text-gray-600">3. Check network connection and try again</p>
          </div>

          <button onClick={onCancel}
            className="text-sm text-gray-400 hover:text-red-500 underline underline-offset-2 transition-colors">
            Cancel and choose another payment method
          </button>
        </>
      )}

      {status === 'timeout' && (
        <>
          <h2 className="text-xl font-black text-gray-900 mb-2">Request Timed Out</h2>
          <p className="text-gray-500 mb-6">The M-Pesa prompt expired. Please try again.</p>
          <button onClick={onCancel}
            className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors">
            Try Again
          </button>
        </>
      )}

      {status === 'failed' && (
        <>
          <h2 className="text-xl font-black text-red-600 mb-2">Payment Failed</h2>
          <p className="text-gray-500 mb-6">The payment was cancelled or failed. Please try again.</p>
          <button onClick={onCancel}
            className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors">
            Choose Another Method
          </button>
        </>
      )}
    </div>
  )
}

// ─── Order summary sidebar ─────────────────────────────────────
function OrderSummary({
  items, subtotal, deliveryFee, couponDiscount, loyaltyDiscount, subscriptionDiscount, total,
  couponCode, setCouponCode, couponData, couponError, couponLoading,
  validateCoupon, loyaltyBalance, loyaltyToRedeem, setLoyaltyToRedeem,
  loyaltyEarned, currency, rates, user,
}) {
  const maxRedeem = Math.min(loyaltyBalance, Math.floor((subtotal / 50) * 100))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-24">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h3 className="font-black text-gray-900">Order Summary</h3>
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
        {items.map(item => {
          const thumbUrl = item.product.thumbnail
            ? getProductImageUrl(item.product, item.product.thumbnail, '150x150')
            : item.product.thumbnail_url || null
          return (
            <div key={item.product.id + item.variantSku} className="flex items-center gap-3 px-5 py-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0 relative">
                {thumbUrl
                  ? <img src={thumbUrl} alt={item.product.name_en} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-lg">🍼</div>}
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-gray-700 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {item.qty}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{item.product.name_en}</p>
                {item.variantLabel && <p className="text-xs text-gray-400">{item.variantLabel}</p>}
              </div>
              <p className="text-xs font-bold text-gray-900 shrink-0">
                {formatPrice(item.product.price_kes * item.qty, currency, rates)}
              </p>
            </div>
          )
        })}
      </div>

      {/* Coupon */}
      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Discount Code</p>
        <div className="flex gap-2">
          <input
            value={couponCode}
            onChange={e => setCouponCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && validateCoupon()}
            placeholder="WELCOME10"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono uppercase"
          />
          <button
            onClick={validateCoupon}
            disabled={couponLoading || !couponCode.trim()}
            className="px-3 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {couponLoading ? '…' : 'Apply'}
          </button>
        </div>
        {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
        {couponData && (
          <p className="text-xs text-emerald-600 font-semibold mt-1">
            ✅ {couponData.code} applied — save {
              couponData.type === 'percent' ? `${couponData.value}%` :
              couponData.type === 'free_delivery' ? 'delivery fee' :
              `KES ${couponData.value}`
            }
          </p>
        )}
      </div>

      {/* Loyalty slider */}
      {user && loyaltyBalance >= 100 && maxRedeem > 0 && (
        <div className="px-5 py-4 border-t border-amber-100 bg-amber-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-amber-800">⭐ Redeem Points</p>
            <p className="text-xs text-amber-600">{loyaltyBalance.toLocaleString()} pts available</p>
          </div>
          <input
            type="range" min={0} max={maxRedeem} step={100} value={loyaltyToRedeem}
            onChange={e => setLoyaltyToRedeem(Number(e.target.value))}
            className="w-full accent-amber-500 mb-1"
          />
          <div className="flex justify-between text-xs text-amber-600">
            <span>0</span>
            <span className="font-bold">
              {loyaltyToRedeem > 0
                ? `${loyaltyToRedeem} pts → -KES ${calcLoyaltyDiscount(loyaltyToRedeem).toLocaleString()}`
                : 'Slide to use points'}
            </span>
            <span>{maxRedeem}</span>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="px-5 py-4 border-t border-gray-100 space-y-2">
        <div className="flex justify-between text-sm text-gray-500">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal, currency, rates)}</span>
        </div>
        {couponDiscount > 0 && (
          <div className="flex justify-between text-sm text-emerald-600">
            <span>Coupon ({couponData?.code})</span>
            <span>-{formatPrice(couponDiscount, currency, rates)}</span>
          </div>
        )}
        {loyaltyDiscount > 0 && (
          <div className="flex justify-between text-sm text-amber-600">
            <span>⭐ Loyalty points</span>
            <span>-{formatPrice(loyaltyDiscount, currency, rates)}</span>
          </div>
        )}
        {subscriptionDiscount > 0 && (
          <div className="flex justify-between text-sm text-emerald-600">
            <span>🔄 Subscription 20% off</span>
            <span>-{formatPrice(subscriptionDiscount, currency, rates)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-gray-500">
          <span>Delivery</span>
          <span>{deliveryFee === 0 ? '🎉 FREE' : formatPrice(deliveryFee, currency, rates)}</span>
        </div>
        <div className="flex justify-between text-base font-black text-gray-900 border-t border-gray-100 pt-2">
          <span>Total</span>
          <span className="text-emerald-700">{formatPrice(total, currency, rates)}</span>
        </div>
        {loyaltyEarned > 0 && (
          <p className="text-xs text-amber-600 text-center">
            ⭐ You'll earn <strong>{loyaltyEarned.toLocaleString()} loyalty points</strong> on this order
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────
export default function CheckoutPage() {
  const { user }            = useAuthStore()
  const { items }           = useCartStore()
  const navigate            = useNavigate()
  const location            = useLocation()
  const { currency, rates } = useCurrencyStore()

  const co = useCheckout()

  const [addresses,    setAddresses]    = useState([])
  const [zones,        setZones]        = useState([])
  const [showAddrForm, setShowAddrForm] = useState(false)
  const [phoneValid,   setPhoneValid]   = useState(true)

  // Redirect guards
  useEffect(() => {
    if (!user) navigate('/login?redirect=/checkout')
    if (items.length === 0 && co.step < 4 && !co.createdOrder && !co.processing) navigate('/shop')
  }, [user, items.length, co.step, co.createdOrder, co.processing])

  // Pre-fill loyalty from cart drawer if passed via state
  useEffect(() => {
    if (location.state?.loyaltyToRedeem) {
      co.setLoyaltyToRedeem(location.state.loyaltyToRedeem)
    }
  }, [])

  // When payment confirmed, navigate to the canonical confirm page
  useEffect(() => {
    if (co.step === 4 && co.createdOrder) {
      const dest = co.createdOrder.ref?.startsWith('SG-') ? co.createdOrder.ref : co.createdOrder.id
      if (dest) navigate(`/order-confirm/${dest}`, { replace: true })
    }
  }, [co.step, co.createdOrder, navigate])

  // Load addresses and delivery zones
  useEffect(() => {
    if (!user) return
    Promise.all([
      pb.collection('sg_addresses').getFullList({
        filter: `user_id = "${user.id}"`, sort: '-is_default',
      }),
      pb.collection('sg_delivery_zones').getFullList({
        filter: 'is_active = true', sort: 'fee_kes',
      }),
    ]).then(([addrs, zns]) => {
      setAddresses(addrs)
      setZones(zns)
      const def = addrs.find(a => a.is_default) || addrs[0]
      if (def) {
        co.setSelectedAddressId(def.id)
        const zone = zns.find(z => z.id === def.delivery_zone_id)
        if (zone) co.setDeliveryZone(zone)
      }
    }).catch(() => {})
  }, [user?.id])

  const handleAddressSaved = (newAddr) => {
    setAddresses(a => [...a, newAddr])
    co.setSelectedAddressId(newAddr.id)
    const zone = zones.find(z => z.id === newAddr.delivery_zone_id)
    if (zone) co.setDeliveryZone(zone)
    setShowAddrForm(false)
  }

  const handleAddressSelect = (addr) => {
    co.setSelectedAddressId(addr.id)
    const zone = zones.find(z => z.id === addr.delivery_zone_id)
    co.setDeliveryZone(zone || null)
  }

  if (!user || (items.length === 0 && co.step < 4 && !co.createdOrder)) return null

  // ── Step 3: Processing / STK waiting ──────────────────────
  if (co.step === 3) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <StepIndicator step={3} />
            </div>

            {co.paymentMethod === 'mpesa_stk' ? (
              <MpesaStkWaiting
                status={co.stkStatus}
                secondsLeft={co.stkSecondsLeft}
                phone={co.mpesaPhone}
                onCancel={() => { co.setStep(2); co.setError('') }}
              />
            ) : (
              <div className="flex flex-col items-center py-12 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                  <svg className="animate-spin w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-2">Processing…</h2>
                <p className="text-gray-500 text-sm">{co.processingMsg}</p>
              </div>
            )}
          </div>
        </div>
      </Layout>
    )
  }

  // Step 4 — handled by /order-confirm/:ref (see useEffect above)
  if (co.step === 4) return null

  // ── Steps 1 & 2: Main checkout ─────────────────────────────
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/shop" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors w-fit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to shop
          </Link>
          <h1 className="text-3xl font-black text-gray-900">Checkout</h1>
          <StepIndicator step={co.step} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Left: form ────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── STEP 1: Address ───────────────────────── */}
            <div className={`transition-all ${co.step !== 1 ? 'opacity-60 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-black">1</div>
                  <h2 className="text-xl font-black text-gray-900">Delivery Address</h2>
                </div>
                {co.step === 2 && (
                  <button onClick={() => co.setStep(1)} className="text-sm text-emerald-600 font-semibold hover:text-emerald-700">
                    Edit
                  </button>
                )}
              </div>

              {co.step === 1 && (
                <>
                  {addresses.length > 0 ? (
                    <div className="space-y-3">
                      {addresses.map(addr => (
                        <AddressCard
                          key={addr.id}
                          address={addr}
                          selected={co.selectedAddressId === addr.id}
                          onSelect={handleAddressSelect}
                          zones={zones}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-center">
                      <p className="text-gray-500 text-sm mb-2">No saved addresses yet</p>
                      <p className="text-gray-400 text-xs">Add a delivery address to continue</p>
                    </div>
                  )}

                  {!showAddrForm ? (
                    <button
                      onClick={() => setShowAddrForm(true)}
                      className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      <span className="w-6 h-6 rounded-full border-2 border-emerald-600 flex items-center justify-center text-sm font-black">+</span>
                      Add new address
                    </button>
                  ) : (
                    <AddressForm userId={user.id} zones={zones} onSaved={handleAddressSaved} />
                  )}

                  {/* Gift toggle */}
                  <div className="mt-5 p-4 bg-pink-50 border border-pink-200 rounded-2xl">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={co.isGift}
                        onChange={e => co.setIsGift(e.target.checked)}
                        className="w-4 h-4 accent-pink-500 rounded"
                      />
                      <div>
                        <p className="text-sm font-bold text-gray-900">🎁 This is a gift</p>
                        <p className="text-xs text-gray-500">Send to someone in Kenya — perfect for diaspora orders</p>
                      </div>
                    </label>
                    {co.isGift && (
                      <div className="mt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">Recipient Name *</label>
                            <input
                              value={co.giftDetails.name}
                              onChange={e => co.setGiftDetails(g => ({ ...g, name: e.target.value }))}
                              placeholder="Jane Wanjiku"
                              className="w-full px-3 py-2.5 border border-pink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">Recipient Phone *</label>
                            <input
                              value={co.giftDetails.phone}
                              onChange={e => co.setGiftDetails(g => ({ ...g, phone: e.target.value }))}
                              placeholder="0712 345 678"
                              className="w-full px-3 py-2.5 border border-pink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">Gift Message</label>
                          <textarea
                            value={co.giftDetails.message}
                            onChange={e => co.setGiftDetails(g => ({ ...g, message: e.target.value }))}
                            placeholder="Write your personal message here…"
                            rows={2}
                            className="w-full px-3 py-2.5 border border-pink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
                          />
                        </div>
                        <div className="text-xs text-pink-600 bg-pink-100 px-3 py-2 rounded-xl">
                          💌 Both you and the recipient will receive WhatsApp updates throughout delivery
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order notes */}
                  <div className="mt-4">
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Order Notes (optional)</label>
                    <textarea
                      value={co.orderNotes}
                      onChange={e => co.setOrderNotes(e.target.value)}
                      placeholder="Any special delivery instructions…"
                      rows={2}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>

                  <Btn
                    onClick={() => {
                      if (!co.selectedAddressId && addresses.length > 0) {
                        toast.error('Please select a delivery address')
                        return
                      }
                      co.setStep(2)
                    }}
                    variant="primary" size="lg" fullWidth className="mt-5"
                  >
                    Continue to Payment →
                  </Btn>
                </>
              )}

              {/* Collapsed step 1 summary */}
              {co.step === 2 && co.selectedAddressId && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  {(() => {
                    const addr = addresses.find(a => a.id === co.selectedAddressId)
                    return addr ? (
                      <p className="text-sm text-emerald-800">
                        📍 <strong>{addr.full_name}</strong> — {addr.line1}, {addr.estate}, {addr.county}
                      </p>
                    ) : null
                  })()}
                </div>
              )}
            </div>

            {/* ── STEP 2: Payment ───────────────────────── */}
            <div className={`transition-all ${co.step !== 2 ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                  co.step >= 2 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>2</div>
                <h2 className="text-xl font-black text-gray-900">Payment Method</h2>
              </div>

              {co.step === 2 && (
                <>
                  {/* ✨ Feature #9: Subscription upsell — shown when cart has subscribable items */}
                  {items.some(i => i.product?.is_subscription) && (
                    <div className="mb-4 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">🔄</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-emerald-900">Subscribe & Save 20%</p>
                          <p className="text-xs text-emerald-700 mt-0.5">
                            Auto-delivered every month · Cancel anytime · Save on every order
                          </p>
                        </div>
                      </div>
                      <label className="flex items-center gap-3 mt-3 cursor-pointer bg-white border border-emerald-200 rounded-xl px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={co.isSubscription}
                          onChange={e => co.setIsSubscription(e.target.checked)}
                          className="w-4 h-4 accent-emerald-600 rounded shrink-0"
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-emerald-800">
                            Yes — subscribe & save 20%
                          </span>
                          {co.isSubscription && co.subscriptionDiscount > 0 && (
                            <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                              -KES {co.subscriptionDiscount.toLocaleString()} off this order
                            </span>
                          )}
                        </div>
                      </label>
                    </div>
                  )}

                  <div className="space-y-3">
                    <PaymentCard
                      id="mpesa_stk"
                      selected={co.paymentMethod === 'mpesa_stk'}
                      onSelect={co.setPaymentMethod}
                      icon="📲"
                      title="M-Pesa STK Push"
                      subtitle="Get a prompt on your phone — enter PIN to pay instantly"
                      badge="RECOMMENDED"
                    />
                    <PaymentCard
                      id="mpesa_paybill"
                      selected={co.paymentMethod === 'mpesa_paybill'}
                      onSelect={co.setPaymentMethod}
                      icon="🏦"
                      title="M-Pesa Paybill"
                      subtitle="Send money to Paybill 174379 — auto-detected within 60 seconds"
                    />
                    <PaymentCard
                      id="visa_mc"
                      selected={co.paymentMethod === 'visa_mc'}
                      onSelect={co.setPaymentMethod}
                      icon="💳"
                      title="Visa / Mastercard"
                      subtitle="Secure card payment — 3D Secure. Multi-currency for diaspora."
                    />
                    <PaymentCard
                      id="paypal"
                      selected={co.paymentMethod === 'paypal'}
                      onSelect={co.setPaymentMethod}
                      icon="🌐"
                      title="PayPal"
                      subtitle="Pay with PayPal — ideal for diaspora in UK, USA, Canada, Australia"
                    />
                    <PaymentCard
                      id="cod"
                      selected={co.paymentMethod === 'cod'}
                      onSelect={co.setPaymentMethod}
                      icon="💵"
                      title="Cash on Delivery"
                      subtitle="Pay the rider when your order arrives at your door"
                    />
                    {user?.loyalty_points >= 100 && calcLoyaltyDiscount(user.loyalty_points) >= co.total && (
                      <PaymentCard
                        id="loyalty"
                        selected={co.paymentMethod === 'loyalty'}
                        onSelect={co.setPaymentMethod}
                        icon="⭐"
                        title="Pay with Loyalty Points"
                        subtitle={`Use your ${user.loyalty_points.toLocaleString()} points to cover this order`}
                      />
                    )}
                  </div>

                  {/* M-Pesa phone input */}
                  {(co.paymentMethod === 'mpesa_stk' || co.paymentMethod === 'mpesa_paybill') && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                      {/* ✨ Feature #13: "Remembered" badge if number came from localStorage */}
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-gray-600">
                          M-Pesa Phone Number *
                        </label>
                        {localStorage.getItem('sg_mpesa_phone') && (
                          <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            💾 Remembered
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-500 font-mono shrink-0">
                          🇰🇪 +254
                        </span>
                        <input
                          type="tel"
                          value={co.mpesaPhone}
                          onChange={e => {
                            co.setMpesaPhone(e.target.value)
                            setPhoneValid(!!normaliseMpesaPhone(e.target.value))
                          }}
                          placeholder="0712 345 678"
                          className={`flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono ${
                            !phoneValid && co.mpesaPhone
                              ? 'border-red-400 bg-red-50'
                              : 'border-gray-200'
                          }`}
                        />
                      </div>
                      {!phoneValid && co.mpesaPhone && (
                        <p className="text-xs text-red-500 mt-1">
                          Invalid phone number — use 07XX or 01XX format
                        </p>
                      )}
                      {co.paymentMethod === 'mpesa_paybill' && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                          <p className="font-bold">📱 How to pay via Paybill:</p>
                          <p>1. Go to M-Pesa → Lipa na M-Pesa → Pay Bill</p>
                          <p>2. Business Number: <strong>174379</strong></p>
                          <p>3. Account Number: <strong>Your order ref</strong> (shown after placing order)</p>
                          <p>4. Amount: <strong>KES {co.total.toLocaleString()}</strong></p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error */}
                  {co.error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
                      <p className="text-sm text-red-700 font-medium">❌ {co.error}</p>
                    </div>
                  )}

                  {/* Place order CTA */}
                  <div className="mt-6">
                    <Btn
                      onClick={co.placeOrder}
                      loading={co.processing}
                      disabled={co.processing || (
                        (co.paymentMethod === 'mpesa_stk' || co.paymentMethod === 'mpesa_paybill')
                        && !normaliseMpesaPhone(co.mpesaPhone)
                      )}
                      variant="primary"
                      size="lg"
                      fullWidth
                      className="shadow-xl shadow-emerald-600/30"
                    >
                      {co.processing ? 'Processing…' : (
                        co.paymentMethod === 'mpesa_stk'     ? `⚡ Pay KES ${co.total.toLocaleString()} via M-Pesa` :
                        co.paymentMethod === 'mpesa_paybill' ? `📱 Place Order — Pay via Paybill` :
                        co.paymentMethod === 'visa_mc'       ? `💳 Pay ${formatPrice(co.total, currency, rates)}` :
                        co.paymentMethod === 'paypal'        ? `🌐 Continue to PayPal` :
                        co.paymentMethod === 'cod'           ? `📦 Place Order — Cash on Delivery` :
                        co.paymentMethod === 'loyalty'       ? `⭐ Pay with Loyalty Points` :
                        'Place Order'
                      )}
                    </Btn>

                    <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Secured by 256-bit SSL encryption
                    </p>
                  </div>

                  {/* Payment logos */}
                  <div className="mt-5 flex items-center justify-center gap-4 flex-wrap">
                    {['M-PESA', 'VISA', 'Mastercard', 'PayPal'].map(brand => (
                      <span key={brand} className="px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-lg">
                        {brand}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Right: Order summary ───────────────────── */}
          <div className="lg:col-span-1">
            <OrderSummary
              items={items}
              subtotal={co.subtotal}
              deliveryFee={co.deliveryFee}
              couponDiscount={co.couponDiscount}
              loyaltyDiscount={co.loyaltyDiscount}
              subscriptionDiscount={co.subscriptionDiscount}
              total={co.total}
              couponCode={co.couponCode}
              setCouponCode={co.setCouponCode}
              couponData={co.couponData}
              couponError={co.couponError}
              couponLoading={co.couponLoading}
              validateCoupon={co.validateCoupon}
              loyaltyBalance={user?.loyalty_points || 0}
              loyaltyToRedeem={co.loyaltyToRedeem}
              setLoyaltyToRedeem={co.setLoyaltyToRedeem}
              loyaltyEarned={co.loyaltyEarned}
              currency={currency}
              rates={rates}
              user={user}
            />
          </div>
        </div>
      </div>
    </Layout>
  )
}