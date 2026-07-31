# Das Schema gegen ein echtes Postgres prüfen

`schema.sql` lässt sich nicht durch Hinsehen prüfen. Zwei Fehler darin sind
genau so entstanden und wären sonst erst beim Einspielen aufgefallen – im
schlimmsten Fall mittendrin, mit halb umgestellter Datenbank:

- `drop column household_id` scheiterte, weil die alten Zugriffsregeln an der
  Spalte hingen (`cascade` fehlte).
- `drop table households` scheiterte, weil `create_household()` diese Tabelle
  als Rückgabetyp hat – die Funktionen mussten zuerst weg.

Deshalb liegen hier drei Skripte. Sie brauchen kein Supabase, nur ein Postgres.

| Datei | wofür |
| --- | --- |
| `00-supabase-nachbau.sql` | Das Wenige, das `schema.sql` voraussetzt: `auth.users`, `auth.uid()`, `auth.jwt()`, die Rollen `anon`/`authenticated`, die Realtime-Publikation |
| `01-zugriffsregeln.sql` | Wer sieht was: zwei Freigeschaltete, ein Fremder – und dass jeder nur seine eigenen Buchungen sieht |
| `02-zugangsliste.sql` | Die Zugangsliste selbst: dazunehmen, berichtigen, sich nicht selbst aussperren, und dass ein Fremder sich nicht einträgt |

## Durchlauf

```sh
# Cluster anlegen und starten (als unprivilegierter Nutzer, nicht als root)
initdb -D /var/tmp/pgtest -U postgres --auth=trust
pg_ctl -D /var/tmp/pgtest -o '-p 55432 -k /var/tmp' -l /var/tmp/pg.log start -w

P="psql -h /var/tmp -p 55432 -U postgres -v ON_ERROR_STOP=1 -q"

# 1. Frische Datenbank
$P -c 'create database neu'
$P -d neu -f supabase/pruefung/00-supabase-nachbau.sql
$P -d neu -f supabase/schema.sql

# 2. Wiederholbar? Zweiter Durchlauf muss ebenso fehlerfrei sein.
$P -d neu -f supabase/schema.sql

# 3. Zugriffsregeln
$P -d neu -f supabase/pruefung/01-zugriffsregeln.sql
$P -d neu -f supabase/pruefung/02-zugangsliste.sql
```

Erwartet: kein `ERROR` außer den beiden, die im Skript 02 ausdrücklich
provoziert werden – dort *muss* die Datenbank ablehnen.

## Umstieg von einer älteren Fassung

Wer schon eine Haushalts-Fassung eingespielt hat, prüft zusätzlich den Weg
dorthin. Die alte Datei liegt in der Versionsgeschichte:

```sh
git show 8344bd7:supabase/schema.sql > /var/tmp/alt.sql
$P -c 'create database umstieg'
$P -d umstieg -f supabase/pruefung/00-supabase-nachbau.sql
$P -d umstieg -f /var/tmp/alt.sql
# … ein paar Datensätze anlegen …
$P -d umstieg -f supabase/schema.sql
```

Danach müssen die Einträge noch da sein, `household_id` überall weg, die
Haushaltstabellen und -funktionen gelöscht.

## Grenzen

Der Nachbau ist bewusst dünn. Er bildet **nicht** ab: die echte Ausstellung der
JWTs, die Rechtevergabe von PostgREST, Realtime über den Draht. Er beantwortet
nur die Frage, die er beantworten soll – läuft das Skript durch, und lassen die
Zugriffsregeln das durch, was sie durchlassen sollen.
