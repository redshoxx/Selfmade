-- ============================================================================
--  Selfmade – Datenbankschema
--
--  Einmal im SQL-Editor des Supabase-Projekts ausführen. Das Skript ist
--  wiederholbar: Es legt nur an, was noch fehlt, und räumt Älteres auf.
--
--  Der Aufbau folgt einer Regel: Geld gehört einer Person, Einkauf und Vorrat
--  gehören allen, die freigeschaltet sind. Wer zusammen einkauft, muss dafür
--  nicht sein Gehalt zeigen.
--
--  Es gibt keine Haushalte, keine Einladungscodes und nichts einzurichten.
--  Wer sich anmeldet und in `erlaubte_personen` steht, sieht dieselbe
--  Einkaufsliste und denselben Vorrat – sofort.
--
--  Dieses Skript ist nur die eine Hälfte. Die andere sind zwei Handgriffe im
--  Dashboard, ohne die niemand hereinkommt:
--
--    1. Authentication → Users → Add user → Create new user, mit Häkchen bei
--       „Auto Confirm User“ – je einmal für euch beide, mit **genau den**
--       Adressen, die unten in `erlaubte_personen` stehen.
--    2. Authentication → Providers → Email → „Allow new users to sign up“ aus.
--
--  Angemeldet wird mit E-Mail und Passwort. Es wird keine Mail verschickt und
--  auf keine gewartet.
--
--  Zeitstempel liegen als bigint in Millisekunden vor – dieselbe Einheit wie
--  im Browser. Beim Abgleich gewinnt der jüngere Stand, und dieser Vergleich
--  soll nicht an einer Umrechnung zwischen zwei Zeitformaten scheitern.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Wer mitlesen darf
--
--  Diese Tabelle ist die eigentliche Zugangskontrolle. Sie ist nötig, weil der
--  Schlüssel der App öffentlich ist – er steckt in jedem fertigen Bündel im
--  Klartext, das ist bei einem publishable key so vorgesehen. Ohne diese Liste
--  stünde jeder, der ein Konto hat, in derselben Einkaufsliste.
--
--  Der Vergleich läuft über die E-Mail-Adresse und nicht über die
--  Benutzerkennung: Die Adresse kennt man, die Kennung entsteht erst beim
--  Anlegen des Kontos. Sonst könnte man niemanden im Voraus freischalten.
--
--  Groß- und Kleinschreibung ist gleichgültig, beide Seiten werden
--  kleingeschrieben verglichen. Ein *anderer* Adressteil ist es nicht: Steht
--  hier eine Adresse, zu der es kein Konto gibt, kommt diese Person nirgends
--  hinein – und umgekehrt sieht ein Konto, das hier fehlt, zwar seine eigenen
--  Buchungen, aber nichts Gemeinsames. Die beiden Listen müssen sich decken.
-- ---------------------------------------------------------------------------

create table if not exists public.erlaubte_personen (
  email           text primary key,
  name            text not null default '',
  hinzugefuegt_am timestamptz not null default now()
);

-- ▼▼▼ HIER EURE BEIDEN ADRESSEN EINTRAGEN ▼▼▼
--
--  Dieselben Adressen, mit denen ihr die Konten unter Authentication → Users
--  anlegt. Ohne diesen Schritt kommt niemand an die gemeinsamen Daten – die
--  eigenen Buchungen kann trotzdem jeder führen.
--
--  Die Adressen stehen bewusst nicht schon hier: Diese Datei liegt im
--  Repository, und eine private E-Mail-Adresse gehört nicht dorthin, nur weil
--  es bequemer wäre. Sie stehen nach dem Ausführen ausschließlich in eurer
--  eigenen Datenbank.
--
--  Später geht es auch ohne SQL: in der App unter Zahnrad → Konto → „Wer
--  mitliest“. Einmal muss es aber hier sein, sonst gibt es niemanden, der
--  jemanden freischalten dürfte.

insert into public.erlaubte_personen (email, name)
values
  ('djmctweets@gmail.com', 'Ich'),
  ('wolfgangdilena1996@gmail.com', 'Freundin')
on conflict (email) do nothing;

-- ▲▲▲ ------------------------------------- ▲▲▲

/*
 * Darf die anfragende Person mit?
 *
 * `security definer` umgeht die Zugriffsregeln *innerhalb* der Funktion. Ohne
 * das riefe eine Richtlinie auf `erlaubte_personen`, die zur Prüfung wieder
 * `erlaubte_personen` abfragt, sich selbst auf – Postgres bricht das mit
 * „infinite recursion detected in policy" ab.
 *
 * `search_path` wird fest verdrahtet: Ohne das könnte eine eigene Tabelle im
 * Suchpfad des Aufrufers die hier gemeinte ersetzen.
 */
