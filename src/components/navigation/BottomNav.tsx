"use client";

import React from "react";
import { Home, CloudSun, Plus, HardHat, FileText, Sparkles, Calculator } from "lucide-react";

interface BottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenQuickAction: () => void;
  onOpenCalepinage?: () => void;
}

const NAV_ITEMS = [
  { id: "accueil", label: "Accueil", icon: Home },
  { id: "terrain", label: "Terrain", icon: CloudSun },
  { id: "chantiers", label: "Chantiers", icon: HardHat },
  { id: "devis", label: "Devis", icon: FileText },
  { id: "assistant", label: "Assistant", icon: Sparkles },
] as const;

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  onOpenQuickAction,
  onOpenCalepinage,
}) => {
  return (
    <>
      {/* NAVIGATION MOBILE (< md) : Bottom Navigation Bar fixe en bas (100% préservée) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-bna-border">
        <div className="max-w-md mx-auto flex items-center justify-between px-2 pt-1 pb-[max(8px,env(safe-area-inset-bottom))] h-[72px]">
          {/* Accueil */}
          <button
            onClick={() => onTabChange("accueil")}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors ${
              currentTab === "accueil"
                ? "text-bna-copper"
                : "text-bna-muted hover:text-bna-anthracite"
            }`}
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium tracking-tight">Accueil</span>
          </button>

          {/* Terrain */}
          <button
            onClick={() => onTabChange("terrain")}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors ${
              currentTab === "terrain"
                ? "text-bna-copper"
                : "text-bna-muted hover:text-bna-anthracite"
            }`}
          >
            <CloudSun className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium tracking-tight">Terrain</span>
          </button>

          {/* Bouton Action Rapide Central */}
          <div className="flex-1 flex justify-center -mt-5">
            <button
              onClick={onOpenQuickAction}
              aria-label="Action rapide"
              className="w-13 h-13 rounded-full bg-bna-copper text-white flex items-center justify-center shadow-copper border-4 border-[#F5F4F0] hover:bg-bna-copper-hover active:scale-95 transition-transform"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>

          {/* Chantiers */}
          <button
            onClick={() => onTabChange("chantiers")}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors ${
              currentTab === "chantiers"
                ? "text-bna-copper"
                : "text-bna-muted hover:text-bna-anthracite"
            }`}
          >
            <HardHat className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium tracking-tight">Chantiers</span>
          </button>

          {/* Devis */}
          <button
            onClick={() => onTabChange("devis")}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors ${
              currentTab === "devis"
                ? "text-bna-copper"
                : "text-bna-muted hover:text-bna-anthracite"
            }`}
          >
            <FileText className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium tracking-tight">Devis</span>
          </button>

          {/* Assistant */}
          <button
            onClick={() => onTabChange("assistant")}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors ${
              currentTab === "assistant"
                ? "text-bna-copper"
                : "text-bna-muted hover:text-bna-anthracite"
            }`}
          >
            <Sparkles className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium tracking-tight">Assistant</span>
          </button>
        </div>
      </nav>

      {/* NAVIGATION DESKTOP (md: et plus) : Barre supérieure horizontale pro */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-bna-border shadow-sm">
        <div className="w-full max-w-5xl lg:max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo BNA à gauche */}
          <button
            type="button"
            onClick={() => onTabChange("accueil")}
            className="flex items-center gap-3 text-left group"
          >
            <div className="font-display font-black text-2xl tracking-tighter text-bna-anthracite">
              BN<span className="text-bna-copper">A</span>
            </div>
            <span className="hidden lg:inline-block text-xs font-semibold text-bna-muted border-l border-bna-border pl-3">
              Pilotage Chantiers &amp; Calepinage
            </span>
          </button>

          {/* Onglets horizontaux au centre */}
          <div className="flex items-center gap-1 bg-bna-offwhite p-1 rounded-xl border border-bna-border">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? "bg-white text-bna-copper shadow-2xs border border-bna-border/80"
                      : "text-bna-muted hover:text-bna-anthracite"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Boutons d'actions rapides à droite */}
          <div className="flex items-center gap-2">
            {onOpenCalepinage && (
              <button
                type="button"
                onClick={onOpenCalepinage}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-bna-border bg-white hover:bg-neutral-50 text-xs font-bold text-bna-anthracite transition-colors"
              >
                <Calculator className="w-4 h-4 text-bna-copper" />
                <span>Calepinage</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenQuickAction}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-bna-copper hover:bg-bna-copper-hover text-white text-xs font-bold shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Actions rapides</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};
