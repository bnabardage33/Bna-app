"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { X, LogOut, CheckCircle2, Building2, UserCircle2, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { user, profil, entreprise, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      onClose();
      router.replace("/login");
    } catch (err) {
      console.error("Erreur lors de la déconnexion :", err);
    } finally {
      setLoading(false);
    }
  };

  const displayName =
    profil?.prenom
      ? `${profil.prenom} ${profil.nom || ""}`.trim()
      : user?.email?.toLowerCase().includes("bna")
      ? "Gaël"
      : user?.email?.split("@")[0] || "Gaël";

  const initial = displayName.charAt(0).toUpperCase();

  const roleLabel =
    !profil?.role || profil.role === "dirigeant" || (profil.role as string) === "gerant"
      ? "Gérant"
      : profil.role === "chantier"
      ? "Conducteur de travaux"
      : profil.role === "commercial"
      ? "Commercial"
      : profil.role === "administratif"
      ? "Administratif"
      : String(profil.role);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 p-2 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] sm:p-4"
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-bna-border animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between pb-3 border-b border-bna-border/60">
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-xl tracking-tighter text-bna-anthracite">
              BN<span className="text-bna-copper">A</span>
            </span>
            <span className="text-xs font-semibold text-bna-muted border-l border-bna-border pl-2">
              Mon Profil
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-100 text-bna-muted hover:text-bna-anthracite transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Carte de session active */}
        <div className="mt-4 space-y-4">
          <div className="p-4 bg-bna-offwhite border border-bna-border/80 rounded-2xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white border border-bna-border flex items-center justify-center font-display font-bold text-base text-bna-anthracite shadow-2xs">
                {initial}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm text-bna-anthracite truncate">
                    {displayName}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    En ligne
                  </span>
                </div>
                <p className="text-xs text-bna-muted truncate mt-0.5">{user?.email}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-bna-border/60 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-700">
                <span className="inline-flex items-center gap-1.5 text-bna-muted">
                  <Shield className="w-3.5 h-3.5 text-bna-copper" />
                  Rôle
                </span>
                <span className="font-bold">{roleLabel}</span>
              </div>

              <div className="flex items-center justify-between text-slate-700">
                <span className="inline-flex items-center gap-1.5 text-bna-muted">
                  <Building2 className="w-3.5 h-3.5 text-bna-copper" />
                  Entreprise
                </span>
                <span className="font-bold">{entreprise?.nom || "BNA Bardage & Aménagement"}</span>
              </div>
            </div>
          </div>

          {/* Bouton de Déconnexion */}
          <button
            onClick={handleLogout}
            disabled={loading}
            className="w-full min-h-[46px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
          >
            <LogOut className="w-4 h-4" />
            <span>{loading ? "Déconnexion en cours..." : "Se déconnecter de la session"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