create or replace function public.ist_erlaubt()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.erlaubte_personen p
    where lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.ist_erlaubt() from public;
grant execute on function public.ist_erlaubt() to authenticated;

-- ---------------------------------------------------------------------------
--  Geteilt: Einkaufsliste, Vorrat, Notizen, Vorlagen, Ladenreihenfolge
-- ---------------------------------------------------------------------------

create table if not exists public.shop_items (
  id         uuid primary key,
  name       text not null,
  qty        text not null default '',
  aisle      text not null default 'sonstiges',
  done       boolean not null default false,
  added_by   text not null default '',
  pantry_id  uuid,
  note       text not null default '',
  price_cents bigint,
  updated_at bigint not null,
  deleted_at bigint
);

create index if not exists shop_items_updated_idx on public.shop_items (updated_at);

create table if not exists public.pantry_items (
  id          uuid primary key,
  name        text not null,
  aisle       text not null default 'sonstiges',
  qty         numeric not null default 0,
  unit        text not null default 'Stück',
  min_qty     numeric not null default 0,
  best_before date,
  note        text not null default '',
  updated_at  bigint not null,
  deleted_at  bigint
);

create index if not exists pantry_items_updated_idx on public.pantry_items (updated_at);

-- Die gelernte Reihenfolge der Abteilungen gilt für alle: Wer gemeinsam
-- einkauft, geht durch denselben Laden.
create table if not exists public.aisle_order (
  aisle      text primary key,
  rank       double precision not null,
  updated_at bigint not null
);

-- Notizzettel – für alles, was keine Einkaufsliste ist.
create table if not exists public.notes (
  id         uuid primary key,
  title      text not null default '',
  body       text not null default '',
  pinned     boolean not null default false,
  updated_at bigint not null,
  deleted_at bigint
);

create index if not exists notes_updated_idx on public.notes (updated_at);

-- Einkaufs-Vorlagen. Die Einträge liegen als JSON in einer Spalte: Sie werden
-- immer vollständig gelesen und geschrieben, nie einzeln abgefragt – eine
-- eigene Tabelle mit Fremdschlüssel brächte hier nur Verwaltungsaufwand.
create table if not exists public.shop_templates (
  id         uuid primary key,
  name       text not null,
  emoji      text not null default '🛒',
  items      jsonb not null default '[]'::jsonb,
  updated_at bigint not null,
  deleted_at bigint
);

-- ---------------------------------------------------------------------------
--  Privat: Buchungen, Spartöpfe, Challenges
-- ---------------------------------------------------------------------------

create table if not exists public.txs (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('einnahme', 'ausgabe')),
  -- Beträge als ganze Cent. numeric/float wäre hier der Anfang von Summen,
  -- die um einen Cent danebenliegen.
  cents       bigint not null check (cents >= 0),
  category_id text not null,
  note        text not null default '',
  date        date not null,
  recurring   boolean not null default false,
  updated_at  bigint not null,
  deleted_at  bigint
);

create index if not exists txs_user_idx on public.txs (user_id, date desc);

create table if not exists public.pots (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  emoji        text not null default '🎯',
  target_cents bigint check (target_cents is null or target_cents >= 0),
  target_date  date,
  updated_at   bigint not null,
  deleted_at   bigint
);

create index if not exists pots_user_idx on public.pots (user_id);

create table if not exists public.pot_entries (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  pot_id       uuid not null,
  -- Darf negativ sein: Entnahmen aus dem Topf.
  cents        bigint not null,
  date         date not null,
  note         text not null default '',
  challenge_id uuid,
  slot         integer,
  updated_at   bigint not null,
  deleted_at   bigint
);

create index if not exists pot_entries_user_idx on public.pot_entries (user_id, pot_id);

create table if not exists public.challenges (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  kind       text not null check (kind in ('steigend', 'gleich', 'frei')),
  step_cents bigint not null check (step_cents > 0),
  slots      integer not null check (slots > 0 and slots <= 400),
  unit       text not null check (unit in ('tag', 'woche', 'monat')),
  start_date date not null,
  pot_id     uuid,
  filled     integer[] not null default '{}',
  archived   boolean not null default false,
  updated_at bigint not null,
  deleted_at bigint
);

