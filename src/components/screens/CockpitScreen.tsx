"use client";

import React from "react";
import {
  ArrowLeft,
  Camera,
  Mic,
  AlertTriangle,
  Calendar,
  Grid,
  Package,
  FileText,
  DollarSign,
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Chantier, METIERS_CONFIG } from "@/types/metier";
import { MOCK_CHANTIERS } from "@/data/mockChantiers";

interface CockpitScreenProps {
  chantier?: Chantier;
  onBack: () => void;
  onOpenCalepinage: () => void;
}

export const CockpitScreen: React.FC<CockpitScreenProps> = ({
  chantier = MOCK_CHANTIERS.martin,
  onBack,
  onOpenCalepinage,
}) => {
  const metierConfig = METIERS_CONFIG[chantier.metier];

  return (
    <div className="space-y-3 pb-8 animate-in fade-in duration-150">
      {/* Header Cockpit avec retour */}
      <div className="flex items-center justify-between pt-1 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-bna-muted hover:text-bna-anthracite py-1 pr-2 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${metierConfig.badgeColor}`}>
          {metierConfig.label}
        </span>
      </div>

      {/* Titre & Info Chantier */}
      <div>
        <span className="text-[10px] font-bold tracking-wider text-bna-muted uppercase">
          COCKPIT CHANTIER
        </span>
        <h1 className="font-display font-bold text-2xl text-bna-anthracite mt-0.5">
          {chantier.nom}
        </h1>
        <p className="text-xs text-bna-muted">{chantier.ville} · {chantier.intervention}</p>
      </div>

      {/* 1. Avancement - Spécifique au métier */}
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
        <div className="flex justify-between items-center text-xs mb-2">
          <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
            AVANCEMENT DU PROJET
          </b>
          <b className="font-bold text-sm text-bna-anthracite">{chantier.avancementGlobal} %</b>
        </div>
        <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-bna-copper rounded-full transition-all duration-500"
            style={{ width: `${chantier.avancementGlobal}%` }}
          />
        </div>
        <div className="flex flex-wrap justify-between gap-y-1 text-[11px] text-bna-muted mt-2">
          {chantier.avancementDetails.map((det, idx) => (
            <span key={idx}>
              {det.label} : <strong className="text-bna-anthracite">{det.pourcentage}%</strong>
            </span>
          ))}
        </div>
      </section>

      {/* 2. Prochaine étape */}
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
        <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase block mb-1">
          PROCHAINE ÉTAPE
        </b>
        <div className="flex items-start gap-2.5 mt-2">
          <div className="w-6 h-6 rounded-full bg-bna-offwhite border border-bna-border flex items-center justify-center shrink-0 mt-0.5 text-bna-copper">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-bna-anthracite">
              {chantier.prochaineEtape.titre}
            </h4>
            <p className="text-[11px] text-bna-muted mt-0.5">
              {chantier.prochaineEtape.detail}
            </p>
          </div>
        </div>
      </section>

      {/* 3. Météo ayant un impact opérationnel */}
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
        <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase block mb-2">
          MÉTÉO & RESTRICTION
        </b>
        <div className="flex items-center gap-2 p-2.5 bg-amber-50/80 border border-amber-200/60 rounded-xl text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{chantier.meteoImpact.alerte}</span>
        </div>
      </section>

      {/* 4. Matériaux à surveiller (avec sémantique couleur BNA) */}
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
        <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase block mb-2">
          MATÉRIAUX À SURVEILLER
        </b>
        <div className="space-y-2 text-xs">
          {chantier.materiaux.map((mat, idx) => {
            const isVigilance = mat.statut === "vigilance";
            const isAlerte = mat.statut === "alerte";
            const badgeClass = isAlerte
              ? "text-rose-700 bg-rose-100/70 border-rose-200"
              : isVigilance
              ? "text-amber-700 bg-amber-100/70 border-amber-200"
              : "text-emerald-700 bg-emerald-100/70 border-emerald-200";

            return (
              <div key={idx} className="flex items-center justify-between p-2 bg-bna-offwhite rounded-xl border border-bna-border">
                <span className="font-medium text-bna-anthracite">{mat.nom}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badgeClass}`}>
                  {mat.detail}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Blocages */}
      {chantier.blocage && (
        <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
          <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase block mb-2">
            BLOCAGES & POINTS CRITIQUES
          </b>
          <div className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200/70 rounded-xl text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <span className="font-semibold block">{chantier.blocage.titre}</span>
              <span className="text-[11px] text-rose-700">{chantier.blocage.detail}</span>
            </div>
          </div>
        </section>
      )}

      {/* 6. Photos / Note rapide */}
      <div className="flex gap-2">
        <button
          onClick={() => alert("Capture photo cockpit")}
          className="flex-1 min-h-[44px] bg-white border border-bna-border hover:bg-neutral-50 text-bna-anthracite font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
        >
          <Camera className="w-4 h-4 text-bna-muted" />
          <span>Prendre une photo</span>
        </button>
        <button
          onClick={() => alert("Note vocale chantier")}
          className="flex-1 min-h-[44px] bg-white border border-bna-border hover:bg-neutral-50 text-bna-anthracite font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
        >
          <Mic className="w-4 h-4 text-bna-muted" />
          <span>Note rapide</span>
        </button>
      </div>

      {/* 7. Accès Secondaires */}
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs">
        <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase block mb-2">
          ACCÈS SECONDAIRES
        </b>
        <div className="divide-y divide-bna-border/50 text-xs">
          <div
            onClick={() => alert("Accès Planning")}
            className="flex items-center justify-between py-2.5 cursor-pointer hover:text-bna-copper transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-bna-muted" />
              <span className="font-medium text-bna-anthracite">Planning & Jalons</span>
            </div>
            <ChevronRight className="w-4 h-4 text-bna-muted" />
          </div>

          <div
            onClick={onOpenCalepinage}
            className="flex items-center justify-between py-2.5 cursor-pointer hover:text-bna-copper transition-colors"
          >
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-bna-copper" />
              <span className="font-medium text-bna-anthracite">
                Calepinage ({metierConfig.label})
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-bna-muted" />
          </div>

          <div
            onClick={() => alert("Accès Matériaux & Commandes")}
            className="flex items-center justify-between py-2.5 cursor-pointer hover:text-bna-copper transition-colors"
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-bna-muted" />
              <span className="font-medium text-bna-anthracite">Matériaux & Commandes</span>
            </div>
            <ChevronRight className="w-4 h-4 text-bna-muted" />
          </div>

          <div
            onClick={() => alert("Accès Documents & Devis")}
            className="flex items-center justify-between py-2.5 cursor-pointer hover:text-bna-copper transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-bna-muted" />
              <span className="font-medium text-bna-anthracite">Documents & Devis</span>
            </div>
            <ChevronRight className="w-4 h-4 text-bna-muted" />
          </div>

          <div
            onClick={() => alert("Accès Dépenses & Heures")}
            className="flex items-center justify-between py-2.5 cursor-pointer hover:text-bna-copper transition-colors"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-bna-muted" />
              <span className="font-medium text-bna-anthracite">Dépenses & Heures passées</span>
            </div>
            <ChevronRight className="w-4 h-4 text-bna-muted" />
          </div>
        </div>
      </section>
    </div>
  );
};
