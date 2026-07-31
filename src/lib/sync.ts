import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AisleId,
  Category,
  Challenge,
  Note,
  PantryItem,
  Pot,
  PotEntry,
  Person,
  RecurringTx,
  Settings,
  ShopItem,
  ShopTemplate,
  State,
  Tx,
} from './types'

/**
 * Abgleich mit dem Server.
 *
 * Die App ist lokal führend: Jede Änderung liegt sofort im Browser, der
 * Abgleich läuft danach. Fällt das Netz aus, merkt man davon nichts – im
 * Supermarkt zwischen den Regalen ist das eher die Regel als die Ausnahme.
 *
 * Zusammengeführt wird je Datensatz nach `updated_at`: der jüngere Stand
 * gewinnt. Für Einkaufszettel und Vorratslisten ist das die richtige Wahl.
 * Die Einträge sind klein und voneinander unabhängig; der praktisch häufige
 * Fall – zwei Menschen haken verschiedene Dinge ab – geht dabei nie verloren.
 */

/* --- Übersetzung zwischen Datenbank und App ------------------------------- */

// Die Datenbank schreibt mit Unterstrich, die App in Binnenmajuskel. Die
// Übersetzung steht an genau einer Stelle, damit ein umbenanntes Feld nicht
// still zu `undefined` wird.

type Row = Record<string, unknown>

const asText = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const asNum = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}
const asBool = (v: unknown): boolean => v === true
const asNullNum = (v: unknown): number | null => (v === null || v === undefined ? null : asNum(v))
const asNullText = (v: unknown): string | null => (typeof v === 'string' ? v : null)

function shopFromRow(row: Row): ShopItem {
  return {
    id: asText(row.id),
    name: asText(row.name),
    qty: asText(row.qty),
    aisle: asText(row.aisle, 'sonstiges') as AisleId,
    done: asBool(row.done),
    addedBy: asText(row.added_by),
    pantryId: asNullText(row.pantry_id),
    note: asText(row.note),
    priceCents: asNullNum(row.price_cents),
    updatedAt: asNum(row.updated_at),
    deletedAt: asNullNum(row.deleted_at),
  }
}

function shopToRow(item: ShopItem): Row {
  return {
    id: item.id,
    name: item.name,
    qty: item.qty,
    aisle: item.aisle,
    done: item.done,
    added_by: item.addedBy,
    pantry_id: item.pantryId,
    note: item.note,
    price_cents: item.priceCents,
    updated_at: item.updatedAt,
    deleted_at: item.deletedAt,
  }
}

function pantryFromRow(row: Row): PantryItem {
  return {
    id: asText(row.id),
    name: asText(row.name),
    aisle: asText(row.aisle, 'sonstiges') as AisleId,
    qty: asNum(row.qty),
    unit: asText(row.unit, 'Stück'),
    minQty: asNum(row.min_qty),
    bestBefore: asNullText(row.best_before),
    note: asText(row.note),
    updatedAt: asNum(row.updated_at),
    deletedAt: asNullNum(row.deleted_at),
  }
}

function pantryToRow(item: PantryItem): Row {
  return {
    id: item.id,
    name: item.name,
    aisle: item.aisle,
    qty: item.qty,
    unit: item.unit,
    min_qty: item.minQty,
    best_before: item.bestBefore,
    note: item.note,
    updated_at: item.updatedAt,
    deleted_at: item.deletedAt,
  }
}

/* --- Notizen, Vorlagen, wiederkehrende Buchungen -------------------------- */

function noteFromRow(row: Row): Note {
  return {
    id: asText(row.id),
    title: asText(row.title),
    body: asText(row.body),
    pinned: asBool(row.pinned),
    updatedAt: asNum(row.updated_at),
    deletedAt: asNullNum(row.deleted_at),
  }
}

function noteToRow(note: Note): Row {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    pinned: note.pinned,
    updated_at: note.updatedAt,
    deleted_at: note.deletedAt,
  }
}

