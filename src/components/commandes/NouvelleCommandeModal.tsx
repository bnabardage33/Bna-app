"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Truck,
  Layers,
  Package,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getFournisseurs,
  creerFournisseur,
  creerCommandeFournisseur,
  FournisseurRow,
  LigneCommandeInput,
} from "@/lib/services/commandesFournisseursService";
import type { BesoinMateriauRow } from "@/types/database.types";

interface NouvelleCommandeModalProps {
  isOpen: boolean;
  onClose: () => void;
  chantierId: string;
  chantierNom?: string;
  versionSourceId?: string | null;
  versionSourceNumero?: number | null;
  besoinsActifs: BesoinMateriauRow[];
  onCommandeCreee: (commandeId: string) => void;
}

export const NouvelleCommandeModal: React.FC<NouvelleCommandeModalProps> = ({
  isOpen,
  onClose,
  chantierId,
  chantierNom,
  versionSourceId,
  versionSourceNumero,
  besoinsActifs,
  onCommandeCreee,
}) => {
  const [fournisseurs, setFournisseurs] = useState<FournisseurRow[]>([]);
  const [selectedFournisseurId, setSelectedFournisseurId] = useState<string>("");
  const [showNouveauFournisseur, setShowNouveauFournisseur] = useState(false);
  const [nouveauFournisseurNom, setNouveauFournisseurNom] = useState("");
  const [nouveauFournisseurTel, setNouveauFournisseurTel] = useState("");

  const [lignes, setLignes] = useState<LigneCommandeInput[]>([]);
  const [commentaire, setCommentaire] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      loadFournisseurs();
      // Initialiser les lignes depuis les besoins actifs
      setLignes(
        besoinsActifs.map((b) => ({
          besoin_source_id: b.id,
          designation: b.designation,
          categorie: b.categorie,
          unite: b.unite,
          quantite: b.quantite,
        }))
      );
      setCommentaire("");
      setError(null);
      setShowNouveauFournisseur(false);
      setNouveauFournisseurNom("");
      setNouveauFournisseurTel("");
    }
  }, [isOpen, besoinsActifs]);

  const loadFournisseurs = async () => {
    try {
      const list = await getFournisseurs(supabase);
      setFournisseurs(list);
      if (list.length > 0 && !selectedFournisseurId) {
        setSelectedFournisseurId(list[0].id);
      }
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement des fournisseurs");
    }
  };

  const handleCreateFournisseurRapide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nouveauFournisseurNom.trim()) return;
    try {
      setError(null);
      const created = await creerFournisseur(supabase, {
        nom: nouveauFournisseurNom,
        telephone: nouveauFournisseurTel,
      });
      setFournisseurs((prev) => [...prev, created].sort((a, b) => a.nom.localeCompare(b.nom)));
      setSelectedFournisseurId(created.id);
      setShowNouveauFournisseur(false);
      setNouveauFournisseurNom("");
      setNouveauFournisseurTel("");
    } catch (e: any) {
      setError(e?.message || "Erreur lors de la création du fournisseur");
    }
  };

  const handleQuantiteChange = (index: number, valStr: string) => {
    const val = parseFloat(valStr);
    setLignes((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        quantite: isNaN(val) ? 0 : val,
      };
      return next;
    });
  };

  const handleSupprimerLigne = (index: number) => {
    setLignes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedFournisseurId) {
      setError("Veuillez sélectionner un fournisseur.");
      return;
    }
    if (lignes.length === 0) {
      setError("La commande doit comporter au moins une ligne.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await creerCommandeFournisseur(supabase, {
        chantier_id: chantierId,
        fournisseur_id: selectedFournisseurId,
        version_source_id: versionSourceId,
        lignes,
        commentaire: commentaire.trim() || null,
      });
      onCommandeCreee(res.commande.id);
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'enregistrement de la commande");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-2 sm:pt-6 pb-20 sm:pb-8 px-3 sm:px-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-mobile bg-white rounded-2xl max-h-full flex flex-col overflow-hidden shadow-2xl border border-bna-border animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-5 pb-3 border-b border-bna-border/60 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-base text-bna-anthracite">
                  Nouvelle commande
                </span>
                {versionSourceNumero && (
                  <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-300">
                    Besoins V{versionSourceNumero}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-bna-muted">
                {chantierNom ? `Chantier · ${chantierNom}` : "Snapshot figé des besoins"}
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

        {/* Corps défilant */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 pt-3 pb-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Sélection ou création du Fournisseur */}
          <section className="space-y-2">
            <label className="text-[11px] font-bold tracking-wider text-bna-muted uppercase block">
              FOURNISSEUR
            </label>

            {!showNouveauFournisseur ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={selectedFournisseurId}
                    onChange={(e) => setSelectedFournisseurId(e.target.value)}
                    className="flex-1 text-xs border border-bna-border rounded-xl p-2.5 bg-bna-offwhite text-bna-anthracite font-medium focus:outline-none focus:border-bna-copper"
                  >
                    {fournisseurs.length === 0 && (
                      <option value="">Aucun fournisseur — créez-en un</option>
                    )}
                    {fournisseurs.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nom} {f.telephone ? `(${f.telephone})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNouveauFournisseur(true)}
                    className="p-2.5 bg-neutral-100 hover:bg-neutral-200 text-bna-anthracite rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
                    title="Ajouter un fournisseur"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouveau</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-neutral-50 rounded-xl border border-bna-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-bna-anthracite">
                    Ajouter un fournisseur
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNouveauFournisseur(false)}
                    className="text-[11px] text-bna-muted hover:text-bna-anthracite"
                  >
                    Annuler
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Nom (ex: Point P, Dispano...)"
                    value={nouveauFournisseurNom}
                    onChange={(e) => setNouveauFournisseurNom(e.target.value)}
                    className="text-xs border border-bna-border rounded-lg p-2 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Téléphone (optionnel)"
                    value={nouveauFournisseurTel}
                    onChange={(e) => setNouveauFournisseurTel(e.target.value)}
                    className="text-xs border border-bna-border rounded-lg p-2 bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateFournisseurRapide}
                  className="w-full py-2 bg-bna-anthracite text-white rounded-lg text-xs font-bold hover:bg-black transition-colors"
                >
                  Enregistrer et sélectionner ce fournisseur
                </button>
              </div>
            )}
          </section>

          {/* 2. Lignes de la commande (Snapshot modifiable) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold tracking-wider text-bna-muted uppercase block">
                ARTICLES DE LA COMMANDE ({lignes.length})
              </label>
              <span className="text-[10px] text-bna-muted">
                Quantités ajustables avant envoi
              </span>
            </div>

            {lignes.length === 0 ? (
              <p className="text-xs text-bna-muted italic py-3 text-center border border-dashed border-bna-border rounded-xl">
                Toutes les lignes ont été retirées.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {lignes.map((l, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-bna-offwhite rounded-xl border border-bna-border flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-xs text-bna-anthracite block truncate">
                        {l.designation}
                      </span>
                      <span className="text-[10px] text-bna-muted uppercase font-mono">
                        {l.categorie}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-white border border-bna-border rounded-lg px-2 py-1">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={l.quantite}
                          onChange={(e) => handleQuantiteChange(idx, e.target.value)}
                          className="w-16 text-right font-extrabold text-xs text-bna-anthracite focus:outline-none"
                        />
                        <span className="text-[10px] text-bna-muted font-bold">
                          {l.unite}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSupprimerLigne(idx)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg"
                        title="Retirer cette ligne"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. Commentaire libre */}
          <section className="space-y-1.5">
            <label className="text-[11px] font-bold tracking-wider text-bna-muted uppercase block">
              COMMENTAIRE / INSTRUCTIONS LIVRAISON (OPTIONNEL)
            </label>
            <textarea
              rows={2}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Ex: Livrer sur chantier le matin, accès camion difficile..."
              className="w-full text-xs border border-bna-border rounded-xl p-2.5 bg-bna-offwhite text-bna-anthracite focus:outline-none focus:border-bna-copper"
            />
          </section>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 p-4 border-t border-bna-border/60 bg-white flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-bna-muted hover:text-bna-anthracite"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || lignes.length === 0}
            className="px-5 py-2.5 bg-bna-copper text-white rounded-xl text-xs font-bold hover:bg-bna-copper/90 shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? "Création..." : "Enregistrer la commande (brouillon)"}
          </button>
        </div>
      </div>
    </div>
  );
};
