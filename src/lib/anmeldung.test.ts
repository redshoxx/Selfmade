import { describe, expect, it } from 'vitest'
import { anmeldeFehlerAusAdresse } from './supabase'

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
    // Der nächste Schritt gehört dazu, sonst weiß niemand, wie es weitergeht.
    expect(meldung).toContain('neuen')
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