function templateFromRow(row: Row): ShopTemplate {
  const raw = Array.isArray(row.items) ? (row.items as unknown[]) : []
  return {
    id: asText(row.id),
    name: asText(row.name),
    emoji: asText(row.emoji, '🛒'),
    // Die Einträge liegen als JSON in einer Spalte. Was dort nicht passt,
    // fliegt raus – eine kaputte Vorlage darf nicht den ganzen Abgleich kippen.
    items: raw
      .filter((entry): entry is Row => !!entry && typeof entry === 'object')
      .map((entry) => ({
        name: asText(entry.name),
        qty: asText(entry.qty),
        aisle: asText(entry.aisle, 'sonstiges') as AisleId,
        note: asText(entry.note),
      }))
      .filter((entry) => entry.name !== ''),
    updatedAt: asNum(row.updated_at),
    deletedAt: asNullNum(row.deleted_at),
  }
}

function templateToRow(template: ShopTemplate): Row {
  return {
    id: template.id,
    name: template.name,
    emoji: template.emoji,
    items: template.items,
    updated_at: template.updatedAt,
    deleted_at: template.deletedAt,
  }
}

/* --- Kategorien und Einstellungen ----------------------------------------- */

/**
 * Kategorien und Einstellungen liegen zusammen in einer Zeile je Person.
 *
 * Nicht aus Bequemlichkeit: Eine Kategorie hat keinen eigenen Zeitstempel und
 * keinen Grabstein, sie ist Teil einer Sammlung, die man als Ganzes ändert.
 * Ohne diesen Abgleich stünde nach der Anmeldung auf einem zweiten Gerät bei
 * jeder Buchung „Ohne Kategorie“ – die Buchungen kämen an, die Kategorien, auf
 * die sie zeigen, nicht.
 *
 * Vom Erscheinungsbild wandert bewusst nichts mit: Ob dunkel oder hell, ob das
 * Gerät rüttelt, hängt am Gerät und nicht an der Person.
 */
interface PrefsRow {
  categories: Category[]
  settings: Partial<Settings>
  prefsUpdatedAt: number
}

function prefsFromRow(row: Row): PrefsRow {
  const rohe = Array.isArray(row.categories) ? (row.categories as unknown[]) : []
  const categories = rohe
    .filter((entry): entry is Row => !!entry && typeof entry === 'object')
    .filter((entry) => typeof entry.id === 'string' && typeof entry.name === 'string')
    .map((entry) => ({
      id: asText(entry.id),
      name: asText(entry.name),
      emoji: asText(entry.emoji, '•'),
      kind: entry.kind === 'einnahme' ? ('einnahme' as const) : ('ausgabe' as const),
      budgetCents: asNullNum(entry.budget_cents ?? entry.budgetCents),
    }))

  const roheEinstellungen = row.settings && typeof row.settings === 'object' ? (row.settings as Row) : {}
  const settings: Partial<Settings> = {}
  if (typeof roheEinstellungen.display_name === 'string') settings.displayName = roheEinstellungen.display_name
  const startTab = roheEinstellungen.start_tab
  if (
    startTab === 'start' ||
    startTab === 'geld' ||
    startTab === 'sparen' ||
    startTab === 'einkauf' ||
    startTab === 'vorrat'
  ) {
    settings.startTab = startTab
  }

  return { categories, settings, prefsUpdatedAt: asNum(row.updated_at) }
}

function prefsToRow(state: State, userId: string): Row {
  return {
    user_id: userId,
    categories: state.categories.map((category) => ({
      id: category.id,
      name: category.name,
      emoji: category.emoji,
      kind: category.kind,
      budget_cents: category.budgetCents,
    })),
    settings: {
      display_name: state.settings.displayName,
      start_tab: state.settings.startTab,
    },
    updated_at: state.prefsUpdatedAt,
  }
}

function recurringFromRow(row: Row): RecurringTx {
  const unit = row.unit
  return {
    id: asText(row.id),
    kind: row.kind === 'einnahme' ? 'einnahme' : 'ausgabe',
    cents: asNum(row.cents),
    categoryId: asText(row.category_id),
    note: asText(row.note),
    unit: unit === 'woche' || unit === 'jahr' ? unit : 'monat',
    anchorDay: asNum(row.anchor_day, 1),
    anchorMonth: asNullNum(row.anchor_month),
    startDate: asText(row.start_date),
    lastRun: asNullText(row.last_run),
    active: row.active !== false,
    updatedAt: asNum(row.updated_at),
    deletedAt: asNullNum(row.deleted_at),
  }
}

