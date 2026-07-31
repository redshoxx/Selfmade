import { today } from './date'
import { newId } from './id'
import { isValidCents } from './money'
import type {
  AisleId,
  Category,
  Challenge,
  Entity,
  Note,
  PantryItem,
  Pot,
  PotEntry,
  RecurringTx,
  Settings,
  ShopItem,
  ShopTemplate,
  State,
  Tx,
} from './types'

/**
 * Zustand, Änderungen und Speicherung.
 *
 * Die App arbeitet zuerst lokal: Jede Änderung landet sofort im Zustand und im
 * Speicher des Browsers, der Abgleich mit dem Server läuft danach im
 * Hintergrund. Im Laden, wo das Netz zwischen den Regalen wegbricht, ist das
 * der Unterschied zwischen einer Liste, die funktioniert, und einem Ladekreis.
 */

const STORAGE_KEY = 'selfmade.state.v1'

/* --- Startkategorien ------------------------------------------------------ */

export const DEFAULT_CATEGORIES: readonly Category[] = [
  { id: 'cat-lohn', name: 'Gehalt', emoji: '💼', kind: 'einnahme', budgetCents: null },
  { id: 'cat-nebenjob', name: 'Nebenjob', emoji: '🧰', kind: 'einnahme', budgetCents: null },
  { id: 'cat-geschenk', name: 'Geschenk', emoji: '🎁', kind: 'einnahme', budgetCents: null },
  { id: 'cat-sonstiges-ein', name: 'Sonstiges', emoji: '➕', kind: 'einnahme', budgetCents: null },

  { id: 'cat-lebensmittel', name: 'Lebensmittel', emoji: '🛒', kind: 'ausgabe', budgetCents: null },
  { id: 'cat-wohnen', name: 'Wohnen', emoji: '🏠', kind: 'ausgabe', budgetCents: null },
  { id: 'cat-mobilitaet', name: 'Mobilität', emoji: '🚌', kind: 'ausgabe', budgetCents: null },
  { id: 'cat-freizeit', name: 'Freizeit', emoji: '🎬', kind: 'ausgabe', budgetCents: null },
  { id: 'cat-gesundheit', name: 'Gesundheit', emoji: '💊', kind: 'ausgabe', budgetCents: null },
  { id: 'cat-abos', name: 'Abos', emoji: '🔁', kind: 'ausgabe', budgetCents: null },
  { id: 'cat-kleidung', name: 'Kleidung', emoji: '👕', kind: 'ausgabe', budgetCents: null },
  { id: 'cat-sonstiges-aus', name: 'Sonstiges', emoji: '➖', kind: 'ausgabe', budgetCents: null },
]

export const DEFAULT_SETTINGS: Settings = {
  displayName: 'Ich',
  theme: 'system',
  startTab: 'start',
  haptics: true,
}

export function initialState(): State {
  return {
    txs: [],
    categories: [...DEFAULT_CATEGORIES],
    pots: [],
    potEntries: [],
    challenges: [],
    recurringTxs: [],
    shopItems: [],
    pantryItems: [],
    notes: [],
    shopTemplates: [],
    aisleOrder: {},
    settings: { ...DEFAULT_SETTINGS },
    prefsUpdatedAt: 0,
  }
}

/**
 * Die Listen, die zum Server gehen.
 *
 * An einer Stelle, weil sie an zwei gebraucht wird: zum Hochladen und um
 * überhaupt zu erkennen, dass es etwas hochzuladen gibt. Stand die zweite
 * Aufzählung getrennt daneben, fehlten dort drei Listen – geteilte Notizen
 * wanderten nie von selbst hoch, sondern nur, wenn zufällig gleichzeitig ein
 * Einkaufseintrag geändert wurde. Ein Test hält beide Enden zusammen.
 */
export const SYNC_LISTS = [
  'txs',
  'pots',
  'potEntries',
  'challenges',
  'recurringTxs',
  'shopItems',
  'pantryItems',
  'notes',
  'shopTemplates',
] as const satisfies readonly (keyof State)[]

