'use client';

import React, { useState } from 'react';
import {
  X,
  FileCheck2,
  Copy,
  Printer,
  ShieldAlert,
  Check,
  AlertTriangle,
  Building2,
  Calendar,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { AttestationIntemperie } from '@/lib/services/meteoAssistantService';

interface AttestationIntemperieModalProps {
  isOpen: boolean;
  onClose: () => void;
  attestation: AttestationIntemperie | null;
}

export const AttestationIntemperieModal: React.FC<AttestationIntemperieModalProps> = ({
  isOpen,
  onClose,
  attestation,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !attestation) return null;

  const clientMessageText = `Bonjour ${attestation.clientNom || 'Madame, Monsieur'},
En raison des conditions météorologiques défavorables constatées ce jour sur votre chantier "${attestation.chantierNom}" (${attestation.relevesMesures.precipitationsCumulees}, ${attestation.relevesMesures.rafalesMaximales}), les opérations de pose extérieure sont temporairement suspendues conformément aux règles de l'art (DTU) et aux consignes de sécurité.
Réf. justificatif légal : ${attestation.referenceDoc}.
Nous reprenons l'intervention dès le rétablissement de conditions conformes pour garantir la pérennité de votre ouvrage.
Bien cordialement,
L'équipe BNA`;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(clientMessageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert('Impossible de copier le message.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-bna-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* EN-TÊTE MODAL */}
        <div className="p-4 sm:p-5 border-b border-bna-border bg-bna-offwhite flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-900">
              <ShieldAlert className="w-5 h-5 text-bna-copper" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-bna-muted uppercase">
                COUVERTURE JURIDIQUE & DTU
              </span>
              <h2 className="font-display font-bold text-base text-bna-anthracite">
                Attestation d&apos;Intempérie Officielle
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-bna-muted hover:text-bna-anthracite rounded-xl hover:bg-neutral-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPS DU CERTIFICAT OFFICIEL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs text-bna-anthracite">
          {/* BANDEAU OFFICIEL EN-TÊTE DOCUMENT */}
          <div className="p-4 rounded-2xl border border-bna-border/80 bg-neutral-50/70 space-y-3">
            <div className="flex items-start justify-between border-b border-bna-border/60 pb-3">
              <div>
                <p className="font-display font-extrabold text-sm text-bna-anthracite uppercase tracking-wider">
                  BNA — BARDAGE &amp; TERRASSE AQUITAINE
                </p>
                <p className="text-[11px] text-bna-muted">
                  Spécialiste Pose Extérieure Bois &amp; Composite · Gironde
                </p>
              </div>
              <div className="text-right">
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-bna-border text-bna-copper">
                  {attestation.referenceDoc}
                </span>
                <p className="text-[10px] text-bna-muted mt-0.5">Date : {attestation.dateEmission}</p>
              </div>
            </div>

            {/* INFOS CHANTIER & CLIENT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-bna-muted uppercase text-[9px] font-bold block">
                  Chantier concerné :
                </span>
                <p className="font-bold text-bna-anthracite">{attestation.chantierNom}</p>
                <p className="text-bna-muted">
                  {attestation.chantierAdresse ? `${attestation.chantierAdresse}, ` : ''}
                  {attestation.chantierVille}
                </p>
              </div>
              <div>
                <span className="text-bna-muted uppercase text-[9px] font-bold block">
                  Client destinataire :
                </span>
                <p className="font-bold text-bna-anthracite">
                  {attestation.clientNom || 'Maître d’ouvrage'}
                </p>
                <p className="text-bna-muted">Corps d&apos;état : {attestation.metier.toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* MOTIF DE LA SUSPENSION */}
          <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>MOTIF OFFICIEL D&apos;ARRÊT TECHNIQUE</span>
            </div>
            <p className="text-xs text-rose-950 font-medium pl-5">{attestation.motifPrincipal}</p>
          </div>

          {/* RELEVÉS CONSTATÉS (METEO-FRANCE + MESURES LOCALES) */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-bna-muted">
              Relevés Météorologiques Conformes
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-bna-offwhite rounded-xl border border-bna-border">
                <span className="text-[9px] text-bna-muted block uppercase font-bold">
                  Précipitations
                </span>
                <span className="font-bold text-bna-anthracite block mt-0.5">
                  {attestation.relevesMesures.precipitationsCumulees}
                </span>
              </div>
              <div className="p-2.5 bg-bna-offwhite rounded-xl border border-bna-border">
                <span className="text-[9px] text-bna-muted block uppercase font-bold">
                  Rafales de Vent
                </span>
                <span className="font-bold text-bna-anthracite block mt-0.5">
                  {attestation.relevesMesures.rafalesMaximales}
                </span>
              </div>
              <div className="p-2.5 bg-bna-offwhite rounded-xl border border-bna-border">
                <span className="text-[9px] text-bna-muted block uppercase font-bold">
                  Températures
                </span>
                <span className="font-bold text-bna-anthracite block mt-0.5">
                  {attestation.relevesMesures.temperatureMinMax}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-xl text-[11px] text-amber-950">
              <b>Vigilance Météo-France :</b> {attestation.niveauVigilanceMeteoFrance}
              <p className="italic text-amber-900/90 mt-0.5">« {attestation.bulletinOfficielText} »</p>
            </div>
          </div>

          {/* RÉFÉRENCES JURIDIQUES ET DTU */}
          <div className="space-y-1.5 pt-1">
            <h4 className="font-bold text-xs uppercase tracking-wider text-bna-muted">
              Cadre Réglementaire &amp; Normatif
            </h4>
            <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside bg-neutral-50 p-3 rounded-xl border border-bna-border/80">
              {attestation.reglementationsBtp.map((reg, idx) => (
                <li key={idx} className="leading-relaxed">
                  {reg}
                </li>
              ))}
            </ul>
          </div>

          {/* CONCLUSION JURIDIQUE */}
          <div className="p-3 bg-neutral-100 rounded-xl text-[11px] text-slate-600 leading-relaxed">
            <b>Effet juridique :</b> {attestation.consequenceChantier}
          </div>
        </div>

        {/* PIED DE MODAL & ACTIONS */}
        <div className="p-4 border-t border-bna-border bg-bna-offwhite flex flex-col sm:flex-row gap-2.5 justify-between">
          <button
            type="button"
            onClick={handleCopyMessage}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
              copied
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white hover:bg-neutral-50 text-bna-anthracite border-bna-border'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-bna-copper" />}
            <span>{copied ? 'Message client copié !' : 'Copier SMS / WhatsApp client'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 bg-bna-copper hover:bg-bna-copper-hover text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer / Exporter PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
