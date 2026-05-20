$dirs = @(
  "src/lib", "src/store", "src/hooks",
  "src/components/ui", "src/pages/admin",
  "public/icons", "pb_hooks"
)
foreach ($d in $dirs) {
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  Write-Host "Created: $d"
}

$files = @(
  "src/lib/pb.js", "src/lib/i18n.js", "src/lib/analytics.js",
  "src/lib/offlineQueue.js", "src/lib/referral.js",
  "src/lib/currency.js", "src/lib/export.js", "src/lib/mpesa.js",
  "src/store/auth.js", "src/store/cart.js", "src/store/notifications.js",
  "src/hooks/useTranslation.js", "src/hooks/useProducts.js",
  "src/hooks/useCheckout.js", "src/hooks/useLoyalty.js",
  "src/hooks/useDeals.js", "src/hooks/useChat.js",
  "src/hooks/useCurrency.js", "src/hooks/useAbandonedCart.js",
  "src/components/Layout.jsx", "src/components/AdminLayout.jsx",
  "src/components/ProtectedRoute.jsx", "src/components/ProductCard.jsx",
  "src/components/CategoryNav.jsx", "src/components/SmartSearch.jsx",
  "src/components/CartDrawer.jsx", "src/components/ChatWidget.jsx",
  "src/components/LanguageToggle.jsx", "src/components/CurrencySelector.jsx",
  "src/components/CountdownTimer.jsx", "src/components/DealBanner.jsx",
  "src/components/FlashSaleBadge.jsx", "src/components/LoyaltyPointsWidget.jsx",
  "src/components/SocialProofWidget.jsx", "src/components/NotificationBell.jsx",
  "src/components/PWAManager.jsx", "src/components/CookieConsentBanner.jsx",
  "src/components/ReorderButton.jsx",
  "src/components/ui/Badge.jsx", "src/components/ui/Btn.jsx",
  "src/components/ui/Input.jsx", "src/components/ui/Modal.jsx",
  "src/pages/HomePage.jsx", "src/pages/ShopPage.jsx",
  "src/pages/ProductPage.jsx", "src/pages/SearchPage.jsx",
  "src/pages/DealsPage.jsx", "src/pages/GiftPage.jsx",
  "src/pages/GiftTrackingPage.jsx", "src/pages/CheckoutPage.jsx",
  "src/pages/OrderConfirmPage.jsx", "src/pages/LoginPage.jsx",
  "src/pages/RegisterPage.jsx", "src/pages/ProfilePage.jsx",
  "src/pages/OrdersPage.jsx", "src/pages/LoyaltyPage.jsx",
  "src/pages/ReferralsPage.jsx", "src/pages/SubscriptionsPage.jsx",
  "src/pages/WishlistPage.jsx", "src/pages/NotificationsPage.jsx",
  "src/pages/PrivacyPolicyPage.jsx",
  "src/pages/admin/DashboardPage.jsx", "src/pages/admin/OrdersPage.jsx",
  "src/pages/admin/ProductsPage.jsx", "src/pages/admin/InventoryPage.jsx",
  "src/pages/admin/CustomersPage.jsx", "src/pages/admin/DeliveryPage.jsx",
  "src/pages/admin/LiveChatPage.jsx", "src/pages/admin/ReportsPage.jsx",
  "src/pages/admin/SettingsPage.jsx", "src/pages/admin/AuditLogPage.jsx",
  "pb_hooks/mpesa_stk.pb.js", "pb_hooks/mpesa_callback.pb.js",
  "pb_hooks/mpesa_paybill.pb.js", "pb_hooks/paypal_webhook.pb.js",
  "pb_hooks/whatsapp.pb.js", "pb_hooks/whatsapp_order_flow.pb.js",
  "pb_hooks/subscription_cron.pb.js", "pb_hooks/abandoned_cart_cron.pb.js",
  "pb_hooks/order_sequence.pb.js", "pb_hooks/audit_log.pb.js",
  "pb_hooks/low_stock_alert.pb.js"
)
foreach ($f in $files) {
  if (-not (Test-Path $f)) {
    New-Item -ItemType File -Force -Path $f | Out-Null
    Write-Host "Created: $f"
  }
}
Write-Host ""
Write-Host "Scaffold complete!"