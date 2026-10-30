"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FolderPlus,
  User,
  Building2,
  Search,
  Plus,
  Check,
  CheckCircle2,
  MapPin,
  Phone,
  Calendar,
  ArrowRight,
  ArrowLeft,
  Copy,
  AlertCircle,
} from "lucide-react";
import { MetierType, METIERS_CONFIG } from "@/types/metier";
import { ClientRow, ContactClientRow } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { getClients, getContactsByClient } from "@/lib/services/clientService";
import { createChantierRecord } from "@/lib/services/chantierService";
import { useAuth } from "@/lib/auth/useAuth";
import { NewClientModal } from "@/components/clients/NewClientModal";
import { normalizeTitleCase } from "@/lib/formatters";

interface NewChantierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChantierCreated: () => void;
  initialClientId?: string;
}

export const NewChantierModal: React.FC<NewChantierModalProps> = ({
  isOpen,
  onClose,
  onChantierCreated,
  initialClientId,
}) => {
  const { entreprise } = useAuth();
  const supabase = createClient();

  // Étape courante (1: Client, 2: Chantier, 3: Planning, 4: Vérification)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Données clients
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);

  // Contacts du client sélectionné
  const [contacts, setContacts] = useState<ContactClientRow[]>([]);

  // Données Chantier (Étape 2)
  const [metier, setMetier] = useState<MetierType>("terrasse");
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [adresse, setAdresse] = useState("");
  const [adresseComplement, setAdresseComplement] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [ville, setVille] = useState("");
  const [useClientAddress, setUseClientAddress] = useState(false);

  // Planning & Contact (Étape 3)
  const [dateDebutPrevue, setDateDebutPrevue] = useState("");
  const [dateFinPrevue, setDateFinPrevue] = useState("");
  const [contactId, setContactId] = useState<string>("");

  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Chargement des clients actifs
  const loadClientsList = async () => {
    setLoadingClients(true);
    try {
      const data = await getClients(supabase);
      setClients(data);

      if (initialClientId) {
        const found = data.find((c) => c.id === initialClientId);
        if (found) setSelectedClient(found);
      }
    } catch (err) {
      console.error("Erreur chargement clients:", err);
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadClientsList();
      setStep(1);
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Chargement des contacts quand un client est sélectionné
  useEffect(() => {
    if (selectedClient) {
      getContactsByClient(supabase, selectedClient.id)
        .then((cts) => {
          setContacts(cts);
          // Si un contact principal existe, le présélectionner par défaut
          const principal = cts.find((c) => c.est_principal);
          if (principal) {
            setContactId(principal.id);
          } else {
            setContactId("");
          }
        })
        .catch(() => setContacts([]));
    } else {
      setContacts([]);
      setContactId("");
    }
  }, [selectedClient]);

  // Action : copier l'adresse de facturation du client vers l'adresse d'intervention du chantier
  const handleCopyClientAddress = (checked: boolean) => {
    setUseClientAddress(checked);
    if (checked && selectedClient) {
      setAdresse(selectedClient.adresse || "");
      setAdresseComplement(selectedClient.adresse_complement || "");
      setCodePostal(selectedClient.code_postal || "");
      setVille(selectedClient.ville || "");
    }
  };

  if (!isOpen) return null;

  // Filtrage clients pour l'étape 1
  const filteredClients = clients.filter((c) => {
    if (!clientSearch.trim()) return true;
    const term = clientSearch.toLowerCase();
    return (
      c.nom.toLowerCase().includes(term) ||
      (c.prenom && c.prenom.toLowerCase().includes(term)) ||
      (c.societe && c.societe.toLowerCase().includes(term)) ||
      (c.ville && c.ville.toLowerCase().includes(term)) ||
      (c.telephone && c.telephone.toLowerCase().includes(term))
    );
  });

  // Validations par étape
  const canGoToStep2 = !!selectedClient;
  const canGoToStep3 =
    nom.trim().length > 0 &&
    adresse.trim().length > 0 &&
    codePostal.trim().length > 0 &&
    ville.trim().length > 0;

  const handleSubmit = async () => {
    if (!selectedClient || !entreprise?.id) return;
    setLoadingSubmit(true);
    setErrorMessage(null);

    try {
      const normalizedNom = normalizeTitleCase(nom);
      const normalizedVille = normalizeTitleCase(ville);

      await createChantierRecord(supabase, entreprise.id, {
        client_id: selectedClient.id,
        nom: normalizedNom,
        metier,
        description: description.trim() || undefined,
        adresse: adresse.trim(),
        adresse_complement: adresseComplement.trim() || undefined,
        code_postal: codePostal.trim(),
        ville: normalizedVille,
        date_debut_prevue: dateDebutPrevue || undefined,
        date_fin_prevue: dateFinPrevue || undefined,
        contact_id: contactId || undefined,
      });

      onChantierCreated();
      onClose();
    } catch (err: any) {
      console.error("Erreur création chantier:", err);
      setErrorMessage(err.message || "Impossible de créer le chantier.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const selectedClientName = selectedClient
    ? selectedClient.type_client === "professionnel"
      ? selectedClient.societe || selectedClient.nom
      : `${selectedClient.prenom ? selectedClient.prenom + " " : ""}${selectedClient.nom}`
    : "";

  const selectedContact = contacts.find((c) => c.id === contactId);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
        <div
          className="w-full max-w-mobile bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-bna-border max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header & Fil d'Ariane 4 étapes */}
          <div className="pb-3 border-b border-bna-border/60 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-50 text-bna-copper">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-bna-anthracite">
                    Nouveau Chantier
                  </h3>
                  <p className="text-[11px] text-bna-muted">
                    Étape {step} sur 4 :{" "}
                    {step === 1 && "Sélection du client"}
                    {step === 2 && "Détails & Adresse chantier"}
                    {step === 3 && "Planning & Contact terrain"}
                    {step === 4 && "Vérification finale"}
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

            {/* Stepper tactile 4 barres */}
            <div className="grid grid-cols-4 gap-1.5 mt-3">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    step >= s ? "bg-bna-copper" : "bg-neutral-200"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Corps de l'étape */}
          <div className="flex-1 overflow-y-auto pt-3.5 space-y-4 pr-1">
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* ============================================================ */}
            {/* ÉTAPE 1 : CLIENT                                             */}
            {/* ============================================================ */}
            {step === 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-bna-muted uppercase tracking-wider">
                    Client à rattacher <span className="text-red-500">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsNewClientModalOpen(true)}
                    className="flex items-center gap-1 text-xs font-bold text-bna-copper hover:text-bna-copper-hover bg-orange-50 px-2.5 py-1 rounded-xl"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Nouveau client</span>
                  </button>
                </div>

                {/* Recherche client */}
                <div className="relative">
                  <Search className="w-4 h-4 text-bna-muted absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Rechercher un client existant..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-xs font-medium focus:outline-hidden focus:border-bna-copper"
                  />
                </div>

                {/* Liste des clients */}
                {loadingClients ? (
                  <p className="text-xs text-bna-muted py-4 text-center">
                    Chargement des clients...
                  </p>
                ) : filteredClients.length === 0 ? (
                  <div className="p-4 bg-bna-offwhite rounded-2xl border border-bna-border text-center space-y-2">
                    <p className="text-xs font-medium text-bna-anthracite">
                      Aucun client trouvé pour cette recherche.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsNewClientModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bna-copper text-white text-xs font-semibold rounded-xl"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Créer la fiche client</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {filteredClients.map((client) => {
                      const isSelected = selectedClient?.id === client.id;
                      const cName =
                        client.type_client === "professionnel"
                          ? client.societe || client.nom
                          : `${client.prenom ? client.prenom + " " : ""}${client.nom}`;

                      return (
                        <div
                          key={client.id}
                          onClick={() => setSelectedClient(client)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? "border-bna-copper bg-orange-50/60 shadow-xs ring-1 ring-bna-copper"
                              : "border-bna-border bg-white hover:border-bna-copper/40"
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div
                              className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                                isSelected
                                  ? "bg-bna-copper text-white"
                                  : "bg-bna-offwhite text-bna-muted"
                              }`}
                            >
                              {client.type_client === "professionnel" ? (
                                <Building2 className="w-4 h-4" />
                              ) : (
                                <User className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-bold text-xs text-bna-anthracite truncate">
                                  {cName}
                                </h4>
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-neutral-100 text-bna-muted shrink-0">
                                  {client.type_client === "professionnel" ? "Pro" : "Particulier"}
                                </span>
                              </div>
                              <p className="text-[11px] text-bna-anthracite font-medium mt-1 truncate">
                                📍 {client.adresse}
                                {client.adresse_complement ? ` (${client.adresse_complement})` : ""}
                              </p>
                              <p className="text-[11px] text-bna-muted">
                                {client.code_postal} {client.ville}
                              </p>
                              <p className="text-[11px] font-semibold text-bna-anthracite mt-0.5">
                                ☎ {client.telephone}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-bna-copper text-white flex items-center justify-center shrink-0">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* ÉTAPE 2 : CHANTIER & ADRESSE INTERVENTION                    */}
            {/* ============================================================ */}
            {step === 2 && (
              <div className="space-y-3.5">
                {/* Client sélectionné résumé */}
                <div className="p-3 bg-orange-50/60 border border-bna-copper/30 rounded-2xl flex items-start justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-bna-copper uppercase block">
                      Client rattaché
                    </span>
                    <h4 className="font-bold text-sm text-bna-anthracite truncate">
                      {selectedClientName}
                    </h4>
                    <p className="text-xs text-bna-anthracite mt-0.5">
                      {selectedClient?.adresse}
                      {selectedClient?.adresse_complement ? ` (${selectedClient.adresse_complement})` : ""}
                    </p>
                    <p className="text-xs font-semibold text-bna-copper">
                      {selectedClient?.code_postal} {selectedClient?.ville}
                    </p>
                    {selectedClient?.telephone && (
                      <p className="text-[11px] font-medium text-bna-muted mt-1">
                        ☎ {selectedClient.telephone}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-[11px] font-bold text-bna-copper underline hover:text-bna-copper-hover shrink-0 pt-0.5"
                  >
                    Changer
                  </button>
                </div>

                {/* Métier BNA */}
                <div>
                  <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1.5">
                    Corps de métier BNA <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["terrasse", "facade", "cloture"] as MetierType[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMetier(m)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center capitalize ${
                          metier === m
                            ? "border-bna-copper bg-bna-copper text-white shadow-xs"
                            : "border-bna-border bg-white text-bna-anthracite hover:border-bna-copper/40"
                        }`}
                      >
                        {METIERS_CONFIG[m].label.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nom du chantier */}
                <div>
                  <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
                    Nom du chantier <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex. Terrasse composite sur plots"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    onBlur={() => setNom(normalizeTitleCase(nom))}
                    className="w-full px-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-sm font-medium focus:outline-hidden focus:border-bna-copper"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
                    Description des travaux
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Nature de l'intervention, accès, contraintes..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2 bg-bna-offwhite/50 border border-bna-border rounded-xl text-xs font-medium focus:outline-hidden focus:border-bna-copper resize-none"
                  />
                </div>

                {/* Adresse d'intervention */}
                <div className="pt-2 border-t border-bna-border/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-bna-copper" />
                      <label className="text-[11px] font-bold text-bna-muted uppercase">
                        Adresse d&apos;intervention <span className="text-red-500">*</span>
                      </label>
                    </div>

                    {/* Copier l'adresse client */}
                    <button
                      type="button"
                      onClick={() => handleCopyClientAddress(!useClientAddress)}
                      className="flex items-center gap-1 text-[11px] font-bold text-bna-copper hover:underline"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Utiliser l&apos;adresse du client</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="Adresse du chantier (rue, n°) *"
                    value={adresse}
                    onChange={(e) => {
                      setAdresse(e.target.value);
                      setUseClientAddress(false);
                    }}
                    className="w-full px-3.5 py-2.5 bg-bna-offwhite/50 border border-bna-border rounded-xl text-xs font-medium focus:outline-hidden focus:border-bna-copper"
                  />

                  <input
                    type="text"
                    placeholder="Complément d'adresse chantier"
                    value={adresseComplement}
                    onChange={(e) => setAdresseComplement(e.target.value)}
                    className="w-full px-3.5 py-2 bg-bna-offwhite/50 border border-bna-border rounded-xl text-xs font-medium focus:outline-hidden focus:border-bna-copper"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Code postal *"
                      value={codePostal}
                      onChange={(e) => setCodePostal(e.target.value)}
                      className="w-full px-3.5 py-2 bg-bna-offwhite/50 border border-bna-border rounded-xl text-xs font-medium focus:outline-hidden focus:border-bna-copper"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Ville d'intervention *"
                      value={ville}
                      onChange={(e) => setVille(e.target.value)}
                      onBlur={() => setVille(normalizeTitleCase(ville))}
                      className="w-full px-3.5 py-2 bg-bna-offwhite/50 border border-bna-border rounded-xl text-xs font-medium focus:outline-hidden focus:border-bna-copper"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* ÉTAPE 3 : PLANNING & CONTACT                                 */}
            {/* ============================================================ */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Calendar className="w-4 h-4 text-bna-copper" />
                    <span className="text-[11px] font-bold text-bna-muted uppercase tracking-wider">
                      Calendrier prévisionnel
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
                        Début prévu
                      </label>
                      <input
                        type="date"
                        value={dateDebutPrevue}
                        onChange={(e) => setDateDebutPrevue(e.target.value)}
                        className="w-full px-3 py-2 bg-bna-offwhite/50 border border-bna-border rounded-xl text-xs font-medium focus:outline-hidden focus:border-bna-copper"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-bna-muted uppercase block mb-1">
                        Fin prévue
                      </label>
                      <input
                        type="date"
                        value={dateFinPrevue}
                        onChange={(e) => setDateFinPrevue(e.target.value)}
                        className="w-full px-3 py-2 bg-bna-offwhite/50 border border-bna-border rounded-xl text-xs font-medium focus:outline-hidden focus:border-bna-copper"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact chantier référent */}
                <div className="pt-2 border-t border-bna-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-bna-muted uppercase tracking-wider">
                      Contact chantier référent (Facultatif)
                    </span>
                  </div>

                  {contacts.length === 0 ? (
                    <p className="text-xs text-bna-muted italic p-3 bg-neutral-50 rounded-xl">
                      Aucun contact secondaire enregistré pour ce client. Le client principal sera le contact de référence.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <label
                        onClick={() => setContactId("")}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer ${
                          contactId === ""
                            ? "border-bna-copper bg-orange-50/60 font-semibold text-bna-copper"
                            : "border-bna-border bg-white text-bna-anthracite"
                        }`}
                      >
                        <span>Par défaut : {selectedClientName}</span>
                        {contactId === "" && <Check className="w-4 h-4" />}
                      </label>

                      {contacts.map((ct) => (
                        <label
                          key={ct.id}
                          onClick={() => setContactId(ct.id)}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer ${
                            contactId === ct.id
                              ? "border-bna-copper bg-orange-50/60 font-semibold text-bna-copper"
                              : "border-bna-border bg-white text-bna-anthracite"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>
                                {ct.prenom ? ct.prenom + " " : ""}
                                {ct.nom}
                              </span>
                              {ct.fonction && (
                                <span className="text-[10px] text-bna-muted">({ct.fonction})</span>
                              )}
                              {ct.est_principal && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 rounded">
                                  Principal
                                </span>
                              )}
                            </div>
                            {ct.telephone && (
                              <p className="text-[10px] text-bna-muted mt-0.5">{ct.telephone}</p>
                            )}
                          </div>
                          {contactId === ct.id && <Check className="w-4 h-4" />}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* ÉTAPE 4 : VÉRIFICATION (DEUX BLOCS TRÈS DISTINCTS)          */}
            {/* ============================================================ */}
            {step === 4 && (
              <div className="space-y-3.5">
                <p className="text-xs text-bna-muted">
                  Vérifiez la séparation stricte entre la facturation du client et le lieu d&apos;intervention du chantier :
                </p>

                {/* BLOC 1 : CLIENT / FACTURATION */}
                <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                      CLIENT / FACTURATION
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-[10px] font-bold text-blue-700 underline"
                    >
                      Modifier client
                    </button>
                  </div>
                  <h4 className="font-display font-bold text-sm text-bna-anthracite">
                    {selectedClientName}
                  </h4>
                  <p className="text-xs text-bna-anthracite">
                    {selectedClient?.adresse}
                    {selectedClient?.adresse_complement ? `, ${selectedClient.adresse_complement}` : ""}
                  </p>
                  <p className="text-xs font-semibold text-blue-900">
                    {selectedClient?.code_postal} {selectedClient?.ville}
                  </p>
                  <div className="text-[11px] text-bna-muted pt-1 flex items-center gap-3">
                    <span>Tél : {selectedClient?.telephone}</span>
                    {selectedClient?.email && <span>Email : {selectedClient.email}</span>}
                  </div>
                </div>

                {/* BLOC 2 : CHANTIER / INTERVENTION */}
                <div className="p-3.5 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-bna-copper uppercase tracking-wider">
                      CHANTIER / INTERVENTION
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-[10px] font-bold text-bna-copper underline"
                    >
                      Modifier chantier
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-display font-bold text-sm text-bna-anthracite">{nom}</h4>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white text-bna-copper border border-orange-200">
                      {metier}
                    </span>
                  </div>
                  {description && <p className="text-xs text-bna-muted italic">{description}</p>}

                  <div className="pt-1">
                    <span className="text-[10px] font-bold text-bna-muted uppercase block">
                      Lieu des travaux (Météo & Terrain) :
                    </span>
                    <p className="text-xs text-bna-anthracite font-semibold">
                      {adresse}
                      {adresseComplement ? `, ${adresseComplement}` : ""}
                    </p>
                    <p className="text-xs font-bold text-bna-copper">
                      {codePostal} {ville}
                    </p>
                  </div>

                  <div className="text-[11px] text-bna-muted pt-1 flex items-center gap-3">
                    {dateDebutPrevue && <span>Début : {dateDebutPrevue}</span>}
                    {dateFinPrevue && <span>Fin : {dateFinPrevue}</span>}
                  </div>

                  {selectedContact && (
                    <div className="text-[11px] text-bna-anthracite pt-1 border-t border-orange-200/60">
                      Contact référent :{" "}
                      <span className="font-semibold">
                        {selectedContact.prenom ? selectedContact.prenom + " " : ""}
                        {selectedContact.nom}
                      </span>{" "}
                      ({selectedContact.telephone || "Sans tél"})
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer de navigation du tunnel */}
          <div className="pt-3 border-t border-bna-border/60 shrink-0 flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="py-3 px-4 rounded-xl border border-bna-border bg-white text-bna-anthracite text-xs font-semibold hover:bg-neutral-50 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Précédent</span>
              </button>
            )}

            {step < 4 ? (
              <button
                type="button"
                disabled={step === 1 ? !canGoToStep2 : step === 2 ? !canGoToStep3 : false}
                onClick={() => setStep((s) => (s + 1) as any)}
                className="flex-1 py-3 px-4 rounded-xl bg-bna-copper hover:bg-bna-copper-hover text-white text-xs font-semibold shadow-copper active:scale-98 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <span>Continuer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loadingSubmit}
                onClick={handleSubmit}
                className="flex-1 py-3 px-4 rounded-xl bg-bna-copper hover:bg-bna-copper-hover text-white text-xs font-semibold shadow-copper active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {loadingSubmit ? (
                  <span>Création en cours...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Créer le chantier</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal création nouveau client si déclenchée depuis l'étape 1 */}
      <NewClientModal
        isOpen={isNewClientModalOpen}
        onClose={() => setIsNewClientModalOpen(false)}
        onClientCreated={(newClient) => {
          setClients((prev) => [newClient, ...prev]);
          setSelectedClient(newClient);
          setIsNewClientModalOpen(false);
        }}
      />
    </>
  );
};
