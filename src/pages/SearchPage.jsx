import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { useProducts } from '../hooks/useProducts.js'
import useTranslation from '../hooks/useTranslation.js'
import { trackSearch } from '../lib/analytics.js'

export default function SearchPage() {
  const { t }           = useTranslation()
  const [searchParams]  = useSearchParams()
  const query           = searchParams.get('q') || ''

  const { products, total, loading } = useProducts({ search: query, perPage: 24 })

  useEffect(() => { if (query) trackSearch(query) }, [query])

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">
            {query ? t('search_results', { n: total, q: query }) : 'Search'}
          </h1>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                <div className="aspect-square bg-gray-200 animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-5 bg-gray-200 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-xl font-bold text-gray-800 mb-2">
              {t('search_no_results', { q: query })}
            </p>
            <p className="text-gray-500">Try different keywords or browse all products</p>
          </div>
        )}
      </div>
    </Layout>
  )
}