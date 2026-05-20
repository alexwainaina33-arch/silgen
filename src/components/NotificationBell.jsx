import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import useNotificationStore from '../store/notifications.js'
import useAuthStore from '../store/auth.js'
import { CountBadge } from './ui/Badge.jsx'
import useTranslation from '../hooks/useTranslation.js'

const TYPE_ICON = {
  order:        '📦',
  payment:      '💳',
  delivery:     '🚚',
  promo:        '🎁',
  loyalty:      '⭐',
  subscription: '🔄',
  system:       '🔔',
}

export default function NotificationBell() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { notifications, unreadCount, load, markRead, markAllRead, subscribeRealtime, unsubscribeRealtime } = useNotificationStore()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  // Load + subscribe on mount when logged in
  useEffect(() => {
    if (user) {
      load()
      subscribeRealtime()
    }
    return () => { if (user) unsubscribeRealtime() }
  }, [user?.id])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user) return null

  const handleClick = (notif) => {
    if (!notif.is_read) markRead(notif.id)
    if (notif.link) navigate(notif.link)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5">
            <CountBadge count={unreadCount} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">{t('notif_title')}</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                {t('notif_mark_read')}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm">{t('notif_empty')}</p>
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                    !n.is_read ? 'bg-emerald-50/60' : ''
                  }`}
                >
                  <span className="text-xl shrink-0 mt-0.5">{TYPE_ICON[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {n.title}
                    </p>
                    {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(n.created), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-2" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => { navigate('/notifications'); setOpen(false) }}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium w-full text-center"
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}