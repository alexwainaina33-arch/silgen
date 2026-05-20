export default function FlashSaleBadge({ pct, className = '' }) {
  if (!pct || pct <= 0) return null
  return (
    <span className={`inline-flex items-center bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-md ${className}`}>
      -{Math.round(pct)}%
    </span>
  )
}