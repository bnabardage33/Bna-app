"use client";

import React from "react";
import { 
  Camera, 
  Mic, 
  Ruler, 
  Grid, 
  CloudRain, 
  AlertTriangle, 
  ChevronDown, 
  Image as ImageIcon,
  Clock
} from "lucide-react";
import { Chantier, METIERS_CONFIG } from "@/types/metier";
import { MOCK_CHANTIERS } from "@/data/mockChantiers";
import { ChantierWeatherCard } from "@/components/weather/ChantierWeatherCard";

interface TerrainScreenProps {
  chantier?: Chantier | null;
  onOpenCalepinage: () => void;
  onOpenCockpit: () => void;
  onSelectChantier?: (id: string) => void;
}

export const TerrainScreen: React.FC<TerrainScreenProps> = ({
  chantier,
  onOpenCalepinage,
  onOpenCockpit,
  onSelectChantier,
}) => {
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
    <div className="space-y-3 pb-6 animate-in fade-in duration-150">
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

      {/* Météo Automatique du Chantier + Prévisions Semaine + Vigilance Météo-France */}
      <ChantierWeatherCard
        chantier={chantier}
        onSelectChantier={onSelectChantier}
      />

      {/* 4 Actions Clés de Saisie Terrain */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => alert("Capture photo géolocalisée")}
          className="p-3.5 bg-white border border-bna-border rounded-2xl shadow-xs text-left active:scale-[0.98] transition-all hover:border-bna-copper/40"
        >
          <div className="w-9 h-9 rounded-xl bg-bna-offwhite border border-bna-border flex items-center justify-center text-bna-anthracite mb-2">
            <Camera className="w-4 h-4" />
          </div>
          <span className="font-semibold text-xs text-bna-anthracite block">Photo</span>
          <span className="text-[10px] text-bna-muted">Constat ou pointage</span>
        </button>

        <button
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

      {/* Photos Récentes du Terrain */}
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-bna-border/50">
          <div className="flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-bna-muted" />
            <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
              PHOTOS RÉCENTES DU CHANTIER
            </b>
          </div>
          <span className="text-[10px] text-bna-muted font-medium">
            {chantier.photosRecentesCount} clichés
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          {Array.from({ length: chantier.photosRecentesCount }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-neutral-100 rounded-xl border border-bna-border flex flex-col justify-end p-2 relative overflow-hidden group cursor-pointer"
            >
              <div className="absolute inset-0 bg-neutral-200/70 flex items-center justify-center text-neutral-400">
                <Camera className="w-5 h-5" />
              </div>
              <div className="relative z-10 bg-black/60 backdrop-blur-xs rounded-md px-1.5 py-0.5 text-[9px] text-white flex items-center gap-1 w-fit">
                <Clock className="w-2.5 h-2.5" />
                <span>{i === 0 ? "10:45" : i === 1 ? "09:15" : "Hier"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
