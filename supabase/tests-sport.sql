-- À coller une seule fois dans Supabase > SQL Editor.

-- Tests physiques adaptés à chaque sport (nage chronométrée, VMA, test T…).
-- Chaque test est rangé dans « mesures » ; détente, sprint 20 m et pompes gardent aussi leur colonne.
-- Les tests déjà enregistrés ne changent pas. La règle « chacun ne voit que les siens » couvre déjà cette colonne.
alter table public.tests_performance add column if not exists mesures jsonb;
