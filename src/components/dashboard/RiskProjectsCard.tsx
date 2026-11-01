"use client";

import React from "react";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import type { Chantier } from "@/types/metier";

interface RiskProjectsCardProps {
  chantiers?: Chantier[];
  onSelectChantier?: (id: string) => void;
}

export const RiskProjectsCard: React.FC<RiskProjectsCardProps> = ({
  chantiers = [],
  onSelectChantier,
}) => {
  // Calculer les chantiers à risque réels
  const riskProjects = chantiers
    .filter((c) => c.blocage?.titre || c.meteoImpact?.alerte)
    .map((c) => ({
      id: c.id,
      name: c.nom,
      reason: c.blocage?.titre || c.meteoImpact?.alerte || "Attention requise",
    }));

  if (riskProjects.length === 0) {
    return (
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs mt-3">
        <div className="flex items-center justify-between pb-2 border-b border-bna-border/50">
          <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
            CHANTIERS À RISQUE
          </b>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold rounded-full px-2 py-0.5 text-xs">
            0
          </span>
        </div>
        <div className="py-3 flex items-center gap-2 text-xs text-neutral-500">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Aucun blocage ni alerte météo critique.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs mt-3">
      <div className="flex items-center justify-between pb-2 border-b border-bna-border/50">
        <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
          CHANTIERS À RISQUE
        </b>
        <span className="bg-amber-100 text-amber-800 font-semibold rounded-full px-2 py-0.5 text-xs">
          {riskProjects.length}
        </span>
      </div>

      <div className="divide-y divide-bna-border/40">
        {riskProjects.map((project) => (
          <div
            key={project.id}
            onClick={() => onSelectChantier?.(project.id)}
            className="flex items-center justify-between py-2.5 text-xs cursor-pointer hover:bg-neutral-50/60 transition-colors px-1 rounded-lg"
          >
            <span className="font-semibold text-bna-anthracite truncate">{project.name}</span>
            <div className="flex items-center gap-1 text-bna-muted shrink-0">
              <span className="text-[11px]">{project.reason}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
