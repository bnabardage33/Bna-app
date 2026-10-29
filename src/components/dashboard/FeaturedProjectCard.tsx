import React from "react";
import { AlertTriangle, Camera, Mic } from "lucide-react";

interface FeaturedProjectCardProps {
  onOpenCockpit?: () => void;
}

export const FeaturedProjectCard: React.FC<FeaturedProjectCardProps> = ({ onOpenCockpit }) => {
  return (
    <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs mt-3">
      <div className="flex items-center justify-between">
        <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
          CHANTIER DU JOUR
        </b>
        {/* Présence visuelle adoucie pour préserver la dominance du cuivre d'action */}
        <span className="text-[10px] text-amber-800/80 bg-amber-50 border border-amber-200/50 font-medium rounded-full px-2 py-0.5 tracking-wide uppercase">
          À surveiller
        </span>
      </div>

      <h2 className="font-display font-bold text-lg text-bna-anthracite mt-3">
        Terrasse Martin
      </h2>
      <p className="text-xs text-bna-muted">Mérignac · Pose des lames</p>

      {/* Progress */}
      <div className="mt-3.5">
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="text-bna-muted">Avancement</span>
          <b className="font-semibold text-bna-anthracite">65 %</b>
        </div>
        <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-bna-copper rounded-full transition-all duration-500"
            style={{ width: "65%" }}
          />
        </div>
      </div>

      {/* Weather Alert */}
      <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-bna-warn bg-amber-50/80 border border-amber-200/60 rounded-xl px-2.5 py-1.5">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Pluie à 14 h</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={onOpenCockpit}
          className="flex-1 min-h-[44px] bg-bna-copper hover:bg-bna-copper-hover text-white font-medium text-xs rounded-xl flex items-center justify-center transition-colors active:scale-[0.98]"
        >
          Ouvrir le cockpit
        </button>
        <button
          onClick={() => alert("Capture photo")}
          className="min-h-[44px] px-3.5 bg-white border border-bna-border hover:bg-neutral-50 text-bna-anthracite text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors active:scale-[0.98]"
        >
          <Camera className="w-4 h-4 text-bna-muted" />
          <span>Photo</span>
        </button>
        <button
          onClick={() => alert("Note vocale")}
          className="min-h-[44px] px-3.5 bg-white border border-bna-border hover:bg-neutral-50 text-bna-anthracite text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors active:scale-[0.98]"
        >
          <Mic className="w-4 h-4 text-bna-muted" />
          <span>Note</span>
        </button>
      </div>
    </section>
  );
};
