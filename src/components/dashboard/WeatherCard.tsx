import React from "react";
import { CloudRain } from "lucide-react";

export const WeatherCard: React.FC = () => {
  return (
    <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs flex items-center justify-between transition-shadow hover:shadow-sm">
      <div>
        <span className="text-[10px] font-bold tracking-wider text-bna-muted uppercase">
          MÉTÉO
        </span>
        <h3 className="font-display font-bold text-base text-bna-anthracite mt-0.5">
          Pluie dès 14 h
        </h3>
        <p className="text-xs text-bna-muted mt-0.5">
          2 chantiers concernés · 1 à adapter
        </p>
      </div>
      {/* Sémantique BNA : Vigilance = Ambre */}
      <div className="w-11 h-11 rounded-xl bg-amber-50/80 border border-amber-200/60 flex items-center justify-center text-amber-700">
        <CloudRain className="w-6 h-6" />
      </div>
    </section>
  );
};
