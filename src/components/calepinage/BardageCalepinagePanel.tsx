"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Layers, Maximize2, Minimize2, Minus, Plus, RotateCw, Ruler, Wrench } from "lucide-react";
import { calculerCalepinage } from "@/lib/bardage/calepinageCalcul";
import type { PieceCalepinage, ResultatCalepinage } from "@/lib/bardage/calepinageCalcul";
import { calculerPose, LABELS_FAMILLE } from "@/lib/bardage/poseCalcul";
import type { FamillePose, ResultatPose } from "@/lib/bardage/poseCalcul";

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

export const BardageCalepinagePanel: React.FC = () => {
  const [famille, setFamille] = useState<FamillePose>("hpl");
  const [largeur, setLargeur] = useState("8,4");
  const [hauteur, setHauteur] = useState("3,2");
  const [pignon, setPignon] = useState(false);
  const [faite, setFaite] = useState("4,5");
  const [modL, setModL] = useState("1000");
  const [modH, setModH] = useState("600");
  const [plqL, setPlqL] = useState("3050");
  const [plqH, setPlqH] = useState("1300");
  const [sens, setSens] = useState<"horizontal" | "vertical">("horizontal");
  const [rotation, setRotation] = useState(false); // prudence : pas de pivot par défaut (sens de fibre/décor)
  const [isolant, setIsolant] = useState("120");
  const [vue, setVue] = useState<Vue>("plan");

  const panneau = famille === "hpl" || famille === "cassette";

  const calcul = useMemo(() => {
    const L = num(largeur);
    const Hm = num(hauteur);
    if (L <= 0 || Hm <= 0) return { erreur: "Renseigne largeur et hauteur de la façade." } as const;
    const hf = pignon ? num(faite) : Hm;
    if (pignon && hf <= Hm) return { erreur: "La hauteur au faîtage doit dépasser la hauteur du mur." } as const;
    try {
      const mL = num(modL, 1000);
      const mH = num(modH, 600);
      const cal = panneau
        ? calculerCalepinage({
            zoneLargeurM: L, zoneHauteurM: Hm,
            moduleLargeurMm: mL, moduleHauteurMm: mH,
            plaqueLongueurMm: num(plqL, 3050), plaqueLargeurMm: num(plqH, 1300),
            sensPose: sens, estPignon: pignon, hauteurFaiteM: pignon ? hf : null,
            autoriserRotation: rotation,
          })
        : null;
      const pose: ResultatPose = calculerPose(famille, L, pignon ? hf : Hm, false, 0, famille === "cassette" ? mL : 135, {
        moduleLargeurMm: mL, moduleHauteurMm: mH, sensPose: sens,
        epaisseurIsolantMm: num(isolant, 0),
        typeIsolant: num(isolant, 0) > 0 ? "laine_roche" : "sans_isolant",
      });
      return { cal, pose, L, Hm: pignon ? hf : Hm } as const;
    } catch (e) {
      return { erreur: e instanceof Error ? e.message : "Calcul impossible." } as const;
    }
  }, [famille, largeur, hauteur, pignon, faite, modL, modH, plqL, plqH, sens, rotation, isolant, panneau]);

  const field = "w-full px-2.5 py-2 text-xs bg-white border border-bna-border rounded-lg focus:outline-none focus:ring-1 focus:ring-bna-copper";
  const lbl = "text-[10px] font-bold uppercase tracking-wider text-bna-muted block mb-1";

  return (
    <div className="mt-4 space-y-3 animate-in fade-in duration-100">
      <p className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
        Quantitatif indicatif (DTU 41.2) à vérifier selon le procédé, le support et les prescriptions du fabricant.
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="col-span-2">
          <label className={lbl}>Famille de bardage</label>
          <select className={field} value={famille} onChange={(e) => setFamille(e.target.value as FamillePose)}>
            {(Object.keys(LABELS_FAMILLE) as FamillePose[]).map((k) => (
              <option key={k} value={k}>{LABELS_FAMILLE[k]}</option>
            ))}
          </select>
        </div>
        <div><label className={lbl}>Largeur façade (m)</label>
          <input className={field} inputMode="decimal" value={largeur} onChange={(e) => setLargeur(e.target.value)} /></div>
        <div><label className={lbl}>Hauteur mur (m)</label>
          <input className={field} inputMode="decimal" value={hauteur} onChange={(e) => setHauteur(e.target.value)} /></div>
        <label className="col-span-2 flex items-center gap-2 text-xs font-semibold text-bna-anthracite">
          <input type="checkbox" checked={pignon} onChange={(e) => setPignon(e.target.checked)} /> Pignon (rampants)
        </label>
        {pignon && (
          <div className="col-span-2"><label className={lbl}>Hauteur au faîtage (m)</label>
            <input className={field} inputMode="decimal" value={faite} onChange={(e) => setFaite(e.target.value)} /></div>
        )}
        {panneau && (
          <>
            <div><label className={lbl}>Module posé — larg. (mm)</label>
              <input className={field} inputMode="numeric" value={modL} onChange={(e) => setModL(e.target.value)} /></div>
            <div><label className={lbl}>Module posé — haut. (mm)</label>
              <input className={field} inputMode="numeric" value={modH} onChange={(e) => setModH(e.target.value)} /></div>
            <div><label className={lbl}>Plaque brute — long. (mm)</label>
              <input className={field} inputMode="numeric" value={plqL} onChange={(e) => setPlqL(e.target.value)} /></div>
            <div><label className={lbl}>Plaque brute — larg. (mm)</label>
              <input className={field} inputMode="numeric" value={plqH} onChange={(e) => setPlqH(e.target.value)} /></div>
            <div><label className={lbl}>Sens de pose</label>
              <select className={field} value={sens} onChange={(e) => setSens(e.target.value as "horizontal" | "vertical")}>
                <option value="horizontal">Horizontal</option><option value="vertical">Vertical</option>
              </select></div>
            <label className="flex items-end gap-2 text-[11px] font-semibold text-bna-anthracite pb-2">
              <input type="checkbox" checked={rotation} onChange={(e) => setRotation(e.target.checked)} /> Pivot 90° autorisé (décor uni)
            </label>
          </>
        )}
        <div><label className={lbl}>Isolant ITE (mm, 0 = aucun)</label>
          <input className={field} inputMode="numeric" value={isolant} onChange={(e) => setIsolant(e.target.value)} /></div>
      </div>

      {"erreur" in calcul ? (
        <p className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {calcul.erreur}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-bna-offwhite rounded-xl border border-bna-border text-xs font-semibold">
            {([["plan", "Plan", Layers], ["debit", "Débit", Ruler], ["metre", "Métré", Wrench]] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" onClick={() => setVue(k)}
                disabled={!calcul.cal && k !== "metre"}
                className={`py-2 rounded-lg flex items-center justify-center gap-1 disabled:opacity-40 ${vue === k ? "bg-white shadow-xs border border-bna-border text-bna-anthracite" : "text-bna-muted"}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {calcul.cal?.piecesIncompatibles && (
            <p className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-800">
              <b>{calcul.cal.piecesIncompatibles.length} pièce(s) plus grandes que la plaque brute</b> (aucune orientation ne rentre) :
              choisis une plaque plus grande ou un module plus petit.
            </p>
          )}

          {vue === "plan" && calcul.cal && (
            <PleinEcran titre="Plan de calepinage">
              {(zoom) => <PlanSvg r={calcul.cal!} chevrons={calcul.pose.positionsChevronsM} largeurM={calcul.L} zoom={zoom} />}
            </PleinEcran>
          )}
          {vue === "debit" && calcul.cal && (
            <PleinEcran titre="Plan de débit des plaques">
              {(zoom) => <DebitSvg r={calcul.cal!} zoom={zoom} />}
            </PleinEcran>
          )}
          {(vue === "metre" || !calcul.cal) && (
            <div className="space-y-2 text-xs">
              {calcul.cal ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Surface façade", `${calcul.cal.surfaceZoneM2.toFixed(2)} m²`],
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
                  Lames ({LABELS_FAMILLE[famille]}) : le plan de plaques ne s&apos;applique pas ; métré d&apos;ossature et de fixations ci-dessous.
                </p>
              )}
              <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside bg-neutral-50 p-3 rounded-xl border border-bna-border/80">
                {calcul.pose.remarques.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};