function recurringToRow(rule: RecurringTx, userId: string): Row {
  return {
    id: rule.id,
    user_id: userId,
    kind: rule.kind,
    cents: rule.cents,
    category_id: rule.categoryId,
    note: rule.note,
    unit: rule.unit,
    anchor_day: rule.anchorDay,
    anchor_month: rule.anchorMonth,
    start_date: rule.startDate,
    last_run: rule.lastRun,
    active: rule.active,
    updated_at: rule.updatedAt,
    deleted_at: rule.deletedAt,
  }
}

function txFromRow(row: Row): Tx {
  return {
    id: asText(row.id),
    kind: row.kind === 'einnahme' ? 'einnahme' : 'ausgabe',
    cents: asNum(row.cents),
    categoryId: asText(row.category_id),
    note: asText(row.note),
    date: asText(row.date),
    recurring: asBool(row.recurring),
    updatedAt: asNum(row.updated_at),
    deletedAt: asNullNum(row.deleted_at),
  }
}

function txToRow(tx: Tx, userId: string): Row {
  return {
    id: tx.id,
    user_id: userId,
    kind: tx.kind,
    cents: tx.cents,
    category_id: tx.categoryId,
    note: tx.note,
    date: tx.date,
    recurring: tx.recurring,
    updated_at: tx.updatedAt,
    deleted_at: tx.deletedAt,
  }
}

function potFromRow(row: Row): Pot {
  return {
    id: asText(row.id),
    name: asText(row.name),
    emoji: asText(row.emoji, '🎯'),
    targetCents: asNullNum(row.target_cents),
    targetDate: asNullText(row.target_date),
    updatedAt: asNum(row.updated_at),
    deletedAt: asNullNum(row.deleted_at),
  }
}

function potToRow(pot: Pot, userId: string): Row {
  return {
    id: pot.id,
    user_id: userId,
    name: pot.name,
    emoji: pot.emoji,
    target_cents: pot.targetCents,
    target_date: pot.targetDate,
    updated_at: pot.updatedAt,
    deleted_at: pot.deletedAt,
  }
}

function potEntryFromRow(row: Row): PotEntry {
  return {
    id: asText(row.id),
    potId: asText(row.pot_id),
    cents: asNum(row.cents),
    date: asText(row.date),
    note: asText(row.note),
    challengeId: asNullText(row.challenge_id),
    slot: asNullNum(row.slot),
    updatedAt: asNum(row.updated_at),
    deletedAt: asNullNum(row.deleted_at),
  }
}

function potEntryToRow(entry: PotEntry, userId: string): Row {
  return {
    id: entry.id,
    user_id: userId,
    pot_id: entry.potId,
    cents: entry.cents,
    date: entry.date,
    note: entry.note,
    challenge_id: entry.challengeId,
    slot: entry.slot,
    updated_at: entry.updatedAt,
    deleted_at: entry.deletedAt,
  }
}

function challengeFromRow(row: Row): Challenge {
  const kind = row.kind
  return {
    id: asText(row.id),
    name: asText(row.name),
    kind: kind === 'gleich' || kind === 'frei' ? kind : 'steigend',
    stepCents: asNum(row.step_cents, 100),
    slots: asNum(row.slots, 52),
    unit: row.unit === 'tag' || row.unit === 'monat' ? row.unit : 'woche',
    startDate: asText(row.start_date),
    potId: asNullText(row.pot_id),
    filled: Array.isArray(row.filled) ? (row.filled as unknown[]).filter((n): n is number => Number.isInteger(n)) : [],
    archived: asBool(row.archived),
    updatedAt: asNum(row.updated_at),
    deletedAt: asNullNum(row.deleted_at),
  }
}

