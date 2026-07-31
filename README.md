# Selfmade

Eine Web-App für Geld, Vorrat und Einkauf – zu zweit nutzbar, auf iPhone wie
auf Android, auch ohne Netz.

Fünf Bereiche, alle in Daumenreichweite:

| Bereich | Wozu |
| --- | --- |
| **Start** | Wie steht der Monat, was läuft zu Hause ab, was fehlt beim Einkauf |
| **Geld** | Einnahmen und Ausgaben mit Kategorien, Monatssaldo, Budgets |
| **Sparen** | Spartöpfe und Spar-Challenges (1 €, 2 €, 5 € und mehr) |
| **Einkauf** | Geteilte Liste mit Mengen, Preisen und Notizen, sortiert nach dem Weg durch *deinen* Laden |
| **Vorrat** | Was zu Hause steht, mit Mindesthaltbarkeitsdatum und Warnung |

Die App ist installierbar (PWA): auf dem iPhone über *Teilen → Zum Home-Bildschirm*,
auf Android über *Zum Startbildschirm hinzufügen*. Danach startet sie im Vollbild
ohne Browserleisten und läuft auch offline.

---

## Was privat ist und was geteilt wird

Die Trennung ist der Kern des Datenmodells und nicht verhandelbar:

```
   privat (nur du)              gemeinsam (alle Freigeschalteten)
   ─────────────────            ────────────────────────────────
   Buchungen                    Einkaufsliste
   Spartöpfe                    Vorrat
   Spar-Challenges              Notizzettel
   Wiederkehrende Buchungen     Einkaufs-Vorlagen
   Kategorien und Budgets       Reihenfolge der Abteilungen
```

Wer zusammen einkauft, muss dafür nicht sein Gehalt offenlegen. Durchgesetzt
wird das nicht in der Oberfläche, sondern über Zugriffsregeln in der Datenbank:
Die privaten Tabellen geben nur die eigenen Zeilen heraus, und zwar auch dann,
wenn jemand die App umgeht und direkt anfragt.

**Es gibt nichts einzurichten.** Kein Haushalt, kein Einladungscode, kein
Beitreten. Wer sich anmeldet und auf der Zugangsliste steht, sieht dieselbe
Einkaufsliste und denselben Vorrat – sofort. Änderungen erscheinen binnen
Sekunden auf dem anderen Gerät.

Was vor der Anmeldung auf dem Gerät entstanden ist, wandert beim ersten
Abgleich vollständig mit; die eigene Liste und die gemeinsame werden
zusammengelegt.

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

### Menge und Name in einem Feld

„2 Milch“ genügt – die App trennt beides selbst:

| getippt | Name | Menge |
| --- | --- | --- |
| `2 Milch` | Milch | 2 |
| `500g Mehl` | Mehl | 500 g |
| `1,5 l Saft` | Saft | 1,5 l |
| `3x Joghurt` | Joghurt | 3 |
| `Mehl 500 g` | Mehl | 500 g |

Was nur nach einer Menge aussieht, bleibt Teil des Namens: *H-Milch 3,5 %*,
*Vitamin B12*, *Cola Zero*. Eine falsch erkannte Menge ist schlimmer als gar
keine – sie verstümmelt den Namen, und das fällt erst im Laden auf.

Steht die Ware schon auf der Liste, werden die Mengen **zusammengezählt**:
aus „2 Milch“ und später „3 Milch“ wird eine Zeile mit 5. Zwei Zeilen „Milch“
helfen im Laden niemandem. Feinjustieren lässt sich die Menge mit einem Tipp
darauf – dann erscheinen − und +.

### Preise beim Einkauf

Abgehakte Einträge bekommen ein unaufdringliches „+ €“. Wer mag, tippt den
Preis ein; beim **Einkauf fertig** zeigt die App die Summe und bucht sie auf
Bestätigung als Ausgabe. So sieht man, was der Wocheneinkauf wirklich kostet,
ohne den Kassenzettel abzutippen. Das Abhaken selbst bleibt ein einziger Tipp –
der Preis ist nie Pflicht.

