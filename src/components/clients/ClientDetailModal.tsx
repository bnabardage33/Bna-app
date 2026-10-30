"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Trash2,
  Plus,
  Star,
  HardHat,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { ClientRow, ContactClientRow } from "@/types/database.types";
import { Chantier } from "@/types/metier";
import { createClient } from "@/lib/supabase/client";
import {
  getContactsByClient,
  createContactRecord,
  softDeleteContact,
  softDeleteClient,
} from "@/lib/services/clientService";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { useAuth } from "@/lib/auth/useAuth";
import { normalizeTitleCase, normalizeEmail } from "@/lib/formatters";

interface ClientDetailModalProps {
  client: ClientRow | null;
  isOpen: boolean;
  onClose: () => void;
  onClientUpdated: () => void;
  onOpenChantier?: (chantierId: string) => void;
  chantiers: Chantier[];
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client,
  isOpen,
  onClose,
  onClientUpdated,
  onOpenChantier,
  chantiers,
}) => {
  const { user, entreprise } = useAuth();
  const [contacts, setContacts] = useState<ContactClientRow[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Formulaire nouveau contact
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactNom, setNewContactNom] = useState("");
  const [newContactPrenom, setNewContactPrenom] = useState("");
  const [newContactFonction, setNewContactFonction] = useState("");
  const [newContactTel, setNewContactTel] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPrincipal, setNewContactPrincipal] = useState(false);

  // Modals de confirmation
  const [confirmDeleteClientOpen, setConfirmDeleteClientOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<ContactClientRow | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  // Chantiers rattachés à ce client (actifs)
  const clientChantiers = client
    ? chantiers.filter((c) => c.client_id === client.id && !c.deleted_at)
    : [];

  const loadContacts = async () => {
    if (!client) return;
    setLoadingContacts(true);
    try {
      const list = await getContactsByClient(supabase, client.id);
      setContacts(list);
    } catch (err) {
      console.error("Erreur chargement contacts:", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    if (isOpen && client) {
      loadContacts();
      setIsAddingContact(false);
      setErrorMessage(null);
    }
  }, [isOpen, client]);

  if (!isOpen || !client) return null;

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactNom.trim() || !entreprise?.id) return;

    try {
      await createContactRecord(supabase, entreprise.id, client.id, {
        nom: normalizeTitleCase(newContactNom),
        prenom: newContactPrenom.trim() ? normalizeTitleCase(newContactPrenom) : undefined,
        fonction: newContactFonction.trim() || undefined,
        telephone: newContactTel.trim() || undefined,
        email: newContactEmail.trim() ? normalizeEmail(newContactEmail) : undefined,
        est_principal: newContactPrincipal,
      });

      setNewContactNom("");
      setNewContactPrenom("");
      setNewContactFonction("");
      setNewContactTel("");
      setNewContactEmail("");
      setNewContactPrincipal(false);
      setIsAddingContact(false);
      loadContacts();
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de l'ajout du contact.");
    }
  };

  const handleConfirmDeleteContact = async () => {
    if (!contactToDelete) return;
    try {
      await softDeleteContact(supabase, contactToDelete.id);
      setContactToDelete(null);
      loadContacts();
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur suppression contact.");
    }
  };

  const handleConfirmDeleteClient = async () => {
    try {
      await softDeleteClient(supabase, client.id);
      setConfirmDeleteClientOpen(false);
      onClientUpdated();
      onClose();
    } catch (err: any) {
      setConfirmDeleteClientOpen(false);
      setErrorMessage(err.message || "Impossible de mettre ce client à la corbeille.");
    }
  };

  const clientTitle =
    client.type_client === "professionnel"
      ? client.societe || client.nom
      : `${client.prenom ? client.prenom + " " : ""}${client.nom}`;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
        <div
          className="w-full max-w-mobile bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-bna-border max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-bna-border/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-orange-50 text-bna-copper">
                {client.type_client === "professionnel" ? (
                  <Building2 className="w-5 h-5" />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-base text-bna-anthracite leading-tight truncate max-w-[200px]">
                    {clientTitle}
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 text-bna-muted">
                    {client.type_client}
                  </span>
                </div>
                <p className="text-[11px] text-bna-muted">{client.ville}</p>
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

          {/* Corps défilable */}
          <div className="flex-1 overflow-y-auto pt-3.5 space-y-4 pr-1">
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Coordonnées principales */}
            <div className="bg-bna-offwhite/50 border border-bna-border/70 rounded-2xl p-3.5 space-y-2">
              <span className="text-[10px] font-bold text-bna-muted uppercase tracking-wider block">
                Coordonnées & Contact principal
              </span>

              <div className="flex items-center gap-2 text-xs">
                <Phone className="w-4 h-4 text-bna-copper shrink-0" />
                <a
                  href={`tel:${client.telephone}`}
                  className="font-semibold text-bna-anthracite hover:text-bna-copper underline-offset-2 hover:underline"
                >
                  {client.telephone}
                </a>
                {client.telephone_secondaire && (
                  <span className="text-bna-muted text-[11px]">
                    / {client.telephone_secondaire}
                  </span>
                )}
              </div>

              {client.email && (
                <div className="flex items-center gap-2 text-xs">
                  <Mail className="w-4 h-4 text-bna-copper shrink-0" />
                  <a
                    href={`mailto:${client.email}`}
                    className="text-bna-anthracite hover:text-bna-copper"
                  >
                    {client.email}
                  </a>
                </div>
              )}

              {client.siret && (
                <div className="text-[11px] text-bna-muted pt-1 border-t border-bna-border/40">
                  SIRET : <span className="font-mono text-bna-anthracite">{client.siret}</span>
                </div>
              )}
            </div>

            {/* Adresse de Facturation (distincte de l'intervention) */}
            <div className="bg-bna-offwhite/50 border border-bna-border/70 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-bna-copper" />
                <span className="text-[10px] font-bold text-bna-muted uppercase tracking-wider">
                  Adresse de Facturation
                </span>
              </div>
              <p className="text-xs font-semibold text-bna-anthracite">{client.adresse}</p>
              {client.adresse_complement && (
                <p className="text-xs text-bna-muted">{client.adresse_complement}</p>
              )}
              <p className="text-xs text-bna-anthracite">
                {client.code_postal} {client.ville}
              </p>
            </div>

            {/* Contacts rattachés */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-bna-muted uppercase tracking-wider">
                  Contacts ({contacts.length})
                </span>
                {!isAddingContact && (
                  <button
                    type="button"
                    onClick={() => setIsAddingContact(true)}
                    className="flex items-center gap-1 text-xs font-bold text-bna-copper hover:text-bna-copper-hover"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>
                )}
              </div>

              {/* Formulaire ajout contact */}
              {isAddingContact && (
                <form
                  onSubmit={handleAddContact}
                  className="p-3 bg-neutral-50 rounded-2xl border border-bna-copper/40 space-y-2.5 animate-in fade-in"
                >
                  <span className="text-[10px] font-bold text-bna-muted uppercase block">
                    Nouveau contact rattaché
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Prénom"
                      value={newContactPrenom}
                      onChange={(e) => setNewContactPrenom(e.target.value)}
                      onBlur={() => setNewContactPrenom(normalizeTitleCase(newContactPrenom))}
                      className="w-full px-3 py-1.5 bg-white border border-bna-border rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Nom *"
                      value={newContactNom}
                      onChange={(e) => setNewContactNom(e.target.value)}
                      onBlur={() => setNewContactNom(normalizeTitleCase(newContactNom))}
                      className="w-full px-3 py-1.5 bg-white border border-bna-border rounded-lg text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Fonction (ex. Conducteur, Comptable)"
                    value={newContactFonction}
                    onChange={(e) => setNewContactFonction(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-bna-border rounded-lg text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="tel"
                      placeholder="Téléphone"
                      value={newContactTel}
                      onChange={(e) => setNewContactTel(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-bna-border rounded-lg text-xs"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={newContactEmail}
                      onChange={(e) => setNewContactEmail(e.target.value)}
                      onBlur={() => setNewContactEmail(normalizeEmail(newContactEmail))}
                      className="w-full px-3 py-1.5 bg-white border border-bna-border rounded-lg text-xs"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-bna-anthracite">
                    <input
                      type="checkbox"
                      checked={newContactPrincipal}
                      onChange={(e) => setNewContactPrincipal(e.target.checked)}
                      className="w-4 h-4 rounded text-bna-copper"
                    />
                    <span>Définir comme contact principal actif</span>
                  </label>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingContact(false)}
                      className="px-3 py-1 text-xs text-bna-muted hover:text-bna-anthracite"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-bna-copper text-white text-xs font-semibold rounded-lg hover:bg-bna-copper-hover"
                    >
                      Enregistrer
                    </button>
                  </div>
                </form>
              )}

              {/* Liste des contacts */}
              {loadingContacts ? (
                <p className="text-xs text-bna-muted py-2">Chargement des contacts...</p>
              ) : contacts.length === 0 && !isAddingContact ? (
                <p className="text-xs text-bna-muted italic py-1">
                  Aucun contact secondaire pour ce client.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {contacts.map((ct) => (
                    <div
                      key={ct.id}
                      className="flex items-center justify-between p-2.5 bg-white border border-bna-border rounded-xl text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-bna-anthracite">
                            {ct.prenom ? `${ct.prenom} ` : ""}
                            {ct.nom}
                          </span>
                          {ct.fonction && (
                            <span className="text-[11px] text-bna-muted">({ct.fonction})</span>
                          )}
                          {ct.est_principal && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              Principal
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-bna-muted mt-0.5">
                          {ct.telephone && <span>{ct.telephone}</span>}
                          {ct.email && <span>{ct.email}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setContactToDelete(ct)}
                        className="p-1.5 text-bna-muted hover:text-red-600 rounded-lg transition-colors"
                        title="Mettre ce contact à la corbeille"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chantiers associés (1 Client -> N Chantiers) */}
            <div className="space-y-2 pt-1 border-t border-bna-border/40">
              <div className="flex items-center gap-1.5">
                <HardHat className="w-4 h-4 text-bna-copper" />
                <span className="text-[11px] font-bold text-bna-muted uppercase tracking-wider">
                  Chantiers associés ({clientChantiers.length})
                </span>
              </div>

              {clientChantiers.length === 0 ? (
                <p className="text-xs text-bna-muted italic py-1">
                  Aucun chantier en cours pour ce client.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {clientChantiers.map((ch) => (
                    <div
                      key={ch.id}
                      onClick={() => {
                        if (onOpenChantier) {
                          onOpenChantier(ch.id);
                          onClose();
                        }
                      }}
                      className="p-2.5 bg-white border border-bna-border rounded-xl flex items-center justify-between cursor-pointer hover:border-bna-copper/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase text-bna-copper">
                            {ch.metier}
                          </span>
                          <span className="text-xs font-bold text-bna-anthracite">{ch.nom}</span>
                        </div>
                        <p className="text-[11px] text-bna-muted mt-0.5">
                          {ch.ville} {ch.adresse ? `· ${ch.adresse}` : ""}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-bna-copper bg-orange-50 px-2 py-0.5 rounded-lg">
                        {ch.avancementGlobal}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            {client.notes && (
              <div className="pt-1 border-t border-bna-border/40">
                <div className="flex items-center gap-1.5 text-bna-muted mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Notes</span>
                </div>
                <p className="text-xs text-bna-anthracite bg-bna-offwhite/50 p-2.5 rounded-xl border border-bna-border/50 whitespace-pre-wrap">
                  {client.notes}
                </p>
              </div>
            )}
          </div>

          {/* Footer avec action Corbeille sécurisée */}
          <div className="pt-3 border-t border-bna-border/60 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (clientChantiers.length > 0) {
                  setErrorMessage(
                    `Ce client possède encore ${clientChantiers.length} chantier(s) actif(s). Placez d'abord ces chantiers dans la corbeille ou archivez-les.`
                  );
                } else {
                  setConfirmDeleteClientOpen(true);
                }
              }}
              className="w-full py-2.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Mettre ce client à la corbeille</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation corbeille client */}
      <ConfirmModal
        isOpen={confirmDeleteClientOpen}
        title="Mettre ce client à la corbeille ?"
        message="Le client ne sera plus visible dans la liste active. Il pourra être restauré à tout moment depuis la corbeille."
        confirmLabel="Mettre à la corbeille"
        cancelLabel="Annuler"
        isDestructive={true}
        onConfirm={handleConfirmDeleteClient}
        onCancel={() => setConfirmDeleteClientOpen(false)}
      />

      {/* Confirmation corbeille contact */}
      <ConfirmModal
        isOpen={!!contactToDelete}
        title="Mettre ce contact à la corbeille ?"
        message={`Le contact "${contactToDelete?.prenom ? contactToDelete.prenom + " " : ""}${contactToDelete?.nom}" sera placé dans la corbeille. Les relations de chantiers existantes resteront préservées.`}
        confirmLabel="Mettre à la corbeille"
        cancelLabel="Annuler"
        isDestructive={true}
        onConfirm={handleConfirmDeleteContact}
        onCancel={() => setContactToDelete(null)}
      />
    </>
  );
};
