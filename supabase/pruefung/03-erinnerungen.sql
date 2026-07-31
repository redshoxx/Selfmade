-- Die Gerätetabelle für Erinnerungen: Ein Gerät gehört genau einer Person.
\set ON_ERROR_STOP off
\pset pager off

delete from public.push_geraete;
delete from auth.users;
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'er@example.com'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sie@example.com');
insert into public.push_geraete (endpoint, user_id, p256dh, auth) values
  ('https://push.example/er', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'k1', 'a1'),
  ('https://push.example/sie', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'k2', 'a2');

\echo '--- 1. Jeder sieht nur seine eigenen Geräte ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"er@example.com"}';
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select count(*) as sichtbar from public.push_geraete;
commit;

\echo '--- 2. Fremde Geräte lassen sich nicht abmelden ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"er@example.com"}';
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
delete from public.push_geraete where endpoint = 'https://push.example/sie';
commit;
select count(*) as ihres_noch_da from public.push_geraete where endpoint = 'https://push.example/sie';

\echo '--- 3. Kein Gerät auf fremden Namen (muss abgelehnt werden) ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"er@example.com"}';
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into public.push_geraete (endpoint, user_id, p256dh, auth)
  values ('https://push.example/fremd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'x', 'y');
rollback;
