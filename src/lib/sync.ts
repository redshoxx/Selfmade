import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AisleId,
  Challenge,
  Household,
  PantryItem,
  Pot,
  PotEntry,
  ShopItem,
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
    updatedAt: asNum(row.updated_at),
    deletedAt: asNullNum(row.deleted_at),
  }
}

function shopToRow(item: ShopItem, householdId: string): Row {
  return {
    id: item.id,
    household_id: householdId,
    name: item.name,
    qty: item.qty,
    aisle: item.aisle,
    done: item.done,
    added_by: item.addedBy,
    pantry_id: item.pantryId,
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
    updatedAt: asNum(row.updated_at),
    deletedAt: asNullNum(row.deleted_at),
  }
}

function pantryToRow(item: PantryItem, householdId: string): Row {
  return {
    id: item.id,
    household_id: householdId,
    name: item.name,
    aisle: item.aisle,
    qty: item.qty,
    unit: item.unit,
    min_qty: item.minQty,
    best_before: item.bestBefore,
    updated_at: item.updatedAt,
    deleted_at: item.deletedAt,
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
}

/* --- Haushalt -------------------------------------------------------------- */

export async function loadHousehold(client: SupabaseClient, userId: string): Promise<Household | null> {
  const { data: membership, error } = await client
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !membership) return null

  const householdId = (membership as Row).household_id as string
  const [{ data: household }, { data: members }] = await Promise.all([
    client.from('households').select('id, name, invite_code').eq('id', householdId).maybeSingle(),
    client.from('household_members').select('user_id, name').eq('household_id', householdId),
  ])
  if (!household) return null

  const row = household as Row
  return {
    id: asText(row.id),
    name: asText(row.name, 'Haushalt'),
    inviteCode: asText(row.invite_code),
    members: ((members ?? []) as Row[]).map((m) => ({ userId: asText(m.user_id), name: asText(m.name, 'Ich') })),
  }
}

export async function createHousehold(
  client: SupabaseClient,
  args: { name: string; memberName: string; code: string },
): Promise<Household> {
  const { data, error } = await client.rpc('create_household', {
    household_name: args.name,
    member_name: args.memberName,
    code: args.code,
  })
  if (error) throw new Error(uebersetzeFehler(error.message))
  const row = (Array.isArray(data) ? data[0] : data) as Row
  return {
    id: asText(row.id),
    name: asText(row.name, 'Haushalt'),
    inviteCode: asText(row.invite_code),
    members: [{ userId: '', name: args.memberName }],
  }
}

export async function joinHousehold(
  client: SupabaseClient,
  args: { code: string; memberName: string },
): Promise<Household> {
  const { data, error } = await client.rpc('join_household', {
    code: args.code,
    member_name: args.memberName,
  })
  if (error) throw new Error(uebersetzeFehler(error.message))
  const row = (Array.isArray(data) ? data[0] : data) as Row
  return {
    id: asText(row.id),
    name: asText(row.name, 'Haushalt'),
    inviteCode: asText(row.invite_code),
    members: [],
  }
}

export async function leaveHousehold(client: SupabaseClient, householdId: string, userId: string): Promise<void> {
  await client.from('household_members').delete().eq('household_id', householdId).eq('user_id', userId)
}

