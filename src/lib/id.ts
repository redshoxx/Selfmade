/**
 * Kennungen.
 *
 * Sie werden auf dem Gerät vergeben, nicht vom Server: Ein Eintrag muss auch
 * ohne Netz sofort eine endgültige Kennung haben, sonst kann der Abgleich ihn
 * später nicht wiedererkennen und legt ihn ein zweites Mal an.
 */

export function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16))
    // Auf die Fassung 4 und die Variante RFC 4122 setzen.
    bytes[6] = (bytes[6]! & 0x0f) | 0x40
    bytes[8] = (bytes[8]! & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  // Letzte Rückfallebene für sehr alte Browser ohne Web Crypto.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
