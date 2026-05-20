import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import pb from '../lib/pb.js'
import useAuthStore from '../store/auth.js'
import useCartStore from '../store/cart.js'
import { useCurrencyStore } from '../components/CurrencySelector.jsx'
import { formatPrice } from '../lib/currency.js'
import Btn from '../components/ui/Btn.jsx'
import ReorderButton from '../components/ReorderButton.jsx'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status, paymentStatus }) {
  const map = {
    pending:          { label: 'Pending',          color: 'bg-gray-100 text-gray-600' },
    confirmed:        { label: 'Confirmed',         color: 'bg-blue-100 text-blue-700' },
    processing:       { label: 'Processing',        color: 'bg-amber-100 text-amber-700' },
    shipped:          { label: 'Shipped',           color: 'bg-purple-100 text-purple-700' },
    out_for_delivery: { label: 'Out for Delivery',  color: 'bg-orange-100 text-orange-700' },
    delivered:        { label: 'Delivered',         color: 'bg-emerald-100 text-emerald-700' },
    cancelled:        { label: 'Cancelled',         color: 'bg-red-100 text-red-600' },
    returned:         { label: 'Returned',          color: 'bg-red-100 text-red-600' },
  }
  const s = map[status] || { label: status, color: 'bg-gray-100 text-gray-600' }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.color}`}>{s.label}</span>
      {paymentStatus === 'paid' && (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">✅ Paid</span>
      )}
      {paymentStatus === 'pending' && (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">⏳ Payment Pending</span>
      )}
      {paymentStatus === 'failed' && (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">❌ Payment Failed</span>
      )}
    </div>
  )
}

// ReorderButton imported from shared component — see src/components/ReorderButton.jsx

// ── Order card ─────────────────────────────────────────────────────────────────
function OrderCard({ order }) {
  const [expanded, setExpanded] = useState(false)
  const [items,    setItems]    = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const { currency, rates } = useCurrencyStore()

  const loadItems = async () => {
    if (items.length > 0) { setExpanded(e => !e); return }
    setLoadingItems(true)
    try {
      const recs = await pb.collection('sg_order_items')
        .getFullList({ filter: `order_id = "${order.id}"` })
      setItems(recs)
      setExpanded(true)
    } catch (e) {}
    setLoadingItems(false)
  }

  const methodLabel = {
    mpesa_stk:    '📱 M-Pesa',
    mpesa_paybill:'📱 M-Pesa Paybill',
    visa_mc:      '💳 Card',
    paypal:       '🌐 PayPal',
    cod:          '💵 Cash on Delivery',
    subscription: '🔄 Subscription',
    loyalty:      '⭐ Loyalty Points',
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Order header */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-black text-gray-900 font-mono text-sm">{order.ref}</p>
              {order.is_gift && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">🎁 Gift</span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {(() => {
                try {
                  const d = new Date(order.created)
                  return isNaN(d.getTime()) ? '—' : format(d, 'dd MMM yyyy, HH:mm')
                } catch { return '—' }
              })()}
            </p>
          </div>
          <div className="text-right">
            <p className="font-black text-gray-900">{formatPrice(order.total_kes, currency, rates)}</p>
            <p className="text-xs text-gray-400">{methodLabel[order.payment_method] || order.payment_method}</p>
          </div>
        </div>

        <StatusBadge status={order.status} paymentStatus={order.payment_status} />

        {/* Loyalty earned */}
        {order.loyalty_earned > 0 && (
          <p className="text-xs text-amber-600 font-semibold mt-2">
            ⭐ Earned {order.loyalty_earned} loyalty points
          </p>
        )}
      </div>

      {/* Expanded items */}
      {expanded && items.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {item.product_name}
                  {item.variant_label && <span className="text-gray-400"> · {item.variant_label}</span>}
                  <span className="text-gray-400"> ×{item.qty}</span>
                </span>
                <span className="font-semibold text-gray-900">
                  KES {item.total_kes?.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
        <button
          onClick={loadItems}
          disabled={loadingItems}
          className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 transition-colors flex items-center gap-1"
        >
          {loadingItems ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>
              {expanded ? '▲ Hide' : '▼ View'} items
            </>
          )}
        </button>

        <div className="flex items-center gap-2">
          {order.tracking_code && (
            <Link to={`/gift-tracking/${order.ref}`}>
              <Btn variant="outline" size="sm">🚚 Track</Btn>
            </Link>
          )}
          {['delivered', 'cancelled'].includes(order.status) && (
            <ReorderButton order={order} size="sm" />
          )}
          {order.payment_status === 'pending' && order.payment_method === 'mpesa_stk' && (
            <Link to={`/checkout?retry=${order.ref}`}>
              <Btn variant="primary" size="sm">Retry Payment</Btn>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Filter tabs ────────────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'all',       label: 'All Orders' },
  { key: 'active',    label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
]

// ── Main page ──────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { user }   = useAuthStore()
  const navigate   = useNavigate()

  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const PER_PAGE = 10

  useEffect(() => {
    if (!user) { navigate('/login?redirect=/orders'); return }
    const load = async () => {
      setLoading(true)
      try {
        const filterMap = {
          all:       '',
          active:    `status != "delivered" && status != "cancelled"`,
          delivered: `status = "delivered"`,
          cancelled: `status = "cancelled"`,
        }
        const result = await pb.collection('sg_orders').getList(page, PER_PAGE, {
          filter: filterMap[filter],
        })
        setOrders(result.items)
        setTotal(result.totalItems)
      } catch (e) {
        toast.error('Failed to load orders')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, filter, page, navigate])

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">My Orders</h1>
            <p className="text-sm text-gray-500">{total} order{total !== 1 ? 's' : ''} total</p>
          </div>
          <Link to="/shop">
            <Btn variant="primary" size="sm">🛒 Shop More</Btn>
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1) }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                filter === f.key
                  ? 'bg-white text-emerald-700 shadow-sm font-bold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No orders yet</h3>
            <p className="text-gray-500 mb-6">Your order history will appear here</p>
            <Link to="/shop">
              <Btn variant="primary" size="md">Start Shopping →</Btn>
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {orders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {/* Loyalty summary widget */}
        {user?.loyalty_points > 0 && (
          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="text-sm font-black text-gray-900">
                  {user.loyalty_points?.toLocaleString()} Loyalty Points
                </p>
                <p className="text-xs text-amber-700">
                  Worth KES {(Math.floor(user.loyalty_points / 100) * 50).toFixed(0)}
                </p>
              </div>
            </div>
            <Link to="/loyalty">
              <Btn variant="outline" size="sm">View →</Btn>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  )
}
