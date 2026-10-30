"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Building2,
  User,
  HardHat,
  Users,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getDeletedClients,
  getDeletedContacts,
  restoreClient,
  hardDeleteClient,
  restoreContact,
  hardDeleteContact,
} from "@/lib/services/clientService";
import {
  getDeletedChantiers,
  restoreChantier,
  hardDeleteChantier,
} from "@/lib/services/chantierService";
import { ClientRow, ContactClientRow } from "@/types/database.types";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { useAuth } from "@/lib/auth/useAuth";
import { normalizeTitleCase, formatPhoneNumber } from "@/lib/formatters";

interface CorbeilleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export const CorbeilleModal: React.FC<CorbeilleModalProps> = ({
  isOpen,
  onClose,
  onRestored,
}) => {
  const { profil } = useAuth();
  const isDirigeant = profil?.role === "dirigeant";
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"chantiers" | "clients" | "contacts">("chantiers");
  const [loading, setLoading] = useState(false);

  const [deletedChantiers, setDeletedChantiers] = useState<any[]>([]);
  const [deletedClients, setDeletedClients] = useState<ClientRow[]>([]);
  const [deletedContacts, setDeletedContacts] = useState<ContactClientRow[]>([]);

  // Confirmation de suppression définitive
  const [itemToHardDelete, setItemToHardDelete] = useState<{
    id: string;
    type: "chantier" | "client" | "contact";
    name: string;
  } | null>(null);

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadDeletedItems = async () => {
    setLoading(true);
    try {
      const [chantiers, clients, contacts] = await Promise.all([
        getDeletedChantiers(supabase),
        getDeletedClients(supabase),
        getDeletedContacts(supabase),
      ]);
      setDeletedChantiers(chantiers);
      setDeletedClients(clients);
      setDeletedContacts(contacts);
    } catch (err) {
      console.error("Erreur chargement corbeille:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDeletedItems();
      setFeedbackMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Restaurations
  const handleRestoreChantier = async (id: string) => {
    try {
      await restoreChantier(supabase, id);
      setFeedbackMsg("Chantier restauré avec succès !");
      loadDeletedItems();
      onRestored();
    } catch (err: any) {
      alert("Erreur restauration : " + err.message);
    }
  };

  const handleRestoreClient = async (id: string) => {
    try {
      await restoreClient(supabase, id);
      setFeedbackMsg("Client restauré avec succès !");
      loadDeletedItems();
      onRestored();
    } catch (err: any) {
      alert("Erreur restauration : " + err.message);
    }
  };

  const handleRestoreContact = async (id: string) => {
    try {
      await restoreContact(supabase, id);
      setFeedbackMsg("Contact restauré avec succès !");
      loadDeletedItems();
      onRestored();
    } catch (err: any) {
      alert("Erreur restauration : " + err.message);
    }
  };

  // Suppression définitive renforcée
  const handleConfirmHardDelete = async () => {
    if (!itemToHardDelete) return;

    try {
      if (itemToHardDelete.type === "chantier") {
        await hardDeleteChantier(supabase, itemToHardDelete.id);
      } else if (itemToHardDelete.type === "client") {
        await hardDeleteClient(supabase, itemToHardDelete.id);
      } else if (itemToHardDelete.type === "contact") {
        await hardDeleteContact(supabase, itemToHardDelete.id);
      }

      setFeedbackMsg(`"${itemToHardDelete.name}" a été définitivement supprimé.`);
      setItemToHardDelete(null);
      loadDeletedItems();
      onRestored();
    } catch (err: any) {
      alert("Erreur lors de la suppression définitive : " + err.message);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

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
              <div className="p-2.5 rounded-2xl bg-red-50 text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-bna-anthracite">
                  Corbeille BNA
                </h3>
                <p className="text-[11px] text-bna-muted">Restauration et suppression sécurisée</p>
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

          {/* Onglets Corbeille */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-bna-offwhite rounded-xl mt-3 shrink-0 text-xs font-bold">
            <button
              onClick={() => setActiveTab("chantiers")}
              className={`py-1.5 rounded-lg transition-all ${
                activeTab === "chantiers"
                  ? "bg-white text-bna-copper shadow-xs"
                  : "text-bna-muted hover:text-bna-anthracite"
              }`}
            >
              Chantiers ({deletedChantiers.length})
            </button>
            <button
              onClick={() => setActiveTab("clients")}
              className={`py-1.5 rounded-lg transition-all ${
                activeTab === "clients"
                  ? "bg-white text-bna-copper shadow-xs"
                  : "text-bna-muted hover:text-bna-anthracite"
              }`}
            >
              Clients ({deletedClients.length})
            </button>
            <button
              onClick={() => setActiveTab("contacts")}
              className={`py-1.5 rounded-lg transition-all ${
                activeTab === "contacts"
                  ? "bg-white text-bna-copper shadow-xs"
                  : "text-bna-muted hover:text-bna-anthracite"
              }`}
            >
              Contacts ({deletedContacts.length})
            </button>
          </div>

          {/* Feedback */}
          {feedbackMsg && (
            <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Contenu défilable */}
          <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1">
            {loading ? (
              <p className="text-xs text-bna-muted text-center py-6">Chargement de la corbeille...</p>
            ) : null}

            {/* ONGLET CHANTIERS */}
            {activeTab === "chantiers" && !loading && (
              deletedChantiers.length === 0 ? (
                <div className="text-center py-8 text-xs text-bna-muted">
                  Aucun chantier dans la corbeille.
                </div>
              ) : (
                deletedChantiers.map((ch) => (
                  <div
                    key={ch.id}
                    className="p-3 bg-white border border-bna-border rounded-2xl shadow-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-xl bg-orange-50 text-bna-copper shrink-0 mt-0.5">
                          <HardHat className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-xs text-bna-anthracite">
                              {normalizeTitleCase(ch.nom)}
                            </h4>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-neutral-100 text-bna-copper">
                              {ch.metier}
                            </span>
                          </div>
                          <p className="text-[11px] text-bna-muted">
                            Lieu : {normalizeTitleCase(ch.ville)}{" "}
                            {ch.adresse ? `· ${normalizeTitleCase(ch.adresse)}` : ""}
                          </p>
                          <p className="text-[10px] text-red-600 mt-0.5">
                            Supprimé le {formatDate(ch.deleted_at)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-bna-border/50">
                      <button
                        type="button"
                        onClick={() => handleRestoreChantier(ch.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-bna-offwhite hover:bg-neutral-100 text-bna-anthracite text-xs font-semibold border border-bna-border"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-bna-copper" />
                        <span>Restaurer</span>
                      </button>

                        {isDirigeant && (
                          <button
                            type="button"
                            onClick={() =>
                              setItemToHardDelete({
                                id: ch.id,
                                type: "chantier",
                                name: ch.nom,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-xl text-red-600 hover:bg-red-50 text-xs font-semibold"
                            title="Suppression définitive"
                          >
                            Supprimer définitivement
                          </button>
                        )}
                    </div>
                  </div>
                ))
              )
            )}

            {/* ONGLET CLIENTS */}
            {activeTab === "clients" && !loading && (
              deletedClients.length === 0 ? (
                <div className="text-center py-8 text-xs text-bna-muted">
                  Aucun client dans la corbeille.
                </div>
              ) : (
                deletedClients.map((cl) => {
                  const clName =
                    cl.type_client === "professionnel"
                      ? cl.societe || normalizeTitleCase(cl.nom)
                      : [normalizeTitleCase(cl.prenom), normalizeTitleCase(cl.nom)].filter(Boolean).join(" ");

                  return (
                    <div
                      key={cl.id}
                      className="p-3 bg-white border border-bna-border rounded-2xl shadow-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 rounded-xl bg-blue-50 text-blue-700 shrink-0 mt-0.5">
                            {cl.type_client === "professionnel" ? (
                              <Building2 className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-xs text-bna-anthracite">{clName}</h4>
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-neutral-100 text-bna-muted">
                                {cl.type_client === "professionnel" ? "Pro" : "Particulier"}
                              </span>
                            </div>
                            <p className="text-[11px] text-bna-muted">
                              Facturation : {normalizeTitleCase(cl.ville)} · {formatPhoneNumber(cl.telephone)}
                            </p>
                            <p className="text-[10px] text-red-600 mt-0.5">
                              Supprimé le {formatDate(cl.deleted_at)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-bna-border/50">
                        <button
                          type="button"
                          onClick={() => handleRestoreClient(cl.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-bna-offwhite hover:bg-neutral-100 text-bna-anthracite text-xs font-semibold border border-bna-border"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-bna-copper" />
                          <span>Restaurer</span>
                        </button>

                        {isDirigeant && (
                          <button
                            type="button"
                            onClick={() =>
                              setItemToHardDelete({
                                id: cl.id,
                                type: "client",
                                name: clName,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-xl text-red-600 hover:bg-red-50 text-xs font-semibold"
                            title="Suppression définitive"
                          >
                            Supprimer définitivement
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            )}

            {/* ONGLET CONTACTS */}
            {activeTab === "contacts" && !loading && (
              deletedContacts.length === 0 ? (
                <div className="text-center py-8 text-xs text-bna-muted">
                  Aucun contact dans la corbeille.
                </div>
              ) : (
                deletedContacts.map((ct) => (
                  <div
                    key={ct.id}
                    className="p-3 bg-white border border-bna-border rounded-2xl shadow-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-xl bg-neutral-100 text-bna-muted shrink-0 mt-0.5">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-bna-anthracite">
                            {[normalizeTitleCase(ct.prenom), normalizeTitleCase(ct.nom)].filter(Boolean).join(" ")}
                            {ct.fonction && (
                              <span className="font-normal text-bna-muted"> ({ct.fonction})</span>
                            )}
                          </h4>
                          <p className="text-[11px] text-bna-muted">
                            {formatPhoneNumber(ct.telephone) || ct.email || "Sans coordonnées"}
                          </p>
                          <p className="text-[10px] text-red-600 mt-0.5">
                            Supprimé le {formatDate(ct.deleted_at)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-bna-border/50">
                      <button
                        type="button"
                        onClick={() => handleRestoreContact(ct.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-bna-offwhite hover:bg-neutral-100 text-bna-anthracite text-xs font-semibold border border-bna-border"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-bna-copper" />
                        <span>Restaurer</span>
                      </button>

                      {isDirigeant && (
                        <button
                          type="button"
                          onClick={() =>
                            setItemToHardDelete({
                              id: ct.id,
                              type: "contact",
                              name: `${ct.prenom ? ct.prenom + " " : ""}${ct.nom}`,
                            })
                          }
                          className="px-2.5 py-1.5 rounded-xl text-red-600 hover:bg-red-50 text-xs font-semibold"
                          title="Suppression définitive"
                        >
                          Supprimer définitivement
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>

      {/* Confirmation renforcée de suppression définitive */}
      <ConfirmModal
        isOpen={!!itemToHardDelete}
        title="Supprimer définitivement ?"
        message={`Cette action est irréversible. L'élément "${itemToHardDelete?.name}" sera totalement purgé de la base de données.`}
        confirmLabel="Supprimer définitivement"
        cancelLabel="Annuler"
        isDestructive={true}
        onConfirm={handleConfirmHardDelete}
        onCancel={() => setItemToHardDelete(null)}
      />
    </>
  );
};
