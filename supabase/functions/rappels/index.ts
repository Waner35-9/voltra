import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Lancée chaque matin par pg_cron (supabase/rappels-cron.sql) avec le secret RAPPELS_SECRET.
// Sert aussi au lien de désinscription des e-mails, qui fonctionne sans connexion.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-rappels-secret",
};

const repondre = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const JOUR_MS = 86400000;
const JOURS_AVANT_RELANCE = 5;
const JOURS_ENTRE_RELANCES = 7;
const MAX_RELANCES = 3;
const SITE = "https://www.voltra-app.fr";

const echapper = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function signer(userId: string) {
  const cle = await crypto.subtle.importKey("raw", new TextEncoder().encode(Deno.env.get("RAPPELS_SECRET")!), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function egal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function maintenantParis() {
  const iso = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  return { iso, jour: new Date(`${iso}T12:00:00Z`).getUTCDay() };
}

function contenuEmail(type: "matin" | "relance", prenom: string, joursAvant: number | null, lienStop: string) {
  const salut = prenom ? `Salut ${echapper(prenom)},` : "Salut,";
  const objectif = joursAvant !== null && joursAvant >= 0 ? ` Ton objectif est dans ${joursAvant} jour${joursAvant > 1 ? "s" : ""}.` : "";
  const sujet = type === "matin" ? "Ta séance t'attend aujourd'hui" : "Ton plan t'attend";
  const corps = type === "matin"
    ? `Tu as une séance prévue aujourd'hui.${objectif} Ouvre Voltra quand tu veux.`
    : `Ça fait quelques jours sans séance, et ce n'est pas grave.${objectif} Ouvre Voltra : une seule séance suffit pour reprendre le rythme, et tu peux l'alléger si besoin.`;
  return {
    sujet,
    html: `<p>${salut}</p><p>${corps}</p><p>À bientôt,<br>Ace, ton coach Voltra</p><p style="font-size:12px;color:#777"><a href="${lienStop}">Ne plus recevoir ces rappels</a></p>`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secret = Deno.env.get("RAPPELS_SECRET");
  const cleResend = Deno.env.get("RESEND_API_KEY");
  if (!secret) return repondre({ error: "RAPPELS_SECRET absent" }, 500);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const corps = await req.json().catch(() => ({}));

    if (corps.action === "desactiver") {
      const [userId, signature] = String(corps.jeton || "").split(".");
      if (!userId || !signature || !egal(signature, await signer(userId))) return repondre({ error: "Lien invalide" }, 400);
      const { error } = await supabase.from("rappels").upsert({ user_id: userId, seance_matin: false, relance: false }, { onConflict: "user_id" });
      if (error) throw error;
      return repondre({ ok: true });
    }

    if (!egal(req.headers.get("x-rappels-secret") || "", secret)) return repondre({ error: "Non autorisé" }, 401);
    if (!cleResend) return repondre({ error: "RESEND_API_KEY absente" }, 500);

    const { iso, jour } = maintenantParis();
    const maintenant = Date.now();
    const limiteRelance = new Date(maintenant - JOURS_AVANT_RELANCE * JOUR_MS).toISOString();

    // Abonnés et essais en cours
    const ids: string[] = [];
    for (let page = 0; ; page++) {
      const { data, error } = await supabase.from("profiles").select("id").eq("is_pro", true).range(page * 1000, page * 1000 + 999);
      if (error) throw error;
      ids.push(...(data || []).map((p: any) => p.id));
      if (!data || data.length < 1000) break;
    }

    const envois: { userId: string; type: "matin" | "relance"; nbRelances: number; email: any }[] = [];
    const remises: string[] = [];

    for (let i = 0; i < ids.length; i += 200) {
      const lot = ids.slice(i, i + 200);
      const [{ data: programmes }, { data: recentes }, { data: prefs }] = await Promise.all([
        supabase.from("programmes").select("user_id, created_at, jours:data_json->jours").in("user_id", lot).eq("statut", "actif").order("created_at", { ascending: true }),
        supabase.from("seances").select("user_id").in("user_id", lot).eq("statut", "faite").gte("date_realisee", limiteRelance),
        supabase.from("rappels").select("*").in("user_id", lot),
      ]);
      // Le plus récent gagne, et seul le premier programme compte pour savoir depuis quand l'athlète est là
      const programmeDe: Record<string, any> = {};
      for (const p of programmes || []) programmeDe[p.user_id] = { ...p, depuis: programmeDe[p.user_id]?.depuis || p.created_at };
      const actifs = new Set((recentes || []).map((s: any) => s.user_id));
      const prefDe = Object.fromEntries((prefs || []).map((p: any) => [p.user_id, p]));

      for (const userId of lot) {
        const programme = programmeDe[userId];
        if (!programme) continue;
        const pref = prefDe[userId] || {};
        const nbRelances = pref.nb_relances || 0;
        if (actifs.has(userId) && nbRelances > 0) remises.push(userId);

        const assezLoin = !pref.derniere_relance || maintenant - new Date(pref.derniere_relance).getTime() >= JOURS_ENTRE_RELANCES * JOUR_MS;
        const aRelancer = pref.relance !== false && !actifs.has(userId) && programme.depuis <= limiteRelance && assezLoin && nbRelances < MAX_RELANCES;
        const aRappeler = pref.seance_matin === true && Array.isArray(programme.jours) && programme.jours.includes(jour);
        if (!aRelancer && !aRappeler) continue;

        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        if (!user?.email) continue;
        const cible = user.user_metadata?.cible;
        const joursAvant = cible?.date ? Math.round((new Date(`${cible.date}T12:00:00Z`).getTime() - new Date(`${iso}T12:00:00Z`).getTime()) / JOUR_MS) : null;
        const prenom = String(user.user_metadata?.name || "").split(" ")[0];
        const lienStop = `${SITE}/?rappels=stop&t=${userId}.${await signer(userId)}`;
        const type = aRelancer ? "relance" : "matin";
        const { sujet, html } = contenuEmail(type, prenom, joursAvant, lienStop);
        envois.push({
          userId, type, nbRelances,
          email: {
            from: "Voltra <contact@voltra-app.fr>",
            to: user.email,
            subject: sujet,
            html,
            headers: { "List-Unsubscribe": `<${lienStop}>` },
          },
        });
      }
    }

    // L'athlète est revenu : ses relances repartent de zéro
    if (remises.length) {
      const { error } = await supabase.from("rappels").update({ nb_relances: 0, derniere_relance: null }).in("user_id", remises);
      if (error) console.error("Erreur remise à zéro :", error.message);
    }

    let envoyes = 0;
    for (let i = 0; i < envois.length; i += 100) {
      const lot = envois.slice(i, i + 100);
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${cleResend}`, "Content-Type": "application/json" },
        body: JSON.stringify(lot.map((e) => e.email)),
      });
      if (!res.ok) { console.error("Erreur envoi rappels :", await res.text()); continue; }
      envoyes += lot.length;
      const relances = lot.filter((e) => e.type === "relance").map((e) => ({
        user_id: e.userId, derniere_relance: new Date().toISOString(), nb_relances: e.nbRelances + 1,
      }));
      if (relances.length) {
        const { error } = await supabase.from("rappels").upsert(relances, { onConflict: "user_id" });
        if (error) console.error("Erreur suivi relances :", error.message);
      }
    }

    console.log(`Rappels : ${envoyes} envoyés sur ${envois.length}`);
    return repondre({ ok: true, envoyes, prevus: envois.length });
  } catch (err: any) {
    console.error("ERREUR rappels:", err?.message);
    return repondre({ error: "Rappels indisponibles" }, 500);
  }
});
