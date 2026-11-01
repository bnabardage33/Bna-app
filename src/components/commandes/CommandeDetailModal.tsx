"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Truck,
  CheckCircle2,
  Clock,
  Send,
  Ban,
  AlertCircle,
  FileText,
  Phone,
  Mail,
  Edit2,
  Save,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getCommandeDetail,
  updateLignesCommande,
  changerStatutCommande,
  CommandeAvecFournisseur,
  StatutCommandeFournisseur,
  LigneCommandeFournisseurRow,
} from "@/lib/services/commandesFournisseursService";
import { formatDateFr } from "@/lib/formatters";

interface CommandeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  commandeId: string | null;
  chantierNom?: string;
  onStatusChanged?: () => void;
}

const STATUT_CONFIG: Record<
  StatutCommandeFournisseur,
  { label: string; badgeClass: string; icon: any }
> = {
  brouillon: {
    label: "BROUILLON",
    badgeClass: "text-amber-700 bg-amber-50 border-amber-200",
    icon: Clock,
  },
  envoyee: {
    label: "ENVOYÉE",
    badgeClass: "text-blue-700 bg-blue-50 border-blue-200",
    icon: Send,
  },
  commandee: {
    label: "COMMANDÉE",
    badgeClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
    icon: CheckCircle2,
  },
  annulee: {
    label: "ANNULÉE",
    badgeClass: "text-neutral-500 bg-neutral-100 border-neutral-300",
    icon: Ban,
  },
};

