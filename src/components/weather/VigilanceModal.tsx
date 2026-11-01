'use client';

import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Clock,
  Info,
  ShieldCheck,
  Wind,
  CloudRain,
  Zap,
  Snowflake,
  SunMedium,
  ThermometerSnowflake,
  Waves,
  Mountain,
  Droplets,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import {
  DepartmentVigilanceReport,
  DepartmentPhenomenonRisk,
  VIGILANCE_COLORS,
  VigilanceLevel,
} from '@/lib/services/meteoFranceService';

interface VigilanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  vigilanceData: DepartmentVigilanceReport | null;
  isLoading?: boolean;
}

// Icônes adaptées par phénomène
function getPhenomenonIcon(id: number) {
  switch (id) {
    case 1:
      return <Wind className="w-5 h-5" />;
    case 2:
      return <CloudRain className="w-5 h-5" />;
    case 3:
      return <Zap className="w-5 h-5 text-amber-400" />;
    case 4:
      return <Droplets className="w-5 h-5 text-cyan-400" />;
    case 5:
      return <Snowflake className="w-5 h-5 text-sky-300" />;
    case 6:
      return <SunMedium className="w-5 h-5 text-orange-400" />;
    case 7:
      return <ThermometerSnowflake className="w-5 h-5 text-blue-300" />;
    case 8:
      return <Mountain className="w-5 h-5 text-slate-300" />;
    case 9:
      return <Waves className="w-5 h-5 text-teal-400" />;
    default:
      return <AlertTriangle className="w-5 h-5" />;
  }
}

