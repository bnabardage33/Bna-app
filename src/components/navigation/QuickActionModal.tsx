"use client";

import React from "react";
import { Camera, Mic, Ruler, Grid, FolderPlus, FilePlus, X } from "lucide-react";

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCalepinage: () => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  onClose,
  onOpenCalepinage,
}) => {
  if (!isOpen) return null;

  const actions = [
    {
      title: "Prendre une photo",
      desc: "Chantier en cours ou constat",
      icon: Camera,
      color: "bg-blue-50 text-blue-600",
      action: () => alert("Capture photo"),
    },
    {
      title: "Note vocale",
      desc: "Enregistrement rapide terrain",
      icon: Mic,
      color: "bg-red-50 text-red-600",
      action: () => alert("Note vocale"),
    },
    {
      title: "Nouvelle mesure",
      desc: "Relevé cotes et surfaces",
      icon: Ruler,
      color: "bg-amber-50 text-amber-700",
      action: () => alert("Prise de mesure"),
    },
    {
      title: "Calepinage",
      desc: "Calcul déterministe lames & lambourdes",
      icon: Grid,
      color: "bg-orange-50 text-bna-copper",
      action: () => {
        onOpenCalepinage();
      },
    },
    {
      title: "Nouveau chantier",
      desc: "Créer une fiche projet",
      icon: FolderPlus,
      color: "bg-emerald-50 text-emerald-700",
      action: () => alert("Nouveau chantier"),
    },
    {
      title: "Nouveau devis / client",
      desc: "Chiffrage rapide ou prospect",
      icon: FilePlus,
      color: "bg-purple-50 text-purple-700",
      action: () => alert("Nouveau devis / client"),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-mobile bg-white rounded-t-3xl p-5 shadow-2xl border-t border-bna-border pb-8 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-bna-border/60">
          <div>
            <h3 className="font-display font-bold text-lg text-bna-anthracite">Actions rapides</h3>
            <p className="text-xs text-bna-muted">Création & saisie directe terrain</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 text-bna-muted transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          {actions.map((act, index) => {
            const Icon = act.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  onClose();
                  act.action();
                }}
                className="flex flex-col items-start p-3.5 bg-bna-offwhite hover:bg-[#eceae4] rounded-2xl border border-bna-border transition-all text-left active:scale-[0.98]"
              >
                <div className={`p-2.5 rounded-xl ${act.color} mb-2.5`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-semibold text-xs text-bna-anthracite leading-tight">{act.title}</span>
                <span className="text-[10px] text-bna-muted mt-0.5 leading-snug">{act.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