/** Gibt es seit `since` überhaupt etwas Neues? Sonst gar nicht erst fragen. */
export function hasChangesSince(state: State, since: number): boolean {
  if (state.prefsUpdatedAt > since) return true
  return SYNC_LISTS.some((key) => (state[key] as readonly Entity[]).some((item) => item.updatedAt > since))
}

/* --- Änderungen ----------------------------------------------------------- */

export type Action =
  | { type: 'tx/add'; tx: Omit<Tx, keyof Entity> }
  | { type: 'tx/update'; id: string; patch: Partial<Omit<Tx, keyof Entity>> }
  | { type: 'tx/remove'; id: string }
  | { type: 'category/add'; category: Omit<Category, 'id'> }
  | { type: 'category/update'; id: string; patch: Partial<Omit<Category, 'id'>> }
  | { type: 'category/remove'; id: string }
  | { type: 'pot/add'; pot: Omit<Pot, keyof Entity> }
  | { type: 'pot/update'; id: string; patch: Partial<Omit<Pot, keyof Entity>> }
  | { type: 'pot/remove'; id: string }
  | { type: 'potEntry/add'; entry: Omit<PotEntry, keyof Entity> }
  | { type: 'potEntry/remove'; id: string }
  | { type: 'challenge/add'; challenge: Omit<Challenge, keyof Entity> }
  /**
   * Challenge und zugehörigen Spartopf in einem Zug anlegen.
   *
   * Muss zusammen passieren: Die Kennung des Topfes entsteht erst hier drin,
   * und ohne sie stünde die Challenge ohne Topf da – jedes Häkchen bliebe dann
   * ein Häkchen, statt Geld zu bewegen.
   */
  | {
      type: 'challenge/start'
      challenge: Omit<Challenge, keyof Entity | 'potId'>
      pot: Omit<Pot, keyof Entity> | null
    }
  | { type: 'challenge/update'; id: string; patch: Partial<Omit<Challenge, keyof Entity>> }
  | { type: 'challenge/toggleSlot'; id: string; slot: number }
  | { type: 'challenge/remove'; id: string }
  | { type: 'shop/add'; item: Omit<ShopItem, keyof Entity> }
  | { type: 'shop/update'; id: string; patch: Partial<Omit<ShopItem, keyof Entity>> }
  | { type: 'shop/toggle'; id: string }
  | { type: 'shop/remove'; id: string }
  | { type: 'shop/clearDone' }
  | { type: 'shop/finishTrip'; order: AisleId[] }
  | { type: 'pantry/add'; item: Omit<PantryItem, keyof Entity> }
  | { type: 'pantry/update'; id: string; patch: Partial<Omit<PantryItem, keyof Entity>> }
  | { type: 'pantry/remove'; id: string }
  | { type: 'note/add'; note: Omit<Note, keyof Entity> }
  | { type: 'note/update'; id: string; patch: Partial<Omit<Note, keyof Entity>> }
  | { type: 'note/remove'; id: string }
  | { type: 'template/add'; template: Omit<ShopTemplate, keyof Entity> }
  | { type: 'template/update'; id: string; patch: Partial<Omit<ShopTemplate, keyof Entity>> }
  | { type: 'template/remove'; id: string }
  | { type: 'recurring/add'; rule: Omit<RecurringTx, keyof Entity> }
  | { type: 'recurring/update'; id: string; patch: Partial<Omit<RecurringTx, keyof Entity>> }
  | { type: 'recurring/remove'; id: string }
  /**
   * Fällige Buchungen einer Regel in einem Zug anlegen und `lastRun`
   * nachziehen. Beides muss zusammen passieren – sonst entstünden beim
   * nächsten Start dieselben Buchungen ein zweites Mal.
   */
  | { type: 'recurring/run'; id: string; dates: string[] }
  /**
   * Einen Grabstein zurücknehmen. Weil Gelöschtes nur markiert und nicht
   * entfernt wird, genügt dafür ein Zurücksetzen von `deletedAt` – es braucht
   * keinen Zwischenspeicher irgendwo neben dem Zustand.
   */
  | { type: 'undo/restore'; list: UndoableList; ids: string[] }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'sync/merge'; incoming: Partial<State> }
  | { type: 'state/replace'; state: State }

