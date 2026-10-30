"use client";

import React, { useState } from "react";
import { X, UserPlus, Building2, User, Phone, Mail, MapPin, FileText, CheckCircle2 } from "lucide-react";
import { TypeClient, ClientRow } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { createClientRecord, createContactRecord } from "@/lib/services/clientService";
import { useAuth } from "@/lib/auth/useAuth";
import { normalizeTitleCase, normalizeEmail } from "@/lib/formatters";

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: (client: ClientRow) => void;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
  onClientCreated,
}) => {
  const { entreprise } = useAuth();
  const [typeClient, setTypeClient] = useState<TypeClient>("particulier");

  // Champs Particulier
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");

  // Champs Professionnel
  const [societe, setSociete] = useState("");
  const [nomCommercial, setNomCommercial] = useState("");
  const [siret, setSiret] = useState("");

  // Coordonnées communes
  const [telephone, setTelephone] = useState("");
  const [telephoneSecondaire, setTelephoneSecondaire] = useState("");
  const [email, setEmail] = useState("");

  // Adresse de facturation
  const [adresse, setAdresse] = useState("");
  const [adresseComplement, setAdresseComplement] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [ville, setVille] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  // Contact initial (pour pro ou particulier)
  const [addInitialContact, setAddInitialContact] = useState(false);
  const [contactPrenom, setContactPrenom] = useState("");
  const [contactNom, setContactNom] = useState("");
  const [contactFonction, setContactFonction] = useState("");
  const [contactTel, setContactTel] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validations obligatoires
    if (typeClient === "particulier") {
      if (!prenom.trim() || !nom.trim()) {
        setErrorMsg("Le prénom et le nom sont obligatoires pour un particulier.");
        return;
      }
    } else {
      if (!societe.trim()) {
        setErrorMsg("La raison sociale est obligatoire pour un professionnel.");
        return;
      }
    }

    if (!telephone.trim()) {
      setErrorMsg("Le téléphone principal est obligatoire.");
      return;
    }

    if (!adresse.trim() || !codePostal.trim() || !ville.trim()) {
      setErrorMsg("L'adresse de facturation (adresse, code postal, ville) est obligatoire.");
      return;
    }

    if (!entreprise?.id) {
      setErrorMsg("Aucune entreprise active détectée. Veuillez vous connecter.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const normalizedPrenom = prenom.trim() ? normalizeTitleCase(prenom) : null;
      const normalizedNom = nom.trim() ? normalizeTitleCase(nom) : "";
      const normalizedVille = normalizeTitleCase(ville);
      const normalizedEmail = email.trim() ? normalizeEmail(email) : null;

      // 1. Création du client
      const client = await createClientRecord(supabase, entreprise.id, {
        type_client: typeClient,
        nom: typeClient === "particulier" ? normalizedNom : societe.trim(),
        prenom: typeClient === "particulier" ? normalizedPrenom : null,
        societe: typeClient === "professionnel" ? societe.trim() : null,
        nom_commercial: typeClient === "professionnel" && nomCommercial ? nomCommercial.trim() : null,
        siret: typeClient === "professionnel" && siret ? siret.trim() : null,
        telephone: telephone.trim(),
        telephone_secondaire: telephoneSecondaire.trim() || null,
        email: normalizedEmail,
        adresse: adresse.trim(),
        adresse_complement: adresseComplement.trim() || null,
        code_postal: codePostal.trim(),
        ville: normalizedVille,
        notes: notes.trim() || null,
      });

      // 2. Création éventuelle du contact initial
      if (addInitialContact && contactNom.trim()) {
        await createContactRecord(supabase, entreprise.id, client.id, {
          nom: normalizeTitleCase(contactNom),
          prenom: contactPrenom.trim() ? normalizeTitleCase(contactPrenom) : null,
          fonction: contactFonction.trim() || null,
          telephone: contactTel.trim() || null,
          email: contactEmail.trim() ? normalizeEmail(contactEmail) : null,
          est_principal: true,
        });
      }

      onClientCreated(client);
      onClose();
    } catch (err: any) {
      console.error("Erreur création client:", err);
      setErrorMsg(err.message || "Impossible d'enregistrer le client.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-mobile bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-bna-border max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header modal */}
        <div className="flex items-center justify-between pb-3 border-b border-bna-border/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-orange-50 text-bna-copper">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-bna-anthracite">
                Nouveau Client
              </h3>
              <p className="text-[11px] text-bna-muted">Fiche client et facturation</p>
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

        {/* Formulaire défilable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pt-3.5 space-y-4 pr-1">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Toggle Type Client */}
          <div>
            <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1.5">
              Type de client
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-bna-offwhite rounded-2xl border border-bna-border/60">
              <button
                type="button"
                onClick={() => setTypeClient("particulier")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  typeClient === "particulier"
                    ? "bg-white text-bna-copper shadow-xs border border-bna-border/60"
                    : "text-bna-muted hover:text-bna-anthracite"
                }`}
              >
                <User className="w-4 h-4" />
                <span>Particulier</span>
              </button>
              <button
                type="button"
                onClick={() => setTypeClient("professionnel")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  typeClient === "professionnel"
                    ? "bg-white text-bna-copper shadow-xs border border-bna-border/60"
                    : "text-bna-muted hover:text-bna-anthracite"
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Professionnel</span>
              </button>
            </div>
          </div>

          {/* Identité : Particulier */}
          {typeClient === "particulier" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Jean"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    onBlur={() => setPrenom(normalizeTitleCase(prenom))}
                    className="w-full px-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-sm font-medium focus:outline-hidden focus:border-bna-copper focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Dupont"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    onBlur={() => setNom(normalizeTitleCase(nom))}
                    className="w-full px-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-sm font-medium focus:outline-hidden focus:border-bna-copper focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Identité : Professionnel */}
          {typeClient === "professionnel" && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
                  Raison sociale <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="SCI Martin Immobilier"
                  value={societe}
                  onChange={(e) => setSociete(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-sm font-medium focus:outline-hidden focus:border-bna-copper focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
                    Nom commercial
                  </label>
                  <input
                    type="text"
                    placeholder="Martin Immo"
                    value={nomCommercial}
                    onChange={(e) => setNomCommercial(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-sm font-medium focus:outline-hidden focus:border-bna-copper focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
                    SIRET
                  </label>
                  <input
                    type="text"
                    placeholder="14 chiffres"
                    value={siret}
                    onChange={(e) => setSiret(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-sm font-medium focus:outline-hidden focus:border-bna-copper focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Coordonnées */}
          <div className="space-y-3 pt-1 border-t border-bna-border/40">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
                  Téléphone principal <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-bna-muted absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    placeholder="06 12 34 56 78"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-sm font-medium focus:outline-hidden focus:border-bna-copper focus:bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
                  Téléphone secondaire
                </label>
                <input
                  type="tel"
                  placeholder="05 56 00 00 00"
                  value={telephoneSecondaire}
                  onChange={(e) => setTelephoneSecondaire(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-sm font-medium focus:outline-hidden focus:border-bna-copper focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-bna-muted absolute left-3 top-3" />
                <input
                  type="email"
                  placeholder="contact@exemple.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmail(normalizeEmail(email))}
                  className="w-full pl-9 pr-3 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-sm font-medium focus:outline-hidden focus:border-bna-copper focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Adresse de Facturation */}
          <div className="space-y-3 pt-1 border-t border-bna-border/40">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-bna-copper" />
              <label className="text-[11px] font-bold text-bna-muted uppercase">
                Adresse de facturation <span className="text-red-500">*</span>
              </label>
            </div>

            <div>
              <input
                type="text"
                required
                placeholder="Numéro et nom de rue *"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-sm font-medium focus:outline-hidden focus:border-bna-copper focus:bg-white"
              />
            </div>

            <div>
              <input
                type="text"
                placeholder="Complément d'adresse (Bâtiment, étage...)"
                value={adresseComplement}
                onChange={(e) => setAdresseComplement(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-sm font-medium focus:outline-hidden focus:border-bna-copper focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <input
                  type="text"
                  required
                  placeholder="Code postal *"
                  value={codePostal}
                  onChange={(e) => setCodePostal(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-sm font-medium focus:outline-hidden focus:border-bna-copper focus:bg-white"
                />
              </div>
              <div>
                <input
                  type="text"
                  required
                  placeholder="Ville *"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  onBlur={() => setVille(normalizeTitleCase(ville))}
                  className="w-full px-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-sm font-medium focus:outline-hidden focus:border-bna-copper focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Option Contact Initial */}
          <div className="pt-2 border-t border-bna-border/40">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={addInitialContact}
                onChange={(e) => setAddInitialContact(e.target.checked)}
                className="w-4 h-4 rounded text-bna-copper focus:ring-bna-copper"
              />
              <span className="text-xs font-semibold text-bna-anthracite">
                + Ajouter un contact référent direct
              </span>
            </label>

            {addInitialContact && (
              <div className="mt-3 p-3 bg-neutral-50 rounded-2xl border border-bna-border/60 space-y-2.5">
                <span className="text-[10px] font-bold text-bna-muted uppercase block">
                  Contact principal rattaché
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Prénom"
                    value={contactPrenom}
                    onChange={(e) => setContactPrenom(e.target.value)}
                    onBlur={() => setContactPrenom(normalizeTitleCase(contactPrenom))}
                    className="w-full px-3 py-2 bg-white border border-bna-border rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Nom *"
                    value={contactNom}
                    onChange={(e) => setContactNom(e.target.value)}
                    onBlur={() => setContactNom(normalizeTitleCase(contactNom))}
                    className="w-full px-3 py-2 bg-white border border-bna-border rounded-lg text-xs"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Fonction (ex. Gérant, Comptabilité)"
                  value={contactFonction}
                  onChange={(e) => setContactFonction(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-bna-border rounded-lg text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    placeholder="Téléphone contact"
                    value={contactTel}
                    onChange={(e) => setContactTel(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-bna-border rounded-lg text-xs"
                  />
                  <input
                    type="email"
                    placeholder="Email contact"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    onBlur={() => setContactEmail(normalizeEmail(contactEmail))}
                    className="w-full px-3 py-2 bg-white border border-bna-border rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="pt-1">
            <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
              Notes & Remarques
            </label>
            <textarea
              rows={2}
              placeholder="Spécificités d'accès, horaires ou détails client..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-xs font-medium focus:outline-hidden focus:border-bna-copper focus:bg-white resize-none"
            />
          </div>

          {/* Bouton de soumission */}
          <div className="pt-2 sticky bottom-0 bg-white pb-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-bna-copper hover:bg-bna-copper-hover text-white font-semibold text-sm rounded-xl shadow-copper transition-all active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Enregistrement...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Enregistrer la fiche client</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
