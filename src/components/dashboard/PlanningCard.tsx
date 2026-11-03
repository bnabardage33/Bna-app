"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Maximize2,
  CalendarCheck2,
  Package,
  HardHat,
  ChevronRight,
  ListFilter,
  CheckCircle2,
} from "lucide-react";
import type { Chantier } from "@/types/metier";
import {
  buildUnifiedPlanning,
  NATURES_CONFIG,
  type UnifiedPlanningItem,
} from "@/lib/services/planningService";
import { getRendezVous, type RendezVous } from "@/lib/services/rendezVousService";
import {
  getAllCommandes,
  type CommandeAvecFournisseur,
} from "@/lib/services/commandesFournisseursService";
import { createClient } from "@/lib/supabase/client";
import { BnaPlanningView } from "./BnaPlanningView";
import { NewRdvModal } from "./NewRdvModal";
import { PlanningDetailModal } from "./PlanningDetailModal";

interface PlanningCardProps {
  chantiers: Chantier[];
  activeChantierId?: string;
  onSelectChantier?: (id: string) => void;
}

export const PlanningCard: React.FC<PlanningCardProps> = ({
  chantiers,
  activeChantierId,
  onSelectChantier,
}) => {
  const supabase = createClient();
  const [rdvs, setRdvs] = useState<RendezVous[]>([]);
  const [commandes, setCommandes] = useState<CommandeAvecFournisseur[]>([]);
  const [isNewRdvOpen, setIsNewRdvOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Chargement des RDVs et des Commandes Fournisseurs
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [loadedRdvs, loadedCmds] = await Promise.all([
          getRendezVous(supabase),
          getAllCommandes(supabase),
        ]);
        if (isMounted) {
          setRdvs(loadedRdvs);
          setCommandes(loadedCmds);
        }
      } catch {
        // Fallback silencieux
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [supabase, refreshKey]);

  // Construction de la liste unifiée
  const unifiedItems = useMemo(
    () => buildUnifiedPlanning(chantiers, commandes, rdvs),
    [chantiers, commandes, rdvs]
  );

  // Prochains jalons immédiats (top 3)
  const prochainsJalons = useMemo(() => {
    return unifiedItems.slice(0, 3);
  }, [unifiedItems]);

  const countRdvs = unifiedItems.filter((i) => i.type === "rdv").length;
  const countLivraisons = unifiedItems.filter((i) => i.type === "livraison").length;

  const formatDateShort = (dStr: string) => {
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

  return (
    <section className="bg-white border border-bna-border rounded-2xl p-3.5 sm:p-4 shadow-xs mt-3 space-y-3">
      {/* En-tête : Titre + 2 Boutons (Détails et RDV) */}
      <div className="flex items-center justify-between pb-2.5 border-b border-bna-border/60 gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
              PLANNING &amp; JALONS BNA
            </b>
            <span className="bg-orange-50 text-bna-copper border border-orange-200 font-bold rounded-full px-2 py-0.2 text-[10px]">
              {unifiedItems.length}
            </span>
          </div>
          <p className="text-[11px] text-bna-anthracite font-semibold mt-0.5">
            Chantiers · RDV · Livraisons
          </p>
        </div>

        {/* 2 BOUTONS D'ACTION : DÉTAILS & RDV */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsDetailOpen(true)}
            className="px-2.5 py-1.5 text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-bna-anthracite border border-bna-border rounded-xl inline-flex items-center gap-1 transition-all active:scale-95"
            title="Consulter le planning détaillé"
          >
            <ListFilter className="w-3.5 h-3.5 text-bna-muted" />
            <span>Détails</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewRdvOpen(true)}
            className="px-3 py-1.5 text-xs font-bold bg-bna-copper hover:bg-bna-copper-hover text-white rounded-xl inline-flex items-center gap-1 shadow-xs transition-all active:scale-95"
            title="Programmer un nouveau rendez-vous"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>RDV</span>
          </button>
        </div>
      </div>

      {/* ZONE CENTRALE : PLANNING GANTT NATIF REACT/TAILWIND BNA */}
      <div className="space-y-1">
        <BnaPlanningView
          items={unifiedItems}
          onSelectChantier={onSelectChantier}
          onSelectItem={(item) => {
            if (item.chantierId && onSelectChantier) {
              onSelectChantier(item.chantierId);
            }
          }}
        />
      </div>

      {/* APERÇU RAPIDE DES PROCHAINS JALONS IMMÉDIATS (RDV, CHANTIERS, COMMANDES) */}
      {prochainsJalons.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-bna-muted">
              Prochains rendez-vous &amp; jalons
            </span>
            <button
              type="button"
              onClick={() => setIsDetailOpen(true)}
              className="text-[10px] font-bold text-bna-copper hover:underline inline-flex items-center gap-0.5"
            >
              <span>Tout voir</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-bna-border/50 bg-bna-offwhite border border-bna-border rounded-xl overflow-hidden">
            {prochainsJalons.map((it) => (
              <div
                key={it.id}
                onClick={() => setIsDetailOpen(true)}
                className="p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-white transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: it.dotColor }}
                    title={NATURES_CONFIG[it.natureKey]?.label}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-bna-anthracite truncate">
                        {it.titre}
                      </p>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${it.badgeColorClass}`}
                      >
                        {NATURES_CONFIG[it.natureKey]?.label || it.natureKey}
                      </span>
                    </div>
                    <p className="text-[10px] text-bna-muted truncate">
                      {it.sousTitre || it.chantierNom}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] font-bold text-bna-anthracite block">
                    {formatDateShort(it.dateDebut)}
                  </span>
                  {it.heure && (
                    <span className="text-[10px] text-bna-copper font-semibold flex items-center justify-end gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {it.heure}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL CRÉATION DE RDV */}
      <NewRdvModal
        isOpen={isNewRdvOpen}
        onClose={() => setIsNewRdvOpen(false)}
        chantiers={chantiers}
        selectedChantierId={activeChantierId}
        onRdvCreated={() => setRefreshKey((k) => k + 1)}
      />

      {/* MODAL PLANNING DÉTAILLÉ COMPLET */}
      <PlanningDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        items={unifiedItems}
        rdvs={rdvs}
        onOpenNewRdv={() => {
          setIsDetailOpen(false);
          setIsNewRdvOpen(true);
        }}
        onRefresh={() => setRefreshKey((k) => k + 1)}
      />
    </section>
  );
};