/** Listen, aus denen sich ein Löschen zurücknehmen lässt. */
export type UndoableList =
  | 'txs'
  | 'pots'
  | 'potEntries'
  | 'challenges'
  | 'recurringTxs'
  | 'shopItems'
  | 'pantryItems'
  | 'notes'
  | 'shopTemplates'

/** Neue Felder für einen frisch angelegten Datensatz. */
function stamp(): Entity {
  return { id: newId(), updatedAt: Date.now(), deletedAt: null }
}

/**
 * Einen Datensatz in einer Liste ändern.
 *
 * `updatedAt` wird dabei zwingend neu gesetzt – daran entscheidet der Abgleich
 * später, welche Fassung gewinnt. Eine Änderung ohne frischen Zeitstempel wäre
 * für den Server unsichtbar.
 *
 * `NoInfer` um den Änderungssatz: Ohne das zieht TypeScript den Typ des
 * Datensatzes auch aus `patch`, bekommt aus Liste und Änderung zwei
 * unvereinbare Kandidaten und weicht auf die Schranke `Entity` aus. Geprüft
 * würde dann nur noch gegen `Partial<Entity>` – ein vertippter Feldname fiele
 * nirgends auf. So gibt allein die Liste den Typ vor, und die Änderung wird
 * dagegen geprüft.
 */
function patchItem<T extends Entity>(list: T[], id: string, patch: Partial<NoInfer<T>>): T[] {
  let found = false
  const next = list.map((item) => {
    if (item.id !== id) return item
    found = true
    return { ...item, ...patch, id: item.id, updatedAt: Date.now() }
  })
  return found ? next : list
}

/** Grabstein setzen statt aus der Liste werfen. */
function tombstone<T extends Entity>(list: T[], id: string): T[] {
  return patchItem(list, id, { deletedAt: Date.now() } as Partial<T>)
}

/** Sichtbare Einträge: alles ohne Grabstein. */
export function live<T extends Entity>(list: readonly T[]): T[] {
  return list.filter((item) => item.deletedAt === null)
}

/**
 * Gewichteter Mittelwert für die gelernte Ladenreihenfolge.
 *
 * Ein einzelner Einkauf soll die Reihenfolge nicht umwerfen – vielleicht lag
 * die Milch heute nur zufällig zuletzt im Wagen. Mit dem Faktor 0,3 braucht es
 * mehrere gleichartige Einkäufe, bis sich die Sortierung merklich dreht.
 */
const LEARN_RATE = 0.3

