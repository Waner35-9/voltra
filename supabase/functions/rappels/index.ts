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

// Page de paiement Stripe ouverte la veille et pas payée : e-mail le matin suivant.
// On prend celles ouvertes entre 30 h et 6 h avant ce passage quotidien (fenêtres de 24 h qui se suivent,
// donc chacune n'est vue qu'une fois). Les 6 h laissent le temps de finir ; un paiement fait entre-temps rend Pro.
async function paiementsAbandonnes(cleStripe: string, maintenant: number) {
  const debut = Math.floor((maintenant - 30 * 3600000) / 1000), fin = Math.floor((maintenant - 6 * 3600000) / 1000);
  const abandons: Record<string, { essai: boolean }> = {};
  let apres = "";
  for (let page = 0; page < 20; page++) {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?limit=100&created[gte]=${debut}&created[lt]=${fin}${apres}`, {
      headers: { Authorization: `Bearer ${cleStripe}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Erreur Stripe");
    for (const session of data.data || []) {
      const userId = session.client_reference_id;
      if (session.mode !== "subscription" || !userId || session.status === "complete") continue;
      // 0 € à payer à l'ouverture = l'essai gratuit était proposé
      abandons[userId] = { essai: (abandons[userId]?.essai ?? false) || session.amount_total === 0 };
    }
    if (!data.has_more || !data.data?.length) break;
    apres = `&starting_after=${data.data[data.data.length - 1].id}`;
  }
  return abandons;
}

function contenuEssai(prenom: string, essai: boolean, lienStop: string) {
  const salut = prenom ? `Salut ${echapper(prenom)},` : "Salut,";
  const sujet = essai ? "Ton essai gratuit t'attend" : "Ton abonnement Voltra t'attend";
  const sousTitre = essai ? "7 jours offerts · 0 € aujourd'hui" : "Sans engagement · résiliable en 2 clics";
  const paragraphes = essai
    ? ["Ton programme est prêt, il ne manquait qu'une étape pour lancer tes 7 jours d'essai gratuit.", "Rien n'est prélevé pendant l'essai, on te prévient par e-mail avant le premier paiement, et tu peux annuler en 2 clics depuis ton profil."]
    : ["Ton programme est prêt, il ne manquait qu'une étape pour finaliser ton abonnement.", "Reprends là où tu t'es arrêté, quand tu veux."];
  const bouton = essai ? "Lancer mon essai gratuit" : "Ouvrir Voltra";
  // E-mail en tableaux et styles en ligne : c'est ce que Gmail, Outlook et Mail affichent le mieux
  return {
    sujet,
    html: `<div style="background:#f4f4f0;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;border-collapse:separate">
<tr><td style="background:#0E0F0C;border-radius:16px 16px 0 0;padding:32px 24px 28px;text-align:center">
<img src="${SITE}/icons/icon-192.png" width="64" height="64" alt="Voltra" style="display:block;margin:0 auto;border-radius:14px">
<p style="color:#9BE84F;font-size:12px;letter-spacing:3px;font-weight:bold;margin:12px 0 0">VOLTRA</p>
<p style="color:#ffffff;font-size:24px;font-weight:bold;line-height:1.25;margin:18px 0 8px">${sujet}</p>
<p style="color:#A6A69E;font-size:14px;margin:0">${sousTitre}</p>
</td></tr>
<tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:28px 24px;color:#151612;font-size:15px;line-height:1.6">
<p style="margin:0 0 14px">${salut}</p>
<p style="margin:0 0 14px">${paragraphes[0]}</p>
<p style="margin:0 0 22px">${paragraphes[1]}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 22px"><tr><td style="background:#9BE84F;border-radius:999px;text-align:center">
<a href="${SITE}" style="display:inline-block;padding:14px 32px;color:#0E0F0C;font-size:16px;font-weight:bold;text-decoration:none">${bouton}</a>
</td></tr></table>
<p style="margin:0 0 20px">À bientôt,<br>Ace, ton coach Voltra</p>
<p style="margin:0;font-size:12px;color:#888780;border-top:1px solid #EAEAE4;padding-top:14px"><a href="${lienStop}" style="color:#888780">Ne plus recevoir ces e-mails</a></p>
</td></tr>
</table>
</div>`,
  };
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

    const envois: { userId: string; type: "matin" | "relance" | "essai"; nbRelances: number; email: any }[] = [];
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

    // Page de paiement abandonnée la veille : un seul e-mail, sauf si la personne est passée Pro depuis ou a coupé les relances
    const cleStripe = Deno.env.get("STRIPE_SECRET_KEY");
    if (cleStripe) {
      try {
        const abandons = await paiementsAbandonnes(cleStripe, maintenant);
        const idsAbandon = Object.keys(abandons).filter((id) => !envois.some((e) => e.userId === id)).slice(0, 300);
        if (idsAbandon.length) {
          const [{ data: profils }, { data: prefsAbandon }] = await Promise.all([
            supabase.from("profiles").select("id, is_pro").in("id", idsAbandon),
            supabase.from("rappels").select("user_id, relance").in("user_id", idsAbandon),
          ]);
          const refus = new Set((prefsAbandon || []).filter((p: any) => p.relance === false).map((p: any) => p.user_id));
          for (const profil of profils || []) {
            if (profil.is_pro || refus.has(profil.id)) continue;
            const { data: { user } } = await supabase.auth.admin.getUserById(profil.id);
            if (!user?.email) continue;
            const prenom = String(user.user_metadata?.name || "").trim().split(" ")[0];
            const lienStop = `${SITE}/?rappels=stop&t=${profil.id}.${await signer(profil.id)}`;
            const { sujet, html } = contenuEssai(prenom, abandons[profil.id].essai, lienStop);
            envois.push({
              userId: profil.id, type: "essai", nbRelances: 0,
              email: { from: "Voltra <contact@voltra-app.fr>", to: user.email, subject: sujet, html, headers: { "List-Unsubscribe": `<${lienStop}>` } },
            });
          }
        }
      } catch (err: any) {
        console.error("Erreur paiements abandonnés :", err?.message);
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

    console.log(`Rappels : ${envoyes} envoyés sur ${envois.length}, dont ${envois.filter((e) => e.type === "essai").length} après un paiement abandonné`);
    return repondre({ ok: true, envoyes, prevus: envois.length });
  } catch (err: any) {
    console.error("ERREUR rappels:", err?.message);
    return repondre({ error: "Rappels indisponibles" }, 500);
  }
});
