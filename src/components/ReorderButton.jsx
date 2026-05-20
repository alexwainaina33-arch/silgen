// src/components/ReorderButton.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useCartStore from '../store/cart.js'
import pb from '../lib/pb.js'
import toast from 'react-hot-toast'

export default function ReorderButton({ order, size = 'md' }) {
  const { addItem, clearCart } = useCartStore()
  const navigate               = useNavigate()
  const [loading, setLoading]  = useState(false)

  const handleReorder = async () => {
    setLoading(true)
    try {
      // Fetch order items
      const res = await pb.collection('sg_order_items').getFullList({
        filter:  `order_id = "${order.id}"`,
        expand:  'product_id',
      })

      if (!res.length) {
        toast.error('No items found in this order')
        setLoading(false)
        return
      }

      let added   = 0
      let skipped = 0

      for (const item of res) {
        const product = item.expand?.product_id
        if (!product) { skipped++; continue }
        if (product.status !== 'active') { skipped++; continue }
        if (product.track_inventory && product.stock_qty <= 0) { skipped++; continue }

        await addItem(product, item.qty, item.variant_sku || '', item.variant_label || '')
        added++
      }

      setLoading(false)

      if (added === 0) {
        toast.error('All items from this order are out of stock')
        return
      }

      const msg = skipped > 0
        ? `${added} item${added !== 1 ? 's' : ''} added to cart. ${skipped} item${skipped !== 1 ? 's' : ''} skipped (unavailable).`
        : `${added} item${added !== 1 ? 's' : ''} added to cart! 🛒`

      toast.success(msg, { duration: 4000 })

      // Also update order notes to track reorder
      await pb.collection('sg_orders').update(order.id, {
        notes: (order.notes || '') + ` [Reordered ${new Date().toISOString()}]`
      }).catch(() => {})

    } catch (err) {
      toast.error('Failed to reorder. Please try again.')
      setLoading(false)
    }
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      onClick={handleReorder}
      disabled={loading}
      className={`
        ${sizeClasses[size]}
        flex items-center gap-2 font-bold border-2 border-emerald-600 text-emerald-700
        rounded-xl hover:bg-emerald-600 hover:text-white transition-all
        disabled:opacity-60 disabled:cursor-not-allowed
      `}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Adding…
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reorder
        </>
      )}
    </button>
  )
}
