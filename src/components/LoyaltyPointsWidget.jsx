// src/components/LoyaltyPointsWidget.jsx
import { Link } from 'react-router-dom'
import useAuthStore from '../store/auth.js'

export default function LoyaltyPointsWidget({ compact = false }) {
  const { user } = useAuthStore()
  if (!user) return null

  const points   = user.loyalty_points || 0
  const cashValue = Math.floor(points / 100) * 50

  if (compact) {
    return (
      <Link to="/loyalty"
        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full hover:bg-amber-100 transition-colors">
        <span className="text-amber-500 text-sm">⭐</span>
        <span className="text-xs font-black text-amber-700">{points.toLocaleString()} pts</span>
      </Link>
    )
  }

  return (
    <Link to="/loyalty"
      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl hover:shadow-md transition-all group">
      <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
        <span className="text-xl">⭐</span>
      </div>
      <div>
        <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Loyalty Points</p>
        <p className="text-lg font-black text-amber-900">{points.toLocaleString()} pts</p>
        <p className="text-xs text-amber-600">= KES {cashValue.toLocaleString()} value</p>
      </div>
      <svg className="w-4 h-4 text-amber-400 ml-auto group-hover:translate-x-1 transition-transform"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