### Vorlagen

Der Wocheneinkauf ist jede Woche derselbe. **Aktuelle Liste sichern** nimmt die
offenen Einträge samt Menge, Abteilung und Notiz auf; später holt ein Tipp sie
zurück. Was schon draufsteht, wird auch hier zusammengezählt statt verdoppelt.

### Notizen

Jeder Eintrag kann eine Notiz tragen – „die im blauen Karton“, „nur die große
Packung“ –, sichtbar für alle, die mitlesen. Daneben gibt es unter *Einkauf →
Notizen* einen geteilten Zettel für alles, was keine Einkaufsliste ist:
Rezepte, Maße, Erinnerungen. Angeheftetes steht oben.

### Verschrieben? Rückgängig

Löschen fragt nicht nach, sondern lässt sich zurücknehmen: Nach jedem Löschen
steht sieben Sekunden lang „Rückgängig“ über der Reiterleiste. Eine Rückfrage
bremst jedes Mal, ein Rückgängig nur im Fehlerfall. Auf dem Telefon geht das
auch per Wischen nach links.

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

## Kategorien und Budgets

Die App bringt einen Satz Kategorien mit. Unter *Geld → Kategorien & Budgets*
lassen sich eigene anlegen, umbenennen und mit einem Zeichen versehen.

Zu jeder **Ausgaben**-Kategorie kann ein Monatsbudget hinterlegt werden. Das
sperrt nichts – wer an der Kasse steht, ist mit einer Sperre nicht geholfen.
Die App markiert nur, wie weit der Monat aufgebraucht ist:

| Stand | Anzeige |
| --- | --- |
| unter 80 % | grün, „noch … von …“ |
| ab 80 % | gelb |
| darüber | rot, „… über dem Budget“ |

Bei Einnahmen gibt es kein Budget. Gezählt werden nur Ausgaben – ein Budget auf
„Gehalt“ stünde für immer bei 0 % und sähe aus, als sei etwas kaputt.

Zwei Dinge nimmt die App bewusst in die Hand:

- **Beim Löschen bleiben die Buchungen.** Sie laufen danach unter „Ohne
  Kategorie“ und zählen weiter in die Monatssumme. Sie mitzulöschen wäre ein
  Datenverlust, den niemand erwartet, wenn er nur aufräumen wollte.
- **Die letzte Kategorie ihrer Art bleibt stehen.** Ohne sie ließe sich keine
  Ausgabe bzw. Einnahme mehr erfassen: Das Formular hätte nichts auszuwählen
  und „Speichern“ bliebe für immer grau. Ein Aufräumen darf die App nicht
  unbenutzbar machen.

### Wiederkehrende Buchungen

Miete, Abos und Gehalt legt man unter *Geld → Wiederkehrend* einmal an; danach
bucht die App sie von selbst – wöchentlich, monatlich oder jährlich.

Die Regel merkt sich, bis wohin schon gebucht wurde. Wer die App zwei Monate
nicht öffnet, bekommt beim nächsten Start **beide** Buchungen nachgetragen, und
keine doppelt. Liegt der Beginn in der Vergangenheit, wird rückwirkend
nachgeholt.

Den 31. gibt es nicht in jedem Monat: Wer zum Monatsende bucht, bekommt im
Februar den 28. bzw. 29. Gerechnet wird über ganze Tage, nie über
Millisekunden – sonst stünde die Miete nach der Zeitumstellung am falschen Tag.

---

## Supabase einrichten

Ohne diesen Schritt läuft die App vollständig, aber nur auf dem Gerät: Alle
Bereiche funktionieren, nichts wird gesichert und nichts geteilt. Der
kostenlose Tarif von Supabase reicht aus.

