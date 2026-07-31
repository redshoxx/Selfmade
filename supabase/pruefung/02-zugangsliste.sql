\set ON_ERROR_STOP off
\pset pager off

\echo '--- 1. Freigeschalteter nimmt jemanden dazu ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"er@example.com"}';
insert into public.erlaubte_personen (email, name) values ('neu@example.com', 'Neu');
commit;
select count(*) filter (where email = 'neu@example.com') as neu_eingetragen from public.erlaubte_personen;

\echo '--- 2. Denselben noch einmal, mit anderem Namen (das ist ein upsert) ---'
\echo '    Vorher schlug genau das fehl: insert on conflict do update ohne UPDATE-Richtlinie.'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"er@example.com"}';
insert into public.erlaubte_personen (email, name) values ('neu@example.com', 'Berichtigt')
  on conflict (email) do update set name = excluded.name;
commit;
select name as name_nach_berichtigung from public.erlaubte_personen where email = 'neu@example.com';

\echo '--- 3. Ein Fremder versucht, sich selbst einzutragen ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","email":"fremd@example.com"}';
insert into public.erlaubte_personen (email, name) values ('fremd@example.com', 'Ich will rein');
rollback;
select count(*) filter (where email = 'fremd@example.com') as fremder_drin from public.erlaubte_personen;

\echo '--- 4. Ein Fremder versucht, jemanden zu überschreiben ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","email":"fremd@example.com"}';
update public.erlaubte_personen set email = 'fremd@example.com' where email = 'er@example.com';
rollback;
select count(*) filter (where email = 'er@example.com') as er_noch_da from public.erlaubte_personen;

\echo '--- 5. Sich selbst herauswerfen geht nicht ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"er@example.com"}';
delete from public.erlaubte_personen where email = 'er@example.com';
commit;
select count(*) filter (where email = 'er@example.com') as ich_noch_da from public.erlaubte_personen;

\echo '--- 6. Jemand anderen herauswerfen geht ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"er@example.com"}';
delete from public.erlaubte_personen where email = 'neu@example.com';
commit;
select count(*) filter (where email = 'neu@example.com') as neu_noch_da from public.erlaubte_personen;

\echo '--- 7. Ein Fremder schreibt auf die Einkaufsliste ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","email":"fremd@example.com"}';
insert into public.shop_items (id, name, qty, aisle, done, added_by, updated_at)
values ('99999999-9999-4999-8999-999999999999', 'Eingeschmuggelt', '1', 'kuehl', false, 'Fremd', 2000);
rollback;
select count(*) as eintraege_auf_der_liste from public.shop_items;
