"use client";

import React, { useMemo, useRef, useState } from "react";
import { Box, Eye, Layers, RotateCcw } from "lucide-react";
import type { PieceCalepinage, ResultatCalepinage } from "@/lib/bardage/calepinageCalcul";
import type { FamillePose, ResultatPose } from "@/lib/bardage/poseCalcul";
import type { OuvertureCalculee } from "./BardageCalepinagePanel";

export interface Facade3DData {
  id: string;
  nom: string;
  famille: FamillePose;
  L: number;
  Hm: number;
  surfaceM2: number;
  cal: ResultatCalepinage | null;
  pose: ResultatPose;
  ouverturesCalculees: OuvertureCalculee[];
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Poly3D {
  id: string;
  pts: Point3D[];
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity?: number;
  label?: string;
  subLabel?: string;
  piece?: PieceCalepinage;
  facadeNom?: string;
  layerOrder: number;
}

const COULEUR_3D: Record<PieceCalepinage["type"], { front: string; side: string; top: string }> = {
  pleine: { front: "#E7D9C9", side: "#B8A593", top: "#F3EAE0" },
  coupe: { front: "#F3C9B5", side: "#C69B87", top: "#FAE0D3" },
  pignon: { front: "#F5E0A8", side: "#C7B27B", top: "#FBF0CE" },
};

/**
 * Construit les polygones 3D (mur porteur, isolant ITE, chevrons 3D, panneaux calepinés et ouvertures)
 * d'une façade dans son repère local (x: 0..L, y: 0..H, z: épaisseur vers l'extérieur),
 * puis applique une transformation locale -> monde pour le mode Bâtiment Multi-Façades.
 */
function buildFacadePolys(
  facade: Facade3DData,
  opts: {
    showMur: boolean;
    showIsolant: boolean;
    showChevrons: boolean;
    showPanneaux: boolean;
    showOuvertures: boolean;
    eclateFactor: number; // 0 = compact réel, 1 = éclaté DTU
    transform: (p: Point3D) => Point3D;
  }
): Poly3D[] {
  const polys: Poly3D[] = [];
  const W = facade.L;
  const H = facade.cal
    ? facade.cal.hauteurFaiteM || facade.cal.rangeesHauteursM.reduce((a, b) => a + b, 0)
    : facade.Hm;
  const hMur = facade.cal ? facade.cal.rangeesHauteursM.reduce((a, b) => a + b, 0) : facade.Hm;
  const estPignon = Boolean(facade.cal && facade.cal.hauteurFaiteM > hMur + 0.01);

  const gap = opts.eclateFactor * 0.42; // Décalage entre couches en mode vue éclatée DTU
  const zMurBack = -0.2;
  const zMurFront = 0;

  const hasIsolant = facade.pose.isolant.epaisseurMm > 0;
  const epIsolantM = Math.max(0.06, facade.pose.isolant.epaisseurMm / 1000);
  const zIsoBack = zMurFront + gap;
  const zIsoFront = zIsoBack + (hasIsolant ? epIsolantM : 0);

  const zChevBack = (hasIsolant ? zIsoFront : zMurFront) + gap;
  const zChevFront = zChevBack + 0.065;

  const zPanBack = zChevFront + gap * 1.15;
  const zPanFront = zPanBack + 0.025;

  const silhouettePts = (z: number): Point3D[] =>
    estPignon
      ? [
          { x: 0, y: 0, z },
          { x: W, y: 0, z },
          { x: W, y: hMur, z },
          { x: W / 2, y: H, z },
          { x: 0, y: hMur, z },
        ]
      : [
          { x: 0, y: 0, z },
          { x: W, y: 0, z },
          { x: W, y: H, z },
          { x: 0, y: H, z },
        ];

  const pushExtrudedPolygon = (
    baseId: string,
    pts2d: { x: number; y: number }[],
    z0: number,
    z1: number,
    colors: { front: string; side: string; top: string; stroke: string },
    layerOrder: number,
    meta?: { label?: string; subLabel?: string; piece?: PieceCalepinage; opacity?: number }
  ) => {
    // Face avant
    polys.push({
      id: `${baseId}-front`,
      pts: pts2d.map((p) => opts.transform({ x: p.x, y: p.y, z: z1 })),
      fill: colors.front,
      stroke: colors.stroke,
      strokeWidth: 0.9,
      opacity: meta?.opacity,
      label: meta?.label,
      subLabel: meta?.subLabel,
      piece: meta?.piece,
      facadeNom: facade.nom,
      layerOrder,
    });

    // Chants latéraux / supérieurs pour donner le volume 3D
    for (let i = 0; i < pts2d.length; i++) {
      const a = pts2d[i];
      const b = pts2d[(i + 1) % pts2d.length];
      const isTopEdge = b.y >= a.y && (a.y > 0 || b.y > 0);
      polys.push({
        id: `${baseId}-side-${i}`,
        pts: [
          opts.transform({ x: a.x, y: a.y, z: z0 }),
          opts.transform({ x: b.x, y: b.y, z: z0 }),
          opts.transform({ x: b.x, y: b.y, z: z1 }),
          opts.transform({ x: a.x, y: a.y, z: z1 }),
        ],
        fill: isTopEdge ? colors.top : colors.side,
        stroke: colors.stroke,
        strokeWidth: 0.6,
        opacity: meta?.opacity,
        layerOrder: layerOrder - 0.1,
      });
    }
  };

  // 1. Mur porteur béton/maçonnerie
  if (opts.showMur) {
    const wall2d = silhouettePts(0).map(({ x, y }) => ({ x, y }));
    pushExtrudedPolygon(
      `${facade.id}-mur`,
      wall2d,
      zMurBack,
      zMurFront,
      { front: "#CBD5E1", side: "#94A3B8", top: "#E2E8F0", stroke: "#64748B" },
      10
    );
  }

  // 2. Isolant ITE (laine de roche)
  if (opts.showIsolant && hasIsolant) {
    const iso2d = silhouettePts(0).map(({ x, y }) => ({ x, y }));
    pushExtrudedPolygon(
      `${facade.id}-iso`,
      iso2d,
      zIsoBack,
      zIsoFront,
      { front: "#FDE68A", side: "#D97706", top: "#FEF3C7", stroke: "#B45309" },
      20,
      { opacity: 0.92 }
    );
  }

  // 3. Chevrons d'ossature verticaux (calculés par calculerPose)
  if (opts.showChevrons) {
    const chevWidth = 0.055;
    facade.pose.positionsChevronsM.forEach((cx, idx) => {
      const x0 = Math.max(0, cx - chevWidth / 2);
      const x1 = Math.min(W, cx + chevWidth / 2);
      // Hauteur du chevron sous rampant si pignon
      const hAtX = estPignon
        ? hMur + (H - hMur) * (1 - Math.abs(cx - W / 2) / (W / 2 || 1))
        : H;
      const chev2d = [
        { x: x0, y: 0 },
        { x: x1, y: 0 },
        { x: x1, y: Math.max(0.2, hAtX) },
        { x: x0, y: Math.max(0.2, hAtX) },
      ];
      pushExtrudedPolygon(
        `${facade.id}-chev-${idx}`,
        chev2d,
        zChevBack,
        zChevFront,
        { front: "#60A5FA", side: "#1D4ED8", top: "#93C5FD", stroke: "#1E40AF" },
        30
      );
    });
  }

  // 4. Panneaux de bardage calepinés (issus de calculerCalepinage)
  if (opts.showPanneaux && facade.cal) {
    const joint = 0.008; // Joint visuel 8 mm entre panneaux en 3D
    facade.cal.pieces.forEach((p) => {
      const rawPts = p.points ?? [
        { xM: p.xM, yM: p.yM },
        { xM: p.xM + p.largeurM, yM: p.yM },
        { xM: p.xM + p.largeurM, yM: p.yM + p.hauteurM },
        { xM: p.xM, yM: p.yM + p.hauteurM },
      ];
      const cx = p.xM + p.largeurM / 2;
      const cy = p.yM + p.hauteurM / 2;
      const pts2d = rawPts.map((q) => ({
        x: q.xM + (q.xM < cx ? joint : -joint),
        y: q.yM + (q.yM < cy ? joint : -joint),
      }));
      const col = COULEUR_3D[p.type];
      pushExtrudedPolygon(
        `${facade.id}-piece-${p.id}`,
        pts2d,
        zPanBack,
        zPanFront,
        { ...col, stroke: "#334155" },
        40,
        {
          label: p.largeurM > 0.3 && p.hauteurM > 0.25 ? p.repere : undefined,
          subLabel:
            p.largeurM > 0.5 && p.hauteurM > 0.4
              ? `${Math.round(p.largeurM * 1000)}×${Math.round(p.hauteurM * 1000)}`
              : undefined,
          piece: p,
        }
      );
    });
  }

  // 5. Ouvertures (fenêtres / portes / baies vitrées)
  if (opts.showOuvertures && facade.ouverturesCalculees.length > 0) {
    const zOuvBack = zPanBack - 0.02;
    const zOuvFront = zPanFront + 0.02;
    facade.ouverturesCalculees.forEach((o) => {
      const ouv2d = [
        { x: o.xM, y: o.yM },
        { x: o.xM + o.largeurM, y: o.yM },
        { x: o.xM + o.largeurM, y: o.yM + o.hauteurM },
        { x: o.xM, y: o.yM + o.hauteurM },
      ];
      pushExtrudedPolygon(
        `${facade.id}-ouv-${o.id}`,
        ouv2d,
        zOuvBack,
        zOuvFront,
        {
          front: "rgba(186, 230, 253, 0.88)",
          side: "#0284C7",
          top: "#38BDF8",
          stroke: "#0369A1",
        },
        50,
        {
          label: o.nom,
          subLabel: `${Math.round(o.largeurM * 1000)}×${Math.round(o.hauteurM * 1000)}`,
        }
      );
    });
  }

  return polys;
}

export const BardagePlan3D: React.FC<{
  activeFacade: Facade3DData;
  allFacades: Facade3DData[];
  zoom?: number;
}> = ({ activeFacade, allFacades, zoom }) => {
  // Mode 3D : 'coupe' (façade active avec vue éclatée DTU) ou 'batiment' (assemblage 3D multi-façades)
  const [mode3D, setMode3D] = useState<"coupe" | "batiment">("coupe");
  // Angles caméra en degrés (yaw = rotation horizontale, pitch = inclinaison verticale)
  const [yawDeg, setYawDeg] = useState<number>(-28);
  const [pitchDeg, setPitchDeg] = useState<number>(16);
  // Facteur d'éclatement des couches DTU (0 = compact, 1 = éclaté)
  const [eclate, setEclate] = useState<boolean>(true);

  // Visibilité des couches
  const [showMur, setShowMur] = useState(true);
  const [showIsolant, setShowIsolant] = useState(true);
  const [showChevrons, setShowChevrons] = useState(true);
  const [showPanneaux, setShowPanneaux] = useState(true);
  const [showOuvertures, setShowOuvertures] = useState(true);

  const [selectedPiece, setSelectedPiece] = useState<{
    piece: PieceCalepinage;
    facadeNom: string;
  } | null>(null);

  const dragRef = useRef<{ startX: number; startY: number; startYaw: number; startPitch: number } | null>(
    null
  );

  // Construction des polygones 3D selon le mode choisi
  const scene3D = useMemo(() => {
    const eclateFactor = mode3D === "coupe" && eclate ? 1 : 0;

    if (mode3D === "coupe" || allFacades.length <= 1) {
      const W = activeFacade.L;
      const H = activeFacade.cal
        ? activeFacade.cal.hauteurFaiteM || activeFacade.cal.rangeesHauteursM.reduce((a, b) => a + b, 0)
        : activeFacade.Hm;
      const cx = W / 2;
      const cy = H / 2;
      const polys = buildFacadePolys(activeFacade, {
        showMur,
        showIsolant,
        showChevrons,
        showPanneaux,
        showOuvertures,
        eclateFactor,
        transform: (p) => ({ x: p.x - cx, y: p.y - cy, z: p.z }),
      });
      return { polys, span: Math.max(W, H, 4) };
    }

    // Mode Bâtiment Multi-Façades : dispose jusqu'à 4 façades autour du volume 3D
    const f0 = allFacades[0];
    const f1 = allFacades[1];
    const f2 = allFacades[2];
    const f3 = allFacades[3];

    const widthMain = f0.L;
    const depthMain = f1 ? f1.L : Math.max(4, f0.L * 0.65);
    const maxH = Math.max(...allFacades.map((f) => f.Hm), 3.2);
    const cy = maxH / 2;

    const allPolys: Poly3D[] = [];

    // Façade 1 : Avant (Sud, z = +depthMain/2)
    allPolys.push(
      ...buildFacadePolys(f0, {
        showMur,
        showIsolant,
        showChevrons,
        showPanneaux,
        showOuvertures,
        eclateFactor: 0,
        transform: (p) => ({
          x: p.x - widthMain / 2,
          y: p.y - cy,
          z: depthMain / 2 + p.z,
        }),
      })
    );

    // Façade 2 : Droite (Est, x = +widthMain/2)
    if (f1) {
      allPolys.push(
        ...buildFacadePolys(f1, {
          showMur,
          showIsolant,
          showChevrons,
          showPanneaux,
          showOuvertures,
          eclateFactor: 0,
          transform: (p) => ({
            x: widthMain / 2 + p.z,
            y: p.y - cy,
            z: depthMain / 2 - p.x,
          }),
        })
      );
    }

    // Façade 3 : Arrière (Nord, z = -depthMain/2)
    if (f2) {
      allPolys.push(
        ...buildFacadePolys(f2, {
          showMur,
          showIsolant,
          showChevrons,
          showPanneaux,
          showOuvertures,
          eclateFactor: 0,
          transform: (p) => ({
            x: widthMain / 2 - p.x,
            y: p.y - cy,
            z: -depthMain / 2 - p.z,
          }),
        })
      );
    }

    // Façade 4 : Gauche (Ouest, x = -widthMain/2)
    if (f3) {
      allPolys.push(
        ...buildFacadePolys(f3, {
          showMur,
          showIsolant,
          showChevrons,
          showPanneaux,
          showOuvertures,
          eclateFactor: 0,
          transform: (p) => ({
            x: -widthMain / 2 - p.z,
            y: p.y - cy,
            z: -depthMain / 2 + p.x,
          }),
        })
      );
    }

    return {
      polys: allPolys,
      span: Math.max(widthMain + depthMain, maxH * 1.5, 6),
    };
  }, [
    mode3D,
    eclate,
    activeFacade,
    allFacades,
    showMur,
    showIsolant,
    showChevrons,
    showPanneaux,
    showOuvertures,
  ]);

  // Projection 3D -> 2D SVG avec rotation caméra (yaw, pitch) et tri en profondeur (algorithme du peintre)
  const projected = useMemo(() => {
    const yaw = (yawDeg * Math.PI) / 180;
    const pitch = (pitchDeg * Math.PI) / 180;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    const camDist = scene3D.span * 2.6;

    const projectPt = (p: Point3D) => {
      // Rotation autour de Y (yaw)
      const x1 = p.x * cosY + p.z * sinY;
      const z1 = -p.x * sinY + p.z * cosY;
      // Rotation autour de X (pitch)
      const y2 = p.y * cosP - z1 * sinP;
      const z2 = p.y * sinP + z1 * cosP;

      // Légère perspective conique pour réalisme 3D
      const perspective = camDist / Math.max(1.5, camDist - z2);
      return {
        sx: x1 * perspective,
        sy: -y2 * perspective,
        depth: z2,
      };
    };

    const items = scene3D.polys.map((poly) => {
      const pPts = poly.pts.map(projectPt);
      const avgDepth = pPts.reduce((s, q) => s + q.depth, 0) / pPts.length;
      const cx = pPts.reduce((s, q) => s + q.sx, 0) / pPts.length;
      const cy = pPts.reduce((s, q) => s + q.sy, 0) / pPts.length;
      return {
        poly,
        pPts,
        pointsAttr: pPts.map((q) => `${q.sx.toFixed(3)},${q.sy.toFixed(3)}`).join(" "),
        avgDepth: avgDepth + poly.layerOrder * 0.002,
        cx,
        cy,
      };
    });

    items.sort((a, b) => a.avgDepth - b.avgDepth);

    // Calcul de la boîte englobante 2D projetée
    let minX = -3,
      maxX = 3,
      minY = -2,
      maxY = 2;
    if (items.length > 0) {
      minX = Infinity;
      maxX = -Infinity;
      minY = Infinity;
      maxY = -Infinity;
      for (const it of items) {
        for (const q of it.pPts) {
          if (q.sx < minX) minX = q.sx;
          if (q.sx > maxX) maxX = q.sx;
          if (q.sy < minY) minY = q.sy;
          if (q.sy > maxY) maxY = q.sy;
        }
      }
    }
    const pad = 0.65;
    return {
      items,
      viewBox: `${(minX - pad).toFixed(2)} ${(minY - pad).toFixed(2)} ${(
        maxX - minX + pad * 2
      ).toFixed(2)} ${(maxY - minY + pad * 2).toFixed(2)}`,
    };
  }, [scene3D, yawDeg, pitchDeg]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startYaw: yawDeg,
      startPitch: pitchDeg,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setYawDeg(Math.round(dragRef.current.startYaw + dx * 0.45));
    setPitchDeg(Math.max(-65, Math.min(75, Math.round(dragRef.current.startPitch + dy * 0.35))));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="space-y-2.5">
      {/* Barre d'outils 3D : Mode (Coupe Éclatée DTU vs Bâtiment Multi-Façades) + Angles Caméra */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-bna-offwhite border border-bna-border rounded-xl">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode3D("coupe")}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-all ${
              mode3D === "coupe"
                ? "bg-bna-copper text-white shadow-2xs"
                : "bg-white text-bna-anthracite border border-bna-border"
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Coupe 3D ({activeFacade.nom})
          </button>
          {allFacades.length > 1 && (
            <button
              type="button"
              onClick={() => setMode3D("batiment")}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-all ${
                mode3D === "batiment"
                  ? "bg-bna-copper text-white shadow-2xs"
                  : "bg-white text-bna-anthracite border border-bna-border"
              }`}
            >
              <Box className="w-3.5 h-3.5" /> Bâtiment 3D ({allFacades.length} façades)
            </button>
          )}
        </div>

        {/* Presets de caméra & bouton Éclaté DTU */}
        <div className="flex flex-wrap items-center gap-1">
          {mode3D === "coupe" && (
            <button
              type="button"
              onClick={() => setEclate((v) => !v)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                eclate
                  ? "bg-amber-100 border-amber-400 text-amber-950"
                  : "bg-white border-bna-border text-bna-anthracite"
              }`}
            >
              {eclate ? "Vue Éclatée DTU ✓" : "Vue Compacte"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setYawDeg(-28);
              setPitchDeg(16);
            }}
            className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white border border-bna-border text-bna-anthracite"
          >
            Iso G
          </button>
          <button
            type="button"
            onClick={() => {
              setYawDeg(32);
              setPitchDeg(18);
            }}
            className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white border border-bna-border text-bna-anthracite"
          >
            Iso D
          </button>
          <button
            type="button"
            onClick={() => {
              setYawDeg(0);
              setPitchDeg(0);
            }}
            className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white border border-bna-border text-bna-anthracite"
          >
            Face
          </button>
          <button
            type="button"
            onClick={() => {
              setYawDeg(-25);
              setPitchDeg(55);
            }}
            className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white border border-bna-border text-bna-anthracite"
          >
            Dessus
          </button>
          <button
            type="button"
            onClick={() => {
              setYawDeg(-28);
              setPitchDeg(16);
              setSelectedPiece(null);
            }}
            className="p-1 rounded-lg bg-white border border-bna-border text-bna-muted hover:text-bna-anthracite"
            title="Réinitialiser la vue 3D"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filtres de visibilité des couches DTU */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] px-1">
        <span className="text-[10px] font-bold uppercase text-bna-muted flex items-center gap-1">
          <Eye className="w-3 h-3 text-bna-copper" /> Couches 3D :
        </span>
        {[
          { label: "Mur support", state: showMur, set: setShowMur, dot: "#94A3B8" },
          { label: "Isolant ITE", state: showIsolant, set: setShowIsolant, dot: "#F59E0B" },
          { label: "Chevrons", state: showChevrons, set: setShowChevrons, dot: "#2563EB" },
          { label: "Panneaux", state: showPanneaux, set: setShowPanneaux, dot: "#C15C3D" },
          { label: "Ouvertures", state: showOuvertures, set: setShowOuvertures, dot: "#0284C7" },
        ].map((layer) => (
          <label
            key={layer.label}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-bna-border cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={layer.state}
              onChange={(e) => layer.set(e.target.checked)}
              className="accent-bna-copper"
            />
            <i className="w-2 h-2 rounded-full inline-block" style={{ background: layer.dot }} />
            <span className="font-semibold text-bna-anthracite">{layer.label}</span>
          </label>
        ))}
      </div>

      {/* Scène 3D interactive (glisser au doigt ou à la souris pour tourner à 360°) */}
      <div className={zoom ? "overflow-auto" : "overflow-x-auto"}>
        <svg
          viewBox={projected.viewBox}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="rounded-xl bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border border-bna-border block touch-none cursor-grab active:cursor-grabbing select-none"
          style={
            zoom
              ? { width: `${Math.round(zoom * 100)}%`, minWidth: `${Math.round(zoom * 640)}px`, maxWidth: "none" }
              : { width: "100%", minWidth: "460px", maxHeight: "62vh" }
          }
          role="img"
          aria-label="Maquette 3D interactive du bardage"
        >
          {projected.items.map(({ poly, pointsAttr, cx, cy }) => {
            const isSel =
              selectedPiece &&
              poly.piece &&
              selectedPiece.piece.id === poly.piece.id &&
              selectedPiece.facadeNom === poly.facadeNom;
            return (
              <g
                key={poly.id}
                onClick={(e) => {
                  if (poly.piece) {
                    e.stopPropagation();
                    setSelectedPiece(
                      isSel ? null : { piece: poly.piece, facadeNom: poly.facadeNom || activeFacade.nom }
                    );
                  }
                }}
                className={poly.piece ? "cursor-pointer" : undefined}
              >
                <polygon
                  points={pointsAttr}
                  fill={isSel ? "#C15C3D" : poly.fill}
                  stroke={isSel ? "#FFFFFF" : poly.stroke}
                  strokeWidth={isSel ? 0.022 : poly.strokeWidth * 0.012}
                  strokeLinejoin="round"
                  opacity={poly.opacity ?? 1}
                />
                {poly.label && (
                  <text
                    x={cx}
                    y={cy - (poly.subLabel ? 0.05 : 0)}
                    fontSize={0.11}
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isSel ? "#FFFFFF" : "#0F172A"}
                    style={{ pointerEvents: "none" }}
                  >
                    {poly.label}
                  </text>
                )}
                {poly.subLabel && (
                  <text
                    x={cx}
                    y={cy + 0.06}
                    fontSize={0.075}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isSel ? "#FDE68A" : "#334155"}
                    style={{ pointerEvents: "none" }}
                  >
                    {poly.subLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[10px] text-bna-muted px-1">
        <span>
          Glisse le doigt sur la maquette 3D pour tourner à 360° (Angle : {yawDeg}° / {pitchDeg}°)
        </span>
        <span>
          {mode3D === "coupe" && eclate
            ? "Coupe éclatée : Mur → Isolant ITE → Chevrons → Panneaux"
            : "Maquette 3D assemblée"}
        </span>
      </div>

      {selectedPiece && (
        <p className="text-[11px] bg-bna-offwhite border border-bna-border rounded-lg p-2">
          <b>{selectedPiece.facadeNom}</b> · Panneau <b>{selectedPiece.piece.repere}</b> ·{" "}
          {Math.round(selectedPiece.piece.largeurM * 1000)} ×{" "}
          {Math.round(selectedPiece.piece.hauteurM * 1000)} mm ·{" "}
          {selectedPiece.piece.surfaceM2.toFixed(2)} m² · Plaque brute n°
          {selectedPiece.piece.plaqueIndex ?? "—"}
        </p>
      )}
    </div>
  );
};
