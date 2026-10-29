import React from "react";
import { ChevronRight } from "lucide-react";

export const RiskProjectsCard: React.FC = () => {
  const riskProjects = [
    { name: "Martin", reason: "Météo" },
    { name: "Dupont", reason: "Matériaux manquants" },
  ];

  return (
    <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs mt-3">
      <div className="flex items-center justify-between pb-2 border-b border-bna-border/50">
        <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
          CHANTIERS À RISQUE
        </b>
        <span className="bg-neutral-100 text-bna-anthracite font-semibold rounded-full px-2 py-0.5 text-xs">
          {riskProjects.length}
        </span>
      </div>

      <div className="divide-y divide-bna-border/40">
        {riskProjects.map((project, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between py-2.5 text-xs cursor-pointer hover:bg-neutral-50/60 transition-colors px-1 rounded-lg"
          >
            <span className="font-semibold text-bna-anthracite">{project.name}</span>
            <div className="flex items-center gap-1 text-bna-muted">
              <span>{project.reason}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
