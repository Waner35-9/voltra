-- À coller dans Supabase > SQL Editor, une seule fois. Si Supabase affiche un avertissement, clique sur « Run without RLS » :
-- ce fichier active déjà la protection (RLS) sur ses deux tables.
-- Crée les liens d'invitation : accès Pro offert, sans carte bancaire, pour une durée limitée.
-- Le résultat affiché à la fin est le premier lien à envoyer à tes amis.

create extension if not exists pg_cron;

create table if not exists public.invitations (
  code text primary key,
  nom text,
  places integer not null,
  utilisees integer not null default 0,
  duree_jours integer not null,
  valable_jusquau timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.invitations enable row level security;

create table if not exists public.invitations_utilisees (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null references public.invitations (code),
  fin_le timestamptz not null,
  terminee boolean not null default false,
  client_stripe text,
  utilisee_le timestamptz not null default now()
);
alter table public.invitations_utilisees enable row level security;

-- Chacun peut lire la date de fin de son propre accès offert, rien d'autre
grant select on public.invitations_utilisees to authenticated;
drop policy if exists "lire son invitation" on public.invitations_utilisees;
create policy "lire son invitation" on public.invitations_utilisees
  for select to authenticated using (auth.uid() = user_id);

-- Appelée uniquement par la fonction Edge invitation, avec la clé de service
create or replace function public.utiliser_invitation(p_code text, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
  v_profil public.profiles%rowtype;
  v_fin timestamptz;
begin
  select * into v_profil from public.profiles where id = p_user;
  if v_profil.is_pro then
    return jsonb_build_object('ok', true, 'deja_pro', true);
  end if;
  if exists (select 1 from public.invitations_utilisees where user_id = p_user) then
    return jsonb_build_object('erreur', 'deja_utilisee');
  end if;

  -- Verrouillé pour que deux inscriptions simultanées ne dépassent pas le nombre de places
  select * into v_invitation from public.invitations where code = p_code for update;
  if not found then
    return jsonb_build_object('erreur', 'invalide');
  end if;
  if v_invitation.valable_jusquau < now() then
    return jsonb_build_object('erreur', 'expiree');
  end if;
  if v_invitation.utilisees >= v_invitation.places then
    return jsonb_build_object('erreur', 'complete');
  end if;

  v_fin := now() + make_interval(days => v_invitation.duree_jours);
  insert into public.invitations_utilisees (user_id, code, fin_le, client_stripe)
    values (p_user, p_code, v_fin, v_profil.stripe_customer_id);
  update public.invitations set utilisees = utilisees + 1 where code = p_code;
  insert into public.profiles (id, is_pro) values (p_user, true)
    on conflict (id) do update set is_pro = true;

  return jsonb_build_object('ok', true, 'fin_le', v_fin);
end;
$$;

-- Fin des accès offerts. Un abonnement pris entre-temps crée un nouveau client Stripe : ce compte garde son Pro.
create or replace function public.terminer_invitations()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with fin as (
    update public.invitations_utilisees
    set terminee = true
    where not terminee and fin_le < now()
    returning user_id, client_stripe
  )
  update public.profiles p
  set is_pro = false
  from fin
  where p.id = fin.user_id
    and p.stripe_customer_id is not distinct from fin.client_stripe;
end;
$$;

revoke all on function public.utiliser_invitation(text, uuid) from public, anon, authenticated;
revoke all on function public.terminer_invitations() from public, anon, authenticated;
grant execute on function public.utiliser_invitation(text, uuid) to service_role;

-- Chaque matin à 5 h UTC
select cron.unschedule('voltra-fin-invitations') where exists (select 1 from cron.job where jobname = 'voltra-fin-invitations');
select cron.schedule('voltra-fin-invitations', '0 5 * * *', 'select public.terminer_invitations();');

-- Premier lien : 20 places, 30 jours d'accès offert, lien utilisable pendant 30 jours
insert into public.invitations (code, nom, places, duree_jours, valable_jusquau)
values (substr(replace(gen_random_uuid()::text, '-', ''), 1, 20), 'Amis testeurs', 20, 30, now() + interval '30 days')
returning 'https://www.voltra-app.fr/?invitation=' || code as lien_a_envoyer;
