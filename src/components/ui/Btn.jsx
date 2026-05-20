/**
 * Btn — reusable button component
 *
 * Props:
 *   variant   'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'loyalty' | 'whatsapp'
 *   size      'xs' | 'sm' | 'md' | 'lg'
 *   loading   bool — shows spinner, disables button
 *   fullWidth bool
 *   icon      ReactNode — shown left of label
 *   iconRight ReactNode — shown right of label
 *   disabled  bool
 *   className string — extra Tailwind classes
 *   ...rest   passed to <button>
 */
export default function Btn({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon = null,
  iconRight = null,
  disabled = false,
  className = '',
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 select-none'

  const variants = {
    primary:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 focus:ring-emerald-500 disabled:bg-emerald-300',
    secondary:
      'bg-slate-800 text-white hover:bg-slate-700 active:bg-slate-900 focus:ring-slate-500 disabled:bg-slate-400',
    outline:
      'border-2 border-emerald-600 text-emerald-600 bg-transparent hover:bg-emerald-50 active:bg-emerald-100 focus:ring-emerald-500 disabled:border-emerald-200 disabled:text-emerald-200',
    ghost:
      'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-400 disabled:text-gray-300',
    danger:
      'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 focus:ring-red-400 disabled:bg-red-200',
    loyalty:
      'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 focus:ring-amber-400 disabled:bg-amber-200',
    whatsapp:
      'bg-[#25D366] text-white hover:bg-[#1ebe57] active:bg-[#17a84c] focus:ring-green-400',
  }

  const sizes = {
    xs: 'px-2.5 py-1.5 text-xs',
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      className={[
        base,
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        fullWidth ? 'w-full' : '',
        isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading ? (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}

      {children && <span>{children}</span>}

      {!loading && iconRight && (
        <span className="shrink-0">{iconRight}</span>
      )}
    </button>
  )
}