create index if not exists challenges_user_idx on public.challenges (user_id);

-- Regeln für wiederkehrende Buchungen. Die Regel selbst ist keine Buchung –
-- sie merkt sich in `last_run`, bis wohin schon gebucht wurde.
create table if not exists public.recurring_txs (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('einnahme', 'ausgabe')),
  cents        bigint not null check (cents > 0),
  category_id  text not null,
  note         text not null default '',
  unit         text not null check (unit in ('woche', 'monat', 'jahr')),
  anchor_day   integer not null default 1 check (anchor_day between 0 and 31),
  anchor_month integer check (anchor_month is null or anchor_month between 1 and 12),
  start_date   date not null,
  last_run     date,
  active       boolean not null default true,
  updated_at   bigint not null,
  deleted_at   bigint
);

create index if not exists recurring_txs_user_idx on public.recurring_txs (user_id);

-- Kategorien und persönliche Einstellungen, eine Zeile je Konto.
--
-- Anders als Buchungen sind Kategorien keine Sammlung einzelner Datensätze,
-- sondern ein Ganzes: Wer eine umbenennt, ändert die Liste. Deshalb liegen sie
-- als JSON in einer Spalte mit einem Zeitstempel für das Ganze. Ohne diese
-- Tabelle stünde auf einem zweiten Gerät bei jeder Buchung „Ohne Kategorie“ –
-- die Buchungen kämen an, die Kategorien, auf die sie zeigen, nicht.
create table if not exists public.user_prefs (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  categories jsonb not null default '[]'::jsonb,
  settings   jsonb not null default '{}'::jsonb,
  updated_at bigint not null
);

-- ---------------------------------------------------------------------------
--  Umstellung von der Haushalts-Fassung
--
--  Wer ein älteres Schema eingespielt hat, hat `household_id`-Spalten und zwei
--  Haushaltstabellen. Beides fällt weg; die Daten bleiben und gehören danach
--  allen Freigeschalteten. Der Block ist harmlos, wenn es nichts davon gibt.
-- ---------------------------------------------------------------------------

--  `cascade` ist hier nicht Bequemlichkeit, sondern nötig: An der Spalte hängen
--  die alten Zugriffsregeln (`using (is_household_member(household_id))`).
--  Ohne `cascade` bricht das Skript mit „cannot drop column … because other
--  objects depend on it“ ab – und zwar mittendrin, sodass die Datenbank halb
--  umgestellt zurückbleibt. Was mitfällt, sind ausschließlich jene Regeln und
--  Indizes; beide legt dieses Skript weiter unten neu an.
do $$
declare
  t text;
begin
  foreach t in array array['shop_items', 'pantry_items', 'notes', 'shop_templates'] loop
    execute format('alter table public.%I drop column if exists household_id cascade', t);
  end loop;
end;
$$;

-- Die Ladenreihenfolge hing am Haushalt und hatte einen zusammengesetzten
-- Schlüssel. Eine Umformung wäre aufwendiger als der Neuaufbau: Die Werte
-- lernt die App beim nächsten Einkauf von selbst wieder.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aisle_order' and column_name = 'household_id'
  ) then
    drop table public.aisle_order;
    create table public.aisle_order (
      aisle      text primary key,
      rank       double precision not null,
      updated_at bigint not null
    );
  end if;
end;
$$;

-- Erst die Funktionen, dann die Tabellen: `create_household` und
-- `join_household` geben `public.households` zurück und hängen damit am
-- Tabellentyp. Andersherum bricht das Skript mit „cannot drop table households
-- because other objects depend on it“ ab.
drop function if exists public.create_household(text, text, text);
drop function if exists public.join_household(text, text);

drop table if exists public.household_members;
drop table if exists public.households;

-- Zum Schluss, weil die alten Zugriffsregeln sie benutzten – die sind mit den
-- Spalten und Tabellen oben schon weg.
drop function if exists public.is_household_member(uuid);

-- Nachträglich ergänzte Spalten, damit ein bereits eingespieltes Schema
-- mitwächst, ohne dass jemand seine Daten neu anlegen muss.
alter table public.shop_items   add column if not exists note text not null default '';
alter table public.shop_items   add column if not exists price_cents bigint;
alter table public.pantry_items add column if not exists note text not null default '';

-- ---------------------------------------------------------------------------
--  Zeilenschutz
--
--  Ohne diese Richtlinien wäre jede Tabelle für jeden angemeldeten Nutzer
--  lesbar. Sie sind kein Beiwerk, sondern die eigentliche Zugriffskontrolle.
-- ---------------------------------------------------------------------------