**1. Projekt anlegen.** Auf [supabase.com](https://supabase.com) ein neues
Projekt erstellen. Als Region eine europäische wählen, das spart Laufzeit.

**2. Adressen eintragen und Schema einspielen.** In
[`supabase/schema.sql`](supabase/schema.sql) steht oben ein kurzer Block:

```sql
insert into public.erlaubte_personen (email, name)
values
  ('deine@adresse.de', 'Ich')
  -- , ('ihre@adresse.de', 'Freundin')
```

Dort eure beiden E-Mail-Adressen eintragen, dann den **gesamten** Inhalt der
Datei im *SQL Editor* des Projekts ausführen. Das legt die Tabellen an,
schaltet die Zugriffsregeln scharf und meldet die gemeinsamen Tabellen für
Live-Aktualisierung an. Das Skript ist wiederholbar – ein zweiter Durchlauf
schadet nicht.

**3. Zugangsdaten.** Sie stehen bereits in `src/lib/supabase.ts` und lassen
sich über `.env` oder die Einstellungen des Hosters überschreiben:

```ini
VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_…
```

**4. Eure beiden Konten anlegen.** *Authentication → Users → Add user → Create
new user*. E-Mail und ein Passwort eintragen, **Häkchen bei „Auto Confirm
User“**. Einmal für dich, einmal für deine Freundin – dieselben Adressen wie in
Schritt 2.

Das Häkchen ist der Punkt, an dem die E-Mail vollständig aus dem Spiel geht:
Das Konto gilt sofort als bestätigt, es wird nichts verschickt und auf nichts
gewartet.

**5. Neuanmeldungen abschalten.** *Authentication → Providers → Email →
„Allow new users to sign up“* **aus**.

Danach existieren genau die zwei Konten, die du angelegt hast. Das ist kein
Beiwerk: Der Schlüssel der App steht öffentlich im Repository, also könnte
sonst jeder mit der Adresse der App ein Konto anlegen. An eure Daten käme er
nicht – dafür sorgt die Zugangsliste –, aber gar nicht erst hineinzukommen ist
sauberer.

**6. Fertig.** In der App auf das Zahnrad → *Konto*, E-Mail und Passwort
eintragen, *Anmelden*. Ab da ist alles gesichert und gemeinsam.

**7. Nachsehen, ob es trägt.** Im selben Blatt ganz unten: *Es kommt nichts
an? → Verbindung prüfen*:

| Punkt | was er beantwortet |
| --- | --- |
| Zugangsdaten | Sind Adresse und Schlüssel hinterlegt? |
| Server erreichbar | Antwortet das Projekt überhaupt? |
| Angemeldet | Gilt die Sitzung? |
| Tabellen | Ist `schema.sql` eingespielt? |
| Freigeschaltet | Steht diese Adresse auf der Zugangsliste? |
| Geteilte Daten | Wie viele Einträge liegen auf dem Server? |

Der weitaus häufigste Grund, wenn nichts ankommt: Schritt 2 wurde übersprungen
oder nur zur Hälfte markiert. Die Prüfung sagt das dann ausdrücklich, statt
pauschal „kein Kontakt zum Server“ zu behaupten – der Kontakt steht ja.

---

## Wer mitliest

Die Zugangsliste ist die gesamte Zugriffskontrolle, und sie ist kein Beiwerk:
Der Schlüssel der App ist **öffentlich**. Er steckt in jedem fertigen Bündel im
Klartext, das ist bei einem publishable key so vorgesehen. Ohne die Liste
könnte sich jeder, der die Adresse der App kennt, ein Konto anlegen und stünde
in derselben Einkaufsliste.

Verglichen wird die E-Mail-Adresse, nicht die Benutzerkennung: Die Adresse
kennt man vorher, die Kennung entsteht erst beim ersten Anmelden. Nur so lässt
sich jemand im Voraus freischalten.

Nach dem ersten Einspielen geht es ohne SQL: *Zahnrad → Konto → Wer mitliest*.
Dort steht, wer dabei ist; eine Adresse dazunehmen kostet zwei Felder. Wer neu
dazukommt, meldet sich mit genau dieser Adresse an und sieht sofort alles –
kein Code, kein Beitreten.

Sich selbst herauswerfen kann niemand. Sonst sperrte man sich mit einem
Fehlgriff dauerhaft aus, und niemand käme mehr hinein, um es zurückzunehmen.

Wer nicht freigeschaltet ist, kann die App trotzdem benutzen: Seine Buchungen,
Spartöpfe und Challenges werden gesichert, nur die gemeinsame Liste bleibt ihm
verborgen. Die App sagt ihm das auch – siehe unten.

> **Zu den Schlüsseln:** Supabase zeigt zwei. Der **publishable**
> (`sb_publishable_…`) gehört in die App – er ist für den Browser gemacht und
> darf öffentlich sein; was schützt, sind die Zugriffsregeln aus Schritt 2. Der
> **secret** (`sb_secret_…`) umgeht *sämtliche* Regeln; wer ihn hat, liest und
> ändert alles. Er darf niemals in die App, ins Repository, in eine Nachricht
> oder in die Einstellungen des Hosters. Ist er versehentlich irgendwo
> gelandet: in Supabase unter *Project Settings → API Keys* widerrufen und neu
> erzeugen. Der Bau bricht ab, wenn er ihn im Bündel findet.

---

## Anmelden mit Passwort

E-Mail und Passwort, sonst nichts. Beim Anmelden ist **keine E-Mail im Spiel** –
kein Link, kein Code, kein Warten auf Post.

Das ist bewusst der langweilige Weg. Vorher lief die Anmeldung über einen Code
aus einer Mail, und daran ist sie gescheitert:

- Der eingebaute Mailversand von Supabase ist auf wenige Nachrichten je Stunde
  gedrosselt und wird häufig blockiert.
- Ein Code gilt 60 Minuten. Kommt die Mail verspätet, ist er beim Eintippen tot.
- Mails landen im Spam, und auf dem Telefon sieht man das oft gar nicht.
- Ob überhaupt ein Code in der Mail steht, hängt an einer Vorlage im Dashboard.
  Standardmäßig steht dort nur ein Link – und **der** funktioniert in einer vom
  Homescreen gestarteten Web-App nicht: Sie hat auf dem iPhone ihren eigenen
  Speicher, der Link öffnet aber Safari. Die Anmeldung landet dort und kommt in
  der App nie an.

Ein Passwort hat keine dieser Eigenschaften. Es steht nach dem ersten Mal im
Schlüsselbund des Telefons und wird von da an eingesetzt, ohne dass jemand
etwas tippt.

**Passwort vergessen?** Es gibt keinen Zurücksetzen-Weg per Mail, weil es
keinen Mailversand gibt. Stattdessen in Supabase unter *Authentication → Users*
die Person anklicken und ein neues Passwort setzen. Zehn Sekunden, und du bist
ohnehin der Einzige mit Zugang zum Projekt.

---

## Warum es kein „Konto anlegen“ in der App gibt

Es wäre ein Feld mehr, und es wäre falsch.

Die Zugangsliste entscheidet anhand der **E-Mail-Adresse**, wer die gemeinsame
Einkaufsliste sieht. Das trägt nur, solange jemand seine Adresse auch wirklich
besitzt – genau das prüft sonst die Bestätigungsmail.

Böte die App ein Konto ohne Bestätigung an, könnte sich jemand mit *deiner*
Adresse registrieren und stünde damit auf der Zugangsliste. Die Anmeldung wäre
bequemer und die Zugangskontrolle wertlos.

Zwei Konten von Hand anzulegen ist ein einmaliger Handgriff. Dass sie euch
gehören, weißt du dann, weil du sie selbst angelegt hast.

---

## Wenn nichts ankommt, sagt die App es

Eine Sperre, die aussieht wie eine leere Liste, ist schlimmer als eine
Fehlermeldung. Genau das droht hier: Die Zugriffsregeln antworten einer nicht
freigeschalteten Person nicht mit einem Fehler, sondern mit **null Zeilen** –
und eine leere Einkaufsliste sieht aus wie eine leere Einkaufsliste.

Deshalb fragt die App nach jeder Anmeldung ausdrücklich nach, ob diese Adresse
freigeschaltet ist, und zeigt das Ergebnis an drei Stellen: als Kennzeichen im
Konto-Blatt, als Hinweis über der Einkaufsliste und als Einstieg auf der
Startseite. Der einzige Fehlerfall, den man sonst nicht bemerkt hätte, ist so
der sichtbarste.

---

## Unter eigener Adresse veröffentlichen

Zum Teilen braucht die App eine Adresse, die beide erreichen. Die Konfiguration
liegt bereit – für **Netlify** (`netlify.toml`) und für **Vercel**
(`vercel.json`). Beide sind kostenlos; Netlify ist etwas geradliniger.

**1. Verbinden.** Bei [netlify.com](https://netlify.com) anmelden, *Add new site
→ Import an existing project*, das GitHub-Repository auswählen. Build-Befehl und
Ausgabeordner liest Netlify aus `netlify.toml`; du musst dort nichts eintragen.

**2. Zugangsdaten hinterlegen.** Unter *Site configuration → Environment
variables* zwei Einträge anlegen:

| Name | Wert |
| --- | --- |
| `VITE_SUPABASE_URL` | die Projekt-URL aus Supabase |
| `VITE_SUPABASE_ANON_KEY` | der **publishable** Schlüssel |

Ohne sie baut die App zwar, läuft aber rein lokal – das Teilen fehlt dann.

**3. Veröffentlichen.** *Deploy site*. Nach etwa einer Minute steht eine Adresse
wie `dein-name.netlify.app` bereit; eine eigene Domain lässt sich später
anhängen.

**4. Auf dem Telefon einrichten.** Adresse im Browser öffnen, dann *Teilen → Zum
Home-Bildschirm* (iPhone) bzw. *Zum Startbildschirm hinzufügen* (Android).
Danach läuft die App im Vollbild und offline.

Jeder weitere Push auf den Branch veröffentlicht automatisch neu.

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
npm test           # 227 Tests
npm run typecheck
npm run build      # Produktionsbündel nach dist/
npm run build:single  # alles in einer HTML-Datei, nach dist-single/
```

`build:single` packt CSS und JavaScript in eine einzige Seite. Zum Herzeigen
genügt dann eine Datei – doppelklicken, fertig, ohne Server und ohne
Installation. Für den täglichen Gebrauch ist das nicht der Weg: Eine einzelne
Datei bekommt keine Aktualisierungen.

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
    types.ts        Datenmodell – hier steht, was privat und was gemeinsam ist
    aisles.ts       Abteilungen, Warnfristen, Zuordnung aus dem Namen
    shopping.ts     Gruppierung und gelernte Ladenreihenfolge
    pantry.ts       Ablauf-Ampel, Nachkaufen-Vorschläge
    finance.ts      Monatssummen, Kategorien, Budgets, Spartöpfe
    challenges.ts   Challenge-Engine, Vorlagen, Fortschritt
    quantity.ts     Menge und Name trennen, zusammenzählen, hoch- und runterzählen
    recurring.ts    Fällige Termine wiederkehrender Buchungen
    diagnose.ts     Verbindungsprüfung: was fehlt und was zu tun ist
    sync.ts         Übersetzung Datenbank ↔ App, Hoch- und Runterladen, Zugangsliste
    useApp.tsx      Zustand, Anmeldung und Abgleich als Kontext
  views/            Ein Bereich je Datei
  components/       Wiederverwendbare Bausteine
supabase/
  schema.sql        Tabellen, Zugriffsregeln, Zugangsliste
  pruefung/         Schema gegen ein echtes Postgres fahren (siehe dortige README)
```

Die Rechenlogik liegt vollständig in `lib/` und ist ohne Oberfläche testbar –
alle 227 Tests laufen ohne Browser. Was in den Views steht, ist Darstellung.

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

Deine Daten liegen auf deinem Gerät und auf deinem eigenen Supabase-Projekt –
sonst nirgends. Es gibt keine Auswertung, keine
Werbekennungen und keine Verbindungen zu Dritten; der Service Worker lässt
Anfragen an den Server bewusst am Zwischenspeicher vorbei, damit nie Bestände
von gestern angezeigt werden.
