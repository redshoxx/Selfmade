import type { Entity } from './types'

/**
 * Der Umgang mit Grabsteinen.
 *
 * Steht bewusst getrennt von `store.ts`: Diese eine Zeile wird von der
 * Rechenlogik gebraucht – und die läuft nicht nur im Browser, sondern auch in
 * der Edge Function, die abends die Erinnerung verschickt. Käme sie aus
 * `store.ts`, hinge dort der Speicher des Browsers mit dran, und ein
 * `window.localStorage` an falscher Stelle brächte den Server zu Fall, ohne
 * dass es hier je auffiele.
 */

/** Alles ohne Grabstein. */
export function live<T extends Entity>(list: readonly T[]): T[] {
  return list.filter((item) => item.deletedAt === null)
}
