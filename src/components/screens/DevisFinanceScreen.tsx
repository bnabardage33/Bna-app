"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Receipt,
  TrendingUp,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  Trash2,
  ArrowRight,
  Calculator,
  Euro,
  ShieldCheck,
  Sparkles,
  X,
  HardHat,
  Send,
} from "lucide-react";
import type { Chantier, MetierType } from "@/types/metier";
import type { BesoinMateriauRow } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { getBesoinsByChantier } from "@/lib/services/calepinageService";
import {
  getDevisList,
  getFacturesList,
  creerNouveauDevis,
  updateStatutDevis,
  supprimerDevis,
  creerFactureDepuisDevis,
  updateStatutFacture,
  supprimerFacture,
  calculerDevis,
  calculerBilanFinancierGlobal,
  importerBesoinsCalepinageEnLignesDevis,
  fmtEuro,
  type DevisItem,
  type FactureItem,
  type LigneChiffrage,
  type TauxTvaBtp,
} from "@/lib/services/devisFinanceService";
import { PvReceptionSavPanel } from "@/components/chantiers/PvReceptionSavModal";

interface DevisFinanceScreenProps {
  chantiers: Chantier[];
  onOpenCalepinage?: () => void;
  onOpenAssistant?: () => void;
}

export const DevisFinanceScreen: React.FC<DevisFinanceScreenProps> = ({
  chantiers,
  onOpenCalepinage,
  onOpenAssistant,
}) => {
  const supabase = createClient();
  const [subTab, setSubTab] = useState<"devis" | "factures" | "rentabilite" | "pvsav">("devis");
  const [devisList, setDevisList] = useState<DevisItem[]>([]);
  const [facturesList, setFacturesList] = useState<FactureItem[]>([]);
  const [filterStatutDevis, setFilterStatutDevis] = useState<string>("tous");

  // Modale création de devis
  const [isNewDevisOpen, setIsNewDevisOpen] = useState(false);
  const [selectedChantierId, setSelectedChantierId] = useState<string>(
    chantiers[0]?.id || ""
  );
  const [clientNom, setClientNom] = useState("");
  const [ville, setVille] = useState("Mérignac");
  const [metier, setMetier] = useState<MetierType>("terrasse");
  const [objet, setObjet] = useState("");
  const [tvaPct, setTvaPct] = useState<TauxTvaBtp>(10);
  const [acomptePct, setAcomptePct] = useState<number>(30);
  const [retenuePct, setRetenuePct] = useState<number>(5);
  const [lignesForm, setLignesForm] = useState<LigneChiffrage[]>([
    {
      id: "init-1",
      designation: "Fourniture Lames & Structure porteuse (conforme DTU)",
      qte: 35,
      unite: "m²",
      pu_ht: 95,
      pu_revient: 60,
      type_cout: "matiere",
    },
    {
      id: "init-2",
      designation: "Main d'œuvre pose complète & finitions périphériques",
      qte: 35,
      unite: "m²",
      pu_ht: 72,
      pu_revient: 38,
      type_cout: "main_oeuvre",
    },
  ]);
  const [besoinsCalepinage, setBesoinsCalepinage] = useState<BesoinMateriauRow[]>([]);

  // Modale aperçu pièce officielle (Devis ou Facture)
  const [previewDoc, setPreviewDoc] = useState<
    | { kind: "devis"; item: DevisItem }
    | { kind: "facture"; item: FactureItem }
    | null
  >(null);

  // Notification flash
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const reloadData = () => {
    setDevisList(getDevisList());
    setFacturesList(getFacturesList());
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Charger les besoins de calepinage quand le chantier sélectionné change dans la modale
  useEffect(() => {
    if (!selectedChantierId) {
      setBesoinsCalepinage([]);
      return;
    }
    const ch = chantiers.find((c) => c.id === selectedChantierId);
    if (ch) {
      setClientNom(ch.client_nom || `Client ${ch.nom}`);
      setVille(ch.ville);
      setMetier(ch.metier);
      if (!objet) {
        setObjet(`Travaux de ${ch.metier.toUpperCase()} — ${ch.nom} (${ch.ville})`);
      }
    }
    getBesoinsByChantier(supabase, selectedChantierId)
      .then((res) => setBesoinsCalepinage(res.actifs))
      .catch(() => setBesoinsCalepinage([]));
  }, [selectedChantierId, chantiers]);

  const bilan = calculerBilanFinancierGlobal(devisList, facturesList);

  const handleImportCalepinage = () => {
    const ch = chantiers.find((c) => c.id === selectedChantierId);
    const targetMetier = ch?.metier || metier;
    const importedLignes = importerBesoinsCalepinageEnLignesDevis(
      besoinsCalepinage,
      targetMetier
    );
    setLignesForm(importedLignes);
    setMetier(targetMetier);
    setObjet(
      `Devis certifié Calepinage ${targetMetier.toUpperCase()} — ${ch?.nom || "Chantier BNA"}`
    );
    showToast(`Quantitatifs Calepinage (${besoinsCalepinage.length} postes) importés dans le devis !`);
  };

  const handleAddLigneForm = () => {
    setLignesForm((prev) => [
      ...prev,
      {
        id: `lig-${Date.now()}`,
        designation: "Nouveau poste de travaux",
        qte: 1,
        unite: "forfait",
        pu_ht: 250,
        pu_revient: 150,
        type_cout: "matiere",
      },
    ]);
  };

  const handleRemoveLigneForm = (id: string) => {
    if (lignesForm.length <= 1) return;
    setLignesForm((prev) => prev.filter((l) => l.id !== id));
  };

  const handleCreateDevisSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetChantier = chantiers.find((c) => c.id === selectedChantierId);
    const created = creerNouveauDevis({
      chantier_id: targetChantier?.id,
      chantier_nom: targetChantier?.nom || clientNom || "Nouveau Projet BNA",
      client_nom: clientNom || "Client BNA",
      ville: ville || "Gironde",
      metier,
      objet: objet || `Devis ${metier.toUpperCase()} BNA`,
      statut: "envoye",
      tva_pct: tvaPct,
      acompte_pct: acomptePct,
      retenue_garantie_pct: retenuePct,
      lignes: lignesForm,
    });
    setDevisList(getDevisList());
    setIsNewDevisOpen(false);
    showToast(`Devis ${created.numero} créé et prêt à être envoyé !`);
  };

  const handleGenerateFacture = (
    devis: DevisItem,
    type: "acompte" | "situation" | "solde"
  ) => {
    const linkedChantier = chantiers.find((c) => c.id === devis.chantier_id);
    const avancement = linkedChantier?.avancementGlobal || 50;
    const fac = creerFactureDepuisDevis(devis, type, avancement);
    setFacturesList(getFacturesList());
    setSubTab("factures");
    showToast(`Facture ${fac.numero} (${type.toUpperCase()}) générée avec succès !`);
  };

  const filteredDevis =
    filterStatutDevis === "tous"
      ? devisList
      : devisList.filter((d) => d.statut === filterStatutDevis);

  const previewCalcForm = calculerDevis(lignesForm, tvaPct, acomptePct);

  return (
    <div className="py-4 md:py-6 space-y-5 animate-in fade-in duration-150">
      {/* TOAST DE CONFIRMATION */}
      {toastMessage && (
        <div className="fixed bottom-24 md:bottom-6 right-4 z-50 bg-neutral-900 text-white px-4 py-3 rounded-2xl shadow-lg border border-neutral-700 flex items-center gap-2 text-xs font-bold animate-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* EN-TÊTE DEVIS, FACTURES & FINANCES */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-bna-copper text-white flex items-center justify-center shadow-copper">
            <Euro className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl sm:text-2xl text-bna-anthracite leading-tight">
              Devis, Factures &amp; Rentabilité
            </h1>
            <p className="text-xs text-bna-muted">
              Chiffrage BTP Multi-TVA · Situations d&apos;avancement · Retenue de Garantie 5% (Loi 71-584)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAssistant && (
            <button
              type="button"
              onClick={onOpenAssistant}
              className="px-3 py-2 bg-orange-50 hover:bg-orange-100 text-bna-copper border border-orange-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Analyser avec l&apos;IA</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsNewDevisOpen(true)}
            className="px-3.5 py-2 bg-bna-copper hover:bg-bna-copper-hover text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nouveau Devis</span>
          </button>
        </div>
      </div>

      {/* BANDEAU 4 KPIS FINANCIERS CONSOLIDÉS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-bna-border rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-bna-muted">
            <span>CA Signé HT</span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
              Actif
            </span>
          </div>
          <p className="font-display font-black text-lg sm:text-xl text-bna-anthracite mt-1">
            {fmtEuro(bilan.ca_signe_ht)}
          </p>
          <p className="text-[11px] text-bna-muted mt-0.5">
            Pipeline en attente : <b className="text-bna-anthracite">{fmtEuro(bilan.pipeline_en_attente_ht)}</b>
          </p>
        </div>

        <div className="bg-white border border-bna-border rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-bna-muted">
            <span>Encaissé TTC</span>
            <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
              Trésorerie
            </span>
          </div>
          <p className="font-display font-black text-lg sm:text-xl text-emerald-700 mt-1">
            {fmtEuro(bilan.encaisse_ttc)}
          </p>
          <p className="text-[11px] text-bna-muted mt-0.5">
            Reste à facturer HT : <b className="text-bna-anthracite">{fmtEuro(bilan.reste_a_facturer_ht)}</b>
          </p>
        </div>

        <div className="bg-white border border-bna-border rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-bna-muted">
            <span>Marge Brute Signée</span>
            <span className="text-bna-copper bg-orange-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {bilan.taux_marge_moyen_pct}%
            </span>
          </div>
          <p className="font-display font-black text-lg sm:text-xl text-bna-copper mt-1">
            {fmtEuro(bilan.marge_globale_signee_ht)}
          </p>
          <p className="text-[11px] text-bna-muted mt-0.5">
            Objectif BNA : <b className="text-emerald-700">&ge; 30% HT</b>
          </p>
        </div>

        <div className="bg-white border border-bna-border rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-bna-muted">
            <span>À Encaisser / Relances</span>
            {bilan.nb_factures_retard > 0 ? (
              <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {bilan.nb_factures_retard} en retard
              </span>
            ) : (
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                À jour
              </span>
            )}
          </div>
          <p className="font-display font-black text-lg sm:text-xl text-bna-anthracite mt-1">
            {fmtEuro(bilan.en_attente_encaissement_ttc)}
          </p>
          <p className="text-[11px] text-bna-muted mt-0.5">
            Retenues 5% bloquées : <b className="text-bna-anthracite">{fmtEuro(bilan.retenues_garantie_cumulees_ttc)}</b>
          </p>
        </div>
      </div>

      {/* SÉLECTEUR DES 4 SOUS-ONGLETS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-neutral-100 rounded-2xl text-xs font-bold">
        <button
          type="button"
          onClick={() => setSubTab("devis")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all cursor-pointer ${
            subTab === "devis"
              ? "bg-white text-bna-copper shadow-xs"
              : "text-bna-muted hover:text-bna-anthracite"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Devis ({devisList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("factures")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all cursor-pointer ${
            subTab === "factures"
              ? "bg-white text-bna-copper shadow-xs"
              : "text-bna-muted hover:text-bna-anthracite"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Factures &amp; Situations ({facturesList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("rentabilite")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all cursor-pointer ${
            subTab === "rentabilite"
              ? "bg-white text-bna-copper shadow-xs"
              : "text-bna-muted hover:text-bna-anthracite"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Marges Chantiers</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("pvsav")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all cursor-pointer ${
            subTab === "pvsav"
              ? "bg-white text-bna-copper shadow-xs"
              : "text-bna-muted hover:text-bna-anthracite"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>PV Réception &amp; SAV</span>
        </button>
      </div>

      {/* =========================================================
          ONGLET 1 : DEVIS & CHIFFRAGE COMMERCIAL
         ========================================================= */}
      {subTab === "devis" && (
        <div className="space-y-4">
          {/* Filtres rapides */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: "tous", label: "Tous les devis" },
                { id: "signe", label: "Signés" },
                { id: "envoye", label: "En attente client" },
                { id: "brouillon", label: "Brouillons" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterStatutDevis(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    filterStatutDevis === f.id
                      ? "bg-neutral-900 text-white"
                      : "bg-white border border-bna-border text-bna-muted hover:text-bna-anthracite"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {onOpenCalepinage && (
              <button
                type="button"
                onClick={onOpenCalepinage}
                className="text-xs font-bold text-bna-copper hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Ouvrir le moteur de Calepinage 2D/3D</span>
              </button>
            )}
          </div>

          {/* Liste des cartes Devis */}
          <div className="space-y-3">
            {filteredDevis.map((dev) => {
              const calc = calculerDevis(dev.lignes, dev.tva_pct, dev.acompte_pct);
              const statutBadge =
                dev.statut === "signe"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : dev.statut === "envoye"
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : dev.statut === "refuse"
                  ? "bg-rose-100 text-rose-800 border-rose-200"
                  : "bg-slate-100 text-slate-700 border-slate-200";

              return (
                <div
                  key={dev.id}
                  className="bg-white border border-bna-border rounded-2xl p-4 shadow-2xs space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-bna-offwhite border border-bna-border text-bna-anthracite">
                          {dev.numero}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${statutBadge}`}
                        >
                          {dev.statut === "signe"
                            ? "✓ Signé & Validé"
                            : dev.statut === "envoye"
                            ? "⏳ Envoyé au client"
                            : dev.statut}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-bna-copper border border-orange-200">
                          Marge : {calc.marge_pct}% ({fmtEuro(calc.marge_ht)})
                        </span>
                        {dev.retenue_garantie_pct > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            RG {dev.retenue_garantie_pct}% (Loi 71-584)
                          </span>
                        )}
                      </div>
                      <h3 className="font-display font-bold text-base text-bna-anthracite mt-1.5">
                        {dev.chantier_nom} — {dev.client_nom} ({dev.ville})
                      </h3>
                      <p className="text-xs text-bna-muted">{dev.objet}</p>
                    </div>

                    <div className="text-right">
                      <p className="font-display font-black text-lg text-bna-anthracite">
                        {fmtEuro(calc.total_ht)}{" "}
                        <span className="text-[11px] font-semibold text-bna-muted">HT</span>
                      </p>
                      <p className="text-xs font-semibold text-slate-600">
                        {fmtEuro(calc.total_ttc)} TTC (TVA {dev.tva_pct}%)
                      </p>
                      <p className="text-[11px] text-bna-muted">
                        Acompte {dev.acompte_pct}% : <b>{fmtEuro(calc.acompte_ttc)} TTC</b>
                      </p>
                    </div>
                  </div>

                  {/* Détail résumé des lignes */}
                  <div className="bg-bna-offwhite rounded-xl p-3 space-y-1.5 border border-bna-border/60">
                    {dev.lignes.map((lig) => (
                      <div
                        key={lig.id}
                        className="flex items-center justify-between text-xs gap-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              lig.type_cout === "main_oeuvre"
                                ? "bg-blue-500"
                                : "bg-bna-copper"
                            }`}
                          />
                          <span className="font-medium text-bna-anthracite truncate">
                            {lig.designation}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-semibold text-slate-700 shrink-0">
                          {lig.qte} {lig.unite} × {fmtEuro(lig.pu_ht)} ={" "}
                          <b>{fmtEuro(lig.qte * lig.pu_ht)} HT</b>
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Barre d'actions du Devis */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {dev.statut !== "signe" && (
                        <button
                          type="button"
                          onClick={() => {
                            setDevisList(updateStatutDevis(dev.id, "signe"));
                            showToast(`Devis ${dev.numero} marqué comme SIGNÉ !`);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Valider Signature</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleGenerateFacture(dev, "acompte")}
                        className="px-3 py-1.5 bg-bna-offwhite hover:bg-orange-50 text-bna-anthracite hover:text-bna-copper border border-bna-border rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        + Facture Acompte ({dev.acompte_pct}%)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGenerateFacture(dev, "situation")}
                        className="px-3 py-1.5 bg-bna-offwhite hover:bg-orange-50 text-bna-anthracite hover:text-bna-copper border border-bna-border rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        + Facture Situation (%)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGenerateFacture(dev, "solde")}
                        className="px-3 py-1.5 bg-bna-offwhite hover:bg-orange-50 text-bna-anthracite hover:text-bna-copper border border-bna-border rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        + Facture de Solde
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ kind: "devis", item: dev })}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Aperçu PDF Pro</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDevisList(supprimerDevis(dev.id));
                          showToast(`Devis ${dev.numero} supprimé.`);
                        }}
                        className="p-1.5 text-bna-muted hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Supprimer ce devis"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================
          ONGLET 2 : FACTURES, SITUATIONS & RETENUES DE GARANTIE
         ========================================================= */}
      {subTab === "factures" && (
        <div className="space-y-3">
          {facturesList.map((fac) => {
            const badgeColor =
              fac.statut === "payee"
                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                : fac.statut === "en_retard"
                ? "bg-rose-100 text-rose-800 border-rose-200"
                : "bg-blue-100 text-blue-800 border-blue-200";

            return (
              <div
                key={fac.id}
                className="bg-white border border-bna-border rounded-2xl p-4 shadow-2xs space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-bna-offwhite border border-bna-border text-bna-anthracite">
                        {fac.numero}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${badgeColor}`}
                      >
                        {fac.statut === "payee"
                          ? "✓ Payée / Encaissée"
                          : fac.statut === "en_retard"
                          ? "⚠️ En retard d'échéance"
                          : "Émise — En attente"}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 uppercase">
                        {fac.type}
                        {fac.avancement_pct ? ` (${fac.avancement_pct}%)` : ""}
                      </span>
                      {fac.devis_numero && (
                        <span className="text-[11px] text-bna-muted">
                          Réf. {fac.devis_numero}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display font-bold text-base text-bna-anthracite mt-1.5">
                      {fac.objet}
                    </h3>
                    <p className="text-xs text-bna-muted">
                      Client : <b>{fac.client_nom}</b> · Émise le {fac.date_emission} · Échéance :{" "}
                      <b className={fac.statut === "en_retard" ? "text-rose-600" : ""}>
                        {fac.date_echeance}
                      </b>
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-bna-muted">
                      HT : <b>{fmtEuro(fac.montant_ht)}</b> · TVA ({fac.tva_pct}%) :{" "}
                      <b>{fmtEuro(fac.montant_tva)}</b>
                    </p>
                    {fac.montant_retenue_ttc > 0 && (
                      <p className="text-[11px] text-amber-700 font-semibold">
                        Retenue de garantie {fac.retenue_garantie_pct}% : -
                        {fmtEuro(fac.montant_retenue_ttc)} TTC
                      </p>
                    )}
                    <p className="font-display font-black text-lg text-bna-anthracite mt-0.5">
                      Net à payer : {fmtEuro(fac.net_a_payer_ttc)}{" "}
                      <span className="text-[11px] font-semibold text-bna-muted">TTC</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-bna-border/60">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {fac.statut !== "payee" && (
                      <button
                        type="button"
                        onClick={() => {
                          setFacturesList(updateStatutFacture(fac.id, "payee"));
                          showToast(`Facture ${fac.numero} pointée comme PAYÉE !`);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Pointer comme Payée</span>
                      </button>
                    )}

                    {fac.statut === "en_retard" && (
                      <button
                        type="button"
                        onClick={() =>
                          showToast(
                            `Email de relance cordiale préparé pour ${fac.client_nom} (${fmtEuro(fac.net_a_payer_ttc)} TTC).`
                          )
                        }
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Relancer {fac.client_nom}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ kind: "facture", item: fac })}
                      className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Aperçu Facture</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFacturesList(supprimerFacture(fac.id));
                        showToast(`Facture ${fac.numero} supprimée.`);
                      }}
                      className="p-1.5 text-bna-muted hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================
          ONGLET 3 : RENTABILITÉ ANALYTIQUE PAR CHANTIER
         ========================================================= */}
      {subTab === "rentabilite" && (
        <div className="space-y-3">
          {chantiers.map((ch) => {
            const linkedDevis = devisList.find(
              (d) =>
                d.chantier_id === ch.id ||
                d.chantier_nom.toLowerCase().includes(ch.nom.toLowerCase())
            );
            const calc = linkedDevis
              ? calculerDevis(linkedDevis.lignes, linkedDevis.tva_pct, linkedDevis.acompte_pct)
              : {
                  total_ht: 6500,
                  cout_matiere_ht: 2600,
                  cout_main_oeuvre_ht: 1500,
                  cout_total_ht: 4100,
                  marge_ht: 2400,
                  marge_pct: 36.9,
                };

            const facturesChantier = facturesList.filter(
              (f) => f.chantier_id === ch.id && f.statut !== "annulee"
            );
            const dejaFactureHt = facturesChantier.reduce((s, f) => s + f.montant_ht, 0);
            const encaisseTtc = facturesChantier
              .filter((f) => f.statut === "payee")
              .reduce((s, f) => s + f.net_a_payer_ttc, 0);

            return (
              <div
                key={ch.id}
                className="bg-white border border-bna-border rounded-2xl p-4 shadow-2xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-bna-offwhite border border-bna-border flex items-center justify-center text-bna-copper">
                      <HardHat className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-bna-anthracite">
                        {ch.nom} ({ch.ville})
                      </h3>
                      <p className="text-xs text-bna-muted">
                        Avancement physique : <b>{ch.avancementGlobal}%</b> ·{" "}
                        {linkedDevis ? `Devis ${linkedDevis.numero}` : "Estimation standard"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold">
                      Marge Brute : {fmtEuro(calc.marge_ht)} ({calc.marge_pct}%)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-bna-offwhite border border-bna-border/60">
                    <span className="text-[10px] text-bna-muted font-semibold uppercase">
                      Prix de Vente HT
                    </span>
                    <p className="font-display font-bold text-sm text-bna-anthracite mt-0.5">
                      {fmtEuro(calc.total_ht)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-bna-offwhite border border-bna-border/60">
                    <span className="text-[10px] text-bna-muted font-semibold uppercase">
                      Coût Matériaux HT
                    </span>
                    <p className="font-display font-bold text-sm text-slate-700 mt-0.5">
                      {fmtEuro(calc.cout_matiere_ht)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-bna-offwhite border border-bna-border/60">
                    <span className="text-[10px] text-bna-muted font-semibold uppercase">
                      Coût Main d&apos;Œuvre HT
                    </span>
                    <p className="font-display font-bold text-sm text-slate-700 mt-0.5">
                      {fmtEuro(calc.cout_main_oeuvre_ht)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-bna-offwhite border border-bna-border/60">
                    <span className="text-[10px] text-bna-muted font-semibold uppercase">
                      Déjà Facturé HT / Encaissé
                    </span>
                    <p className="font-display font-bold text-sm text-emerald-700 mt-0.5">
                      {fmtEuro(dejaFactureHt)} / {fmtEuro(encaisseTtc)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================
          ONGLET 4 : PROCÈS-VERBAUX DE RÉCEPTION, RÉSERVES & SAV DTU
         ========================================================= */}
      {subTab === "pvsav" && <PvReceptionSavPanel chantiers={chantiers} />}

      {/* =========================================================
          MODALE CRÉATION DE DEVIS + IMPORT CALEPINAGE
         ========================================================= */}
      {isNewDevisOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-bna-border rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-bna-border pb-3">
              <div>
                <h2 className="font-display font-bold text-lg text-bna-anthracite">
                  Nouveau Devis BNA (Chiffrage &amp; Marge)
                </h2>
                <p className="text-xs text-bna-muted">
                  Saisie directe ou import automatique depuis un Calepinage enregistré
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewDevisOpen(false)}
                className="p-1.5 rounded-xl text-bna-muted hover:text-bna-anthracite hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDevisSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-bna-anthracite mb-1">
                    Chantier BNA rattaché
                  </label>
                  <select
                    value={selectedChantierId}
                    onChange={(e) => setSelectedChantierId(e.target.value)}
                    className="w-full rounded-xl border border-bna-border bg-bna-offwhite px-3 py-2 font-semibold"
                  >
                    <option value="">-- Devis prospect indépendant --</option>
                    {chantiers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom} ({c.ville})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-bna-anthracite mb-1">
                    Nom du Client
                  </label>
                  <input
                    type="text"
                    required
                    value={clientNom}
                    onChange={(e) => setClientNom(e.target.value)}
                    placeholder="Ex: M. & Mme Martin"
                    className="w-full rounded-xl border border-bna-border px-3 py-2"
                  />
                </div>
              </div>

              {/* Passerelle Calepinage -> Devis si des besoins existent */}
              {besoinsCalepinage.length > 0 && (
                <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-between gap-2">
                  <p className="font-bold text-bna-copper flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 shrink-0" />
                    <span>
                      {besoinsCalepinage.length} poste(s) quantitatif(s) Calepinage disponible(s) sur ce chantier
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={handleImportCalepinage}
                    className="px-3 py-1.5 bg-bna-copper hover:bg-bna-copper-hover text-white rounded-xl font-bold text-[11px] transition-colors cursor-pointer shrink-0"
                  >
                    Importer dans le Devis
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-bna-anthracite mb-1">
                    Objet des travaux
                  </label>
                  <input
                    type="text"
                    required
                    value={objet}
                    onChange={(e) => setObjet(e.target.value)}
                    placeholder="Ex: Pose terrasse Cumaru 40 m² sur plots réglables (DTU 51.4)"
                    className="w-full rounded-xl border border-bna-border px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-bold text-bna-anthracite mb-1">
                    Taux de TVA
                  </label>
                  <select
                    value={tvaPct}
                    onChange={(e) => setTvaPct(Number(e.target.value) as TauxTvaBtp)}
                    className="w-full rounded-xl border border-bna-border bg-bna-offwhite px-3 py-2 font-semibold"
                  >
                    <option value={10}>TVA 10% (Rénovation &gt; 2 ans)</option>
                    <option value={20}>TVA 20% (Standard / Neuf)</option>
                    <option value={5.5}>TVA 5,5% (Isolation / ITE)</option>
                    <option value={0}>TVA 0% (Autoliquidation BTP)</option>
                  </select>
                </div>
              </div>

              {/* Lignes de chiffrage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-bna-anthracite">
                    Lignes de chiffrage (Prix de vente HT &amp; Coût de revient HT)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLigneForm}
                    className="text-bna-copper font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
                  </button>
                </div>

                {lignesForm.map((lig, idx) => (
                  <div
                    key={lig.id}
                    className="p-3 rounded-xl bg-bna-offwhite border border-bna-border space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={lig.designation}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLignesForm((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, designation: val } : l))
                          );
                        }}
                        className="flex-1 bg-white border border-bna-border rounded-lg px-2.5 py-1.5 font-semibold"
                        placeholder="Désignation du poste"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveLigneForm(lig.id)}
                        className="p-1 text-bna-muted hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <span className="text-[10px] text-bna-muted">Quantité</span>
                        <input
                          type="number"
                          step="any"
                          value={lig.qte}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLignesForm((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, qte: val } : l))
                            );
                          }}
                          className="w-full bg-white border border-bna-border rounded-lg px-2 py-1"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-bna-muted">Unité</span>
                        <input
                          type="text"
                          value={lig.unite}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLignesForm((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, unite: val } : l))
                            );
                          }}
                          className="w-full bg-white border border-bna-border rounded-lg px-2 py-1"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-bna-muted">PV Unitaire HT (€)</span>
                        <input
                          type="number"
                          step="any"
                          value={lig.pu_ht}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLignesForm((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, pu_ht: val } : l))
                            );
                          }}
                          className="w-full bg-white border border-bna-border rounded-lg px-2 py-1 font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-bna-muted">Coût Revient HT (€)</span>
                        <input
                          type="number"
                          step="any"
                          value={lig.pu_revient}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLignesForm((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, pu_revient: val } : l))
                            );
                          }}
                          className="w-full bg-white border border-bna-border rounded-lg px-2 py-1 text-slate-600"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Résumé financier temps réel */}
              <div className="p-3.5 rounded-2xl bg-neutral-900 text-white flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-neutral-400">
                    Marge Brute Estimée :{" "}
                    <b className="text-emerald-400">
                      {fmtEuro(previewCalcForm.marge_ht)} ({previewCalcForm.marge_pct}%)
                    </b>
                  </p>
                  <p className="text-sm font-bold mt-0.5">
                    Total HT : {fmtEuro(previewCalcForm.total_ht)} · Total TTC :{" "}
                    {fmtEuro(previewCalcForm.total_ttc)}
                  </p>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-bna-copper hover:bg-bna-copper-hover text-white font-bold rounded-xl cursor-pointer"
                >
                  Enregistrer le Devis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODALE APERÇU OFFICIEL BNA (DEVIS OU FACTURE IMPRIMABLE)
         ========================================================= */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-bna-border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-bna-border pb-4">
              <div>
                <div className="font-display font-black text-2xl tracking-tighter text-bna-anthracite">
                  BN<span className="text-bna-copper">A</span>{" "}
                  <span className="text-xs font-bold text-bna-muted uppercase tracking-normal ml-1">
                    Bardage &amp; Aménagement Extérieur
                  </span>
                </div>
                <p className="text-[11px] text-bna-muted mt-0.5">
                  Gironde (33) · Garantie Décennale &amp; Conformité NF DTU 51.4 / 41.2 / 45.4
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-bna-copper text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-bna-muted hover:text-bna-anthracite rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {previewDoc.kind === "devis" ? (
              (() => {
                const d = previewDoc.item;
                const c = calculerDevis(d.lignes, d.tva_pct, d.acompte_pct);
                return (
                  <div className="space-y-4 text-xs">
                    <div className="flex justify-between bg-bna-offwhite p-3.5 rounded-2xl border border-bna-border">
                      <div>
                        <p className="font-bold text-sm text-bna-anthracite">
                          DEVIS N° {d.numero}
                        </p>
                        <p className="text-bna-muted">
                          Date : {d.date_creation} · Validité : {d.date_validite}
                        </p>
                        <p className="mt-1 font-semibold text-bna-anthracite">{d.objet}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-bna-muted font-bold">
                          Destinataire
                        </p>
                        <p className="font-bold text-sm text-bna-anthracite">{d.client_nom}</p>
                        <p className="text-bna-muted">{d.ville}</p>
                      </div>
                    </div>

                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-bna-border text-[11px] text-bna-muted uppercase">
                          <th className="py-2">Désignation des ouvrages</th>
                          <th className="py-2 text-right">Qté</th>
                          <th className="py-2 text-right">PU HT</th>
                          <th className="py-2 text-right">Total HT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-bna-border/60">
                        {d.lignes.map((l) => (
                          <tr key={l.id}>
                            <td className="py-2.5 pr-2">
                              <p className="font-semibold text-bna-anthracite">{l.designation}</p>
                              {l.description && (
                                <p className="text-[11px] text-bna-muted">{l.description}</p>
                              )}
                            </td>
                            <td className="py-2.5 text-right whitespace-nowrap">
                              {l.qte} {l.unite}
                            </td>
                            <td className="py-2.5 text-right whitespace-nowrap">
                              {fmtEuro(l.pu_ht)}
                            </td>
                            <td className="py-2.5 text-right font-bold whitespace-nowrap">
                              {fmtEuro(l.qte * l.pu_ht)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="flex justify-end pt-3 border-t border-bna-border">
                      <div className="w-64 space-y-1 text-right">
                        <div className="flex justify-between">
                          <span className="text-bna-muted">Total HT :</span>
                          <b>{fmtEuro(c.total_ht)}</b>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-bna-muted">TVA ({d.tva_pct}%) :</span>
                          <b>{fmtEuro(c.total_tva)}</b>
                        </div>
                        <div className="flex justify-between text-sm font-black text-bna-anthracite pt-1 border-t border-bna-border">
                          <span>Total TTC :</span>
                          <span>{fmtEuro(c.total_ttc)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-bna-copper font-bold pt-1">
                          <span>Acompte à la signature ({d.acompte_pct}%) :</span>
                          <span>{fmtEuro(c.acompte_ttc)} TTC</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              (() => {
                const f = previewDoc.item;
                return (
                  <div className="space-y-4 text-xs">
                    <div className="flex justify-between bg-bna-offwhite p-3.5 rounded-2xl border border-bna-border">
                      <div>
                        <p className="font-bold text-sm text-bna-anthracite">
                          FACTURE N° {f.numero} ({f.type.toUpperCase()})
                        </p>
                        <p className="text-bna-muted">
                          Émise le : {f.date_emission} · Échéance : {f.date_echeance}
                        </p>
                        <p className="mt-1 font-semibold text-bna-anthracite">{f.objet}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-bna-muted font-bold">Client</p>
                        <p className="font-bold text-sm text-bna-anthracite">{f.client_nom}</p>
                        <p className="text-bna-muted">Chantier : {f.chantier_nom}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-bna-border space-y-2">
                      <div className="flex justify-between">
                        <span>Montant Hors Taxes (HT)</span>
                        <b>{fmtEuro(f.montant_ht)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>TVA ({f.tva_pct}%)</span>
                        <b>{fmtEuro(f.montant_tva)}</b>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Montant TTC</span>
                        <span>{fmtEuro(f.montant_ttc)}</span>
                      </div>
                      {f.montant_retenue_ttc > 0 && (
                        <div className="flex justify-between text-amber-700 font-semibold">
                          <span>
                            Retenue de Garantie ({f.retenue_garantie_pct}% — Loi n° 71-584)
                          </span>
                          <span>-{fmtEuro(f.montant_retenue_ttc)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-black text-bna-copper pt-2 border-t border-bna-border">
                        <span>NET À PAYER TTC</span>
                        <span>{fmtEuro(f.net_a_payer_ttc)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
};
