"use client";

import React from "react";
import { X, CheckCircle2, Archive, Calendar, ArrowRight, ShieldCheck } from "lucide-react";
import type { CalepinageVersionItem } from "@/lib/services/calepinageService";
import { formatDateFr } from "@/lib/formatters";

interface VersionTerrasseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  versionItem: CalepinageVersionItem | null;
  chantierNom?: string;
  onNewVersion?: () => void;
}

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between items-center gap-2 text-xs py-1 border-b border-bna-border/40 last:border-b-0">
    <span className="text-bna-muted">{label}</span>
    <span className="font-bold text-bna-anthracite text-right">{value}</span>
  </div>
);

const parseJsonField = (val: unknown): Record<string, any> => {
  if (!val) return {};
  if (typeof val === "object" && val !== null) return val as Record<string, any>;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

export const VersionTerrasseDetailModal: React.FC<VersionTerrasseDetailModalProps> = ({
  isOpen,
  onClose,
  versionItem,
  chantierNom,
  onNewVersion,
}) => {
  if (!isOpen || !versionItem) return null;

  const cal = versionItem.calepinage;
  const det = versionItem.details;
  const isValid = cal.statut === "valide";

  const params = parseJsonField(det?.parametres);
  const res = parseJsonField(det?.resultats);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-2 sm:pt-6 pb-20 sm:pb-8 px-3 sm:px-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-mobile bg-white rounded-2xl max-h-full flex flex-col overflow-hidden shadow-2xl border border-bna-border animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fixe */}
        <div className="shrink-0 p-4 sm:p-5 pb-3 border-b border-bna-border/60 bg-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base text-bna-anthracite">
                Quantitatif V{cal.version}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  isValid
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-neutral-100 text-neutral-600 border-neutral-300"
                }`}
              >
                {isValid ? <CheckCircle2 className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                {isValid ? "VALIDÉE" : "ARCHIVÉE"}
              </span>
            </div>
            <p className="text-[11px] text-bna-muted flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3" />
              <span>{formatDateFr(cal.created_at)}</span>
              {chantierNom && <span>· {chantierNom}</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-2 rounded-full hover:bg-neutral-100 text-bna-muted"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps défilant sous le header fixe */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 pt-3 pb-6 space-y-4">
          {/* Message d'archivage si version archivée */}
          {!isValid && (
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-600 flex items-start gap-2">
              <Archive className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
              <span>
                Cette version est archivée et conservée pour l’historique technique. Elle est en lecture seule.
              </span>
            </div>
          )}

          {/* Synthèse principale */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-bna-offwhite rounded-xl border border-bna-border">
              <span className="text-[10px] font-bold text-bna-muted uppercase block">Surface nette</span>
              <span className="text-lg font-display font-bold text-bna-anthracite mt-0.5 block">
                {det ? `${det.surface_m2} m²` : "—"}
              </span>
              <span className="text-[11px] text-bna-muted">
                {det ? `${det.longueur_m} m × ${det.largeur_m} m` : ""}
              </span>
            </div>
            <div className="p-3 bg-bna-offwhite rounded-xl border border-bna-border">
              <span className="text-[10px] font-bold text-bna-copper uppercase block">Lames</span>
              <span className="text-lg font-display font-bold text-bna-anthracite mt-0.5 block">
                {det ? `${det.nb_lames}` : "—"}
              </span>
              <span className="text-[11px] text-bna-muted">
                {det ? `lames de ${det.longueur_lame_m} m` : ""}
              </span>
            </div>
            <div className="p-3 bg-bna-offwhite rounded-xl border border-bna-border">
              <span className="text-[10px] font-bold text-bna-muted uppercase block">Lambourdes</span>
              <span className="text-lg font-display font-bold text-bna-anthracite mt-0.5 block">
                {det ? `${det.nb_lambourdes}` : "—"}
              </span>
              <span className="text-[11px] text-bna-muted">
                {det ? `${det.ml_lambourdes} ml` : ""}
              </span>
            </div>
            <div className="p-3 bg-bna-offwhite rounded-xl border border-bna-border">
              <span className="text-[10px] font-bold text-bna-muted uppercase block">Supports & Fixations</span>
              <span className="text-lg font-display font-bold text-bna-anthracite mt-0.5 block">
                {det ? `${det.nb_plots} plots` : "—"}
              </span>
              <span className="text-[11px] text-bna-muted">
                {det ? `${det.nb_fixations} ${det.type_fixation}` : ""}
              </span>
            </div>
          </div>

          {/* Détails sauvegardés */}
          <div className="mt-4 space-y-3">
            {/* Paramètres enregistrés */}
            <div className="border border-bna-border rounded-2xl p-3 bg-white space-y-2">
              <span className="text-[11px] font-bold tracking-wider text-bna-muted uppercase block border-b border-bna-border/50 pb-1">
                Paramètres enregistrés
              </span>
              <Row label="Dimensions" value={det ? `${det.longueur_m} m × ${det.largeur_m} m` : "—"} />
              <Row label="Sens de pose" value={det?.orientation_lames === "largeur" ? "Largeur" : "Longueur"} />
              <Row
                label="Lames (largeur × longueur)"
                value={det ? `${det.largeur_lame_mm} mm × ${det.longueur_lame_m} m` : "—"}
              />
              <Row label="Espace inter-lames" value={det ? `${det.espace_inter_lames_mm} mm` : "—"} />
              <Row label="Marge chutes" value={det ? `${det.marge_chutes_pct} %` : "—"} />
              <Row label="Entraxe lambourdes" value={det ? `${det.entraxe_lambourdes_cm} cm` : "—"} />
              <Row label="Entraxe plots" value={det ? `${det.entraxe_plots_cm} cm` : "—"} />
              <Row label="Type de fixation" value={det?.type_fixation === "clips" ? "Clips" : "Vis"} />
            </div>

            {/* Résultats enregistrés */}
            <div className="border border-bna-border rounded-2xl p-3 bg-white space-y-2">
              <span className="text-[11px] font-bold tracking-wider text-bna-copper uppercase block border-b border-bna-border/50 pb-1">
                Résultats enregistrés
              </span>
              <Row label="Surface nette" value={det ? `${det.surface_m2} m²` : "—"} />
              <Row label="Lames commandées" value={det ? `${det.nb_lames} lames` : "—"} />
              <Row label="Linéaire de lames" value={det ? `${det.ml_lames} ml` : "—"} />
              <Row label="Barres de lambourdes" value={det ? `${det.nb_lambourdes} barres` : "—"} />
              <Row label="Linéaire de lambourdes" value={det ? `${det.ml_lambourdes} ml` : "—"} />
              {res.supports?.plots_lignes_base !== undefined && (
                <Row label="Plots structure régulière" value={res.supports.plots_lignes_base} />
              )}
              {res.supports?.plots_appuis_aboutage !== undefined && (
                <Row label="Plots appuis d'aboutage" value={res.supports.plots_appuis_aboutage} />
              )}
              <Row label="Total plots" value={det ? `${det.nb_plots} plots` : "—"} />
              <Row
                label={det?.type_fixation === "clips" ? "Total clips" : "Total vis"}
                value={det ? `${det.nb_fixations}` : "—"}
              />
            </div>

            <p className="text-[10px] text-bna-muted flex items-center gap-1.5 p-2 bg-bna-offwhite rounded-xl border border-bna-border">
              <ShieldCheck className="w-3.5 h-3.5 text-bna-copper shrink-0" />
              <span>Valeurs techniques immuables enregistrées dans Supabase sans recalcul.</span>
            </p>
          </div>
        </div>

        {/* Actions bas de modal fixes */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-bna-border bg-white flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex-1 min-h-[44px] bg-neutral-100 hover:bg-neutral-200 text-bna-anthracite font-semibold text-xs rounded-xl transition-colors active:scale-[0.98]"
          >
            Fermer
          </button>
          {isValid && onNewVersion && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNewVersion();
              }}
              className="flex-1 min-h-[44px] bg-bna-copper hover:bg-bna-copper-hover text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-copper transition-colors active:scale-[0.98]"
            >
              <span>+ Nouvelle version</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
