import { useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCategories, getCategoryImageUrl } from '../hooks/useProducts.js'
import useTranslation from '../hooks/useTranslation.js'

export default function CategoryNav() {
  const { t, lang } = useTranslation()
  const { categories, loading } = useCategories()
  const { categorySlug } = useParams()
  const navigate = useNavigate()
  const scrollRef = useRef(null)

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' })
  }

  const allItem = { id: 'all', slug: '', name_en: t('category_all'), name_sw: t('category_all'), icon: null }
  const items   = [allItem, ...categories]

  return (
    <div className="relative bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-2">

          {/* Left scroll arrow */}
          <button
            onClick={() => scroll(-1)}
            className="hidden md:flex w-8 h-8 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 shrink-0 hover:bg-gray-50 transition-colors z-10"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Scrollable category strip */}
          <div
            ref={scrollRef}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar py-3 flex-1"
          >
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />
                    <div className="w-14 h-3 bg-gray-200 rounded animate-pulse" />
                  </div>
                ))
              : items.map((cat) => {
                  const isActive = cat.slug === (categorySlug || '')
                  const name     = lang === 'sw' ? (cat.name_sw || cat.name_en) : cat.name_en
                  const iconUrl  = cat.icon ? getCategoryImageUrl(cat, cat.icon, '64x64') : null

                  return (
                    <button
                      key={cat.id}
                      onClick={() => navigate(cat.slug ? `/shop/${cat.slug}` : '/shop')}
                      className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl shrink-0 transition-all group ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      {/* Icon circle */}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-emerald-600 ring-2 ring-emerald-600 ring-offset-2'
                          : 'bg-gray-100 group-hover:bg-gray-200'
                      }`}>
                        {iconUrl ? (
                          <img src={iconUrl} alt={name} className="w-7 h-7 object-contain" />
                        ) : (
                          <span className="text-2xl">
                            {cat.id === 'all' ? '🛍️' :
                             cat.is_service ? '⚙️' : '📦'}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold whitespace-nowrap ${
                        isActive ? 'text-emerald-700' : ''
                      }`}>
                        {name}
                      </span>
                    </button>
                  )
                })
            }
          </div>

          {/* Right scroll arrow */}
          <button
            onClick={() => scroll(1)}
            className="hidden md:flex w-8 h-8 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 shrink-0 hover:bg-gray-50 transition-colors z-10"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}