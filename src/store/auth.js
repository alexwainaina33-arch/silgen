import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import pb from '../lib/pb.js'
import { generateReferralCode } from '../lib/referral.js'
import { trackEvent } from '../lib/analytics.js'

const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── State ───────────────────────────────────────────────────
      user:        pb.authStore.model || null,
      token:       pb.authStore.token || '',
      isAdmin:     pb.authStore.model?.collectionName === 'sg_admins',
      loading:     false,
      error:       null,

      // ── Helpers ─────────────────────────────────────────────────
      clearError: () => set({ error: null }),

      // ── Login (customer) ────────────────────────────────────────
      login: async (email, password) => {
        set({ loading: true, error: null })
        try {
          const authData = await pb
            .collection('sg_users')
            .authWithPassword(email, password)

          // Update last_seen
          pb.collection('sg_users')
            .update(authData.record.id, { last_seen: new Date().toISOString() })
            .catch(() => {})

          trackEvent('login', authData.record.id)

          set({
            user:    authData.record,
            token:   authData.token,
            isAdmin: false,
            loading: false,
          })
          return { success: true }
        } catch (err) {
          const msg = err?.response?.message || 'Invalid email or password'
          set({ loading: false, error: msg })
          return { success: false, error: msg }
        }
      },

      // ── Login (admin) ────────────────────────────────────────────
      loginAdmin: async (email, password) => {
        set({ loading: true, error: null })
        try {
          const authData = await pb
            .collection('sg_admins')
            .authWithPassword(email, password)

          set({
            user:    authData.record,
            token:   authData.token,
            isAdmin: true,
            loading: false,
          })
          return { success: true }
        } catch (err) {
          const msg = err?.response?.message || 'Invalid email or password'
          set({ loading: false, error: msg })
          return { success: false, error: msg }
        }
      },

      // ── Register (customer) ──────────────────────────────────────
      register: async ({ name, email, password, phone, referredById }) => {
        set({ loading: true, error: null })
        try {
          const referralCode = generateReferralCode()

          const record = await pb.collection('sg_users').create({
            name,
            email,
            password,
            passwordConfirm: password,
            phone:           phone || '',
            referral_code:   referralCode,
            referred_by:     referredById || undefined,
            language:        'en',
            currency:        'KES',
            is_diaspora:     false,
            loyalty_points:  0,
            whatsapp_opt_in: false,
            email_opt_in:    true,
            is_active:       true,
          })

          // Auto-login after registration
          const authData = await pb
            .collection('sg_users')
            .authWithPassword(email, password)

          trackEvent('register', record.id)

          set({
            user:    authData.record,
            token:   authData.token,
            isAdmin: false,
            loading: false,
          })
          return { success: true, record }
        } catch (err) {
          const data = err?.response?.data || {}
          let msg = 'Registration failed. Please try again.'
          if (data.email?.code === 'validation_not_unique') {
            msg = 'An account with this email already exists'
          }
          set({ loading: false, error: msg })
          return { success: false, error: msg }
        }
      },

      // ── Logout ───────────────────────────────────────────────────
      logout: () => {
        pb.authStore.clear()
        set({ user: null, token: '', isAdmin: false, error: null })
      },

      // ── Update profile ───────────────────────────────────────────
      updateProfile: async (data) => {
        const { user } = get()
        if (!user) return { success: false, error: 'Not logged in' }

        set({ loading: true, error: null })
        try {
          const updated = await pb.collection('sg_users').update(user.id, data)
          set({ user: updated, loading: false })
          return { success: true }
        } catch (err) {
          const msg = err?.response?.message || 'Update failed'
          set({ loading: false, error: msg })
          return { success: false, error: msg }
        }
      },

      // ── Refresh auth model from PocketBase ───────────────────────
      refreshUser: async () => {
        const { user, isAdmin } = get()
        if (!user) return
        try {
          const collection = isAdmin ? 'sg_admins' : 'sg_users'
          const fresh = await pb.collection(collection).getOne(user.id)
          set({ user: fresh })
        } catch {
          // If fetch fails, keep existing user
        }
      },

      // ── Sync PocketBase authStore → Zustand on external changes ──
      syncFromPb: () => {
        const model = pb.authStore.model
        const token = pb.authStore.token
        if (!model) {
          set({ user: null, token: '', isAdmin: false })
        } else {
          set({
            user:    model,
            token,
            isAdmin: model.collectionName === 'sg_admins',
          })
        }
      },
    }),
    {
      name: 'sg_auth',
      // Only persist non-sensitive state; PocketBase manages the token cookie
      partialize: (state) => ({
        user:    state.user,
        token:   state.token,
        isAdmin: state.isAdmin,
      }),
    }
  )
)

// Keep Zustand in sync when PocketBase token changes (e.g. auto-refresh)
pb.authStore.onChange(() => {
  useAuthStore.getState().syncFromPb()
})

export default useAuthStore