/** Meldungen der Datenbank in etwas übersetzen, das man lesen möchte. */
function uebersetzeFehler(message: string): string {
  if (message.includes('Einladungscode nicht gefunden')) return 'Diesen Einladungscode gibt es nicht.'
  if (message.includes('duplicate key') && message.includes('invite_code')) {
    return 'Dieser Code ist schon vergeben. Bitte noch einmal versuchen.'
  }
  if (message.includes('nicht angemeldet')) return 'Bitte zuerst anmelden.'
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
export async function pullAll(
  client: SupabaseClient,
  args: { userId: string; householdId: string | null },
): Promise<Partial<State>> {
  const privat = Promise.all([
    client.from('txs').select('*').eq('user_id', args.userId),
    client.from('pots').select('*').eq('user_id', args.userId),
    client.from('pot_entries').select('*').eq('user_id', args.userId),
    client.from('challenges').select('*').eq('user_id', args.userId),
  ])

  const geteilt = args.householdId
    ? Promise.all([
        client.from('shop_items').select('*').eq('household_id', args.householdId),
        client.from('pantry_items').select('*').eq('household_id', args.householdId),
        client.from('aisle_order').select('*').eq('household_id', args.householdId),
      ])
    : Promise.resolve(null)

  const [[txs, pots, potEntries, challenges], shared] = await Promise.all([privat, geteilt])

  const incoming: Partial<State> = {
    txs: ((txs.data ?? []) as Row[]).map(txFromRow),
    pots: ((pots.data ?? []) as Row[]).map(potFromRow),
    potEntries: ((potEntries.data ?? []) as Row[]).map(potEntryFromRow),
    challenges: ((challenges.data ?? []) as Row[]).map(challengeFromRow),
  }

  if (shared) {
    const [shopItems, pantryItems, aisleOrder] = shared
    incoming.shopItems = ((shopItems.data ?? []) as Row[]).map(shopFromRow)
    incoming.pantryItems = ((pantryItems.data ?? []) as Row[]).map(pantryFromRow)

    const order: Partial<Record<AisleId, number>> = {}
    for (const row of (aisleOrder.data ?? []) as Row[]) {
      order[asText(row.aisle) as AisleId] = asNum(row.rank)
    }
    incoming.aisleOrder = order
  }

  return incoming
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
  args: { userId: string; householdId: string | null; since: number },
): Promise<void> {
  const { userId, householdId, since } = args
  const neuer = <T extends { updatedAt: number }>(list: readonly T[]) => list.filter((item) => item.updatedAt > since)

  const jobs: PromiseLike<unknown>[] = []
  const push = (table: string, rows: Row[]) => {
    if (rows.length > 0) jobs.push(client.from(table).upsert(rows, { onConflict: 'id' }))
  }

  push('txs', neuer(state.txs).map((tx) => txToRow(tx, userId)))
  push('pots', neuer(state.pots).map((pot) => potToRow(pot, userId)))
  push('pot_entries', neuer(state.potEntries).map((entry) => potEntryToRow(entry, userId)))
  push('challenges', neuer(state.challenges).map((c) => challengeToRow(c, userId)))

  if (householdId) {
    push('shop_items', neuer(state.shopItems).map((item) => shopToRow(item, householdId)))
    push('pantry_items', neuer(state.pantryItems).map((item) => pantryToRow(item, householdId)))

    const order = Object.entries(state.aisleOrder)
      .filter(([, rank]) => typeof rank === 'number')
      .map(([aisle, rank]) => ({ household_id: householdId, aisle, rank, updated_at: Date.now() }))
    if (order.length > 0) {
      jobs.push(client.from('aisle_order').upsert(order, { onConflict: 'household_id,aisle' }))
    }
  }

  await Promise.all(jobs)
}

/* --- Live zuhören ---------------------------------------------------------- */

/**
 * Auf Änderungen der geteilten Tabellen horchen.
 *
 * Damit erscheint das Häkchen der einen Person binnen Sekunden beim anderen.
 * Gibt eine Funktion zum Abmelden zurück – ohne die bleibt bei jedem Wechsel
 * des Haushalts ein Kanal offen.
 */
export function subscribeShared(
  client: SupabaseClient,
  householdId: string,
  onChange: (incoming: Partial<State>) => void,
): () => void {
  const channel = client
    .channel(`haushalt:${householdId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shop_items', filter: `household_id=eq.${householdId}` },
      (payload) => {
        const row = payload.new as Row | null
        if (row && row.id) onChange({ shopItems: [shopFromRow(row)] })
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pantry_items', filter: `household_id=eq.${householdId}` },
      (payload) => {
        const row = payload.new as Row | null
        if (row && row.id) onChange({ pantryItems: [pantryFromRow(row)] })
      },
    )
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}
