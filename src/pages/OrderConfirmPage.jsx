import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import pb from '../lib/pb.js'
import useAuthStore from '../store/auth.js'
import useCartStore from '../store/cart.js'
import { useCurrencyStore } from '../components/CurrencySelector.jsx'
import { formatPrice } from '../lib/currency.js'
import Btn from '../components/ui/Btn.jsx'
import toast from 'react-hot-toast'

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    const pieces = Array.from({ length: 120 }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * -canvas.height,
      w:     Math.random() * 10 + 5,
      h:     Math.random() * 6 + 3,
      color: ['#059669','#F59E0B','#3B82F6','#EF4444','#8B5CF6','#EC4899'][Math.floor(Math.random() * 6)],
      vx:    Math.random() * 2 - 1,
      vy:    Math.random() * 3 + 2,
      angle: Math.random() * 360,
      spin:  Math.random() * 4 - 2,
    }))

    let raf
    let alive = true
    const draw = () => {
      if (!alive) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pieces.forEach(p => {
        ctx.save()
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2)
        ctx.rotate((p.angle * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
        p.x += p.vx
        p.y += p.vy
        p.angle += p.spin
        if (p.y > canvas.height) {
          p.y = -20
          p.x = Math.random() * canvas.width
        }
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    const stop = setTimeout(() => { alive = false; cancelAnimationFrame(raf) }, 5000)
    return () => { alive = false; cancelAnimationFrame(raf); clearTimeout(stop) }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  )
}

// ── Order item row ─────────────────────────────────────────────────────────────
function OrderItemRow({ item }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center text-gray-300">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : '📦'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{item.product_name}</p>
        {item.variant_label && <p className="text-xs text-gray-500">{item.variant_label}</p>}
        <p className="text-xs text-gray-400">Qty: {item.qty}</p>
      </div>
      <p className="text-sm font-black text-gray-900">
        KES {item.total_kes?.toLocaleString()}
      </p>
    </div>
  )
}

// ── WhatsApp opt-in card ───────────────────────────────────────────────────────
function WhatsAppOptIn({ order, user }) {
  const [opted, setOpted] = useState(user?.whatsapp_opt_in || false)
  const [saving, setSaving] = useState(false)

  const handleOptIn = async () => {
    setSaving(true)
    try {
      await pb.collection('sg_users').update(user.id, { whatsapp_opt_in: true })
      setOpted(true)
      toast.success('You\'ll get WhatsApp updates for this order 📱')
    } catch (e) {
      toast.error('Failed to save preference')
    } finally {
      setSaving(false)
    }
  }

  if (opted) return (
    <div className="flex items-center gap-3 p-4 bg-[#25D366]/10 border border-[#25D366]/30 rounded-2xl">
      <span className="text-2xl">✅</span>
      <div>
        <p className="text-sm font-bold text-gray-900">WhatsApp updates enabled</p>
        <p className="text-xs text-gray-500">You'll receive order & delivery updates on WhatsApp</p>
      </div>
    </div>
  )

  return (
    <div className="p-4 bg-[#25D366]/5 border-2 border-[#25D366]/20 rounded-2xl">
      <div className="flex items-start gap-3 mb-3">
        <svg className="w-8 h-8 text-[#25D366] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        <div>
          <p className="text-sm font-bold text-gray-900">Get order updates on WhatsApp</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Receive instant notifications when your order is confirmed, shipped, and delivered.
          </p>
        </div>
      </div>
      <Btn
        onClick={handleOptIn}
        loading={saving}
        variant="primary"
        size="sm"
        fullWidth
        className="!bg-[#25D366] hover:!bg-[#1ea355]"
      >
        Yes, send me WhatsApp updates 📱
      </Btn>
    </div>
  )
}

// ── Loyalty points earned ─────────────────────────────────────────────────────
function LoyaltyEarned({ points }) {
  const cashValue = ((points / 100) * 50).toFixed(0)
  return (
    <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
      <div className="w-12 h-12 bg-amber-400 rounded-full flex items-center justify-center shrink-0 text-xl">
        ⭐
      </div>
      <div>
        <p className="text-sm font-black text-gray-900">+{points?.toLocaleString()} Loyalty Points Earned!</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Worth KES {cashValue} on your next order · Check your <Link to="/loyalty" className="underline font-semibold">loyalty balance</Link>
        </p>
      </div>
    </div>
  )
}

// ── Referral nudge ─────────────────────────────────────────────────────────────
function ReferralNudge({ user }) {
  const refLink = `${window.location.origin}/ref/${user?.referral_code}`
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(refLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!user?.referral_code) return null

  return (
    <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
      <p className="text-sm font-bold text-purple-900 mb-1">🎁 Share & Earn</p>
      <p className="text-xs text-purple-700 mb-3">
        Refer a friend and earn <strong>500 points</strong>. They get <strong>200 points</strong> on their first order!
      </p>
      <div className="flex gap-2">
        <div className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs font-mono text-purple-700 truncate">
          {refLink}
        </div>
        <button
          onClick={copy}
          className="px-3 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition-colors shrink-0"
        >
          {copied ? '✅' : '📋 Copy'}
        </button>
      </div>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`Shop baby essentials on SILGEN 🛒 Use my referral link and get 200 loyalty points: ${refLink}`)}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 flex items-center justify-center gap-2 w-full py-2 bg-[#25D366] text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity"
      >
        <span>Share on WhatsApp</span>
      </a>
    </div>
  )
}