export default function VigilanceModal({
  isOpen,
  onClose,
  vigilanceData,
  isLoading = false,
}: VigilanceModalProps) {
  const [selectedPhenomId, setSelectedPhenomId] = useState<number | null>(null);

  if (!isOpen) return null;

  // Trouver le phénomène actif par défaut (le plus risqué ou le premier)
  const activePhenom: DepartmentPhenomenonRisk | undefined =
    vigilanceData?.phenomena.find((p) => p.id === (selectedPhenomId ?? (
      vigilanceData.phenomena.find((ph) => ph.colorId > 1)?.id || vigilanceData.phenomena[0]?.id
    )));

  const globalColorMeta = vigilanceData?.colorMeta || VIGILANCE_COLORS[1];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vigilance-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* EN-TÊTE DU MODAL */}
        <div className="relative p-5 pb-4 border-b border-slate-800/80 bg-slate-900/95 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border shadow-inner ${globalColorMeta.badgeBg} ${globalColorMeta.badgeBorder}`}
            >
              {globalColorMeta.emoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Météo-France
                </span>
                <span className={`text-xs font-semibold ${globalColorMeta.badgeText}`}>
                  Vigilance {globalColorMeta.name}
                </span>
              </div>
              <h2
                id="vigilance-modal-title"
                className="text-lg font-bold text-white mt-0.5 flex items-center gap-1.5"
              >
                {vigilanceData ? `${vigilanceData.departmentName} (${vigilanceData.department})` : 'Vigilance Météo'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENU SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-copper border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Récupération des données Météo-France en direct...</p>
            </div>
          ) : !vigilanceData ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Impossible de charger les données de vigilance pour ce département.
            </div>
          ) : (
            <>
              {/* CARTE NIVEAU GLOBAL OFFICIEL */}
              <div
                className={`p-4 rounded-2xl border ${globalColorMeta.badgeBg} ${globalColorMeta.badgeBorder} flex flex-col gap-2`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{globalColorMeta.emoji}</span>
                    <span className={`font-bold text-sm ${globalColorMeta.badgeText}`}>
                      Niveau {globalColorMeta.id} : {globalColorMeta.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Mis à jour à {vigilanceData.updateTimeFormatted}
                  </span>
                </div>

                {/* BULLETIN TEXTUEL OFFICIEL */}
                <div className="mt-1 pt-2 border-t border-slate-700/40 text-xs text-slate-300 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-1">
                    <Info className="w-3.5 h-3.5 text-copper" />
                    <span>Bulletin des prévisionnistes Météo-France</span>
                  </div>
                  <p className="italic text-slate-300/90">{vigilanceData.bulletinSummary}</p>
                </div>
              </div>

              {/* LES 4 COULEURS OFFICIELLES (LÉGENDE) */}
              <div>
                <h3 className="text-[11px] font-bold tracking-wider uppercase text-slate-400 mb-2">
                  Les 4 Niveaux Officiels de Vigilance
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {([1, 2, 3, 4] as VigilanceLevel[]).map((lvl) => {
                    const c = VIGILANCE_COLORS[lvl];
                    const isCurrent = vigilanceData.colorMax === lvl;
                    return (
                      <div
                        key={lvl}
                        className={`p-2 rounded-xl border flex items-center gap-2 ${
                          isCurrent
                            ? `${c.badgeBg} ${c.badgeBorder} ring-1 ring-copper/40`
                            : 'bg-slate-800/40 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="text-base">{c.emoji}</span>
                        <div className="min-w-0">
                          <p className={`font-bold text-[11px] truncate ${isCurrent ? c.badgeText : 'text-slate-300'}`}>
                            {lvl}. {c.name}
                          </p>
                          <p className="text-[9px] text-slate-400 truncate">{c.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DÉTAIL PAR PHÉNOMÈNE RISQUÉ (9 PHÉNOMÈNES) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                    Détail par Phénomène Risqué (9 risques)
                  </h3>
                  <span className="text-[10px] text-slate-400">Sélectionnez pour le détail</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {vigilanceData.phenomena.map((ph) => {
                    const isSelected = activePhenom?.id === ph.id;
                    const hasAlert = ph.colorId > 1;

                    return (
                      <button
                        key={ph.id}
                        type="button"
                        onClick={() => setSelectedPhenomId(ph.id)}
                        className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-slate-800 border-copper/80 shadow-md ring-1 ring-copper/30'
                            : hasAlert
                            ? `${ph.colorMeta.badgeBg} ${ph.colorMeta.badgeBorder}`
                            : 'bg-slate-800/50 border-slate-800/80 hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`p-1.5 rounded-lg border ${
                              hasAlert
                                ? `${ph.colorMeta.badgeBg} ${ph.colorMeta.badgeBorder}`
                                : 'bg-slate-900 border-slate-700/60 text-slate-400'
                            }`}
                          >
                            {getPhenomenonIcon(ph.id)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{ph.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {ph.colorMeta.label}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-sm">{ph.colorMeta.emoji}</span>
                          <ChevronRight
                            className={`w-3.5 h-3.5 transition-transform ${
                              isSelected ? 'text-copper rotate-90' : 'text-slate-500'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DÉTAIL DU PHÉNOMÈNE SÉLECTIONNÉ : CHRONOLOGIE & CONSEILS */}
              {activePhenom && (
                <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-4 animate-in fade-in duration-150">
                  {/* Titre phénomène */}
                  <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-copper">
                        {getPhenomenonIcon(activePhenom.id)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          {activePhenom.name}
                          <span className="text-base">{activePhenom.colorMeta.emoji}</span>
                        </h4>
                        <p className={`text-xs font-medium ${activePhenom.colorMeta.badgeText}`}>
                          Vigilance {activePhenom.colorMeta.name} — {activePhenom.colorMeta.label}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CHRONOLOGIE DES ALERTES (HEURE PAR HEURE) */}
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-2">
                      <Clock className="w-3.5 h-3.5 text-copper" />
                      <span>Chronologie des alertes (Plages Horaires)</span>
                    </div>

                    {activePhenom.timelaps && activePhenom.timelaps.length > 0 ? (
                      <div className="space-y-1.5">
                        {activePhenom.timelaps.map((slot, idx) => {
                          const slotColorMeta = VIGILANCE_COLORS[slot.colorId] || VIGILANCE_COLORS[1];
                          return (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${slotColorMeta.badgeBg} ${slotColorMeta.badgeBorder}`}
                            >
                              <div className="flex items-center gap-2">
                                <span>{slotColorMeta.emoji}</span>
                                <span className={`font-semibold ${slotColorMeta.badgeText}`}>
                                  Vigilance {slotColorMeta.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
                                <span>Début : {slot.beginFormatted}</span>
                                <span>→</span>
                                <span>Fin : {slot.endFormatted}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>
                          Aucune tranche d&apos;alerte critique programmée pour les prochaines 24 heures.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* CONSÉQUENCES OFFICIELLES (SI PRÉSENTES) */}
                  {activePhenom.consequences && activePhenom.consequences.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Conséquences possibles officielles
                      </h5>
                      <ul className="space-y-1 text-xs text-slate-300 pl-4 list-disc marker:text-amber-400">
                        {activePhenom.consequences.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* CONSEILS DE COMPORTEMENT OFFICIELS */}
                  {activePhenom.advices && activePhenom.advices.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-copper" />
                        Conseils de comportement officiels
                      </h5>
                      <ul className="space-y-1 text-xs text-slate-300 pl-4 list-disc marker:text-copper">
                        {activePhenom.advices.map((adv, i) => (
                          <li key={i}>{adv}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* LIEN OFFICIEL METEO FRANCE */}
              <div className="pt-2 text-center">
                <a
                  href={`https://vigilance.meteofrance.fr/fr/${vigilanceData.departmentName
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-copper transition-colors"
                >
                  <span>Consulter la carte officielle sur Météo-France</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </>
          )}
        </div>

        {/* PIED DE MODAL */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Source officielle : vigilance.meteofrance.fr
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
