import { useCallback } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { t as translate } from '../lib/i18n.js'
import pb from '../lib/pb.js'
import useAuthStore from '../store/auth.js'

// ── Language store (separate lightweight store) ────────────────────────────────
export const useLangStore = create(
  persist(
    (set) => ({
      lang: 'en',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'sg_lang' }
  )
)

/**
 * useTranslation — returns translation function + language state.
 *
 * Usage:
 *   const { t, lang, toggleLang } = useTranslation()
 *   t('nav_home')           → 'Home' or 'Nyumbani'
 *   t('product_low_stock', { n: 3 }) → 'Only 3 left!'
 */
export function useTranslation() {
  const { lang, setLang } = useLangStore()

  const t = useCallback(
    (key, vars = {}) => translate(lang, key, vars),
    [lang]
  )

  const toggleLang = useCallback(async () => {
    const next = lang === 'en' ? 'sw' : 'en'
    setLang(next)

    // Persist preference to PocketBase if logged in
    const user = pb.authStore.model
    if (user && user.collectionName === 'sg_users') {
      try {
        await pb.collection('sg_users').update(user.id, { language: next })
      } catch {
        // silent — local preference is already set
      }
    }
  }, [lang, setLang])

  return { t, lang, setLang, toggleLang }
}

export default useTranslation