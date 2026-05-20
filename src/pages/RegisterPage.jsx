import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import useAuthStore from '../store/auth.js'
import useTranslation from '../hooks/useTranslation.js'
import { findUserByReferralCode, storeReferralCode, getStoredReferralCode, clearStoredReferralCode } from '../lib/referral.js'
import Btn from '../components/ui/Btn.jsx'
import Input from '../components/ui/Input.jsx'
import toast from 'react-hot-toast'

const STEPS = ['Account', 'Personal', 'Preferences']

export default function RegisterPage() {
  const { t } = useTranslation()
  const { register, loading, user, clearError } = useAuthStore()
  const navigate = useNavigate()
  const { code: urlCode } = useParams() // from /ref/:code

  const [step, setStep]               = useState(0)
  const [showPw, setShowPw]           = useState(false)
  const [referrerName, setReferrerName] = useState('')
  const [referrerId, setReferrerId]   = useState('')
  const [form, setForm] = useState({
    name:           '',
    email:          '',
    password:       '',
    phone:          '',
    referral_code:  '',
    language:       'en',
    currency:       'KES',
    whatsapp_opt_in: true,
    email_opt_in:   true,
  })

  useEffect(() => { if (user) navigate('/') }, [user])
  useEffect(() => { clearError() }, [])

  // Handle /ref/:code route or stored code
  useEffect(() => {
    const code = urlCode || getStoredReferralCode()
    if (code) {
      storeReferralCode(code)
      setForm((f) => ({ ...f, referral_code: code }))
      // Lookup referrer name for social proof
      findUserByReferralCode(code).then((u) => {
        if (u) setReferrerName(u.name?.split(' ')[0] || 'a friend')
        setReferrerId(u?.id || '')
      })
    }
  }, [urlCode])

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: val }))
  }

  // Validate referral code on blur
  const validateReferral = async () => {
    if (!form.referral_code) return
    const u = await findUserByReferralCode(form.referral_code)
    if (u) {
      setReferrerName(u.name?.split(' ')[0])
      setReferrerId(u.id)
    } else {
      setReferrerName('')
      setReferrerId('')
    }
  }

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const prevStep = () => setStep((s) => Math.max(s - 1, 0))

  // Step validation
  const canAdvance = () => {
    if (step === 0) return form.email && form.password.length >= 8
    if (step === 1) return form.name && form.phone
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (step < STEPS.length - 1) { nextStep(); return }

    const res = await register({
      name:        form.name,
      email:       form.email,
      password:    form.password,
      phone:       form.phone,
      referredById: referrerId || undefined,
    })

    if (res.success) {
      clearStoredReferralCode()
      toast.success('🎉 ' + t('auth_register_success'))

      // Show loyalty bonus if referred
      if (referrerId) {
        setTimeout(() => toast.success('⭐ 200 loyalty points added to your account!', { duration: 5000 }), 1500)
      }
      navigate('/')
    } else {
      toast.error(res.error || 'Registration failed')
    }
  }

  const passwordStrength = () => {
    const p = form.password
    if (!p) return null
    if (p.length < 6) return { label: 'Too short', color: 'bg-red-500', width: '20%' }
    if (p.length < 8) return { label: 'Weak', color: 'bg-orange-400', width: '40%' }
    if (!/[A-Z]/.test(p) || !/[0-9]/.test(p)) return { label: 'Fair', color: 'bg-amber-400', width: '60%' }
    if (p.length >= 10) return { label: 'Strong', color: 'bg-emerald-500', width: '100%' }
    return { label: 'Good', color: 'bg-emerald-400', width: '80%' }
  }

  const pwStr = passwordStrength()

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 flex">

      {/* ── Left panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-5/12 bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/50 to-slate-900" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-lg">SG</span>
            </div>
            <span className="text-white font-black text-2xl">SILGEN</span>
          </div>

          {referrerName ? (
            <div className="mb-8 p-4 bg-amber-500/20 border border-amber-500/40 rounded-2xl">
              <div className="text-3xl mb-2">🎁</div>
              <p className="text-amber-400 font-bold text-lg">{referrerName} invited you!</p>
              <p className="text-gray-300 text-sm mt-1">
                You'll get <span className="text-amber-400 font-bold">200 loyalty points</span> (worth KES 100) when you complete your first order.
              </p>
            </div>
          ) : (
            <div className="mb-8">
              <h2 className="text-3xl font-black text-white leading-tight mb-3">
                Join thousands of<br />
                <span className="text-emerald-400">smart shoppers</span>
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Shop local products, book services, earn loyalty points and send gifts to Kenya — all from one account.
              </p>
            </div>
          )}

          {/* Benefits */}
          <div className="space-y-3">
            {[
              { icon: '⭐', text: 'Earn 1 loyalty point per KES 1 spent' },
              { icon: '🎁', text: 'Earn 500 points for every friend you refer' },
              { icon: '💬', text: 'WhatsApp order updates & tracking' },
              { icon: '🔄', text: 'Subscribe to your favourites & save' },
              { icon: '🌍', text: 'Send gifts to Kenya from anywhere' },
              { icon: '📦', text: 'One-click reorder on past purchases' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-lg shrink-0">{icon}</span>
                <span className="text-gray-300 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-3 gap-3">
          {[
            { n: '20+', label: 'Categories' },
            { n: '<5s', label: 'M-Pesa Pay' },
            { n: '6', label: 'Currencies' },
          ].map(({ n, label }) => (
            <div key={label} className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
              <p className="text-emerald-400 font-black text-xl">{n}</p>
              <p className="text-gray-400 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ──────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">SG</span>
            </div>
            <span className="font-black text-xl text-gray-900">SIL<span className="text-emerald-600">GEN</span></span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-black text-gray-900">{t('auth_register_title')} 🚀</h1>
            <p className="text-gray-500 text-sm mt-1">{t('auth_register_subtitle')}</p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                  i < step ? 'bg-emerald-600 text-white' :
                  i === step ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' :
                  'bg-gray-200 text-gray-400'
                }`}>
                  {i < step ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-emerald-700' : 'text-gray-400'}`}>{s}</span>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Step 0: Account ────────────────────────────── */}
            {step === 0 && (
              <>
                <Input
                  label={t('auth_email')}
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  }
                />

                <div>
                  <Input
                    label={t('auth_password')}
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder="Min. 8 characters"
                    required
                    autoComplete="new-password"
                    hint="Use uppercase, numbers and symbols for a strong password"
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    }
                    iconRight={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showPw
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                        }
                      </svg>
                    }
                    onIconRightClick={() => setShowPw(!showPw)}
                  />

                  {/* Password strength bar */}
                  {pwStr && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${pwStr.color}`} style={{ width: pwStr.width }} />
                      </div>
                      <p className={`text-xs mt-1 font-medium ${
                        pwStr.label === 'Strong' ? 'text-emerald-600' :
                        pwStr.label === 'Good'   ? 'text-emerald-500' :
                        pwStr.label === 'Fair'   ? 'text-amber-500'   : 'text-red-500'
                      }`}>{pwStr.label} password</p>
                    </div>
                  )}
                </div>

                <Input
                  label={t('auth_referral_code')}
                  type="text"
                  value={form.referral_code}
                  onChange={set('referral_code')}
                  onBlur={validateReferral}
                  placeholder="e.g. SGABC123"
                  className="uppercase"
                  icon={<span className="text-sm">🎁</span>}
                  hint={referrerName
                    ? `✅ Referred by ${referrerName} — you'll get 200 bonus points!`
                    : 'Have a referral code? Get 200 bonus loyalty points'}
                />
              </>
            )}

            {/* ── Step 1: Personal ───────────────────────────── */}
            {step === 1 && (
              <>
                <Input
                  label={t('auth_name')}
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Jane Wanjiku"
                  required
                  autoComplete="name"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  }
                />

                <Input
                  label={t('auth_phone')}
                  type="tel"
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+254 7XX XXX XXX"
                  required
                  autoComplete="tel"
                  hint="Used for M-Pesa payments and WhatsApp order updates"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  }
                />

                {/* Diaspora option */}
                <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                  <p className="text-sm font-semibold text-gray-800 mb-3">Are you in the Kenyan diaspora? 🌍</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'KES', flag: '🇰🇪', label: 'Kenya (KES)' },
                      { value: 'GBP', flag: '🇬🇧', label: 'UK (GBP)' },
                      { value: 'USD', flag: '🇺🇸', label: 'USA (USD)' },
                      { value: 'CAD', flag: '🇨🇦', label: 'Canada (CAD)' },
                    ].map(({ value, flag, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, currency: value }))}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                          form.currency === value
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span>{flag}</span>
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── Step 2: Preferences ────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="font-bold text-emerald-800 text-sm mb-1">🎉 Almost there!</p>
                  <p className="text-emerald-700 text-xs">Just set your notification preferences and you're ready to shop.</p>
                </div>

                {/* Language */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Preferred Language</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ value: 'en', label: '🇬🇧 English' }, { value: 'sw', label: '🇰🇪 Kiswahili' }].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, language: value }))}
                        className={`py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                          form.language === value
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 bg-white text-gray-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notifications */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Notification Preferences</p>

                  {[
                    {
                      key: 'whatsapp_opt_in',
                      icon: '💬',
                      title: 'WhatsApp Updates',
                      desc: 'Order confirmations, tracking & deals via WhatsApp',
                    },
                    {
                      key: 'email_opt_in',
                      icon: '📧',
                      title: 'Email Notifications',
                      desc: 'Order receipts and account alerts via email',
                    },
                  ].map(({ key, icon, title, desc }) => (
                    <label key={key}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        form[key] ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <span className="text-xl shrink-0">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{title}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                      <div className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${form[key] ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        <input type="checkbox" className="sr-only" checked={form[key]} onChange={set(key)} />
                      </div>
                    </label>
                  ))}
                </div>

                {/* KDPA notice */}
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>
                    Your data is protected under the <strong>Kenya Data Protection Act 2019 (KDPA)</strong>. We never sell your data.{' '}
                    <Link to="/privacy-policy" className="underline font-medium">Privacy Policy</Link>
                  </span>
                </div>

                {/* Points summary */}
                {referrerName && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-2xl">⭐</span>
                    <div>
                      <p className="text-sm font-bold text-amber-800">200 bonus points waiting!</p>
                      <p className="text-xs text-amber-700">Complete your first order to unlock KES 100 discount</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-2">
              {step > 0 && (
                <Btn type="button" variant="outline" onClick={prevStep} size="md">
                  ← {t('btn_back')}
                </Btn>
              )}
              <Btn
                type="submit"
                loading={loading}
                fullWidth
                disabled={!canAdvance()}
                variant="primary"
                size="lg"
              >
                {step < STEPS.length - 1
                  ? `${t('btn_next')} →`
                  : `🚀 ${t('auth_register_btn')}`}
              </Btn>
            </div>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {t('auth_have_account')}{' '}
            <Link to="/login" className="text-emerald-600 font-semibold hover:text-emerald-700">
              {t('auth_login_btn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}