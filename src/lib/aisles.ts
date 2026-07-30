import type { AisleId } from './types'

/**
 * Abteilungen und ihre Reihenfolge im Laden.
 *
 * Die Standardreihenfolge folgt dem üblichen Rundgang: vorne Obst und Gemüse,
 * hinten die Getränke, Drogerie zum Schluss. Sie ist nur der Startwert – die
 * App lernt aus dem Abhaken, wie *dieser* Laden läuft (siehe `route.ts`).
 */

export interface Aisle {
  id: AisleId
  name: string
  emoji: string
  /**
   * Vorwarnzeiten für das Mindesthaltbarkeitsdatum in Tagen. Hackfleisch muss
   * einen Tag vorher warnen, Konserven dürfen einen Monat vorher erinnern –
   * eine einzige Formel für alles wäre entweder Panikmache oder zu spät.
   */
  warnDays: number
  urgentDays: number
}

export const AISLES: readonly Aisle[] = [
  { id: 'obst', name: 'Obst & Gemüse', emoji: '🥬', warnDays: 3, urgentDays: 1 },
  { id: 'backwaren', name: 'Backwaren', emoji: '🥖', warnDays: 2, urgentDays: 1 },
  { id: 'kuehl', name: 'Kühlregal', emoji: '🥛', warnDays: 5, urgentDays: 2 },
  { id: 'fleisch', name: 'Fleisch & Fisch', emoji: '🥩', warnDays: 2, urgentDays: 1 },
  { id: 'tiefkuehl', name: 'Tiefkühl', emoji: '🧊', warnDays: 21, urgentDays: 7 },
  { id: 'trocken', name: 'Trockenware', emoji: '🌾', warnDays: 30, urgentDays: 7 },
  { id: 'konserven', name: 'Konserven', emoji: '🥫', warnDays: 30, urgentDays: 7 },
  { id: 'suesses', name: 'Süßes & Snacks', emoji: '🍫', warnDays: 21, urgentDays: 7 },
  { id: 'getraenke', name: 'Getränke', emoji: '🧃', warnDays: 30, urgentDays: 7 },
  { id: 'haushalt', name: 'Haushalt', emoji: '🧻', warnDays: 60, urgentDays: 14 },
  { id: 'drogerie', name: 'Drogerie', emoji: '🧴', warnDays: 60, urgentDays: 14 },
  { id: 'sonstiges', name: 'Sonstiges', emoji: '🛒', warnDays: 14, urgentDays: 3 },
]

const BY_ID = new Map(AISLES.map((aisle) => [aisle.id, aisle]))

export function aisle(id: AisleId): Aisle {
  // Fällt auf „Sonstiges“ zurück, falls je eine unbekannte Kennung ankommt –
  // ein fehlender Eintrag darf die Liste nicht leer zeigen.
  return BY_ID.get(id) ?? BY_ID.get('sonstiges')!
}

export const DEFAULT_AISLE_ORDER: readonly AisleId[] = AISLES.map((a) => a.id)

/* --- Zuordnung aus dem Namen --------------------------------------------- */

/**
 * Stichwörter je Abteilung.
 *
 * Damit landet „Milch“ ohne Rückfrage im Kühlregal und „Klopapier“ im
 * Haushalt. Wer eine Einkaufsliste tippt, will genau ein Feld ausfüllen –
 * jede weitere Auswahl kostet mehr Zeit, als die Sortierung später einspart.
 * Sitzt der Vorschlag daneben, lässt er sich mit einem Tipp ändern.
 */
