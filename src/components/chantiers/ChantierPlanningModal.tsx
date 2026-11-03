"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Package,
  Truck,
  CheckCircle2,
  CalendarCheck2,
  HardHat,
  Plus,
  Trash2,
  Save,
  Layers,
  ChevronRight,
  AlertCircle,
  FileText,
} from "lucide-react";
import type { Chantier, MetierType } from "@/types/metier";
import {
  buildChantierPlanningItems,
  generateChantierMermaidGantt,
  NATURES_CONFIG,
  type UnifiedPlanningItem,
  type NatureKey,
} from "@/lib/services/planningService";
import {
  getRendezVousByChantier,
  supprimerRendezVous,
  updateRendezVous,
  type RendezVous,
} from "@/lib/services/rendezVousService";
import {
  getCommandesByChantier,
  type CommandeAvecFournisseur,
} from "@/lib/services/commandesFournisseursService";
import { updateChantierDates } from "@/lib/services/chantierService";
import { createClient } from "@/lib/supabase/client";
import { BnaPlanningView } from "@/components/dashboard/BnaPlanningView";
import { NewRdvModal } from "@/components/dashboard/NewRdvModal";

interface ChantierPlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  chantier: Chantier;
  onChantierUpdated?: (updatedDates: { dateDebut?: string; dateFin?: string }) => void;
}

