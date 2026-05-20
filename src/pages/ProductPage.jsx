import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { useProduct, useProducts, useProductReviews, getProductImageUrl, incrementViews } from '../hooks/useProducts.js'
import { StarRating, ViewingNow, LowStockBadge, SoldRecently } from '../components/SocialProofWidget.jsx'
import FlashSaleBadge from '../components/FlashSaleBadge.jsx'
import ProductCard from '../components/ProductCard.jsx'
import useCartStore from '../store/cart.js'
import useAuthStore from '../store/auth.js'
import useTranslation from '../hooks/useTranslation.js'
import { useCurrencyStore } from '../components/CurrencySelector.jsx'
import { formatPrice } from '../lib/currency.js'
import { trackProductView } from '../lib/analytics.js'
import pb from '../lib/pb.js'
import Btn from '../components/ui/Btn.jsx'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

// ─── Sticky bar that appears after scrolling past the hero ───────────────────
function StickyBar({ product, name, qty, setQty, onAddToCart, adding, isOutOfStock, currency, rates }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 500)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${visible ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="bg-white border-t border-gray-200 shadow-2xl px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {product.thumbnail && (
            <img
              src={getProductImageUrl(product, product.thumbnail, '80x80')}
              alt={name}
              className="w-10 h-10 rounded-lg object-cover shrink-0"
            />
          )}
          <p className="text-sm font-bold text-gray-900 flex-1 truncate">{name}</p>
          <p className="text-sm font-black text-emerald-700 shrink-0">
            {formatPrice(product.price_kes, currency, rates)}
          </p>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shrink-0">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100">−</button>
            <span className="w-8 text-center text-sm font-bold">{qty}</span>
            <button onClick={() => setQty(q => q + 1)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100">+</button>
          </div>
          <Btn onClick={onAddToCart} loading={adding} disabled={isOutOfStock} variant="primary" size="sm" className="shrink-0">
            {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Image zoom lens ─────────────────────────────────────────────────────────
function ZoomImage({ src, alt }) {
  const [pos, setPos] = useState({ x: 50, y: 50 })
  const [zoomed, setZoomed] = useState(false)
  const ref = useRef(null)

  const handleMove = useCallback((e) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPos({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) })
  }, [])

  return (
    <div
      ref={ref}
      className="relative w-full h-full overflow-hidden cursor-crosshair"
      onMouseEnter={() => setZoomed(true)}
      onMouseLeave={() => setZoomed(false)}
      onMouseMove={handleMove}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-100"
        style={zoomed ? {
          transformOrigin: `${pos.x}% ${pos.y}%`,
          transform: 'scale(2.2)',
        } : {}}
      />
    </div>
  )
}

