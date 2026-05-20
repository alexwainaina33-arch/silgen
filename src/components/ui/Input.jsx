/**
 * Input — reusable form field component
 *
 * Props:
 *   label       string
 *   error       string — shows below field in red
 *   hint        string — shows below field in gray
 *   icon        ReactNode — left icon inside input
 *   iconRight   ReactNode — right icon inside input
 *   onIconRightClick fn — makes right icon a button
 *   fullWidth   bool (default true)
 *   textarea    bool — renders <textarea> instead of <input>
 *   rows        number — textarea rows (default 3)
 *   className   string
 *   ...rest     passed to <input> / <textarea>
 */
export default function Input({
  label = '',
  error = '',
  hint = '',
  icon = null,
  iconRight = null,
  onIconRightClick = null,
  fullWidth = true,
  textarea = false,
  rows = 3,
  className = '',
  id,
  ...rest
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '_') : undefined)

  const baseField =
    'block rounded-lg border bg-white text-gray-900 text-sm transition-colors duration-150 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed'

  const borderClass = error
    ? 'border-red-400 focus:ring-red-400'
    : 'border-gray-300'

  const paddingLeft  = icon ? 'pl-10' : 'pl-3'
  const paddingRight = iconRight ? 'pr-10' : 'pr-3'
  const paddingY     = textarea ? 'py-2.5' : 'py-2.5'

  const fieldClass = [
    baseField,
    borderClass,
    paddingLeft,
    paddingRight,
    paddingY,
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {rest.required && (
            <span className="text-red-500 ml-0.5">*</span>
          )}
        </label>
      )}

      <div className="relative">
        {/* Left icon */}
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            {icon}
          </span>
        )}

        {/* Field */}
        {textarea ? (
          <textarea
            id={inputId}
            rows={rows}
            className={fieldClass}
            {...rest}
          />
        ) : (
          <input
            id={inputId}
            className={fieldClass}
            {...rest}
          />
        )}

        {/* Right icon / button */}
        {iconRight && (
          onIconRightClick ? (
            <button
              type="button"
              onClick={onIconRightClick}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            >
              {iconRight}
            </button>
          ) : (
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
              {iconRight}
            </span>
          )
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}

      {/* Hint */}
      {!error && hint && (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  )
}

/**
 * Select — styled <select> matching Input design
 */
export function Select({
  label = '',
  error = '',
  hint = '',
  icon = null,
  fullWidth = true,
  options = [],   // [{ value, label }] or ['value']
  placeholder = 'Select...',
  className = '',
  id,
  ...rest
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '_') : undefined)

  const baseField =
    'block rounded-lg border bg-white text-gray-900 text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed appearance-none'

  const borderClass = error ? 'border-red-400' : 'border-gray-300'
  const paddingLeft = icon ? 'pl-10' : 'pl-3'

  const fieldClass = [
    baseField,
    borderClass,
    paddingLeft,
    'pr-8 py-2.5',
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {rest.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            {icon}
          </span>
        )}

        <select id={inputId} className={fieldClass} {...rest}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => {
            const val   = typeof opt === 'string' ? opt : opt.value
            const label = typeof opt === 'string' ? opt : opt.label
            return (
              <option key={val} value={val}>
                {label}
              </option>
            )
          })}
        </select>

        {/* Chevron */}
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}