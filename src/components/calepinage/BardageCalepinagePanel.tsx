"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Package,
  Plus,
  RotateCw,
  Ruler,
  Trash2,
  Truck,
  Wrench,
} from "lucide-react";
import { calculerCalepinage } from "@/lib/bardage/calepinageCalcul";
import type { PieceCalepinage, ResultatCalepinage } from "@/lib/bardage/calepinageCalcul";
import { calculerPose, LABELS_FAMILLE } from "@/lib/bardage/poseCalcul";
import type { FamillePose, ResultatPose } from "@/lib/bardage/poseCalcul";
import { genererModules } from "@/lib/bardage/modules";
import type { CuttingListItem } from "@/lib/bardage/types";
import {
  construireBesoinsBardage,
  fusionnerBesoinsBardage,
  saveCalepinageBardage,
} from "@/lib/services/calepinageService";
import { createClient } from "@/lib/supabase/client";
import { MateriauxCommandesModal } from "@/components/materiaux/MateriauxCommandesModal";

// V1 bardage : formulaire -> UN SEUL calcul (calculerCalepinage / calculerPose)
// -> plan, débit et métré lisent tous cette même sortie (aucun recalcul dans l'UI).

type Vue = "plan" | "debit" | "metre";

const num = (v: string, def = 0) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : def;
};

const COULEUR: Record<PieceCalepinage["type"], string> = {
  pleine: "#E7D9C9",
  coupe: "#F3C9B5",
  pignon: "#F5E0A8",
};

