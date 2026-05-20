import pb from './pb.js'

/**
 * Generate a unique referral code: SG + 6 alphanumeric chars
 * Matches what gets saved to sg_users.referral_code
 */
export function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'SG'
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Build the full referral URL for sharing.
 * @param {string} code - sg_users.referral_code
 */
export function buildReferralUrl(code) {
  const base = import.meta.env.VITE_APP_URL || window.location.origin
  return `${base}/ref/${code}`
}

/**
 * Read referral code from URL and store in sessionStorage.
 * Call this on app load / RegisterPage mount.
 */
export function captureReferralFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const codeFromQuery = params.get('ref')

  // Also handle /ref/:code route — caller passes code directly
  if (codeFromQuery) {
    sessionStorage.setItem('sg_referral_code', codeFromQuery)
  }
}

/**
 * Store a referral code captured from /ref/:code route param.
 * @param {string} code
 */
export function storeReferralCode(code) {
  if (code) sessionStorage.setItem('sg_referral_code', code)
}

/**
 * Get the currently stored referral code (if any).
 */
export function getStoredReferralCode() {
  return sessionStorage.getItem('sg_referral_code') || ''
}

/**
 * Clear referral code after successful registration attribution.
 */
export function clearStoredReferralCode() {
  sessionStorage.removeItem('sg_referral_code')
}

/**
 * Look up a user by their referral code.
 * Returns the user record or null.
 * @param {string} code
 */
export async function findUserByReferralCode(code) {
  if (!code) return null
  try {
    const result = await pb.collection('sg_users').getFirstListItem(
      `referral_code = "${code}"`
    )
    return result
  } catch {
    return null
  }
}

/**
 * After a new user registers with a referral code,
 * create the sg_referrals record.
 * @param {string} referrerId - sg_users.id of the referrer
 * @param {string} referredId - sg_users.id of the new user
 */
export async function createReferralRecord(referrerId, referredId) {
  if (!referrerId || !referredId) return
  try {
    await pb.collection('sg_referrals').create({
      referrer_id:  referrerId,
      referred_id:  referredId,
      status:       'pending',
      reward_points: 500,
    })
  } catch (err) {
    console.warn('[Referral] createReferralRecord failed:', err)
  }
}

/**
 * WhatsApp share text for referral link.
 * @param {string} url
 * @param {string} lang - 'en' | 'sw'
 */
export function buildWhatsAppShareText(url, lang = 'en') {
  if (lang === 'sw') {
    return `Jiunge na SILGEN na upate pointi 200 kwenye agizo lako la kwanza! 🛒🇰🇪\n${url}`
  }
  return `Join SILGEN and get 200 loyalty points on your first order! 🛒🇰🇪\n${url}`
}