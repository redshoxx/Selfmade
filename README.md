# Selfmade

Eine Web-App für Geld, Vorrat und Einkauf – zu zweit nutzbar, auf iPhone wie
auf Android, auch ohne Netz.

Fünf Bereiche, alle in Daumenreichweite:

| Bereich | Wozu |
| --- | --- |
| **Start** | Wie steht der Monat, was läuft zu Hause ab, was fehlt beim Einkauf |
| **Geld** | Einnahmen und Ausgaben mit Kategorien, Monatssaldo, Budgets |
| **Sparen** | Spartöpfe und Spar-Challenges (1 €, 2 €, 5 € und mehr) |
| **Einkauf** | Geteilte Liste, sortiert nach dem Weg durch *deinen* Laden |
| **Vorrat** | Was zu Hause steht, mit Mindesthaltbarkeitsdatum und Warnung |

Die App ist installierbar (PWA): auf dem iPhone über *Teilen → Zum Home-Bildschirm*,
auf Android über *Zum Startbildschirm hinzufügen*. Danach startet sie im Vollbild
ohne Browserleisten und läuft auch offline.

---

## Was privat ist und was geteilt wird

Die Trennung ist der Kern des Datenmodells und nicht verhandelbar:

```
   privat (nur du)              geteilt (der Haushalt)
   ─────────────────            ──────────────────────
   Buchungen                    Einkaufsliste
   Spartöpfe                    Vorrat
   Spar-Challenges              Reihenfolge der Abteilungen
```

Wer zusammen einkauft, muss dafür nicht sein Gehalt offenlegen. Die
Einkaufsliste und der Vorrat gehören dem Haushalt, alles rund ums Geld bleibt
bei der Person, die es eingetragen hat – auch auf dem Server, durchgesetzt über
Zugriffsregeln in der Datenbank.

---

## Die Einkaufsliste lernt deinen Laden

Eine alphabetisch sortierte Liste zwingt dazu, den Markt mehrfach zu
durchqueren. Deshalb gruppiert die App nach Abteilung – und bringt die
Abteilungen in die Reihenfolge, in der du sie tatsächlich passierst.

Woher sie die kennt: aus dem Abhaken. Wer beim Einkauf vorne anfängt und sich
durcharbeitet, verrät dabei die Anordnung seines Ladens. Ein Tipp auf
**Einkauf fertig** rechnet die beobachtete Folge ein, gewichtet mit 0,3 – ein
einzelner Einkauf kippt die Sortierung also nicht, mehrere gleichartige schon.

Eingetippt wird nur der Name. Die Abteilung errät die App aus rund
250 Stichwörtern: *Milch* → Kühlregal, *Klopapier* → Haushalt, *Hackfleisch* →
Fleisch & Fisch. Deutsche Zusammensetzungen gehören dazu, deshalb landet auch
*Vollmilch* im Kühlregal. Sitzt der Vorschlag daneben, ändert ihn ein Tipp.

---

## Ablaufdaten mit Augenmaß

Die Vorwarnzeit hängt an der Abteilung, nicht an einer festen Frist:

| Abteilung | „läuft bald ab“ | „muss jetzt weg“ |
| --- | --- | --- |
| Fleisch & Fisch, Backwaren | 2 Tage | 1 Tag |
| Obst & Gemüse | 3 | 1 |
| Kühlregal | 5 | 2 |
| Tiefkühl, Süßes | 21 | 7 |
| Trockenware, Konserven, Getränke | 30 | 7 |
| Haushalt, Drogerie | 60 | 14 |

Hackfleisch, das in drei Tagen abläuft, ist normal – da wird nicht gewarnt.
Eine Konserve, die in drei Tagen abläuft, hat man übersehen, und darauf weist
die App hin. Eine einzige Formel für beides wäre entweder Panikmache oder käme
zu spät, und Warnungen, die zu oft kommen, klickt man irgendwann blind weg.

---

## Spar-Challenges

