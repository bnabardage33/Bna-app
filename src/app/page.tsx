"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/dashboard/Header";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import { TaskListCard } from "@/components/dashboard/TaskListCard";
import { FeaturedProjectCard } from "@/components/dashboard/FeaturedProjectCard";
import { RiskProjectsCard } from "@/components/dashboard/RiskProjectsCard";
import { QuickLinksCard } from "@/components/dashboard/QuickLinksCard";
import { BottomNav } from "@/components/navigation/BottomNav";
import { QuickActionModal } from "@/components/navigation/QuickActionModal";
import { CalepinageModal } from "@/components/calepinage/CalepinageModal";
import { TerrainScreen } from "@/components/screens/TerrainScreen";
import { CockpitScreen } from "@/components/screens/CockpitScreen";
import { AuthModal } from "@/components/auth/AuthModal";
import { NewChantierModal } from "@/components/chantiers/NewChantierModal";
import { Chantier } from "@/types/metier";
import { MOCK_CHANTIERS } from "@/data/mockChantiers";
import { createClient } from "@/lib/supabase/client";
import { getChantiers } from "@/lib/services/chantierService";
import { useAuth } from "@/lib/auth/useAuth";
import { HardHat, FileText, Sparkles, Plus } from "lucide-react";

export default function HomePage() {
  const { user, profil } = useAuth();
  const [currentTab, setCurrentTab] = useState("accueil");
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [isCalepinageOpen, setIsCalepinageOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNewChantierOpen, setIsNewChantierOpen] = useState(false);

  const [chantiers, setChantiers] = useState<Chantier[]>(Object.values(MOCK_CHANTIERS));
  const [activeChantierId, setActiveChantierId] = useState<string>("martin");

  const supabase = createClient();

  const refreshChantiers = async () => {
    const list = await getChantiers(supabase);
    setChantiers(list);
  };

  useEffect(() => {
    refreshChantiers();
  }, [user]);

  const currentChantier =
    chantiers.find((c) => c.id === activeChantierId) ||
    chantiers[0] ||
    MOCK_CHANTIERS.martin;

  const displayName = profil?.prenom || (user?.email ? user.email.split("@")[0] : "");

  return (
    <div className="min-h-screen bg-bna-offwhite text-bna-anthracite flex flex-col justify-between">
      {/* Container mobile centré */}
      <main className="w-full max-w-mobile mx-auto px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[90px] flex-1">
        {/* ÉCRAN ACCUEIL (Figé & Inchangé) */}
        {currentTab === "accueil" && (
          <div className="animate-in fade-in duration-150">
            <Header
              userName={displayName}
              currentDate="Jeudi 29 octobre"
              onOpenAuth={() => setIsAuthOpen(true)}
            />
            <WeatherCard />
            <TaskListCard />
            <FeaturedProjectCard
              onOpenCockpit={() => {
                setActiveChantierId(currentChantier.id);
                setCurrentTab("cockpit");
              }}
            />
            <RiskProjectsCard />
            <QuickLinksCard />
          </div>
        )}

        {/* ÉCRAN TERRAIN (Générique 3 métiers) */}
        {currentTab === "terrain" && (
          <TerrainScreen
            chantier={currentChantier}
            onOpenCalepinage={() => setIsCalepinageOpen(true)}
            onOpenCockpit={() => setCurrentTab("cockpit")}
            onSelectChantier={(id) => setActiveChantierId(id)}
          />
        )}

        {/* ÉCRAN COCKPIT CHANTIER (Générique 3 métiers) */}
        {currentTab === "cockpit" && (
          <CockpitScreen
            chantier={currentChantier}
            onBack={() => setCurrentTab("accueil")}
            onOpenCalepinage={() => setIsCalepinageOpen(true)}
          />
        )}

        {/* ÉCRAN CHANTIERS */}
        {currentTab === "chantiers" && (
          <div className="py-6 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HardHat className="w-6 h-6 text-bna-copper" />
                <h1 className="font-display font-bold text-2xl">Chantiers</h1>
              </div>
              <button
                onClick={() => setIsNewChantierOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bna-copper hover:bg-bna-copper-hover text-white text-xs font-semibold rounded-xl shadow-xs transition-colors active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Nouveau</span>
              </button>
            </div>

            <div className="space-y-2">
              {chantiers.map((ch) => (
                <div
                  key={ch.id}
                  onClick={() => {
                    setActiveChantierId(ch.id);
                    setCurrentTab("cockpit");
                  }}
                  className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs cursor-pointer hover:border-bna-copper/40 transition-all flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold text-bna-muted uppercase block">
                      {ch.metier} · {ch.ville}
                    </span>
                    <h3 className="font-display font-bold text-base text-bna-anthracite mt-0.5">
                      {ch.nom}
                    </h3>
                    <p className="text-xs text-bna-muted mt-0.5">{ch.intervention}</p>
                  </div>
                  <span className="text-xs font-bold text-bna-copper bg-bna-copper-light/60 px-2.5 py-1 rounded-xl">
                    {ch.avancementGlobal}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ÉCRAN DEVIS */}
        {currentTab === "devis" && (
          <div className="py-6 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-6 h-6 text-bna-copper" />
              <h1 className="font-display font-bold text-2xl">Devis & Chiffrage</h1>
            </div>
            <div className="bg-white border border-bna-border rounded-2xl p-5 text-sm text-bna-muted">
              Gestion des propositions commerciales et états d’avancement.
            </div>
          </div>
        )}

        {/* ÉCRAN ASSISTANT */}
        {currentTab === "assistant" && (
          <div className="py-6 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-6 h-6 text-bna-copper" />
              <h1 className="font-display font-bold text-2xl">BNA Assistant</h1>
            </div>
            <div className="bg-white border border-bna-border rounded-2xl p-5 text-sm text-bna-muted">
              Assistance technique, métrés, synthèse vocale et vérification chantier.
            </div>
          </div>
        )}
      </main>

      {/* Navigation basse partagée */}
      <BottomNav
        currentTab={currentTab === "cockpit" ? "chantiers" : currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onOpenQuickAction={() => setIsQuickActionOpen(true)}
      />

      {/* Tiroir d'actions rapides (+) */}
      <QuickActionModal
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
        onOpenCalepinage={() => setIsCalepinageOpen(true)}
        onOpenNewChantier={() => {
          setIsQuickActionOpen(false);
          setIsNewChantierOpen(true);
        }}
      />

      {/* Modal Calepinage Déterministe */}
      <CalepinageModal
        isOpen={isCalepinageOpen}
        onClose={() => setIsCalepinageOpen(false)}
      />

      {/* Modal Authentification Supabase */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      {/* Modal Nouveau Chantier Supabase */}
      <NewChantierModal
        isOpen={isNewChantierOpen}
        onClose={() => setIsNewChantierOpen(false)}
        onChantierCreated={refreshChantiers}
      />
    </div>
  );
}
