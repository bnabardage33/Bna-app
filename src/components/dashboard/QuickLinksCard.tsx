import React from "react";
import { ChevronRight, Calculator, FileText, HardHat } from "lucide-react";

export interface QuickLinksCardProps {
  chantiersCount?: number;
  onOpenCalepinage?: () => void;
  onOpenDevis?: () => void;
  onOpenChantiers?: () => void;
}

export const QuickLinksCard: React.FC<QuickLinksCardProps> = ({
  chantiersCount = 2,
  onOpenCalepinage,
  onOpenDevis,
  onOpenChantiers,
}) => {
  return (
    <div className="mt-3">
      {/* Liens rapides dossiers & outils métier */}
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs divide-y divide-bna-border/40">
        {onOpenCalepinage && (
          <button
            type="button"
            onClick={onOpenCalepinage}
            className="w-full flex items-center justify-between pb-3 text-xs font-semibold text-bna-anthracite cursor-pointer hover:text-bna-copper transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-bna-copper shrink-0" />
              <span>CALEPINAGE (CLÔTURE • BARDAGE • TERRASSE)</span>
            </div>
            <div className="flex items-center gap-1 text-bna-muted shrink-0">
              <span className="bg-orange-50 border border-orange-200/70 rounded-full px-2 py-0.5 font-bold text-[10px] text-bna-copper">
                3 moteurs
              </span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenDevis}
          className={`w-full flex items-center justify-between ${
            onOpenCalepinage ? "py-3" : "pb-2.5 pt-1"
          } text-xs font-semibold text-bna-anthracite cursor-pointer hover:text-bna-copper transition-colors text-left`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-bna-muted shrink-0 md:inline-block hidden" />
            <span>DEVIS À TRAITER</span>
          </div>
          <div className="flex items-center gap-1 text-bna-muted">
            <span className="bg-neutral-100 rounded-full px-2 py-0.5 font-bold text-[11px] text-bna-anthracite">
              3
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenChantiers}
          className="w-full flex items-center justify-between pt-3 pb-1 text-xs font-semibold text-bna-anthracite cursor-pointer hover:text-bna-copper transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <HardHat className="w-4 h-4 text-bna-muted shrink-0 md:inline-block hidden" />
            <span>RÉALISATIONS &amp; CHANTIERS ACTIFS</span>
          </div>
          <div className="flex items-center gap-1 text-bna-muted">
            <span className="bg-neutral-100 rounded-full px-2 py-0.5 font-bold text-[11px] text-bna-anthracite">
              {chantiersCount}
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      </section>
    </div>
  );
};
