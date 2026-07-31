import { describe, expect, it } from 'vitest'
import { anmeldeFehlerAusAdresse, anmeldeFehlerText } from './supabase'

/**
 * Ein abgewiesener Anmeldelink kommt als Anhang an der Adresse zurück. Ohne
 * diese Auswertung öffnet sich die App und tut so, als sei nichts gewesen –
 * man ist nicht angemeldet und erfährt nicht, warum.
 */
describe('anmeldeFehlerAusAdresse', () => {
  it('erkennt einen abgelaufenen Link', () => {
    const meldung = anmeldeFehlerAusAdresse(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    )
    expect(meldung).toContain('abgelaufen')
    // Der nächste Schritt gehört dazu, sonst weiß niemand, wie es weitergeht –
    // und zwar der, den es heute noch gibt: anmelden mit Passwort. Einen neuen
    // Link anzufordern ginge nicht mehr.
    expect(meldung).toContain('Passwort')
  })

  it('gibt eine unbekannte Begründung lesbar weiter', () => {
    const meldung = anmeldeFehlerAusAdresse('#error=server_error&error_description=Etwas+ging+schief')
    expect(meldung).toBe('Etwas ging schief')
  })

  it('meldet nichts bei einer gewöhnlichen Adresse', () => {
    expect(anmeldeFehlerAusAdresse('')).toBeNull()
    expect(anmeldeFehlerAusAdresse('#')).toBeNull()
    // Der erfolgreiche Fall bringt die Sitzung im selben Anhang mit; die darf
    // hier auf keinen Fall als Fehler durchgehen.
    expect(anmeldeFehlerAusAdresse('#access_token=abc&refresh_token=def&type=magiclink')).toBeNull()
  })
})

/**
 * Beim Anmelden entscheidet die Meldung darüber, ob jemand weiterkommt oder an
 * der falschen Stelle sucht. Supabase antwortet englisch und technisch.
 */
describe('anmeldeFehlerText', () => {
  it('nennt falsches Passwort beim Namen', () => {
    expect(anmeldeFehlerText({ code: 'invalid_credentials' })).toBe('E-Mail oder Passwort stimmt nicht.')
    expect(anmeldeFehlerText({ message: 'Invalid login credentials' })).toBe(
      'E-Mail oder Passwort stimmt nicht.',
    )
  })

  it('unterscheidet ein unbestätigtes Konto vom falschen Passwort', () => {
    // Der einzige Fall, in dem Adresse und Passwort stimmen und trotzdem
    // nichts geht. Ohne eigenen Satz tippt man das Passwort immer wieder neu.
    const text = anmeldeFehlerText({ code: 'email_not_confirmed', message: 'Email not confirmed' })
    expect(text).toContain('nicht bestätigt')
    expect(text).toContain('Users')
    expect(text).not.toContain('Passwort stimmt nicht')
  })

  it('erklärt die Ratenbegrenzung mit dem nächsten Schritt', () => {
    const text = anmeldeFehlerText({ message: 'Request rate limit reached' })
    expect(text).toContain('Warte')
  })

  it('schickt bei einem Netzfehler nicht in die falsche Richtung', () => {
    // „E-Mail oder Passwort stimmt nicht“ wäre hier grob irreführend.
    const text = anmeldeFehlerText({ message: 'Failed to fetch' })
    expect(text).toContain('Keine Verbindung')
  })

  it('reicht Unbekanntes durch, statt es zu verschlucken', () => {
    expect(anmeldeFehlerText({ message: 'Signups not allowed for this instance' })).toBe(
      'Signups not allowed for this instance',
    )
    expect(anmeldeFehlerText(null)).toBe('Die Anmeldung hat nicht geklappt.')
  })
})
