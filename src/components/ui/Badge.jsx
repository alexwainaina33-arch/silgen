/**
 * Badge — status pill, label, counter
 *
 * Props:
 *   variant   'success'|'warning'|'danger'|'info'|'neutral'|'loyalty'|'primary'|'dark'
 *   size      'xs' | 'sm' | 'md'
 *   dot       bool — shows a colored dot before the label
 *   icon      ReactNode
 *   pill      bool — fully rounded (default true)
 *   className string
 */
export default function Badge({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  icon = null,
  pill = true,
  className = '',
}) {
  const base = 'inline-flex items-center gap-1 font-semibold leading-none'

  const variants = {
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100  text-amber-700',
    danger:  'bg-red-100    text-red-600',
    info:    'bg-blue-100   text-blue-700',
    neutral: 'bg-gray-100   text-gray-600',
    loyalty: 'bg-amber-500  text-white',
    primary: 'bg-emerald-600 text-white',
    dark:    'bg-slate-800  text-white',
  }

  const dotColors = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger:  'bg-red-500',
    info:    'bg-blue-500',
    neutral: 'bg-gray-400',
    loyalty: 'bg-white',
    primary: 'bg-white',
    dark:    'bg-white',
  }

  const sizes = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2   py-0.5 text-xs',
    md: 'px-2.5 py-1   text-sm',
  }

  return (
    <span
      className={[
        base,
        variants[variant] || variants.neutral,
        sizes[size] || sizes.sm,
        pill ? 'rounded-full' : 'rounded',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {dot && (
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
            dotColors[variant] || 'bg-gray-400'
          }`}
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  )
}

/**
 * StatusBadge — maps sg_orders.status / sg_payments.status to Badge
 */
export function StatusBadge({ status, type = 'order' }) {
  const orderMap = {
    pending:          { variant: 'warning', label: 'Pending' },
    confirmed:        { variant: 'info',    label: 'Confirmed' },
    processing:       { variant: 'info',    label: 'Processing' },
    shipped:          { variant: 'primary', label: 'Shipped' },
    out_for_delivery: { variant: 'primary', label: 'Out for Delivery' },
    delivered:        { variant: 'success', label: 'Delivered' },
    cancelled:        { variant: 'danger',  label: 'Cancelled' },
    returned:         { variant: 'neutral', label: 'Returned' },
  }

  const paymentMap = {
    pending:  { variant: 'warning', label: 'Pending' },
    paid:     { variant: 'success', label: 'Paid' },
    failed:   { variant: 'danger',  label: 'Failed' },
    refunded: { variant: 'neutral', label: 'Refunded' },
  }

  const subMap = {
    trial:     { variant: 'info',    label: 'Trial' },
    active:    { variant: 'success', label: 'Active' },
    paused:    { variant: 'warning', label: 'Paused' },
    cancelled: { variant: 'danger',  label: 'Cancelled' },
    expired:   { variant: 'neutral', label: 'Expired' },
    past_due:  { variant: 'danger',  label: 'Past Due' },
  }

  const bookingMap = {
    pending:     { variant: 'warning', label: 'Pending' },
    confirmed:   { variant: 'info',    label: 'Confirmed' },
    in_progress: { variant: 'primary', label: 'In Progress' },
    completed:   { variant: 'success', label: 'Completed' },
    cancelled:   { variant: 'danger',  label: 'Cancelled' },
    no_show:     { variant: 'neutral', label: 'No Show' },
  }

  const map =
    type === 'payment'      ? paymentMap :
    type === 'subscription' ? subMap :
    type === 'booking'      ? bookingMap :
    orderMap

  const config = map[status] || { variant: 'neutral', label: status || '—' }

  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  )
}

/**
 * CountBadge — red notification counter (e.g. cart count, unread)
 */
export function CountBadge({ count = 0, max = 99 }) {
  if (!count) return null
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-bold rounded-full leading-none">
      {count > max ? `${max}+` : count}
    </span>
  )
}

/**
 * DiscountBadge — "20% OFF" overlay badge for ProductCard
 */
export function DiscountBadge({ pct, className = '' }) {
  if (!pct || pct <= 0) return null
  return (
    <span
      className={`inline-flex items-center bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded ${className}`}
    >
      -{Math.round(pct)}%
    </span>
  )
}