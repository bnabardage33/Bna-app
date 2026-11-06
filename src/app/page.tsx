"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/Header";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import { PlanningCard } from "@/components/dashboard/PlanningCard";
import { FeaturedProjectCard } from "@/components/dashboard/FeaturedProjectCard";
import { RiskProjectsCard } from "@/components/dashboard/RiskProjectsCard";
import { QuickLinksCard } from "@/components/dashboard/QuickLinksCard";
import { BottomNav, type MainTab } from "@/components/navigation/BottomNav";
import { QuickActionModal } from "@/components/navigation/QuickActionModal";
import { CalepinageModal } from "@/components/calepinage/CalepinageModal";
import { CockpitScreen } from "@/components/screens/CockpitScreen";
import { CockpitHubScreen, type CockpitSection } from "@/components/screens/CockpitHubScreen";
import { AssistantScreen } from "@/components/screens/AssistantScreen";
import { DevisFinanceScreen } from "@/components/screens/DevisFinanceScreen";
import { AccountModal } from "@/components/auth/AccountModal";
import { NewChantierModal } from "@/components/chantiers/NewChantierModal";
import { PhotoConstatModal } from "@/components/chantiers/PhotoConstatModal";
import { CorbeilleModal } from "@/components/corbeille/CorbeilleModal";
import { Chantier } from "@/types/metier";
import { createClient } from "@/lib/supabase/client";
import { getChantiers, softDeleteChantier, isUuid } from "@/lib/services/chantierService";
import type { CalepinageVersionItem } from "@/lib/services/calepinageService";
import { useAuth } from "@/lib/auth/useAuth";

export default function HomePage() {
  const router = useRouter();
  const { user, profil, loading: authLoading, isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState<MainTab>("accueil");
  const [cockpitSection, setCockpitSection] = useState<CockpitSection>("client");
  const [isChantierDetailOpen, setIsChantierDetailOpen] = useState(false);

  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [isCalepinageOpen, setIsCalepinageOpen] = useState(false);
  const [calepinageSourceVersion, setCalepinageSourceVersion] = useState<CalepinageVersionItem | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
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

  // Protection de route : redirection immédiate vers /login si l'utilisateur n'est pas connecté
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

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

  const openChantierCockpit = (chantierId: string) => {
    setActiveChantierId(chantierId);
    setCurrentTab("cockpit");
    setIsChantierDetailOpen(true);
  };

  const openCockpitHub = (section?: CockpitSection) => {
    setCurrentTab("cockpit");
    setIsChantierDetailOpen(false);
    if (section) setCockpitSection(section);
  };

  const displayName =
    profil?.prenom ||
    (user?.email?.toLowerCase().includes("bna") ? "Gaël" : "") ||
    "Gaël";

  // Écran d'attente lors de la vérification de session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bna-offwhite flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-200">
          <div className="font-display font-black text-3xl tracking-tighter text-bna-anthracite">
            BN<span className="text-bna-copper">A</span>
          </div>
          <div className="w-8 h-8 border-3 border-bna-copper/20 border-t-bna-copper rounded-full animate-spin" />
          <p className="text-xs font-semibold text-bna-muted">Chargement de votre espace BNA...</p>
        </div>
      </div>
    );
  }

  // Si non connecté, bloquer l'affichage du dashboard pendant la redirection vers /login
  if (!isAuthenticated) {
    return null;
  }

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
              onOpenAuth={() => setIsAccountOpen(true)}
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
                  onSelectChantier={openChantierCockpit}
                />
                <FeaturedProjectCard
                  chantier={currentChantier}
                  onOpenCockpit={() => {
                    if (currentChantier) {
                      openChantierCockpit(currentChantier.id);
                    }
                  }}
                  onNewChantier={() => setIsNewChantierOpen(true)}
                  onAvancementUpdated={refreshChantiers}
                />
                <RiskProjectsCard
                  chantiers={chantiers}
                  onSelectChantier={openChantierCockpit}
                />
                <QuickLinksCard
                  chantiersCount={chantiers.length}
                  onOpenCalepinage={() => {
                    setCalepinageSourceVersion(null);
                    setIsCalepinageOpen(true);
                  }}
                  onOpenDevis={() => setCurrentTab("facturation")}
                  onOpenChantiers={() => openCockpitHub("chantier")}
                />
              </div>
            </div>
          </div>
        )}

        {/* HUB COCKPIT : Clients, chantiers et terrain */}
        {currentTab === "cockpit" && (
          isChantierDetailOpen ? (
            <CockpitScreen
              chantier={currentChantier}
              onBack={() => setIsChantierDetailOpen(false)}
              onOpenCalepinage={(sourceVersion) => {
                setCalepinageSourceVersion(sourceVersion || null);
                setIsCalepinageOpen(true);
              }}
              onSoftDelete={async (id) => {
                await handleSoftDeleteChantier(id);
                setIsChantierDetailOpen(false);
                setCockpitSection("chantier");
              }}
              refreshKey={cockpitRefreshKey}
            />
          ) : (
            <CockpitHubScreen
              section={cockpitSection}
              onSectionChange={setCockpitSection}
              chantiers={chantiers}
              activeChantier={currentChantier}
              onOpenCorbeille={() => setIsCorbeilleOpen(true)}
              onNewChantier={() => setIsNewChantierOpen(true)}
              onOpenChantier={openChantierCockpit}
              onSoftDeleteChantier={handleSoftDeleteChantier}
              onOpenCalepinage={() => {
                setCalepinageSourceVersion(null);
                setIsCalepinageOpen(true);
              }}
              onOpenChantierCockpit={() => {
                if (currentChantier) openChantierCockpit(currentChantier.id);
              }}
              onSelectChantier={setActiveChantierId}
            />
          )
        )}

        {/* ÉCRAN FACTURATION : devis, factures et rentabilité */}
        {currentTab === "facturation" && (
          <DevisFinanceScreen
            chantiers={chantiers}
            onOpenCalepinage={() => {
              setCalepinageSourceVersion(null);
              setIsCalepinageOpen(true);
            }}
            onOpenAssistant={() => setCurrentTab("assistant")}
          />
        )}

        {/* ÉCRAN ASSISTANT IA CENTRAL */}
        {currentTab === "assistant" && (
          <AssistantScreen
            userName={displayName}
            userRole={profil?.role === "dirigeant" || !profil?.role ? "Gérant" : profil.role}
            chantiers={chantiers}
            activeChantierId={activeChantierId}
            onSelectChantier={(id) => setActiveChantierId(id)}
            onOpenCockpit={(id) => {
              openChantierCockpit(id);
            }}
            onOpenCalepinage={() => {
              setCalepinageSourceVersion(null);
              setIsCalepinageOpen(true);
            }}
            onOpenDevis={() => setCurrentTab("facturation")}
            onChantierUpdated={refreshChantiers}
          />
        )}
      </main>

      {/* Navigation partagée (Bottom Bar sur mobile < md | Top Bar pro sur Desktop >= md) */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          if (tab === "cockpit") setIsChantierDetailOpen(false);
        }}
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

      {/* Modal Compte & Profil de session */}
      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
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