function learnAisleOrder(
  current: Partial<Record<AisleId, number>>,
  order: readonly AisleId[],
): Partial<Record<AisleId, number>> {
  if (order.length === 0) return current
  const next = { ...current }
  order.forEach((id, index) => {
    const previous = next[id]
    next[id] = previous === undefined ? index : previous * (1 - LEARN_RATE) + index * LEARN_RATE
  })
  return next
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    /* --- Geld --- */
    case 'tx/add':
      return { ...state, txs: [{ ...action.tx, ...stamp() }, ...state.txs] }
    case 'tx/update': {
      const txs = patchItem(state.txs, action.id, action.patch)
      return txs === state.txs ? state : { ...state, txs }
    }
    case 'tx/remove': {
      const txs = tombstone(state.txs, action.id)
      return txs === state.txs ? state : { ...state, txs }
    }

    case 'category/add':
      return {
        ...state,
        categories: [...state.categories, { ...action.category, id: newId() }],
        prefsUpdatedAt: Date.now(),
      }
    case 'category/update':
      return {
        ...state,
        categories: state.categories.map((c) => (c.id === action.id ? { ...c, ...action.patch, id: c.id } : c)),
        prefsUpdatedAt: Date.now(),
      }
    case 'category/remove': {
      const doomed = state.categories.find((c) => c.id === action.id)
      if (!doomed) return state
      // Die letzte Kategorie ihrer Art bleibt stehen. Ohne sie ließe sich
      // keine Einnahme bzw. Ausgabe mehr erfassen – das Formular hätte nichts
      // mehr auszuwählen und die Schaltfläche zum Speichern bliebe für immer
      // grau. Ein Aufräumen darf die App nicht unbenutzbar machen.
      if (state.categories.filter((c) => c.kind === doomed.kind).length <= 1) return state
      // Buchungen behalten ihre Kategorie-Kennung; die Oberfläche zeigt dann
      // „Ohne Kategorie“. Buchungen mitzulöschen wäre ein Datenverlust, den
      // niemand erwartet, wenn er nur eine Kategorie aufräumen wollte.
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
        prefsUpdatedAt: Date.now(),
      }
    }

    /* --- Sparen --- */
    case 'pot/add':
      return { ...state, pots: [...state.pots, { ...action.pot, ...stamp() }] }
    case 'pot/update': {
      const pots = patchItem(state.pots, action.id, action.patch)
      return pots === state.pots ? state : { ...state, pots }
    }
    case 'pot/remove': {
      const now = Date.now()
      return {
        ...state,
        pots: tombstone(state.pots, action.id),
        // Einzahlungen eines gelöschten Topfes verschwinden mit ihm, sonst
        // zählte die Sparsumme Beträge mit, zu denen es kein Ziel mehr gibt.
        potEntries: state.potEntries.map((e) =>
          e.potId === action.id && e.deletedAt === null ? { ...e, deletedAt: now, updatedAt: now } : e,
        ),
        // Challenges, die in den Topf einzahlten, laufen ohne Topf weiter.
        challenges: state.challenges.map((c) =>
          c.potId === action.id ? { ...c, potId: null, updatedAt: now } : c,
        ),
      }
    }
    case 'potEntry/add':
      return { ...state, potEntries: [{ ...action.entry, ...stamp() }, ...state.potEntries] }
    case 'potEntry/remove': {
      const potEntries = tombstone(state.potEntries, action.id)
      return potEntries === state.potEntries ? state : { ...state, potEntries }
    }

    /* --- Challenges --- */
    case 'challenge/add':
      return { ...state, challenges: [...state.challenges, { ...action.challenge, ...stamp() }] }

    case 'challenge/start': {
      const pot = action.pot ? { ...action.pot, ...stamp() } : null
      const challenge: Challenge = { ...action.challenge, ...stamp(), potId: pot?.id ?? null }
      return {
        ...state,
        pots: pot ? [...state.pots, pot] : state.pots,
        challenges: [...state.challenges, challenge],
      }
    }
    case 'challenge/update': {
      const challenges = patchItem(state.challenges, action.id, action.patch)
      return challenges === state.challenges ? state : { ...state, challenges }
    }
    case 'challenge/remove': {
      const challenges = tombstone(state.challenges, action.id)
      return challenges === state.challenges ? state : { ...state, challenges }
    }

    case 'challenge/toggleSlot': {
      const challenge = state.challenges.find((c) => c.id === action.id)
      if (!challenge || challenge.deletedAt !== null) return state
      if (action.slot < 0 || action.slot >= challenge.slots) return state

      const wasFilled = challenge.filled.includes(action.slot)
      const filled = wasFilled
        ? challenge.filled.filter((s) => s !== action.slot)
        : [...challenge.filled, action.slot].sort((a, b) => a - b)

      const next: State = {
        ...state,
        challenges: patchItem(state.challenges, action.id, { filled }),
      }
      if (!challenge.potId) return next

      // Der Haken bewegt echtes Geld: Er legt im Spartopf eine Einzahlung an
      // (bzw. nimmt sie zurück). Sonst zeigte die Challenge einen Fortschritt,
      // dem im Sparstand nichts entspricht.
      const amount = slotAmount(challenge, action.slot)
      if (wasFilled) {
        const now = Date.now()
        return {
          ...next,
          potEntries: next.potEntries.map((e) =>
            e.challengeId === action.id && e.slot === action.slot && e.deletedAt === null
              ? { ...e, deletedAt: now, updatedAt: now }
              : e,
          ),
        }
      }
      return {
        ...next,
        potEntries: [
          {
            ...stamp(),
            potId: challenge.potId,
            cents: amount,
            date: today(),
            note: challenge.name,
            challengeId: challenge.id,
            slot: action.slot,
          },
          ...next.potEntries,
        ],
      }
    }

    /* --- Einkauf --- */
    case 'shop/add':
      return { ...state, shopItems: [{ ...action.item, ...stamp() }, ...state.shopItems] }
    case 'shop/update': {
      const shopItems = patchItem(state.shopItems, action.id, action.patch)
      return shopItems === state.shopItems ? state : { ...state, shopItems }
    }
    case 'shop/toggle': {
      const item = state.shopItems.find((i) => i.id === action.id)
      if (!item) return state
      return { ...state, shopItems: patchItem(state.shopItems, action.id, { done: !item.done }) }
    }
    case 'shop/remove': {
      const shopItems = tombstone(state.shopItems, action.id)
      return shopItems === state.shopItems ? state : { ...state, shopItems }
    }
    case 'shop/clearDone': {
      const now = Date.now()
      return {
        ...state,
        shopItems: state.shopItems.map((i) =>
          i.done && i.deletedAt === null ? { ...i, deletedAt: now, updatedAt: now } : i,
        ),
      }
    }
    case 'shop/finishTrip': {
      const now = Date.now()
      return {
        ...state,
        aisleOrder: learnAisleOrder(state.aisleOrder, action.order),
        shopItems: state.shopItems.map((i) =>
          i.done && i.deletedAt === null ? { ...i, deletedAt: now, updatedAt: now } : i,
        ),
      }
    }

    /* --- Vorrat --- */
    case 'pantry/add':
      return { ...state, pantryItems: [{ ...action.item, ...stamp() }, ...state.pantryItems] }
    case 'pantry/update': {
      const pantryItems = patchItem(state.pantryItems, action.id, action.patch)
      return pantryItems === state.pantryItems ? state : { ...state, pantryItems }
    }
    case 'pantry/remove': {
      const pantryItems = tombstone(state.pantryItems, action.id)
      return pantryItems === state.pantryItems ? state : { ...state, pantryItems }
    }

    /* --- Notizen --- */
    case 'note/add':
      return { ...state, notes: [{ ...action.note, ...stamp() }, ...state.notes] }
    case 'note/update': {
      const notes = patchItem(state.notes, action.id, action.patch)
      return notes === state.notes ? state : { ...state, notes }
    }
    case 'note/remove': {
      const notes = tombstone(state.notes, action.id)
      return notes === state.notes ? state : { ...state, notes }
    }

    /* --- Einkaufs-Vorlagen --- */
    case 'template/add':
      return { ...state, shopTemplates: [...state.shopTemplates, { ...action.template, ...stamp() }] }
    case 'template/update': {
      const shopTemplates = patchItem(state.shopTemplates, action.id, action.patch)
      return shopTemplates === state.shopTemplates ? state : { ...state, shopTemplates }
    }
    case 'template/remove': {
      const shopTemplates = tombstone(state.shopTemplates, action.id)
      return shopTemplates === state.shopTemplates ? state : { ...state, shopTemplates }
    }

    /* --- Wiederkehrende Buchungen --- */
    case 'recurring/add':
      return { ...state, recurringTxs: [...state.recurringTxs, { ...action.rule, ...stamp() }] }
    case 'recurring/update': {
      const recurringTxs = patchItem(state.recurringTxs, action.id, action.patch)
      return recurringTxs === state.recurringTxs ? state : { ...state, recurringTxs }
    }
    case 'recurring/remove': {
      const recurringTxs = tombstone(state.recurringTxs, action.id)
      return recurringTxs === state.recurringTxs ? state : { ...state, recurringTxs }
    }
    case 'recurring/run': {
      const rule = state.recurringTxs.find((r) => r.id === action.id)
      if (!rule || rule.deletedAt !== null || action.dates.length === 0) return state

      const fresh: Tx[] = action.dates.map((date) => ({
        ...stamp(),
        kind: rule.kind,
        cents: rule.cents,
        categoryId: rule.categoryId,
        note: rule.note,
        date,
        recurring: true,
      }))
      // `lastRun` im selben Schritt setzen: Stünde es in einer eigenen Aktion,
      // ergäbe ein Abbruch dazwischen doppelte Buchungen.
      const latest = action.dates[action.dates.length - 1]!
      return {
        ...state,
        txs: [...fresh, ...state.txs],
        recurringTxs: patchItem(state.recurringTxs, action.id, { lastRun: latest }),
      }
    }

    /* --- Rückgängig --- */
    case 'undo/restore': {
      const ids = new Set(action.ids)
      const list = state[action.list]
      let changed = false
      const next = (list as readonly Entity[]).map((item) => {
        if (!ids.has(item.id) || item.deletedAt === null) return item
        changed = true
        // Frischer Zeitstempel, damit die Rücknahme beim Abgleich gegen den
        // Grabstein gewinnt – sonst holte der Server ihn gleich wieder.
        return { ...item, deletedAt: null, updatedAt: Date.now() }
      })
      return changed ? { ...state, [action.list]: next } : state
    }

    /* --- Rahmen --- */
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch }, prefsUpdatedAt: Date.now() }
    case 'sync/merge':
      return mergeState(state, action.incoming)
    case 'state/replace':
      return action.state
  }
}

