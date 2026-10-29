"use client";

import React from "react";
import { Home, CloudSun, Plus, HardHat, FileText, Sparkles } from "lucide-react";

interface BottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenQuickAction: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  onOpenQuickAction,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-bna-border">
      <div className="max-w-mobile mx-auto flex items-center justify-between px-2 pt-1 pb-[max(8px,env(safe-area-inset-bottom))] h-[72px]">
        {/* Accueil */}
        <button
          onClick={() => onTabChange("accueil")}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors ${
            currentTab === "accueil" ? "text-bna-copper" : "text-bna-muted hover:text-bna-anthracite"
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium tracking-tight">Accueil</span>
        </button>

        {/* Terrain */}
        <button
          onClick={() => onTabChange("terrain")}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors ${
            currentTab === "terrain" ? "text-bna-copper" : "text-bna-muted hover:text-bna-anthracite"
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
            currentTab === "chantiers" ? "text-bna-copper" : "text-bna-muted hover:text-bna-anthracite"
          }`}
        >
          <HardHat className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium tracking-tight">Chantiers</span>
        </button>

        {/* Devis */}
        <button
          onClick={() => onTabChange("devis")}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors ${
            currentTab === "devis" ? "text-bna-copper" : "text-bna-muted hover:text-bna-anthracite"
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium tracking-tight">Devis</span>
        </button>

        {/* Assistant */}
        <button
          onClick={() => onTabChange("assistant")}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors ${
            currentTab === "assistant" ? "text-bna-copper" : "text-bna-muted hover:text-bna-anthracite"
          }`}
        >
          <Sparkles className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium tracking-tight">Assistant</span>
        </button>
      </div>
    </nav>
  );
};
