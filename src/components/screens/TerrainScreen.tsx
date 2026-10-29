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

interface TerrainScreenProps {
  chantier?: Chantier;
  onOpenCalepinage: () => void;
  onOpenCockpit: () => void;
  onSelectChantier?: (id: string) => void;
}

export const TerrainScreen: React.FC<TerrainScreenProps> = ({
  chantier = MOCK_CHANTIERS.martin,
  onOpenCalepinage,
  onOpenCockpit,
}) => {
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

      {/* Météo + Impact opérationnel spécifique au chantier */}
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider text-bna-muted uppercase">
            MÉTÉO & IMPACT OPÉRATIONNEL
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-50/80 border border-amber-200/60 flex items-center justify-center text-amber-700">
            <CloudRain className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{chantier.meteoImpact.alerte}</span>
          </div>
          <div className="mt-2 p-2.5 bg-bna-offwhite rounded-xl border border-bna-border text-xs text-bna-anthracite space-y-1">
            <p className="font-medium">Consignes chantier :</p>
            <ul className="list-disc list-inside text-bna-muted space-y-0.5 text-[11px]">
              {chantier.meteoImpact.consignes.map((c, idx) => (
                <li key={idx}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

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
