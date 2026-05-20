import { useState, useRef, useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CURRENCY_SYMBOLS, SUPPORTED_CURRENCIES } from '../lib/currency.js'

// ── Currency store (shared across app) ───────────────────────────
export const useCurrencyStore = create(
  persist(
    (set) => ({
      currency: 'KES',
      rates: { KES: 1 },
      setCurrency: (currency) => set({ currency }),
      setRates: (rates) => set({ rates }),
    }),
    { name: 'sg_currency' }
  )
)

export default function CurrencySelector({ compact = false }) {
  const { currency, setCurrency } = useCurrencyStore()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const FLAG = { KES: '🇰🇪', USD: '🇺🇸', GBP: '🇬🇧', EUR: '🇪🇺', CAD: '🇨🇦', AUD: '🇦🇺' }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <span>{FLAG[currency] || '💱'}</span>
        <span className="text-xs font-bold">{currency}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
          {SUPPORTED_CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => { setCurrency(c); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                currency === c ? 'text-emerald-600 font-bold bg-emerald-50' : 'text-gray-700'
              }`}
            >
              <span>{FLAG[c]}</span>
              <span>{c}</span>
              <span className="ml-auto text-xs text-gray-400">{CURRENCY_SYMBOLS[c]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}