// ── Delivery timeline ──────────────────────────────────────────────────────────
function DeliveryTimeline({ order }) {
  const steps = [
    { label: 'Order Placed',   done: true,  icon: '✅' },
    { label: 'Confirmed',      done: order?.status !== 'pending', icon: '📋' },
    { label: 'Processing',     done: ['processing','shipped','out_for_delivery','delivered'].includes(order?.status), icon: '📦' },
    { label: 'Out for Delivery', done: ['out_for_delivery','delivered'].includes(order?.status), icon: '🚚' },
    { label: 'Delivered',      done: order?.status === 'delivered', icon: '🎉' },
  ]

  return (
    <div className="relative">
      <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200" />
      <div className="space-y-4">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-4 relative">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 z-10 transition-all ${
              s.done ? 'bg-emerald-600 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'
            }`}>
              {s.done ? s.icon : <div className="w-2 h-2 rounded-full bg-gray-300" />}
            </div>
            <p className={`text-sm font-semibold ${s.done ? 'text-gray-900' : 'text-gray-400'}`}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ✨ Feature #15: Post-Order Upsell ─────────────────────────────────────────
function PostOrderUpsell({ orderItems }) {
  const [products, setProducts] = useState([])
  const [addedIds, setAddedIds] = useState(new Set())

  useEffect(() => {
    if (!orderItems.length) return
    const load = async () => {
      try {
        const productIds = orderItems.map(i => i.product_id).filter(Boolean)
        const excludeFilter = productIds.map(id => `id != '${id}'`).join(' && ')
        const filter = `status = 'active'${excludeFilter ? ` && ${excludeFilter}` : ''}`
        const r = await fetch(
          `${import.meta.env.VITE_PB_URL}/api/collections/sg_products/records?filter=${encodeURIComponent(filter)}&perPage=8&sort=-sales_count`
        )
        const res = await r.json()
        setProducts((res.items || []).sort(() => Math.random() - 0.5).slice(0, 3))
      } catch {
        // fail silently — non-critical
      }
    }
    load()
  }, [orderItems.length])

  const handleAdd = (product) => {
    useCartStore.getState().addItem(product, 1)
    setAddedIds(prev => new Set([...prev, product.id]))
    toast.success(`${product.name_en} added to cart! 🛒`)
    setTimeout(() => {
      setAddedIds(prev => { const n = new Set(prev); n.delete(product.id); return n })
    }, 2000)
  }

  if (!products.length) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
        <p className="font-black text-gray-900">🛍️ You might also need…</p>
        <p className="text-xs text-gray-500 mt-0.5">Customers who ordered this also loved these</p>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        {products.map(product => {
          const isAdded  = addedIds.has(product.id)
          const thumbUrl = product.thumbnail
            ? `${import.meta.env.VITE_PB_URL}/api/files/${product.collectionId}/${product.id}/${product.thumbnail}?thumb=150x150`
            : null
          return (
            <div
              key={product.id}
              className="flex flex-col bg-gray-50 rounded-xl overflow-hidden border border-gray-100 hover:border-emerald-200 hover:shadow-sm transition-all group"
            >
              <div className="h-20 bg-gray-100 overflow-hidden">
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={product.name_en}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl text-gray-200">🍼</div>
                )}
              </div>
              <div className="p-2 flex flex-col flex-1">
                <p className="text-xs font-semibold text-gray-800 line-clamp-2 flex-1 mb-1 leading-tight">
                  {product.name_en}
                </p>
                <p className="text-xs font-black text-emerald-700 mb-2">
                  KES {product.price_kes?.toLocaleString()}
                </p>
                <button
                  onClick={() => handleAdd(product)}
                  disabled={isAdded}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    isAdded
                      ? 'bg-emerald-100 text-emerald-700 cursor-default'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isAdded ? '✓ Added' : '+ Add'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OrderConfirmPage() {
  const { ref }    = useParams()
  const { user }   = useAuthStore()
  const navigate   = useNavigate()
  const { currency, rates } = useCurrencyStore()

  const [order,      setOrder]      = useState(null)
  const [orderItems, setOrderItems] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showConf,   setShowConf]   = useState(true)

  useEffect(() => {
    if (!ref) return
    const load = async () => {
      try {
        let o
        try {
          o = await pb.collection('sg_orders').getFirstListItem(`ref = "${ref}"`)
        } catch {
          o = await pb.collection('sg_orders').getOne(ref)
        }
        setOrder(o)

        try {
          const items = await pb.collection('sg_order_items')
            .getFullList({ filter: `order_id = "${o.id}"`, sort: 'created' })
          setOrderItems(items)
        } catch {
          // order items listRule restricted — order page still loads
        }
      } catch (e) {
        toast.error('Order not found')
        navigate('/orders')
      } finally {
        setLoading(false)
      }
    }
    load()
    // Hide confetti after 5s
    const t = setTimeout(() => setShowConf(false), 5500)
    return () => clearTimeout(t)
  }, [ref, navigate])

  if (loading) return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    </Layout>
  )

  if (!order) return null

  const isCOD  = order.payment_method === 'cod'
  const isPaid = order.payment_status === 'paid'

  return (
    <Layout hideCart>
      {showConf && <Confetti />}

      <div className="max-w-2xl mx-auto px-4 py-8 pb-24 space-y-5">

        {/* Hero success block */}
        <div className="text-center py-8 px-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border border-emerald-100">
          <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-1">
            {isCOD ? 'Order Placed! 🎉' : 'Payment Confirmed! 🎉'}
          </h1>
          <p className="text-gray-600 text-sm mb-3">
            {isCOD
              ? 'Your order has been placed. Please have cash ready for delivery.'
              : 'Your payment was received. We\'re preparing your order now!'
            }
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-emerald-200 shadow-sm">
            <span className="text-xs text-gray-500">Order reference:</span>
            <span className="text-sm font-black text-emerald-700 font-mono">{order.ref}</span>
          </div>
        </div>

        {/* WhatsApp opt-in */}
        <WhatsAppOptIn order={order} user={user} />

        {/* Loyalty points earned */}
        {order.loyalty_earned > 0 && (
          <LoyaltyEarned points={order.loyalty_earned} />
        )}

        {/* Order details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-black text-gray-900">Order Details</h2>
          </div>
          <div className="px-5 py-2">
            {orderItems.map(item => <OrderItemRow key={item.id} item={item} />)}
          </div>
          <div className="px-5 py-4 bg-gray-50 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal_kes, currency, rates)}</span>
            </div>
            {order.discount_kes > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Discount</span>
                <span>-{formatPrice(order.discount_kes, currency, rates)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-600">
              <span>Delivery</span>
              <span className={order.delivery_fee_kes === 0 ? 'text-emerald-600 font-bold' : ''}>
                {order.delivery_fee_kes === 0 ? 'FREE' : formatPrice(order.delivery_fee_kes, currency, rates)}
              </span>
            </div>
            <div className="flex justify-between font-black text-gray-900 text-base pt-1 border-t border-gray-200">
              <span>Total</span>
              <span>{formatPrice(order.total_kes, currency, rates)}</span>
            </div>
          </div>
        </div>

        {/* Delivery timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-black text-gray-900 mb-5">Delivery Status</h2>
          <DeliveryTimeline order={order} />
          {order.estimated_delivery && (
            <p className="text-xs text-gray-500 mt-4 pl-12">
              Estimated delivery: <strong>{new Date(order.estimated_delivery).toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
            </p>
          )}
        </div>

        {/* Referral nudge */}
        <ReferralNudge user={user} />

        {/* ✨ Feature #15: Post-order upsell */}
        {orderItems.length > 0 && <PostOrderUpsell orderItems={orderItems} />}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/orders">
            <Btn variant="outline" size="md" fullWidth>
              📋 My Orders
            </Btn>
          </Link>
          <Link to="/shop">
            <Btn variant="primary" size="md" fullWidth>
              🛒 Keep Shopping
            </Btn>
          </Link>
        </div>

        {/* Gift flow CTA */}
        {order.is_gift && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center">
            <p className="text-sm font-bold text-amber-900">🎁 Gift Order</p>
            <p className="text-xs text-amber-700 mt-1">
              Your gift is on its way to <strong>{order.gift_recipient_name}</strong> in Kenya.
              We'll WhatsApp them when it's dispatched!
            </p>
          </div>
        )}

        {/* Payment method note for COD */}
        {isCOD && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
            <p className="text-sm font-bold text-blue-900 mb-1">💵 Cash on Delivery</p>
            <p className="text-xs text-blue-700">
              Please have <strong>KES {order.total_kes?.toLocaleString()}</strong> ready when the rider arrives.
              Exact change appreciated!
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
