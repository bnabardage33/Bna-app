"use client";

import React from "react";
import { HardHat, Users, CloudSun, Plus, Trash2 } from "lucide-react";
import { ClientsScreen } from "@/components/clients/ClientsScreen";
import { ChantierCard } from "@/components/chantiers/ChantierCard";
import { TerrainScreen } from "@/components/screens/TerrainScreen";
import type { Chantier } from "@/types/metier";

export type CockpitSection = "client" | "chantier" | "terrain";

interface CockpitHubScreenProps {
  section: CockpitSection;
  onSectionChange: (section: CockpitSection) => void;
  chantiers: Chantier[];
  activeChantier: Chantier | null;
  onOpenCorbeille: () => void;
  onNewChantier: () => void;
  onOpenChantier: (id: string) => void;
  onSoftDeleteChantier: (id: string) => void;
  onOpenCalepinage: () => void;
  onOpenChantierCockpit: () => void;
  onSelectChantier: (id: string) => void;
}

const SECTIONS: { id: CockpitSection; label: string; icon: typeof Users }[] = [
  { id: "client", label: "Client", icon: Users },
  { id: "chantier", label: "Chantier", icon: HardHat },
  { id: "terrain", label: "Terrain", icon: CloudSun },
];

export const CockpitHubScreen: React.FC<CockpitHubScreenProps> = ({
  section,
  onSectionChange,
  chantiers,
  activeChantier,
  onOpenCorbeille,
  onNewChantier,
  onOpenChantier,
  onSoftDeleteChantier,
  onOpenCalepinage,
  onOpenChantierCockpit,
  onSelectChantier,
}) => {
  return (
    <div className="py-4 md:py-6 space-y-4 animate-in fade-in duration-150">
      <div>
        <h1 className="font-display font-bold text-2xl">Cockpit</h1>
        <p className="text-xs text-bna-muted mt-1">Clients, chantiers et suivi terrain</p>
      </div>

      <div
        role="group"
        aria-label="Espaces du Cockpit"
        className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 rounded-2xl text-xs font-bold"
      >
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`cockpit-tab-${id}`}
            type="button"
            aria-pressed={section === id}
            aria-controls={`cockpit-panel-${id}`}
            onClick={() => onSectionChange(id)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
              section === id
                ? "bg-white text-bna-copper shadow-xs"
                : "text-bna-muted hover:text-bna-anthracite"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <section
        id={`cockpit-panel-${section}`}
        aria-labelledby={`cockpit-tab-${section}`}
      >
        {section === "client" ? (
          <ClientsScreen
            chantiers={chantiers}
            onOpenCorbeille={onOpenCorbeille}
            onOpenChantier={onOpenChantier}
          />
        ) : section === "chantier" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardHat className="w-6 h-6 text-bna-copper" />
                <div>
                  <h2 className="font-display font-bold text-xl">Chantiers</h2>
                  <p className="text-[11px] text-bna-muted">
                    {chantiers.length} chantier{chantiers.length > 1 ? "s" : ""} actif{chantiers.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenCorbeille}
                  className="p-2 border border-bna-border bg-white hover:bg-neutral-50 text-bna-muted hover:text-bna-anthracite rounded-xl transition-colors"
                  title="Ouvrir la corbeille"
                  aria-label="Ouvrir la corbeille des chantiers"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onNewChantier}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-bna-copper hover:bg-bna-copper-hover text-white text-xs font-semibold rounded-xl shadow-xs transition-colors active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Nouveau</span>
                </button>
              </div>
            </div>

            {chantiers.length === 0 ? (
              <div className="bg-white border border-bna-border rounded-2xl p-6 text-center shadow-xs">
                <p className="text-sm font-semibold text-bna-anthracite">Aucun chantier actif</p>
                <p className="text-xs text-bna-muted mt-1">
                  Créez un chantier en sélectionnant un client existant.
                </p>
                <button
                  type="button"
                  onClick={onNewChantier}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-bna-copper text-white text-xs font-semibold rounded-xl"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nouveau chantier</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
                {chantiers.map((chantier) => (
                  <ChantierCard
                    key={chantier.id}
                    chantier={chantier}
                    onOpen={onOpenChantier}
                    onSoftDelete={onSoftDeleteChantier}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <TerrainScreen
            chantier={activeChantier}
            chantiers={chantiers}
            onOpenCalepinage={onOpenCalepinage}
            onOpenCockpit={onOpenChantierCockpit}
            onSelectChantier={onSelectChantier}
          />
        )}
      </section>
    </div>
  );
};
