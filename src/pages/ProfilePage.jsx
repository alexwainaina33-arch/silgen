import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import useAuthStore from '../store/auth.js'
import useTranslation from '../hooks/useTranslation.js'
import { useCurrencyStore } from '../components/CurrencySelector.jsx'
import pb from '../lib/pb.js'
import Btn from '../components/ui/Btn.jsx'
import Input from '../components/ui/Input.jsx'
import { ConfirmModal } from '../components/ui/Modal.jsx'
import Badge from '../components/ui/Badge.jsx'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const SECTIONS = ['profile', 'security', 'notifications', 'privacy', 'danger']

export default function ProfilePage() {
  const { t, lang, setLang } = useTranslation()
  const { user, updateProfile, logout, refreshUser } = useAuthStore()
  const { currency, setCurrency } = useCurrencyStore()

  const [section, setSection]         = useState('profile')
  const [saving, setSaving]           = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [form, setForm] = useState({
    name:            user?.name || '',
    phone:           user?.phone || '',
    country:         user?.country || 'KE',
    whatsapp_opt_in: user?.whatsapp_opt_in ?? true,
    email_opt_in:    user?.email_opt_in ?? true,
    language:        user?.language || 'en',
    currency:        user?.currency || 'KES',
  })

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: val }))
  }

  useEffect(() => { refreshUser() }, [])

  const saveProfile = async () => {
    setSaving(true)
    const res = await updateProfile({
      name:            form.name,
      phone:           form.phone,
      country:         form.country,
      whatsapp_opt_in: form.whatsapp_opt_in,
      email_opt_in:    form.email_opt_in,
      language:        form.language,
      currency:        form.currency,
    })
    setSaving(false)

    if (res.success) {
      // Sync language & currency preferences app-wide
      setLang(form.language)
      setCurrency(form.currency)
      toast.success('✅ ' + t('profile_saved'))
    } else {
      toast.error('Failed to save profile')
    }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.newPw.length < 8) { toast.error('Password must be at least 8 characters'); return }

    setSaving(true)
    try {
      await pb.collection('sg_users').update(user.id, {
        oldPassword:     pwForm.current,
        password:        pwForm.newPw,
        passwordConfirm: pwForm.confirm,
      })
      toast.success('🔒 Password updated successfully')
      setPwForm({ current: '', newPw: '', confirm: '' })
    } catch (err) {
      toast.error(err?.response?.message || 'Password change failed')
    }
    setSaving(false)
  }

  const downloadData = async () => {
    // KDPA right to data portability
    try {
      const orders = await pb.collection('sg_orders').getFullList({ filter: `user_id = "${user.id}"` })
      const loyalty = await pb.collection('sg_loyalty_transactions').getFullList({ filter: `user_id = "${user.id}"` })

      const data = {
        profile:  { name: user.name, email: user.email, phone: user.phone, created: user.created },
        orders:   orders.map((o) => ({ ref: o.ref, total: o.total_kes, status: o.status, date: o.created })),
        loyalty:  loyalty.map((l) => ({ type: l.type, points: l.points, date: l.created })),
        exported: new Date().toISOString(),
        note:     'Exported under KDPA 2019 right to data portability.',
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `silgen-data-${user.id}-${format(new Date(), 'yyyy-MM-dd')}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully')
    } catch {
      toast.error('Export failed. Try again.')
    }
  }

  const deleteAccount = async () => {
    // KDPA right to erasure — anonymise user data
    setDeleteLoading(true)
    try {
      await updateProfile({
        name:    `Deleted User ${user.id.slice(-4)}`,
        phone:   '',
        country: '',
        is_active: false,
      })
      logout()
      toast.success('Account deleted. We hope to see you again.')
    } catch {
      toast.error('Could not delete account. Contact support.')
    }
    setDeleteLoading(false)
  }

  const navItems = [
    { key: 'profile',       icon: '👤', label: 'Profile' },
    { key: 'security',      icon: '🔒', label: 'Security' },
    { key: 'notifications', icon: '🔔', label: 'Notifications' },
    { key: 'privacy',       icon: '🛡️', label: 'Privacy & Data' },
    { key: 'danger',        icon: '⚠️', label: 'Danger Zone' },
  ]

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <span className="text-emerald-700 font-black text-2xl">
              {user?.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">{user?.name}</h1>
            <p className="text-gray-500 text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              {user?.loyalty_points > 0 && (
                <Badge variant="loyalty" size="xs">⭐ {user.loyalty_points?.toLocaleString()} pts</Badge>
              )}
              <Badge variant="success" size="xs" dot>Active</Badge>
              {user?.is_diaspora && <Badge variant="info" size="xs">🌍 Diaspora</Badge>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Sidebar nav */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {navItems.map(({ key, icon, label }) => (
                <button
                  key={key}
                  onClick={() => setSection(key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left transition-colors border-l-4 ${
                    section === key
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : key === 'danger'
                      ? 'border-transparent text-red-500 hover:bg-red-50'
                      : 'border-transparent text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base w-5 text-center">{icon}</span>
                  {label}
                </button>
              ))}

              {/* Quick links */}
              <div className="border-t border-gray-100 p-3 space-y-1">
                {[
                  { to: '/orders',        label: '📦 My Orders' },
                  { to: '/loyalty',       label: '⭐ Loyalty Points' },
                  { to: '/referrals',     label: '🎁 Referrals' },
                  { to: '/subscriptions', label: '🔄 Subscriptions' },
                ].map(({ to, label }) => (
                  <Link key={to} to={to}
                    className="block px-3 py-2 text-xs text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

              {/* ── Profile section ──────────────────────────── */}
              {section === 'profile' && (
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-6">Profile Information</h2>
                  <div className="space-y-4">
                    <Input label={t('auth_name')} value={form.name} onChange={set('name')}
                      placeholder="Your full name" />
                    <Input label="Email Address" value={user?.email || ''} disabled
                      hint="Email cannot be changed. Contact support if needed."
                      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                    />
                    <Input label={t('auth_phone')} value={form.phone} onChange={set('phone')}
                      placeholder="+254 7XX XXX XXX" type="tel"
                      hint="Used for M-Pesa payments" />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">{t('profile_language')}</p>
                        <div className="flex gap-2">
                          {[{ v: 'en', l: '🇬🇧 EN' }, { v: 'sw', l: '🇰🇪 SW' }].map(({ v, l }) => (
                            <button key={v} type="button"
                              onClick={() => setForm((f) => ({ ...f, language: v }))}
                              className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                                form.language === v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'
                              }`}>{l}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">{t('profile_currency')}</p>
                        <select value={form.currency} onChange={set('currency')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                          {['KES', 'USD', 'GBP', 'EUR', 'CAD', 'AUD'].map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
                    <Btn onClick={saveProfile} loading={saving} variant="primary">{t('profile_save')}</Btn>
                  </div>
                </div>
              )}

              {/* ── Security section ─────────────────────────── */}
              {section === 'security' && (
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-6">Security Settings</h2>

                  {/* Last login info */}
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Account Secure</p>
                      <p className="text-xs text-emerald-700">
                        Last seen: {user?.last_seen ? format(new Date(user.last_seen), 'dd MMM yyyy HH:mm') : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <form onSubmit={changePassword} className="space-y-4">
                    <Input label="Current Password" type="password" value={pwForm.current}
                      onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                      placeholder="••••••••" required />
                    <Input label="New Password" type="password" value={pwForm.newPw}
                      onChange={(e) => setPwForm((f) => ({ ...f, newPw: e.target.value }))}
                      placeholder="Min. 8 characters" required
                      hint="Use uppercase letters, numbers and symbols" />
                    <Input label="Confirm New Password" type="password" value={pwForm.confirm}
                      onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                      placeholder="••••••••" required
                      error={pwForm.confirm && pwForm.newPw !== pwForm.confirm ? 'Passwords do not match' : ''} />
                    <div className="flex justify-end">
                      <Btn type="submit" loading={saving} variant="secondary">Update Password</Btn>
                    </div>
                  </form>
                </div>
              )}

              {/* ── Notifications section ─────────────────────── */}
              {section === 'notifications' && (
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-6">{t('profile_language')} & Notifications</h2>
                  <div className="space-y-4">
                    {[
                      {
                        key: 'whatsapp_opt_in',
                        icon: '💬',
                        title: t('profile_whatsapp_opt'),
                        desc: 'Receive order confirmations, tracking updates and delivery alerts on WhatsApp',
                        recommended: true,
                      },
                      {
                        key: 'email_opt_in',
                        icon: '📧',
                        title: t('profile_email_opt'),
                        desc: 'Order receipts, account updates and promotional emails',
                      },
                    ].map(({ key, icon, title, desc, recommended }) => (
                      <div key={key}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          form[key] ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
                        }`}
                        onClick={() => setForm((f) => ({ ...f, [key]: !f[key] }))}
                      >
                        <span className="text-2xl shrink-0">{icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-800">{title}</p>
                            {recommended && <Badge variant="success" size="xs">Recommended</Badge>}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                        </div>
                        <div className={`w-11 h-6 rounded-full relative shrink-0 transition-colors ${form[key] ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
                    <Btn onClick={saveProfile} loading={saving} variant="primary">{t('btn_save')}</Btn>
                  </div>
                </div>
              )}

              {/* ── Privacy section ──────────────────────────── */}
              {section === 'privacy' && (
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-2">{t('profile_privacy')}</h2>
                  <p className="text-sm text-gray-500 mb-6">
                    Your rights under the <strong>Kenya Data Protection Act 2019 (KDPA)</strong>
                  </p>

                  {/* KDPA Rights */}
                  <div className="space-y-3 mb-6">
                    {[
                      {
                        icon: '👁️',
                        title: 'Right to Access',
                        desc: 'Download a copy of all data we hold about you',
                        action: (
                          <Btn size="sm" variant="outline" onClick={downloadData}>
                            📥 Download My Data
                          </Btn>
                        ),
                      },
                      {
                        icon: '✏️',
                        title: 'Right to Rectification',
                        desc: 'Correct any inaccurate data in your profile',
                        action: (
                          <Btn size="sm" variant="ghost" onClick={() => setSection('profile')}>
                            Edit Profile →
                          </Btn>
                        ),
                      },
                      {
                        icon: '🍪',
                        title: 'Cookie Preferences',
                        desc: 'Manage what cookies we store on your device',
                        action: (
                          <Btn size="sm" variant="ghost"
                            onClick={() => { localStorage.removeItem('sg_cookie_consent'); window.location.reload() }}>
                            Reset Consent
                          </Btn>
                        ),
                      },
                      {
                        icon: '📋',
                        title: 'Privacy Policy',
                        desc: 'Full details on how we collect and use your data',
                        action: (
                          <Link to="/privacy-policy">
                            <Btn size="sm" variant="ghost">Read Policy →</Btn>
                          </Link>
                        ),
                      },
                    ].map(({ icon, title, desc, action }) => (
                      <div key={title} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-xl shrink-0">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{title}</p>
                          <p className="text-xs text-gray-500">{desc}</p>
                        </div>
                        <div className="shrink-0">{action}</div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                    <p className="font-bold mb-1">Data Retention Policy</p>
                    <p>We retain your account data for as long as your account is active. Order records are retained for 7 years for tax and legal compliance. You may request erasure of non-essential data at any time by contacting <strong>info@doublexsoftware.com</strong></p>
                  </div>
                </div>
              )}

              {/* ── Danger zone ───────────────────────────────── */}
              {section === 'danger' && (
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <span className="text-2xl">⚠️</span>
                    <h2 className="text-lg font-bold text-red-600">Danger Zone</h2>
                  </div>

                  <div className="border-2 border-red-200 rounded-2xl p-6 bg-red-50">
                    <h3 className="font-bold text-red-700 mb-1">Delete Account</h3>
                    <p className="text-sm text-red-600 mb-4">
                      This will permanently anonymise your account and remove your personal data. Your order history will be retained for legal compliance as required by Kenyan tax law. This action cannot be undone.
                    </p>

                    <div className="space-y-2 mb-4 text-xs text-red-700">
                      <p>✗ Your name and contact details will be removed</p>
                      <p>✗ Your loyalty points ({user?.loyalty_points || 0} pts) will be forfeited</p>
                      <p>✗ Active subscriptions will be cancelled</p>
                      <p>✓ Order history retained for 7 years (tax compliance)</p>
                    </div>

                    <Btn variant="danger" onClick={() => setDeleteModal(true)}>
                      Delete My Account
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={deleteAccount}
        loading={deleteLoading}
        danger
        title="Delete Account?"
        message="This will permanently remove your personal data. Your order history will be retained for 7 years for tax compliance. Loyalty points will be forfeited. This cannot be undone."
        confirmText="Yes, Delete My Account"
        cancelText="Cancel"
      />
    </Layout>
  )
}