function challengeToRow(challenge: Challenge, userId: string): Row {
  return {
    id: challenge.id,
    user_id: userId,
    name: challenge.name,
    kind: challenge.kind,
    step_cents: challenge.stepCents,
    slots: challenge.slots,
    unit: challenge.unit,
    start_date: challenge.startDate,
    pot_id: challenge.potId,
    filled: challenge.filled,
    archived: challenge.archived,
    updated_at: challenge.updatedAt,
    deleted_at: challenge.deletedAt,
  }
}

export const rowCodecs = {
  shopFromRow,
  shopToRow,
  pantryFromRow,
  pantryToRow,
  txFromRow,
  txToRow,
  potFromRow,
  potToRow,
  potEntryFromRow,
  potEntryToRow,
  challengeFromRow,
  challengeToRow,
  noteFromRow,
  noteToRow,
  templateFromRow,
  templateToRow,
  recurringFromRow,
  recurringToRow,
  prefsFromRow,
  prefsToRow,
}

/* --- Wer mitliest ---------------------------------------------------------- */

/**
 * Die Zugangsliste.
 *
 * Sie ersetzt Haushalt, Einladungscode und Beitreten – drei Schritte, an denen
 * man scheitern konnte, für eine Frage, die zu zweit ohnehin nur einmal
 * beantwortet wird. Wer draufsteht, sieht dieselbe Einkaufsliste; sonst
 * niemand. Nötig ist die Liste, weil der Schlüssel der App öffentlich ist:
 * Ohne sie käme jeder hinein, der die Adresse kennt.
 */

export async function ladeErlaubte(client: SupabaseClient): Promise<Person[]> {
  const { data, error } = await client.from('erlaubte_personen').select('email, name').order('email')
  if (error) throw new Error(uebersetzeFehler(error.message))
  return ((data ?? []) as Row[]).map((row) => ({
    email: asText(row.email),
    name: asText(row.name),
  }))
}

export async function erlaubePerson(client: SupabaseClient, email: string, name: string): Promise<void> {
  // Kleingeschrieben abgelegt, damit „Anna@…“ und „anna@…“ dieselbe Person
  // sind. Die Prüfung in der Datenbank vergleicht ebenfalls kleingeschrieben.
  const { error } = await client
    .from('erlaubte_personen')
    .upsert({ email: email.trim().toLowerCase(), name: name.trim() }, { onConflict: 'email' })
  if (error) throw new Error(uebersetzeFehler(error.message))
}

export async function entfernePerson(client: SupabaseClient, email: string): Promise<void> {
  const { error } = await client.from('erlaubte_personen').delete().eq('email', email.trim().toLowerCase())
  if (error) throw new Error(uebersetzeFehler(error.message))
}

/**
 * Bin ich freigeschaltet?
 *
 * Diese Frage muss ausdrücklich gestellt werden. Die Zugriffsregeln liefern
 * einer nicht freigeschalteten Person keine Fehlermeldung, sondern schlicht
 * eine **leere Liste** – und eine leere Einkaufsliste sieht aus wie eine
 * leere Einkaufsliste, nicht wie eine Sperre. Ohne diese Prüfung wäre der
 * häufigste Fehlerfall der einzige, den man nicht bemerkt.
 */
export async function pruefeZugang(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc('ist_erlaubt')
  if (error) throw new Error(uebersetzeFehler(error.message))
  return data === true
}

/** Meldungen der Datenbank in etwas übersetzen, das man lesen möchte. */
function uebersetzeFehler(message: string): string {
  const text = message.toLowerCase()
  if (text.includes('duplicate key')) return 'Diese Adresse steht schon auf der Liste.'
  if (text.includes('row-level security') || text.includes('permission denied')) {
    return 'Dafür fehlt dir die Berechtigung. Nur wer selbst freigeschaltet ist, darf die Liste ändern.'
  }
  if (text.includes('could not find') || text.includes('does not exist')) {
    return 'Die Tabellen fehlen. Spiel supabase/schema.sql im SQL-Editor deines Projekts ein.'
  }
  return 'Das hat nicht geklappt. Bitte später noch einmal versuchen.'
}

/* --- Herunterladen --------------------------------------------------------- */