Eine Challenge ist eine Reihe von Feldern; jedes steht für einen Betrag. Wer
eines abhakt, zahlt damit **echtes Geld in den zugehörigen Spartopf ein** – der
Fortschritt steht also nicht nur im Raster, sondern auch im Sparstand. Nimmt
man das Häkchen zurück, verschwindet die Einzahlung wieder.

Drei Spielarten:

- **steigend** – Feld *n* kostet *n* × Schrittweite, der Reihe nach.
  Die klassische 52-Wochen-Challenge: 1 €, 2 €, 3 € … 52 €.
- **gleich** – jedes Feld kostet dasselbe. „Jede Woche 5 € weg.“
- **frei** – dieselben gestaffelten Beträge, aber du suchst dir jede Woche eines
  aus. In einer teuren Woche das 3-€-Feld, in einer guten das 48-€-Feld. Das ist
  der Grund, warum die meisten Challenges nicht im November scheitern. Mit
  Budget schlägt die App das größte Feld vor, das noch hineinpasst.

Fertige Vorlagen:

| Vorlage | Ergibt |
| --- | --- |
| 1-€-Challenge (52 Wochen, steigend) | 1.378 € |
| 2-€-Challenge | 2.756 € |
| 5-€-Challenge | 6.890 € |
| 1 € frei einteilen | 1.378 € |
| 5 € jede Woche | 260 € |
| 1-Cent-Challenge (365 Tage) | 667,95 € |
| 50 € im Monat (12 Monate) | 600 € |

---

## Zu zweit nutzen – Supabase einrichten

Ohne diesen Schritt läuft die App vollständig, aber allein: Alle Bereiche
funktionieren, die Daten bleiben auf dem Gerät. Für die geteilte Liste braucht
es ein eigenes Supabase-Projekt. Der kostenlose Tarif reicht dafür aus.

