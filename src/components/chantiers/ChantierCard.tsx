"use client";

import React, { useState } from "react";
import { MoreVertical, FolderOpen, Trash2, MapPin, User, Phone } from "lucide-react";
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

  // Priorité téléphone : 1. contact chantier sélectionné, 2. sinon téléphone principal client
  const telephoneAffiche = chantier.telephoneContact || chantier.telephoneClient;

  return (
    <>
      <div
        onClick={() => onOpen(chantier.id)}
        className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs cursor-pointer hover:border-bna-copper/40 transition-all space-y-2.5 relative group"
      >
        {/* Ligne 1 : Badge Métier & Avancement + Menu ⋮ */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${metierConfig.badgeColor}`}
          >
            {metierConfig.label.toUpperCase()}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold text-bna-copper bg-bna-copper-light/60 px-2.5 py-0.5 rounded-xl">
              {chantier.avancementGlobal} %
            </span>

            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 rounded-lg text-bna-muted hover:text-bna-anthracite hover:bg-neutral-100 transition-colors"
                aria-label="Actions chantier"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
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

        {/* Ligne 2 : Nom du Chantier */}
        <h3 className="font-display font-bold text-base text-bna-anthracite leading-snug">
          {chantier.nom}
        </h3>

        {/* Ligne 3 : Client & Téléphone prioritaire */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-bna-anthracite">
          {chantier.client_nom && (
            <span className="flex items-center gap-1 font-semibold">
              <User className="w-3.5 h-3.5 text-bna-copper shrink-0" />
              <span className="truncate max-w-[180px]">{chantier.client_nom}</span>
            </span>
          )}

          {telephoneAffiche && (
            <a
              href={`tel:${telephoneAffiche}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-bna-muted hover:text-bna-copper font-medium"
            >
              <Phone className="w-3 h-3 text-bna-copper shrink-0" />
              <span>{telephoneAffiche}</span>
            </a>
          )}
        </div>

        {/* Ligne 4 : Adresse d'intervention complète */}
        <div className="flex items-start gap-1.5 text-xs text-bna-anthracite pt-1 border-t border-bna-border/40">
          <MapPin className="w-3.5 h-3.5 text-bna-copper shrink-0 mt-0.5" />
          <div className="min-w-0 leading-tight">
            {chantier.adresse && (
              <p className="font-medium text-bna-anthracite truncate">
                {chantier.adresse}
                {chantier.adresse_complement ? ` (${chantier.adresse_complement})` : ""}
              </p>
            )}
            <p className="text-bna-muted text-[11px] mt-0.5">
              {chantier.code_postal ? `${chantier.code_postal} ` : ""}
              {chantier.ville}
            </p>
          </div>
        </div>

        {/* Ligne 5 : Description courte */}
        {chantier.intervention && (
          <p className="text-xs text-bna-muted line-clamp-1 italic pt-0.5">
            {chantier.intervention}
          </p>
        )}
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
