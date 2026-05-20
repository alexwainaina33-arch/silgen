import { useState, useEffect } from 'react'
import Btn from './ui/Btn.jsx'

export default function PWAManager() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('sg_pwa_dismissed') === '1'
  )

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
      if (!dismissed) setTimeout(() => setShowBanner(true), 3000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [dismissed])

  const install = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setShowBanner(false)
    setInstallPrompt(null)
  }

  const dismiss = () => {
    setShowBanner(false)
    setDismissed(true)
    localStorage.setItem('sg_pwa_dismissed', '1')
  }

  if (!showBanner || dismissed) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white px-4 py-3">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <span className="text-xl shrink-0">📲</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Install SILGEN App</p>
          <p className="text-xs text-emerald-100">Shop faster, works offline, no app store needed</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Btn size="xs" variant="secondary" onClick={install}>Install</Btn>
          <button onClick={dismiss} className="text-emerald-200 hover:text-white p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}