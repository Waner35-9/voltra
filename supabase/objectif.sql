-- À coller une seule fois dans Supabase > SQL Editor.

-- Résultats des tests de performance : chacun ne voit et n'écrit que les siens
create table if not exists public.tests_performance (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date_test date not null default current_date,
  detente_cm numeric,
  sprint_20m numeric,
  pompes integer,
  created_at timestamptz not null default now()
);
create index if not exists tests_performance_user_date on public.tests_performance (user_id, date_test);
alter table public.tests_performance enable row level security;
drop policy if exists "own_tests" on public.tests_performance;
create policy "own_tests" on public.tests_performance
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
