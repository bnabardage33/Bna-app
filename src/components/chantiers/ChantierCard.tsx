"use client";

import React, { useState } from "react";
import { MoreVertical, FolderOpen, Trash2, MapPin, User } from "lucide-react";
import { Chantier, METIERS_CONFIG } from "@/types/metier";
import { ConfirmModal } from "@/components/common/ConfirmModal";

interface ChantierCardProps {
  chantier: Chantier;
  onOpen: (id: string) => void;
  onSoftDelete: (id: string) => void;
}

export const ChantierCard: React.FC<ChantierCardProps> = ({
  chantier,
  onOpen,
  onSoftDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const metierConfig = METIERS_CONFIG[chantier.metier];

  return (
    <>
      <div
        onClick={() => onOpen(chantier.id)}
        className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs cursor-pointer hover:border-bna-copper/40 transition-all relative group"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${metierConfig.badgeColor}`}
              >
                {metierConfig.label.split(" ")[0]}
              </span>
              <span className="flex items-center gap-0.5 text-[11px] text-bna-muted font-medium">
                <MapPin className="w-3 h-3 text-bna-copper shrink-0" />
                {chantier.ville}
              </span>
            </div>

            <h3 className="font-display font-bold text-base text-bna-anthracite mt-1 truncate">
              {chantier.nom}
            </h3>

            {chantier.client_nom && (
              <div className="flex items-center gap-1 text-[11px] font-semibold text-bna-anthracite mt-0.5">
                <User className="w-3 h-3 text-bna-copper" />
                <span>Client : {chantier.client_nom}</span>
              </div>
            )}

            <p className="text-xs text-bna-muted mt-0.5 line-clamp-1">{chantier.intervention}</p>
          </div>

          {/* Avancement & Menu ⋮ */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold text-bna-copper bg-bna-copper-light/60 px-2.5 py-1 rounded-xl">
              {chantier.avancementGlobal}%
            </span>

            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 rounded-lg text-bna-muted hover:text-bna-anthracite hover:bg-neutral-100 transition-colors"
                aria-label="Actions chantier"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 w-44 bg-white rounded-2xl shadow-xl border border-bna-border py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpen(chantier.id);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-bna-anthracite hover:bg-neutral-50 flex items-center gap-2"
                    >
                      <FolderOpen className="w-4 h-4 text-bna-copper" />
                      <span>Ouvrir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmOpen(true);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                      <span>Mettre à la corbeille</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation explicite avant mise à la corbeille */}
      <ConfirmModal
        isOpen={confirmOpen}
        title="Mettre ce chantier à la corbeille ?"
        message="Le chantier ne sera plus visible dans la liste active. Il pourra être restauré depuis la corbeille."
        confirmLabel="Mettre à la corbeille"
        cancelLabel="Annuler"
        isDestructive={true}
        onConfirm={() => {
          setConfirmOpen(false);
          onSoftDelete(chantier.id);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};
