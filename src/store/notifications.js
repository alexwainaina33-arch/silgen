import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import pb from '../lib/pb.js'

const useNotificationStore = create(
  persist(
    (set, get) => ({
      // ── State ─────────────────────────────────────────────────
      notifications: [],    // sg_notifications records
      unreadCount:   0,
      loading:       false,
      realtimeSub:   null,  // PocketBase realtime unsubscribe fn

      // ── Load notifications from PocketBase ────────────────────
      load: async () => {
        if (!pb.authStore.isValid) return
        const userId = pb.authStore.model?.id
        if (!userId) return

        set({ loading: true })
        try {
          const records = await pb.collection('sg_notifications').getList(1, 50, {
            filter: `user_id = "${userId}"`,
          })

          const unread = records.items.filter((n) => !n.is_read).length

          set({
            notifications: records.items,
            unreadCount:   unread,
            loading:       false,
          })
        } catch (err) {
          console.warn('[Notifications] load failed:', err)
          set({ loading: false })
        }
      },

      // ── Mark single notification as read ─────────────────────
      markRead: async (notificationId) => {
        const userId = pb.authStore.model?.id
        if (!userId) return

        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }))

        try {
          await pb.collection('sg_notifications').update(notificationId, {
            is_read: true,
          })
        } catch (err) {
          console.warn('[Notifications] markRead failed:', err)
        }
      },

      // ── Mark all notifications as read ────────────────────────
      markAllRead: async () => {
        const userId = pb.authStore.model?.id
        if (!userId) return

        const { notifications } = get()
        const unread = notifications.filter((n) => !n.is_read)

        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
          unreadCount: 0,
        }))

        try {
          await Promise.all(
            unread.map((n) =>
              pb.collection('sg_notifications').update(n.id, { is_read: true })
            )
          )
        } catch (err) {
          console.warn('[Notifications] markAllRead failed:', err)
        }
      },

      // ── Delete notification ───────────────────────────────────
      deleteNotification: async (notificationId) => {
        const userId = pb.authStore.model?.id
        if (!userId) return

        set((state) => {
          const removed = state.notifications.find((n) => n.id === notificationId)
          return {
            notifications: state.notifications.filter((n) => n.id !== notificationId),
            unreadCount: removed && !removed.is_read
              ? Math.max(0, state.unreadCount - 1)
              : state.unreadCount,
          }
        })

        try {
          await pb.collection('sg_notifications').delete(notificationId)
        } catch (err) {
          console.warn('[Notifications] delete failed:', err)
        }
      },

      // ── Add local toast notification (transient, not in DB) ───
      // Used for cart feedback, copy confirmations, etc.
      toasts: [],

      addToast: (message, type = 'success', duration = 3500) => {
        const id = Date.now() + Math.random()
        set((state) => ({
          toasts: [...state.toasts, { id, message, type, duration }],
        }))
        setTimeout(() => {
          set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
          }))
        }, duration)
      },

      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      },

      // ── Subscribe to realtime notifications via PocketBase ────
      subscribeRealtime: async () => {
        const userId = pb.authStore.model?.id
        if (!userId) return

        // Unsubscribe from any previous subscription
        const { realtimeSub } = get()
        if (realtimeSub) {
          try { realtimeSub() } catch {}
        }

        try {
          const unsub = await pb
            .collection('sg_notifications')
            .subscribe('*', (e) => {
              const recordUserId = e.record.user || e.record.user_id
              if (recordUserId !== userId) return

              if (e.action === 'create') {
                set((state) => ({
                  notifications: [e.record, ...state.notifications].slice(0, 50),
                  unreadCount: state.unreadCount + 1,
                }))

                // Also show as toast for high-priority types
                const priority = ['order', 'payment', 'delivery']
                if (priority.includes(e.record.type)) {
                  get().addToast(
                    e.record.title || 'New notification',
                    'info',
                    5000
                  )
                }
              }

              if (e.action === 'update') {
                set((state) => ({
                  notifications: state.notifications.map((n) =>
                    n.id === e.record.id ? e.record : n
                  ),
                }))
              }

              if (e.action === 'delete') {
                set((state) => ({
                  notifications: state.notifications.filter(
                    (n) => n.id !== e.record.id
                  ),
                }))
              }
            })

          set({ realtimeSub: unsub })
        } catch (err) {
          console.warn('[Notifications] realtime subscribe failed:', err)
        }
      },

      // ── Unsubscribe from realtime ─────────────────────────────
      unsubscribeRealtime: () => {
        const { realtimeSub } = get()
        if (realtimeSub) {
          try { realtimeSub() } catch {}
          set({ realtimeSub: null })
        }
      },

      // ── Clear all (on logout) ─────────────────────────────────
      clear: () => {
        const { realtimeSub } = get()
        if (realtimeSub) {
          try { realtimeSub() } catch {}
        }
        set({
          notifications: [],
          unreadCount:   0,
          loading:       false,
          realtimeSub:   null,
          toasts:        [],
        })
      },
    }),
    {
      name: 'sg_notifications',
      // Only persist the notification list and unread count
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount:   state.unreadCount,
      }),
    }
  )
)

export default useNotificationStore