export const CommandeDetailModal: React.FC<CommandeDetailModalProps> = ({
  isOpen,
  onClose,
  commandeId,
  chantierNom,
  onStatusChanged,
}) => {
  const [commande, setCommande] = useState<CommandeAvecFournisseur | null>(null);
  const [lignes, setLignes] = useState<LigneCommandeFournisseurRow[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [quantitesModifiees, setQuantitesModifiees] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const loadDetail = async () => {
    if (!commandeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCommandeDetail(supabase, commandeId);
      setCommande(data);
      if (data && data.lignes) {
        setLignes(data.lignes);
        const mapQte: Record<string, number> = {};
        data.lignes.forEach((l) => {
          mapQte[l.id] = l.quantite;
        });
        setQuantitesModifiees(mapQte);
      }
    } catch (e: any) {
      setError(e?.message || "Erreur lors du chargement de la commande.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && commandeId) {
      setIsEditing(false);
      loadDetail();
    }
  }, [isOpen, commandeId]);

  if (!isOpen || !commandeId) return null;

  const handleStatutChange = async (newStatut: StatutCommandeFournisseur) => {
    if (!commande) return;
    setSaving(true);
    setError(null);
    try {
      await changerStatutCommande(supabase, commande.id, newStatut);
      await loadDetail();
      if (onStatusChanged) onStatusChanged();
    } catch (e: any) {
      setError(e?.message || "Erreur lors du changement de statut");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuantites = async () => {
    if (!commande) return;
    setSaving(true);
    setError(null);
    try {
      const payload = Object.entries(quantitesModifiees).map(([id, quantite]) => ({
        id,
        quantite,
      }));
      await updateLignesCommande(supabase, commande.id, payload);
      setIsEditing(false);
      await loadDetail();
      if (onStatusChanged) onStatusChanged();
    } catch (e: any) {
      setError(e?.message || "Erreur lors de la modification des quantités");
    } finally {
      setSaving(false);
    }
  };

  const currentStatut = (commande?.statut || "brouillon") as StatutCommandeFournisseur;
  const statutConfig = STATUT_CONFIG[currentStatut] || STATUT_CONFIG.brouillon;
  const StatutIcon = statutConfig.icon;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-2 sm:pt-6 pb-20 sm:pb-8 px-3 sm:px-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-mobile bg-white rounded-2xl max-h-full flex flex-col overflow-hidden shadow-2xl border border-bna-border animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-5 pb-3 border-b border-bna-border/60 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-50 text-bna-copper">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-base text-bna-anthracite font-mono">
                  {commande?.numero_commande || "Chargement..."}
                </span>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase flex items-center gap-1 ${statutConfig.badgeClass}`}
                >
                  <StatutIcon className="w-3 h-3" />
                  <span>{statutConfig.label}</span>
                </span>
              </div>
              <p className="text-[11px] text-bna-muted">
                {chantierNom ? `Chantier · ${chantierNom}` : "Commande d'approvisionnement"}
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

        {/* Corps */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 pt-3 pb-6 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-bna-muted animate-pulse">
              Chargement de la commande...
            </div>
          ) : error ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : commande ? (
            <>
              {/* Carte Récapitulative Fournisseur & Version source */}
              <div className="p-3.5 bg-bna-offwhite rounded-2xl border border-bna-border space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-bna-muted uppercase tracking-wider block">
                      FOURNISSEUR
                    </span>
                    <span className="text-sm font-extrabold text-bna-anthracite block">
                      {commande.fournisseur?.nom}
                    </span>
                  </div>
                  {commande.version_source_numero && (
                    <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 border border-neutral-300 px-2 py-0.5 rounded-full">
                      Issue de V{commande.version_source_numero}
                    </span>
                  )}
                </div>

                {(commande.fournisseur?.telephone || commande.fournisseur?.email) && (
                  <div className="flex flex-wrap gap-3 pt-1 text-xs text-bna-muted">
                    {commande.fournisseur?.telephone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-bna-copper" />
                        <span>{commande.fournisseur.telephone}</span>
                      </div>
                    )}
                    {commande.fournisseur?.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-bna-copper" />
                        <span>{commande.fournisseur.email}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-bna-border/50 space-y-1.5 text-[11px] text-bna-muted">
                  <div className="flex items-center justify-between">
                    <span>Date commande : {formatDateFr(commande.date_commande)}</span>
                    <span>{lignes.length} article(s)</span>
                  </div>
                  {commande.date_livraison_souhaitee && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-bna-anthracite bg-white border border-bna-border rounded-lg px-2.5 py-1">
                      <Truck className="w-3.5 h-3.5 text-bna-copper shrink-0" />
                      <span>Livraison souhaitée : <span className="text-bna-copper">{commande.date_livraison_souhaitee}</span></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Commentaire si présent */}
              {commande.commentaire && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-bna-border text-xs space-y-1">
                  <span className="text-[10px] font-bold text-bna-muted uppercase block">
                    Commentaire / Consignes :
                  </span>
                  <p className="text-bna-anthracite italic">{commande.commentaire}</p>
                </div>
              )}

              {/* Lignes d'articles figées */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
                    ARTICLES COMMANDÉS ({lignes.length})
                  </span>
                  {commande.statut === "brouillon" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) {
                          handleSaveQuantites();
                        } else {
                          setIsEditing(true);
                        }
                      }}
                      disabled={saving}
                      className="text-xs font-bold text-bna-copper hover:underline flex items-center gap-1"
                    >
                      {isEditing ? (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Enregistrer quantités</span>
                        </>
                      ) : (
                        <>
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Modifier quantités</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {lignes.map((l) => (
                    <div
                      key={l.id}
                      className="p-2.5 bg-white rounded-xl border border-bna-border flex items-center justify-between gap-2 shadow-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-xs text-bna-anthracite block truncate">
                          {l.designation}
                        </span>
                        <span className="text-[10px] text-bna-muted uppercase font-mono">
                          {l.categorie}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        {isEditing && commande.statut === "brouillon" ? (
                          <div className="flex items-center gap-1 bg-bna-offwhite border border-bna-border rounded-lg px-2 py-0.5">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={quantitesModifiees[l.id] ?? l.quantite}
                              onChange={(e) =>
                                setQuantitesModifiees((prev) => ({
                                  ...prev,
                                  [l.id]: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="w-16 text-right font-extrabold text-xs text-bna-anthracite focus:outline-none"
                            />
                            <span className="text-[10px] text-bna-muted font-bold">
                              {l.unite}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-extrabold text-bna-anthracite block">
                            {l.quantite} {l.unite}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Actions de changement de statut */}
              <section className="pt-2 border-t border-bna-border space-y-2">
                <span className="text-[10px] font-bold text-bna-muted uppercase tracking-wider block">
                  ACTION SUR LE STATUT DE LA COMMANDE
                </span>

                <div className="flex flex-wrap gap-2">
                  {commande.statut === "brouillon" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatutChange("envoyee")}
                        disabled={saving}
                        className="flex-1 py-2 px-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Marquer envoyée</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatutChange("commandee")}
                        disabled={saving}
                        className="flex-1 py-2 px-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirmer commandée</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatutChange("annulee")}
                        disabled={saving}
                        className="py-2 px-3 bg-neutral-50 text-neutral-600 border border-neutral-200 rounded-xl text-xs font-bold hover:bg-neutral-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Annuler</span>
                      </button>
                    </>
                  )}

                  {commande.statut === "envoyee" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatutChange("commandee")}
                        disabled={saving}
                        className="flex-1 py-2 px-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirmer commandée</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatutChange("annulee")}
                        disabled={saving}
                        className="py-2 px-3 bg-neutral-50 text-neutral-600 border border-neutral-200 rounded-xl text-xs font-bold hover:bg-neutral-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Annuler</span>
                      </button>
                    </>
                  )}

                  {commande.statut === "commandee" && (
                    <div className="w-full p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Commande validée auprès du fournisseur. Quantités figées et contractuelles.
                      </span>
                    </div>
                  )}

                  {commande.statut === "annulee" && (
                    <div className="w-full p-2.5 bg-neutral-100 border border-neutral-300 rounded-xl text-xs text-neutral-600 flex items-center gap-2">
                      <Ban className="w-4 h-4 text-neutral-500 shrink-0" />
                      <span>Cette commande a été annulée.</span>
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-bna-border/60 bg-white flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-neutral-100 text-bna-anthracite rounded-xl text-xs font-bold hover:bg-neutral-200 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
