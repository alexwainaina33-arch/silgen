const CACHE_KEY = 'sg_fx_rates'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour in ms
const BASE      = 'KES'

// Fallback rates (used if API is unavailable)
const FALLBACK_RATES = {
  KES: 1,
  USD: 0.0077,
  GBP: 0.0061,
  EUR: 0.0071,
  CAD: 0.0105,
  AUD: 0.0119,
}

const CURRENCY_SYMBOLS = {
  KES: 'KSh',
  USD: '$',
  GBP: '£',
  EUR: '€',
  CAD: 'CA$',
  AUD: 'A$',
}

const CURRENCY_NAMES = {
  KES: 'Kenyan Shilling',
  USD: 'US Dollar',
  GBP: 'British Pound',
  EUR: 'Euro',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
}

/**
 * Fetch live exchange rates (KES base).
 * Uses free exchangerate-api with localStorage cache (1hr TTL).
 * Falls back to hardcoded rates if unavailable.
 */
export async function fetchRates() {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { rates, ts } = JSON.parse(cached)
      if (Date.now() - ts < CACHE_TTL) return rates
    }

    const res = await fetch(
      'https://open.er-api.com/v6/latest/KES'
    )
    if (!res.ok) throw new Error('Rate fetch failed')

    const data = await res.json()
    const rates = {
      KES: 1,
      USD: data.rates.USD,
      GBP: data.rates.GBP,
      EUR: data.rates.EUR,
      CAD: data.rates.CAD,
      AUD: data.rates.AUD,
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, ts: Date.now() }))
    return rates
  } catch {
    return FALLBACK_RATES
  }
}

/**
 * Convert a KES amount to the target currency.
 * @param {number} amountKes
 * @param {string} toCurrency - 'USD' | 'GBP' | 'EUR' | 'CAD' | 'AUD' | 'KES'
 * @param {Object} rates - from fetchRates()
 */
export function convertFromKes(amountKes, toCurrency, rates) {
  const rate = rates?.[toCurrency] ?? FALLBACK_RATES[toCurrency] ?? 1
  return amountKes * rate
}

/**
 * Format a KES amount into the display currency.
 * @param {number} amountKes
 * @param {string} currency
 * @param {Object} rates
 */
export function formatPrice(amountKes, currency = 'KES', rates = FALLBACK_RATES) {
  const converted = convertFromKes(amountKes, currency, rates)
  const symbol    = CURRENCY_SYMBOLS[currency] || currency
  const decimals  = currency === 'KES' ? 0 : 2

  return `${symbol}${converted.toLocaleString('en-KE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/**
 * Format just a number without symbol (for inputs, etc.)
 */
export function formatAmount(amountKes, currency = 'KES', rates = FALLBACK_RATES) {
  const converted = convertFromKes(amountKes, currency, rates)
  const decimals  = currency === 'KES' ? 0 : 2
  return converted.toLocaleString('en-KE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_SYMBOLS)
export { CURRENCY_SYMBOLS, CURRENCY_NAMES, FALLBACK_RATES }