const KEYWORDS: Record<AisleId, readonly string[]> = {
  obst: [
    'apfel', 'äpfel', 'banane', 'birne', 'orange', 'mandarine', 'zitrone', 'limette',
    'traube', 'beere', 'erdbeer', 'himbeer', 'heidelbeer', 'blaubeer', 'kirsch',
    'pfirsich', 'nektarine', 'pflaume', 'melone', 'ananas', 'mango', 'kiwi', 'avocado',
    'salat', 'gurke', 'tomate', 'paprika', 'zwiebel', 'knoblauch', 'kartoffel',
    'karotte', 'möhre', 'zucchini', 'aubergine', 'brokkoli', 'blumenkohl', 'kohl',
    'spinat', 'lauch', 'sellerie', 'radieschen', 'rucola', 'pilz', 'champignon',
    'kräuter', 'petersilie', 'basilikum', 'schnittlauch', 'ingwer', 'kürbis', 'spargel',
    'obst', 'gemüse', 'bohnen',
  ],
  backwaren: [
    'brot', 'brötchen', 'semmel', 'baguette', 'toast', 'croissant', 'brezel', 'laugen',
    'kuchen', 'torte', 'gebäck', 'muffin', 'donut', 'zwieback', 'knäcke',
  ],
  kuehl: [
    'milch', 'butter', 'käse', 'joghurt', 'jogurt', 'quark', 'sahne', 'schmand',
    'frischkäse', 'mozzarella', 'feta', 'gouda', 'parmesan', 'ei', 'eier',
    'margarine', 'pudding', 'skyr', 'buttermilch', 'kefir', 'creme fraiche',
    'crème fraîche', 'hummus', 'tofu', 'aufstrich',
  ],
  fleisch: [
    'fleisch', 'hack', 'hähnchen', 'huhn', 'pute', 'rind', 'schwein', 'steak',
    'schnitzel', 'wurst', 'salami', 'schinken', 'speck', 'bacon', 'gulasch',
    'bratwurst', 'fisch', 'lachs', 'thunfisch', 'garnele', 'forelle', 'kabeljau',
    'frikadelle', 'leberkäse',
  ],
  tiefkuehl: [
    'tiefkühl', 'tk ', 'gefrier', 'eis', 'pizza', 'pommes', 'fischstäbchen',
    'blätterteig', 'beeren tk',
  ],
  trocken: [
    'nudel', 'pasta', 'spaghetti', 'penne', 'reis', 'mehl', 'zucker', 'salz',
    'pfeffer', 'gewürz', 'öl', 'essig', 'linsen', 'couscous', 'bulgur',
    'haferflocken', 'müsli', 'cornflakes', 'backpulver', 'hefe', 'grieß', 'olivenöl',
    'kaffee', 'tee', 'kakao', 'honig', 'marmelade', 'nutella', 'erdnussbutter',
    'nüsse', 'mandel', 'rosinen', 'ketchup', 'senf', 'mayo', 'sauce', 'soße',
    'brühe', 'stärke',
  ],
  konserven: [
    'dose', 'konserve', 'passierte', 'passata', 'mais', 'kichererbsen',
    'kokosmilch', 'oliven', 'gurken glas', 'sauerkraut', 'eingelegt',
  ],
  suesses: [
    'schokolade', 'schoko', 'keks', 'bonbon', 'gummibär', 'chips', 'flips',
    'cracker', 'riegel', 'praline', 'süßigkeit', 'snack', 'popcorn', 'salzstangen',
  ],
  getraenke: [
    'wasser', 'sprudel', 'saft', 'cola', 'limo', 'bier', 'wein', 'sekt',
    'getränk', 'schorle', 'energy', 'eistee', 'sirup', 'radler',
  ],
  haushalt: [
    'klopapier', 'toilettenpapier', 'küchenrolle', 'müllbeutel', 'müllsack',
    'spülmittel', 'spülmaschine', 'waschmittel', 'weichspüler', 'putz',
    'reiniger', 'schwamm', 'lappen', 'alufolie', 'frischhalte', 'backpapier',
    'batterie', 'kerze', 'taschentücher', 'servietten', 'gefrierbeutel',
  ],
  drogerie: [
    'shampoo', 'duschgel', 'seife', 'zahnpasta', 'zahnbürste', 'deo', 'creme',
    'rasier', 'windel', 'binden', 'tampon', 'watte', 'pflaster', 'sonnencreme',
    'handcreme', 'bodylotion', 'haarspray', 'parfum', 'nagellack',
  ],
  sonstiges: [],
}

const LETTER = /[a-zäöüß]/

/**
 * Rät die Abteilung aus dem Produktnamen.
 *
 * Ein Stichwort zählt, wenn es an einer Wortgrenze *beginnt* oder *endet* –
 * mitten im Wort nicht. Beides ist nötig, weil deutsche Zusammensetzungen ihr
 * Grundwort mal vorn und mal hinten tragen: „Nudelauflauf“ beginnt mit dem
 * Stichwort, „Vollmilch“ endet damit. Reine Wortmitten bleiben außen vor,
 * sonst schlüge „eis“ in „Fleisch“ an und „ei“ in „Reis“.
 *
 * Bei mehreren Treffern gewinnt das längste Stichwort, weil es das genauere
 * ist: „erdnussbutter“ (Trockenware) schlägt „butter“ (Kühlregal).
 */
export function guessAisle(name: string): AisleId {
  const text = ` ${name.toLowerCase().trim()} `
  let best: AisleId = 'sonstiges'
  let bestLength = 0

  for (const [id, words] of Object.entries(KEYWORDS) as [AisleId, readonly string[]][]) {
    for (const word of words) {
      if (word.length <= bestLength) continue // kann den Fund nicht mehr schlagen
      for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
        const startsWord = !LETTER.test(text[at - 1] ?? ' ')
        const endsWord = !LETTER.test(text[at + word.length] ?? ' ')
        if (!startsWord && !endsWord) continue
        best = id
        bestLength = word.length
        break
      }
    }
  }
  return best
}
