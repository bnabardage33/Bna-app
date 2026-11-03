"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  FileText,
  X,
  CheckCircle2,
  CalendarCheck2,
} from "lucide-react";
import type { Chantier } from "@/types/metier";
import { creerRendezVous, type CreerRendezVousInput } from "@/lib/services/rendezVousService";
import {
  NATURES_CONFIG,
  categorizeNature,
  type NatureKey,
} from "@/lib/services/planningService";
import { createClient } from "@/lib/supabase/client";

interface NewRdvModalProps {
  isOpen: boolean;
  onClose: () => void;
  chantiers: Chantier[];
  selectedChantierId?: string;
  onRdvCreated: () => void;
}

export const NewRdvModal: React.FC<NewRdvModalProps> = ({
  isOpen,
  onClose,
  chantiers,
  selectedChantierId,
  onRdvCreated,
}) => {
  const supabase = createClient();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [chantierId, setChantierId] = useState<string>(selectedChantierId || "");
  const [titre, setTitre] = useState<string>("Visite technique de chantier");
  const [natureType, setNatureType] = useState<NatureKey>("technique");
  const [date, setDate] = useState<string>(todayStr);
  const [heureDebut, setHeureDebut] = useState<string>("09:00");
  const [heureFin, setHeureFin] = useState<string>("10:30");
  const [nature, setNature] = useState<string>("");
  const [lieu, setLieu] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChantierChange = (id: string) => {
    setChantierId(id);
    const found = chantiers.find((c) => c.id === id);
    if (found) {
      if (!lieu || lieu === "") {
        setLieu(found.ville || found.adresse || "");
      }
    }
  };

  const handleNatureSelect = (key: NatureKey) => {
    setNatureType(key);
    if (key === "technique" && (!titre || titre.includes("Point") || titre.includes("Réception"))) {
      setTitre("Visite technique de contrôle DTU");
    } else if (key === "reception" && (!titre || titre.includes("technique") || titre.includes("Point"))) {
      setTitre("Réception des travaux & signature PV");
    } else if (key === "client" && (!titre || titre.includes("technique") || titre.includes("Réception"))) {
      setTitre("Point d'étape avec le client");
    } else if (key === "livraison") {
      setTitre("Réception des matériaux sur chantier");
    } else if (key === "travaux") {
      setTitre("Démarrage travaux de pose");
    }
  };

  const setQuickDate = (daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    setDate(d.toISOString().slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim()) {
      setError("Indique un titre pour le rendez-vous.");
      return;
    }
    if (!date) {
      setError("Indique la date du rendez-vous.");
      return;
    }
    if (!nature.trim()) {
      setError("Précise la nature du rendez-vous dans l'encadré prévu.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const foundChantier = chantiers.find((c) => c.id === chantierId);

    const input: CreerRendezVousInput = {
      chantier_id: chantierId || null,
      chantier_nom: foundChantier?.nom || null,
      client_id: foundChantier?.client_id || null,
      client_nom: foundChantier?.client_nom || null,
      titre: titre.trim(),
      nature: nature.trim(),
      nature_type: natureType,
      date,
      heure_debut: heureDebut,
      heure_fin: heureFin || null,
      lieu: lieu.trim() || foundChantier?.ville || null,
      statut: "planifie",
    };

    try {
      await creerRendezVous(supabase, input);
      onRdvCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'enregistrement du rendez-vous.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const field =
    "w-full px-3 py-2 text-xs bg-white border border-bna-border rounded-xl focus:outline-none focus:ring-1 focus:ring-bna-copper";
  const lbl = "text-[10px] font-bold uppercase tracking-wider text-bna-muted block mb-1";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-3 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-bna-border overflow-hidden my-auto max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-bna-offwhite border-b border-bna-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-bna-copper/10 border border-bna-copper/30 flex items-center justify-center text-bna-copper">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-bna-anthracite">
                Nouveau Rendez-vous & Jalon
              </h3>
              <p className="text-[10px] text-bna-muted">
                Intégration automatique dans le planning général Mermaid
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-bna-muted hover:text-bna-anthracite rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3.5 text-xs">
          {error && (
            <p className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
              {error}
            </p>
          )}

          {/* Chantier associé */}
          <div>
            <label className={lbl}>Chantier concerné</label>
            <div className="relative">
              <select
                className={field}
                value={chantierId}
                onChange={(e) => handleChantierChange(e.target.value)}
              >
                <option value="">Rendez-vous général / Hors chantier</option>
                {chantiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom} ({c.ville})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Titre du RDV */}
          <div>
            <label className={lbl}>Titre du rendez-vous</label>
            <input
              type="text"
              className={field}
              placeholder="Ex : Visite technique, Point client, Réception..."
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              required
            />
          </div>

          {/* Date & Raccourcis rapides */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={lbl}>Date (Calendrier)</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-bna-anthracite"
                >
                  Aujourd&apos;hui
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-bna-anthracite"
                >
                  Demain
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(7)}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-bna-anthracite"
                >
                  +7j
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="date"
                className={field}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Heures début et fin */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={lbl}>Heure de début</label>
              <div className="relative">
                <input
                  type="time"
                  className={field}
                  value={heureDebut}
                  onChange={(e) => setHeureDebut(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className={lbl}>Heure de fin (optionnel)</label>
              <div className="relative">
                <input
                  type="time"
                  className={field}
                  value={heureFin}
                  onChange={(e) => setHeureFin(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* SÉLECTEUR DE CATÉGORIE / NATURE (COULEURS DÉDIÉES) */}
          <div>
            <label className={lbl}>Catégorie &amp; Nature du rendez-vous</label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { key: "technique", label: "Technique & DTU", color: "bg-orange-50 text-orange-800 border-orange-300" },
                  { key: "reception", label: "Réception & PV", color: "bg-emerald-50 text-emerald-800 border-emerald-300" },
                  { key: "client", label: "Point Client", color: "bg-blue-50 text-blue-800 border-blue-300" },
                  { key: "livraison", label: "Livraison Matériaux", color: "bg-purple-50 text-purple-800 border-purple-300" },
                  { key: "travaux", label: "Chantier & Pose", color: "bg-slate-100 text-slate-800 border-slate-300" },
                  { key: "administratif", label: "Administratif", color: "bg-indigo-50 text-indigo-800 border-indigo-300" },
                ] as const
              ).map((cat) => {
                const isSelected = natureType === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleNatureSelect(cat.key)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-xl border transition-all ${
                      isSelected
                        ? `${cat.color} ring-2 ring-offset-1 ring-bna-copper scale-[1.02]`
                        : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ENCADRÉ PRINCIPAL : NATURE DU RENDEZ-VOUS */}
          <div className="p-3 bg-bna-offwhite border-2 border-bna-copper/30 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-bna-copper font-bold text-[11px] uppercase tracking-wide">
              <FileText className="w-3.5 h-3.5" />
              <span>Encadré : Nature &amp; Objectifs du rendez-vous</span>
            </div>
            <textarea
              rows={4}
              className="w-full p-2.5 text-xs bg-white border border-bna-border rounded-lg focus:outline-none focus:ring-1 focus:ring-bna-copper placeholder:text-neutral-400"
              placeholder="Écris la nature détaillée du RDV :&#10;• Points techniques à contrôler (plots, hygrométrie, planéité...)&#10;• Échantillons ou plans 2D/3D à présenter&#10;• Validation des teintes, accès chantier, clés..."
              value={nature}
              onChange={(e) => setNature(e.target.value)}
              required
            />
            <p className="text-[10px] text-bna-muted">
              Ces précisions s&apos;affichent directement dans la vue détaillée du planning.
            </p>
          </div>

          {/* Lieu du RDV */}
          <div>
            <label className={lbl}>Lieu / Ville (optionnel)</label>
            <input
              type="text"
              className={field}
              placeholder="Ex : Sur le chantier (Mérignac), Bureau..."
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
            />
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center gap-2 pt-2 border-t border-bna-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 bg-white hover:bg-neutral-50 text-bna-anthracite border border-bna-border rounded-xl font-semibold text-xs active:scale-95"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-3 bg-bna-copper hover:bg-bna-copper-hover text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-copper active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Enregistrement..." : "Enregistrer au planning"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