/* --- Challenge-Beträge ---------------------------------------------------- */

/**
 * Was Feld `slot` (0-basiert) kostet.
 *
 * Steht hier und nicht in `challenges.ts`, weil der Reducer den Betrag beim
 * Abhaken sofort braucht – und weil beide dieselbe Zahl nennen müssen.
 *
 * `gleich` kostet überall dasselbe. `steigend` und `frei` staffeln beide nach
 * Feldnummer; sie unterscheiden sich nur darin, ob die Felder der Reihe nach
 * fällig werden oder man sich jede Woche eines aussucht.
 */
export function slotAmount(challenge: Pick<Challenge, 'kind' | 'stepCents'>, slot: number): number {
  return challenge.kind === 'gleich' ? challenge.stepCents : challenge.stepCents * (slot + 1)
}

/* --- Abgleich ------------------------------------------------------------- */

/**
 * Zwei Stände zusammenführen: Je Datensatz gewinnt der mit dem jüngeren
 * `updatedAt`.
 *
 * Für Einkaufsliste und Vorrat reicht das aus. Die Einträge sind klein und
 * unabhängig; im schlimmsten Fall setzt sich beim gleichzeitigen Bearbeiten
 * *eines* Eintrags eine der beiden Fassungen durch. Der praktisch häufige Fall
 * – zwei Menschen haken verschiedene Dinge ab – ist damit sauber gelöst.
 */
