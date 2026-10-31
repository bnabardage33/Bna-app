"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, Archive, Plus, Eye, Calendar, Sparkles, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getCalepinagesTerrasseByChantier,
  CalepinageVersionItem,
} from "@/lib/services/calepinageService";
import { formatDateFr } from "@/lib/formatters";
import { VersionTerrasseDetailModal } from "./VersionTerrasseDetailModal";

interface QuantitatifsTerrasseModalProps {
  isOpen: boolean;
  onClose: () => void;
  chantierId: string;
  chantierNom?: string;
  onOpenNewVersion: (sourceVersion?: CalepinageVersionItem | null) => void;
}

export const QuantitatifsTerrasseModal: React.FC<QuantitatifsTerrasseModalProps> = ({
  isOpen,
  onClose,
  chantierId,
  chantierNom,
  onOpenNewVersion,
}) => {
  const [versions, setVersions] = useState<CalepinageVersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<CalepinageVersionItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const supabase = createClient();

  const handleOpenVersion = (versionItem: CalepinageVersionItem, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedVersion(versionItem);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsDetailOpen(false);
    setSelectedVersion(null);
  };

  const loadVersions = async () => {
    if (!chantierId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getCalepinagesTerrasseByChantier(supabase, chantierId);
      setVersions(list);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement des quantitatifs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, chantierId]);

  if (!isOpen) return null;

  const activeVersion = versions.find((v) => v.calepinage.statut === "valide");
  const archivedVersions = versions.filter((v) => v.calepinage.statut !== "valide");

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-2 sm:pt-6 pb-20 sm:pb-8 px-3 sm:px-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
        <div
          className="w-full max-w-mobile bg-white rounded-2xl max-h-full flex flex-col overflow-hidden shadow-2xl border border-bna-border animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header fixe */}
          <div className="shrink-0 p-4 sm:p-5 pb-3 border-b border-bna-border/60 bg-white flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-base text-bna-anthracite">
                  Quantitatifs Terrasse
                </span>
                {activeVersion && (
                  <span className="text-[10px] font-bold text-bna-copper bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                    V{activeVersion.calepinage.version} active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-bna-muted">
                {chantierNom ? `Chantier · ${chantierNom}` : "Gestion des versions techniques"}
              </p>
            </div>
            <button
              type="button"
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
                Chargement des quantitatifs...
              </div>
            ) : error ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : (
              <>
                {/* SECTION QUANTITATIF ACTIF */}
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
                      QUANTITATIF ACTIF
                    </span>
                    {activeVersion && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        VALIDÉE
                      </span>
                    )}
                  </div>

                  {activeVersion ? (
                    <div className="bg-white border-2 border-bna-copper/30 rounded-2xl p-4 shadow-xs relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-bna-copper/5 rounded-bl-full pointer-events-none" />

                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-display font-extrabold text-bna-anthracite">
                              V{activeVersion.calepinage.version}
                            </span>
                            <span className="text-xs font-semibold text-bna-copper">
                              {activeVersion.details?.surface_m2 ? `${activeVersion.details.surface_m2} m²` : ""}
                            </span>
                          </div>
                          <p className="text-[11px] text-bna-muted flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>Créée le {formatDateFr(activeVersion.calepinage.created_at)}</span>
                          </p>
                        </div>
                      </div>

                      {/* Métriques clés */}
                      {activeVersion.details && (
                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                          <div className="p-2 bg-bna-offwhite rounded-xl border border-bna-border">
                            <span className="text-bna-muted text-[10px] block">Platelage</span>
                            <span className="font-bold text-bna-anthracite">
                              {activeVersion.details.nb_lames} lames
                            </span>
                            <span className="text-[10px] text-bna-muted block">
                              ({activeVersion.details.longueur_lame_m} m · {activeVersion.details.ml_lames} ml)
                            </span>
                          </div>
                          <div className="p-2 bg-bna-offwhite rounded-xl border border-bna-border">
                            <span className="text-bna-muted text-[10px] block">Structure</span>
                            <span className="font-bold text-bna-anthracite">
                              {activeVersion.details.nb_lambourdes} barres
                            </span>
                            <span className="text-[10px] text-bna-muted block">
                              ({activeVersion.details.ml_lambourdes} ml)
                            </span>
                          </div>
                          <div className="p-2 bg-bna-offwhite rounded-xl border border-bna-border">
                            <span className="text-bna-muted text-[10px] block">Plots</span>
                            <span className="font-bold text-bna-anthracite">
                              {activeVersion.details.nb_plots} plots
                            </span>
                            <span className="text-[10px] text-bna-muted block">
                              entraxe {activeVersion.details.entraxe_plots_cm} cm
                            </span>
                          </div>
                          <div className="p-2 bg-bna-offwhite rounded-xl border border-bna-border">
                            <span className="text-bna-muted text-[10px] block">Fixations</span>
                            <span className="font-bold text-bna-anthracite">
                              {activeVersion.details.nb_fixations}{" "}
                              {activeVersion.details.type_fixation === "clips" ? "clips" : "vis"}
                            </span>
                            <span className="text-[10px] text-bna-muted block capitalize">
                              {activeVersion.details.type_fixation}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-3.5 pt-3 border-t border-bna-border/60">
                        <button
                          type="button"
                          onClick={(e) => handleOpenVersion(activeVersion, e)}
                          className="flex-1 min-h-[40px] bg-white border border-bna-border hover:bg-neutral-50 text-bna-anthracite font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
                        >
                          <Eye className="w-4 h-4 text-bna-muted" />
                          <span>Ouvrir</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenNewVersion(activeVersion);
                          }}
                          className="flex-1 min-h-[40px] bg-bna-copper hover:bg-bna-copper-hover text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-copper transition-colors active:scale-[0.98]"
                        >
                          <span>✏ Modifier</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 bg-bna-offwhite rounded-2xl border border-dashed border-bna-border text-center space-y-2">
                      <Sparkles className="w-6 h-6 text-bna-copper mx-auto" />
                      <span className="text-xs font-bold text-bna-anthracite block">
                        Aucun quantitatif actif
                      </span>
                      <p className="text-[11px] text-bna-muted max-w-xs mx-auto">
                        Créez la première version technique déterministe pour ce chantier.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenNewVersion(null);
                        }}
                        className="mt-2 min-h-[40px] px-4 bg-bna-copper hover:bg-bna-copper-hover text-white font-semibold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-copper transition-colors active:scale-[0.98]"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Créer le quantitatif (V1)</span>
                      </button>
                    </div>
                  )}
                </section>

                {/* SECTION HISTORIQUE */}
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
                      HISTORIQUE ({archivedVersions.length})
                    </span>
                    {archivedVersions.length > 0 && (
                      <span className="text-[10px] text-bna-muted">Lecture seule</span>
                    )}
                  </div>

                  {archivedVersions.length === 0 ? (
                    <p className="text-xs text-bna-muted italic py-2">
                      Aucune version archivée pour ce chantier.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {archivedVersions.map((v) => (
                        <div
                          key={v.calepinage.id}
                          className="p-3 bg-neutral-50 border border-bna-border/80 rounded-xl flex items-center justify-between hover:bg-neutral-100/70 transition-colors"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-bna-anthracite">
                                V{v.calepinage.version}
                              </span>
                              <span className="text-[9px] font-bold text-neutral-500 bg-neutral-200/60 px-1.5 py-0.2 rounded-sm uppercase">
                                ARCHIVÉE
                              </span>
                            </div>
                            <p className="text-[11px] text-bna-muted">
                              {v.details
                                ? `${v.details.surface_m2} m² · ${v.details.nb_lames} lames · ${v.details.nb_lambourdes} lambourdes`
                                : "Détails non disponibles"}
                            </p>
                            <p className="text-[10px] text-bna-muted/80 flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />
                              <span>{formatDateFr(v.calepinage.created_at)}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleOpenVersion(v, e)}
                            className="min-h-[36px] px-3 bg-white border border-bna-border hover:bg-neutral-50 text-bna-anthracite font-semibold text-xs rounded-lg flex items-center gap-1 shrink-0 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-bna-muted" />
                            <span>Consulter</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de consultation détaillée d'une version */}
      <VersionTerrasseDetailModal
        isOpen={isDetailOpen && selectedVersion !== null}
        onClose={handleCloseDetail}
        versionItem={selectedVersion}
        chantierNom={chantierNom}
        onNewVersion={(source) => {
          handleCloseDetail();
          onClose();
          onOpenNewVersion(source);
        }}
      />
    </>
  );
};
