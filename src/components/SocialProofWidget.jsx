import { useState, useEffect } from 'react'

/**
 * "X people viewing this now" — simulated with realistic range
 */
export function ViewingNow({ productId }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Seed from productId for consistent-ish numbers
    const seed = productId ? productId.charCodeAt(0) % 20 : 5
    setCount(seed + Math.floor(Math.random() * 8) + 3)

    // Subtle drift every 15s
    const interval = setInterval(() => {
      setCount((c) => Math.max(2, c + Math.floor(Math.random() * 5) - 2))
    }, 15000)
    return () => clearInterval(interval)
  }, [productId])

  if (!count) return null

  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium bg-amber-50 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
      {count} viewing now
    </div>
  )
}

/**
 * "Only X left in stock" — real from stock_qty
 */
export function LowStockBadge({ stockQty, threshold = 10 }) {
  if (!stockQty || stockQty > threshold) return null
  if (stockQty <= 0) return (
    <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
      Out of Stock
    </span>
  )
  return (
    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
      🔥 Only {stockQty} left!
    </span>
  )
}

/**
 * "X sold in last 24 hours" — from sales_count (approximate)
 */
export function SoldRecently({ salesCount }) {
  if (!salesCount || salesCount < 5) return null
  // Show a plausible fraction of total sales as "last 24hrs"
  const recent = Math.max(1, Math.floor(salesCount * 0.04))
  return (
    <span className="text-xs text-gray-500">
      🛒 {recent} sold in last 24hrs
    </span>
  )
}

/**
 * Star rating display
 */
export function StarRating({ rating = 0, count = 0, size = 'sm' }) {
  const stars = Math.round(rating)
  const sizeClass = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((s) => (
          <svg key={s} className={`${sizeClass} ${s <= stars ? 'text-amber-400' : 'text-gray-200'}`}
            fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      {count > 0 && (
        <span className="text-xs text-gray-500">({count})</span>
      )}
    </div>
  )
}