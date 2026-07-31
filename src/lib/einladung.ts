import { normalizeInviteCode } from './id'

/**
 * Einladen per Link.
 *
 * Vorher ging das Teilen nur über einen abgetippten Code: vorlesen, richtig
 * hören, richtig tippen, und `K7M-2QD` sieht auf einem Sperrbildschirm auch
 * nicht einladend aus. Ein Link nimmt alle drei Schritte weg – antippen
 * genügt, den Rest erledigt die App.
 *
 * Der Weg hat eine Besonderheit, die diese Datei überhaupt nötig macht: Der
 * Link führt in die App, dort meldet man sich an, und die Anmeldung schickt
 * einen über den Server *zurück* – ohne die ursprüngliche Adresse. Der Code
 * muss diesen Umweg überleben, also wird er beim ersten Öffnen weggelegt und
 * erst nach dem Beitritt weggeräumt.
 */

const SPEICHER = 'selfmade.einladung'

/** Name des Parameters im Link. Deutsch, weil der Link vorgezeigt wird. */
export const PARAMETER = 'beitreten'

/** Den Einladungslink zu einem Code bauen. */
export function einladungsLink(code: string, origin: string, pfad = '/'): string {
  const basis = `${origin.replace(/\/+$/, '')}${pfad}`
  return `${basis}?${PARAMETER}=${encodeURIComponent(code)}`
}

/**
 * Einen Code aus der Adresse lesen.
 *
 * Gibt `null` zurück, wenn keiner drinsteht oder was drinsteht kein
 * vollständiger Code ist – ein halber Code soll nicht als Einladung gelten
 * und später mit „gibt es nicht“ abgewiesen werden.
 */
export function codeAusAdresse(search: string): string | null {
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search)
  } catch {
    return null
  }
  const roh = params.get(PARAMETER)
  if (!roh) return null
  const code = normalizeInviteCode(roh)
  return code.length === 7 ? code : null
}

/* --- Über die Anmeldung hinweg merken -------------------------------------- */

export function merkeEinladung(code: string): void {
  try {
    window.localStorage.setItem(SPEICHER, code)
  } catch {
    // Privater Modus in Safari verweigert den Zugriff. Dann klappt der
    // Beitritt eben nur ohne Umweg über die Anmeldung.
  }
}

export function gemerkteEinladung(): string | null {
  try {
    const code = window.localStorage.getItem(SPEICHER)
    if (!code) return null
    return normalizeInviteCode(code).length === 7 ? normalizeInviteCode(code) : null
  } catch {
    return null
  }
}

export function vergissEinladung(): void {
  try {
    window.localStorage.removeItem(SPEICHER)
  } catch {
    // s. o.
  }
}

/**
 * Beim Start nachsehen, ob eine Einladung anliegt.
 *
 * Erst die Adresse, dann der Speicher. Wird mehrfach aufgerufen (React baut
 * im Entwicklungsmodus alles doppelt auf) und muss deshalb dasselbe Ergebnis
 * liefern, ohne etwas kaputtzumachen – tut es, weil nur derselbe Wert erneut
 * geschrieben wird.
 */
export function offeneEinladung(search: string = window.location.search): string | null {
  const ausAdresse = codeAusAdresse(search)
  if (ausAdresse) {
    merkeEinladung(ausAdresse)
    return ausAdresse
  }
  return gemerkteEinladung()
}

/* --- Weitergeben ----------------------------------------------------------- */

export type TeilenErgebnis = 'geteilt' | 'kopiert' | 'abgebrochen' | 'fehler'

/**
 * Den Link weitergeben – über das Teilen-Blatt des Systems, sonst Zwischenablage.
 *
 * Das System-Blatt ist der kurze Weg: WhatsApp, Nachrichten, Mail stehen dort
 * schon, ohne dass die App irgendetwas davon kennen müsste. Wo es das nicht
 * gibt (Desktop-Browser), landet der Link in der Zwischenablage, und die
 * Oberfläche sagt das.
 */
export async function teileEinladung(link: string, haushalt: string): Promise<TeilenErgebnis> {
  const text = `Ich teile mit dir die Einkaufsliste und den Vorrat von „${haushalt}“. Tipp auf den Link, dann siehst du beides.`

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Selfmade', text, url: link })
      return 'geteilt'
    } catch (fehler) {
      // Wer das Blatt wieder zumacht, hat nichts falsch gemacht – das darf
      // nicht wie ein Fehler aussehen.
      if (fehler instanceof Error && fehler.name === 'AbortError') return 'abgebrochen'
      // Sonst weiter zur Zwischenablage: Manche Browser melden hier, dass
      // Teilen nur aus einer echten Geste heraus erlaubt ist.
    }
  }

  try {
    await navigator.clipboard.writeText(link)
    return 'kopiert'
  } catch {
    return 'fehler'
  }
}
