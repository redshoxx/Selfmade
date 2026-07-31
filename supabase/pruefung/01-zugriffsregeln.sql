-- Die Zugriffsregeln unter echten Rollen: Was sieht wer wirklich?
\set ON_ERROR_STOP on
\pset pager off

-- Ausgangslage: zwei Konten, eines davon nicht freigeschaltet.
delete from public.erlaubte_personen;
insert into public.erlaubte_personen (email, name) values
  ('er@example.com', 'Wolfgang'),
  ('sie@example.com', 'Freundin');

delete from auth.users;
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'er@example.com'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sie@example.com'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'fremd@example.com');

delete from public.shop_items;
insert into public.shop_items (id, name, qty, aisle, done, added_by, updated_at)
values ('33333333-3333-4333-8333-333333333333', 'Butter', '1', 'kuehl', false, 'Wolfgang', 1000);

delete from public.txs;
insert into public.txs (id, user_id, kind, cents, category_id, date, updated_at) values
  ('44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ausgabe', 1250, 'c', '2026-07-31', 1000),
  ('55555555-5555-4555-8555-555555555555', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'ausgabe',  999, 'c', '2026-07-31', 1000);

\echo '--- ER (freigeschaltet) ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"er@example.com"}';
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select public.ist_erlaubt() as darf_mitlesen,
       (select count(*) from public.shop_items) as sieht_einkauf,
       (select count(*) from public.txs) as sieht_buchungen;
commit;

\echo '--- SIE (freigeschaltet, andere Buchungen) ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","email":"sie@example.com"}';
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select public.ist_erlaubt() as darf_mitlesen,
       (select count(*) from public.shop_items) as sieht_einkauf,
       (select count(*) from public.txs) as sieht_buchungen;
commit;

\echo '--- FREMD (Konto ja, Freischaltung nein) ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","email":"fremd@example.com"}';
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select public.ist_erlaubt() as darf_mitlesen,
       (select count(*) from public.shop_items) as sieht_einkauf,
       (select count(*) from public.txs) as sieht_buchungen,
       (select count(*) from public.erlaubte_personen) as sieht_zugangsliste;
commit;

\echo '--- Groß-/Kleinschreibung ist gleichgültig ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"ER@Example.COM"}';
select public.ist_erlaubt() as darf_mitlesen;
commit;
