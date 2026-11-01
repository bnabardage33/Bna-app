"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Filter,
  Layers,
  Trash2,
  CalendarCheck2,
  HardHat,
} from "lucide-react";
import type { UnifiedPlanningItem } from "@/lib/services/planningService";
import type { RendezVous } from "@/lib/services/rendezVousService";
import { supprimerRendezVous, updateRendezVous } from "@/lib/services/rendezVousService";
import { MermaidViewer } from "./MermaidViewer";
import { createClient } from "@/lib/supabase/client";

interface PlanningDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: UnifiedPlanningItem[];
  rdvs: RendezVous[];
  ganttDefinition: string;
  onOpenNewRdv: () => void;
  onRefresh: () => void;
}

export const PlanningDetailModal: React.FC<PlanningDetailModalProps> = ({
  isOpen,
  onClose,
  items,
  rdvs,
  ganttDefinition,
  onOpenNewRdv,
  onRefresh,
}) => {
  const supabase = createClient();
  const [filterType, setFilterType] = useState<"tous" | "rdv" | "chantier" | "commande">("tous");
  const [vueMode, setVueMode] = useState<"timeline" | "gantt">("timeline");

  if (!isOpen) return null;

  const filteredItems = items.filter((it) => {
    if (filterType === "tous") return true;
    if (filterType === "rdv") return it.type === "rdv";
    if (filterType === "chantier") return it.type === "chantier";
    if (filterType === "commande") return it.type === "commande" || it.type === "livraison";
    return true;
  });

  const countRdvs = items.filter((i) => i.type === "rdv").length;
  const countChantiers = items.filter((i) => i.type === "chantier").length;
  const countCommandes = items.filter((i) => i.type === "commande" || i.type === "livraison").length;

  const handleDeleteRdv = async (rdvId: string) => {
    if (confirm("Supprimer ce rendez-vous du planning ?")) {
      await supprimerRendezVous(supabase, rdvId);
      onRefresh();
    }
  };

  const handleToggleRdvStatut = async (rdvId: string, currentStatut: string) => {
    const nextStatut = currentStatut === "effectue" ? "planifie" : "effectue";
    await updateRendezVous(supabase, rdvId, { statut: nextStatut });
    onRefresh();
  };

  const formatDateFr = (dStr: string) => {
    try {
      const [y, m, d] = dStr.split("-");
      if (y && m && d) {
        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        return dateObj.toLocaleDateString("fr-FR", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
      }
    } catch {
      // fallback
    }
    return dStr;
  };

  const getIconForType = (type: UnifiedPlanningItem["type"]) => {
    switch (type) {
      case "rdv":
        return <CalendarCheck2 className="w-4 h-4 text-amber-600" />;
      case "chantier":
        return <HardHat className="w-4 h-4 text-blue-600" />;
      case "livraison":
        return <Truck className="w-4 h-4 text-bna-copper" />;
      case "commande":
        return <Package className="w-4 h-4 text-purple-600" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-bna-border overflow-hidden my-auto max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-bna-offwhite border-b border-bna-border flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider text-bna-muted uppercase">
                DASHBOARD CENTRALISÉ
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                {items.length} jalons
              </span>
            </div>
            <h3 className="text-base font-bold text-bna-anthracite">
              Planning Général &amp; Jalons BNA
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenNewRdv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-bna-copper text-white rounded-xl shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" /> Nouveau RDV
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-bna-muted hover:text-bna-anthracite rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Synthèse rapide & Switch de vue */}
        <div className="px-4 py-2.5 bg-neutral-50 border-b border-bna-border flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 text-bna-muted">
            <span>
              <b className="text-bna-anthracite">{countChantiers}</b> chantiers
            </span>
            <span>·</span>
            <span>
              <b className="text-bna-anthracite">{countRdvs}</b> rendez-vous
            </span>
            <span>·</span>
            <span>
              <b className="text-bna-anthracite">{countCommandes}</b> commandes &amp; livraisons
            </span>
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-bna-border font-semibold text-[11px]">
            <button
              type="button"
              onClick={() => setVueMode("timeline")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                vueMode === "timeline"
                  ? "bg-bna-copper text-white shadow-2xs font-bold"
                  : "text-bna-muted hover:text-bna-anthracite"
              }`}
            >
              Timeline détaillée
            </button>
            <button
              type="button"
              onClick={() => setVueMode("gantt")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                vueMode === "gantt"
                  ? "bg-bna-copper text-white shadow-2xs font-bold"
                  : "text-bna-muted hover:text-bna-anthracite"
              }`}
            >
              Diagramme Gantt Mermaid
            </button>
          </div>
        </div>

        {/* Barre de filtres par type */}
        <div className="px-4 py-2 bg-white border-b border-bna-border/80 flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { id: "tous", label: "Tous", count: items.length },
            { id: "rdv", label: "Rendez-vous", count: countRdvs },
            { id: "chantier", label: "Chantiers & Étapes", count: countChantiers },
            { id: "commande", label: "Commandes & Livraisons", count: countCommandes },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-semibold border shrink-0 transition-all flex items-center gap-1.5 ${
                filterType === tab.id
                  ? "bg-neutral-900 text-white border-neutral-900 font-bold"
                  : "bg-neutral-100 text-bna-anthracite border-transparent hover:bg-neutral-200/70"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  filterType === tab.id ? "bg-white/20 text-white" : "bg-white text-bna-muted"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Corps principal */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {vueMode === "gantt" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-bna-muted">
                <span>Diagramme Gantt généré par Mermaid.js</span>
                <span>Défilement horizontal tactile</span>
              </div>
              <MermaidViewer chart={ganttDefinition} minWidth={700} />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-bna-muted text-xs space-y-2">
                  <p>Aucun élément planifié pour ce filtre.</p>
                  <button
                    type="button"
                    onClick={onOpenNewRdv}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-bna-copper bg-orange-50 border border-orange-200 rounded-xl"
                  >
                    <Plus className="w-3.5 h-3.5" /> Créer un rendez-vous
                  </button>
                </div>
              ) : (
                filteredItems.map((it) => {
                  const isRdv = it.type === "rdv";
                  const rawRdvId = it.id.replace("rdv-", "");

                  return (
                    <div
                      key={it.id}
                      className="p-3.5 bg-white border border-bna-border hover:border-bna-copper/60 rounded-2xl shadow-xs space-y-2.5 transition-all"
                    >
                      {/* Ligne haute : Type, Titre, Dates & Statut */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="p-2 rounded-xl bg-bna-offwhite border border-bna-border shrink-0 mt-0.5">
                            {getIconForType(it.type)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-bna-anthracite">
                                {it.titre}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${it.badgeColorClass}`}
                              >
                                {it.statutLabel}
                              </span>
                            </div>
                            {it.sousTitre && (
                              <p className="text-xs text-bna-muted mt-0.5">{it.sousTitre}</p>
                            )}
                          </div>
                        </div>

                        {/* Date & Heure */}
                        <div className="text-right shrink-0">
                          <span className="font-bold text-xs text-bna-anthracite block">
                            {formatDateFr(it.dateDebut)}
                          </span>
                          {it.heure && (
                            <span className="text-[11px] font-semibold text-bna-copper flex items-center justify-end gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {it.heure}
                            </span>
                          )}
                          {it.dateFin && it.dateFin !== it.dateDebut && (
                            <span className="text-[10px] text-bna-muted block mt-0.5">
                              jusqu&apos;au {formatDateFr(it.dateFin)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ENCADRÉ NATURE DU RENDEZ-VOUS / DÉTAIL TECHNIQUE */}
                      {it.nature && (
                        <div className="p-2.5 bg-bna-offwhite border border-bna-border rounded-xl text-xs space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-bna-copper block">
                            {isRdv ? "Nature & Objectifs du Rendez-vous :" : "Détails & Consignes :"}
                          </span>
                          <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                            {it.nature}
                          </p>
                        </div>
                      )}

                      {/* Actions spécifiques pour les Rendez-vous */}
                      {isRdv && (
                        <div className="flex items-center justify-between pt-1 border-t border-bna-border/50 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleToggleRdvStatut(rawRdvId, it.statut)}
                            className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-emerald-700"
                          >
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${
                                it.statut === "effectue" ? "text-emerald-600" : "text-neutral-400"
                              }`}
                            />
                            <span>
                              {it.statut === "effectue"
                                ? "Marqué comme effectué"
                                : "Marquer comme fait"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteRdv(rawRdvId)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Supprimer</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-bna-offwhite border-t border-bna-border flex items-center justify-between">
          <p className="text-[11px] text-bna-muted">
            Toutes les actions et rendez-vous sont synchronisés en direct avec le planning général.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 text-white font-bold text-xs rounded-xl hover:bg-neutral-800 active:scale-95"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
