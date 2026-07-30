-- ============================================================================
--  Selfmade – Datenbankschema
--
--  Einmal im SQL-Editor des Supabase-Projekts ausführen. Das Skript ist
--  wiederholbar: Es legt nur an, was noch fehlt.
--
--  Der Aufbau folgt einer Regel: Geld ist privat, Einkauf und Vorrat gehören
--  dem Haushalt. Wer zusammen einkauft, muss dafür nicht sein Gehalt zeigen.
--
--  Zeitstempel liegen als bigint in Millisekunden vor – dieselbe Einheit wie
--  im Browser. Beim Abgleich gewinnt der jüngere Stand, und dieser Vergleich
--  soll nicht an einer Umrechnung zwischen zwei Zeitformaten scheitern.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Haushalte
-- ---------------------------------------------------------------------------

create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Haushalt',
  invite_code text not null unique,
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null default 'Ich',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_idx on public.household_members (user_id);

-- ---------------------------------------------------------------------------
--  Zugehörigkeit prüfen
--
--  Diese Funktion ist der Schlüssel zum ganzen Regelwerk. Eine Richtlinie auf
--  `household_members`, die zur Prüfung wieder `household_members` abfragt,
--  ruft sich selbst auf – Postgres bricht das mit „infinite recursion detected
--  in policy" ab. `security definer` umgeht die Prüfung *innerhalb* der
--  Funktion und beendet die Schleife.
--
--  `search_path` wird fest verdrahtet: Ohne das könnte eine eigene Tabelle im
--  Suchpfad des Aufrufers die hier gemeinte ersetzen.
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = hid
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
--  Geteilt: Einkaufsliste, Vorrat, Ladenreihenfolge
-- ---------------------------------------------------------------------------

create table if not exists public.shop_items (
  id           uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  qty          text not null default '',
  aisle        text not null default 'sonstiges',
  done         boolean not null default false,
  added_by     text not null default '',
  pantry_id    uuid,
  updated_at   bigint not null,
  deleted_at   bigint
);

create index if not exists shop_items_household_idx on public.shop_items (household_id, updated_at);

create table if not exists public.pantry_items (
  id           uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  aisle        text not null default 'sonstiges',
  qty          numeric not null default 0,
  unit         text not null default 'Stück',
  min_qty      numeric not null default 0,
  best_before  date,
  updated_at   bigint not null,
  deleted_at   bigint
);

create index if not exists pantry_items_household_idx on public.pantry_items (household_id, updated_at);

-- Die gelernte Reihenfolge der Abteilungen gilt für den Haushalt: Wer
-- gemeinsam einkauft, geht durch denselben Laden.
create table if not exists public.aisle_order (
  household_id uuid not null references public.households (id) on delete cascade,
  aisle        text not null,
  rank         double precision not null,
  updated_at   bigint not null,
  primary key (household_id, aisle)
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

-- ---------------------------------------------------------------------------
--  Zeilenschutz
--
--  Ohne diese Richtlinien wäre jede Tabelle für jeden angemeldeten Nutzer
--  lesbar. Sie sind kein Beiwerk, sondern die eigentliche Zugriffskontrolle.
-- ---------------------------------------------------------------------------

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.shop_items        enable row level security;
alter table public.pantry_items      enable row level security;
alter table public.aisle_order       enable row level security;
alter table public.txs               enable row level security;
alter table public.pots              enable row level security;
alter table public.pot_entries       enable row level security;
alter table public.challenges        enable row level security;

-- Haushalte: sichtbar für Mitglieder, anlegen darf jeder für sich selbst.
drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

drop policy if exists households_insert on public.households;
create policy households_insert on public.households
  for insert to authenticated
  with check (created_by = auth.uid());

-- Umbenennen darf jedes Mitglied; es ist ja der gemeinsame Haushalt.
drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

-- Auflösen darf nur, wer ihn angelegt hat.
drop policy if exists households_delete on public.households;
create policy households_delete on public.households
  for delete to authenticated
  using (created_by = auth.uid());

-- Mitglieder: Wer dazugehört, sieht die anderen.
drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

-- Eintragen kann man nur sich selbst – und nur in einen Haushalt, in dem man
-- schon ist. Der Beitritt über den Einladungscode läuft über join_household().
drop policy if exists members_insert on public.household_members;
create policy members_insert on public.household_members
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists members_update on public.household_members;
create policy members_update on public.household_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Austreten darf jeder für sich.
drop policy if exists members_delete on public.household_members;
create policy members_delete on public.household_members
  for delete to authenticated
  using (user_id = auth.uid());

-- Geteilte Tabellen: alles für Mitglieder des jeweiligen Haushalts.
do $$
declare
  t text;
begin
  foreach t in array array['shop_items', 'pantry_items', 'aisle_order'] loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format(
      'create policy %I_all on public.%I for all to authenticated
         using (public.is_household_member(household_id))
         with check (public.is_household_member(household_id))',
      t, t
    );
  end loop;
end;
$$;

-- Private Tabellen: ausschließlich die eigenen Zeilen.
do $$
declare
  t text;
begin
  foreach t in array array['txs', 'pots', 'pot_entries', 'challenges'] loop
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

-- ---------------------------------------------------------------------------
--  Haushalt anlegen und beitreten
--
--  Beides läuft über Funktionen statt über direkte Schreibzugriffe.
--
--  Beim Beitritt ist das zwingend: Wer den Einladungscode eintippt, ist noch
--  in keinem Haushalt und darf die Tabelle deshalb nicht lesen. Ohne diese
--  Funktion müsste man die Haushaltsliste für alle öffnen – und damit könnte
--  jeder Codes durchprobieren und Fremde in ihren Listen lesen.
-- ---------------------------------------------------------------------------

create or replace function public.create_household(household_name text, member_name text, code text)
returns public.households
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  fresh public.households;
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;

  insert into public.households (name, invite_code, created_by)
  values (coalesce(nullif(trim(household_name), ''), 'Haushalt'), upper(trim(code)), auth.uid())
  returning * into fresh;

  insert into public.household_members (household_id, user_id, name)
  values (fresh.id, auth.uid(), coalesce(nullif(trim(member_name), ''), 'Ich'));

  return fresh;
end;
$$;

create or replace function public.join_household(code text, member_name text)
returns public.households
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.households;
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;

  select * into target
  from public.households h
  where h.invite_code = upper(trim(code));

  if not found then
    raise exception 'Einladungscode nicht gefunden';
  end if;

  insert into public.household_members (household_id, user_id, name)
  values (target.id, auth.uid(), coalesce(nullif(trim(member_name), ''), 'Ich'))
  on conflict (household_id, user_id)
    do update set name = excluded.name;

  return target;
end;
$$;

revoke all on function public.create_household(text, text, text) from public;
revoke all on function public.join_household(text, text) from public;
grant execute on function public.create_household(text, text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;

-- ---------------------------------------------------------------------------
--  Live-Aktualisierung
--
--  Damit erscheint ein Häkchen der einen Person binnen Sekunden auf dem Gerät
--  der anderen – ohne dass jemand die Seite neu lädt.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'shop_items'
  ) then
    alter publication supabase_realtime add table public.shop_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'pantry_items'
  ) then
    alter publication supabase_realtime add table public.pantry_items;
  end if;
end;
$$;
