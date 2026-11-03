"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/dashboard/Header";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import { PlanningCard } from "@/components/dashboard/PlanningCard";
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
import { ChantierCard } from "@/components/chantiers/ChantierCard";
import { PhotoConstatModal } from "@/components/chantiers/PhotoConstatModal";
import { ClientsScreen } from "@/components/clients/ClientsScreen";
import { CorbeilleModal } from "@/components/corbeille/CorbeilleModal";
import { Chantier } from "@/types/metier";
import { MOCK_CHANTIERS } from "@/data/mockChantiers";
import { createClient } from "@/lib/supabase/client";
import { getChantiers, softDeleteChantier, isUuid } from "@/lib/services/chantierService";
import type { CalepinageVersionItem } from "@/lib/services/calepinageService";
import { useAuth } from "@/lib/auth/useAuth";
import { HardHat, Users, Trash2, FileText, Sparkles, Plus } from "lucide-react";

export default function HomePage() {
  const { user, profil } = useAuth();
  const [currentTab, setCurrentTab] = useState("accueil");
  const [chantiersSubTab, setChantiersSubTab] = useState<"chantiers" | "clients">("chantiers");

  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [isCalepinageOpen, setIsCalepinageOpen] = useState(false);
  const [calepinageSourceVersion, setCalepinageSourceVersion] = useState<CalepinageVersionItem | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNewChantierOpen, setIsNewChantierOpen] = useState(false);
  const [isCorbeilleOpen, setIsCorbeilleOpen] = useState(false);
  const [isQuickPhotoOpen, setIsQuickPhotoOpen] = useState(false);

  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [activeChantierId, setActiveChantierId] = useState<string>("");
  const [cockpitRefreshKey, setCockpitRefreshKey] = useState(0);

  const supabase = createClient();

  const refreshChantiers = async () => {
    // Si l'utilisateur est authentifié, on ne retombe pas sur les mocks si Supabase renvoie une liste vide
    const list = await getChantiers(supabase, {
      fallbackToMocks: !user,
    });
    setChantiers(list);
    if (list.length > 0) {
      if (!list.find((c) => c.id === activeChantierId)) {
        setActiveChantierId(list[0].id);
      }
    } else {
      setActiveChantierId("");
    }
  };

  useEffect(() => {
    refreshChantiers();
  }, [user]);

  const handleSoftDeleteChantier = async (chantierId: string) => {
    try {
      if (!isUuid(chantierId)) {
        // Mock chantier ("martin", "dupont", "bernard") : suppression locale immédiate
        setChantiers((prev) => {
          const filtered = prev.filter((c) => c.id !== chantierId);
          if (activeChantierId === chantierId) {
            setActiveChantierId(filtered.length > 0 ? filtered[0].id : "");
          }
          return filtered;
        });
        return;
      }
      await softDeleteChantier(supabase, chantierId);
      await refreshChantiers();
    } catch (err: any) {
      alert("Erreur mise à la corbeille : " + err.message);
    }
  };

  const currentChantier =
    chantiers.find((c) => c.id === activeChantierId) ||
    chantiers[0] ||
    null;

  const displayName = profil?.prenom || (user?.email ? user.email.split("@")[0] : "");

  return (
    <div className="min-h-screen bg-bna-offwhite text-bna-anthracite flex flex-col justify-between">
      {/* Conteneur adaptatif : Mobile (< md) max-w-md inchangé | Desktop (md: / lg:) max-w-5xl / max-w-7xl avec md:pt-24 sous la navbar fixe h-16 */}
      <main className="w-full max-w-md md:max-w-5xl lg:max-w-7xl mx-auto px-4 md:px-6 pt-4 md:pt-24 pb-[90px] md:pb-12 flex-1">
        {/* ÉCRAN ACCUEIL */}
        {currentTab === "accueil" && (
          <div className="animate-in fade-in duration-150">
            <Header
              userName={displayName}
              currentDate="Jeudi 29 octobre"
              onOpenAuth={() => setIsAuthOpen(true)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Colonne Gauche (Desktop) : Bloc Météo Chantier + Intelligence Métier BNA / Assistant de Pose */}
              <div className="lg:col-span-6">
                <WeatherCard
                  chantier={currentChantier}
                  allChantiers={chantiers}
                  onSelectChantier={(id) => setActiveChantierId(id)}
                />
              </div>

              {/* Colonne Droite (Desktop) : Planning & Jalons BNA + Projet en vedette + Accès rapides */}
              <div className="lg:col-span-6">
                <PlanningCard
                  chantiers={chantiers}
                  activeChantierId={activeChantierId}
                  onSelectChantier={(id) => {
                    setActiveChantierId(id);
                    setCurrentTab("cockpit");
                  }}
                />
                <FeaturedProjectCard
                  chantier={currentChantier}
                  onOpenCockpit={() => {
                    if (currentChantier) {
                      setActiveChantierId(currentChantier.id);
                      setCurrentTab("cockpit");
                    }
                  }}
                  onNewChantier={() => setIsNewChantierOpen(true)}
                  onAvancementUpdated={refreshChantiers}
                />
                <RiskProjectsCard
                  chantiers={chantiers}
                  onSelectChantier={(id) => {
                    setActiveChantierId(id);
                    setCurrentTab("cockpit");
                  }}
                />
                <QuickLinksCard
                  chantiersCount={chantiers.length}
                  onOpenCalepinage={() => {
                    setCalepinageSourceVersion(null);
                    setIsCalepinageOpen(true);
                  }}
                  onOpenDevis={() => setCurrentTab("devis")}
                  onOpenChantiers={() => setCurrentTab("chantiers")}
                />
              </div>
            </div>
          </div>
        )}

        {/* ÉCRAN TERRAIN (Générique 3 métiers) */}
        {currentTab === "terrain" && (
          <TerrainScreen
            chantier={currentChantier}
            chantiers={chantiers}
            onOpenCalepinage={() => {
              setCalepinageSourceVersion(null);
              setIsCalepinageOpen(true);
            }}
            onOpenCockpit={() => setCurrentTab("cockpit")}
            onSelectChantier={(id) => setActiveChantierId(id)}
          />
        )}

        {/* ÉCRAN COCKPIT CHANTIER (Générique 3 métiers) */}
        {currentTab === "cockpit" && (
          <CockpitScreen
            chantier={currentChantier}
            onBack={() => setCurrentTab("chantiers")}
            onOpenCalepinage={(sourceVersion) => {
              setCalepinageSourceVersion(sourceVersion || null);
              setIsCalepinageOpen(true);
            }}
            onSoftDelete={async (id) => {
              await handleSoftDeleteChantier(id);
              setCurrentTab("chantiers");
            }}
            refreshKey={cockpitRefreshKey}
          />
        )}

        {/* ÉCRAN CHANTIERS & CLIENTS */}
        {currentTab === "chantiers" && (
          <div className="py-6 animate-in fade-in duration-150">
            {/* Toggle Clients / Chantiers */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-2xl mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setChantiersSubTab("clients")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
                  chantiersSubTab === "clients"
                    ? "bg-white text-bna-copper shadow-xs"
                    : "text-bna-muted hover:text-bna-anthracite"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Clients</span>
              </button>
              <button
                type="button"
                onClick={() => setChantiersSubTab("chantiers")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
                  chantiersSubTab === "chantiers"
                    ? "bg-white text-bna-copper shadow-xs"
                    : "text-bna-muted hover:text-bna-anthracite"
                }`}
              >
                <HardHat className="w-4 h-4" />
                <span>Chantiers ({chantiers.length})</span>
              </button>
            </div>

            {/* VUE SOUS-ONGLET CLIENTS */}
            {chantiersSubTab === "clients" ? (
              <ClientsScreen
                chantiers={chantiers}
                onOpenCorbeille={() => setIsCorbeilleOpen(true)}
                onOpenChantier={(id) => {
                  setActiveChantierId(id);
                  setCurrentTab("cockpit");
                }}
              />
            ) : (
              /* VUE SOUS-ONGLET CHANTIERS */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardHat className="w-6 h-6 text-bna-copper" />
                    <div>
                      <h1 className="font-display font-bold text-2xl">Chantiers</h1>
                      <p className="text-[11px] text-bna-muted">
                        {chantiers.length} chantier{chantiers.length > 1 ? "s" : ""} actif{chantiers.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsCorbeilleOpen(true)}
                      className="p-2 border border-bna-border bg-white hover:bg-neutral-50 text-bna-muted hover:text-bna-anthracite rounded-xl transition-colors"
                      title="Ouvrir la corbeille"
                      aria-label="Corbeille"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsNewChantierOpen(true)}
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
                      onClick={() => setIsNewChantierOpen(true)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-bna-copper text-white text-xs font-semibold rounded-xl"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nouveau chantier</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
                    {chantiers.map((ch) => (
                      <ChantierCard
                        key={ch.id}
                        chantier={ch}
                        onOpen={(id) => {
                          setActiveChantierId(id);
                          setCurrentTab("cockpit");
                        }}
                        onSoftDelete={handleSoftDeleteChantier}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
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

      {/* Navigation partagée (Bottom Bar sur mobile < md | Top Bar pro sur Desktop >= md) */}
      <BottomNav
        currentTab={currentTab === "cockpit" ? "chantiers" : currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onOpenQuickAction={() => setIsQuickActionOpen(true)}
        onOpenCalepinage={() => {
          setCalepinageSourceVersion(null);
          setIsCalepinageOpen(true);
        }}
      />

      {/* Tiroir d'actions rapides (+) */}
      <QuickActionModal
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
        chantier={currentChantier}
        chantiers={chantiers}
        onOpenPhoto={() => {
          setIsQuickActionOpen(false);
          setIsQuickPhotoOpen(true);
        }}
        onOpenCalepinage={() => {
          setCalepinageSourceVersion(null);
          setIsCalepinageOpen(true);
        }}
        onOpenNewChantier={() => {
          setIsQuickActionOpen(false);
          setIsNewChantierOpen(true);
        }}
      />

      {/* Modal Photo : Constat ou Pointage & Galerie (depuis Actions Rapides) */}
      {currentChantier && (
        <PhotoConstatModal
          isOpen={isQuickPhotoOpen}
          onClose={() => setIsQuickPhotoOpen(false)}
          chantier={currentChantier}
          chantiers={chantiers}
          onSelectChantier={(id) => setActiveChantierId(id)}
          onPhotoAdded={refreshChantiers}
        />
      )}

      {/* Modal Calepinage Déterministe */}
      <CalepinageModal
        isOpen={isCalepinageOpen}
        onClose={() => {
          setIsCalepinageOpen(false);
          setCalepinageSourceVersion(null);
        }}
        chantierId={currentTab === "cockpit" ? currentChantier?.id : undefined}
        initialVersionItem={calepinageSourceVersion}
        onCalepinageSaved={() => {
          setCockpitRefreshKey((k) => k + 1);
        }}
      />

      {/* Modal Authentification Supabase */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      {/* Modal Nouveau Chantier Supabase (Tunnel 4 étapes) */}
      <NewChantierModal
        isOpen={isNewChantierOpen}
        onClose={() => setIsNewChantierOpen(false)}
        onChantierCreated={refreshChantiers}
      />

      {/* Modal Corbeille Sécurisée */}
      <CorbeilleModal
        isOpen={isCorbeilleOpen}
        onClose={() => setIsCorbeilleOpen(false)}
        onRestored={refreshChantiers}
      />
    </div>
  );
}
