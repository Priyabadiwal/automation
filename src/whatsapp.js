import { WHATSAPP_PITCH } from './config'

// Builds a click-to-chat wa.me link with the message pre-filled.
// Free, official, no API/account needed — one click to open WhatsApp & send.
export function buildWhatsAppLink(rawNumber, message = WHATSAPP_PITCH) {
  const digits = String(rawNumber).replace(/[^\d]/g, '')
  if (!digits) return null
  // Assume Indian numbers without country code need +91 prefixed
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`
}
