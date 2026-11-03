"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ClipboardCheck,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Printer,
  Trash2,
  X,
  LockOpen,
  Calendar,
} from "lucide-react";
import type { Chantier, MetierType } from "@/types/metier";
import { fmtEuro } from "@/lib/services/devisFinanceService";
import {
  getPvReceptions,
  getTicketsSav,
  creerPvReception,
  toggleReservePv,
  ajouterReservePv,
  libererRetenueGarantiePv,
  supprimerPvReception,
  creerTicketSav,
  updateStatutTicketSav,
  supprimerTicketSav,
  LABELS_STATUT_PV,
  LABELS_GARANTIE_SAV,
  type PvReceptionItem,
  type TicketSavItem,
  type StatutPV,
  type TypeGarantieLegale,
} from "@/lib/services/pvSavService";

interface PvReceptionSavPanelProps {
  chantiers: Chantier[];
  filterChantierId?: string;
}

export const PvReceptionSavPanel: React.FC<PvReceptionSavPanelProps> = ({
  chantiers,
  filterChantierId,
}) => {
  const [activeView, setActiveView] = useState<"pv" | "sav">("pv");
  const [pvList, setPvList] = useState<PvReceptionItem[]>([]);
  const [savList, setSavList] = useState<TicketSavItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Modales création PV / SAV
  const [isNewPvOpen, setIsNewPvOpen] = useState(false);
  const [isNewSavOpen, setIsNewSavOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<
    | { kind: "pv"; item: PvReceptionItem }
    | { kind: "sav"; item: TicketSavItem }
    | null
  >(null);

  // Formulaire Nouveau PV
  const [pvChantierId, setPvChantierId] = useState<string>(
    filterChantierId || chantiers[0]?.id || "martin"
  );
  const [pvStatut, setPvStatut] = useState<StatutPV>("sans_reserve");
  const [pvTravaux, setPvTravaux] = useState("");
  const [pvMateriaux, setPvMateriaux] = useState("");
  const [pvRetenueTtc, setPvRetenueTtc] = useState<number>(170.75);
  const [pvReserveInit, setPvReserveInit] = useState("");

  // Formulaire Nouveau Ticket SAV
  const [savChantierId, setSavChantierId] = useState<string>(
    filterChantierId || chantiers[0]?.id || "dupont"
  );
  const [savGarantie, setSavGarantie] = useState<TypeGarantieLegale>("gpa_1_an");
  const [savSinistre, setSavSinistre] = useState("");
  const [savLocalisation, setSavLocalisation] = useState("");
  const [savDiagnosticDtu, setSavDiagnosticDtu] = useState(
    "Vérification conforme aux prescriptions NF DTU 51.4 / 41.2. Reprise ponctuelle de finition."
  );
  const [savTravaux, setSavTravaux] = useState("");
  const [savDateIntervention, setSavDateIntervention] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Ajout rapide de réserve sur un PV
  const [addingReservePvId, setAddingReservePvId] = useState<string | null>(null);
  const [newReserveText, setNewReserveText] = useState("");
  const [newReserveLoc, setNewReserveLoc] = useState("Zone principale");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    setPvList(getPvReceptions());
    setSavList(getTicketsSav());
  }, []);

  const displayedPvs = filterChantierId
    ? pvList.filter((p) => p.chantier_id === filterChantierId)
    : pvList;

  const displayedSavs = filterChantierId
    ? savList.filter((s) => s.chantier_id === filterChantierId)
    : savList;

  const handleCreatePv = (e: React.FormEvent) => {
    e.preventDefault();
    const ch = chantiers.find((c) => c.id === pvChantierId);
    const today = new Date().toISOString().slice(0, 10);
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + 10);

    const created = creerPvReception({
      chantier_id: ch?.id || pvChantierId,
      chantier_nom: ch?.nom || "Chantier BNA",
      client_nom: ch?.client_nom || `Client ${ch?.nom || "BNA"}`,
      ville: ch?.ville || "Gironde",
      metier: (ch?.metier || "terrasse") as MetierType,
      date_reception: today,
      statut: pvReserveInit.trim() ? "avec_reserves" : pvStatut,
      type_travaux:
        pvTravaux || `Travaux de ${ch?.metier.toUpperCase() || "BARDAGE"} (${ch?.ville || "33"})`,
      materiaux_utilises: pvMateriaux || "Matériaux certifiés CSTB / NF DTU",
      reserves: pvReserveInit.trim()
        ? [
            {
              id: `res-${Date.now()}`,
              designation: pvReserveInit.trim(),
              localisation: "Zone principale",
              date_limite: limitDate.toISOString().slice(0, 10),
              levee: false,
            },
          ]
        : [],
      checklist_repli: {
        nettoyage: true,
        dechets_evacues: true,
        echafaudage_demonte: true,
        fiches_techniques_remises: true,
      },
      observations:
        "Ouvrage réceptionné contradictoirement. Remise des notices d'entretien et de l'attestation décennale BNA.",
      montant_retenue_ttc: pvRetenueTtc,
      retenue_garantie_liberee: pvStatut === "sans_reserve" && !pvReserveInit.trim(),
      signe_client: true,
      signe_entreprise: true,
    });

    setPvList(getPvReceptions());
    setIsNewPvOpen(false);
    setPvReserveInit("");
    showToast(`PV de réception ${created.numero} enregistré !`);
  };

  const handleCreateSav = (e: React.FormEvent) => {
    e.preventDefault();
    const ch = chantiers.find((c) => c.id === savChantierId);
    const today = new Date().toISOString().slice(0, 10);

    const created = creerTicketSav({
      chantier_id: ch?.id || savChantierId,
      chantier_nom: ch?.nom || "Chantier BNA",
      client_nom: ch?.client_nom || `Client ${ch?.nom || "BNA"}`,
      ville: ch?.ville || "Gironde",
      metier: (ch?.metier || "facade") as MetierType,
      statut: "planifie",
      type_garantie: savGarantie,
      type_sinistre: savSinistre || "Constat SAV sur ouvrage",
      localisation: savLocalisation || "Zone principale",
      diagnostic_dtu: savDiagnosticDtu,
      respect_dtu: true,
      travaux_reprise: savTravaux || "Reprise et réglage selon prescriptions DTU",
      date_signalement: today,
      date_intervention: savDateIntervention,
      intervenant: "Gaël (Gérant BNA)",
    });

    setSavList(getTicketsSav());
    setIsNewSavOpen(false);
    setSavSinistre("");
    showToast(`Fiche d'intervention ${created.numero} créée !`);
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-24 md:bottom-6 right-4 z-50 bg-neutral-900 text-white px-4 py-3 rounded-2xl shadow-lg border border-neutral-700 flex items-center gap-2 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* BARRE D'EN-TÊTE PV DE RÉCEPTION vs SAV DÉCENNALE */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-bna-border rounded-2xl p-3 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveView("pv")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === "pv"
                ? "bg-neutral-900 text-white shadow-2xs"
                : "text-bna-muted hover:text-bna-anthracite"
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>PV de Réception &amp; Réserves ({displayedPvs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("sav")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === "sav"
                ? "bg-neutral-900 text-white shadow-2xs"
                : "text-bna-muted hover:text-bna-anthracite"
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Fiches SAV &amp; Garanties DTU ({displayedSavs.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            activeView === "pv" ? setIsNewPvOpen(true) : setIsNewSavOpen(true)
          }
          className="px-3.5 py-2 bg-bna-copper hover:bg-bna-copper-hover text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>
            {activeView === "pv"
              ? "Nouveau PV de Réception"
              : "Nouveau Ticket SAV / Décennale"}
          </span>
        </button>
      </div>

      {/* =========================================================
          VUE 1 : PROCÈS-VERBAUX DE RÉCEPTION & LEVÉE DES RÉSERVES
         ========================================================= */}
      {activeView === "pv" && (
        <div className="space-y-3">
          {displayedPvs.length === 0 ? (
            <div className="bg-white border border-bna-border rounded-2xl p-6 text-center text-xs text-bna-muted">
              Aucun Procès-Verbal de réception enregistré pour cette sélection.
            </div>
          ) : (
            displayedPvs.map((pv) => {
              const cfg = LABELS_STATUT_PV[pv.statut];
              const nonLeveesCount = pv.reserves.filter((r) => !r.levee).length;
              const canLibererRetenue =
                !pv.retenue_garantie_liberee &&
                pv.montant_retenue_ttc > 0 &&
                nonLeveesCount === 0;

              return (
                <div
                  key={pv.id}
                  className="bg-white border border-bna-border rounded-2xl p-4 shadow-2xs space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-bna-offwhite border border-bna-border text-bna-anthracite">
                          {pv.numero}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${cfg.badgeClass}`}
                        >
                          {cfg.label}
                        </span>
                        <span className="text-[11px] text-bna-muted">
                          Réception du {pv.date_reception} (Art. 1792-6 Code Civil)
                        </span>
                      </div>

                      <h3 className="font-display font-bold text-base text-bna-anthracite mt-1.5">
                        {pv.chantier_nom} — {pv.client_nom} ({pv.ville})
                      </h3>
                      <p className="text-xs text-bna-muted">{pv.type_travaux}</p>
                    </div>

                    {/* Bloc Retenue de Garantie 5% */}
                    {pv.montant_retenue_ttc > 0 && (
                      <div className="text-right bg-bna-offwhite border border-bna-border rounded-xl px-3 py-2">
                        <span className="text-[10px] font-bold uppercase text-bna-muted block">
                          Retenue de Garantie 5% (Loi 71-584)
                        </span>
                        <p className="font-display font-black text-sm text-bna-anthracite">
                          {fmtEuro(pv.montant_retenue_ttc)} TTC
                        </p>
                        <span
                          className={`text-[10px] font-bold ${
                            pv.retenue_garantie_liberee
                              ? "text-emerald-700"
                              : nonLeveesCount === 0
                              ? "text-bna-copper"
                              : "text-amber-700"
                          }`}
                        >
                          {pv.retenue_garantie_liberee
                            ? `✓ Libérée le ${pv.date_liberation_retenue || pv.date_reception}`
                            : nonLeveesCount === 0
                            ? "🔓 Libérable immédiatement"
                            : `🔒 Bloquée (${nonLeveesCount} réserve(s))`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tableau interactif des Réserves */}
                  <div className="bg-bna-offwhite border border-bna-border/70 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase text-bna-anthracite">
                        Réserves consignées ({pv.reserves.filter((r) => r.levee).length}/
                        {pv.reserves.length} levées)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAddingReservePvId(addingReservePvId === pv.id ? null : pv.id)
                        }
                        className="text-[11px] font-bold text-bna-copper hover:underline cursor-pointer"
                      >
                        + Ajouter une réserve
                      </button>
                    </div>

                    {addingReservePvId === pv.id && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={newReserveText}
                          onChange={(e) => setNewReserveText(e.target.value)}
                          placeholder="Désignation de la retouche / réserve..."
                          className="flex-1 bg-white border border-bna-border rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newReserveText.trim()) return;
                            const d = new Date();
                            d.setDate(d.getDate() + 10);
                            setPvList(
                              ajouterReservePv(
                                pv.id,
                                newReserveText.trim(),
                                newReserveLoc,
                                d.toISOString().slice(0, 10)
                              )
                            );
                            setNewReserveText("");
                            setAddingReservePvId(null);
                            showToast("Réserve ajoutée au PV.");
                          }}
                          className="px-3 py-1.5 bg-bna-copper text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Ajouter
                        </button>
                      </div>
                    )}

                    {pv.reserves.length === 0 ? (
                      <p className="text-xs text-emerald-700 font-semibold">
                        ✓ Aucune réserve — Ouvrage réceptionné conforme aux règles DTU.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {pv.reserves.map((res) => (
                          <div
                            key={res.id}
                            onClick={() => {
                              setPvList(toggleReservePv(pv.id, res.id));
                              showToast(
                                !res.levee
                                  ? "Réserve pointée comme LEVÉE !"
                                  : "Réserve réouverte."
                              );
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                              res.levee
                                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                                : "bg-white border-amber-200 text-bna-anthracite hover:border-bna-copper"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={res.levee}
                                readOnly
                                className="rounded text-emerald-600"
                              />
                              <div>
                                <p
                                  className={`font-semibold ${
                                    res.levee ? "line-through text-emerald-800" : ""
                                  }`}
                                >
                                  {res.designation}
                                </p>
                                <p className="text-[10px] text-bna-muted">
                                  Lieu : {res.localisation} · Délai : {res.date_limite}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                res.levee
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {res.levee ? `Levée (${res.date_levee})` : "À lever"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions du PV */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      {canLibererRetenue && (
                        <button
                          type="button"
                          onClick={() => {
                            setPvList(libererRetenueGarantiePv(pv.id));
                            showToast(
                              `Retenue de garantie (${fmtEuro(pv.montant_retenue_ttc)} TTC) libérée !`
                            );
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <LockOpen className="w-3.5 h-3.5" />
                          <span>
                            Libérer Retenue 5% ({fmtEuro(pv.montant_retenue_ttc)} TTC)
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ kind: "pv", item: pv })}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Aperçu PV Officiel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPvList(supprimerPvReception(pv.id));
                          showToast(`PV ${pv.numero} supprimé.`);
                        }}
                        className="p-1.5 text-bna-muted hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================
          VUE 2 : FICHES SAV, GARANTIE DÉCENNALE & DIAGNOSTIC DTU
         ========================================================= */}
      {activeView === "sav" && (
        <div className="space-y-3">
          {displayedSavs.length === 0 ? (
            <div className="bg-white border border-bna-border rounded-2xl p-6 text-center text-xs text-bna-muted">
              Aucun ticket SAV enregistré pour cette sélection.
            </div>
          ) : (
            displayedSavs.map((sav) => {
              const badgeStatut =
                sav.statut === "cloture"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : sav.statut === "planifie"
                  ? "bg-blue-100 text-blue-800 border-blue-200"
                  : "bg-amber-100 text-amber-800 border-amber-200";

              return (
                <div
                  key={sav.id}
                  className="bg-white border border-bna-border rounded-2xl p-4 shadow-2xs space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-bna-offwhite border border-bna-border text-bna-anthracite">
                          {sav.numero}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${badgeStatut}`}
                        >
                          {sav.statut === "cloture"
                            ? "✓ Clôturé & Signé"
                            : sav.statut === "planifie"
                            ? `📅 Intervention le ${sav.date_intervention}`
                            : "⚠️ Ouvert"}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-bna-copper border border-orange-200">
                          {LABELS_GARANTIE_SAV[sav.type_garantie]}
                        </span>
                      </div>

                      <h3 className="font-display font-bold text-base text-bna-anthracite mt-1.5">
                        {sav.chantier_nom} — {sav.type_sinistre}
                      </h3>
                      <p className="text-xs text-bna-muted">
                        Client : <b>{sav.client_nom}</b> ({sav.ville}) · Localisation :{" "}
                        <b>{sav.localisation}</b>
                      </p>
                    </div>
                  </div>

                  {/* Diagnostic DTU */}
                  <div className="bg-bna-offwhite border border-bna-border/70 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-bna-anthracite flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Diagnostic Réglementaire DTU</span>
                      </span>
                      {sav.respect_dtu && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Pose d&apos;origine conforme DTU
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 leading-relaxed">{sav.diagnostic_dtu}</p>
                    <p className="text-[11px] text-bna-muted pt-1 border-t border-bna-border/50">
                      <b>Action / Reprise :</b> {sav.travaux_reprise}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div>
                      {sav.statut !== "cloture" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSavList(updateStatutTicketSav(sav.id, "cloture"));
                            showToast(`Intervention ${sav.numero} clôturée !`);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Clôturer l&apos;intervention SAV</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ kind: "sav", item: sav })}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Rapport SAV PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSavList(supprimerTicketSav(sav.id));
                          showToast(`Ticket ${sav.numero} supprimé.`);
                        }}
                        className="p-1.5 text-bna-muted hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================
          MODALE CRÉATION DE PV DE RÉCEPTION
         ========================================================= */}
      {isNewPvOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-bna-border rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-bna-border pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-bna-anthracite">
                  Établir un Procès-Verbal de Réception
                </h3>
                <p className="text-[11px] text-bna-muted">
                  Art. 1792-6 du Code Civil · Déclenchement GPA (1 an) &amp; Décennale (10 ans)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewPvOpen(false)}
                className="p-1 rounded-lg text-bna-muted hover:text-bna-anthracite"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePv} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Chantier réceptionné</label>
                <select
                  value={pvChantierId}
                  onChange={(e) => setPvChantierId(e.target.value)}
                  className="w-full rounded-xl border border-bna-border bg-bna-offwhite px-3 py-2 font-semibold"
                >
                  {chantiers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom} ({c.ville})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Prononciation</label>
                  <select
                    value={pvStatut}
                    onChange={(e) => setPvStatut(e.target.value as StatutPV)}
                    className="w-full rounded-xl border border-bna-border bg-bna-offwhite px-3 py-2 font-semibold"
                  >
                    <option value="sans_reserve">Sans réserve</option>
                    <option value="avec_reserves">Avec réserves</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Retenue 5% TTC (€)</label>
                  <input
                    type="number"
                    step="any"
                    value={pvRetenueTtc}
                    onChange={(e) => setPvRetenueTtc(Number(e.target.value))}
                    className="w-full rounded-xl border border-bna-border px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Nature des travaux réceptionnés</label>
                <input
                  type="text"
                  value={pvTravaux}
                  onChange={(e) => setPvTravaux(e.target.value)}
                  placeholder="Ex: Création terrasse Cumaru 42 m² conforme NF DTU 51.4"
                  className="w-full rounded-xl border border-bna-border px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">
                  Réserve éventuelle constatée (laisser vide si sans réserve)
                </label>
                <input
                  type="text"
                  value={pvReserveInit}
                  onChange={(e) => setPvReserveInit(e.target.value)}
                  placeholder="Ex: Ajustement coupe bandeau d'angle..."
                  className="w-full rounded-xl border border-bna-border px-3 py-2"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewPvOpen(false)}
                  className="px-4 py-2 rounded-xl border border-bna-border font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-bna-copper text-white font-bold cursor-pointer"
                >
                  Valider et signer le PV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODALE CRÉATION DE FICHE SAV / DIAGNOSTIC DTU
         ========================================================= */}
      {isNewSavOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-bna-border rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-bna-border pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-bna-anthracite">
                  Nouvelle Fiche d&apos;Intervention SAV &amp; Diagnostic DTU
                </h3>
                <p className="text-[11px] text-bna-muted">
                  Traçabilité Garantie de Parfait Achèvement (1 an) &amp; Décennale (10 ans)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewSavOpen(false)}
                className="p-1 rounded-lg text-bna-muted hover:text-bna-anthracite"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSav} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Chantier concerné</label>
                  <select
                    value={savChantierId}
                    onChange={(e) => setSavChantierId(e.target.value)}
                    className="w-full rounded-xl border border-bna-border bg-bna-offwhite px-3 py-2 font-semibold"
                  >
                    {chantiers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom} ({c.ville})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Cadre de Garantie</label>
                  <select
                    value={savGarantie}
                    onChange={(e) => setSavGarantie(e.target.value as TypeGarantieLegale)}
                    className="w-full rounded-xl border border-bna-border bg-bna-offwhite px-3 py-2 font-semibold"
                  >
                    <option value="gpa_1_an">GPA (1 an)</option>
                    <option value="biennale_2_ans">Biennale (2 ans)</option>
                    <option value="decennale_10_ans">Décennale (10 ans)</option>
                    <option value="hors_garantie">Hors garantie</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Désordre / Motif d&apos;appel</label>
                <input
                  type="text"
                  required
                  value={savSinistre}
                  onChange={(e) => setSavSinistre(e.target.value)}
                  placeholder="Ex: Tuilage d'une lame de rive / Vibration bavette..."
                  className="w-full rounded-xl border border-bna-border px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Localisation sur ouvrage</label>
                  <input
                    type="text"
                    value={savLocalisation}
                    onChange={(e) => setSavLocalisation(e.target.value)}
                    placeholder="Ex: Façade Ouest / Rive Sud"
                    className="w-full rounded-xl border border-bna-border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Date d&apos;intervention</label>
                  <input
                    type="date"
                    value={savDateIntervention}
                    onChange={(e) => setSavDateIntervention(e.target.value)}
                    className="w-full rounded-xl border border-bna-border px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Diagnostic DTU (51.4 / 41.2 / 45.4)</label>
                <textarea
                  rows={2}
                  value={savDiagnosticDtu}
                  onChange={(e) => setSavDiagnosticDtu(e.target.value)}
                  className="w-full rounded-xl border border-bna-border px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Travaux de reprise prévus / réalisés</label>
                <input
                  type="text"
                  value={savTravaux}
                  onChange={(e) => setSavTravaux(e.target.value)}
                  placeholder="Ex: Remplacement d'une lame et contrôle double lambourdage"
                  className="w-full rounded-xl border border-bna-border px-3 py-2"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewSavOpen(false)}
                  className="px-4 py-2 rounded-xl border border-bna-border font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-bna-copper text-white font-bold cursor-pointer"
                >
                  Créer la Fiche SAV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODALE APERÇU OFFICIEL IMPRIMABLE (PV DE RÉCEPTION OU RAPPORT SAV)
         ========================================================= */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-bna-border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-start justify-between border-b border-bna-border pb-4">
              <div>
                <div className="font-display font-black text-2xl tracking-tighter text-bna-anthracite">
                  BN<span className="text-bna-copper">A</span>{" "}
                  <span className="text-xs font-bold text-bna-muted uppercase tracking-normal ml-1">
                    {previewDoc.kind === "pv"
                      ? "Procès-Verbal de Réception de Travaux"
                      : "Rapport d'Intervention SAV & Diagnostic DTU"}
                  </span>
                </div>
                <p className="text-[11px] text-bna-muted">
                  Conforme Code Civil Art. 1792-6 · Normes NF DTU 51.4 / 41.2 / 45.4
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-bna-copper text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
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

            {previewDoc.kind === "pv" ? (
              (() => {
                const pv = previewDoc.item;
                const cfg = LABELS_STATUT_PV[pv.statut];
                return (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-bna-offwhite border border-bna-border flex justify-between">
                      <div>
                        <p className="font-bold text-sm">{pv.numero}</p>
                        <p className="text-bna-muted">Date de réception : {pv.date_reception}</p>
                        <p className="font-semibold mt-1">{pv.type_travaux}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{pv.client_nom}</p>
                        <p className="text-bna-muted">
                          {pv.chantier_nom} ({pv.ville})
                        </p>
                      </div>
                    </div>

                    <div className={`p-3.5 rounded-2xl border ${cfg.badgeClass}`}>
                      <p className="font-black uppercase">{cfg.label}</p>
                      <p className="mt-1 text-[11px]">{cfg.desc}</p>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-bna-border space-y-1.5">
                      <p className="font-bold uppercase text-[11px]">
                        Garanties Légales déclenchées à compter du {pv.date_reception} :
                      </p>
                      <p>• Garantie de Parfait Achèvement (GPA — 1 an, Art. 1792-6 Code Civil)</p>
                      <p>• Garantie Biennale de bon fonctionnement (2 ans, Art. 1792-3)</p>
                      <p>• Garantie Décennale (10 ans, Art. 1792)</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="p-3 rounded-xl border border-bna-border h-28 flex flex-col justify-between">
                        <span className="font-bold">Pour le Client ({pv.client_nom})</span>
                        <span className="text-emerald-700 font-bold">
                          ✓ Lu et approuvé — Signé
                        </span>
                      </div>
                      <div className="p-3 rounded-xl border border-bna-border h-28 flex flex-col justify-between">
                        <span className="font-bold">Pour BNA (Gaël — Gérant)</span>
                        <span className="text-emerald-700 font-bold">
                          ✓ Certifié conforme DTU — Signé
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              (() => {
                const sav = previewDoc.item;
                return (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-bna-offwhite border border-bna-border flex justify-between">
                      <div>
                        <p className="font-bold text-sm">{sav.numero}</p>
                        <p className="text-bna-muted">
                          Intervention : {sav.date_intervention} · {sav.intervenant}
                        </p>
                        <p className="font-semibold mt-1">
                          {LABELS_GARANTIE_SAV[sav.type_garantie]}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{sav.client_nom}</p>
                        <p className="text-bna-muted">
                          {sav.chantier_nom} ({sav.ville})
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-bna-border space-y-2">
                      <p>
                        <b>Motif / Désordre :</b> {sav.type_sinistre} ({sav.localisation})
                      </p>
                      <p>
                        <b>Diagnostic DTU :</b> {sav.diagnostic_dtu}
                      </p>
                      <p>
                        <b>Travaux réalisés :</b> {sav.travaux_reprise}
                      </p>
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

interface PvReceptionSavModalProps {
  isOpen: boolean;
  onClose: () => void;
  chantier: Chantier;
  allChantiers: Chantier[];
}

export const PvReceptionSavModal: React.FC<PvReceptionSavModalProps> = ({
  isOpen,
  onClose,
  chantier,
  allChantiers,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bna-offwhite border border-bna-border rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-bna-border pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-bna-copper">
              RÉCEPTION DE CHANTIER &amp; GARANTIES LÉGALES
            </span>
            <h2 className="font-display font-bold text-lg text-bna-anthracite">
              {chantier.nom} ({chantier.ville})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white border border-bna-border text-bna-muted hover:text-bna-anthracite"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <PvReceptionSavPanel
          chantiers={allChantiers.length > 0 ? allChantiers : [chantier]}
          filterChantierId={chantier.id}
        />
      </div>
    </div>
  );
};