/**
 * Alles holen, was zu diesem Konto und Haushalt gehört.
 *
 * Fehlgeschlagene Teilabfragen liefern eine leere Liste, statt den ganzen
 * Abgleich abzubrechen. Wenn der Vorrat nicht lädt, soll die Einkaufsliste
 * trotzdem ankommen.
 */
export interface PullResult {
  incoming: Partial<State>
  /**
   * Was schiefging, je Tabelle. Leer heißt: alles gelesen.
   *
   * Diese Liste ist der Grund, warum `pullAll` nicht einfach Daten
   * zurückgibt: Eine fehlende Tabelle liefert `data: null` samt Fehler
   * daneben. Wer nur `data ?? []` nimmt, bekommt eine leere Liste und hält
   * den Abgleich für geglückt – die App meldet dann „verbunden“, obwohl
   * nichts ankommt. Genau so verhält sie sich, wenn das Schema noch nicht
   * eingespielt ist, und das ist der häufigste Fall überhaupt.
   */
  errors: { table: string; error: { code?: string; message?: string } }[]
}

export async function pullAll(
  client: SupabaseClient,
  args: { userId: string },
): Promise<PullResult> {
  const errors: PullResult['errors'] = []

  /** Ergebnis auswerten und einen etwaigen Fehler vermerken. */
  const rows = (table: string, result: { data: unknown; error: unknown }): Row[] => {
    if (result.error) {
      errors.push({ table, error: result.error as { code?: string; message?: string } })
      return []
    }
    return (result.data ?? []) as Row[]
  }

  const privat = Promise.all([
    client.from('txs').select('*').eq('user_id', args.userId),
    client.from('pots').select('*').eq('user_id', args.userId),
    client.from('pot_entries').select('*').eq('user_id', args.userId),
    client.from('challenges').select('*').eq('user_id', args.userId),
    client.from('recurring_txs').select('*').eq('user_id', args.userId),
    client.from('user_prefs').select('*').eq('user_id', args.userId).limit(1),
  ])

  // Ohne Bedingung: Wer die Zeilen sehen darf, entscheiden die Zugriffsregeln
  // in der Datenbank. Eine Einschränkung hier wäre Zierde – umgehen ließe sie
  // sich, und wer nicht freigeschaltet ist, bekommt ohnehin nichts.
  const geteilt = Promise.all([
    client.from('shop_items').select('*'),
    client.from('pantry_items').select('*'),
    client.from('aisle_order').select('*'),
    client.from('notes').select('*'),
    client.from('shop_templates').select('*'),
  ])

  const [[txs, pots, potEntries, challenges, recurring, prefs], shared] = await Promise.all([privat, geteilt])

  const incoming: Partial<State> = {
    txs: rows('txs', txs).map(txFromRow),
    pots: rows('pots', pots).map(potFromRow),
    potEntries: rows('pot_entries', potEntries).map(potEntryFromRow),
    challenges: rows('challenges', challenges).map(challengeFromRow),
    recurringTxs: rows('recurring_txs', recurring).map(recurringFromRow),
  }

  const prefsZeile = rows('user_prefs', prefs)[0]
  if (prefsZeile) {
    const { categories, settings, prefsUpdatedAt } = prefsFromRow(prefsZeile)
    // Nur mitgeben, was auch da ist: Eine leere Kategorienliste vom Server
    // dürfte die vorhandene nie ersetzen – dann ließe sich nichts mehr
    // erfassen. `mergeState` entscheidet danach über den Zeitstempel.
    if (categories.length > 0) incoming.categories = categories
    incoming.settings = settings as State['settings']
    incoming.prefsUpdatedAt = prefsUpdatedAt
  }

  {
    // Eigener Block, damit die fünf Namen nicht in den äußeren Bereich
    // durchsickern – sie werden nur hier gebraucht.
    const [shopItems, pantryItems, aisleOrder, notes, templates] = shared
    incoming.shopItems = rows('shop_items', shopItems).map(shopFromRow)
    incoming.pantryItems = rows('pantry_items', pantryItems).map(pantryFromRow)
    incoming.notes = rows('notes', notes).map(noteFromRow)
    incoming.shopTemplates = rows('shop_templates', templates).map(templateFromRow)

    const order: Partial<Record<AisleId, number>> = {}
    for (const row of rows('aisle_order', aisleOrder)) {
      order[asText(row.aisle) as AisleId] = asNum(row.rank)
    }
    incoming.aisleOrder = order
  }

  return { incoming, errors }
}

