"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Camera,
  Mic,
  AlertTriangle,
  Calendar,
  Grid,
  Package,
  FileText,
  DollarSign,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Trash2,
  Edit3,
  ShieldAlert,
} from "lucide-react";
import { Chantier, METIERS_CONFIG } from "@/types/metier";
import { MOCK_CHANTIERS } from "@/data/mockChantiers";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { createClient } from "@/lib/supabase/client";
import {
  getCalepinagesTerrasseByChantier,
  getLatestCalepinageBardage,
  getBesoinsByChantier,
  CalepinageVersionItem,
} from "@/lib/services/calepinageService";
import { QuantitatifsTerrasseModal } from "@/components/calepinage/QuantitatifsTerrasseModal";
import { MateriauxCommandesModal } from "@/components/materiaux/MateriauxCommandesModal";
import { ChantierWeatherCard } from "@/components/weather/ChantierWeatherCard";
import { UpdateAvancementModal } from "@/components/chantiers/UpdateAvancementModal";
import { ChantierPlanningModal } from "@/components/chantiers/ChantierPlanningModal";
import {
  ChantierAvancementState,
  loadChantierAvancement,
  saveChantierAvancement,
  fetchChantierLiveMateriaux,
} from "@/lib/services/avancementService";

interface CockpitScreenProps {
  chantier?: Chantier | null;
  onBack: () => void;
  onOpenCalepinage: (sourceVersion?: CalepinageVersionItem | null) => void;
  onSoftDelete?: (chantierId: string) => void;
  refreshKey?: number;
}