**1. Projekt anlegen.** Auf [supabase.com](https://supabase.com) ein neues
Projekt erstellen. Als Region eine europäische wählen, das spart Laufzeit.

**2. Schema einspielen.** Im Projekt auf *SQL Editor* gehen, den Inhalt von
[`supabase/schema.sql`](supabase/schema.sql) einfügen und ausführen. Das Skript
legt die Tabellen an, schaltet die Zugriffsregeln scharf und meldet
Einkaufsliste und Vorrat für Live-Aktualisierung an. Es ist wiederholbar – ein
zweiter Durchlauf schadet nicht.

**3. Zugangsdaten eintragen.** Unter *Project Settings → API* stehen die
Projekt-URL und der `anon`-Schlüssel. Beides in eine Datei `.env` im
Projektordner:

```sh
cp .env.example .env
```

```ini
VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key
```

> Der `anon`-Schlüssel ist für den Browser gedacht und darf öffentlich sein –
> die Zugriffsregeln aus Schritt 2 sind das, was schützt. Der `service_role`-Schlüssel
> gehört **niemals** hierher: Er umgeht sämtliche Regeln.

**4. Anmeldung freischalten.** Unter *Authentication → Providers* muss *Email*
aktiv sein. Ein Passwort braucht niemand; die App verschickt einen Anmeldelink.
Unter *Authentication → URL Configuration* die Adresse eintragen, unter der die
App läuft, damit der Link zurückführt.

**5. Haushalt anlegen und teilen.** In der App auf das Zahnrad, mit der
E-Mail-Adresse anmelden, *Haushalt anlegen*. Es erscheint ein Einladungscode in
der Form `K7M-2QD`. Den gibt deine Freundin bei sich unter *Beitreten* ein –
ab dann sehen beide dieselbe Einkaufsliste und denselben Vorrat, Änderungen
erscheinen binnen Sekunden auf dem anderen Gerät.

Der Code ist zum Vorlesen gemacht: I, O, 0 und 1 kommen darin nicht vor, damit
niemand an der Frage scheitert, ob das eine Null oder ein O war.

---

## Wie der Abgleich funktioniert

Die App ist **lokal führend**. Jede Änderung landet sofort im Zustand und im
Speicher des Browsers; der Abgleich mit dem Server läuft danach im Hintergrund.
Im Supermarkt, wo das Netz zwischen den Regalen wegbricht, ist das der
Unterschied zwischen einer Liste, die funktioniert, und einem Ladekreis.

Zusammengeführt wird je Datensatz nach Zeitstempel – der jüngere Stand gewinnt.
Für Einkaufszettel und Vorratslisten ist das die richtige Wahl: Die Einträge
sind klein und voneinander unabhängig, und der praktisch häufige Fall – zwei
Menschen haken verschiedene Dinge ab – geht dabei nie verloren. Gelöschtes
bekommt einen Grabstein statt zu verschwinden; ohne den käme ein auf dem Handy
gelöschter Eintrag beim nächsten Abgleich vom anderen Gerät zurück.

Beträge liegen ausnahmslos als ganze Cent vor. Fließkomma verbietet sich:
`0.1 + 0.2` ergibt `0.30000000000000004`, und nach ein paar hundert Buchungen
steht in der Monatssumme ein Cent, den niemand erklären kann.

---

## Entwicklung

```sh
npm install
npm run dev        # Entwicklungsserver auf Port 5173
npm test           # 138 Tests
npm run typecheck
npm run build      # Produktionsbündel nach dist/
```

Die Symbole werden nicht mitgeliefert, sondern erzeugt:

```sh
node scripts/make-icons.mjs
```

### Aufbau

```
src/
  lib/
    money.ts        Beträge in Cent, deutsche und englische Eingabe
    date.ts         Tage als „JJJJ-MM-TT“, zeitzonenfest
    store.ts        Zustand, Änderungen, Speicherung, Zusammenführen
    types.ts        Datenmodell – hier steht, was privat und was geteilt ist
    aisles.ts       Abteilungen, Warnfristen, Zuordnung aus dem Namen
    shopping.ts     Gruppierung und gelernte Ladenreihenfolge
    pantry.ts       Ablauf-Ampel, Nachkaufen-Vorschläge
    finance.ts      Monatssummen, Kategorien, Budgets, Spartöpfe
    challenges.ts   Challenge-Engine, Vorlagen, Fortschritt
    sync.ts         Übersetzung Datenbank ↔ App, Hoch- und Runterladen
    useApp.tsx      Zustand, Anmeldung und Abgleich als Kontext
  views/            Ein Bereich je Datei
  components/       Wiederverwendbare Bausteine
supabase/
  schema.sql        Tabellen, Zugriffsregeln, Beitritt per Code
```

Die Rechenlogik liegt vollständig in `lib/` und ist ohne Oberfläche testbar –
alle 138 Tests laufen ohne Browser. Was in den Views steht, ist Darstellung.

### Auf dem Telefon

Kleinigkeiten, an denen sich entscheidet, ob sich eine Web-App wie eine App
anfühlt, und die deshalb bewusst gesetzt sind:

- Eingabefelder haben **genau 16 px** Schriftgröße. Alles darunter lässt iOS
  beim Antippen ins Feld zoomen, und die Seite bleibt danach schief stehen.
- `viewport-fit=cover` samt `env(safe-area-inset-*)` – sonst klebt der Inhalt
  auf dem iPhone an den Kanten und liegt unter der Statusleiste.
- `touch-action: manipulation` schaltet die 300-ms-Verzögerung und den
  Doppeltipp-Zoom ab.
- `100dvh` statt `100vh`, damit die ein- und ausfahrende Adressleiste in Chrome
  auf Android unten nichts abschneidet.
- `visualViewport` misst die eingeblendete Tastatur. Auf iOS schiebt sie das
  Layout nicht, sondern legt sich darüber – die Eingabezeile läge sonst dahinter.
- Die Trefferfläche zum Abhaken ist größer als der sichtbare Kreis. Im Gehen
  trifft man 26 Pixel nicht zuverlässig.

---

## Datenschutz

Deine Daten liegen auf deinem Gerät. Was du teilst, liegt zusätzlich auf deinem
eigenen Supabase-Projekt – sonst nirgends. Es gibt keine Auswertung, keine
Werbekennungen und keine Verbindungen zu Dritten; der Service Worker lässt
Anfragen an den Server bewusst am Zwischenspeicher vorbei, damit nie Bestände
von gestern angezeigt werden.