function mergeList<T extends Entity>(mine: readonly T[], theirs: readonly T[] | undefined): T[] {
  if (!theirs) return [...mine]
  const byId = new Map<string, T>()
  for (const item of mine) byId.set(item.id, item)
  for (const item of theirs) {
    const existing = byId.get(item.id)
    if (!existing || item.updatedAt > existing.updatedAt) byId.set(item.id, item)
  }
  return Array.from(byId.values())
}

export function mergeState(state: State, incoming: Partial<State>): State {
  // Kategorien und Einstellungen sind je ein Ganzes, kein Bestand einzelner
  // Datensätze. Für sie gilt derselbe Grundsatz wie sonst – der jüngere Stand
  // gewinnt –, nur eben für die Sammlung als solche. Ohne den Vergleich
  // schlüge ein zweiter Abgleich die gerade umbenannte Kategorie wieder mit
  // dem alten Namen vom Server zurück.
  const prefsFremd = incoming.prefsUpdatedAt ?? 0
  const prefsNeuer = prefsFremd > state.prefsUpdatedAt

  return {
    ...state,
    prefsUpdatedAt: Math.max(state.prefsUpdatedAt, prefsFremd),
    txs: mergeList(state.txs, incoming.txs),
    pots: mergeList(state.pots, incoming.pots),
    potEntries: mergeList(state.potEntries, incoming.potEntries),
    challenges: mergeList(state.challenges, incoming.challenges),
    recurringTxs: mergeList(state.recurringTxs, incoming.recurringTxs),
    shopItems: mergeList(state.shopItems, incoming.shopItems),
    pantryItems: mergeList(state.pantryItems, incoming.pantryItems),
    notes: mergeList(state.notes, incoming.notes),
    shopTemplates: mergeList(state.shopTemplates, incoming.shopTemplates),
    categories: prefsNeuer && incoming.categories?.length ? incoming.categories : state.categories,
    settings: prefsNeuer && incoming.settings ? { ...state.settings, ...incoming.settings } : state.settings,
    aisleOrder: { ...state.aisleOrder, ...incoming.aisleOrder },
  }
}

