"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Layers, Ruler, Wrench } from "lucide-react";
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

function PlanSvg({ r, chevrons, largeurM }: { r: ResultatCalepinage; chevrons: number[]; largeurM: number }) {
  const [sel, setSel] = useState<string | null>(null);
  const H = r.hauteurFaiteM || r.rangeesHauteursM.reduce((a, b) => a + b, 0);
  const W = largeurM;
  const pad = 0.15;
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
      <svg
        viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`}
        className="w-full rounded-xl bg-white border border-bna-border"
        style={{ maxHeight: "55vh" }}
        role="img"
        aria-label={`Plan de calepinage, ${r.nbPiecesPosees} pièces`}
      >
        {r.pieces.map((p) => (
          <g key={p.id} onClick={() => setSel(p.id === sel ? null : p.id)} className="cursor-pointer">
            <polygon
              points={toPts(p)}
              fill={p.id === sel ? "#C15C3D" : COULEUR[p.type]}
              stroke="#4B4B4B"
              strokeWidth={0.008}
            />
            {p.largeurM > 0.35 && p.hauteurM > 0.25 && (
              <text
                x={p.xM + p.largeurM / 2}
                y={H - (p.yM + p.hauteurM / 2)}
                fontSize={Math.min(0.12, p.largeurM / 5)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#2B2B2B"
              >
                {p.repere}
              </text>
            )}
          </g>
        ))}
        {chevrons.map((x, i) => (
          <line key={i} x1={x} x2={x} y1={0} y2={H} stroke="#2563eb" strokeWidth={0.006} strokeDasharray="0.05 0.04" opacity={0.55} />
        ))}
      </svg>
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

function DebitSvg({ r }: { r: ResultatCalepinage }) {
  return (
    <div className="space-y-3">
      {r.plaquesDebit.map((pl) => (
        <div key={pl.index} className="space-y-1">
          <p className="text-[11px] font-semibold text-bna-anthracite">
            Plaque {pl.index} · {pl.longueurMm}×{pl.largeurMm} mm · rendement {pl.tauxRendementPct.toFixed(0)} %
          </p>
          <svg viewBox={`0 0 ${pl.longueurMm} ${pl.largeurMm}`} className="w-full rounded-lg border border-bna-border bg-neutral-100">
            {pl.chutes.map((c) => (
              <rect key={c.id} x={c.xMm} y={c.yMm} width={c.largeurMm} height={c.hauteurMm}
                fill={c.reutilisable ? "#BBF7D0" : "#E5E5E5"} stroke="#9CA3AF" strokeWidth={4} />
            ))}
            {pl.pieces.map((p) => (
              <g key={`${p.id}-${p.xMm}-${p.yMm}`}>
                <rect x={p.xMm} y={p.yMm} width={p.largeurMm} height={p.hauteurMm} fill="#E7D9C9" stroke="#4B4B4B" strokeWidth={5} />
                {p.largeurMm > 200 && p.hauteurMm > 120 && (
                  <text x={p.xMm + p.largeurMm / 2} y={p.yMm + p.hauteurMm / 2} fontSize={Math.min(90, p.largeurMm / 4)}
                    textAnchor="middle" dominantBaseline="middle" fill="#2B2B2B">{p.repere}</text>
                )}
              </g>
            ))}
          </svg>
        </div>
      ))}
      <p className="text-[10px] text-bna-muted">Vert = chute réutilisable · gris = perte.</p>
    </div>
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
            <PlanSvg r={calcul.cal} chevrons={calcul.pose.positionsChevronsM} largeurM={calcul.L} />
          )}
          {vue === "debit" && calcul.cal && <DebitSvg r={calcul.cal} />}
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
