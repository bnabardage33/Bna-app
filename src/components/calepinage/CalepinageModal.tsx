"use client";

import React, { useState } from "react";
import { X, Calculator, CheckCircle2 } from "lucide-react";
import { calculerCalepinageTerrasse, CalepinageResult } from "@/lib/calepinage";
import { MetierType, METIERS_CONFIG } from "@/types/metier";
import { isValidDecimalInput, parseDecimal } from "@/lib/decimalInput";

interface CalepinageModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMetier?: MetierType;
}

export const CalepinageModal: React.FC<CalepinageModalProps> = ({
  isOpen,
  onClose,
  defaultMetier = "terrasse",
}) => {
  const [selectedMetier, setSelectedMetier] = useState<MetierType>(defaultMetier);

  // Valeurs stockées sous forme de string pendant l'édition
  const [longueurInput, setLongueurInput] = useState<string>("6");
  const [largeurInput, setLargeurInput] = useState<string>("4");
  const [largeurLame, setLargeurLame] = useState<number>(145);
  const [longueurLame, setLongueurLame] = useState<number>(3.0);
  const [marge, setMarge] = useState<number>(10);

  if (!isOpen) return null;

  // Conversion en nombre uniquement si valide
  const longueurNum = parseDecimal(longueurInput);
  const largeurNum = parseDecimal(largeurInput);

  const isValidDimensions =
    longueurNum !== null &&
    largeurNum !== null &&
    longueurNum > 0 &&
    largeurNum > 0;

  const resultTerrasse: CalepinageResult | null = isValidDimensions
    ? calculerCalepinageTerrasse({
        longueur_m: longueurNum,
        largeur_m: largeurNum,
        largeur_lame_mm: largeurLame,
        longueur_lame_m: longueurLame,
        marge_chutes_pct: marge,
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-mobile bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl border border-bna-border animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-bna-border/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-50 text-bna-copper">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-bna-anthracite">
                Module Calepinage
              </h3>
              <p className="text-[11px] text-bna-muted">Calculs métier déterministes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 text-bna-muted"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Parcours distincts verrouillés */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-bna-offwhite rounded-xl border border-bna-border mt-3 text-xs font-semibold">
          {(["terrasse", "facade", "cloture"] as MetierType[]).map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMetier(m)}
              className={`py-2 px-1 rounded-lg text-center transition-all ${
                selectedMetier === m
                  ? "bg-white text-bna-anthracite shadow-xs border border-bna-border"
                  : "text-bna-muted hover:text-bna-anthracite"
              }`}
            >
              {METIERS_CONFIG[m].label.split(" / ")[0]}
            </button>
          ))}
        </div>

        {/* PARCOURS 1 : TERRASSE */}
        {selectedMetier === "terrasse" && (
          <div className="mt-4 space-y-3 animate-in fade-in duration-100">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-bna-muted uppercase">Longueur (m)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="ex: 6 ou 6,5"
                  value={longueurInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (isValidDecimalInput(val)) {
                      setLongueurInput(val);
                    }
                  }}
                  className="w-full mt-1 px-3 py-2 border border-bna-border rounded-xl text-sm font-semibold text-bna-anthracite focus:outline-hidden focus:border-bna-copper"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-bna-muted uppercase">Largeur (m)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="ex: 4 ou 3,8"
                  value={largeurInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (isValidDecimalInput(val)) {
                      setLargeurInput(val);
                    }
                  }}
                  className="w-full mt-1 px-3 py-2 border border-bna-border rounded-xl text-sm font-semibold text-bna-anthracite focus:outline-hidden focus:border-bna-copper"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-bna-muted uppercase">Lame larg. (mm)</label>
                <select
                  value={largeurLame}
                  onChange={(e) => setLargeurLame(parseInt(e.target.value))}
                  className="w-full mt-1 px-3 py-2 border border-bna-border rounded-xl text-xs font-semibold text-bna-anthracite bg-white focus:outline-hidden focus:border-bna-copper"
                >
                  <option value={120}>120 mm</option>
                  <option value={140}>140 mm</option>
                  <option value={145}>145 mm (Standard)</option>
                  <option value={190}>190 mm</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-bna-muted uppercase">Lame long. (m)</label>
                <select
                  value={longueurLame}
                  onChange={(e) => setLongueurLame(parseFloat(e.target.value))}
                  className="w-full mt-1 px-3 py-2 border border-bna-border rounded-xl text-xs font-semibold text-bna-anthracite bg-white focus:outline-hidden focus:border-bna-copper"
                >
                  <option value={2.4}>2.40 m</option>
                  <option value={3.0}>3.00 m (Standard)</option>
                  <option value={4.0}>4.00 m</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-bna-muted uppercase">
                Marge chutes : {marge}%
              </label>
              <input
                type="range"
                min="5"
                max="20"
                value={marge}
                onChange={(e) => setMarge(parseInt(e.target.value))}
                className="w-full mt-1 accent-[#D97732]"
              />
            </div>

            {/* Résultats instantanés déterministes (gère état incomplet sans NaN) */}
            <div className="p-4 bg-bna-offwhite rounded-2xl border border-bna-border space-y-3">
              <div className="flex justify-between items-center border-b border-bna-border/60 pb-2">
                <span className="text-xs text-bna-muted font-medium">Surface calculée</span>
                <span className="font-display font-bold text-base text-bna-anthracite">
                  {resultTerrasse ? `${resultTerrasse.surface_nette_m2} m²` : "—"}
                </span>
              </div>

              {!resultTerrasse && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/50 rounded-lg p-2 text-center">
                  Veuillez saisir une longueur et une largeur valides pour lancer le calcul.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-bna-border/50">
                  <span className="text-bna-muted text-[10px] block font-semibold uppercase">Lames ({longueurLame}m)</span>
                  <span className="font-bold text-bna-copper text-base">
                    {resultTerrasse ? resultTerrasse.nb_lames_avec_marge : "—"}
                  </span>
                  <span className="text-[10px] text-bna-muted block mt-0.5">
                    {resultTerrasse ? `${resultTerrasse.ml_lames_total} ml` : "—"}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-bna-border/50">
                  <span className="text-bna-muted text-[10px] block font-semibold uppercase">Lambourdes (3m)</span>
                  <span className="font-bold text-bna-anthracite text-base">
                    {resultTerrasse ? resultTerrasse.nb_lambourdes_3m : "—"}
                  </span>
                  <span className="text-[10px] text-bna-muted block mt-0.5">
                    {resultTerrasse ? `${resultTerrasse.ml_lambourdes_total} ml` : "—"}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-bna-border/50">
                  <span className="text-bna-muted text-[10px] block font-semibold uppercase">Plots réglables</span>
                  <span className="font-bold text-bna-anthracite text-base">
                    {resultTerrasse ? resultTerrasse.nb_plots_necessaires : "—"}
                  </span>
                  <span className="text-[10px] text-bna-muted block mt-0.5">Entraxe 50cm</span>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-bna-border/50">
                  <span className="text-bna-muted text-[10px] block font-semibold uppercase">Vis Inox</span>
                  <span className="font-bold text-bna-anthracite text-base">
                    {resultTerrasse ? resultTerrasse.nb_vis_inox : "—"}
                  </span>
                  <span className="text-[10px] text-bna-muted block mt-0.5">2 vis / appui</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PARCOURS 2 : FAÇADE / BARDAGE */}
        {selectedMetier === "facade" && (
          <div className="mt-4 p-4 bg-bna-offwhite rounded-2xl border border-bna-border text-center space-y-2 animate-in fade-in duration-100">
            <span className="text-xs font-bold text-bna-anthracite block">Moteur Métier Façade / Bardage</span>
            <p className="text-[11px] text-bna-muted leading-relaxed">
              Parcours dédié : Dimensions façade, déduction ouvertures, orientation de pose, ossature bois/métal, profils de départ et fixations.
            </p>
            <span className="inline-block text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
              Prêt pour intégration des formules DTU 31.2
            </span>
          </div>
        )}

        {/* PARCOURS 3 : CLÔTURE */}
        {selectedMetier === "cloture" && (
          <div className="mt-4 p-4 bg-bna-offwhite rounded-2xl border border-bna-border text-center space-y-2 animate-in fade-in duration-100">
            <span className="text-xs font-bold text-bna-anthracite block">Moteur Métier Clôture</span>
            <p className="text-[11px] text-bna-muted leading-relaxed">
              Parcours dédié : Linéaire total, entraxe poteaux, calcul des travées, platines/scellements, lames d&apos;occultation et chapeaux.
            </p>
            <span className="inline-block text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              Prêt pour intégration des formules mécaniques vent
            </span>
          </div>
        )}

        <button
          onClick={() => {
            if (!isValidDimensions && selectedMetier === "terrasse") {
              alert("Veuillez saisir des dimensions valides avant de valider.");
              return;
            }
            alert(`Quantités ${METIERS_CONFIG[selectedMetier].label} enregistrées !`);
            onClose();
          }}
          disabled={!isValidDimensions && selectedMetier === "terrasse"}
          className={`w-full mt-4 min-h-[44px] text-white font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] ${
            !isValidDimensions && selectedMetier === "terrasse"
              ? "bg-neutral-300 cursor-not-allowed"
              : "bg-bna-copper hover:bg-bna-copper-hover"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Valider ce calepinage</span>
        </button>
      </div>
    </div>
  );
};
