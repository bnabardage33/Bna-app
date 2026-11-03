'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  HardHat,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { Chantier, AvancementDetail } from '@/types/metier';
import {
  ChantierAvancementState,
  calculateGlobalAvancement,
  getSuggestedNextStep,
} from '@/lib/services/avancementService';

interface UpdateAvancementModalProps {
  isOpen: boolean;
  onClose: () => void;
  chantier: Chantier;
  currentState: ChantierAvancementState;
  onSave: (newState: ChantierAvancementState) => Promise<void>;
}

export const UpdateAvancementModal: React.FC<UpdateAvancementModalProps> = ({
  isOpen,
  onClose,
  chantier,
  currentState,
  onSave,
}) => {
  const [details, setDetails] = useState<AvancementDetail[]>([]);
  const [nextStepTitre, setNextStepTitre] = useState('');
  const [nextStepDetail, setNextStepDetail] = useState('');

  // Blocage
  const [hasBlocage, setHasBlocage] = useState(false);
  const [blocageTitre, setBlocageTitre] = useState('');
  const [blocageDetail, setBlocageDetail] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDetails(currentState.avancementDetails.map((d) => ({ ...d })));
      setNextStepTitre(currentState.prochaineEtape?.titre || '');
      setNextStepDetail(currentState.prochaineEtape?.detail || '');

      if (currentState.blocage && currentState.blocage.titre) {
        setHasBlocage(true);
        setBlocageTitre(currentState.blocage.titre);
        setBlocageDetail(currentState.blocage.detail || '');
      } else {
        setHasBlocage(false);
        setBlocageTitre('');
        setBlocageDetail('');
      }
    }
  }, [isOpen, currentState]);

  if (!isOpen) return null;

  const currentGlobal = calculateGlobalAvancement(details);

  const handleStepChange = (index: number, newPct: number) => {
    const val = Math.min(100, Math.max(0, newPct));
    setDetails((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], pourcentage: val };
      return next;
    });
  };

  const handleAutoSuggestNextStep = () => {
    const suggested = getSuggestedNextStep(chantier.metier, details);
    setNextStepTitre(suggested.titre);
    setNextStepDetail(suggested.detail);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const newState: ChantierAvancementState = {
        avancementGlobal: currentGlobal,
        avancementDetails: details,
        prochaineEtape: {
          titre: nextStepTitre.trim() || 'Étape en cours de planification',
          detail: nextStepDetail.trim() || 'À planifier sur chantier',
        },
        blocage:
          hasBlocage && blocageTitre.trim()
            ? {
                titre: blocageTitre.trim(),
                detail: blocageDetail.trim(),
              }
            : undefined,
        materiaux: currentState.materiaux,
      };

      await onSave(newState);
      onClose();
    } catch (err: any) {
      alert("Erreur d'enregistrement : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-bna-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* EN-TÊTE MODAL */}
        <div className="p-4 sm:p-5 border-b border-bna-border/80 bg-bna-offwhite flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-100/80 border border-orange-200 flex items-center justify-center text-bna-copper">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-bna-muted uppercase">
                SUIVI DU CHANTIER
              </span>
              <h2 className="font-display font-bold text-base text-bna-anthracite leading-snug">
                {chantier.nom}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-bna-muted hover:text-bna-anthracite rounded-xl hover:bg-neutral-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENU FORMULAIRE SCROLLABLE */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* BANDEAU GAUGE GLOBALE CALCULÉE EN DIRECT */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Avancement Global Calculé
              </span>
              <span className="font-display font-black text-2xl text-bna-copper">
                {currentGlobal} %
              </span>
            </div>
            <div className="w-full h-2.5 bg-neutral-200/80 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-bna-copper rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, currentGlobal))}%` }}
              />
            </div>
            <p className="text-[11px] text-amber-800/90 mt-2 font-medium">
              💡 Le pourcentage global découle directement de la somme des sous-lots ci-dessous.
            </p>
          </div>

          {/* 1. SOUS-LOTS D'AVANCEMENT MÉTIER */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-bna-anthracite uppercase tracking-wider flex items-center gap-1.5">
              <HardHat className="w-3.5 h-3.5 text-bna-copper" />
              <span>Sous-lots & Étapes Techniques</span>
            </h3>

            <div className="space-y-3 divide-y divide-bna-border/50">
              {details.map((step, idx) => (
                <div key={idx} className="pt-3 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-bna-anthracite leading-snug">
                      {idx + 1}. {step.label}
                    </span>
                    <span
                      className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md border ${
                        step.pourcentage === 100
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : step.pourcentage > 0
                          ? 'bg-amber-50 text-amber-900 border-amber-300'
                          : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                      }`}
                    >
                      {step.pourcentage} %
                    </span>
                  </div>

                  {/* Boutons tactiles rapides 0%, 25%, 50%, 75%, 100% */}
                  <div className="grid grid-cols-5 gap-1 text-[11px] font-bold">
                    {[0, 25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleStepChange(idx, pct)}
                        className={`py-1.5 rounded-lg border transition-all active:scale-95 ${
                          step.pourcentage === pct
                            ? 'bg-bna-copper text-white border-bna-copper shadow-xs'
                            : 'bg-bna-offwhite hover:bg-neutral-100 text-bna-anthracite border-bna-border/80'
                        }`}
                      >
                        {pct === 100 ? '✅ 100%' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. PROCHAINE ÉTAPE */}
          <div className="space-y-2 pt-2 border-t border-bna-border/60">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-bna-anthracite uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-bna-copper" />
                <span>Prochaine Étape</span>
              </h3>
              <button
                type="button"
                onClick={handleAutoSuggestNextStep}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-bna-copper hover:underline"
              >
                <Sparkles className="w-3 h-3" />
                <span>Suggérer selon avancement</span>
              </button>
            </div>

            <input
              type="text"
              value={nextStepTitre}
              onChange={(e) => setNextStepTitre(e.target.value)}
              placeholder="Ex: Fixation des bandeaux de finition"
              className="w-full text-xs font-semibold p-2.5 rounded-xl border border-bna-border focus:outline-none focus:border-bna-copper bg-white"
            />
            <input
              type="text"
              value={nextStepDetail}
              onChange={(e) => setNextStepDetail(e.target.value)}
              placeholder="Ex: Programmé pour demain matin dès 08h30"
              className="w-full text-xs p-2 rounded-xl border border-bna-border/80 focus:outline-none focus:border-bna-copper bg-bna-offwhite text-bna-anthracite"
            />
          </div>

          {/* 3. POINT DE BLOCAGE (OPTIONNEL) */}
          <div className="space-y-2 pt-2 border-t border-bna-border/60">
            <div className="flex items-center justify-between">
              <label
                htmlFor="toggle-blocage"
                className="text-xs font-bold text-bna-anthracite uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>Signaler un point de blocage</span>
              </label>
              <input
                id="toggle-blocage"
                type="checkbox"
                checked={hasBlocage}
                onChange={(e) => setHasBlocage(e.target.checked)}
                className="w-4 h-4 accent-bna-copper rounded cursor-pointer"
              />
            </div>

            {hasBlocage && (
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                <input
                  type="text"
                  value={blocageTitre}
                  onChange={(e) => setBlocageTitre(e.target.value)}
                  placeholder="Ex: Attente validation couleur cornière d'angle"
                  className="w-full text-xs font-semibold p-2 rounded-lg border border-rose-200 focus:outline-none bg-white text-rose-950"
                />
                <input
                  type="text"
                  value={blocageDetail}
                  onChange={(e) => setBlocageDetail(e.target.value)}
                  placeholder="Ex: Client à relancer pour validation aluminium"
                  className="w-full text-xs p-1.5 rounded-lg border border-rose-200/80 focus:outline-none bg-white/90 text-rose-900"
                />
              </div>
            )}
          </div>
        </form>

        {/* PIED DE MODAL & ACTIONS */}
        <div className="p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-4 border-t border-bna-border bg-bna-offwhite flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-bna-muted hover:text-bna-anthracite bg-white border border-bna-border hover:bg-neutral-50 transition-colors"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 px-4 bg-bna-copper hover:bg-bna-copper-hover text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saving ? 'Enregistrement...' : 'Enregistrer l’avancement'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
