import { useState } from 'react'
import { Link } from 'react-router-dom'
import useCartStore from '../store/cart.js'
import useAuthStore from '../store/auth.js'
import useTranslation from '../hooks/useTranslation.js'
import { useCurrencyStore } from './CurrencySelector.jsx'
import { formatPrice } from '../lib/currency.js'
import { getProductImageUrl } from '../hooks/useProducts.js'
import pb from '../lib/pb.js'
import { StarRating, ViewingNow, LowStockBadge } from './SocialProofWidget.jsx'
import FlashSaleBadge from './FlashSaleBadge.jsx'
import toast from 'react-hot-toast'

export default function ProductCard({ product, showViewing = true }) {
  const { t, lang }       = useTranslation()
  const { addItem }       = useCartStore()
  const { user }          = useAuthStore()
  const { currency, rates } = useCurrencyStore()
  const [adding,    setAdding]    = useState(false)
  const [wishlisted, setWishlisted] = useState(false)

  if (!product) return null

  const name        = lang === 'sw' ? (product.name_sw || product.name_en) : product.name_en
  const thumbnailUrl = product.thumbnail
    ? getProductImageUrl(product, product.thumbnail, '300x300')
    : product.images?.[0]
    ? getProductImageUrl(product, product.images[0], '300x300')
    : null

  const discountPct = product.compare_price_kes && product.compare_price_kes > product.price_kes
    ? Math.round(((product.compare_price_kes - product.price_kes) / product.compare_price_kes) * 100)
    : 0

  const isOutOfStock = product.track_inventory && product.stock_qty <= 0

  const handleAddToCart = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (isOutOfStock) return
    setAdding(true)
    await addItem(product, 1)
    toast.success(`${name} added to cart 🛒`)
    setAdding(false)
  }

  const handleWishlist = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { toast.error('Sign in to save to wishlist'); return }

    try {
      if (wishlisted) {
        const rec = await pb.collection('sg_wishlists')
          .getFirstListItem(`user_id = "${user.id}" && product_id = "${product.id}"`)
          .catch(() => null)
        if (rec) await pb.collection('sg_wishlists').delete(rec.id)
        setWishlisted(false)
        toast.success(t('wishlist_removed'))
      } else {
        await pb.collection('sg_wishlists').create({
          user_id:    user.id,
          product_id: product.id,
        })
        setWishlisted(true)
        toast.success(t('wishlist_added'))
      }
    } catch { toast.error('Failed to update wishlist') }
  }

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      {/* Image container */}
      <div className="relative overflow-hidden bg-gray-50 aspect-square">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discountPct > 0 && <FlashSaleBadge pct={discountPct} />}
          {product.is_featured && (
            <span className="bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded-md">
              ⭐ Featured
            </span>
          )}
          {product.is_digital && (
            <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-md">
              📥 Digital
            </span>
          )}
        </div>

        {/* Wishlist button */}
        <button
          onClick={handleWishlist}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all ${
            wishlisted
              ? 'bg-red-500 text-white'
              : 'bg-white/90 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100'
          }`}
        >
          <svg className="w-4 h-4" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              Out of Stock
            </span>
          </div>
        )}

        {/* Quick add — shows on hover desktop */}
        {!isOutOfStock && (
          <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <button
              onClick={handleAddToCart}
              disabled={adding}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
            >
              {adding ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )}
              {adding ? 'Adding...' : t('product_add_to_cart')}
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">

        {/* Category */}
        {product.expand?.category_id && (
          <p className="text-xs text-emerald-600 font-semibold mb-1 uppercase tracking-wide">
            {product.expand.category_id.name_en}
          </p>
        )}

        {/* Name */}
        <h3 className="text-sm font-bold text-gray-900 leading-snug mb-1 line-clamp-2 group-hover:text-emerald-700 transition-colors">
          {name}
        </h3>

        {/* Rating */}
        {product.review_count > 0 && (
          <div className="mb-2">
            <StarRating rating={product.avg_rating} count={product.review_count} />
          </div>
        )}

        {/* Social proof */}
        <div className="flex flex-wrap gap-1 mb-2">
          {showViewing && <ViewingNow productId={product.id} />}
          <LowStockBadge stockQty={product.stock_qty} />
        </div>

        {/* Price */}
        <div className="mt-auto pt-2 border-t border-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-black text-gray-900">
                {formatPrice(product.price_kes, currency, rates)}
              </p>
              {product.compare_price_kes > product.price_kes && (
                <p className="text-xs text-gray-400 line-through">
                  {formatPrice(product.compare_price_kes, currency, rates)}
                </p>
              )}
            </div>

            {/* Mobile add button */}
            <button
              onClick={handleAddToCart}
              disabled={adding || isOutOfStock}
              className="md:hidden w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Link>
  )
}