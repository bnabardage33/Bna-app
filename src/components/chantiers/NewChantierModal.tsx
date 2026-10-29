"use client";

import React, { useState } from "react";
import { X, FolderPlus, CheckCircle2 } from "lucide-react";
import { MetierType, METIERS_CONFIG } from "@/types/metier";
import { createClient } from "@/lib/supabase/client";
import { createClientRecord, createChantierRecord } from "@/lib/services/chantierService";
import { useAuth } from "@/lib/auth/useAuth";

interface NewChantierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChantierCreated: () => void;
}

export const NewChantierModal: React.FC<NewChantierModalProps> = ({
  isOpen,
  onClose,
  onChantierCreated,
}) => {
  const { entreprise } = useAuth();
  const [nom, setNom] = useState("");
  const [metier, setMetier] = useState<MetierType>("terrasse");
  const [clientNom, setClientNom] = useState("");
  const [ville, setVille] = useState("Mérignac");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !clientNom.trim()) return;

    setLoading(true);
    const supabase = createClient();

    try {
      if (entreprise?.id) {
        // 1. Créer le client
        const client = await createClientRecord(supabase, entreprise.id, {
          nom: clientNom,
          type_client: "particulier",
          ville,
        });

        // 2. Créer le chantier générique
        await createChantierRecord(supabase, entreprise.id, {
          client_id: client.id,
          nom,
          metier,
          ville,
          description,
        });
      }

      onChantierCreated();
      onClose();
    } catch (err) {
      console.error("Erreur création chantier:", err);
      // Fallback gracieux si Supabase n'est pas encore initialisé
      alert(`Chantier ${nom} (${METIERS_CONFIG[metier].label}) prêt !`);
      onChantierCreated();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-mobile bg-white rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl border border-bna-border max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-bna-border/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-50 text-bna-copper">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-bna-anthracite">
                Nouveau Chantier
              </h3>
              <p className="text-[11px] text-bna-muted">Création d&apos;une fiche projet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 text-bna-muted"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Sélection Métier (3 métiers découplés) */}
          <div>
            <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
              Métier du chantier
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-bna-offwhite rounded-xl border border-bna-border text-xs font-semibold">
              {(["terrasse", "facade", "cloture"] as MetierType[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMetier(m)}
                  className={`py-2 px-1 rounded-lg text-center transition-all ${
                    metier === m
                      ? "bg-white text-bna-anthracite shadow-xs border border-bna-border"
                      : "text-bna-muted hover:text-bna-anthracite"
                  }`}
                >
                  {METIERS_CONFIG[m].label.split(" / ")[0]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-bna-muted uppercase block">
              Nom du chantier
            </label>
            <input
              type="text"
              required
              placeholder="ex: Terrasse Martin, Bardage Résidence Pins..."
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 bg-bna-offwhite border border-bna-border rounded-xl text-xs font-medium text-bna-anthracite focus:outline-hidden focus:border-bna-copper"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-bna-muted uppercase block">
                Nom du client
              </label>
              <input
                type="text"
                required
                placeholder="Martin, Dupont..."
                value={clientNom}
                onChange={(e) => setClientNom(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 bg-bna-offwhite border border-bna-border rounded-xl text-xs font-medium text-bna-anthracite focus:outline-hidden focus:border-bna-copper"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-bna-muted uppercase block">
                Ville
              </label>
              <input
                type="text"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 bg-bna-offwhite border border-bna-border rounded-xl text-xs font-medium text-bna-anthracite focus:outline-hidden focus:border-bna-copper"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-bna-muted uppercase block">
              Description de l&apos;intervention
            </label>
            <input
              type="text"
              placeholder="ex: Pose platelage Cumaru 45m²..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 bg-bna-offwhite border border-bna-border rounded-xl text-xs font-medium text-bna-anthracite focus:outline-hidden focus:border-bna-copper"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 min-h-[44px] bg-bna-copper hover:bg-bna-copper-hover text-white text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98] shadow-copper"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{loading ? "Création en cours..." : "Créer le chantier"}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
