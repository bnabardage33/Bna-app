"use client";

import React, { useState } from "react";
import { X, Lock, Mail, LogIn, LogOut, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, profil, entreprise, signIn, signOut, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      await signIn(email, password);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Identifiants invalides ou service inaccessible"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-mobile bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border border-bna-border animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-bna-border/60">
          <div className="font-display font-black text-xl tracking-tighter text-bna-anthracite">
            BN<span className="text-bna-copper">A</span>{" "}
            <span className="text-xs font-normal text-bna-muted tracking-normal">
              — Authentification
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 text-bna-muted"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isAuthenticated ? (
          <div className="mt-4 space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-900">Session active</p>
                <p className="text-xs text-emerald-700 mt-0.5">{user?.email}</p>
                {profil && (
                  <p className="text-[11px] text-emerald-600 mt-1">
                    Rôle : <strong className="capitalize">{profil.role}</strong>
                  </p>
                )}
                {entreprise && (
                  <p className="text-[11px] text-emerald-600">
                    Entreprise : <strong>{entreprise.nom}</strong>
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full min-h-[44px] bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="text-[11px] font-bold text-bna-muted uppercase block">
                Adresse Email
              </label>
              <div className="relative mt-1">
                <Mail className="w-4 h-4 text-bna-muted absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@bna-bardage.fr"
                  className="w-full pl-9 pr-3 py-2.5 bg-bna-offwhite border border-bna-border rounded-xl text-xs font-medium text-bna-anthracite focus:outline-hidden focus:border-bna-copper"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-bna-muted uppercase block">
                Mot de passe
              </label>
              <div className="relative mt-1">
                <Lock className="w-4 h-4 text-bna-muted absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-bna-offwhite border border-bna-border rounded-xl text-xs font-medium text-bna-anthracite focus:outline-hidden focus:border-bna-copper"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] bg-bna-copper hover:bg-bna-copper-hover text-white text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98] shadow-copper"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? "Connexion..." : "Se connecter"}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