export const ChantierPlanningModal: React.FC<ChantierPlanningModalProps> = ({
  isOpen,
  onClose,
  chantier,
  onChantierUpdated,
}) => {
  const supabase = createClient();

  // Dates du chantier (connectées au calendrier de création de chantier)
  const [dateDebut, setDateDebut] = useState<string>(
    chantier.date_debut_prevue || new Date().toISOString().slice(0, 10)
  );
  const [dateFin, setDateFin] = useState<string>(
    chantier.date_fin_prevue || ""
  );
  const [isSavingDates, setIsSavingDates] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Données connectées : RDVs et Commandes Fournisseurs
  const [rdvs, setRdvs] = useState<RendezVous[]>([]);
  const [commandes, setCommandes] = useState<CommandeAvecFournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewRdvOpen, setIsNewRdvOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [vueMode, setVueMode] = useState<"gantt" | "jalons">("gantt");

  // Synchronisation des dates au montage ou changement de chantier
  useEffect(() => {
    if (chantier) {
      setDateDebut(chantier.date_debut_prevue || new Date().toISOString().slice(0, 10));
      setDateFin(chantier.date_fin_prevue || "");
    }
  }, [chantier]);

  // Chargement des données connectées (RDVs chantier + Commandes fournisseurs chantier)
  const loadChantierData = useCallback(async () => {
    if (!chantier?.id) return;
    setLoading(true);
    try {
      const [loadedRdvs, loadedCmds] = await Promise.all([
        getRendezVousByChantier(supabase, chantier.id),
        getCommandesByChantier(supabase, chantier.id),
      ]);
      setRdvs(loadedRdvs);
      setCommandes(loadedCmds);
    } catch {
      // Tolérance offline
    } finally {
      setLoading(false);
    }
  }, [supabase, chantier.id, refreshKey]);

  useEffect(() => {
    if (isOpen) {
      loadChantierData();
    }
  }, [isOpen, loadChantierData]);

  // Chantier consolidé avec les dates en cours
  const currentChantierConsolide = useMemo<Chantier>(() => {
    return {
      ...chantier,
      date_debut_prevue: dateDebut,
      date_fin_prevue: dateFin || undefined,
    };
  }, [chantier, dateDebut, dateFin]);

  // Calcul du diagramme Mermaid Gantt Chantier V2
  const mermaidChart = useMemo(() => {
    return generateChantierMermaidGantt(currentChantierConsolide, commandes, rdvs);
  }, [currentChantierConsolide, commandes, rdvs]);

  // Éléments unifiés du chantier
  const items = useMemo(() => {
    return buildChantierPlanningItems(currentChantierConsolide, commandes, rdvs);
  }, [currentChantierConsolide, commandes, rdvs]);

  // Sauvegarde des dates du chantier (connecté à la création et au planning général)
  const handleSaveDates = async () => {
    setIsSavingDates(true);
    setSaveSuccess(false);
    try {
      await updateChantierDates(supabase, chantier.id, dateDebut, dateFin || null);
      if (onChantierUpdated) {
        onChantierUpdated({ dateDebut, dateFin });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Erreur enregistrement dates :", err);
    } finally {
      setIsSavingDates(false);
    }
  };

  // Suppression d'un RDV
  const handleDeleteRdv = async (rdvId: string) => {
    if (confirm("Supprimer ce rendez-vous du planning de ce chantier ?")) {
      await supprimerRendezVous(supabase, rdvId);
      setRefreshKey((k) => k + 1);
    }
  };

  // Bascule du statut effectué / planifié
  const handleToggleRdvStatut = async (rdvId: string, currentStatut: string) => {
    const nextStatut = currentStatut === "effectue" ? "planifie" : "effectue";
    await updateRendezVous(supabase, rdvId, { statut: nextStatut });
    setRefreshKey((k) => k + 1);
  };

  // Calcul du nombre de jours entre début et fin
  const dureeJours = useMemo(() => {
    if (!dateDebut || !dateFin) return null;
    const d1 = new Date(dateDebut).getTime();
    const d2 = new Date(dateFin).getTime();
    if (isNaN(d1) || isNaN(d2) || d2 < d1) return null;
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    return diff;
  }, [dateDebut, dateFin]);

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

  if (!isOpen) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      >
        <div
          className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-bna-border overflow-hidden my-auto max-h-[96vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER COCKPIT PLANNING */}
          <div className="px-4 py-3 bg-bna-offwhite border-b border-bna-border flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-bna-copper/10 border border-bna-copper/30 flex items-center justify-center text-bna-copper shrink-0">
                <CalendarCheck2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold tracking-wider text-bna-muted uppercase">
                    COCKPIT CHANTIER · V2
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                    Avancement : {chantier.avancementGlobal}%
                  </span>
                </div>
                <h3 className="text-base font-bold text-bna-anthracite truncate">
                  Planning &amp; Jalons — {chantier.nom}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsNewRdvOpen(true)}
                className="px-3 py-1.5 bg-bna-copper hover:bg-bna-copper-hover text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-copper active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouveau RDV</span>
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

          {/* CORPS PRINCIPAL DÉFILANT */}
          <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
            {/* 1. CARTOUCHE DATES CLÉS (CONNECTÉ AU CALENDRIER DE CRÉATION DE CHANTIER) */}
            <div className="p-3.5 bg-neutral-50 border border-bna-border rounded-2xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-bna-copper" />
                  <span className="text-xs font-bold text-bna-anthracite">
                    Calendrier d&apos;intervention du chantier
                  </span>
                </div>
                {dureeJours !== null && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-orange-100/70 text-orange-900 border border-orange-200">
                    Durée prévue : {dureeJours} jour{dureeJours > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-bna-muted block mb-1">
                    Date de début de chantier
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-xs bg-white border border-bna-border rounded-xl focus:outline-none focus:ring-1 focus:ring-bna-copper font-medium"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-bna-muted block mb-1">
                    Date de fin prévue (réception client)
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-xs bg-white border border-bna-border rounded-xl focus:outline-none focus:ring-1 focus:ring-bna-copper font-medium"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-bna-muted">
                  Connecté à la création du chantier et répercuté automatiquement sur le planning général.
                </p>
                <button
                  type="button"
                  onClick={handleSaveDates}
                  disabled={isSavingDates}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingDates ? "Sauvegarde..." : saveSuccess ? "Enregistré !" : "Enregistrer les dates"}</span>
                </button>
              </div>
            </div>

            {/* 2. SÉLECTEUR DE VUE (GANTT MERMAID.JS OU LISTE CHRONOLOGIQUE) */}
            <div className="flex items-center justify-between border-b border-bna-border pb-2 gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setVueMode("gantt")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                    vueMode === "gantt"
                      ? "bg-bna-copper text-white shadow-xs"
                      : "bg-neutral-100 text-bna-anthracite hover:bg-neutral-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Planning Mermaid.js</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVueMode("jalons")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                    vueMode === "jalons"
                      ? "bg-bna-copper text-white shadow-xs"
                      : "bg-neutral-100 text-bna-anthracite hover:bg-neutral-200"
                  }`}
                >
                  <CalendarCheck2 className="w-3.5 h-3.5" />
                  <span>Chronologie &amp; Détails ({items.length})</span>
                </button>
              </div>

              {/* LÉGENDE DES COULEURS PAR NATURE */}
              <div className="hidden sm:flex items-center gap-2 text-[10px] font-semibold text-bna-muted">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-600" />
                  Technique
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  Réception
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  Client
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-600" />
                  Livraison
                </span>
              </div>
            </div>

            {/* 3. VUE GANTT BNA DÉDIÉE AU CHANTIER */}
            {vueMode === "gantt" && (
              <div className="space-y-2">
                <BnaPlanningView items={items} />
              </div>
            )}

            {/* 4. VUE LISTE CHRONOLOGIQUE AVEC NATURES & ENCADRÉS COMPLETS */}
            {vueMode === "jalons" && (
              <div className="space-y-3">
                {items.length === 0 ? (
                  <div className="p-8 text-center text-bna-muted space-y-2 bg-neutral-50 rounded-2xl border border-dashed border-bna-border">
                    <p>Aucun événement planifié pour ce chantier.</p>
                    <button
                      type="button"
                      onClick={() => setIsNewRdvOpen(true)}
                      className="px-3 py-1.5 bg-bna-copper text-white text-xs font-bold rounded-xl inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Programmer un RDV
                    </button>
                  </div>
                ) : (
                  items.map((it) => {
                    const isRdv = it.type === "rdv";
                    const rawRdvId = it.id.replace("rdv-", "");

                    return (
                      <div
                        key={it.id}
                        className="p-3.5 bg-white border border-bna-border hover:border-bna-copper/60 rounded-2xl shadow-xs space-y-2.5 transition-all"
                      >
                        {/* Ligne haute */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="p-2 rounded-xl bg-bna-offwhite border border-bna-border shrink-0 mt-0.5">
                              {it.type === "rdv" && <CalendarCheck2 className="w-4 h-4 text-amber-600" />}
                              {it.type === "chantier" && <HardHat className="w-4 h-4 text-blue-600" />}
                              {it.type === "livraison" && <Truck className="w-4 h-4 text-purple-600" />}
                              {it.type === "commande" && <Package className="w-4 h-4 text-purple-600" />}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-sm text-bna-anthracite">
                                  {it.titre}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${it.badgeColorClass}`}
                                >
                                  {NATURES_CONFIG[it.natureKey]?.label || it.natureKey}
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
                                  {it.statutLabel}
                                </span>
                              </div>
                              {it.sousTitre && (
                                <p className="text-xs text-bna-muted mt-0.5">{it.sousTitre}</p>
                              )}
                            </div>
                          </div>

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

                        {/* ENCADRÉ NATURE DÉTAILLÉ */}
                        {it.nature && (
                          <div className="p-2.5 bg-bna-offwhite border border-bna-border/80 rounded-xl space-y-1">
                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-bna-anthracite">
                              <FileText className="w-3 h-3 text-bna-copper" />
                              <span>Nature &amp; Consignes terrain</span>
                            </div>
                            <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-line">
                              {it.nature}
                            </p>
                          </div>
                        )}

                        {/* Actions RDV */}
                        {isRdv && (
                          <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                            <button
                              type="button"
                              onClick={() => handleToggleRdvStatut(rawRdvId, it.statut)}
                              className={`text-[11px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 transition-all ${
                                it.statut === "effectue"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100"
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{it.statut === "effectue" ? "Jalon effectué ✓" : "Marquer comme fait"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteRdv(rawRdvId)}
                              className="text-[11px] font-medium text-red-600 hover:text-red-800 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
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

          {/* FOOTER ACTIONS */}
          <div className="p-3 bg-neutral-50 border-t border-bna-border flex items-center justify-between shrink-0">
            <span className="text-[11px] text-bna-muted">
              Synchronisé en temps réel avec le planning général et les commandes fournisseurs.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-all active:scale-95"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* MODALE DE CRÉATION DE RDV POUR CE CHANTIER */}
      {isNewRdvOpen && (
        <NewRdvModal
          isOpen={isNewRdvOpen}
          onClose={() => setIsNewRdvOpen(false)}
          chantiers={[chantier]}
          selectedChantierId={chantier.id}
          onRdvCreated={() => {
            setRefreshKey((k) => k + 1);
            if (onChantierUpdated) {
              onChantierUpdated({});
            }
          }}
        />
      )}
    </>
  );
};