// ─── Trust badges ─────────────────────────────────────────────────────────────
function TrustBadges() {
  const badges = [
    { icon: '🔒', label: 'Secure Checkout' },
    { icon: '↩️', label: 'Easy Returns' },
    { icon: '🚚', label: 'Fast Delivery' },
    { icon: '✅', label: 'Verified Products' },
  ]
  return (
    <div className="grid grid-cols-4 gap-2 py-4 border-t border-b border-gray-100 my-5">
      {badges.map(b => (
        <div key={b.label} className="flex flex-col items-center gap-1 text-center">
          <span className="text-xl">{b.icon}</span>
          <span className="text-xs text-gray-500 font-medium leading-tight">{b.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Countdown timer for flash sales ─────────────────────────────────────────
function CountdownTimer({ comparePrice, price }) {
  const [time, setTime] = useState({ h: 4, m: 23, s: 47 })
  useEffect(() => {
    if (!comparePrice || comparePrice <= price) return
    const t = setInterval(() => {
      setTime(prev => {
        let { h, m, s } = prev
        s--
        if (s < 0) { s = 59; m-- }
        if (m < 0) { m = 59; h-- }
        if (h < 0) return { h: 23, m: 59, s: 59 }
        return { h, m, s }
      })
    }, 1000)
    return () => clearInterval(t)
  }, [comparePrice, price])

  if (!comparePrice || comparePrice <= price) return null
  const pad = n => String(n).padStart(2, '0')
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl mb-4">
      <span className="text-sm font-bold text-red-600">⚡ Flash Sale ends in:</span>
      <div className="flex items-center gap-1">
        {[time.h, time.m, time.s].map((val, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="bg-red-600 text-white text-xs font-black px-2 py-0.5 rounded-md tabular-nums">
              {pad(val)}
            </span>
            {i < 2 && <span className="text-red-500 font-bold text-xs">:</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Recently viewed ──────────────────────────────────────────────────────────
function useRecentlyViewed(currentId) {
  const [ids, setIds] = useState([])
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sg_rv') || '[]')
      setIds(stored.filter(id => id !== currentId).slice(0, 4))
      const updated = [currentId, ...stored.filter(id => id !== currentId)].slice(0, 10)
      localStorage.setItem('sg_rv', JSON.stringify(updated))
    } catch {}
  }, [currentId])
  return ids
}

// ─── Image gallery with thumbnails ───────────────────────────────────────────
function ImageGallery({ product, name, discountPct, onShare }) {
  const [selected, setSelected] = useState(0)
  const images = product.images || []
  const allImages = product.thumbnail ? [product.thumbnail, ...images] : images

  return (
    <div>
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 mb-3 group shadow-sm">
        {allImages[selected] ? (
          <ZoomImage
            src={getProductImageUrl(product,
              allImages[selected] === product.thumbnail ? product.thumbnail : allImages[selected],
              '800x800')}
            alt={name}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200">
            <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {discountPct > 0 && (
          <div className="absolute top-4 left-4 pointer-events-none">
            <FlashSaleBadge pct={discountPct} className="text-sm px-3 py-1" />
          </div>
        )}

        {/* Zoom hint */}
        <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          🔍 Hover to zoom
        </div>

        <button
          onClick={onShare}
          className="absolute top-4 right-4 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>

        {/* Arrow navigation for mobile */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={() => setSelected(i => (i - 1 + allImages.length) % allImages.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow md:hidden"
            >‹</button>
            <button
              onClick={() => setSelected(i => (i + 1) % allImages.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow md:hidden"
            >›</button>
          </>
        )}
      </div>

      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                selected === i
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 scale-105'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={getProductImageUrl(product,
                  img === product.thumbnail ? product.thumbnail : img,
                  '150x150')}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Review stars breakdown ───────────────────────────────────────────────────
function ReviewSummary({ reviews, avgRating }) {
  if (!reviews.length) return null
  return (
    <div className="flex items-center gap-6 p-5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl mb-6">
      <div className="text-center shrink-0">
        <p className="text-5xl font-black text-gray-900">{avgRating?.toFixed(1) || '0'}</p>
        <StarRating rating={avgRating} size="lg" />
        <p className="text-xs text-gray-500 mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 space-y-1">
        {[5, 4, 3, 2, 1].map(star => {
          const count = reviews.filter(r => r.rating === star).length
          const pct = reviews.length ? (count / reviews.length) * 100 : 0
          return (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-3">{star}</span>
              <svg className="w-3 h-3 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 w-5 text-right">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProductPage() {
  const { slug }            = useParams()
  const { t, lang }         = useTranslation()
  const { product, loading, error } = useProduct(slug)
  const { addItem }         = useCartStore()
  const { user }            = useAuthStore()
  const { currency, rates } = useCurrencyStore()
  const navigate            = useNavigate()

  const [qty,             setQty]             = useState(1)
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [adding,          setAdding]          = useState(false)
  const [wishlisted,      setWishlisted]      = useState(false)
  const [activeTab,       setActiveTab]       = useState('description')
  const [reviewForm,      setReviewForm]      = useState({ rating: 5, title: '', body: '' })
  const [submitting,      setSubmitting]      = useState(false)
  const [shareOpen,       setShareOpen]       = useState(false)
  const [copied,          setCopied]          = useState(false)

  const { reviews }           = useProductReviews(product?.id)
  const { products: related } = useProducts({ categoryId: product?.category_id, perPage: 6 })
  const recentlyViewedIds     = useRecentlyViewed(product?.id)
  const { products: recentProds } = useProducts({ perPage: 20 })

  const relatedFiltered = related.filter(p => p.id !== product?.id).slice(0, 4)
  const recentlyViewed  = recentProds.filter(p => recentlyViewedIds.includes(p.id)).slice(0, 4)

  // Check wishlist on load
  useEffect(() => {
    if (!user || !product) return
    pb.collection('sg_wishlists')
      .getFirstListItem(`user_id = "${user.id}" && product_id = "${product.id}"`)
      .then(() => setWishlisted(true))
      .catch(() => setWishlisted(false))
  }, [user?.id, product?.id])

  useEffect(() => {
    if (product) {
      trackProductView(product.id)
      incrementViews(product.id, product.views_count)
    }
  }, [product?.id])

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />
          <div className="space-y-4 pt-4">
            <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3" />
            <div className="h-8 bg-gray-100 rounded animate-pulse w-4/5" />
            <div className="h-6 bg-gray-100 rounded animate-pulse w-2/5" />
            <div className="h-12 bg-gray-100 rounded-xl animate-pulse w-3/5" />
            <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
            <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
            <div className="h-14 bg-gray-100 rounded-xl animate-pulse w-full mt-4" />
          </div>
        </div>
      </div>
    </Layout>
  )

  if (error || !product) return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Product not found</h2>
          <Btn onClick={() => navigate('/shop')} variant="primary">Browse Shop</Btn>
        </div>
      </div>
    </Layout>
  )

  // ── Derived values ──────────────────────────────────────────────────────────
  const name        = lang === 'sw' ? (product.name_sw || product.name_en) : product.name_en
  const description = lang === 'sw' ? (product.description_sw || product.description_en) : product.description_en
  const variants    = product.variants_json || []

  const discountPct = product.compare_price_kes && product.compare_price_kes > product.price_kes
    ? Math.round(((product.compare_price_kes - product.price_kes) / product.price_kes) * 100)
    : 0

  const isOutOfStock = product.track_inventory && product.stock_qty <= 0
  const isLowStock   = product.track_inventory && product.stock_qty > 0 && product.stock_qty <= 10

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAddToCart = async () => {
    if (isOutOfStock) return
    setAdding(true)
    await addItem(product, qty, selectedVariant?.sku || '', selectedVariant?.label || '')
    toast.success(`${qty}× ${name} added to cart 🛒`, { duration: 3000 })
    setAdding(false)
  }

  const handleBuyNow = async () => {
    await handleAddToCart()
    navigate('/checkout')
  }

  const handleWishlist = async () => {
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
        await pb.collection('sg_wishlists').create({ user_id: user.id, product_id: product.id })
        setWishlisted(true)
        toast.success(t('wishlist_added'))
      }
    } catch { toast.error('Failed') }
  }

  const handleShare = () => setShareOpen(true)

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({ title: name, url: window.location.href })
      setShareOpen(false)
    }
  }

  const submitReview = async (e) => {
    e.preventDefault()
    if (!user) { toast.error('Sign in to write a review'); return }
    if (!reviewForm.body.trim()) { toast.error('Please write something'); return }
    setSubmitting(true)
    try {
      await pb.collection('sg_reviews').create({
        user_id:     user.id,
        product_id:  product.id,
        rating:      reviewForm.rating,
        title:       reviewForm.title,
        body:        reviewForm.body,
        is_approved: false,
      })
      toast.success(t('review_success'))
      setReviewForm({ rating: 5, title: '', body: '' })
    } catch { toast.error('Failed to submit review') }
    setSubmitting(false)
  }

  const loyaltyPoints = Math.floor(product.price_kes)
  const loyaltyCash   = (Math.floor(product.price_kes / 100) * 50 / 100).toFixed(2)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* ── Sticky add-to-cart bar ──────────────────────────────────────────── */}
      <StickyBar
        product={product}
        name={name}
        qty={qty}
        setQty={setQty}
        onAddToCart={handleAddToCart}
        adding={adding}
        isOutOfStock={isOutOfStock}
        currency={currency}
        rates={rates}
      />

      {/* ── Share modal ─────────────────────────────────────────────────────── */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShareOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-4 text-lg">Share this product</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'WhatsApp', color: 'bg-[#25D366]', icon: '💬',
                  href: `https://wa.me/?text=${encodeURIComponent(name + ' — ' + window.location.href)}` },
                { label: 'Twitter', color: 'bg-sky-500', icon: '🐦',
                  href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(name)}&url=${encodeURIComponent(window.location.href)}` },
                { label: 'Facebook', color: 'bg-blue-600', icon: '📘',
                  href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}` },
              ].map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer"
                  className={`${s.color} text-white rounded-xl py-3 flex flex-col items-center gap-1 text-xs font-semibold hover:opacity-90 transition-opacity`}>
                  <span className="text-xl">{s.icon}</span>
                  {s.label}
                </a>
              ))}
            </div>
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:border-emerald-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? '✅ Copied!' : 'Copy link'}
            </button>
            {typeof navigator.share === 'function' && (
              <button onClick={handleNativeShare}
                className="w-full mt-2 py-3 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                More options…
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 pb-28">

        {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6 overflow-x-auto no-scrollbar whitespace-nowrap">
          <Link to="/" className="hover:text-emerald-600 transition-colors shrink-0">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-emerald-600 transition-colors shrink-0">{t('nav_shop')}</Link>
          {product.expand?.category_id && (
            <>
              <span>/</span>
              <Link to={`/shop/${product.expand.category_id.slug}`}
                className="hover:text-emerald-600 transition-colors shrink-0">
                {product.expand.category_id.name_en}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-gray-700 font-medium truncate">{name}</span>
        </nav>

        {/* ── Main grid ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 mb-14">

          {/* Left: image gallery */}
          <ImageGallery product={product} name={name} discountPct={discountPct} onShare={handleShare} />

          {/* Right: product info */}
          <div>
            {/* Category + badges */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {product.expand?.category_id && (
                <Link to={`/shop/${product.expand.category_id.slug}`}
                  className="text-xs font-bold text-emerald-600 uppercase tracking-wider hover:text-emerald-700">
                  {product.expand.category_id.name_en}
                </Link>
              )}
              {product.is_featured     && <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">⭐ Featured</span>}
              {product.is_digital      && <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">📥 Digital</span>}
              {product.is_subscription && <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">🔄 Subscription</span>}
              {isLowStock              && <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full animate-pulse">🔥 Only {product.stock_qty} left</span>}
            </div>

            {/* Name */}
            <h1 className="text-3xl font-black text-gray-900 leading-tight mb-3">{name}</h1>

            {/* Rating + sold count */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <StarRating rating={product.avg_rating} count={product.review_count} size="lg" />
              {product.sales_count > 0 && (
                <span className="text-sm text-gray-500">
                  {product.sales_count.toLocaleString()} sold
                </span>
              )}
              <button onClick={() => setActiveTab('reviews')}
                className="text-xs text-emerald-600 underline underline-offset-2">
                {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </button>
            </div>

            {/* Social proof */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <ViewingNow productId={product.id} />
              <LowStockBadge stockQty={product.stock_qty} />
              <SoldRecently salesCount={product.sales_count} />
            </div>

            {/* Flash sale countdown */}
            <CountdownTimer comparePrice={product.compare_price_kes} price={product.price_kes} />

            {/* Price block */}
            <div className="flex items-end gap-3 mb-1">
              <p className="text-4xl font-black text-gray-900">
                {formatPrice(product.price_kes, currency, rates)}
              </p>
              {product.compare_price_kes > product.price_kes && (
                <div className="mb-1">
                  <p className="text-lg text-gray-400 line-through">
                    {formatPrice(product.compare_price_kes, currency, rates)}
                  </p>
                  <p className="text-sm font-bold text-red-500">
                    Save {formatPrice(product.compare_price_kes - product.price_kes, currency, rates)} ({discountPct}% off)
                  </p>
                </div>
              )}
            </div>

            {/* Loyalty */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl mb-2 mt-3">
              <span className="text-base">⭐</span>
              <p className="text-xs text-amber-800">
                Earn <strong>{loyaltyPoints} loyalty points</strong> worth <strong>KES {loyaltyCash}</strong> on this purchase
              </p>
            </div>

            {/* Trust badges */}
            <TrustBadges />

            {/* Variants */}
            {variants.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-bold text-gray-700 mb-2">
                  {t('product_variant')}
                  {selectedVariant && <span className="font-normal text-emerald-600 ml-2">— {selectedVariant.label}</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {variants.map(v => (
                    <button
                      key={v.sku}
                      onClick={() => setSelectedVariant(selectedVariant?.sku === v.sku ? null : v)}
                      disabled={v.stock <= 0}
                      className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all ${
                        selectedVariant?.sku === v.sku
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      } ${v.stock <= 0 ? 'opacity-40 line-through cursor-not-allowed' : ''}`}
                    >
                      {v.label}
                      {v.stock > 0 && v.stock <= 3 && (
                        <span className="ml-1 text-xs text-red-500">({v.stock} left)</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Qty + Add to cart */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-11 h-12 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-lg">−</button>
                <span className="w-12 text-center font-black text-gray-900">{qty}</span>
                <button onClick={() => setQty(q => Math.min(product.stock_qty || 99, q + 1))}
                  className="w-11 h-12 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-lg">+</button>
              </div>

              <Btn
                onClick={handleAddToCart}
                loading={adding}
                disabled={isOutOfStock}
                variant="primary"
                size="lg"
                className="flex-1"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
              >
                {isOutOfStock ? 'Out of Stock' : t('product_add_to_cart')}
              </Btn>

              <button
                onClick={handleWishlist}
                title={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all ${
                  wishlisted
                    ? 'border-red-400 bg-red-50 text-red-500'
                    : 'border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-400'
                }`}
              >
                <svg className="w-5 h-5" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>

            {/* Buy now */}
            {!isOutOfStock && (
              <Btn onClick={handleBuyNow} variant="outline" size="lg" fullWidth className="mb-3">
                ⚡ Buy Now — Checkout Instantly
              </Btn>
            )}

            {/* WhatsApp */}
            <a
              href={`https://wa.me/254700000000?text=Hi! I'd like to order: ${encodeURIComponent(name)} (${formatPrice(product.price_kes, 'KES', {})}). Ref: ${product.sku || product.id}`}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#25D366] hover:opacity-90 text-white font-semibold rounded-xl transition-opacity text-sm mb-5"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Order via WhatsApp
            </a>

            {/* Product meta */}
            <div className="border-t border-gray-100 pt-4 space-y-2">
              {product.sku && (
                <div className="flex gap-2 text-sm">
                  <span className="text-gray-400 w-24 shrink-0">SKU:</span>
                  <span className="text-gray-700 font-mono">{product.sku}</span>
                </div>
              )}
              {product.weight_grams && (
                <div className="flex gap-2 text-sm">
                  <span className="text-gray-400 w-24 shrink-0">Weight:</span>
                  <span className="text-gray-700">{product.weight_grams}g</span>
                </div>
              )}
              {product.track_inventory && !isOutOfStock && (
                <div className="flex gap-2 text-sm">
                  <span className="text-gray-400 w-24 shrink-0">Stock:</span>
                  <span className={`font-semibold ${isLowStock ? 'text-orange-500' : 'text-emerald-600'}`}>
                    {product.stock_qty} available
                  </span>
                </div>
              )}
              {product.tags && (
                <div className="flex gap-2 text-sm flex-wrap">
                  <span className="text-gray-400 w-24 shrink-0">Tags:</span>
                  <div className="flex flex-wrap gap-1">
                    {product.tags.split(',').map(tag => (
                      <span key={tag.trim()} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────────── */}
        <div className="mb-14">
          <div className="flex border-b border-gray-200 mb-6 gap-1 overflow-x-auto no-scrollbar">
            {[
              { key: 'description', label: t('product_description') },
              { key: 'reviews',     label: `${t('product_reviews', { n: reviews.length })} (${reviews.length})` },
              { key: 'shipping',    label: '🚚 Delivery & Returns' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === key
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Description tab */}
          {activeTab === 'description' && (
            <div className="max-w-3xl">
              {description ? (
                <div
                  className="prose prose-sm prose-emerald max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              ) : (
                <p className="text-gray-400 italic">No description available.</p>
              )}
            </div>
          )}

          {/* Reviews tab */}
          {activeTab === 'reviews' && (
            <div className="max-w-3xl">
              <ReviewSummary reviews={reviews} avgRating={product.avg_rating} />

              <div className="space-y-4 mb-8">
                {reviews.map(review => (
                  <div key={review.id} className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-sm">
                          <span className="text-white font-black text-sm">
                            {review.expand?.user_id?.name?.charAt(0)?.toUpperCase() || 'C'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">
                            {review.expand?.user_id?.name || 'Customer'}
                          </p>
                          <div className="flex items-center gap-2">
                            <StarRating rating={review.rating} />
                            {review.is_verified && (
                              <span className="text-xs text-emerald-600 font-medium">✅ Verified</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 shrink-0 ml-2">
                        {format(new Date(review.created), 'dd MMM yyyy')}
                      </p>
                    </div>
                    {review.title && <p className="font-semibold text-gray-900 mt-2 text-sm">{review.title}</p>}
                    {review.body  && <p className="text-gray-600 text-sm mt-1 leading-relaxed">{review.body}</p>}
                  </div>
                ))}

                {reviews.length === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-2xl">
                    <div className="text-4xl mb-3">⭐</div>
                    <p className="text-gray-600 font-semibold">{t('product_no_reviews')}</p>
                    <p className="text-sm text-gray-400 mt-1">{t('product_be_first_review')}</p>
                  </div>
                )}
              </div>

              {user ? (
                <div className="bg-gradient-to-br from-gray-50 to-emerald-50/30 border border-gray-100 rounded-2xl p-6">
                  <h3 className="font-black text-gray-900 mb-1">{t('review_title')}</h3>
                  <p className="text-sm text-gray-500 mb-4">Share your experience with this product</p>
                  <form onSubmit={submitReview} className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1.5">{t('review_rating')}</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <button key={s} type="button"
                            onClick={() => setReviewForm(f => ({ ...f, rating: s }))}
                            className="text-2xl transition-all hover:scale-125 focus:outline-none">
                            <span className={s <= reviewForm.rating ? 'text-amber-400' : 'text-gray-300'}>★</span>
                          </button>
                        ))}
                        <span className="ml-2 text-sm text-gray-500 self-center">
                          {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][reviewForm.rating]}
                        </span>
                      </div>
                    </div>
                    <input
                      value={reviewForm.title}
                      onChange={e => setReviewForm(f => ({ ...f, title: e.target.value }))}
                      placeholder={t('review_headline')}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    <textarea
                      value={reviewForm.body}
                      onChange={e => setReviewForm(f => ({ ...f, body: e.target.value }))}
                      placeholder={t('review_body')}
                      rows={4}
                      required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white"
                    />
                    <Btn type="submit" loading={submitting} variant="primary">
                      {t('review_submit')}
                    </Btn>
                  </form>
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-2xl">
                  <p className="text-gray-600 mb-3">Sign in to write a review</p>
                  <Btn onClick={() => navigate('/login')} variant="outline" size="sm">Sign In</Btn>
                </div>
              )}
            </div>
          )}

          {/* Shipping tab */}
          {activeTab === 'shipping' && (
            <div className="max-w-2xl space-y-4">
              {[
                { icon: '🚚', title: 'Standard Delivery', desc: 'Delivered within 2–5 business days across Kenya. Free on orders over KES 2,000.' },
                { icon: '⚡', title: 'Express Delivery', desc: 'Same-day delivery available in Nairobi CBD and select areas. Order before 12pm.' },
                { icon: '↩️', title: 'Easy Returns', desc: 'Not satisfied? Return within 7 days in original condition for a full refund or exchange.' },
                { icon: '📦', title: 'Packaging', desc: 'All items are securely packaged to ensure they arrive in perfect condition.' },
              ].map(item => (
                <div key={item.title} className="flex gap-4 p-4 bg-gray-50 rounded-2xl">
                  <span className="text-2xl shrink-0">{item.icon}</span>
                  <div>
                    <p className="font-bold text-gray-900 text-sm mb-0.5">{item.title}</p>
                    <p className="text-gray-600 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Related products ─────────────────────────────────────────────────── */}
        {relatedFiltered.length > 0 && (
          <section className="mb-14">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-black text-gray-900">{t('product_related')}</h2>
              <Link to={`/shop/${product.expand?.category_id?.slug || ''}`}
                className="text-sm text-emerald-600 font-semibold hover:text-emerald-700">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {relatedFiltered.map(p => (
                <ProductCard key={p.id} product={p} showViewing={false} />
              ))}
            </div>
          </section>
        )}

        {/* ── Recently viewed ───────────────────────────────────────────────────── */}
        {recentlyViewed.length > 0 && (
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-5">Recently Viewed</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {recentlyViewed.map(p => (
                <ProductCard key={p.id} product={p} showViewing={false} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  )
}