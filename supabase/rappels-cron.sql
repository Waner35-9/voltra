-- À coller dans Supabase > SQL Editor, après avoir collé la fonction rappels et ajouté le secret RAPPELS_SECRET.
-- Avant de lancer : remplace COLLE_ICI_TON_RAPPELS_SECRET par ton secret. Ne garde pas ce secret dans ce fichier.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Chaque matin à 6 h 30 UTC, soit 7 h 30 en hiver et 8 h 30 en été à Paris
select cron.unschedule('voltra-rappels') where exists (select 1 from cron.job where jobname = 'voltra-rappels');
select cron.schedule('voltra-rappels', '30 6 * * *', $cron$
  select net.http_post(
    url := 'https://bsyvuygsdweppcgxzjkb.supabase.co/functions/v1/rappels',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzeXZ1eWdzZHdlcHBjZ3h6amtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Njk1NzUsImV4cCI6MjA5MDQ0NTU3NX0.HWQPp4W089rGUM_ysfe8rqNk9L6LhJHWaUrVzcNbzb0',
      'x-rappels-secret', 'COLLE_ICI_TON_RAPPELS_SECRET'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$cron$);
