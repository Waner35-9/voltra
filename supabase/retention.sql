-- À coller une seule fois dans Supabase > SQL Editor.

-- 1. Bilan de la semaine : un seul par semaine et par compte, ce qui limite le coût IA
create table if not exists public.bilans_semaine (
  user_id uuid not null references auth.users(id) on delete cascade,
  semaine date not null,
  seances integer not null default 0,
  prevues integer,
  gains jsonb not null default '[]'::jsonb,
  texte text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, semaine)
);
alter table public.bilans_semaine enable row level security;
grant select, insert on public.bilans_semaine to authenticated;
drop policy if exists own_bilans_lecture on public.bilans_semaine;
create policy own_bilans_lecture on public.bilans_semaine for select to authenticated using (auth.uid() = user_id);
drop policy if exists own_bilans_ajout on public.bilans_semaine;
create policy own_bilans_ajout on public.bilans_semaine for insert to authenticated with check (auth.uid() = user_id);

-- 2. Rappels : le matin des séances sur demande, la relance par défaut, désactivable
create table if not exists public.rappels (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seance_matin boolean not null default false,
  relance boolean not null default true,
  derniere_relance timestamptz,
  nb_relances integer not null default 0
);
alter table public.rappels enable row level security;
grant select, insert, update on public.rappels to authenticated;
drop policy if exists own_rappels on public.rappels;
create policy own_rappels on public.rappels for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
