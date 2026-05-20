import { useState } from 'react'
import { NavLink, useNavigate, Link } from 'react-router-dom'
import useAuthStore from '../store/auth.js'
import useTranslation from '../hooks/useTranslation.js'

const NAV_ITEMS = [
  { to: '/admin/dashboard', icon: '📊', key: 'admin_dashboard' },
  { to: '/admin/orders',    icon: '📦', key: 'admin_orders' },
  { to: '/admin/products',  icon: '🛍️', key: 'admin_products' },
  { to: '/admin/inventory', icon: '📋', key: 'admin_inventory' },
  { to: '/admin/customers', icon: '👥', key: 'admin_customers' },
  { to: '/admin/delivery',  icon: '🚚', key: 'admin_delivery' },
  { to: '/admin/chat',      icon: '💬', key: 'admin_chat' },
  { to: '/admin/reports',   icon: '📈', key: 'admin_reports' },
  { to: '/admin/settings',  icon: '⚙️', key: 'admin_settings' },
  { to: '/admin/audit-log', icon: '🔍', key: 'admin_audit' },
]

export default function AdminLayout({ children }) {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  const Sidebar = ({ mobile = false }) => (
    <aside className={`${mobile ? 'w-64' : 'w-56 hidden lg:flex'} flex-col bg-slate-800 text-white min-h-screen`}>
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-4 border-b border-slate-700">
        <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-black text-xs">SG</span>
        </div>
        <div>
          <p className="font-black text-sm text-white">SILGEN</p>
          <p className="text-xs text-slate-400">Admin Panel</p>
        </div>
      </div>

      {/* Admin info */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">{user?.name?.charAt(0)?.toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role || 'admin'}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon, key }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`
            }
          >
            <span className="text-base w-5 text-center shrink-0">{icon}</span>
            <span>{t(key)}</span>
          </NavLink>
        ))}

        {/* POS placeholder */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-500 cursor-not-allowed mt-2 border border-slate-700 border-dashed">
          <span className="text-base w-5 text-center shrink-0">🖥️</span>
          <span className="truncate">POS — Phase 2</span>
        </div>
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-slate-700 space-y-1">
        <Link to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
          <span>🏪</span> View Store
        </Link>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors">
          <span>🚪</span> {t('nav_logout')}
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Admin top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center gap-4 px-4 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1" />

          <Link to="/"
            className="text-xs text-gray-500 hover:text-emerald-600 transition-colors hidden sm:block">
            ← View store
          </Link>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-lg">
            <span className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">
              {user?.name?.charAt(0)?.toUpperCase()}
            </span>
            <span className="text-sm font-medium hidden sm:block">{user?.name?.split(' ')[0]}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}