"use client";

import React, { useState } from "react";
import { 
  Camera, 
  Mic, 
  Ruler, 
  Grid, 
  ChevronDown 
} from "lucide-react";
import { Chantier, METIERS_CONFIG } from "@/types/metier";
import { ChantierWeatherCard } from "@/components/weather/ChantierWeatherCard";
import { PhotoConstatModal } from "@/components/chantiers/PhotoConstatModal";

interface TerrainScreenProps {
  chantier?: Chantier | null;
  chantiers?: Chantier[];
  onOpenCalepinage: () => void;
  onOpenCockpit: () => void;
  onSelectChantier?: (id: string) => void;
}

export const TerrainScreen: React.FC<TerrainScreenProps> = ({
  chantier,
  chantiers,
  onOpenCalepinage,
  onOpenCockpit,
  onSelectChantier,
}) => {
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  if (!chantier) {
    return (
      <div className="py-12 text-center space-y-3 bg-white rounded-2xl border border-bna-border p-6 mt-3">
        <p className="text-sm font-semibold text-bna-anthracite">Aucun chantier actif sur le terrain</p>
        <p className="text-xs text-bna-muted">Veuillez créer ou sélectionner un chantier depuis l'onglet Chantiers.</p>
      </div>
    );
  }

  const metierConfig = METIERS_CONFIG[chantier.metier];

  return (
    <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start pb-6 animate-in fade-in duration-150">
      <div className="space-y-3 lg:col-span-5 lg:order-2">
        {/* Sélecteur de Chantier Actif - Générique pour les 3 métiers */}
        <div className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-bna-muted uppercase">
              CHANTIER ACTIF SUR LE TERRAIN
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${metierConfig.badgeColor}`}>
              {metierConfig.label}
            </span>
          </div>

          <div 
            onClick={onOpenCockpit}
            className="mt-2.5 flex items-center justify-between cursor-pointer group"
          >
            <div>
              <h2 className="font-display font-bold text-lg text-bna-anthracite group-hover:text-bna-copper transition-colors">
                {chantier.nom}
              </h2>
              <p className="text-xs text-bna-muted">{chantier.ville} · {chantier.intervention}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-bna-copper bg-bna-copper-light/60 px-2.5 py-1.5 rounded-xl">
              <span>Cockpit</span>
              <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
            </div>
          </div>
        </div>

        {/* 4 Actions Clés de Saisie Terrain (affichées en colonne droite sur Desktop) */}
        <div className="hidden lg:grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setIsPhotoModalOpen(true)}
            className="p-4 bg-white border border-bna-border rounded-2xl shadow-xs text-left active:scale-[0.98] transition-all hover:border-bna-copper/40"
          >
            <div className="w-9 h-9 rounded-xl bg-bna-offwhite border border-bna-border flex items-center justify-center text-bna-anthracite mb-2">
              <Camera className="w-4 h-4" />
            </div>
            <span className="font-semibold text-xs text-bna-anthracite block">Photo</span>
            <span className="text-[10px] text-bna-muted">Constat ou pointage</span>
          </button>

          <button
            type="button"
            onClick={() => alert("Enregistrement note vocale...")}
            className="p-4 bg-white border border-bna-border rounded-2xl shadow-xs text-left active:scale-[0.98] transition-all hover:border-bna-copper/40"
          >
            <div className="w-9 h-9 rounded-xl bg-bna-offwhite border border-bna-border flex items-center justify-center text-bna-anthracite mb-2">
              <Mic className="w-4 h-4" />
            </div>
            <span className="font-semibold text-xs text-bna-anthracite block">Note vocale</span>
            <span className="text-[10px] text-bna-muted">Compte-rendu rapide</span>
          </button>

          <button
            type="button"
            onClick={() => alert("Prise de mesure terrain")}
            className="p-4 bg-white border border-bna-border rounded-2xl shadow-xs text-left active:scale-[0.98] transition-all hover:border-bna-copper/40"
          >
            <div className="w-9 h-9 rounded-xl bg-bna-offwhite border border-bna-border flex items-center justify-center text-bna-anthracite mb-2">
              <Ruler className="w-4 h-4" />
            </div>
            <span className="font-semibold text-xs text-bna-anthracite block">Mesures</span>
            <span className="text-[10px] text-bna-muted">Relevé cotes directes</span>
          </button>

          <button
            type="button"
            onClick={onOpenCalepinage}
            className="p-4 bg-white border border-bna-border rounded-2xl shadow-xs text-left active:scale-[0.98] transition-all hover:border-bna-copper/40"
          >
            <div className="w-9 h-9 rounded-xl bg-bna-offwhite border border-bna-border flex items-center justify-center text-bna-copper mb-2">
              <Grid className="w-4 h-4" />
            </div>
            <span className="font-semibold text-xs text-bna-anthracite block">Calepinage</span>
            <span className="text-[10px] text-bna-muted">Calculateur {metierConfig.label.split(' / ')[0]}</span>
          </button>
        </div>
      </div>

      {/* Météo Automatique du Chantier + Prévisions Semaine + Vigilance Météo-France */}
      <div className="lg:col-span-7 lg:order-1">
        <ChantierWeatherCard
          chantier={chantier}
          onSelectChantier={onSelectChantier}
        />
      </div>

      {/* 4 Actions Clés de Saisie Terrain (Ordre Mobile < lg inchangé) */}
      <div className="grid grid-cols-2 gap-2.5 lg:hidden">
        <button
          type="button"
          onClick={() => setIsPhotoModalOpen(true)}
          className="p-3.5 bg-white border border-bna-border rounded-2xl shadow-xs text-left active:scale-[0.98] transition-all hover:border-bna-copper/40"
        >
          <div className="w-9 h-9 rounded-xl bg-bna-offwhite border border-bna-border flex items-center justify-center text-bna-anthracite mb-2">
            <Camera className="w-4 h-4" />
          </div>
          <span className="font-semibold text-xs text-bna-anthracite block">Photo</span>
          <span className="text-[10px] text-bna-muted">Constat ou pointage</span>
        </button>

        <button
          type="button"
          onClick={() => alert("Enregistrement note vocale...")}
          className="p-3.5 bg-white border border-bna-border rounded-2xl shadow-xs text-left active:scale-[0.98] transition-all hover:border-bna-copper/40"
        >
          <div className="w-9 h-9 rounded-xl bg-bna-offwhite border border-bna-border flex items-center justify-center text-bna-anthracite mb-2">
            <Mic className="w-4 h-4" />
          </div>
          <span className="font-semibold text-xs text-bna-anthracite block">Note vocale</span>
          <span className="text-[10px] text-bna-muted">Compte-rendu rapide</span>
        </button>

        <button
          type="button"
          onClick={() => alert("Prise de mesure terrain")}
          className="p-3.5 bg-white border border-bna-border rounded-2xl shadow-xs text-left active:scale-[0.98] transition-all hover:border-bna-copper/40"
        >
          <div className="w-9 h-9 rounded-xl bg-bna-offwhite border border-bna-border flex items-center justify-center text-bna-anthracite mb-2">
            <Ruler className="w-4 h-4" />
          </div>
          <span className="font-semibold text-xs text-bna-anthracite block">Mesures</span>
          <span className="text-[10px] text-bna-muted">Relevé cotes directes</span>
        </button>

        <button
          type="button"
          onClick={onOpenCalepinage}
          className="p-3.5 bg-white border border-bna-border rounded-2xl shadow-xs text-left active:scale-[0.98] transition-all hover:border-bna-copper/40"
        >
          <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-bna-copper mb-2">
            <Grid className="w-4 h-4" />
          </div>
          <span className="font-semibold text-xs text-bna-anthracite block">Calepinage rapide</span>
          <span className="text-[10px] text-bna-muted">Parcours {metierConfig.label}</span>
        </button>
      </div>

      {/* Modal Photo : Constat ou Pointage & Galerie */}
      <PhotoConstatModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        chantier={chantier}
        chantiers={chantiers}
        onSelectChantier={onSelectChantier}
      />
    </div>
  );
};