export const CockpitScreen: React.FC<CockpitScreenProps> = ({
  chantier,
  onBack,
  onOpenCalepinage,
  onSoftDelete,
  refreshKey = 0,
}) => {
  if (!chantier) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-sm font-semibold text-bna-anthracite">Aucun chantier sélectionné</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-bna-copper hover:bg-bna-copper-hover text-white text-xs font-bold rounded-xl transition-colors"
        >
          Retour aux chantiers
        </button>
      </div>
    );
  }

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const metierConfig = METIERS_CONFIG[chantier.metier];

  // Modales dédiées aux accès secondaires
  const [isQuantitatifsOpen, setIsQuantitatifsOpen] = useState(false);
  const [isMateriauxOpen, setIsMateriauxOpen] = useState(false);
  const [isPlanningOpen, setIsPlanningOpen] = useState(false);
  const [chantierDates, setChantierDates] = useState<{ dateDebut?: string; dateFin?: string }>({
    dateDebut: chantier.date_debut_prevue,
    dateFin: chantier.date_fin_prevue,
  });

  const displayChantier: Chantier = useMemo(() => ({
    ...chantier,
    date_debut_prevue: chantierDates.dateDebut ?? chantier.date_debut_prevue,
    date_fin_prevue: chantierDates.dateFin ?? chantier.date_fin_prevue,
  }), [chantier, chantierDates]);

  // Indicateurs temps réel issus de Supabase
  const [latestVersion, setLatestVersion] = useState<number | null>(null);
  const [aCommanderCount, setACommanderCount] = useState<number>(0);

  // État d'avancement dynamique BNA-Dashboard
  const [avancementState, setAvancementState] = useState<ChantierAvancementState>(() =>
    loadChantierAvancement(chantier.id, chantier.metier, chantier.avancementGlobal, chantier)
  );
  const [isUpdateAvancementOpen, setIsUpdateAvancementOpen] = useState(false);

  const supabase = createClient();

  const loadIndicators = useCallback(async () => {
    if (!chantier?.id) return;
    try {
      // 1. Version active calepinage terrasse ou bardage
      if (chantier.metier === "terrasse") {
        const cals = await getCalepinagesTerrasseByChantier(supabase, chantier.id);
        const active = cals.find((c) => c.calepinage.statut === "valide");
        setLatestVersion(active ? active.calepinage.version : null);
      } else if (chantier.metier === "facade") {
        const activeBardage = await getLatestCalepinageBardage(supabase, chantier.id);
        setLatestVersion(activeBardage ? activeBardage.calepinage.version : null);
      } else {
        setLatestVersion(null);
      }

      // 2. Besoins actifs à commander
      const besoinsRes = await getBesoinsByChantier(supabase, chantier.id);
      setACommanderCount(besoinsRes.totalACommander);
    } catch {
      // Conservation silencieuse en cas d'erreur de réseau temporaire
    }
  }, [supabase, chantier.id, chantier.metier]);

  const refreshAvancement = useCallback(async () => {
    if (!chantier?.id) return;
    const loaded = loadChantierAvancement(chantier.id, chantier.metier, chantier.avancementGlobal, chantier);
    try {
      const liveMats = await fetchChantierLiveMateriaux(supabase, chantier.id, chantier.metier);
      if (liveMats.length > 0) loaded.materiaux = liveMats;
    } catch {
      // Ignorer
    }
    setAvancementState(loaded);
  }, [chantier, supabase]);

  useEffect(() => {
    loadIndicators();
    refreshAvancement();
  }, [loadIndicators, refreshAvancement, refreshKey]);

  const handleSaveAvancement = async (newState: ChantierAvancementState) => {
    await saveChantierAvancement(supabase, chantier.id, newState);
    setAvancementState(newState);
  };

  return (
    <div className="space-y-3 pb-8 animate-in fade-in duration-150">
      {/* Header Cockpit avec retour */}
      <div className="flex items-center justify-between pt-1 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-bna-muted hover:text-bna-anthracite py-1 pr-2 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${metierConfig.badgeColor}`}>
            {metierConfig.label}
          </span>
          {onSoftDelete && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 rounded-lg text-bna-muted hover:text-bna-anthracite hover:bg-neutral-100 transition-colors"
                aria-label="Actions chantier"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-44 bg-white rounded-2xl shadow-xl border border-bna-border py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmDeleteOpen(true);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                      <span>Mettre à la corbeille</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        title="Mettre ce chantier à la corbeille ?"
        message="Le chantier ne sera plus visible dans la liste active. Il pourra être restauré depuis la corbeille."
        confirmLabel="Mettre à la corbeille"
        cancelLabel="Annuler"
        isDestructive={true}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          if (onSoftDelete) onSoftDelete(chantier.id);
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* Titre & Info Chantier */}
      <div>
        <span className="text-[10px] font-bold tracking-wider text-bna-muted uppercase">
          COCKPIT CHANTIER
        </span>
        <h1 className="font-display font-bold text-2xl text-bna-anthracite mt-0.5">
          {chantier.nom}
        </h1>
        <p className="text-xs text-bna-muted">{chantier.ville} · {chantier.intervention}</p>
      </div>

      {/* 1. Avancement - Spécifique au métier */}
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
        <div className="flex justify-between items-center text-xs mb-2">
          <div className="flex items-center gap-2">
            <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
              AVANCEMENT DU PROJET
            </b>
            <button
              type="button"
              onClick={() => setIsUpdateAvancementOpen(true)}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-bna-copper bg-bna-copper-light/60 hover:bg-orange-100 border border-orange-200/60 px-2 py-0.5 rounded-lg transition-all active:scale-95"
            >
              <Edit3 className="w-3 h-3" />
              <span>Ajuster</span>
            </button>
          </div>
          <b className="font-display font-black text-sm text-bna-copper">
            {avancementState.avancementGlobal} %
          </b>
        </div>
        <div className="w-full h-2 bg-neutral-200/80 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-bna-copper rounded-full transition-all duration-500"
            style={{ width: `${avancementState.avancementGlobal}%` }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-bna-muted mt-2 pt-1 border-t border-bna-border/40">
          {avancementState.avancementDetails.map((det, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span className="truncate pr-2">{det.label}</span>
              <span
                className={`font-semibold shrink-0 ${
                  det.pourcentage === 100
                    ? "text-emerald-700 font-bold"
                    : det.pourcentage > 0
                    ? "text-amber-800"
                    : "text-slate-400"
                }`}
              >
                {det.pourcentage}%
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Prochaine étape */}
      {avancementState.prochaineEtape && (
        <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
              PROCHAINE ÉTAPE
            </b>
            <button
              type="button"
              onClick={() => setIsUpdateAvancementOpen(true)}
              className="text-[10px] font-bold text-bna-copper hover:underline"
            >
              Modifier
            </button>
          </div>
          <div className="flex items-start gap-2.5 mt-2">
            <div className="w-6 h-6 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0 mt-0.5 text-bna-copper">
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-bna-anthracite">
                {avancementState.prochaineEtape.titre}
              </h4>
              <p className="text-[11px] text-bna-muted mt-0.5">
                {avancementState.prochaineEtape.detail}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 3. Météo du Chantier en Temps Réel + Prévisions Semaine + Vigilance Météo-France */}
      <ChantierWeatherCard chantier={chantier} />

      {/* 4. Matériaux à surveiller (avec sémantique couleur BNA) */}
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
        <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase block mb-2">
          MATÉRIAUX À SURVEILLER
        </b>
        <div className="space-y-2 text-xs">
          {avancementState.materiaux.map((mat, idx) => {
            const isVigilance = mat.statut === "vigilance";
            const isAlerte = mat.statut === "alerte";
            const badgeClass = isAlerte
              ? "text-rose-700 bg-rose-100/70 border-rose-200"
              : isVigilance
              ? "text-amber-700 bg-amber-100/70 border-amber-200"
              : "text-emerald-700 bg-emerald-100/70 border-emerald-200";

            return (
              <div key={idx} className="flex items-center justify-between p-2 bg-bna-offwhite rounded-xl border border-bna-border">
                <span className="font-medium text-bna-anthracite">{mat.nom}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badgeClass}`}>
                  {mat.detail}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Blocages */}
      {avancementState.blocage && avancementState.blocage.titre && (
        <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <b className="text-[11px] font-bold tracking-wider text-rose-800 uppercase">
              BLOCAGES & POINTS CRITIQUES
            </b>
            <button
              type="button"
              onClick={() => setIsUpdateAvancementOpen(true)}
              className="text-[10px] font-bold text-rose-700 hover:underline"
            >
              Gérer
            </button>
          </div>
          <div className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200/70 rounded-xl text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <span className="font-semibold block">{avancementState.blocage.titre}</span>
              <span className="text-[11px] text-rose-700">{avancementState.blocage.detail}</span>
            </div>
          </div>
        </section>
      )}

      {/* 6. Photos / Note rapide */}
      <div className="flex gap-2">
        <button
          onClick={() => alert("Capture photo cockpit")}
          className="flex-1 min-h-[44px] bg-white border border-bna-border hover:bg-neutral-50 text-bna-anthracite font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
        >
          <Camera className="w-4 h-4 text-bna-muted" />
          <span>Prendre une photo</span>
        </button>
        <button
          onClick={() => alert("Note vocale chantier")}
          className="flex-1 min-h-[44px] bg-white border border-bna-border hover:bg-neutral-50 text-bna-anthracite font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
        >
          <Mic className="w-4 h-4 text-bna-muted" />
          <span>Note rapide</span>
        </button>
      </div>

      {/* 7. Accès Secondaires (Existants) */}
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
        <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase block mb-2">
          ACCÈS SECONDAIRES
        </b>
        <div className="divide-y divide-bna-border/50 text-xs">
          {/* Planning & Jalons (Mermaid.js V2) */}
          <div
            onClick={() => setIsPlanningOpen(true)}
            className="flex items-center justify-between py-2.5 cursor-pointer hover:text-bna-copper transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-bna-copper" />
              <span className="font-medium text-bna-anthracite">Planning &amp; Jalons</span>
            </div>
            <div className="flex items-center gap-1.5">
              {displayChantier.date_debut_prevue && (
                <span className="text-[10px] font-semibold text-bna-muted px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                  Dès le {displayChantier.date_debut_prevue}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-bna-muted" />
            </div>
          </div>

          {/* Calepinage (Terrasse / Métier) */}
          <div
            onClick={() => {
              if (chantier.metier === "terrasse") {
                setIsQuantitatifsOpen(true);
              } else {
                onOpenCalepinage();
              }
            }}
            className="flex items-center justify-between py-2.5 cursor-pointer hover:text-bna-copper transition-colors"
          >
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-bna-copper" />
              <span className="font-medium text-bna-anthracite">
                Calepinage ({metierConfig.label})
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(chantier.metier === "terrasse" || chantier.metier === "facade") && (
                latestVersion !== null ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    V{latestVersion} ✓
                  </span>
                ) : (
                  <span className="text-[10px] text-bna-muted">Aucun</span>
                )
              )}
              <ChevronRight className="w-4 h-4 text-bna-muted" />
            </div>
          </div>

          {/* Matériaux & Commandes */}
          <div
            onClick={() => setIsMateriauxOpen(true)}
            className="flex items-center justify-between py-2.5 cursor-pointer hover:text-bna-copper transition-colors"
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-bna-muted" />
              <span className="font-medium text-bna-anthracite">Matériaux & Commandes</span>
            </div>
            <div className="flex items-center gap-2">
              {aCommanderCount > 0 ? (
                <span className="text-[10px] font-semibold text-bna-copper bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                  {aCommanderCount} à commander
                </span>
              ) : (
                <span className="text-[10px] text-bna-muted">0 besoin</span>
              )}
              <ChevronRight className="w-4 h-4 text-bna-muted" />
            </div>
          </div>

          {/* Documents & Devis */}
          <div
            onClick={() => alert("Accès Documents & Devis")}
            className="flex items-center justify-between py-2.5 cursor-pointer hover:text-bna-copper transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-bna-muted" />
              <span className="font-medium text-bna-anthracite">Documents & Devis</span>
            </div>
            <ChevronRight className="w-4 h-4 text-bna-muted" />
          </div>

          {/* Dépenses & Heures passées */}
          <div
            onClick={() => alert("Accès Dépenses & Heures")}
            className="flex items-center justify-between py-2.5 cursor-pointer hover:text-bna-copper transition-colors"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-bna-muted" />
              <span className="font-medium text-bna-anthracite">Dépenses & Heures passées</span>
            </div>
            <ChevronRight className="w-4 h-4 text-bna-muted" />
          </div>
        </div>
      </section>

      {/* Modal Quantitatifs Terrasse (Vue liste versions active/archivée) */}
      <QuantitatifsTerrasseModal
        isOpen={isQuantitatifsOpen}
        onClose={() => {
          setIsQuantitatifsOpen(false);
          loadIndicators();
        }}
        chantierId={chantier.id}
        chantierNom={chantier.nom}
        onOpenNewVersion={(sourceVersion) => {
          setIsQuantitatifsOpen(false);
          onOpenCalepinage(sourceVersion);
        }}
      />

      {/* Modal Matériaux & Commandes (Besoins actifs & Historique) */}
      <MateriauxCommandesModal
        isOpen={isMateriauxOpen}
        onClose={() => {
          setIsMateriauxOpen(false);
          loadIndicators();
        }}
        chantierId={chantier.id}
        chantierNom={chantier.nom}
      />

      {/* Modal Mise à jour Avancement BNA */}
      <UpdateAvancementModal
        isOpen={isUpdateAvancementOpen}
        onClose={() => setIsUpdateAvancementOpen(false)}
        chantier={chantier}
        currentState={avancementState}
        onSave={handleSaveAvancement}
      />

      {/* Modal Planning & Jalons Chantier V2 (Mermaid.js) */}
      <ChantierPlanningModal
        isOpen={isPlanningOpen}
        onClose={() => setIsPlanningOpen(false)}
        chantier={displayChantier}
        onChantierUpdated={(updated) => {
          setChantierDates((prev) => ({ ...prev, ...updated }));
        }}
      />
    </div>
  );
};
