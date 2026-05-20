import { useState, useEffect, useCallback } from 'react'
import pb from '../lib/pb.js'

/**
 * Get PocketBase file URL for a product image
 */
export function getProductImageUrl(record, filename, thumb = '400x400') {
  if (!record || !filename) return null
  return pb.getFileUrl(record, filename, { thumb })
}

/**
 * Get PocketBase file URL for a category icon/image
 */
export function getCategoryImageUrl(record, filename, thumb = '64x64') {
  if (!record || !filename) return null
  return pb.getFileUrl(record, filename, { thumb })
}

/**
 * useProducts — fetches sg_products with filtering, sorting, pagination
 */
export function useProducts({
  categoryId  = '',
  featured    = false,
  search      = '',
  sort        = '-id',
  page        = 1,
  perPage     = 20,
  status      = 'active',
} = {}) {
  const [products,    setProducts]    = useState([])
  const [total,       setTotal]       = useState(0)
  const [totalPages,  setTotalPages]  = useState(1)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const filters = [`status = "${status}"`]
      if (categoryId) filters.push(`category_id = "${categoryId}"`)
      if (featured)   filters.push(`is_featured = true`)
      if (search) {
        const q = search.replace(/"/g, '')
        filters.push(
          `(name_en ~ "${q}" || name_sw ~ "${q}" || tags ~ "${q}" || sku ~ "${q}")`
        )
      }

      const result = await pb.collection('sg_products').getList(page, perPage, {
        filter:  filters.join(' && '),
        sort,
      })

      setProducts(result.items)
      setTotal(result.totalItems)
      setTotalPages(result.totalPages)
    } catch (err) {
      setError(err?.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [categoryId, featured, search, sort, page, perPage, status])

  useEffect(() => { fetch() }, [fetch])

  return { products, total, totalPages, loading, error, refetch: fetch }
}

/**
 * useProduct — fetches a single product by slug
 */
export function useProduct(slug) {
  const [product,  setProduct]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    pb.collection('sg_products')
      .getFirstListItem(`slug = "${slug}" && status = "active"`)
      .then((r) => { setProduct(r); setLoading(false) })
      .catch((e) => { setError(e?.message); setLoading(false) })
  }, [slug])

  return { product, loading, error }
}

/**
 * useCategories — fetches sg_categories (top-level, active)
 */
export function useCategories({ parentOnly = true } = {}) {
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const filters = ['is_active = true']
    if (parentOnly) filters.push('parent_id = ""')

    pb.collection('sg_categories')
      .getFullList({ filter: filters.join(' && '), sort: 'sort_order' })
      .then((r) => { setCategories(r); setLoading(false) })
      .catch(() => setLoading(false))
  }, [parentOnly])

  return { categories, loading }
}

/**
 * useProductReviews — fetches approved reviews for a product
 */
export function useProductReviews(productId) {
  const [reviews,  setReviews]  = useState([])
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (!productId) return
    setLoading(true)
    pb.collection('sg_reviews')
      .getList(1, 20, {
        filter:  `product_id = "${productId}" && is_approved = true`,
        sort:    '-created',
        expand:  'user_id',
      })
      .then((r) => { setReviews(r.items); setLoading(false) })
      .catch(() => setLoading(false))
  }, [productId])

  return { reviews, loading }
}

/**
 * Increment product view count (fire and forget)
 */
export function incrementViews(productId, currentViews) {
  pb.collection('sg_products')
    .update(productId, { views_count: (currentViews || 0) + 1 })
    .catch(() => {})
}