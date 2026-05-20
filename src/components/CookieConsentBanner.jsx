import { useState, useEffect } from 'react'
import pb from '../lib/pb.js'
import useAuthStore from '../store/auth.js'
import useTranslation from '../hooks/useTranslation.js'
import Btn from './ui/Btn.jsx'

const CONSENT_KEY = 'sg_cookie_consent'
const VERSION     = '1.0'

export default function CookieConsentBanner() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [visible, setVisible] = useState(false)
  const [managing, setManaging] = useState(false)
  const [prefs, setPrefs] = useState({ analytics: false, marketing: false, functional: true })

  useEffect(() => {
    const saved = localStorage.getItem(CONSENT_KEY)
    if (!saved) {
      setTimeout(() => setVisible(true), 1500)
    }
  }, [])

  const save = async (analytics, marketing, functional, given) => {
    const payload = {
      user_id:       user?.id || undefined,
      session_id:    sessionStorage.getItem('sg_session_key') || '',
      ip_address:    '',
      consent_given: given,
      analytics,
      marketing,
      functional,
      consented_at:  given ? new Date().toISOString() : undefined,
      withdrawn_at:  !given ? new Date().toISOString() : undefined,
      version:       VERSION,
    }

    // Save to PocketBase sg_cookie_consents
    try {
      await pb.collection('sg_cookie_consents').create(payload)
    } catch { /* silent */ }

    localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...payload, ts: Date.now() }))
    setVisible(false)
  }

  const acceptAll = () => save(true, true, true, true)
  const savePrefs = () => save(prefs.analytics, prefs.marketing, prefs.functional, true)
  const rejectAll = () => save(false, false, true, false)

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {!managing ? (
          /* Simple banner */
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl shrink-0">🍪</span>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">{t('cookie_title')}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t('cookie_body')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" variant="primary" onClick={acceptAll}>{t('cookie_accept_all')}</Btn>
              <Btn size="sm" variant="outline" onClick={() => setManaging(true)}>{t('cookie_manage')}</Btn>
              <Btn size="sm" variant="ghost" onClick={rejectAll}>Reject All</Btn>
            </div>
          </div>
        ) : (
          /* Granular preferences */
          <div className="p-4 sm:p-5">
            <h3 className="font-bold text-gray-900 mb-3">{t('cookie_manage')}</h3>

            {/* Necessary — always on */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-800">Necessary cookies</p>
                <p className="text-xs text-gray-500">Required for the site to function. Cannot be disabled.</p>
              </div>
              <div className="w-10 h-5 bg-emerald-500 rounded-full relative shrink-0">
                <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
              </div>
            </div>

            {/* Analytics */}
            <ToggleRow
              label={t('cookie_analytics')}
              desc={t('cookie_analytics_desc')}
              checked={prefs.analytics}
              onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
            />

            {/* Marketing */}
            <ToggleRow
              label={t('cookie_marketing')}
              desc={t('cookie_marketing_desc')}
              checked={prefs.marketing}
              onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
            />

            {/* Functional */}
            <ToggleRow
              label={t('cookie_functional')}
              desc={t('cookie_functional_desc')}
              checked={prefs.functional}
              onChange={(v) => setPrefs((p) => ({ ...p, functional: v }))}
            />

            <div className="flex gap-2 mt-4">
              <Btn size="sm" variant="primary" onClick={savePrefs}>{t('cookie_save')}</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setManaging(false)}>{t('btn_back')}</Btn>
            </div>

            <p className="text-xs text-gray-400 mt-3">
              SILGEN complies with the Kenya Data Protection Act 2019 (KDPA).{' '}
              <a href="/privacy-policy" className="text-emerald-600 underline">Privacy Policy</a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full relative shrink-0 transition-colors ${checked ? 'bg-emerald-500' : 'bg-gray-300'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}