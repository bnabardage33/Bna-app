"use client";

import React, { useState, useEffect } from "react";
import { BardageCalepinagePanel } from "./BardageCalepinagePanel";
import { ClotureCalepinagePanel } from "./ClotureCalepinagePanel";
import { TerrasseCalepinagePanel } from "./TerrasseCalepinagePanel";
import { X, Calculator, CheckCircle2, History, AlertCircle } from "lucide-react";
import type { CalepinageParams } from "@/lib/calepinage";
import { MetierType, METIERS_CONFIG } from "@/types/metier";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import {
  saveCalepinageTerrasse,
  getLatestCalepinageTerrasse,
  CalepinageVersionItem,
} from "@/lib/services/calepinageService";
import { getChantiers } from "@/lib/services/chantierService";
import type { Chantier } from "@/types/metier";

interface CalepinageModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMetier?: MetierType;
  chantierId?: string;
  initialVersionItem?: CalepinageVersionItem | null;
  onCalepinageSaved?: () => void;
}

const labelCls = "text-[11px] font-bold text-slate-400 uppercase block";
const selectCls =
  "w-full mt-1 px-3 py-2 border border-slate-700 rounded-xl text-xs font-semibold text-white bg-slate-900 focus:outline-hidden focus:border-orange-500";

export const CalepinageModal: React.FC<CalepinageModalProps> = ({
  isOpen,
  onClose,
  defaultMetier = "terrasse",
  chantierId: chantierIdProp,
  initialVersionItem,
  onCalepinageSaved,
}) => {
  const { entreprise } = useAuth();
  const [selectedMetier, setSelectedMetier] = useState<MetierType>(defaultMetier);

  // Versions et statut technique
  const [sourceVersionNumber, setSourceVersionNumber] = useState<number | null>(null);
  const [sourceStatut, setSourceStatut] = useState<string | null>(null);
  const [nextVersionNumber, setNextVersionNumber] = useState<number>(1);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const supabase = createClient();

  // Sélection du chantier quand le modal est ouvert hors contexte chantier
  const [allChantiers, setAllChantiers] = useState<Chantier[]>([]);
  const [selectedChantierId, setSelectedChantierId] = useState("");
  const chantierId = chantierIdProp || selectedChantierId || undefined;
  const chantiersFiltres = allChantiers.some((c) => c.metier === selectedMetier)
    ? allChantiers.filter((c) => c.metier === selectedMetier)
    : allChantiers;

  useEffect(() => {
    if (!isOpen || chantierIdProp) return;
    getChantiers(supabase, { fallbackToMocks: false })
      .then((list) => setAllChantiers(list))
      .catch(() => setAllChantiers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chantierIdProp]);

  useEffect(() => {
    async function loadCalepinageData() {
      if (!isOpen) return;

      let maxV = 0;
      if (chantierId) {
        try {
          const { data: maxRow } = await supabase
            .from("calepinages")
            .select("version")
            .eq("chantier_id", chantierId)
            .eq("metier", "terrasse")
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
          const typedRow = maxRow as { version?: number } | null;
          maxV = typedRow?.version ?? 0;
        } catch {
          maxV = 0;
        }
      }

      if (initialVersionItem && initialVersionItem.details) {
        setSourceVersionNumber(initialVersionItem.calepinage.version);
        setSourceStatut(initialVersionItem.calepinage.statut);
        setNextVersionNumber(Math.max(maxV, initialVersionItem.calepinage.version) + 1);
        return;
      }

      if (chantierId) {
        const saved = await getLatestCalepinageTerrasse(supabase, chantierId);
        if (saved && saved.details) {
          setSourceVersionNumber(saved.calepinage.version);
          setSourceStatut(saved.calepinage.statut);
          setNextVersionNumber(Math.max(maxV, saved.calepinage.version) + 1);
        } else {
          setSourceVersionNumber(null);
          setSourceStatut(null);
          setNextVersionNumber(maxV + 1);
        }
      } else {
        setSourceVersionNumber(null);
        setSourceStatut(null);
        setNextVersionNumber(1);
      }
    }

    loadCalepinageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chantierId, initialVersionItem]);

  if (!isOpen) return null;

  const handleSaveTerrasse = async (compatParams: CalepinageParams) => {
    if (!chantierId || !entreprise?.id) return;
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveError(null);
    try {
      const saved = await saveCalepinageTerrasse(supabase, {
        entrepriseId: entreprise.id,
        chantierId,
        calcParams: compatParams,
      });
      setSourceVersionNumber(saved.calepinage.version);
      setSourceStatut(saved.calepinage.statut);
      setNextVersionNumber(saved.calepinage.version + 1);
      setSaveSuccessMsg(
        `Quantitatif Terrasse V${saved.calepinage.version} enregistré — ${saved.besoins.length} besoins matériaux générés.`
      );
      if (onCalepinageSaved) onCalepinageSaved();
      setTimeout(() => {
        setSaveSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (e) {
      setSaveError(
        (e as { message?: string })?.message ||
          "Enregistrement impossible. Aucune version n'a été créée."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-md md:max-w-5xl lg:max-w-6xl bg-slate-950 text-slate-100 rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-5 pb-[max(6rem,calc(env(safe-area-inset-bottom)+4.5rem))] sm:pb-5 shadow-2xl border border-slate-800 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-display font-bold text-base text-white">
                  {selectedMetier === "cloture"
                    ? "Calepinage Clôture Pro"
                    : selectedMetier === "facade"
                    ? "Calepinage Bardage Pro (DTU 41.2)"
                    : "Calepinage Terrasse Pro (DTU 51.4)"}
                </h3>
                {sourceVersionNumber !== null ? (
                  <span className="text-[10px] font-bold text-orange-300 bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <History className="w-2.5 h-2.5" />
                    {sourceStatut === "valide"
                      ? `Correction V${sourceVersionNumber} → V${nextVersionNumber}`
                      : `Reprise V${sourceVersionNumber} → V${nextVersionNumber}`}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-orange-300 bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <History className="w-2.5 h-2.5" />V{nextVersionNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Plan de pose 2D/3D, simulation coupe &amp; quantitatif chantier BNA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!chantierIdProp && (
          <div className="mt-3">
            <label className={labelCls}>Chantier</label>
            <select
              value={selectedChantierId}
              onChange={(e) => setSelectedChantierId(e.target.value)}
              className={selectCls}
            >
              <option value="">— Choisir un chantier —</option>
              {chantiersFiltres.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 mt-3 text-xs font-bold">
          {(["terrasse", "facade", "cloture"] as MetierType[]).map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMetier(m)}
              className={`py-2 px-1 rounded-lg text-center transition-all ${
                selectedMetier === m
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {METIERS_CONFIG[m].label.split(" / ")[0]}
            </button>
          ))}
        </div>

        {selectedMetier === "terrasse" && (
          /* Bouton de validation 'Enregistrer le quantitatif' géré dans le panneau terrasse pro */
          <TerrasseCalepinagePanel
            chantierId={chantierId}
            entrepriseId={entreprise?.id}
            isSaving={isSaving}
            onSaveToChantier={handleSaveTerrasse}
          />
        )}

        {selectedMetier === "facade" && (
          <BardageCalepinagePanel
            chantierId={chantierId}
            entrepriseId={entreprise?.id}
            onSaved={onCalepinageSaved}
          />
        )}

        {selectedMetier === "cloture" && (
          <ClotureCalepinagePanel
            chantierId={chantierId}
            entrepriseId={entreprise?.id}
          />
        )}

        {saveSuccessMsg && (
          <div className="mt-3 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
        {saveError && (
          <div className="mt-3 p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{saveError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