/* --- Hochladen ------------------------------------------------------------- */

/**
 * Was sich seit `since` geändert hat, zum Server schieben.
 *
 * Nur die geänderten Datensätze – bei jedem Tastendruck den gesamten Bestand
 * hochzuladen, würde auf einem Mobilfunkvertrag auffallen.
 */
export async function pushChanges(
  client: SupabaseClient,
  state: State,
  args: { userId: string; since: number },
): Promise<void> {
  const { userId, since } = args
  const neuer = <T extends { updatedAt: number }>(list: readonly T[]) => list.filter((item) => item.updatedAt > since)

  const jobs: PromiseLike<unknown>[] = []
  const push = (table: string, rows: Row[]) => {
    if (rows.length > 0) jobs.push(client.from(table).upsert(rows, { onConflict: 'id' }))
  }

  push('txs', neuer(state.txs).map((tx) => txToRow(tx, userId)))
  push('pots', neuer(state.pots).map((pot) => potToRow(pot, userId)))
  push('pot_entries', neuer(state.potEntries).map((entry) => potEntryToRow(entry, userId)))
  push('challenges', neuer(state.challenges).map((c) => challengeToRow(c, userId)))
  push('recurring_txs', neuer(state.recurringTxs).map((r) => recurringToRow(r, userId)))

  if (state.prefsUpdatedAt > since) {
    jobs.push(client.from('user_prefs').upsert(prefsToRow(state, userId), { onConflict: 'user_id' }))
  }

  push('shop_items', neuer(state.shopItems).map(shopToRow))
  push('pantry_items', neuer(state.pantryItems).map(pantryToRow))
  push('notes', neuer(state.notes).map(noteToRow))
  push('shop_templates', neuer(state.shopTemplates).map(templateToRow))

  const order = Object.entries(state.aisleOrder)
    .filter(([, rank]) => typeof rank === 'number')
    .map(([aisle, rank]) => ({ aisle, rank, updated_at: Date.now() }))
  if (order.length > 0) {
    jobs.push(client.from('aisle_order').upsert(order, { onConflict: 'aisle' }))
  }

  await Promise.all(jobs)
}

/* --- Live zuhören ---------------------------------------------------------- */

/**
 * Auf Änderungen der geteilten Tabellen horchen.
 *
 * Damit erscheint das Häkchen der einen Person binnen Sekunden beim anderen.
 * Gibt eine Funktion zum Abmelden zurück – ohne die bliebe bei jeder An- und
 * Abmeldung ein Kanal offen.
 *
 * Ohne Filter: Es gibt nur einen geteilten Bestand. Wer davon etwas zu sehen
 * bekommt, entscheiden die Zugriffsregeln – Realtime hält sich daran.
 */
export function subscribeShared(
  client: SupabaseClient,
  onChange: (incoming: Partial<State>) => void,
): () => void {
  // Alle vier geteilten Tabellen, nicht nur die beiden auffälligsten: Eine
  // Notiz der anderen Person soll ebenso sofort erscheinen wie ein Häkchen.
  // Sonst sähe man sie erst nach einem Neuladen – und niemand lädt neu, um
  // nachzusehen, ob jemand etwas geschrieben hat.
  const tabellen = [
    { table: 'shop_items', map: (row: Row): Partial<State> => ({ shopItems: [shopFromRow(row)] }) },
    { table: 'pantry_items', map: (row: Row): Partial<State> => ({ pantryItems: [pantryFromRow(row)] }) },
    { table: 'notes', map: (row: Row): Partial<State> => ({ notes: [noteFromRow(row)] }) },
    { table: 'shop_templates', map: (row: Row): Partial<State> => ({ shopTemplates: [templateFromRow(row)] }) },
  ]

  let channel = client.channel('geteilt')
  for (const { table, map } of tabellen) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        const row = payload.new as Row | null
        if (row && row.id) onChange(map(row))
      },
    )
  }
  channel.subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}
