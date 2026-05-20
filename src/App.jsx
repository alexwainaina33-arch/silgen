import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { lazy, Suspense } from 'react'
import Layout from './components/Layout.jsx'
import AdminLayout from './components/AdminLayout.jsx'
import ProtectedRoute, { AdminRoute } from './components/ProtectedRoute.jsx'
import useAuthStore from './store/auth.js'
import useCartStore from './store/cart.js'
import LoginPage    from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ProfilePage  from './pages/ProfilePage.jsx'
import ShopPage     from './pages/ShopPage.jsx'
import ProductPage  from './pages/ProductPage.jsx'
import SearchPage        from './pages/SearchPage.jsx'
import CheckoutPage      from './pages/CheckoutPage.jsx'
import OrderConfirmPage  from './pages/OrderConfirmPage.jsx'
import OrdersPage        from './pages/OrdersPage.jsx'

// ── Loading fallback ──────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  </div>
)

// ── Placeholder (for steps not yet built) ────────────────────────
const Soon = ({ name }) => (
  <Layout>
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h1 className="text-2xl font-bold text-emerald-600">SILGEN</h1>
        <p className="text-gray-500 mt-2">{name} — coming in next step</p>
      </div>
    </div>
  </Layout>
)

const AdminSoon = ({ name }) => (
  <AdminLayout>
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">⚙️</div>
        <h1 className="text-2xl font-bold text-slate-700">{name}</h1>
        <p className="text-gray-500 mt-2">Coming in next step</p>
      </div>
    </div>
  </AdminLayout>
)

// ── Page components (replace Soon() as each step is built) ───────
const HomePage          = () => <Soon name="Home" />
const DealsPage         = () => <Soon name="Deals" />
const GiftPage          = () => <Soon name="Gift to Kenya" />
const GiftTrackingPage  = () => <Soon name="Gift Tracking" />
const LoyaltyPage       = () => <Soon name="Loyalty Points" />
const ReferralsPage     = () => <Soon name="Referrals" />
const SubscriptionsPage = () => <Soon name="Subscriptions" />
const WishlistPage      = () => <Soon name="Wishlist" />
const NotificationsPage = () => <Soon name="Notifications" />
const PrivacyPolicyPage = () => <Soon name="Privacy Policy" />

const AdminDashboard = () => <AdminSoon name="Dashboard" />
const AdminOrders    = () => <AdminSoon name="Orders" />
const AdminProducts  = () => <AdminSoon name="Products" />
const AdminInventory = () => <AdminSoon name="Inventory" />
const AdminCustomers = () => <AdminSoon name="Customers" />
const AdminDelivery  = () => <AdminSoon name="Delivery" />
const AdminLiveChat  = () => <AdminSoon name="Live Chat" />
const AdminReports   = () => <AdminSoon name="Reports" />
const AdminSettings  = () => <AdminSoon name="Settings" />
const AdminAuditLog  = () => <AdminSoon name="Audit Log" />

// ── App bootstrap ─────────────────────────────────────────────────
function AppInit() {
  const { user } = useAuthStore()
  const { loadServerCart } = useCartStore()

  useEffect(() => {
    if (user && user.collectionName !== 'sg_admins') {
      loadServerCart()
    }
  }, [user?.id])

  return null
}

export default function App() {
  return (
    <>
      <AppInit />
      <Routes>
        {/* ── Public storefront ── */}
        <Route path="/"                      element={<HomePage />} />
        <Route path="/shop"                  element={<ShopPage />} />
        <Route path="/shop/:categorySlug"    element={<ShopPage />} />
        <Route path="/product/:slug"         element={<ProductPage />} />
        <Route path="/search"                element={<SearchPage />} />
        <Route path="/deals"                 element={<DealsPage />} />
        <Route path="/gift"                  element={<GiftPage />} />
        <Route path="/gift-tracking/:ref"    element={<GiftTrackingPage />} />
        <Route path="/ref/:code"             element={<RegisterPage />} />
        <Route path="/privacy-policy"        element={<PrivacyPolicyPage />} />

        {/* ── Auth ── */}
        <Route path="/login"                 element={<LoginPage />} />
        <Route path="/register"              element={<RegisterPage />} />

        {/* ── Checkout ── */}
        <Route path="/checkout"              element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="/order-confirm/:ref"    element={<ProtectedRoute><OrderConfirmPage /></ProtectedRoute>} />

        {/* ── Customer account ── */}
        <Route path="/profile"               element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/orders"                element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/loyalty"               element={<ProtectedRoute><LoyaltyPage /></ProtectedRoute>} />
        <Route path="/referrals"             element={<ProtectedRoute><ReferralsPage /></ProtectedRoute>} />
        <Route path="/subscriptions"         element={<ProtectedRoute><SubscriptionsPage /></ProtectedRoute>} />
        <Route path="/wishlist"              element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
        <Route path="/notifications"         element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

        {/* ── Admin panel ── */}
        <Route path="/admin"                 element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard"       element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/orders"          element={<AdminRoute><AdminOrders /></AdminRoute>} />
        <Route path="/admin/products"        element={<AdminRoute><AdminProducts /></AdminRoute>} />
        <Route path="/admin/inventory"       element={<AdminRoute><AdminInventory /></AdminRoute>} />
        <Route path="/admin/customers"       element={<AdminRoute><AdminCustomers /></AdminRoute>} />
        <Route path="/admin/delivery"        element={<AdminRoute><AdminDelivery /></AdminRoute>} />
        <Route path="/admin/chat"            element={<AdminRoute><AdminLiveChat /></AdminRoute>} />
        <Route path="/admin/reports"         element={<AdminRoute><AdminReports /></AdminRoute>} />
        <Route path="/admin/settings"        element={<AdminRoute><AdminSettings /></AdminRoute>} />
        <Route path="/admin/audit-log"       element={<AdminRoute><AdminAuditLog /></AdminRoute>} />

        {/* ── 404 ── */}
        <Route path="*" element={
          <Layout>
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="text-center">
                <p className="text-6xl font-bold text-emerald-600">404</p>
                <p className="text-gray-500 mt-2">Page not found</p>
                <a href="/" className="mt-4 inline-block text-emerald-600 underline">Go home</a>
              </div>
            </div>
          </Layout>
        } />
      </Routes>
    </>
  )
}