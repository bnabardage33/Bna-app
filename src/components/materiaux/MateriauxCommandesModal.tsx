"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Package,
  Layers,
  CheckCircle2,
  Clock,
  ChevronDown,
  AlertCircle,
  Truck,
  RotateCcw,
  Plus,
  Send,
  Ban,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getBesoinsByChantier,
  getCalepinagesTerrasseByChantier,
  BesoinsChantierResult,
  BesoinAvecVersion,
} from "@/lib/services/calepinageService";
import {
  getCommandesByChantier,
  CommandeAvecFournisseur,
  StatutCommandeFournisseur,
} from "@/lib/services/commandesFournisseursService";
import { NouvelleCommandeModal } from "@/components/commandes/NouvelleCommandeModal";
import { CommandeDetailModal } from "@/components/commandes/CommandeDetailModal";
import type { BesoinMateriauRow } from "@/types/database.types";
import { formatDateFr } from "@/lib/formatters";

interface MateriauxCommandesModalProps {
  isOpen: boolean;
  onClose: () => void;
  chantierId: string;
  chantierNom?: string;
}

const CATEGORIES_ORDRE = [
  "panneaux",
  "lames",
  "ossature",
  "lambourdes",
  "equerres",
  "plots",
  "isolant",
  "etancheite",
  "fixations",
];

const CATEGORIES_LABELS: Record<string, { label: string; icon: any }> = {
  panneaux: { label: "PANNEAUX / CASSETTES", icon: Layers },
  lames: { label: "LAMES / CLINS", icon: Layers },
  ossature: { label: "OSSATURE & CHEVRONS", icon: Package },
  lambourdes: { label: "LAMBOURDES", icon: Package },
  equerres: { label: "ÉQUERRES DE FIXATION", icon: Package },
  plots: { label: "PLOTS", icon: Package },
  isolant: { label: "ISOLATION ITE", icon: Layers },
  etancheite: { label: "ÉTANCHÉITÉ & PROFILÉS", icon: Package },
  fixations: { label: "FIXATIONS & ANCRAGES", icon: Package },
};

const STATUT_BADGES: Record<
  StatutCommandeFournisseur,
  { label: string; badgeClass: string }
