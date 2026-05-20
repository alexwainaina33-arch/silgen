import { useEffect, useCallback } from 'react'

/**
 * Modal — accessible overlay dialog
 *
 * Props:
 *   isOpen      bool
 *   onClose     fn
 *   title       string
 *   size        'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
 *   closable    bool — show X button and allow backdrop click (default true)
 *   footer      ReactNode — custom footer content
 *   className   string — extra classes on the panel
 */
export default function Modal({
  isOpen = false,
  onClose,
  title = '',
  size = 'md',
  closable = true,
  children,
  footer = null,
  className = '',
}) {
  // Close on Escape key
  const handleKey = useCallback(
    (e) => {
      if (e.key === 'Escape' && closable && onClose) onClose()
    },
    [closable, onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKey])

  if (!isOpen) return null

  const sizes = {
    xs:   'max-w-xs',
    sm:   'max-w-sm',
    md:   'max-w-md',
    lg:   'max-w-lg',
    xl:   'max-w-xl',
    '2xl':'max-w-2xl',
    full: 'max-w-full mx-4',
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closable ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={[
          'relative z-10 w-full bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh]',
          sizes[size] || sizes.md,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Header */}
        {(title || closable) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            {title && (
              <h2
                id="modal-title"
                className="text-base font-semibold text-gray-900 leading-tight"
              >
                {title}
              </h2>
            )}
            {closable && (
              <button
                onClick={onClose}
                className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * ConfirmModal — simple yes/no confirmation dialog
 *
 * Props:
 *   isOpen      bool
 *   onClose     fn
 *   onConfirm   fn
 *   title       string
 *   message     string | ReactNode
 *   confirmText string (default 'Confirm')
 *   cancelText  string (default 'Cancel')
 *   danger      bool — confirm button is red
 *   loading     bool — confirm button shows spinner
 */
export function ConfirmModal({
  isOpen = false,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  loading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      {message && (
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
      )}

      <div className="flex gap-3 mt-5 justify-end">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {cancelText}
        </button>

        <button
          onClick={onConfirm}
          disabled={loading}
          className={[
            'px-4 py-2 text-sm font-semibold text-white rounded-lg inline-flex items-center gap-2 transition-colors disabled:opacity-60',
            danger
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-emerald-600 hover:bg-emerald-700',
          ].join(' ')}
        >
          {loading && (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}

/**
 * DrawerModal — slides in from the right (for cart, filters, etc.)
 *
 * Props: same as Modal plus:
 *   side  'right' | 'left' (default 'right')
 */
export function DrawerModal({
  isOpen = false,
  onClose,
  title = '',
  side = 'right',
  closable = true,
  children,
  footer = null,
  className = '',
}) {
  const handleKey = useCallback(
    (e) => {
      if (e.key === 'Escape' && closable && onClose) onClose()
    },
    [closable, onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKey])

  if (!isOpen) return null

  const slideFrom = side === 'left' ? 'left-0' : 'right-0'

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closable ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={[
          'absolute top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl flex flex-col',
          slideFrom,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
          {title && (
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          )}
          {closable && (
            <button
              onClick={onClose}
              className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 py-4 border-t border-gray-100 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}