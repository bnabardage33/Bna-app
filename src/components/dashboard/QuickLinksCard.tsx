import React from "react";
import { ChevronRight } from "lucide-react";

export const QuickLinksCard: React.FC = () => {
  return (
    <div className="mt-3">
      {/* Liens rapides dossiers */}
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs divide-y divide-bna-border/40">
        <div className="flex items-center justify-between py-2 text-xs font-semibold text-bna-anthracite cursor-pointer hover:text-bna-copper transition-colors">
          <span>DEVIS À TRAITER</span>
          <div className="flex items-center gap-1 text-bna-muted">
            <span className="bg-neutral-100 rounded-full px-2 py-0.5 font-bold text-[11px] text-bna-anthracite">
              3
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 pb-1 text-xs font-semibold text-bna-anthracite cursor-pointer hover:text-bna-copper transition-colors">
          <span>RÉALISATIONS RÉCENTES</span>
          <div className="flex items-center gap-1 text-bna-muted">
            <span className="bg-neutral-100 rounded-full px-2 py-0.5 font-bold text-[11px] text-bna-anthracite">
              2
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </section>
    </div>
  );
};
