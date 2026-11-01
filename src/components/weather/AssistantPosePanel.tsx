'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Ruler,
  Wind,
  Umbrella,
  FileCheck2,
  HardHat,
  ChevronRight,
  ChevronDown,
  Info,
} from 'lucide-react';
import { Chantier } from '@/types/metier';
import { WeatherData } from '@/lib/services/weatherService';
import { DepartmentVigilanceReport } from '@/lib/services/meteoFranceService';
import {
  analyzePoseConditions,
  FamilleBardageMeteo,
  generateAttestationIntemperie,
  MetierExpertRules,
} from '@/lib/services/meteoAssistantService';
import { AttestationIntemperieModal } from './AttestationIntemperieModal';

interface AssistantPosePanelProps {
  chantier?: Chantier | null;
  weather: WeatherData | null;
  vigilance: DepartmentVigilanceReport | null;
}

export const AssistantPosePanel: React.FC<AssistantPosePanelProps> = ({
  chantier,
  weather,
  vigilance,
}) => {
  const [isAttestationOpen, setIsAttestationOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [familleBardage, setFamilleBardage] = useState<FamilleBardageMeteo>('hpl');

  useEffect(() => {
    if (!chantier || chantier.metier !== 'facade') return;
    try {
      const raw = localStorage.getItem(`bna_bardage_facades_v1_${chantier.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed[0]?.famille === 'bois_naturel') {
          setFamilleBardage('bois');
          return;
        }
      }
      const txt = `${chantier.nom || ''} ${(chantier as any).description || ''}`.toLowerCase();
      if (
        txt.includes('bois') ||
        txt.includes('douglas') ||
        txt.includes('cedar') ||
        txt.includes('mélèze') ||
        txt.includes('meleze') ||
        txt.includes('clin')
      ) {
        setFamilleBardage('bois');
      } else {
        setFamilleBardage('hpl');
      }
    } catch {
      // ignorer
    }
  }, [chantier]);

  if (!chantier) return null;

  const expertRules: MetierExpertRules = analyzePoseConditions(
    chantier.metier,
    weather,
    vigilance,
    familleBardage
  );

  const attestationData = generateAttestationIntemperie(
    chantier,
    weather,
    vigilance,
    familleBardage
  );

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-white space-y-3.5 shadow-md">
        {/* EN-TÊTE ASSISTANT DE POSE BNA */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex items-center gap-2 text-left group flex-1 min-w-0"
          >
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0">
              <HardHat className="w-4 h-4 text-bna-copper" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase block">
                INTELLIGENCE MÉTIER BNA
              </span>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 truncate group-hover:text-amber-300 transition-colors">
                <span>Assistant de Pose · {chantier.metier === 'terrasse' ? 'Terrasse' : 'Bardage'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </h3>
            </div>
          </button>

          {/* Badge statut global de pose */}
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${expertRules.statusBadge.bgClass} ${expertRules.statusBadge.borderClass} ${expertRules.statusBadge.textClass}`}
          >
            {expertRules.statusBadge.label}
          </span>
        </div>

        {/* SÉLECTEUR HPL VS BARDAGE BOIS POUR LES CHANTIERS FAÇADE */}
        {chantier.metier === 'facade' && (
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-800/90 border border-slate-700 rounded-xl text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setFamilleBardage('hpl')}
              className={`py-1.5 px-2 rounded-lg transition-all ${
                familleBardage === 'hpl'
                  ? 'bg-bna-copper text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Panneaux HPL / Compact
            </button>
            <button
              type="button"
              onClick={() => setFamilleBardage('bois')}
              className={`py-1.5 px-2 rounded-lg transition-all ${
                familleBardage === 'bois'
                  ? 'bg-bna-copper text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bardage Bois (DTU 41.2)
            </button>
          </div>
        )}

        {/* ALERTE CHARNIÈRE DE LA JOURNÉE (MATIN VS APRÈS-MIDI) - TOUJOURS VISIBLE */}
        {expertRules.horaireCharniere ? (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Umbrella className="w-4 h-4 shrink-0 text-amber-400 animate-bounce" />
                <span>HORAIRE CHARNIÈRE : {expertRules.horaireCharniere.heure}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAttestationOpen(true)}
                className="text-[10px] font-extrabold text-amber-300 underline hover:text-white"
              >
                Attestation légale
              </button>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-tight">
              {expertRules.horaireCharniere.action}
            </p>
          </div>
        ) : (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-2 text-xs text-emerald-300">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">Journée continue : pose extérieure sans rupture majeure.</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAttestationOpen(true)}
              className="text-[10px] font-semibold text-emerald-300/80 hover:text-white shrink-0 underline"
            >
              Justificatif
            </button>
          </div>
        )}

        {/* CONTENU DÉPLIABLE AVANCÉ */}
        {isExpanded && (
          <div className="space-y-3 pt-1 border-t border-slate-800/80 animate-in fade-in duration-150">
            {/* CHRONOLOGIE OPÉRATIONNELLE DE LA JOURNÉE */}
        {expertRules.creneaux.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Clock className="w-3 h-3 text-bna-copper" />
              <span>Créneaux Horaires Opérationnels</span>
            </div>

            <div className="space-y-1.5">
              {expertRules.creneaux.map((slot, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 ${
                    slot.status === 'interruption'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : slot.status === 'vigilance'
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-white shrink-0">
                      {slot.startFormatted} - {slot.endFormatted}
                    </span>
                    <span className="font-semibold text-xs">{slot.activiteConseillee}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 truncate pl-2 sm:pl-0">
                    {slot.consigne}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RÈGLES DE POSE EXPERT DTU & MATIÈRE */}
        <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-2 text-xs">
          {expertRules.dilatationJeuConseille && (
            <div className="flex items-start gap-2 text-amber-300 pb-1.5 border-b border-slate-700/60">
              <Ruler className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <b className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  {chantier.metier === 'facade'
                    ? familleBardage === 'bois'
                      ? 'Prescriptions Hygrométrie & Pose Bardage Bois (DTU 41.2) :'
                      : 'Prescriptions Dilatation & Pose HPL (DTU 41.2 / 45.4) :'
                    : "Jeu de dilatation recommandé aujourd'hui (DTU 51.4) :"}
                </b>
                <span className="font-bold text-white text-xs">
                  {expertRules.dilatationJeuConseille}
                </span>
              </div>
            </div>
          )}

          {/* Points critiques & Recommandations */}
          <ul className="space-y-1 text-[11px] text-slate-300">
            {expertRules.pointsCritiques.map((pt, i) => (
              <li key={i} className="flex items-start gap-1.5 text-rose-300">
                <span className="text-rose-400 font-bold shrink-0">⚠️</span>
                <span>{pt}</span>
              </li>
            ))}
            {expertRules.recommandationsPose.map((rec, i) => (
              <li key={i} className="flex items-start gap-1.5 text-emerald-300">
                <span className="text-emerald-400 font-bold shrink-0">✓</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

            {/* COUVERTURE JURIDIQUE / BOUTON ATTESTATION INTEMPÉRIE */}
            <div className="pt-1 flex items-center justify-between border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Info className="w-3.5 h-3.5 text-bna-copper" />
                <span>Besoin de justifier un arrêt au client ?</span>
              </div>

              <button
                type="button"
                onClick={() => setIsAttestationOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-bna-copper px-3 py-1.5 rounded-xl transition-all active:scale-95 shadow-xs"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-bna-copper" />
                <span>Justificatif légal d&apos;intempéries</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL OFFICIEL D'ATTESTATION D'INTEMPÉRIES */}
      <AttestationIntemperieModal
        isOpen={isAttestationOpen}
        onClose={() => setIsAttestationOpen(false)}
        attestation={attestationData}
      />
    </>
  );
};
