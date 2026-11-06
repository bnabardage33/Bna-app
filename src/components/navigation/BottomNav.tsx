"use client";

import React from "react";
import { Home, Plus, FileText, Sparkles, Calculator, PanelsTopLeft } from "lucide-react";

interface BottomNavProps {
  currentTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  onOpenQuickAction: () => void;
  onOpenCalepinage?: () => void;
}

export type MainTab = "accueil" | "cockpit" | "facturation" | "assistant";

const NAV_ITEMS = [
  { id: "accueil", label: "Accueil", icon: Home },
  { id: "cockpit", label: "Cockpit", icon: PanelsTopLeft },
  { id: "facturation", label: "Facturation", icon: FileText },
  { id: "assistant", label: "IA / Assistant", icon: Sparkles },
] as const;

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  onOpenQuickAction,
  onOpenCalepinage,
}) => {
  return (
    <>
      {/* NAVIGATION MOBILE (< md) : Bottom Navigation Bar fixe en bas (100% préservée, z-40 sous les modales) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-bna-border">
        <div className="max-w-md mx-auto flex items-center justify-between px-2 pt-1 pb-[max(8px,env(safe-area-inset-bottom))] h-[72px]">
          {NAV_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <React.Fragment key={item.id}>
                {index === 2 && (
                  <div className="flex-1 flex justify-center -mt-5">
                    <button
                      type="button"
                      onClick={onOpenQuickAction}
                      aria-label="Action rapide"
                      className="w-13 h-13 rounded-full bg-bna-copper text-white flex items-center justify-center shadow-copper border-4 border-[#F5F4F0] hover:bg-bna-copper-hover active:scale-95 transition-transform"
                    >
                      <Plus className="w-6 h-6 stroke-[2.5]" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  aria-current={currentTab === item.id ? "page" : undefined}
                  className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 transition-colors ${
                    currentTab === item.id
                      ? "text-bna-copper"
                      : "text-bna-muted hover:text-bna-anthracite"
                  }`}
                >
                  <Icon className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px] font-medium tracking-tight truncate">{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </nav>

      {/* NAVIGATION DESKTOP (md: et plus) : Barre supérieure horizontale pro (z-40 sous les modales) */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-bna-border shadow-sm">
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
            {NAV_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const active = currentTab === item.id;
              return (
                <React.Fragment key={item.id}>
                  {index === 2 && (
                    <button
                      type="button"
                      onClick={onOpenQuickAction}
                      aria-label="Action rapide"
                      title="Actions rapides"
                      className="w-9 h-9 shrink-0 rounded-full bg-bna-copper text-white flex items-center justify-center shadow-copper hover:bg-bna-copper-hover active:scale-95 transition-transform"
                    >
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      active
                        ? "bg-white text-bna-copper shadow-2xs border border-bna-border/80"
                        : "text-bna-muted hover:text-bna-anthracite"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                </React.Fragment>
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
          </div>
        </div>
      </nav>
    </>
  );
};
