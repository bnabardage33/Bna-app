'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Calendar,
  CloudRain,
  Package,
  ShieldAlert,
  Edit3,
  HardHat,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Chantier, METIERS_CONFIG } from '@/types/metier';
import { createClient } from '@/lib/supabase/client';
import {
  ChantierAvancementState,
  loadChantierAvancement,
  saveChantierAvancement,
  fetchChantierLiveMateriaux,
} from '@/lib/services/avancementService';
import {
  fetchWeatherData,
  getCityFromChantier,
  getMetierOperationalAdvice,
  WeatherData,
} from '@/lib/services/weatherService';
import { UpdateAvancementModal } from '@/components/chantiers/UpdateAvancementModal';

interface ChantierAvancementCardProps {
  chantier?: Chantier | null;
  onOpenCockpit?: () => void;
  onNewChantier?: () => void;
  onAvancementUpdated?: (newGlobal: number) => void;
}

export const ChantierAvancementCard: React.FC<ChantierAvancementCardProps> = ({
  chantier,
  onOpenCockpit,
  onNewChantier,
  onAvancementUpdated,
}) => {
  const [state, setState] = useState<ChantierAvancementState | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [liveWeather, setLiveWeather] = useState<WeatherData | null>(null);
  const supabase = createClient();

  // 1. Initialiser et charger l'état complet
  const refreshAvancementState = useCallback(async () => {
    if (!chantier) {
      setState(null);
      return;
    }

    const loaded = loadChantierAvancement(
      chantier.id,
      chantier.metier,
      chantier.avancementGlobal,
      chantier
    );

    // Synchronisation en direct des matériaux réels (commandes fournisseurs & besoins)
    try {
      const liveMats = await fetchChantierLiveMateriaux(supabase, chantier.id, chantier.metier);
      if (liveMats.length > 0) {
        loaded.materiaux = liveMats;
      }
    } catch {
      // Ignorer
    }

    setState(loaded);
  }, [chantier, supabase]);

  useEffect(() => {
    refreshAvancementState();
  }, [refreshAvancementState]);

  // 2. Charger la météo en direct du chantier pour les consignes opérationnelles
  useEffect(() => {
    if (!chantier) return;
    let isCancelled = false;

    async function loadChantierWeather() {
      try {
        const city = await getCityFromChantier(chantier!);
        const data = await fetchWeatherData(city);
        if (!isCancelled) {
          setLiveWeather(data);
        }
      } catch (e) {
        console.warn('Erreur chargement meteo avancement:', e);
      }
    }

    loadChantierWeather();
    return () => {
      isCancelled = true;
    };
  }, [chantier]);

  if (!chantier || !state) {
    return (
      <section className="bg-white border border-bna-border rounded-2xl p-5 shadow-xs mt-3 text-center space-y-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-neutral-100 text-bna-muted mx-auto">
          <HardHat className="w-5 h-5 text-bna-copper" />
        </div>
        <div>
          <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase block">
            CHANTIER DU JOUR
          </b>
          <h2 className="font-display font-bold text-base text-bna-anthracite mt-1">
            Aucun chantier actif
          </h2>
          <p className="text-xs text-bna-muted mt-1 max-w-xs mx-auto">
            Créez votre premier chantier ou restaurez un projet depuis la corbeille.
          </p>
        </div>
        {onNewChantier && (
          <button
            onClick={onNewChantier}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-bna-copper hover:bg-bna-copper-hover text-white font-semibold text-xs rounded-xl shadow-xs transition-colors active:scale-95"
          >
            <span>Nouveau chantier</span>
          </button>
        )}
      </section>
    );
  }

  const metierConfig = METIERS_CONFIG[chantier.metier];
  const avancement = state.avancementGlobal ?? chantier.avancementGlobal ?? 0;

  // Conseil météo opérationnel réel
  const weatherCurrent = liveWeather?.current;
  const weatherAdvice = weatherCurrent
    ? getMetierOperationalAdvice(
        weatherCurrent.precipitation,
        liveWeather?.daily?.[0]?.wind_gusts_10m_max || weatherCurrent.wind_speed_10m,
        weatherCurrent.temperature_2m
      )
    : null;

  const handleSaveState = async (newState: ChantierAvancementState) => {
    await saveChantierAvancement(supabase, chantier.id, newState);
    setState(newState);
    if (onAvancementUpdated) {
      onAvancementUpdated(newState.avancementGlobal);
    }
  };

  return (
    <>
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs mt-3 space-y-3.5">
        {/* EN-TÊTE CHANTIER DU JOUR & BADGE ÉTAT */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
              CHANTIER DU JOUR
            </b>
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${metierConfig.badgeColor}`}
            >
              {metierConfig.label}
            </span>
          </div>

          {/* Bouton tactile de mise à jour rapide */}
          <button
            type="button"
            onClick={() => setIsUpdateModalOpen(true)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-bna-copper hover:text-bna-copper-dark bg-bna-copper-light/60 hover:bg-orange-100 border border-orange-200/60 px-2.5 py-1 rounded-xl transition-all active:scale-95"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Mettre à jour</span>
          </button>
        </div>

        {/* NOM DU CHANTIER & VILLE */}
        <div>
          <h2 className="font-display font-bold text-lg text-bna-anthracite truncate">
            {chantier.nom}
          </h2>
          <p className="text-xs text-bna-muted truncate">
            {chantier.ville ? chantier.ville : 'Gironde'}
            {chantier.intervention ? ` · ${chantier.intervention}` : ''}
          </p>
        </div>

        {/* ======================================================== */}
        {/* 1. BLOC AVANCEMENT GLOBAL DU PROJET & SOUS-LOTS          */}
        {/* ======================================================== */}
        <div className="p-3 bg-bna-offwhite rounded-xl border border-bna-border/80 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-bna-anthracite tracking-wide uppercase text-[10px]">
              Avancement du projet
            </span>
            <b className="font-display font-black text-sm text-bna-copper">{avancement} %</b>
          </div>

          <div className="w-full h-2 bg-neutral-200/80 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-bna-copper rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, avancement))}%` }}
            />
          </div>

          {/* Détail des sous-lots réels */}
          {state.avancementDetails && state.avancementDetails.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 pt-1 text-[11px] text-bna-muted border-t border-bna-border/40">
              {state.avancementDetails.map((det, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="truncate pr-2">{det.label}</span>
                  <span
                    className={`font-semibold shrink-0 ${
                      det.pourcentage === 100
                        ? 'text-emerald-700 font-bold'
                        : det.pourcentage > 0
                        ? 'text-amber-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {det.pourcentage}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 2. BLOC PROCHAINE ÉTAPE                                  */}
        {/* ======================================================== */}
        {state.prochaineEtape && (
          <div className="p-3 bg-white border border-bna-border rounded-xl space-y-1">
            <b className="text-[10px] font-bold tracking-wider text-bna-muted uppercase block">
              PROCHAINE ÉTAPE
            </b>
            <div className="flex items-start gap-2 pt-0.5">
              <div className="w-5 h-5 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0 mt-0.5 text-bna-copper">
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-bna-anthracite leading-snug">
                  {state.prochaineEtape.titre}
                </h4>
                <p className="text-[11px] text-bna-muted mt-0.5 leading-tight">
                  {state.prochaineEtape.detail}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. BLOC MÉTÉO & RESTRICTION DU JOUR (CONNECTÉ TEMPS RÉEL)*/}
        {/* ======================================================== */}
        <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <b className="text-[10px] font-bold tracking-wider text-amber-900 uppercase">
              MÉTÉO & RESTRICTION DU JOUR
            </b>
            <CloudRain className="w-3.5 h-3.5 text-bna-copper" />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-950 pt-0.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              {weatherAdvice
                ? weatherAdvice.title
                : chantier.meteoImpact?.alerte || 'Conditions favorables pour le chantier'}
            </span>
          </div>

          <p className="text-[11px] text-amber-900/80 italic pl-5 leading-tight">
            {weatherAdvice
              ? chantier.meteoImpact?.consignes?.[0] || weatherAdvice.terrasse
              : chantier.meteoImpact?.consignes?.[0] || 'Vérifier la météo avant fixation'}
          </p>
        </div>

        {/* ======================================================== */}
        {/* 4. BLOC MATÉRIAUX À SURVEILLER (CONNECTÉ AUX COMMANDES V1)*/}
        {/* ======================================================== */}
        {state.materiaux && state.materiaux.length > 0 && (
          <div className="p-3 bg-white border border-bna-border rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <b className="text-[10px] font-bold tracking-wider text-bna-muted uppercase">
                MATÉRIAUX & APPROVISIONNEMENT
              </b>
              <Package className="w-3.5 h-3.5 text-bna-copper" />
            </div>

            <div className="space-y-1.5 pt-0.5">
              {state.materiaux.map((mat, idx) => {
                const isAlerte = mat.statut === 'alerte';
                const isVigilance = mat.statut === 'vigilance';
                const badgeClass = isAlerte
                  ? 'text-rose-700 bg-rose-50 border-rose-200'
                  : isVigilance
                  ? 'text-amber-800 bg-amber-50 border-amber-200'
                  : 'text-emerald-800 bg-emerald-50 border-emerald-200';

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-1.5 bg-bna-offwhite rounded-lg border border-bna-border/60 text-xs"
                  >
                    <span className="font-semibold text-bna-anthracite truncate max-w-[190px]">
                      {mat.nom}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeClass} shrink-0`}>
                      {mat.detail}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 5. BLOC POINT DE BLOCAGE (SI PRÉSENT)                     */}
        {/* ======================================================== */}
        {state.blocage && state.blocage.titre && (
          <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl space-y-1 text-xs">
            <div className="flex items-center gap-1.5 text-rose-900 font-bold">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>POINT DE BLOCAGE : {state.blocage.titre}</span>
            </div>
            {state.blocage.detail && (
              <p className="text-[11px] text-rose-800 pl-5 leading-tight">
                {state.blocage.detail}
              </p>
            )}
          </div>
        )}

        {/* BOUTON D'ACTION PRINCIPAL : COCKPIT */}
        {onOpenCockpit && (
          <button
            type="button"
            onClick={onOpenCockpit}
            className="w-full min-h-[44px] bg-bna-copper hover:bg-bna-copper-hover text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] shadow-xs"
          >
            <span>Ouvrir le cockpit complet</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </section>

      {/* MODAL DE MISE À JOUR DE L'AVANCEMENT */}
      <UpdateAvancementModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        chantier={chantier}
        currentState={state}
        onSave={handleSaveState}
      />
    </>
  );
};