/* --- Speicher ------------------------------------------------------------- */

/**
 * Gespeicherten Zustand einlesen.
 *
 * Alles wird geprüft, statt dem Speicher zu vertrauen. Ein halb geschriebener
 * oder von Hand verbogener Eintrag darf höchstens sich selbst kosten – nie den
 * Start der App. Was nicht passt, fliegt still raus; der Rest bleibt nutzbar.
 */
export function loadState(raw: string | null): State {
  const base = initialState()
  if (!raw) return base

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return base
  }
  if (!parsed || typeof parsed !== 'object') return base
  const data = parsed as Record<string, unknown>

  const entity = (value: unknown): value is Record<string, unknown> => {
    if (!value || typeof value !== 'object') return false
    const item = value as Record<string, unknown>
    return (
      typeof item.id === 'string' &&
      item.id.length > 0 &&
      typeof item.updatedAt === 'number' &&
      Number.isFinite(item.updatedAt) &&
      (item.deletedAt === null || typeof item.deletedAt === 'number')
    )
  }

  /**
   * @param ok   Mindestanforderung – was hier durchfällt, ist unbrauchbar.
   * @param fill Ergänzt Felder, die es in einer früheren Fassung der App noch
   *             nicht gab. Ohne das trüge ein gespeicherter Einkaufszettel
   *             kein `note`, und der erste Zugriff darauf liefe ins Leere.
   *             Solche Einträge deshalb auffüllen statt verwerfen – sie sind
   *             in Ordnung, nur älter.
   */
  const list = <T>(
    key: string,
    ok: (item: Record<string, unknown>) => boolean,
    fill?: (item: Record<string, unknown>) => Partial<T>,
  ): T[] => {
    const value = data[key]
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    const out: T[] = []
    for (const item of value) {
      if (!entity(item) || !ok(item)) continue
      const id = item.id as string
      if (seen.has(id)) continue // doppelte Kennungen brächen jede Liste
      seen.add(id)
      out.push(fill ? ({ ...item, ...fill(item) } as T) : (item as T))
    }
    return out
  }

  const text = (v: unknown) => typeof v === 'string'
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

  const state: State = {
    ...base,
    txs: list<Tx>('txs', (i) => isValidCents(i.cents) && i.cents >= 0 && text(i.date) && (i.kind === 'einnahme' || i.kind === 'ausgabe')),
    pots: list<Pot>('pots', (i) => text(i.name) && (i.targetCents === null || isValidCents(i.targetCents))),
    potEntries: list<PotEntry>('potEntries', (i) => isValidCents(i.cents) && text(i.potId) && text(i.date)),
    challenges: list<Challenge>(
      'challenges',
      (i) =>
        text(i.name) &&
        isValidCents(i.stepCents) &&
        i.stepCents > 0 &&
        num(i.slots) &&
        (i.slots as number) > 0 &&
        Array.isArray(i.filled),
    ),
    recurringTxs: list<RecurringTx>(
      'recurringTxs',
      (i) =>
        isValidCents(i.cents) &&
        i.cents > 0 &&
        text(i.categoryId) &&
        text(i.startDate) &&
        (i.kind === 'einnahme' || i.kind === 'ausgabe') &&
        (i.unit === 'woche' || i.unit === 'monat' || i.unit === 'jahr'),
      (i) => ({
        note: text(i.note) ? (i.note as string) : '',
        anchorDay: num(i.anchorDay) ? (i.anchorDay as number) : 1,
        anchorMonth: num(i.anchorMonth) ? (i.anchorMonth as number) : null,
        lastRun: text(i.lastRun) ? (i.lastRun as string) : null,
        active: i.active !== false,
      }),
    ),
    shopItems: list<ShopItem>(
      'shopItems',
      (i) => text(i.name) && typeof i.done === 'boolean',
      (i) => ({
        qty: text(i.qty) ? (i.qty as string) : '',
        note: text(i.note) ? (i.note as string) : '',
        priceCents: isValidCents(i.priceCents) ? (i.priceCents as number) : null,
      }),
    ),
    pantryItems: list<PantryItem>('pantryItems', (i) => text(i.name) && num(i.qty), (i) => ({
      note: text(i.note) ? (i.note as string) : '',
    })),
    notes: list<Note>('notes', (i) => text(i.title) || text(i.body), (i) => ({
      title: text(i.title) ? (i.title as string) : '',
      body: text(i.body) ? (i.body as string) : '',
      pinned: i.pinned === true,
    })),
    shopTemplates: list<ShopTemplate>(
      'shopTemplates',
      (i) => text(i.name) && Array.isArray(i.items),
      (i) => ({
        emoji: text(i.emoji) ? (i.emoji as string) : '🛒',
        items: (i.items as unknown[])
          .filter((entry): entry is Record<string, unknown> => {
            return !!entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).name === 'string'
          })
          .map((entry) => ({
            name: entry.name as string,
            qty: typeof entry.qty === 'string' ? entry.qty : '',
            aisle: (typeof entry.aisle === 'string' ? entry.aisle : 'sonstiges') as AisleId,
            note: typeof entry.note === 'string' ? entry.note : '',
          })),
      }),
    ),
  }

  // Challenge-Felder säubern: nur Zahlen im gültigen Bereich, ohne Dubletten.
  state.challenges = state.challenges.map((c) => ({
    ...c,
    filled: Array.from(
      new Set((c.filled as unknown[]).filter((s): s is number => Number.isInteger(s) && (s as number) >= 0 && (s as number) < c.slots)),
    ).sort((a, b) => a - b),
  }))

  if (Array.isArray(data.categories)) {
    const categories = (data.categories as unknown[]).filter((c): c is Category => {
      if (!c || typeof c !== 'object') return false
      const item = c as Record<string, unknown>
      return (
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        (item.kind === 'einnahme' || item.kind === 'ausgabe') &&
        (item.budgetCents === null || isValidCents(item.budgetCents))
      )
    })
    // Ohne Kategorien ließe sich nichts erfassen – dann lieber die Startliste.
    if (categories.length > 0) state.categories = categories
  }

  if (data.aisleOrder && typeof data.aisleOrder === 'object') {
    const order: Partial<Record<AisleId, number>> = {}
    for (const [key, value] of Object.entries(data.aisleOrder as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) order[key as AisleId] = value
    }
    state.aisleOrder = order
  }

  if (data.settings && typeof data.settings === 'object') {
    const s = data.settings as Record<string, unknown>
    state.settings = {
      displayName: typeof s.displayName === 'string' && s.displayName.trim() ? s.displayName : DEFAULT_SETTINGS.displayName,
      theme: s.theme === 'hell' || s.theme === 'dunkel' ? s.theme : 'system',
      startTab:
        s.startTab === 'geld' || s.startTab === 'sparen' || s.startTab === 'einkauf' || s.startTab === 'vorrat'
          ? s.startTab
          : 'start',
      haptics: typeof s.haptics === 'boolean' ? s.haptics : true,
    }
  }

  if (typeof data.prefsUpdatedAt === 'number' && Number.isFinite(data.prefsUpdatedAt)) {
    state.prefsUpdatedAt = data.prefsUpdatedAt
  }

  return state
}

export function readStoredState(): State {
  try {
    return loadState(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    // Privater Modus in Safari kann den Zugriff verweigern.
    return initialState()
  }
}

export function writeStoredState(state: State): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Speicher voll oder gesperrt: Die App läuft weiter, nur eben ohne
    // Sicherung auf diesem Gerät. Ein Absturz wäre hier das schlechtere Ende.
  }
}
