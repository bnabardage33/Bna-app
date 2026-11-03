"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, LogIn, Eye, EyeOff, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isAuthenticated, loading: authLoading, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
  );

  // Si l'utilisateur est déjà authentifié, redirection immédiate vers le dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      await signIn(email.trim(), password);
      // Rechargement complet vers / pour garantir la transmission des cookies de session au middleware Next.js
      window.location.href = "/";
    } catch (err: unknown) {
      console.error("Erreur de connexion :", err);
      let msg = "Identifiants invalides ou service d'authentification inaccessible";
      if (err instanceof Error) {
        const lower = err.message.toLowerCase();
        if (err.message.includes("Invalid login credentials")) {
          msg = "Identifiants invalides : l'email ou le mot de passe est incorrect.";
        } else if (err.message.includes("Email not confirmed")) {
          msg = "Email non confirmé : Allez dans Supabase (Authentication > Users), cliquez sur '...' en face de votre utilisateur et choisissez 'Confirm user'.";
        } else if (lower.includes("fetch") || lower.includes("récupération") || lower.includes("failed")) {
          const currentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "NON DÉFINIE";
          msg = `Échec de connexion au serveur Supabase (URL active : ${currentUrl}). Vérifiez vos variables sur Vercel et relancez un déploiement.`;
        } else {
          msg = `Erreur Supabase : ${err.message}`;
        }
      }
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  // Écran d'attente lors de la vérification de session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bna-offwhite flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-200">
          <div className="font-display font-black text-3xl tracking-tighter text-bna-anthracite">
            BN<span className="text-bna-copper">A</span>
          </div>
          <div className="w-8 h-8 border-3 border-bna-copper/20 border-t-bna-copper rounded-full animate-spin" />
          <p className="text-xs font-semibold text-bna-muted">Vérification de session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bna-offwhite flex flex-col justify-between p-4 sm:p-6 md:p-10">
      {/* Haut de page : Logo & Badge Sécurité */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between pt-2 pb-6">
        <div className="font-display font-black text-2xl tracking-tighter text-bna-anthracite">
          BN<span className="text-bna-copper">A</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-bna-border shadow-2xs text-[11px] font-bold text-slate-700">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Portail Sécurisé</span>
        </div>
      </header>

      {/* Carte centrale de connexion */}
      <main className="w-full max-w-md mx-auto my-auto">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-bna-border/80">
          {/* Titre & Sous-titre */}
          <div className="space-y-1.5 mb-6 text-center sm:text-left">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-bna-copper">
              ACCÈS PROFESSIONNEL BNA
            </span>
            <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight text-bna-anthracite">
              Connexion Dashboard
            </h1>
            <p className="text-xs text-bna-muted leading-relaxed">
              Connectez-vous pour piloter vos chantiers, consulter le planning centralisé et générer vos quantitatifs.
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 mb-4 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Variables Vercel non actives
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Le build actuel n&apos;a pas encore reçu vos variables Supabase. Allez sur Vercel &gt; Deployments &gt; cliquez sur les trois petits points &gt; <b>Redeploy</b> pour appliquer vos clés.
              </p>
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="text-[11px] font-bold text-bna-muted uppercase tracking-wider block mb-1"
              >
                Adresse Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-bna-muted absolute left-3.5 top-3.5" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@bna-bardage.fr"
                  className="w-full pl-10 pr-3 py-3 bg-bna-offwhite border border-bna-border rounded-xl text-xs font-semibold text-bna-anthracite placeholder:text-neutral-400 focus:outline-hidden focus:border-bna-copper focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="password"
                  className="text-[11px] font-bold text-bna-muted uppercase tracking-wider block"
                >
                  Mot de passe
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-bna-muted absolute left-3.5 top-3.5" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-bna-offwhite border border-bna-border rounded-xl text-xs font-semibold text-bna-anthracite placeholder:text-neutral-400 focus:outline-hidden focus:border-bna-copper focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 p-0.5 text-bna-muted hover:text-bna-anthracite transition-colors"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Message d'erreur */}
            {errorMsg && (
              <div
                role="alert"
                className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-150"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Bouton de soumission */}
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] bg-bna-copper hover:bg-bna-copper-hover text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-copper transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Se connecter au Dashboard</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Bas de page légal & technique */}
      <footer className="w-full max-w-md mx-auto text-center py-4">
        <p className="text-[11px] text-bna-muted">
          BNA · Pilotage de chantiers &amp; Calepinage Pro · Gironde &amp; Nouvelle-Aquitaine
        </p>
      </footer>
    </div>
  );
}
