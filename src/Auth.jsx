import { useState } from "react";
import { supabase } from "./supabase";

const C = {
  bg:"#050608", surf:"#0c0d12", surf2:"#121420",
  border:"#1c2030", gold:"#C9A84C", text:"#e8eaf0", muted:"#4a5270", red:"#F44336"
};

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const inp = {
    width: "100%", background: C.surf2, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "13px 14px", color: C.text, fontSize: 16,
    fontFamily: "'Barlow Condensed', sans-serif", outline: "none",
    boxSizing: "border-box"
  };

  const handleSubmit = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuth(data.user);
      } else if (mode === "signup") {
        if (!pseudo.trim()) throw new Error("Choisis un pseudo !");
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { pseudo: pseudo.toUpperCase() } }
        });
        if (error) throw error;
        setSuccess("✅ Compte créé ! Vérifie tes emails pour confirmer.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setSuccess("✅ Email de réinitialisation envoyé !");
      }
    } catch (e) {
      setError(e.message === "Invalid login credentials"
        ? "Email ou mot de passe incorrect"
        : e.message
      );
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "'Barlow Condensed', sans-serif" }}>
      <div style={{ position: "fixed", top: "10%", left: "50%", transform: "translateX(-50%)", width: 400, height: 400, background: `radial-gradient(circle, ${C.gold}08 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 8, lineHeight: 0.9, marginBottom: 8 }}>
          <span style={{ color: C.gold }}>⚡</span>
          <span style={{ color: C.text }}>VOL</span>
          <span style={{ color: C.gold }}>TRA</span>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted, letterSpacing: 3 }}>AI ATHLETIC PERFORMANCE SYSTEM</div>
      </div>
      <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 400, boxShadow: `0 0 60px ${C.gold}10` }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: C.gold, marginBottom: 6 }}>
          {mode === "login" ? "CONNEXION" : mode === "signup" ? "CRÉER UN COMPTE" : "MOT DE PASSE OUBLIÉ"}
        </div>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>
          {mode === "login" ? "Retrouve tes programmes et ta carte" : mode === "signup" ? "Commence ton aventure Voltra" : "Reçois un lien de réinitialisation"}
        </div>
        {mode === "signup" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, letterSpacing: 2, color: C.muted, marginBottom: 5 }}>TON PSEUDO</label>
            <input value={pseudo} onChange={e => setPseudo(e.target.value)} placeholder="ex: LUCAS" style={inp} />
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, letterSpacing: 2, color: C.muted, marginBottom: 5 }}>EMAIL</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.com" style={inp} />
        </div>
        {mode !== "forgot" && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, letterSpacing: 2, color: C.muted, marginBottom: 5 }}>MOT DE PASSE</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp}
              onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
        )}
        {error && <div style={{ background: "#F4433618", border: "1px solid #F4433640", borderRadius: 8, padding: "10px 12px", color: C.red, fontSize: 13, marginBottom: 14 }}>{error}</div>}
        {success && <div style={{ background: "#4CAF5018", border: "1px solid #4CAF5040", borderRadius: 8, padding: "10px 12px", color: "#4CAF50", fontSize: 13, marginBottom: 14 }}>{success}</div>}
        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", background: `linear-gradient(135deg, ${C.gold}, #a07830)`, border: "none", borderRadius: 10, padding: "14px", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, color: "#000", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, marginBottom: 16 }}>
          {loading ? "⏳ CHARGEMENT..." : mode === "login" ? "⚡ SE CONNECTER" : mode === "signup" ? "🚀 CRÉER MON COMPTE" : "📧 ENVOYER LE LIEN"}
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          {mode === "login" && (
            <>
              <button onClick={() => { setMode("signup"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: C.gold, fontSize: 14, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}>
                Pas de compte ? <strong>Créer un compte</strong>
              </button>
              <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}>
                Mot de passe oublié ?
              </button>
            </>
          )}
          {mode !== "login" && (
            <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: C.gold, fontSize: 14, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}>
              ← Retour à la connexion
            </button>
          )}
        </div>
      </div>
      <div style={{ marginTop: 24, fontSize: 12, color: C.muted, textAlign: "center" }}>
        Tes données sont sécurisées et ne sont jamais partagées
      </div>
    </div>
  );
}