function PlanSvg({ r, chevrons, largeurM, zoom }: { r: ResultatCalepinage; chevrons: number[]; largeurM: number; zoom?: number }) {
  const [sel, setSel] = useState<string | null>(null);
  const H = r.hauteurFaiteM || r.rangeesHauteursM.reduce((a, b) => a + b, 0);
  const W = largeurM;
  const padLeft = 0.45;
  const padBottom = 0.4;
  const padTop = 0.2;
  const padRight = 0.2;
  const toPts = (p: PieceCalepinage) =>
    (p.points ?? [
      { xM: p.xM, yM: p.yM },
      { xM: p.xM + p.largeurM, yM: p.yM },
      { xM: p.xM + p.largeurM, yM: p.yM + p.hauteurM },
      { xM: p.xM, yM: p.yM + p.hauteurM },
    ])
      // repère SVG : y vers le bas, le sol est en bas
      .map((q) => `${q.xM},${H - q.yM}`)
      .join(" ");
  const selected = r.pieces.find((p) => p.id === sel);

  return (
    <div className="space-y-2">
      <div className={zoom ? "overflow-auto" : "overflow-x-auto"}>
        <svg
          viewBox={`${-padLeft} ${-padTop} ${W + padLeft + padRight} ${H + padTop + padBottom}`}
          className="rounded-xl bg-white border border-bna-border block"
          style={
            zoom
              ? { width: `${Math.round(zoom * 100)}%`, minWidth: `${Math.round(zoom * 640)}px`, maxWidth: "none" }
              : { width: "100%", minWidth: "480px", maxHeight: "62vh" }
          }
          role="img"
          aria-label={`Plan de calepinage, ${r.nbPiecesPosees} pièces`}
        >
          {/* Cotation largeur totale en bas */}
          <line x1={0} y1={H + 0.18} x2={W} y2={H + 0.18} stroke="#64748b" strokeWidth={0.01} />
          <line x1={0} y1={H + 0.1} x2={0} y2={H + 0.25} stroke="#64748b" strokeWidth={0.01} />
          <line x1={W} y1={H + 0.1} x2={W} y2={H + 0.25} stroke="#64748b" strokeWidth={0.01} />
          <text x={W / 2} y={H + 0.32} fontSize={0.13} textAnchor="middle" fill="#334155" fontWeight="bold">
            {W.toFixed(2)} m ({Math.round(W * 1000)} mm)
          </text>

          {/* Cotation hauteur totale à gauche */}
          <line x1={-0.18} y1={0} x2={-0.18} y2={H} stroke="#64748b" strokeWidth={0.01} />
          <line x1={-0.25} y1={0} x2={-0.1} y2={0} stroke="#64748b" strokeWidth={0.01} />
          <line x1={-0.25} y1={H} x2={-0.1} y2={H} stroke="#64748b" strokeWidth={0.01} />
          <text
            x={-0.28}
            y={H / 2}
            fontSize={0.13}
            textAnchor="middle"
            fill="#334155"
            fontWeight="bold"
            transform={`rotate(-90, -0.28, ${H / 2})`}
          >
            {H.toFixed(2)} m ({Math.round(H * 1000)} mm)
          </text>

          {r.pieces.map((p) => {
            const cx = p.xM + p.largeurM / 2;
            const cy = H - (p.yM + p.hauteurM / 2);
            const isSel = p.id === sel;
            const fSize = Math.min(0.11, p.largeurM / 5.2);
            return (
              <g key={p.id} onClick={() => setSel(isSel ? null : p.id)} className="cursor-pointer">
                <polygon
                  points={toPts(p)}
                  fill={isSel ? "#C15C3D" : COULEUR[p.type]}
                  stroke={isSel ? "#1e293b" : "#4B4B4B"}
                  strokeWidth={isSel ? 0.016 : 0.008}
                />
                {p.largeurM > 0.25 && p.hauteurM > 0.22 && (
                  <>
                    <text
                      x={cx}
                      y={cy - (p.largeurM > 0.45 && p.hauteurM > 0.35 ? fSize * 0.55 : 0)}
                      fontSize={fSize}
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={isSel ? "#FFFFFF" : "#1E293B"}
                    >
                      {p.repere}
                    </text>
                    {p.largeurM > 0.45 && p.hauteurM > 0.35 && (
                      <text
                        x={cx}
                        y={cy + fSize * 0.65}
                        fontSize={fSize * 0.72}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={isSel ? "#FDE68A" : "#475569"}
                      >
                        {Math.round(p.largeurM * 1000)}×{Math.round(p.hauteurM * 1000)}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
          {chevrons.map((x, i) => (
            <line key={i} x1={x} x2={x} y1={0} y2={H} stroke="#2563eb" strokeWidth={0.006} strokeDasharray="0.05 0.04" opacity={0.55} />
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px] text-bna-muted">
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style={{ background: COULEUR.pleine }} />Pleine</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style={{ background: COULEUR.coupe }} />Rive / coupe</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style={{ background: COULEUR.pignon }} />Pignon</span>
        <span><i className="inline-block w-4 border-t border-dashed border-blue-600 align-middle mr-1" />Chevrons (derrière)</span>
      </div>
      {selected && (
        <p className="text-[11px] bg-bna-offwhite border border-bna-border rounded-lg p-2">
          <b>{selected.repere}</b> · {Math.round(selected.largeurM * 1000)} × {Math.round(selected.hauteurM * 1000)} mm ·{" "}
          {selected.surfaceM2.toFixed(2)} m² · plaque n°{selected.plaqueIndex ?? "—"}
        </p>
      )}
    </div>
  );
}

function DebitSvg({ r, zoom }: { r: ResultatCalepinage; zoom?: number }) {
  return (
    <div className="space-y-3">
      {r.plaquesDebit.map((pl) => (
        <div key={pl.index} className="space-y-1">
          <p className="text-[11px] font-semibold text-bna-anthracite">
            Plaque {pl.index} · {pl.longueurMm}×{pl.largeurMm} mm · rendement {pl.tauxRendementPct.toFixed(0)} %
          </p>
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${pl.longueurMm} ${pl.largeurMm}`}
              className="rounded-lg border border-bna-border bg-neutral-100 block"
              style={
                zoom
                  ? { width: `${Math.round(zoom * 100)}%`, minWidth: `${Math.round(zoom * 600)}px`, maxWidth: "none" }
                  : { width: "100%", minWidth: "420px" }
              }
            >
              {pl.chutes.map((c) => (
                <rect key={c.id} x={c.xMm} y={c.yMm} width={c.largeurMm} height={c.hauteurMm}
                  fill={c.reutilisable ? "#BBF7D0" : "#E5E5E5"} stroke="#9CA3AF" strokeWidth={4} />
              ))}
              {pl.pieces.map((p) => (
                <g key={`${p.id}-${p.xMm}-${p.yMm}`}>
                  <rect x={p.xMm} y={p.yMm} width={p.largeurMm} height={p.hauteurMm} fill="#E7D9C9" stroke="#4B4B4B" strokeWidth={5} />
                  {p.largeurMm > 200 && p.hauteurMm > 120 && (
                    <text x={p.xMm + p.largeurMm / 2} y={p.yMm + p.hauteurMm / 2} fontSize={Math.min(85, p.largeurMm / 4.2)}
                      fontWeight="bold" textAnchor="middle" dominantBaseline="middle" fill="#2B2B2B">
                      {p.repere} ({p.largeurMm}×{p.hauteurMm})
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>
      ))}
      <p className="text-[10px] text-bna-muted">Vert = chute réutilisable · gris = perte.</p>
    </div>
  );
}

/** Affiche son contenu en plein écran avec zoom et mode paysage 90° intégré. */
function PleinEcran({ titre, children }: { titre: string; children: (zoom?: number) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1.25);
  const [paysage, setPaysage] = useState(false);
  const bornes = (z: number) => Math.min(6, Math.max(0.75, Math.round(z * 100) / 100));

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-bna-muted">
            Touche une pièce pour voir ses cotes · glisse pour défiler
          </span>
          <button
            type="button"
            onClick={() => { setZoom(1.25); setPaysage(false); setOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-bna-copper text-white rounded-xl shadow-xs active:scale-95"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Plein écran
          </button>
        </div>
        {children()}
      </div>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] bg-white flex flex-col">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-bna-border bg-bna-offwhite">
            <span className="text-xs font-bold text-bna-anthracite truncate">{titre}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPaysage((v) => !v)}
                className={`px-2.5 py-1.5 text-[11px] font-bold border rounded-lg inline-flex items-center gap-1 active:scale-95 ${
                  paysage
                    ? "bg-amber-100 border-amber-400 text-amber-950"
                    : "bg-white border-bna-border text-bna-anthracite"
                }`}
                title="Pivoter le plan à 90° sans déverrouiller la rotation du téléphone"
              >
                <RotateCw className="w-3.5 h-3.5" /> 90°
              </button>
              <button type="button" aria-label="Dézoomer" onClick={() => setZoom((z) => bornes(z - 0.25))}
                className="p-2 bg-white border border-bna-border rounded-lg active:scale-95"><Minus className="w-4 h-4" /></button>
              <button type="button" onClick={() => setZoom(1)}
                className="px-2 py-1.5 text-[11px] font-bold bg-white border border-bna-border rounded-lg min-w-[3.2rem]">{Math.round(zoom * 100)} %</button>
              <button type="button" aria-label="Zoomer" onClick={() => setZoom((z) => bornes(z + 0.25))}
                className="p-2 bg-white border border-bna-border rounded-lg active:scale-95"><Plus className="w-4 h-4" /></button>
              <button type="button" aria-label="Fermer le plein écran" onClick={() => setOpen(false)}
                className="px-2.5 py-2 bg-bna-copper text-white text-xs font-bold rounded-lg inline-flex items-center gap-1 active:scale-95">
                <Minimize2 className="w-4 h-4" /> Fermer
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3 bg-neutral-50 flex items-start justify-start">
            <div
              className="w-full"
              style={
                paysage
                  ? {
                      transform: "rotate(90deg) translateY(-100%)",
                      transformOrigin: "top left",
                      width: "calc(100vh - 110px)",
                    }
                  : undefined
              }
            >
              {children(zoom)}
            </div>
          </div>
          <p className="px-3 py-1.5 text-[10px] text-bna-muted border-t border-bna-border bg-white">
            Astuce : utilise le bouton <b>90°</b> pour basculer le plan en paysage sur toute la hauteur de l&apos;écran, et <b>+ / −</b> pour zoomer sur les repères.
          </p>
        </div>
      )}
    </>
  );
}

export interface FacadeFormState {
  id: string;
  nom: string;
  famille: FamillePose;
  largeur: string;
  hauteur: string;
  pignon: boolean;
  faite: string;
  modL: string;
  modH: string;
  plqL: string;
  plqH: string;
  sens: "horizontal" | "vertical";
  rotation: boolean;
  isolant: string;
}

const DEFAULT_FACADE: FacadeFormState = {
  id: "facade-1",
  nom: "Façade Avant",
  famille: "hpl",
  largeur: "8,4",
  hauteur: "3,2",
  pignon: false,
  faite: "4,5",
  modL: "1000",
  modH: "600",
  plqL: "3050",
  plqH: "1300",
  sens: "horizontal",
  rotation: false,
  isolant: "120",
};

function evaluerFacade(f: FacadeFormState) {
  const L = num(f.largeur);
  const Hm = num(f.hauteur);
  if (L <= 0 || Hm <= 0) {
    return { id: f.id, nom: f.nom, erreur: "Renseigne largeur et hauteur de la façade." } as const;
  }
  const hf = f.pignon ? num(f.faite) : Hm;
  if (f.pignon && hf <= Hm) {
    return { id: f.id, nom: f.nom, erreur: "La hauteur au faîtage doit dépasser la hauteur du mur." } as const;
  }
  try {
    const panneau = f.famille === "hpl" || f.famille === "cassette";
    const mL = num(f.modL, 1000);
    const mH = num(f.modH, 600);
    const cal = panneau
      ? calculerCalepinage({
          zoneLargeurM: L,
          zoneHauteurM: Hm,
          moduleLargeurMm: mL,
          moduleHauteurMm: mH,
          plaqueLongueurMm: num(f.plqL, 3050),
          plaqueLargeurMm: num(f.plqH, 1300),
          sensPose: f.sens,
          estPignon: f.pignon,
          hauteurFaiteM: f.pignon ? hf : null,
          autoriserRotation: f.rotation,
        })
      : null;
    const pose: ResultatPose = calculerPose(
      f.famille,
      L,
      f.pignon ? hf : Hm,
      false,
      0,
      f.famille === "cassette" ? mL : 135,
      {
        moduleLargeurMm: mL,
        moduleHauteurMm: mH,
        sensPose: f.sens,
        epaisseurIsolantMm: num(f.isolant, 0),
        typeIsolant: num(f.isolant, 0) > 0 ? "laine_roche" : "sans_isolant",
      }
    );
    const modulesGeneres = cal ? genererModules(cal, LABELS_FAMILLE[f.famille]) : null;
    const besoins = construireBesoinsBardage(cal, pose, {
      famille: f.famille,
      largeurM: L,
      hauteurM: f.pignon ? hf : Hm,
      estPignon: f.pignon,
      hauteurFaiteM: f.pignon ? hf : null,
    });
    const surfaceM2 = cal ? cal.surfaceZoneM2 : pose.isolant.surfaceNetteM2;
    return {
      id: f.id,
      nom: f.nom,
      famille: f.famille,
      cal,
      pose,
      L,
      Hm: f.pignon ? hf : Hm,
      surfaceM2,
      modulesGeneres,
      besoins,
    } as const;
  } catch (e) {
    return {
      id: f.id,
      nom: f.nom,
      erreur: e instanceof Error ? e.message : "Calcul impossible.",
    } as const;
  }
}

export interface BardageCalepinagePanelProps {
  chantierId?: string;
  entrepriseId?: string;
  onSaved?: () => void;
}

export const BardageCalepinagePanel: React.FC<BardageCalepinagePanelProps> = ({
  chantierId,
  entrepriseId,
  onSaved,
}) => {
  const storageKey = `bna_bardage_facades_v1_${chantierId || "default"}`;
  const [facades, setFacades] = useState<FacadeFormState[]>([DEFAULT_FACADE]);
  const [activeId, setActiveId] = useState<string>(DEFAULT_FACADE.id);
  const [vue, setVue] = useState<Vue>("plan");
  // Mode d'affichage du métré & débit : 'facade' (indépendant par façade) ou 'global' (cumul de toutes les façades)
  const [porteeMetre, setPorteeMetre] = useState<"facade" | "global">("facade");

  const [copiedDebit, setCopiedDebit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [isCommandesOpen, setIsCommandesOpen] = useState(false);

  const supabase = createClient();

  // Chargement initial des façades mémorisées pour ce chantier
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id) {
          setFacades(parsed);
          setActiveId(parsed[0].id);
          return;
        }
      }
    } catch {
      // ignorer
    }
    setFacades([DEFAULT_FACADE]);
    setActiveId(DEFAULT_FACADE.id);
  }, [storageKey]);

  // Sauvegarde automatique dans localStorage à chaque modification
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(facades));
    } catch {
      // ignorer
    }
  }, [facades, storageKey]);

  const activeFacade = facades.find((f) => f.id === activeId) || facades[0];

  const updateActive = (patch: Partial<FacadeFormState>) => {
    setFacades((prev) =>
      prev.map((f) => (f.id === activeFacade.id ? { ...f, ...patch } : f))
    );
  };

  const handleAddFacade = () => {
    const nextNum = facades.length + 1;
    const newId = `facade-${Date.now()}`;
    const nouvelle: FacadeFormState = {
      ...activeFacade,
      id: newId,
      nom: `Façade ${nextNum}`,
      pignon: false,
    };
    setFacades((prev) => [...prev, nouvelle]);
    setActiveId(newId);
  };

  const handleDeleteFacade = (idToDelete: string) => {
    if (facades.length <= 1) return;
    const remaining = facades.filter((f) => f.id !== idToDelete);
    setFacades(remaining);
    if (activeFacade.id === idToDelete) {
      setActiveId(remaining[0].id);
    }
  };

  // Calcul indépendant de chaque façade + cumul global automatique de toutes les façades
  const resultatsParFacade = useMemo(() => facades.map(evaluerFacade), [facades]);
  const calcul =
    resultatsParFacade.find((r) => r.id === activeFacade.id) || resultatsParFacade[0];

  const cumulGlobal = useMemo(() => {
    const valides = resultatsParFacade.filter(
      (r): r is Exclude<(typeof resultatsParFacade)[number], { erreur: string }> =>
        !("erreur" in r)
    );
    const surfaceTotaleM2 = valides.reduce((s, r) => s + r.surfaceM2, 0);
    const nbPiecesTotales = valides.reduce((s, r) => s + (r.cal?.nbPiecesPosees ?? 0), 0);
    const nbPlaquesTotales = valides.reduce((s, r) => s + (r.cal?.nbPlaquesNecessaires ?? 0), 0);
    const surfaceAcheteeTotaleM2 = valides.reduce(
      (s, r) => s + (r.cal?.surfacePlaquesAchetesM2 ?? 0),
      0
    );
    const totalDechetsM2 = valides.reduce((s, r) => s + (r.cal?.totalDechetsPerteM2 ?? 0), 0);
    const tauxChuteGlobalPct =
      surfaceAcheteeTotaleM2 > 0 ? (totalDechetsM2 / surfaceAcheteeTotaleM2) * 100 : 0;
    const chutesReutilisablesM2 = valides.reduce(
      (s, r) => s + (r.cal?.totalChutesReutilisablesM2 ?? 0),
      0
    );
    const mlChevronsTotal = valides.reduce((s, r) => s + r.pose.lineaireChevronsM, 0);
    const nbSegmentsChevronsTotal = valides.reduce((s, r) => s + r.pose.nbSegmentsChevrons, 0);
    const nbEquerresTotal = valides.reduce((s, r) => s + r.pose.nbFixationsTotal, 0);
    const nbChevillesTotal = valides.reduce((s, r) => s + r.pose.nbChevillesMurales, 0);
    const nbVisTotal = valides.reduce((s, r) => s + r.pose.nbVis, 0);

    // Regroupement global du bordereau de débit sur toutes les façades
    const cuttingMap = new Map<string, CuttingListItem>();
    for (const r of valides) {
      for (const item of r.modulesGeneres?.cuttingList ?? []) {
        const key = `${item.width_mm}x${item.height_mm}|${item.material}`;
        const existing = cuttingMap.get(key);
        if (existing) {
          existing.count += item.count;
          existing.surface_m2 =
            Math.round(((existing.width_mm * existing.height_mm * existing.count) / 1_000_000) * 1000) /
            1000;
        } else {
          cuttingMap.set(key, {
            ...item,
            group_number: `G-${String(cuttingMap.size + 1).padStart(3, "0")}`,
          });
        }
      }
    }

    const besoinsGlobaux = fusionnerBesoinsBardage(valides.map((r) => r.besoins));

    return {
      nbFacadesValides: valides.length,
      valides,
      surfaceTotaleM2,
      nbPiecesTotales,
      nbPlaquesTotales,
      tauxChuteGlobalPct,
      chutesReutilisablesM2,
      mlChevronsTotal,
      nbSegmentsChevronsTotal,
      nbEquerresTotal,
      nbChevillesTotal,
      nbVisTotal,
      cuttingListGlobal: [...cuttingMap.values()],
      besoinsGlobaux,
    };
  }, [resultatsParFacade]);

  const panneau = activeFacade.famille === "hpl" || activeFacade.famille === "cassette";

  const handleCopyBordereau = async () => {
    const isGlobal = porteeMetre === "global" && facades.length > 1;
    const list = isGlobal
      ? cumulGlobal.cuttingListGlobal
      : !("erreur" in calcul) && calcul.modulesGeneres
      ? calcul.modulesGeneres.cuttingList
      : [];
    if (list.length === 0) return;

    const lines = [
      isGlobal
        ? `BORDEREAU DE DÉBIT GLOBAL BNA — ${cumulGlobal.nbFacadesValides} FAÇADES (${cumulGlobal.surfaceTotaleM2.toFixed(2)} m²)`
        : `BORDEREAU DE DÉBIT BNA — ${activeFacade.nom} (${LABELS_FAMILLE[activeFacade.famille]})`,
      isGlobal
        ? `Total plaques brutes à commander : ${cumulGlobal.nbPlaquesTotales}`
        : !("erreur" in calcul) && calcul.cal
        ? `Plaques brutes (${calcul.cal.plaqueBruteLongueurMm}×${calcul.cal.plaqueBruteLargeurMm} mm) : ${calcul.cal.nbPlaquesNecessaires}`
        : "",
      ...list.map(
        (g) => `• ${g.group_number} : ${g.count} × ${g.width_mm} × ${g.height_mm} mm (${g.surface_m2.toFixed(2)} m²)`
      ),
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedDebit(true);
      setTimeout(() => setCopiedDebit(false), 2200);
    } catch {
      // ignorer
    }
  };

  const handleSaveBardage = async () => {
    if (cumulGlobal.besoinsGlobaux.length === 0) return;
    if (!chantierId) {
      setSaveErr("Sélectionne d'abord un chantier en haut de la fenêtre pour enregistrer les besoins.");
      return;
    }
    if (!entrepriseId) {
      setSaveErr("Connecte-toi à ton compte entreprise pour enregistrer sur le chantier.");
      return;
    }
    setIsSaving(true);
    setSaveErr(null);
    setSaveMsg(null);
    try {
      const res = await saveCalepinageBardage(supabase, {
        entrepriseId,
        chantierId,
        besoinsPayloads: cumulGlobal.besoinsGlobaux,
      });
      setSaveMsg(
        `Calepinage Façade V${res.calepinage.version} enregistré : ${cumulGlobal.nbFacadesValides} façade(s) (${cumulGlobal.surfaceTotaleM2.toFixed(2)} m²) · ${res.besoins.length} besoins matériaux générés.`
      );
      if (onSaved) onSaved();
    } catch (e: any) {
      setSaveErr(e?.message || "Erreur lors de l'enregistrement des besoins bardage.");
    } finally {
      setIsSaving(false);
    }
  };

  const field = "w-full px-2.5 py-2 text-xs bg-white border border-bna-border rounded-lg focus:outline-none focus:ring-1 focus:ring-bna-copper";
  const lbl = "text-[10px] font-bold uppercase tracking-wider text-bna-muted block mb-1";

  const afficherGlobal = porteeMetre === "global" && facades.length > 1;
  const besoinsAffiches = afficherGlobal
    ? cumulGlobal.besoinsGlobaux
    : !("erreur" in calcul)
    ? calcul.besoins
    : [];
  const cuttingListAffichee = afficherGlobal
    ? cumulGlobal.cuttingListGlobal
    : !("erreur" in calcul) && calcul.modulesGeneres
    ? calcul.modulesGeneres.cuttingList
    : [];

  return (
    <div className="mt-4 space-y-3 animate-in fade-in duration-100">
      <p className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
        Quantitatif indicatif (DTU 41.2) à vérifier selon le procédé, le support et les prescriptions du fabricant.
      </p>

      {/* BARRE MULTI-FAÇADES : SÉLECTION INDÉPENDANTE + AJOUT + RÉCAP GLOBAL */}
      <div className="p-2.5 bg-bna-offwhite border border-bna-border rounded-xl space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-bna-muted block">
              Façades du chantier ({facades.length})
            </span>
            <span className="text-[11px] font-semibold text-bna-anthracite">
              Cumul : <b>{cumulGlobal.surfaceTotaleM2.toFixed(2)} m²</b>
              {cumulGlobal.nbPlaquesTotales > 0 ? ` · ${cumulGlobal.nbPlaquesTotales} plaques` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddFacade}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-bna-copper text-white rounded-lg shadow-xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter une façade
          </button>
        </div>

        {/* Onglets des façades */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {facades.map((f, idx) => {
            const res = resultatsParFacade[idx];
            const isAct = f.id === activeFacade.id;
            const surf = res && !("erreur" in res) ? `${res.surfaceM2.toFixed(1)} m²` : "—";
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveId(f.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border shrink-0 transition-all flex items-center gap-1.5 ${
                  isAct
                    ? "bg-white text-bna-copper border-bna-copper shadow-2xs font-bold"
                    : "bg-neutral-100 text-bna-anthracite border-bna-border hover:bg-white"
                }`}
              >
                <span>{f.nom || `Façade ${idx + 1}`}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-bna-offwhite text-bna-muted">
                  {surf}
                </span>
              </button>
            );
          })}
        </div>

        {/* Nom de la façade active & suppression */}
        <div className="flex items-center gap-2 pt-1">
          <input
            className={field}
            placeholder="Nom de la façade (ex: Façade Nord, Pignon Est...)"
            value={activeFacade.nom}
            onChange={(e) => updateActive({ nom: e.target.value })}
          />
          {facades.length > 1 && (
            <button
              type="button"
              onClick={() => handleDeleteFacade(activeFacade.id)}
              className="p-2 text-red-600 bg-white hover:bg-red-50 border border-red-200 rounded-lg shrink-0 active:scale-95"
              title="Supprimer cette façade"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* FORMULAIRE DE LA FAÇADE SÉLECTIONNÉE */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="col-span-2">
          <label className={lbl}>Famille de bardage ({activeFacade.nom})</label>
          <select
            className={field}
            value={activeFacade.famille}
            onChange={(e) => updateActive({ famille: e.target.value as FamillePose })}
          >
            {(Object.keys(LABELS_FAMILLE) as FamillePose[]).map((k) => (
              <option key={k} value={k}>{LABELS_FAMILLE[k]}</option>
            ))}
          </select>
        </div>
        <div><label className={lbl}>Largeur façade (m)</label>
          <input className={field} inputMode="decimal" value={activeFacade.largeur} onChange={(e) => updateActive({ largeur: e.target.value })} /></div>
        <div><label className={lbl}>Hauteur mur (m)</label>
          <input className={field} inputMode="decimal" value={activeFacade.hauteur} onChange={(e) => updateActive({ hauteur: e.target.value })} /></div>
        <label className="col-span-2 flex items-center gap-2 text-xs font-semibold text-bna-anthracite">
          <input type="checkbox" checked={activeFacade.pignon} onChange={(e) => updateActive({ pignon: e.target.checked })} /> Pignon (rampants)
        </label>
        {activeFacade.pignon && (
          <div className="col-span-2"><label className={lbl}>Hauteur au faîtage (m)</label>
            <input className={field} inputMode="decimal" value={activeFacade.faite} onChange={(e) => updateActive({ faite: e.target.value })} /></div>
        )}
        {panneau && (
          <>
            <div><label className={lbl}>Module posé — larg. (mm)</label>
              <input className={field} inputMode="numeric" value={activeFacade.modL} onChange={(e) => updateActive({ modL: e.target.value })} /></div>
            <div><label className={lbl}>Module posé — haut. (mm)</label>
              <input className={field} inputMode="numeric" value={activeFacade.modH} onChange={(e) => updateActive({ modH: e.target.value })} /></div>
            <div><label className={lbl}>Plaque brute — long. (mm)</label>
              <input className={field} inputMode="numeric" value={activeFacade.plqL} onChange={(e) => updateActive({ plqL: e.target.value })} /></div>
            <div><label className={lbl}>Plaque brute — larg. (mm)</label>
              <input className={field} inputMode="numeric" value={activeFacade.plqH} onChange={(e) => updateActive({ plqH: e.target.value })} /></div>
            <div><label className={lbl}>Sens de pose</label>
              <select className={field} value={activeFacade.sens} onChange={(e) => updateActive({ sens: e.target.value as "horizontal" | "vertical" })}>
                <option value="horizontal">Horizontal</option><option value="vertical">Vertical</option>
              </select></div>
            <label className="flex items-end gap-2 text-[11px] font-semibold text-bna-anthracite pb-2">
              <input type="checkbox" checked={activeFacade.rotation} onChange={(e) => updateActive({ rotation: e.target.checked })} /> Pivot 90° autorisé (décor uni)
            </label>
          </>
        )}
        <div><label className={lbl}>Isolant ITE (mm, 0 = aucun)</label>
          <input className={field} inputMode="numeric" value={activeFacade.isolant} onChange={(e) => updateActive({ isolant: e.target.value })} /></div>
      </div>

      {"erreur" in calcul ? (
        <p className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {calcul.erreur}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-bna-offwhite rounded-xl border border-bna-border text-xs font-semibold">
            {([["plan", "Plan", Layers], ["debit", "Débit", Ruler], ["metre", "Métré & Cmd", Wrench]] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" onClick={() => setVue(k)}
                disabled={!calcul.cal && k !== "metre"}
                className={`py-2 rounded-lg flex items-center justify-center gap-1 disabled:opacity-40 ${vue === k ? "bg-white shadow-xs border border-bna-border text-bna-anthracite" : "text-bna-muted"}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {/* SÉLECTEUR DE PORTÉE : MÉTRÉ INDÉPENDANT DE LA FAÇADE vs CUMUL GLOBAL DE TOUTES LES FAÇADES */}
          {facades.length > 1 && (vue === "metre" || vue === "debit" || !calcul.cal) && (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-amber-50/80 border border-amber-200 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setPorteeMetre("facade")}
                className={`py-1.5 px-2 rounded-lg truncate transition-all ${
                  porteeMetre === "facade"
                    ? "bg-white text-bna-copper shadow-2xs border border-amber-300"
                    : "text-amber-900/70 hover:text-amber-950"
                }`}
              >
                Métré : {activeFacade.nom}
              </button>
              <button
                type="button"
                onClick={() => setPorteeMetre("global")}
                className={`py-1.5 px-2 rounded-lg truncate transition-all ${
                  porteeMetre === "global"
                    ? "bg-bna-copper text-white shadow-2xs"
                    : "text-amber-900/70 hover:text-amber-950"
                }`}
              >
                Cumul Global ({cumulGlobal.nbFacadesValides} façades)
              </button>
            </div>
          )}

          {calcul.cal?.piecesIncompatibles && (
            <p className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-800">
              <b>{calcul.cal.piecesIncompatibles.length} pièce(s) plus grandes que la plaque brute</b> (aucune orientation ne rentre) :
              choisis une plaque plus grande ou un module plus petit.
            </p>
          )}

          {vue === "plan" && calcul.cal && (
            <PleinEcran titre={`Plan de calepinage — ${activeFacade.nom}`}>
              {(zoom) => <PlanSvg r={calcul.cal!} chevrons={calcul.pose.positionsChevronsM} largeurM={calcul.L} zoom={zoom} />}
            </PleinEcran>
          )}
          {vue === "debit" && calcul.cal && (
            <div className="space-y-3">
              {cuttingListAffichee.length > 0 && (
                <div className="p-3 bg-bna-offwhite border border-bna-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-bna-muted">
                      {afficherGlobal
                        ? `Bordereau Global (${cumulGlobal.nbFacadesValides} façades · ${cuttingListAffichee.length} formats)`
                        : `Bordereau — ${activeFacade.nom} (${cuttingListAffichee.length} formats)`}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyBordereau}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-bna-copper hover:underline"
                    >
                      {copiedDebit ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedDebit ? "Copié !" : "Copier"}</span>
                    </button>
                  </div>
                  <div className="divide-y divide-bna-border/60 text-xs bg-white rounded-lg border border-bna-border overflow-hidden">
                    {cuttingListAffichee.map((g) => (
                      <div key={g.group_number} className="px-2.5 py-1.5 flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-[11px] text-bna-copper mr-2">{g.group_number}</span>
                          <span className="font-semibold text-bna-anthracite">
                            {g.width_mm} × {g.height_mm} mm
                          </span>
                        </div>
                        <div className="text-right">
                          <b className="text-bna-anthracite">{g.count} pce(s)</b>
                          <span className="text-[10px] text-bna-muted ml-1.5">({g.surface_m2.toFixed(2)} m²)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <PleinEcran titre={`Plan de débit des plaques — ${activeFacade.nom}`}>
                {(zoom) => <DebitSvg r={calcul.cal!} zoom={zoom} />}
              </PleinEcran>
            </div>
          )}
          {(vue === "metre" || !calcul.cal) && (
            <div className="space-y-3 text-xs">
              {afficherGlobal ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["Façades cumulées", `${cumulGlobal.nbFacadesValides} façade(s)`],
                      ["Surface totale", `${cumulGlobal.surfaceTotaleM2.toFixed(2)} m²`],
                      ["Pièces totales", `${cumulGlobal.nbPiecesTotales}`],
                      ["Plaques à commander", `${cumulGlobal.nbPlaquesTotales}`],
                      ["Chute nette moy.", `${cumulGlobal.tauxChuteGlobalPct.toFixed(1)} %`],
                      ["Chevrons 3m totaux", `${cumulGlobal.nbSegmentsChevronsTotal} barres (${cumulGlobal.mlChevronsTotal.toFixed(1)} ml)`],
                    ].map(([k, v]) => (
                      <div key={k} className="p-2 bg-amber-50/70 border border-amber-200 rounded-lg">
                        <span className="text-[9px] uppercase font-bold text-amber-900/70 block">{k}</span>
                        <b className="text-bna-anthracite">{v}</b>
                      </div>
                    ))}
                  </div>

                  {/* Détail façade par façade dans le cumul global */}
                  <div className="p-2.5 bg-white border border-bna-border rounded-xl space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-bna-muted block">
                      Détail par façade enregistrée
                    </span>
                    {cumulGlobal.valides.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-[11px] py-1 border-b last:border-b-0 border-bna-border/50">
                        <span className="font-semibold text-bna-anthracite">
                          {r.nom} ({r.L} × {r.Hm} m)
                        </span>
                        <span className="text-bna-muted">
                          <b>{r.surfaceM2.toFixed(2)} m²</b>
                          {r.cal ? ` · ${r.cal.nbPlaquesNecessaires} plq.` : ""} · {r.pose.nbSegmentsChevrons} chevrons
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : calcul.cal ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    [`Surface (${activeFacade.nom})`, `${calcul.cal.surfaceZoneM2.toFixed(2)} m²`],
                    ["Pièces posées", `${calcul.cal.nbPiecesPosees}`],
                    ["Plaques à commander", `${calcul.cal.nbPlaquesNecessaires}`],
                    ["Chute nette", `${calcul.cal.tauxChuteNettePct.toFixed(1)} %`],
                    ["Chutes réutilisables", `${calcul.cal.totalChutesReutilisablesM2.toFixed(2)} m²`],
                    ["Entraxe réel", `${Math.round(calcul.cal.entraxeReelMm)} mm`],
                  ].map(([k, v]) => (
                    <div key={k} className="p-2 bg-bna-offwhite border border-bna-border rounded-lg">
                      <span className="text-[9px] uppercase font-bold text-bna-muted block">{k}</span>
                      <b className="text-bna-anthracite">{v}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-2 bg-bna-offwhite border border-bna-border rounded-lg text-[11px] text-bna-muted">
                  Lames ({LABELS_FAMILLE[activeFacade.famille]}) : surface {calcul.surfaceM2.toFixed(2)} m² ; métré d&apos;ossature et de fixations ci-dessous.
                </p>
              )}

              {/* LISTE DES BESOINS MATÉRIAUX & QUINCAILLERIE (FAÇADE SEULE OU CUMUL GLOBAL) */}
              <div className="p-3 bg-bna-offwhite border border-bna-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-bna-muted flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-bna-copper" />
                    {afficherGlobal
                      ? `Besoins cumulés — ${cumulGlobal.nbFacadesValides} façades (${besoinsAffiches.length} postes)`
                      : `Besoins — ${activeFacade.nom} (${besoinsAffiches.length} postes)`}
                  </span>
                </div>
                <div className="divide-y divide-bna-border/60 bg-white rounded-lg border border-bna-border overflow-hidden">
                  {besoinsAffiches.map((b, idx) => (
                    <div key={idx} className="px-2.5 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-bna-copper block">
                          {b.categorie}
                        </span>
                        <span className="text-[11px] font-medium text-bna-anthracite block leading-snug">
                          {b.designation}
                        </span>
                      </div>
                      <span className="font-bold text-xs text-bna-anthracite shrink-0 bg-neutral-100 px-2 py-1 rounded-md border border-bna-border">
                        {b.quantite} {b.unite}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {!afficherGlobal && (
                <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside bg-neutral-50 p-3 rounded-xl border border-bna-border/80">
                  {calcul.pose.remarques.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              )}
            </div>
          )}

          {saveMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveMsg}</span>
            </div>
          )}
          {saveErr && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{saveErr}</span>
            </div>
          )}

          {/* ACTIONS LOT D : ENREGISTRER LES BESOINS GLOBAUX & OUVRIR COMMANDES FOURNISSEURS */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleSaveBardage}
              disabled={isSaving || !chantierId}
              className={`w-full min-h-[44px] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] ${
                isSaving || !chantierId
                  ? "bg-neutral-300 cursor-not-allowed"
                  : "bg-bna-copper hover:bg-bna-copper-hover shadow-copper"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSaving
                  ? "Enregistrement en cours..."
                  : chantierId
                  ? facades.length > 1
                    ? `Enregistrer les ${cumulGlobal.nbFacadesValides} façades & Générer les besoins globaux`
                    : "Enregistrer sur le chantier & Générer les besoins"
                  : "Choisis un chantier en haut pour enregistrer"}
              </span>
            </button>

            {chantierId && (
              <button
                type="button"
                onClick={() => setIsCommandesOpen(true)}
                className="w-full min-h-[40px] bg-white hover:bg-neutral-50 text-bna-anthracite border border-bna-border font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
              >
                <Truck className="w-4 h-4 text-bna-copper" />
                <span>Ouvrir Matériaux & Commandes Fournisseurs</span>
              </button>
            )}
          </div>

          {chantierId && (
            <MateriauxCommandesModal
              isOpen={isCommandesOpen}
              onClose={() => setIsCommandesOpen(false)}
              chantierId={chantierId}
            />
          )}
        </>
      )}
    </div>
  );
};
