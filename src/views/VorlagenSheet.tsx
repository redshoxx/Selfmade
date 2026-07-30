import { useState } from 'react'
import { Empty, Field } from '../components/Bits'
import { IconPlus, IconTrash } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { mergeQuantities } from '../lib/quantity'
import { findExisting } from '../lib/shopping'
import { live } from '../lib/store'
import { useApp } from '../lib/useApp'
import type { ShopTemplate } from '../lib/types'

/**
 * Einkaufs-Vorlagen.
 *
 * Der Wocheneinkauf ist jede Woche derselbe – ihn jedes Mal neu zu tippen, ist
 * verlorene Zeit. Eine Vorlage nimmt die offenen Einträge samt Menge, Abteilung
 * und Notiz auf und legt sie später mit einem Tipp wieder hin.
 */
export function VorlagenSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')

  const templates = live(state.shopTemplates)
  const offen = live(state.shopItems).filter((item) => !item.done)

  /**
   * Vorlage auf die Liste holen.
   *
   * Was schon draufsteht, wird zusammengezählt statt verdoppelt – dieselbe
   * Regel wie beim Tippen. Sonst stünde nach zweimal „Wocheneinkauf laden“
   * alles doppelt da.
   */
  const load = (template: ShopTemplate) => {
    for (const entry of template.items) {
      const existing = findExisting(state, entry.name)
      if (existing) {
        dispatch({
          type: 'shop/update',
          id: existing.id,
          patch: { qty: mergeQuantities(existing.qty, entry.qty), done: false },
        })
      } else {
        dispatch({
          type: 'shop/add',
          item: {
            name: entry.name,
            qty: entry.qty,
            aisle: entry.aisle,
            done: false,
            addedBy: state.settings.displayName,
            pantryId: null,
            note: entry.note,
            priceCents: null,
          },
        })
      }
    }
    onClose()
  }

  const saveTemplate = () => {
    if (!name.trim() || offen.length === 0) return
    dispatch({
      type: 'template/add',
      template: {
        name: name.trim(),
        emoji: '🛒',
        items: offen.map((item) => ({
          name: item.name,
          qty: item.qty,
          aisle: item.aisle,
          note: item.note,
        })),
      },
    })
    setSaving(false)
    setName('')
  }

  if (saving) {
    return (
      <Sheet title="Als Vorlage sichern" onClose={() => setSaving(false)}>
        <Field label="Name der Vorlage">
          <input
            className="input"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            placeholder="z. B. Wocheneinkauf"
            autoCapitalize="sentences"
          />
        </Field>
        <p className="small muted">
          Gesichert werden die {offen.length} offenen Einträge mit Menge, Abteilung und Notiz.
          Abgehaktes bleibt außen vor.
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary btn-wide"
            onClick={saveTemplate}
            disabled={!name.trim() || offen.length === 0}
          >
            Sichern
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title="Vorlagen" onClose={onClose}>
      {templates.length === 0 ? (
        <Empty
          emoji="📋"
          title="Noch keine Vorlage"
          text="Sichere deine Liste als Vorlage – dann steht der Wocheneinkauf beim nächsten Mal mit einem Tipp wieder da."
        />
      ) : (
        <div className="card">
          {templates.map((template) => (
            <div key={template.id} className="row">
              <span style={{ fontSize: 20 }} aria-hidden="true">
                {template.emoji}
              </span>
              <button
                type="button"
                className="row-main"
                onClick={() => load(template)}
                style={{ background: 'none', textAlign: 'left' }}
              >
                <span className="row-title">{template.name}</span>
                <span className="row-sub">
                  {template.items.length === 1 ? '1 Eintrag' : `${template.items.length} Einträge`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'template/remove', id: template.id })}
                aria-label={`Vorlage ${template.name} löschen`}
                style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}
              >
                <IconTrash size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary btn-wide"
          onClick={() => setSaving(true)}
          disabled={offen.length === 0}
        >
          <IconPlus size={18} />
          Aktuelle Liste sichern
        </button>
      </div>

      {offen.length === 0 && (
        <p className="small muted" style={{ marginTop: 10 }}>
          Zum Sichern muss mindestens ein offener Eintrag auf der Liste stehen.
        </p>
      )}
    </Sheet>
  )
}
