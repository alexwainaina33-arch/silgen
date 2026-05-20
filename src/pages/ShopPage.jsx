import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import CategoryNav from '../components/CategoryNav.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { useProducts, useCategories } from '../hooks/useProducts.js'
import useTranslation from '../hooks/useTranslation.js'

const SORT_OPTIONS = [
  { value: '-id',          label: 'Newest First' },
  { value: 'price_kes',    label: 'Price: Low to High' },
  { value: '-price_kes',   label: 'Price: High to Low' },
  { value: '-sales_count', label: 'Best Selling' },
  { value: '-avg_rating',  label: 'Top Rated' },
  { value: '-views_count', label: 'Most Popular' },
]

export default function ShopPage() {
  const { t, lang }            = useTranslation()
  const { categorySlug }       = useParams()
  const [searchParams]         = useSearchParams()
  const navigate               = useNavigate()

  const [sort,       setSort]       = useState('-id')
  const [page,       setPage]       = useState(1)
  const [categoryId, setCategoryId] = useState('')
  const [priceMin,   setPriceMin]   = useState('')
  const [priceMax,   setPriceMax]   = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  const { categories } = useCategories()

  // Resolve categorySlug → categoryId
  useEffect(() => {
    if (!categorySlug) { setCategoryId(''); return }
    const cat = categories.find((c) => c.slug === categorySlug)
    if (cat) setCategoryId(cat.id)
  }, [categorySlug, categories])

  const { products, total, totalPages, loading } = useProducts({
    categoryId,
    sort,
    page,
    perPage: 24,
  })

  // Filter by price client-side (PocketBase doesn't support range on floats easily in free tier)
  const filtered = products.filter((p) => {
    if (priceMin && p.price_kes < Number(priceMin)) return false
    if (priceMax && p.price_kes > Number(priceMax)) return false
    return true
  })

  const activeCategory = categories.find((c) => c.slug === categorySlug)
  const pageTitle = activeCategory
    ? (lang === 'sw' ? activeCategory.name_sw || activeCategory.name_en : activeCategory.name_en)
    : t('nav_shop')

  return (
    <Layout>
      {/* Category nav strip */}
      <CategoryNav />

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">{pageTitle}</h1>
            {!loading && (
              <p className="text-sm text-gray-500 mt-0.5">
                {total.toLocaleString()} product{total !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Filter toggle — mobile */}
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filter
            </button>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-6">

          {/* Filter sidebar */}
          {(filterOpen) && (
            <aside className="w-60 shrink-0">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 sticky top-24">
                <h3 className="font-bold text-gray-900 mb-4">Filters</h3>

                {/* Categories */}
                <div className="mb-5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Category</p>
                  <div className="space-y-1">
                    <button
                      onClick={() => { navigate('/shop'); setPage(1) }}
                      className={`w-full text-left text-sm px-2 py-1.5 rounded-lg transition-colors ${
                        !categorySlug ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      All Products
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => { navigate(`/shop/${cat.slug}`); setPage(1) }}
                        className={`w-full text-left text-sm px-2 py-1.5 rounded-lg transition-colors ${
                          categorySlug === cat.slug
                            ? 'bg-emerald-50 text-emerald-700 font-semibold'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {lang === 'sw' ? cat.name_sw || cat.name_en : cat.name_en}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price range */}
                <div className="mb-5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Price Range (KES)</p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      placeholder="Min"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-gray-400 text-xs shrink-0">to</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Clear filters */}
                <button
                  onClick={() => { setPriceMin(''); setPriceMax(''); navigate('/shop') }}
                  className="w-full text-sm text-gray-500 hover:text-red-500 transition-colors text-center py-1"
                >
                  Clear all filters
                </button>
              </div>
            </aside>
          )}

          {/* Product grid */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    <div className="aspect-square bg-gray-200 animate-pulse" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                      <div className="h-5 bg-gray-200 rounded animate-pulse w-1/2 mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🛍️</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No products found</h3>
                <p className="text-gray-500 mb-4">Try adjusting your filters or browse all products</p>
                <button onClick={() => { navigate('/shop'); setPriceMin(''); setPriceMax('') }}
                  className="px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors">
                  Browse All Products
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filtered.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    >
                      ← Previous
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pg = i + 1
                      return (
                        <button
                          key={pg}
                          onClick={() => setPage(pg)}
                          className={`w-10 h-10 rounded-lg text-sm font-bold transition-colors ${
                            pg === page
                              ? 'bg-emerald-600 text-white'
                              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {pg}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
