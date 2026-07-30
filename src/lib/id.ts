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

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // ohne I, O, 0, 1

/**
 * Einladungscode zum Vorlesen, in der Form „K7M-2QD“.
 *
 * Verwechselbare Zeichen fehlen im Alphabet: Wer den Code am Telefon durchgibt,
 * soll nicht an der Frage scheitern, ob das eine Null oder ein O war.
 */
export function newInviteCode(): string {
  const pick = (n: number) => {
    const c = globalThis.crypto
    const bytes =
      c && typeof c.getRandomValues === 'function'
        ? c.getRandomValues(new Uint8Array(n))
        : Array.from({ length: n }, () => Math.floor(Math.random() * 256))
    return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
  }
  return `${pick(3)}-${pick(3)}`
}

/**
 * Eingetippten Code vereinheitlichen, damit „k7m 2qd“ ebenso passt wie
 * „K7M-2QD“.
 *
 * Zeichen außerhalb des Alphabets fallen weg. Das trifft auch I, O, 0 und 1:
 * Sie kommen in keinem Code vor, wer sie tippt, hat sich verlesen – und weil
 * gerade deshalb beide Kandidaten einer Verwechslung fehlen, lässt sich nicht
 * erraten, was gemeint war. Der Code stimmt dann eben nicht.
 */
export function normalizeInviteCode(input: string): string {
  let clean = ''
  for (const char of input.toUpperCase()) {
    if (CODE_ALPHABET.includes(char)) clean += char
  }
  if (clean.length !== 6) return clean
  return `${clean.slice(0, 3)}-${clean.slice(3)}`
}
