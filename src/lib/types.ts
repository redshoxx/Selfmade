import type { IsoDate } from './date'

/**
 * Datenmodell.
 *
 * Zwei Klassen von Daten, und die Trennung ist Absicht:
 *
 *  - **Privat** – Buchungen, Spartöpfe, Challenges. Gehören einer Person und
 *    verlassen ihr Konto nicht.
 *  - **Geteilt** – Einkaufsliste und Vorrat. Gehören dem Haushalt und sind für
 *    alle sichtbar, die dazugehören.
 *
 * Wer zusammen einkauft, muss dafür nicht sein Gehalt offenlegen.
 */

export type Tab = 'start' | 'geld' | 'sparen' | 'einkauf' | 'vorrat'

/** Alles, was gespeichert und abgeglichen wird, trägt diese Felder. */
export interface Entity {
  id: string
  /** Millisekunden. Beim Abgleich gewinnt der jüngere Stand. */
  updatedAt: number
  /**
   * Grabstein statt hartem Löschen. Ohne ihn taucht ein auf dem Handy
   * gelöschter Eintrag beim nächsten Abgleich vom Tablet wieder auf.
   */
  deletedAt: number | null
}

/* --- Geld ---------------------------------------------------------------- */

export type TxKind = 'einnahme' | 'ausgabe'

export interface Tx extends Entity {
  kind: TxKind
  /** Immer positiv – die Richtung steckt in `kind`, nicht im Vorzeichen. */
  cents: number
  categoryId: string
  note: string
  date: IsoDate
  /** Wiederkehrend, z. B. Miete oder Gehalt. Nur zur Kennzeichnung. */
  recurring: boolean
}

export interface Category {
  id: string
  name: string
  emoji: string
  kind: TxKind
  /** Monatsbudget in Cent; `null` heißt „kein Limit gesetzt“. */
  budgetCents: number | null
}

/* --- Sparen -------------------------------------------------------------- */

export interface Pot extends Entity {
  name: string
  emoji: string
  /** Zielbetrag; `null` heißt „sammeln ohne festes Ziel“. */
  targetCents: number | null
  targetDate: IsoDate | null
}

export interface PotEntry extends Entity {
  potId: string
  /** Positiv = eingezahlt, negativ = entnommen. */
  cents: number
  date: IsoDate
  note: string
  /** Gesetzt, wenn die Einzahlung aus einer Challenge stammt. */
  challengeId: string | null
  /** Feldnummer innerhalb der Challenge, für den Weg zurück. */
  slot: number | null
}

/* --- Spar-Challenges ----------------------------------------------------- */

/**
 * `steigend` – Feld n kostet n × Schrittweite. Die klassische 52-Wochen-
 *              Challenge: 1 €, 2 €, 3 € … 52 €.
 * `gleich`   – jedes Feld kostet dasselbe. „Jede Woche 5 € weg.“
 * `frei`     – alle Felder liegen offen, abgehakt wird in beliebiger
 *              Reihenfolge. Für Wochen, in denen mal wenig übrig ist.
 */
export type ChallengeKind = 'steigend' | 'gleich' | 'frei'
export type ChallengeUnit = 'tag' | 'woche' | 'monat'

export interface Challenge extends Entity {
  name: string
  kind: ChallengeKind
  /** Schrittweite in Cent: 100 für die 1-€-, 200 für die 2-€-Challenge. */
  stepCents: number
  /** Anzahl der Felder, z. B. 52 Wochen. */
  slots: number
  unit: ChallengeUnit
  startDate: IsoDate
  /** Spartopf, in den die Einzahlungen laufen; `null` = ohne Topf. */
  potId: string | null
  /** Erledigte Felder, 0-basiert. Sortiert, ohne Dubletten. */
  filled: number[]
  archived: boolean
}

/* --- Einkauf & Vorrat (geteilt) ------------------------------------------ */

export type AisleId =
  | 'obst'
  | 'backwaren'
  | 'kuehl'
  | 'fleisch'
  | 'tiefkuehl'
  | 'trocken'
  | 'konserven'
  | 'suesses'
  | 'getraenke'
  | 'haushalt'
  | 'drogerie'
  | 'sonstiges'

export interface ShopItem extends Entity {
  name: string
  /** Freitext: „2“, „500 g“, „1 Packung“. Menschen zählen nicht in Gramm. */
  qty: string
  aisle: AisleId
  done: boolean
  /** Anzeigename dessen, der es aufgeschrieben hat – beim Teilen zu zweit. */
  addedBy: string
  /** Gesetzt, wenn der Eintrag aus einem Nachkaufen-Vorschlag stammt. */
  pantryId: string | null
}

export interface PantryItem extends Entity {
  name: string
  aisle: AisleId
  /** Bestand in `unit`. */
  qty: number
  unit: string
  /** Ab hier schlägt die App Nachkaufen vor; 0 schaltet das ab. */
  minQty: number
  /** Mindesthaltbarkeitsdatum des ältesten Vorrats. */
  bestBefore: IsoDate | null
}

/* --- Haushalt ------------------------------------------------------------ */

export interface Member {
  userId: string
  name: string
}

export interface Household {
  id: string
  name: string
  /** Kurzer Code zum Weitergeben, z. B. „K7M-2QD“. */
  inviteCode: string
  members: Member[]
}

/* --- Gesamtzustand ------------------------------------------------------- */

export interface Settings {
  /** Anzeigename in der geteilten Liste. */
  displayName: string
  theme: 'system' | 'hell' | 'dunkel'
  /** Startseite nach dem Öffnen. */
  startTab: Tab
  /** Beim Abhaken kurz vibrieren, wo das Gerät es kann. */
  haptics: boolean
}

export interface State {
  /* privat */
  txs: Tx[]
  categories: Category[]
  pots: Pot[]
  potEntries: PotEntry[]
  challenges: Challenge[]
  /* geteilt */
  shopItems: ShopItem[]
  pantryItems: PantryItem[]
  /**
   * Gelernte Reihenfolge der Abteilungen: kleinerer Wert heißt „kommt im Laden
   * früher“. Wächst aus dem Abhaken beim Einkauf.
   */
  aisleOrder: Partial<Record<AisleId, number>>
  /* Rahmen */
  settings: Settings
  household: Household | null
}
