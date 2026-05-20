import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import pb from '../lib/pb.js'
import useTranslation from '../hooks/useTranslation.js'
import { getProductImageUrl } from '../hooks/useProducts.js'
import { formatPrice } from '../lib/currency.js'
import { useCurrencyStore } from './CurrencySelector.jsx'
import { trackSearch } from '../lib/analytics.js'

function debounce(fn, ms) {
  let timer
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms) }
}

export default function SmartSearch() {
  const { t, lang }         = useTranslation()
  const { currency, rates } = useCurrencyStore()
  const navigate            = useNavigate()

  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)
  const [recent,  setRecent]  = useState(
    () => JSON.parse(localStorage.getItem('sg_recent_searches') || '[]')
  )

  const inputRef    = useRef(null)
  const containerRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(
    debounce(async (q) => {
      if (!q || q.length < 2) { setResults([]); setLoading(false); return }

      setLoading(true)
      try {
        const q2 = q.replace(/"/g, '')
        const res = await pb.collection('sg_products').getList(1, 6, {
          filter: `status = "active" && (name_en ~ "${q2}" || name_sw ~ "${q2}" || tags ~ "${q2}" || sku ~ "${q2}")`,
          sort:   '-sales_count',
          expand: 'category_id',
        })
        setResults(res.items)
        trackSearch(q)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300),
    []
  )

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setOpen(true)
    setLoading(val.length >= 2)
    search(val)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    saveRecent(query.trim())
    navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    setOpen(false)
    setQuery('')
  }

  const saveRecent = (q) => {
    const updated = [q, ...recent.filter((r) => r !== q)].slice(0, 5)
    setRecent(updated)
    localStorage.setItem('sg_recent_searches', JSON.stringify(updated))
  }

  const goToProduct = (product) => {
    saveRecent(product.name_en)
    navigate(`/product/${product.slug}`)
    setOpen(false)
    setQuery('')
  }

  const clearRecent = () => {
    setRecent([])
    localStorage.removeItem('sg_recent_searches')
  }

  const showDropdown = open && (query.length >= 2 || recent.length > 0)

  return (
    <div className="relative w-full" ref={containerRef}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={() => setOpen(true)}
            placeholder={t('search_placeholder')}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 hover:bg-gray-200 focus:bg-white border border-transparent focus:border-emerald-400 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />

          {loading && (
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin h-4 w-4 text-emerald-500"
              fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}

          {query && !loading && (
            <button type="button" onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 max-h-96 overflow-y-auto">

          {/* Recent searches */}
          {query.length < 2 && recent.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {t('search_recent')}
                </p>
                <button onClick={clearRecent} className="text-xs text-gray-400 hover:text-gray-600">
                  {t('search_clear')}
                </button>
              </div>
              {recent.map((r) => (
                <button
                  key={r}
                  onClick={() => { setQuery(r); search(r); setOpen(true) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          {query.length >= 2 && (
            <>
              {results.length > 0 ? (
                <div>
                  <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-50">
                    Products
                  </p>
                  {results.map((product) => {
                    const name       = lang === 'sw' ? (product.name_sw || product.name_en) : product.name_en
                    const thumbUrl   = product.thumbnail
                      ? getProductImageUrl(product, product.thumbnail, '150x150')
                      : null

                    return (
                      <button
                        key={product.id}
                        onClick={() => goToProduct(product)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                          {thumbUrl
                            ? <img src={thumbUrl} alt={name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">📦</div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                          <p className="text-xs text-gray-500">
                            {product.expand?.category_id?.name_en}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-emerald-700 shrink-0">
                          {formatPrice(product.price_kes, currency, rates)}
                        </p>
                      </button>
                    )
                  })}

                  {/* View all */}
                  <button
                    onClick={handleSubmit}
                    className="w-full px-4 py-3 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 border-t border-gray-100 transition-colors text-center"
                  >
                    View all results for "{query}" →
                  </button>
                </div>
              ) : !loading ? (
                <div className="px-4 py-8 text-center">
                  <div className="text-3xl mb-2">🔍</div>
                  <p className="text-sm text-gray-500">{t('search_no_results', { q: query })}</p>
                  <p className="text-xs text-gray-400 mt-1">Try different keywords</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  )
}