> = {
  brouillon: {
    label: "Brouillon",
    badgeClass: "text-amber-700 bg-amber-50 border-amber-200",
  },
  envoyee: {
    label: "Envoyée",
    badgeClass: "text-blue-700 bg-blue-50 border-blue-200",
  },
  commandee: {
    label: "Commandée",
    badgeClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  annulee: {
    label: "Annulée",
    badgeClass: "text-neutral-500 bg-neutral-100 border-neutral-300",
  },
};

export const MateriauxCommandesModal: React.FC<MateriauxCommandesModalProps> = ({
  isOpen,
  onClose,
  chantierId,
  chantierNom,
}) => {
  const [data, setData] = useState<BesoinsChantierResult>({
    actifs: [],
    historique: [],
    totalACommander: 0,
  });
  const [commandes, setCommandes] = useState<CommandeAvecFournisseur[]>([]);
  const [activeVersionNumero, setActiveVersionNumero] = useState<number | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  const [isNouvelleCmdOpen, setIsNouvelleCmdOpen] = useState(false);
  const [selectedCommandeId, setSelectedCommandeId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const supabase = createClient();

  const loadData = async () => {
    if (!chantierId) return;
    setLoading(true);
    setError(null);
    try {
      const [resBesoins, resCmds, resVersions] = await Promise.all([
        getBesoinsByChantier(supabase, chantierId),
        getCommandesByChantier(supabase, chantierId),
        getCalepinagesTerrasseByChantier(supabase, chantierId),
      ]);
      setData(resBesoins);
      setCommandes(resCmds);

      const active = resVersions.find((v) => v.calepinage.statut === "valide");
      if (active) {
        setActiveVersionNumero(active.calepinage.version);
        setActiveVersionId(active.calepinage.id);
      } else {
        setActiveVersionNumero(null);
        setActiveVersionId(null);
      }
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement des besoins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, chantierId]);

  if (!isOpen) return null;

  // Grouper les besoins actifs par catégorie
  const actifsParCategorie: Record<string, BesoinMateriauRow[]> = {};
  for (const b of data.actifs) {
    const cat = b.categorie.toLowerCase();
    if (!actifsParCategorie[cat]) actifsParCategorie[cat] = [];
    actifsParCategorie[cat].push(b);
  }

  // Catégories ordonnées selon l'ordre métier
  const categoriesPresentes = [
    ...CATEGORIES_ORDRE.filter((c) => actifsParCategorie[c]),
    ...Object.keys(actifsParCategorie).filter((c) => !CATEGORIES_ORDRE.includes(c)),
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-2 sm:pt-6 pb-24 sm:pb-8 px-3 sm:px-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-mobile bg-white rounded-2xl max-h-full flex flex-col overflow-hidden shadow-2xl border border-bna-border animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fixe */}
        <div className="shrink-0 p-4 sm:p-5 pb-3 border-b border-bna-border/60 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-50 text-bna-copper">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-base text-bna-anthracite">
                  Matériaux & Commandes
                </span>
                {data.totalACommander > 0 && (
                  <span className="text-[10px] font-bold text-bna-copper bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                    {data.totalACommander} à commander
                  </span>
                )}
              </div>
              <p className="text-[11px] text-bna-muted">
                {chantierNom ? `Chantier · ${chantierNom}` : "Besoins issus du quantitatif"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 text-bna-muted"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps défilant sous le header fixe */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 pt-3 pb-8 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-bna-muted animate-pulse">
              Chargement des besoins et commandes...
            </div>
          ) : error ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* BOUTON CRÉER UNE COMMANDE FOURNISSEUR */}
              <div className="flex items-center justify-between gap-2 p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-blue-900 block">
                    Approvisionnement chantier
                  </span>
                  <span className="text-[11px] text-blue-700">
                    Transformer les besoins actifs en commande fournisseur
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNouvelleCmdOpen(true)}
                  disabled={data.actifs.length === 0}
                  className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Créer commande</span>
                </button>
              </div>

              {/* 1. COMMANDES FOURNISSEURS DU CHANTIER */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-bna-muted uppercase flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-bna-copper" />
                    <span>COMMANDES FOURNISSEURS ({commandes.length})</span>
                  </span>
                </div>

                {commandes.length === 0 ? (
                  <div className="p-4 bg-bna-offwhite rounded-2xl border border-dashed border-bna-border text-center space-y-1">
                    <Truck className="w-5 h-5 text-bna-muted mx-auto" />
                    <span className="text-xs font-bold text-bna-anthracite block">
                      Aucune commande passée
                    </span>
                    <p className="text-[11px] text-bna-muted">
                      Cliquez sur « Créer commande » pour générer un bon d&apos;approvisionnement.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {commandes.map((cmd) => {
                      const badge = STATUT_BADGES[cmd.statut] || STATUT_BADGES.brouillon;
                      return (
                        <div
                          key={cmd.id}
                          className="p-3 bg-white rounded-2xl border border-bna-border shadow-xs hover:border-bna-copper/60 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-xs text-bna-anthracite">
                                {cmd.numero_commande}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${badge.badgeClass}`}
                              >
                                {badge.label}
                              </span>
                              {cmd.version_source_numero && (
                                <span className="text-[9px] font-bold text-neutral-500 bg-neutral-100 border border-neutral-200 px-1.5 py-0.2 rounded-sm">
                                  V{cmd.version_source_numero}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-bna-muted mt-1">
                              <span className="font-semibold text-bna-anthracite">
                                {cmd.fournisseur?.nom}
                              </span>
                              <span>·</span>
                              <span>{formatDateFr(cmd.date_commande)}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedCommandeId(cmd.id)}
                            className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-bna-anthracite text-xs font-bold rounded-xl transition-colors shrink-0"
                          >
                            Ouvrir
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 2. BESOINS ACTIFS */}
              <section className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
                    BESOINS DU QUANTITATIF ACTIF ({data.actifs.length})
                  </span>
                  {activeVersionNumero && (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Version V{activeVersionNumero}
                    </span>
                  )}
                </div>

              {data.actifs.length === 0 ? (
                <div className="p-5 bg-bna-offwhite rounded-2xl border border-dashed border-bna-border text-center space-y-1">
                  <Package className="w-6 h-6 text-bna-muted mx-auto" />
                  <span className="text-xs font-bold text-bna-anthracite block">
                    Aucun besoin actif à commander
                  </span>
                  <p className="text-[11px] text-bna-muted max-w-xs mx-auto">
                    Validez un quantitatif terrasse pour générer automatiquement les besoins nécessaires.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {categoriesPresentes.map((catKey) => {
                    const items = actifsParCategorie[catKey];
                    const meta = CATEGORIES_LABELS[catKey] || {
                      label: catKey.toUpperCase(),
                      icon: Package,
                    };
                    const Icon = meta.icon;

                    return (
                      <div
                        key={catKey}
                        className="border border-bna-border rounded-2xl p-3 bg-white shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between border-b border-bna-border/50 pb-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-bna-copper">
                            <Icon className="w-3.5 h-3.5" />
                            <span>{meta.label}</span>
                          </div>
                          <span className="text-[10px] font-bold text-bna-muted">
                            {items.length} {items.length > 1 ? "lignes" : "ligne"}
                          </span>
                        </div>

                        <div className="space-y-2 pt-0.5">
                          {items.map((b) => (
                            <div
                              key={b.id}
                              className="flex items-center justify-between gap-2 p-2 bg-bna-offwhite rounded-xl border border-bna-border/60"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-xs text-bna-anthracite block truncate">
                                  {b.designation}
                                </span>
                                <span className="text-[10px] text-bna-muted">
                                  Origine : {b.origine === "calepinage" ? "Quantitatif terrasse" : b.origine}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-sm font-extrabold text-bna-anthracite block">
                                  {b.quantite} {b.unite}
                                </span>
                                <span className="inline-block text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-sm uppercase">
                                  À COMMANDER
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 2. HISTORIQUE DES BESOINS (Repliable) */}
            <section className="border border-bna-border rounded-2xl overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                className="w-full flex items-center justify-between p-3.5 bg-neutral-50 text-xs font-bold text-bna-anthracite transition-colors hover:bg-neutral-100/70"
                aria-expanded={historyOpen}
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-bna-muted" />
                  <span>Historique des besoins ({data.historique.length})</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-bna-muted transition-transform duration-200 ${
                    historyOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {historyOpen && (
                <div className="p-3 bg-white space-y-2 border-t border-bna-border/50 animate-in fade-in duration-150">
                  {data.historique.length === 0 ? (
                    <p className="text-xs text-bna-muted italic py-2 text-center">
                      Aucun besoin archivé ou passé pour ce chantier.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {data.historique.map((b: BesoinAvecVersion) => {
                        const isAnnule = b.statut === "annule";
                        const isCommande = b.statut === "commande";
                        const isRecu = b.statut === "recu";

                        return (
                          <div
                            key={b.id}
                            className="p-2.5 bg-neutral-50 rounded-xl border border-bna-border/60 text-xs flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-bna-anthracite truncate">
                                  {b.designation}
                                </span>
                                {b.versionCalepinage && (
                                  <span className="text-[9px] font-bold text-neutral-500 bg-neutral-200/70 px-1 py-0.2 rounded-sm shrink-0">
                                    V{b.versionCalepinage}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-bna-muted block mt-0.5">
                                {formatDateFr(b.created_at)}
                              </span>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-bold text-bna-anthracite block text-xs">
                                {b.quantite} {b.unite}
                              </span>
                              <span
                                className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded-sm uppercase ${
                                  isAnnule
                                    ? "text-neutral-500 bg-neutral-200/60"
                                    : isCommande
                                    ? "text-blue-700 bg-blue-50 border border-blue-200"
                                    : isRecu
                                    ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                                    : "text-neutral-600 bg-neutral-100"
                                }`}
                              >
                                {isAnnule ? "ANNULÉ" : isCommande ? "COMMANDÉ" : isRecu ? "REÇU" : b.statut}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[10px] text-bna-muted italic pt-1">
                    Les besoins des anciennes versions archivées sont automatiquement désactivés et conservés ici.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Modal Création Commande Fournisseur */}
      <NouvelleCommandeModal
        isOpen={isNouvelleCmdOpen}
        onClose={() => setIsNouvelleCmdOpen(false)}
        chantierId={chantierId}
        chantierNom={chantierNom}
        versionSourceId={activeVersionId}
        versionSourceNumero={activeVersionNumero}
        besoinsActifs={data.actifs}
        onCommandeCreee={(cmdId) => {
          setIsNouvelleCmdOpen(false);
          loadData();
          setSelectedCommandeId(cmdId);
        }}
      />

      {/* Modal Détail Commande Fournisseur */}
      <CommandeDetailModal
        isOpen={!!selectedCommandeId}
        onClose={() => setSelectedCommandeId(null)}
        commandeId={selectedCommandeId}
        chantierNom={chantierNom}
        onStatusChanged={loadData}
      />
    </div>
  </div>
);
};
