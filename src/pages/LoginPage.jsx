import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../store/auth.js'
import useTranslation from '../hooks/useTranslation.js'
import Btn from '../components/ui/Btn.jsx'
import Input from '../components/ui/Input.jsx'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { t } = useTranslation()
  const { login, loginAdmin, loading, error, user, clearError } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const [form, setForm]       = useState({ email: '', password: '' })
  const [showPw, setShowPw]   = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => { if (user) navigate(from, { replace: true }) }, [user])
  useEffect(() => { clearError() }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const fn = isAdmin ? loginAdmin : login
    const res = await fn(form.email, form.password)
    if (res.success) {
      toast.success(t('auth_login_success'))
      navigate(isAdmin ? '/admin/dashboard' : from, { replace: true })
    } else {
      toast.error(res.error || t('auth_error_invalid'))
    }
  }

  const EmailIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )

  const LockIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )

  const EyeOpenIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )

  const EyeClosedIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )

  const ShieldIcon = () => (
    <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd"
        d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd" />
    </svg>
  )

  const ErrorIcon = () => (
    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd" />
    </svg>
  )

  const trustPoints = [
    { icon: '🔒', title: 'KDPA Compliant', desc: 'Kenya Data Protection Act 2019' },
    { icon: '⚡', title: 'M-Pesa in 5s', desc: 'Fastest STK Push confirmation' },
    { icon: '🌍', title: 'Diaspora Ready', desc: 'USD, GBP, EUR, CAD, AUD' },
    { icon: '💬', title: 'WhatsApp Updates', desc: 'Every order tracked live' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 flex">

      {/* ── Left brand panel ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-emerald-700 relative overflow-hidden flex-col justify-between p-12">

        {/* Decorative rings */}
        <div className="absolute inset-0 opacity-10">
          {[120, 240, 360, 480, 600, 720].map((size, i) => (
            <div
              key={i}
              className="absolute rounded-full border-2 border-white"
              style={{
                width:     size,
                height:    size,
                top:       '50%',
                left:      '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>

        {/* Top: logo + headline */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <span className="text-emerald-700 font-black text-lg">SG</span>
            </div>
            <span className="text-white font-black text-2xl tracking-tight">SILGEN</span>
          </div>

          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            Kenya's Premium
            <br />
            <span className="text-amber-400">E-Commerce</span>
            <br />
            Platform
          </h2>
          <p className="text-emerald-100 text-lg leading-relaxed">
            Shop local products, book services, send gifts to Kenya — all in one place.
            Pay with M-Pesa, Visa or PayPal.
          </p>
        </div>

        {/* Bottom: trust grid */}
        <div className="relative z-10 grid grid-cols-2 gap-4">
          {trustPoints.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20"
            >
              <div className="text-2xl mb-1">{icon}</div>
              <p className="text-white font-semibold text-sm">{title}</p>
              <p className="text-emerald-200 text-xs">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">SG</span>
            </div>
            <span className="font-black text-xl text-gray-900">
              SIL<span className="text-emerald-600">GEN</span>
            </span>
          </div>

          {/* Customer / Admin toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
            <button
              type="button"
              onClick={() => setIsAdmin(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                !isAdmin ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              🛍️ Customer Login
            </button>
            <button
              type="button"
              onClick={() => setIsAdmin(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                isAdmin ? 'bg-white text-slate-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              ⚙️ Admin Login
            </button>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-gray-900">
              {isAdmin ? 'Admin Portal 👋' : t('auth_login_title') + ' 👋'}
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              {isAdmin
                ? 'Sign in to the SILGEN admin panel'
                : t('auth_login_subtitle')}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            <Input
              label={t('auth_email')}
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@example.com"
              required
              autoComplete="email"
              icon={<EmailIcon />}
            />

            <Input
              label={t('auth_password')}
              type={showPw ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              icon={<LockIcon />}
              iconRight={showPw ? <EyeClosedIcon /> : <EyeOpenIcon />}
              onIconRightClick={() => setShowPw((v) => !v)}
            />

            <div className="flex justify-end">
              <a href="#" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                {t('auth_forgot_password')}
              </a>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <ErrorIcon />
                {error}
              </div>
            )}

            <Btn
              type="submit"
              loading={loading}
              fullWidth
              size="lg"
              variant={isAdmin ? 'secondary' : 'primary'}
            >
              {t('auth_login_btn')}
            </Btn>
          </form>

          {!isAdmin && (
            <div>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">{t('auth_or')}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
                <span className="text-2xl shrink-0">💬</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">Prefer WhatsApp?</p>
                  <p className="text-xs text-gray-500">Browse and order entirely within WhatsApp — no app needed</p>
                </div>
                <a href="https://wa.me/254700000000" target="_blank" rel="noreferrer"
                  className="shrink-0 px-3 py-1.5 bg-[#25D366] text-white text-xs font-bold rounded-lg hover:opacity-90">
                  Chat
                </a>
              </div>
            </div>
          )}

          <p className="text-center text-sm text-gray-500">
            {t('auth_no_account')}{' '}
            <Link to="/register" className="text-emerald-600 font-semibold hover:text-emerald-700">
              {t('auth_register_btn')}
            </Link>
          </p>

          <div className="flex items-center justify-center gap-2 mt-8 text-xs text-gray-400">
            <ShieldIcon />
            <span>KDPA 2019 Compliant · Secured by PocketBase · 256-bit encryption</span>
          </div>

        </div>
      </div>
    </div>
  )
}