alter table public.erlaubte_personen enable row level security;
alter table public.shop_items        enable row level security;
alter table public.pantry_items      enable row level security;
alter table public.aisle_order       enable row level security;
alter table public.notes             enable row level security;
alter table public.shop_templates    enable row level security;
alter table public.txs               enable row level security;
alter table public.pots              enable row level security;
alter table public.pot_entries       enable row level security;
alter table public.challenges        enable row level security;
alter table public.recurring_txs     enable row level security;
alter table public.user_prefs        enable row level security;

-- Geteilte Tabellen: alles für Freigeschaltete, nichts für alle anderen.
do $$
declare
  t text;
begin
  foreach t in array array['shop_items', 'pantry_items', 'aisle_order', 'notes', 'shop_templates'] loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format(
      'create policy %I_all on public.%I for all to authenticated
         using (public.ist_erlaubt())
         with check (public.ist_erlaubt())',
      t, t
    );
  end loop;
end;
$$;

-- Private Tabellen: ausschließlich die eigenen Zeilen, unabhängig von der
-- Freischaltung. Wer nicht mitliest, kann trotzdem seine Ausgaben führen.
do $$
declare
  t text;
begin
  foreach t in array array['txs', 'pots', 'pot_entries', 'challenges', 'recurring_txs', 'user_prefs'] loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format(
      'create policy %I_all on public.%I for all to authenticated
         using (user_id = auth.uid())
         with check (user_id = auth.uid())',
      t, t
    );
  end loop;
end;
$$;

-- Die Zugangsliste selbst: Wer drinsteht, sieht sie und darf jemanden
-- dazunehmen. Sich selbst herauswerfen kann niemand – sonst sperrte man sich
-- mit einem Fehlgriff dauerhaft aus, und niemand käme mehr hinein, um es
-- zurückzunehmen.
drop policy if exists erlaubte_select on public.erlaubte_personen;
create policy erlaubte_select on public.erlaubte_personen
  for select to authenticated
  using (public.ist_erlaubt());

drop policy if exists erlaubte_insert on public.erlaubte_personen;
create policy erlaubte_insert on public.erlaubte_personen
  for insert to authenticated
  with check (public.ist_erlaubt());

-- Ändern gehört dazu, auch wenn die App keine Schaltfläche dafür hat: Sie
-- schreibt mit `upsert`, und das ist ein „insert … on conflict do update“.
-- Steht die Adresse schon auf der Liste – etwa weil man den Namen berichtigen
-- will –, greift der zweite Teil. Ohne diese Richtlinie schlüge genau das mit
-- einer Rechtemeldung fehl, und zwar nur beim zweiten Mal.
drop policy if exists erlaubte_update on public.erlaubte_personen;
create policy erlaubte_update on public.erlaubte_personen
  for update to authenticated
  using (public.ist_erlaubt())
  with check (public.ist_erlaubt());

drop policy if exists erlaubte_delete on public.erlaubte_personen;
create policy erlaubte_delete on public.erlaubte_personen
  for delete to authenticated
  using (
    public.ist_erlaubt()
    and lower(email) <> lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- ---------------------------------------------------------------------------
--  Live-Aktualisierung
--
--  Damit erscheint ein Häkchen der einen Person binnen Sekunden auf dem Gerät
--  der anderen – ohne dass jemand die Seite neu lädt.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['shop_items', 'pantry_items', 'notes', 'shop_templates'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
--  Abschluss: was jetzt dasteht
--
--  Der SQL-Editor zeigt das Ergebnis der letzten Abfrage. Diese hier ist
--  deshalb eine Quittung: Wer die Adressen im Block oben zu ändern vergessen
--  hat, sieht hier „deine@adresse.de“ stehen und weiß es sofort – statt sich
--  später zu fragen, warum die App nichts hergibt.
--
--  Zur Erinnerung: Zu jeder dieser Adressen muss unter Authentication → Users
--  ein Konto mit „Auto Confirm User“ existieren. Diese Liste allein genügt
--  nicht, das Konto allein auch nicht.
-- ---------------------------------------------------------------------------

select
  email as "darf mitlesen",
  name as "angezeigt als",
  case
    when email in ('djmctweets@gmail.com', 'wolfgangdilena1996@gmail.com')
      then '⚠ Platzhalter – oben im Skript ersetzen und noch einmal ausführen'
    else '✓ eingetragen'
  end as "Stand"
from public.erlaubte_personen
order by email;
