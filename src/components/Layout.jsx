import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../store/auth.js'
import useCartStore from '../store/cart.js'
import useTranslation from '../hooks/useTranslation.js'
import { CountBadge } from './ui/Badge.jsx'
import NotificationBell from './NotificationBell.jsx'
import LanguageToggle from './LanguageToggle.jsx'
import CurrencySelector from './CurrencySelector.jsx'
import CartDrawer from './CartDrawer.jsx'
import SmartSearch from './SmartSearch.jsx'
import CookieConsentBanner from './CookieConsentBanner.jsx'
import PWAManager from './PWAManager.jsx'
import { trackPageView } from '../lib/analytics.js'

export default function Layout({ children }) {
  const { t } = useTranslation()
  const { user, isAdmin, logout } = useAuthStore()
  const { getItemCount } = useCartStore()
  const navigate = useNavigate()
  const location = useLocation()

  const [cartOpen, setCartOpen]       = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [scrolled, setScrolled]       = useState(false)

  // Track page views
  useEffect(() => {
    trackPageView(location.pathname)
  }, [location.pathname])

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false)
    setAccountOpen(false)
  }, [location.pathname])

  // Shadow on scroll
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const cartCount = getItemCount()

  const navLinks = [
    { to: '/',         label: t('nav_home'),     end: true },
    { to: '/shop',     label: t('nav_shop') },
    { to: '/deals',    label: t('nav_deals'),    badge: '🔥' },
    { to: '/gift',     label: t('nav_gift'),     badge: '🎁' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <PWAManager />

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-40 bg-white transition-shadow duration-200 ${scrolled ? 'shadow-md' : 'border-b border-gray-100'}`}>

        {/* Top bar — desktop only */}
        <div className="hidden md:block bg-emerald-700 text-white text-xs">
          <div className="max-w-7xl mx-auto px-4 h-8 flex items-center justify-between">
            <span>🇰🇪 Free delivery on orders above KES 5,000 in Nairobi</span>
            <div className="flex items-center gap-4">
              <a href="tel:+254700000000" className="hover:text-emerald-200 transition-colors">
                📞 +254 700 000 000
              </a>
              <span className="text-emerald-400">|</span>
              <a href="/privacy-policy" className="hover:text-emerald-200 transition-colors">
                {t('footer_privacy')}
              </a>
            </div>
          </div>
        </div>

        {/* Main header */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-16 flex items-center gap-3">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0 mr-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-sm">SG</span>
              </div>
              <span className="font-black text-xl text-gray-900 hidden sm:block tracking-tight">
                SIL<span className="text-emerald-600">GEN</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1 flex-1">
              {navLinks.map(({ to, label, end, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-emerald-700 bg-emerald-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`
                  }
                >
                  {label}
                  {badge && <span className="text-base">{badge}</span>}
                </NavLink>
              ))}
            </nav>

            {/* Search bar — desktop */}
            <div className="hidden md:flex flex-1 max-w-sm lg:max-w-md">
              <SmartSearch />
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1 ml-auto">
              {/* Language & currency — desktop */}
              <div className="hidden md:flex items-center gap-1">
                <LanguageToggle compact />
                <CurrencySelector compact />
              </div>

              {/* Notifications */}
              <NotificationBell />

              {/* Account */}
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setAccountOpen(!accountOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                      <span className="text-emerald-700 font-bold text-xs">
                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <span className="hidden md:block text-sm font-medium text-gray-700 max-w-[100px] truncate">
                      {user.name?.split(' ')[0]}
                    </span>
                    <svg className={`w-3 h-3 text-gray-400 hidden md:block transition-transform ${accountOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {accountOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        {user.loyalty_points > 0 && (
                          <p className="text-xs text-amber-600 font-medium mt-1">
                            ⭐ {user.loyalty_points.toLocaleString()} points
                          </p>
                        )}
                      </div>

                      {/* Links */}
                      {[
                        { to: '/profile',        icon: '👤', label: t('nav_profile') },
                        { to: '/orders',          icon: '📦', label: t('nav_orders') },
                        { to: '/loyalty',         icon: '⭐', label: t('nav_loyalty') },
                        { to: '/referrals',       icon: '🎁', label: t('nav_referrals') },
                        { to: '/subscriptions',   icon: '🔄', label: t('nav_subscriptions') },
                        { to: '/wishlist',        icon: '❤️', label: t('nav_wishlist') },
                      ].map(({ to, icon, label }) => (
                        <Link
                          key={to}
                          to={to}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setAccountOpen(false)}
                        >
                          <span className="text-base w-5 text-center">{icon}</span>
                          {label}
                        </Link>
                      ))}

                      {isAdmin && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-700 font-medium hover:bg-emerald-50 transition-colors border-t border-gray-100 mt-1"
                          onClick={() => setAccountOpen(false)}
                        >
                          <span className="text-base w-5 text-center">⚙️</span>
                          {t('nav_admin')}
                        </Link>
                      )}

                      <button
                        onClick={() => { handleLogout(); setAccountOpen(false) }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100 mt-1"
                      >
                        <span className="text-base w-5 text-center">🚪</span>
                        {t('nav_logout')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {t('nav_login')}
                  </Link>
                  <Link
                    to="/register"
                    className="px-3 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                  >
                    {t('nav_register')}
                  </Link>
                </div>
              )}

              {/* Cart */}
              <button
                onClick={() => setCartOpen(true)}
                className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Cart"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5">
                    <CountBadge count={cartCount} />
                  </span>
                )}
              </button>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Menu"
              >
                {mobileOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="md:hidden pb-3">
            <SmartSearch />
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white">
            <nav className="px-4 py-3 space-y-1">
              {navLinks.map(({ to, label, end, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'text-emerald-700 bg-emerald-50' : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  {badge && <span>{badge}</span>}
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* Mobile auth */}
            {!user ? (
              <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                <Link to="/login" className="flex-1 text-center py-2.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  {t('nav_login')}
                </Link>
                <Link to="/register" className="flex-1 text-center py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  {t('nav_register')}
                </Link>
              </div>
            ) : (
              <div className="px-4 py-3 border-t border-gray-100">
                <div className="flex items-center gap-3 mb-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <span className="text-emerald-700 font-bold">{user.name?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                    {user.loyalty_points > 0 && (
                      <p className="text-xs text-amber-600">⭐ {user.loyalty_points?.toLocaleString()} pts</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { to: '/orders',        label: t('nav_orders') },
                    { to: '/loyalty',       label: t('nav_loyalty') },
                    { to: '/wishlist',      label: t('nav_wishlist') },
                    { to: '/profile',       label: t('nav_profile') },
                  ].map(({ to, label }) => (
                    <Link key={to} to={to}
                      className="text-center py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                      {label}
                    </Link>
                  ))}
                </div>
                {isAdmin && (
                  <Link to="/admin"
                    className="mt-2 block text-center py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">
                    ⚙️ {t('nav_admin')}
                  </Link>
                )}
                <button onClick={handleLogout}
                  className="mt-2 w-full py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                  {t('nav_logout')}
                </button>
              </div>
            )}

            {/* Mobile lang/currency */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-3">
              <LanguageToggle />
              <CurrencySelector />
            </div>
          </div>
        )}
      </header>

      {/* ── PAGE CONTENT ────────────────────────────────────────── */}
      <main className="flex-1">
        {children}
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-gray-300 mt-auto">
        {/* Main footer */}
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-sm">SG</span>
                </div>
                <span className="font-black text-xl text-white">SILGEN</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                Kenya's premium e-commerce & services platform. Shop smart, live well. 🇰🇪
              </p>
              <div className="flex gap-3">
                <a href="https://wa.me/254700000000" target="_blank" rel="noreferrer"
                  className="w-8 h-8 bg-[#25D366] rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Shop */}
            <div>
              <h4 className="font-bold text-white mb-3 text-sm uppercase tracking-wide">Shop</h4>
              <ul className="space-y-2 text-sm">
                {[
                  { to: '/shop',    label: 'All Products' },
                  { to: '/deals',   label: 'Deals & Offers' },
                  { to: '/gift',    label: 'Gift to Kenya' },
                  { to: '/search',  label: 'Search' },
                ].map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className="hover:text-emerald-400 transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Account */}
            <div>
              <h4 className="font-bold text-white mb-3 text-sm uppercase tracking-wide">Account</h4>
              <ul className="space-y-2 text-sm">
                {[
                  { to: '/orders',        label: t('nav_orders') },
                  { to: '/loyalty',       label: t('nav_loyalty') },
                  { to: '/referrals',     label: t('nav_referrals') },
                  { to: '/subscriptions', label: t('nav_subscriptions') },
                ].map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className="hover:text-emerald-400 transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-bold text-white mb-3 text-sm uppercase tracking-wide">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/privacy-policy" className="hover:text-emerald-400 transition-colors">{t('footer_privacy')}</Link></li>
                <li><a href="mailto:info@doublexsoftware.com" className="hover:text-emerald-400 transition-colors">Contact Us</a></li>
                <li><span className="text-gray-400">📍 Nairobi, Kenya</span></li>
              </ul>

              {/* Payment logos */}
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">We accept</p>
                <div className="flex flex-wrap gap-2">
                  {['M-Pesa', 'Visa', 'PayPal'].map((p) => (
                    <span key={p} className="px-2 py-1 bg-slate-800 rounded text-xs text-gray-400 font-medium">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between text-xs text-gray-500">
            <span>{t('footer_rights', { year: new Date().getFullYear() })}</span>
            <span>{t('powered_by')}</span>
          </div>
        </div>
      </footer>

      {/* ── CART DRAWER ─────────────────────────────────────────── */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {/* ── KDPA COOKIE CONSENT ─────────────────────────────────── */}
      <CookieConsentBanner />
    </div>
  )
}