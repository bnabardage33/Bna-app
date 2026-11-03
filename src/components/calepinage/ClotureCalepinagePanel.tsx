"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  Grid,
  Layers,
  Maximize2,
  Minimize2,
  Package,
  Ruler,
  Scissors,
  ShieldCheck,
  Sliders,
  Wrench,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  calculateFenceLayout,
  clampNumber,
  FENCE_CONSTANTS,
  FENCE_MATERIAL_PRESETS,
  SEGMENT_METADATA,
  type FenceConfig,
  type FenceEndsConfig,
  type FenceGroundType,
  type FenceMaterial,
  type FenceResult,
  type FenceShape,
  type PostExtremityType,
  type SegmentId,
  type SegmentResult,
} from "@/lib/cloture/calepinageCloture";

export interface ClotureCalepinagePanelProps {
  chantierId?: string;
  entrepriseId?: string;
  initialConfig?: Partial<FenceConfig>;
}

type ElevationViewMode = "GRILLE" | "GLOBAL" | SegmentId;

interface ShapeOption {
  id: FenceShape;
  title: string;
  subtitle: string;
  anglesBadge: string;
}

const SHAPE_OPTIONS: readonly ShapeOption[] = [
  {
    id: "DROITE",
    title: "1 Côté (En I)",
    subtitle: "Côté A uniquement",
    anglesBadge: "0 angle",
  },
  {
    id: "EN_L",
    title: "2 Côtés (En L)",
    subtitle: "Côtés A + B",
    anglesBadge: "1 angle 90°",
  },
  {
    id: "EN_U",
    title: "3 Côtés (En U)",
    subtitle: "Côtés A + B + C",
    anglesBadge: "2 angles 90°",
  },
  {
    id: "4_COTES",
    title: "4 Côtés (Complet)",
    subtitle: "Terrain A + B + C + D",
    anglesBadge: "4 angles 90°",
  },
];

interface EndsOption {
  id: FenceEndsConfig;
  label: string;
  description: string;
}

const ENDS_OPTIONS: readonly EndsOption[] = [
  {
    id: "LIBRE",
    label: "Libre / Boucle fermée autonome",
    description:
      "2 poteaux de terminaison (formes I/L/U) ou boucle fermée à 4 poteaux d'angle (forme 4 Côtés)",
  },
  {
    id: "DEPART_MUR",
    label: "Départ contre un mur existant (1 côté)",
    description: "1 demi-poteau mural au départ + 1 poteau de terminaison à la fin",
  },
  {
    id: "ENTRE_MURS",
    label: "Entre 2 murs (Départ ET arrivée contre façade)",
    description: "2 demi-poteaux muraux aux extrémités (0 poteau de bout standard)",
  },
];

const HAUTEUR_UTILE_PRESETS: readonly number[] = [1.2, 1.5, 1.8];

function formatMeters(val: number, decimals = 2): string {
  return `${val.toFixed(decimals)} m`;
}

function formatCm(valMeters: number, decimals = 1): string {
  return `${(valMeters * 100).toFixed(decimals)} cm`;
}

function formatMm(valMeters: number): string {
  return `${Math.round(valMeters * 1000)} mm`;
}

function parsePositiveFloat(raw: string, fallback: number): number {
  const normalized = raw.replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/**
 * VRAI PLAN DE CALEPINAGE 2D DES 4 CÔTÉS (Vue en Plan Architecturale Détaillée & Cotée)
 * Affiche le rectangle du terrain, tous les poteaux positionnés sur chaque face,
 * chaque travée numérotée (T1, T2...) et cotée, les lignes de cotes extérieures,
 * la boussole N/S/E/O et le cartouche récapitulatif central.
 */
const PlanCalepinage4Cotes2DSvg: React.FC<{
  result: FenceResult;
  selectedView: ElevationViewMode;
  onSelectSide: (side: SegmentId) => void;
}> = ({ result, selectedView, onSelectSide }) => {
  const { config, segmentsActifs, isClosedLoop } = result;

  const segMap = useMemo(() => {
    const map: Partial<Record<SegmentId, SegmentResult>> = {};
    for (const s of segmentsActifs) {
      map[s.id] = s;
    }
    return map;
  }, [segmentsActifs]);

  // Dimensions du rectangle en plan (viewBox 920 x 620)
  // Côté C = Haut (Nord) : de (leftX, topY) à (rightX, topY)
  // Côté B = Droite (Est) : de (rightX, topY) à (rightX, bottomY)
  // Côté A = Bas (Sud) : de (leftX, bottomY) à (rightX, bottomY)
  // Côté D = Gauche (Ouest) : de (leftX, topY) à (leftX, bottomY)
  const svgW = 920;
  const svgH = 620;

  // Proportion visuelle équilibrée selon les longueurs A/C (horizontal) et B/D (vertical)
  const horizRefM = Math.max(config.segments.A, config.segments.C, 4);
  const vertRefM = Math.max(config.segments.B, config.segments.D, 4);
  const ratioWH = clampNumber(horizRefM / vertRefM, 0.85, 1.85);

  const maxRectW = 540;
  const maxRectH = 330;
  let rectW = maxRectW;
  let rectH = Math.round(rectW / ratioWH);
  if (rectH > maxRectH) {
    rectH = maxRectH;
    rectW = Math.round(rectH * ratioWH);
  }
  rectW = Math.max(360, rectW);
  rectH = Math.max(230, rectH);

  const leftX = Math.round((svgW - rectW) / 2);
  const rightX = leftX + rectW;
  const topY = Math.round((svgH - rectH) / 2);
  const bottomY = topY + rectH;

  // Rendu d'un symbole de poteau en vue de dessus
  const renderPostNode = (
    key: string,
    x: number,
    y: number,
    kind: "ANGLE" | "INTER" | "TERMINAISON" | "DEMI_MURAL",
    labelBadge?: string
  ): React.ReactNode => {
    if (kind === "ANGLE") {
      return (
        <g key={key}>
          <circle cx={x} cy={y} r={12} fill="#F97316" fillOpacity={0.22} />
          <rect
            x={x - 7}
            y={y - 7}
            width={14}
            height={14}
            rx={2.5}
            fill="#F97316"
            stroke="#FFF7ED"
            strokeWidth={1.6}
          />
          {labelBadge && (
            <g>
              <rect
                x={x - 34}
                y={y < svgH / 2 ? y - 26 : y + 11}
                width={68}
                height={15}
                rx={4}
                fill="#431407"
                stroke="#F97316"
                strokeWidth={1}
              />
              <text
                x={x}
                y={y < svgH / 2 ? y - 16 : y + 21}
                textAnchor="middle"
                fill="#FFEDD5"
                fontSize="8.5"
                fontWeight="bold"
              >
                {labelBadge}
              </text>
            </g>
          )}
        </g>
      );
    }

    if (kind === "DEMI_MURAL") {
      return (
        <g key={key}>
          {/* Petit bloc mur hachuré adjacent */}
          <rect
            x={x - 14}
            y={y - 14}
            width={28}
            height={10}
            fill="url(#wallHatchPlan2D)"
            stroke="#94A3B8"
            strokeWidth={1}
          />
          <rect
            x={x - 6}
            y={y - 5}
            width={12}
            height={10}
            rx={2}
            fill="#0284C7"
            stroke="#E0F2FE"
            strokeWidth={1.4}
          />
          {labelBadge && (
            <text
              x={x}
              y={y + 18}
              textAnchor="middle"
              fill="#38BDF8"
              fontSize="8.5"
              fontWeight="bold"
            >
              {labelBadge}
            </text>
          )}
        </g>
      );
    }

    if (kind === "TERMINAISON") {
      return (
        <g key={key}>
          <rect
            x={x - 6}
            y={y - 6}
            width={12}
            height={12}
            rx={2}
            fill="#64748B"
            stroke="#F8FAFC"
            strokeWidth={1.4}
          />
        </g>
      );
    }

    // INTER (poteau intermédiaire)
    return (
      <rect
        key={key}
        x={x - 4.5}
        y={y - 4.5}
        width={9}
        height={9}
        rx={1.5}
        fill="#4B5563"
        stroke="#CBD5E1"
        strokeWidth={1.1}
      />
    );
  };

  // Fonction utilitaire pour dessiner un côté actif avec ses travées T1..Tn, ses poteaux et sa ligne de cote extérieure
  const renderHorizontalSide = (
    sideId: "A" | "C",
    seg: SegmentResult | undefined,
    yPos: number,
    isBottom: boolean
  ): React.ReactNode => {
    const meta = SEGMENT_METADATA[sideId];
    const isSelected = selectedView === sideId;

    if (!seg) {
      // Limite de terrain non clôturée (pointillés)
      return (
        <g key={`inactive-${sideId}`}>
          <line
            x1={leftX}
            y1={yPos}
            x2={rightX}
            y2={yPos}
            stroke="#334155"
            strokeWidth={2}
            strokeDasharray="6 6"
          />
          <text
            x={(leftX + rightX) / 2}
            y={isBottom ? yPos + 24 : yPos - 14}
            textAnchor="middle"
            fill="#475569"
            fontSize="10"
            fontStyle="italic"
          >
            {meta.fullLabel} — Non clôturé (Limite parcelle)
          </text>
        </g>
      );
    }

    const n = seg.nbTraveesSegment;
    const stepPx = rectW / n;
    const dimLineY = isBottom ? yPos + 64 : yPos - 64;
    const bayLabelY = isBottom ? yPos + 20 : yPos - 12;
    const subLabelY = isBottom ? yPos + 32 : yPos - 24;

    return (
      <g
        key={`active-${sideId}`}
        className="cursor-pointer"
        onClick={() => onSelectSide(sideId)}
      >
        {/* Halo de sélection */}
        {isSelected && (
          <line
            x1={leftX}
            y1={yPos}
            x2={rightX}
            y2={yPos}
            stroke={meta.accentHex}
            strokeWidth={14}
            strokeOpacity={0.2}
            strokeLinecap="round"
          />
        )}

        {/* Segment principal de clôture */}
        <line
          x1={leftX}
          y1={yPos}
          x2={rightX}
          y2={yPos}
          stroke={meta.accentHex}
          strokeWidth={isSelected ? 6 : 4.5}
        />

        {/* Travées T1, T2... et cotes d'entraxe sur le plan */}
        {Array.from({ length: n }).map((_, idx) => {
          // Pour Côté A (Bas) : de gauche à droite (T1 -> Tn)
          // Pour Côté C (Haut) : de droite à gauche ou gauche à droite (affiché de gauche à droite T1 -> Tn pour lecture naturelle)
          const xStart = leftX + idx * stepPx;
          const xCenter = xStart + stepPx / 2;
          const showDetailedEvery = n > 10 ? 2 : 1;

          return (
            <g key={`${sideId}-bay-${idx}`}>
              {/* Petits traits de séparation de travée */}
              <line
                x1={xStart}
                y1={yPos - 6}
                x2={xStart}
                y2={yPos + 6}
                stroke="#94A3B8"
                strokeWidth={0.8}
              />
              <text
                x={xCenter}
                y={bayLabelY}
                textAnchor="middle"
                fill="#F8FAFC"
                fontSize={n > 9 ? "8.5" : "9.5"}
                fontWeight="bold"
              >
                T{idx + 1}
              </text>
              {idx % showDetailedEvery === 0 && (
                <text
                  x={xCenter}
                  y={subLabelY}
                  textAnchor="middle"
                  fill="#CBD5E1"
                  fontSize="8"
                >
                  {seg.largeurTraveeAxe.toFixed(2)}m
                </text>
              )}
            </g>
          );
        })}

        {/* Poteaux intermédiaires du côté */}
        {Array.from({ length: seg.nbPoteauxIntermediaires }).map((_, pIdx) => {
          const px = leftX + (pIdx + 1) * stepPx;
          return renderPostNode(`${sideId}-inter-${pIdx}`, px, yPos, "INTER");
        })}

        {/* Ligne de cotation architecturale extérieure */}
        <line
          x1={leftX}
          y1={isBottom ? yPos + 38 : yPos - 38}
          x2={leftX}
          y2={dimLineY + (isBottom ? 6 : -6)}
          stroke={meta.accentHex}
          strokeWidth={1}
          strokeDasharray="2 2"
        />
        <line
          x1={rightX}
          y1={isBottom ? yPos + 38 : yPos - 38}
          x2={rightX}
          y2={dimLineY + (isBottom ? 6 : -6)}
          stroke={meta.accentHex}
          strokeWidth={1}
          strokeDasharray="2 2"
        />
        <line
          x1={leftX + 4}
          y1={dimLineY}
          x2={rightX - 4}
          y2={dimLineY}
          stroke={meta.accentHex}
          strokeWidth={1.5}
        />

        {/* Cartouche de cote sur la ligne architecturale */}
        <rect
          x={(leftX + rightX) / 2 - 155}
          y={dimLineY - 13}
          width={310}
          height={26}
          rx={6}
          fill="#0F172A"
          stroke={meta.accentHex}
          strokeWidth={1.4}
        />
        <text
          x={(leftX + rightX) / 2}
          y={dimLineY + 4}
          textAnchor="middle"
          fill="#F8FAFC"
          fontSize="10.5"
          fontWeight="bold"
        >
          {meta.fullLabel} : {seg.longueurSegment.toFixed(2)}m • {seg.nbTraveesSegment} travées • Coupe{" "}
          {(seg.longueurCoupeLame * 100).toFixed(1)}cm
        </text>
      </g>
    );
  };

  const renderVerticalSide = (
    sideId: "B" | "D",
    seg: SegmentResult | undefined,
    xPos: number,
    isRight: boolean
  ): React.ReactNode => {
    const meta = SEGMENT_METADATA[sideId];
    const isSelected = selectedView === sideId;

    if (!seg) {
      return (
        <g key={`inactive-${sideId}`}>
          <line
            x1={xPos}
            y1={topY}
            x2={xPos}
            y2={bottomY}
            stroke="#334155"
            strokeWidth={2}
            strokeDasharray="6 6"
          />
          <text
            x={isRight ? xPos + 22 : xPos - 22}
            y={(topY + bottomY) / 2}
            textAnchor="middle"
            fill="#475569"
            fontSize="10"
            fontStyle="italic"
            transform={`rotate(${isRight ? 90 : -90}, ${isRight ? xPos + 22 : xPos - 22}, ${(topY + bottomY) / 2})`}
          >
            {meta.shortLabel} — Non clôturé
          </text>
        </g>
      );
    }

    const n = seg.nbTraveesSegment;
    const stepPx = rectH / n;
    const dimLineX = isRight ? xPos + 96 : xPos - 96;

    return (
      <g
        key={`active-${sideId}`}
        className="cursor-pointer"
        onClick={() => onSelectSide(sideId)}
      >
        {isSelected && (
          <line
            x1={xPos}
            y1={topY}
            x2={xPos}
            y2={bottomY}
            stroke={meta.accentHex}
            strokeWidth={14}
            strokeOpacity={0.2}
            strokeLinecap="round"
          />
        )}

        <line
          x1={xPos}
          y1={topY}
          x2={xPos}
          y2={bottomY}
          stroke={meta.accentHex}
          strokeWidth={isSelected ? 6 : 4.5}
        />

        {/* Travées T1..Tn le long du côté vertical */}
        {Array.from({ length: n }).map((_, idx) => {
          // Pour Côté B (Droite) : du bas vers le haut (A -> B -> C)
          // Pour Côté D (Gauche) : du haut vers le bas (C -> D -> A)
          const yStart = isRight ? bottomY - (idx + 1) * stepPx : topY + idx * stepPx;
          const yCenter = yStart + stepPx / 2;
          const labelX = isRight ? xPos + 26 : xPos - 26;

          return (
            <g key={`${sideId}-bay-${idx}`}>
              <text
                x={labelX}
                y={yCenter - 2}
                textAnchor="middle"
                fill="#F8FAFC"
                fontSize={n > 7 ? "8.5" : "9.5"}
                fontWeight="bold"
              >
                T{idx + 1}
              </text>
              <text
                x={labelX}
                y={yCenter + 9}
                textAnchor="middle"
                fill="#CBD5E1"
                fontSize="8"
              >
                {seg.largeurTraveeAxe.toFixed(2)}m
              </text>
            </g>
          );
        })}

        {/* Poteaux intermédiaires du côté vertical */}
        {Array.from({ length: seg.nbPoteauxIntermediaires }).map((_, pIdx) => {
          const py = topY + (pIdx + 1) * stepPx;
          return renderPostNode(`${sideId}-inter-${pIdx}`, xPos, py, "INTER");
        })}

        {/* Ligne de cotation extérieure verticale */}
        <line
          x1={isRight ? xPos + 48 : xPos - 48}
          y1={topY}
          x2={dimLineX + (isRight ? 6 : -6)}
          y2={topY}
          stroke={meta.accentHex}
          strokeWidth={1}
          strokeDasharray="2 2"
        />
        <line
          x1={isRight ? xPos + 48 : xPos - 48}
          y1={bottomY}
          x2={dimLineX + (isRight ? 6 : -6)}
          y2={bottomY}
          stroke={meta.accentHex}
          strokeWidth={1}
          strokeDasharray="2 2"
        />
        <line
          x1={dimLineX}
          y1={topY + 4}
          x2={dimLineX}
          y2={bottomY - 4}
          stroke={meta.accentHex}
          strokeWidth={1.5}
        />

        {/* Cartouche vertical tourné */}
        <g
          transform={`translate(${dimLineX}, ${(topY + bottomY) / 2}) rotate(${
            isRight ? 90 : -90
          })`}
        >
          <rect
            x={-135}
            y={-13}
            width={270}
            height={26}
            rx={6}
            fill="#0F172A"
            stroke={meta.accentHex}
            strokeWidth={1.4}
          />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fill="#F8FAFC"
            fontSize="10"
            fontWeight="bold"
          >
            {meta.shortLabel} : {seg.longueurSegment.toFixed(2)}m ({seg.nbTraveesSegment} trav. • Coupe{" "}
            {(seg.longueurCoupeLame * 100).toFixed(1)}cm)
          </text>
        </g>
      </g>
    );
  };

  // Détermination des 4 sommets (coins du terrain) :
  // Coin Bas-Gauche (Début A / Fin D) : (leftX, bottomY)
  // Coin Bas-Droite (Fin A / Début B) : (rightX, bottomY)
  // Coin Haut-Droite (Fin B / Début C) : (rightX, topY)
  // Coin Haut-Gauche (Fin C / Début D) : (leftX, topY)
  const mapCornerType = (t: PostExtremityType): "ANGLE" | "TERMINAISON" | "DEMI_MURAL" => {
    if (t === "ANGLE") return "ANGLE";
    if (t === "DEMI_MURAL") return "DEMI_MURAL";
    return "TERMINAISON";
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-orange-400 shrink-0" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
              Plan de Calepinage 2D d&apos;Implantation (4 Côtés du Terrain)
            </h3>
            <p className="text-[11px] text-slate-400">
              Cliquez sur un côté (A, B, C ou D) pour inspecter son élévation • Tous les poteaux et travées (T1…Tn) sont représentés
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30">
            {config.forme === "4_COTES"
              ? isClosedLoop
                ? "Périmètre Fermé 4 Côtés • 4 Poteaux d'angle 90°"
                : `Périmètre 4 Côtés (${config.extremites}) • ${result.nbPoteauxAngle} Angles`
              : `${ segmentsActifs.length } Côté(s) actif(s) • ${result.nbPoteauxAngle} Angle(s) 90°`}
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-2">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full min-w-[680px] h-auto select-none block mx-auto"
          role="img"
          aria-label="Plan de calepinage 2D des 4 côtés du terrain"
        >
          <defs>
            <pattern
              id="wallHatchPlan2D"
              width="6"
              height="6"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="6" stroke="#38BDF8" strokeWidth="2" />
            </pattern>
            <pattern
              id="terrainGrid2D"
              width="30"
              height="30"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 30 0 L 0 0 0 30"
                fill="none"
                stroke="#1E293B"
                strokeWidth="0.7"
              />
            </pattern>
          </defs>

          {/* Grille architecturale de fond */}
          <rect x="0" y="0" width={svgW} height={svgH} fill="url(#terrainGrid2D)" />

          {/* Zone intérieure de la parcelle */}
          <rect
            x={leftX}
            y={topY}
            width={rectW}
            height={rectH}
            fill="#0F172A"
            fillOpacity="0.75"
          />

          {/* Boussole architecturale N / S / E / O en haut à gauche du terrain */}
          <g transform={`translate(${leftX + 52}, ${topY + 52})`}>
            <circle cx="0" cy="0" r="24" fill="#090D16" stroke="#334155" strokeWidth="1.2" />
            <polygon points="0,-18 -5,0 5,0" fill="#F97316" />
            <polygon points="0,18 -5,0 5,0" fill="#475569" />
            <text x="0" y="-27" textAnchor="middle" fill="#F97316" fontSize="9" fontWeight="bold">
              N
            </text>
            <text x="0" y="35" textAnchor="middle" fill="#64748B" fontSize="8" fontWeight="bold">
              S
            </text>
            <text x="31" y="3" textAnchor="middle" fill="#64748B" fontSize="8" fontWeight="bold">
              E
            </text>
            <text x="-31" y="3" textAnchor="middle" fill="#64748B" fontSize="8" fontWeight="bold">
              O
            </text>
          </g>

          {/* Cartouche récapitulatif central au milieu du terrain */}
          <g transform={`translate(${(leftX + rightX) / 2}, ${(topY + bottomY) / 2})`}>
            <rect
              x="-145"
              y="-56"
              width="290"
              height="112"
              rx="12"
              fill="#090D16"
              fillOpacity="0.92"
              stroke="#334155"
              strokeWidth="1.5"
            />
            <text
              x="0"
              y="-34"
              textAnchor="middle"
              fill="#F97316"
              fontSize="10.5"
              fontWeight="bold"
              letterSpacing="0.8"
            >
              SYNTHÈSE PARCELLE ({config.forme})
            </text>
            <text x="0" y="-14" textAnchor="middle" fill="#F8FAFC" fontSize="12" fontWeight="bold">
              Linéaire clôturé : {result.lineaireTotalM.toFixed(2)} m ({result.nbTraveesTotal} travées)
            </text>
            <text x="0" y="6" textAnchor="middle" fill="#CBD5E1" fontSize="10">
              Poteaux complets : {result.totalPoteauxComplets} u (dont {result.nbPoteauxAngle} angles 90°)
            </text>
            <text x="0" y="24" textAnchor="middle" fill="#38BDF8" fontSize="10">
              Demi-poteaux muraux : {result.nbDemiPoteauxMuraux} u • Hauteur : {config.hauteurUtile.toFixed(2)}m
            </text>
            <text x="0" y="42" textAnchor="middle" fill="#10B981" fontSize="10" fontWeight="bold">
              Commande : {result.nbTotalLames} lames {config.materiau} ({config.longueurLameBrute.toFixed(2)}m)
            </text>
          </g>

          {/* Rendu des 4 Côtés (C en haut, A en bas, D à gauche, B à droite) */}
          {renderHorizontalSide("C", segMap.C, topY, false)}
          {renderHorizontalSide("A", segMap.A, bottomY, true)}
          {renderVerticalSide("D", segMap.D, leftX, false)}
          {renderVerticalSide("B", segMap.B, rightX, true)}

          {/* Rendu des 4 Coins (sans doublon) */}
          {/* Coin Bas-Gauche : Départ Côté A (ou Jonction D -> A si boucle fermée) */}
          {segMap.A &&
            renderPostNode(
              "corner-BL",
              leftX,
              bottomY,
              mapCornerType(segMap.A.departType),
              segMap.A.departType === "ANGLE"
                ? "ANGLE 90° (D/A)"
                : segMap.A.departType === "DEMI_MURAL"
                ? "1/2 MURAL"
                : "DÉPART A"
            )}

          {/* Coin Bas-Droite : Fin Côté A / Début Côté B */}
          {segMap.A &&
            renderPostNode(
              "corner-BR",
              rightX,
              bottomY,
              mapCornerType(segMap.A.arriveeType),
              segMap.A.arriveeType === "ANGLE"
                ? "ANGLE 90° (A/B)"
                : segMap.A.arriveeType === "DEMI_MURAL"
                ? "1/2 MURAL"
                : "FIN A"
            )}

          {/* Coin Haut-Droite : Fin Côté B / Début Côté C */}
          {segMap.B &&
            renderPostNode(
              "corner-TR",
              rightX,
              topY,
              mapCornerType(segMap.B.arriveeType),
              segMap.B.arriveeType === "ANGLE"
                ? "ANGLE 90° (B/C)"
                : segMap.B.arriveeType === "DEMI_MURAL"
                ? "1/2 MURAL"
                : "FIN B"
            )}

          {/* Coin Haut-Gauche : Fin Côté C / Début Côté D */}
          {segMap.C &&
            renderPostNode(
              "corner-TL",
              leftX,
              topY,
              mapCornerType(segMap.C.arriveeType),
              segMap.C.arriveeType === "ANGLE"
                ? "ANGLE 90° (C/D)"
                : segMap.C.arriveeType === "DEMI_MURAL"
                ? "1/2 MURAL"
                : "FIN C"
            )}

          {/* Si 4_COTES mais non-LIBRE (ex: DEPART_MUR ou ENTRE_MURS), le coin fin D en bas-gauche */}
          {segMap.D && !isClosedLoop && (
            <g>
              {renderPostNode(
                "corner-D-end",
                leftX,
                bottomY - 22,
                mapCornerType(segMap.D.arriveeType),
                segMap.D.arriveeType === "DEMI_MURAL" ? "FIN D (MURAL)" : "FIN D"
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Légende du Plan d'implantation 2D */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 pt-1">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-orange-500 inline-block border border-orange-200" />
            Poteau d&apos;angle 90° ({result.nbPoteauxAngle} u)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#4B5563] inline-block border border-slate-300" />
            Poteau intermédiaire / bout ({result.nbPoteauxDroitsTotal} u)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-sky-500 inline-block border border-sky-200" />
            Demi-poteau mural ({result.nbDemiPoteauxMuraux} u)
          </span>
        </div>
        <span className="text-slate-400">
          Astuce : cliquez sur <strong>Côté A, B, C ou D</strong> sur le plan pour isoler sa vue de face
        </span>
      </div>
    </div>
  );
};

/**
 * Plan d'Élévation 2D (Vue de face d'un segment ou de tous les segments dépliés)
 * Optimisé mobile avec scroll horizontal fluide (`overflow-x-auto`) et `minWidth` dynamique.
 */
const ElevationPlan2DSvg: React.FC<{
  result: FenceResult;
  segmentsToRender: SegmentResult[];
  zoom: number;
  compactHeader?: boolean;
}> = ({ result, segmentsToRender, zoom, compactHeader = false }) => {
  const [hoveredBayKey, setHoveredBayKey] = useState<string | null>(null);
  const { config } = result;
  const preset = FENCE_MATERIAL_PRESETS[config.materiau];

  const PX_PER_M = 95;
  const postWidthPx = Math.max(8, FENCE_CONSTANTS.SECTION_POTEAU_M * PX_PER_M);
  const halfPostWidthPx = Math.max(5, postWidthPx * 0.55);
  const wallWidthPx = 30;

  const displayedLengthM = segmentsToRender.reduce((acc, s) => acc + s.longueurSegment, 0);
  const totalDisplayedBays = segmentsToRender.reduce((acc, s) => acc + s.nbTraveesSegment, 0);
  const fenceHeightPx = config.hauteurUtile * PX_PER_M;
  const foundationDepthM = config.typePoseSol === "DIRECT_SOL" ? 0.5 : 0.35;
  const foundationDepthPx = foundationDepthM * PX_PER_M;

  const marginLeft = 78;
  const marginRight = 78;
  const marginTop = 80;
  const marginBottom = 70;

  const drawingWidthPx = Math.max(320, displayedLengthM * PX_PER_M);
  const svgWidth = marginLeft + drawingWidthPx + marginRight;
  const groundY = marginTop + fenceHeightPx;
  const svgHeight = groundY + foundationDepthPx + marginBottom;

  // Largeur minimale garantie pour que les textes de cotation ne soient jamais écrasés sur mobile
  const minWidthPx = Math.max(580, totalDisplayedBays * 135);

  const hasLeftWall =
    segmentsToRender.length > 0 && segmentsToRender[0].departType === "DEMI_MURAL";
  const hasRightWall =
    segmentsToRender.length > 0 &&
    segmentsToRender[segmentsToRender.length - 1].arriveeType === "DEMI_MURAL";

  let cursorX = marginLeft;
  const segmentLayouts = segmentsToRender.map((seg, segIdx) => {
    const segStartPx = cursorX;
    const segWidthPx = seg.longueurSegment * PX_PER_M;
    const bayWidthPx = segWidthPx / seg.nbTraveesSegment;
    cursorX += segWidthPx;
    return {
      seg,
      segIdx,
      segStartPx,
      segEndPx: segStartPx + segWidthPx,
      segWidthPx,
      bayWidthPx,
    };
  });

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-2">
      {compactHeader && segmentsToRender.length === 1 && (
        <div className="flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-slate-800/80 text-xs">
          <span
            className="font-extrabold"
            style={{ color: segmentsToRender[0].accentHex }}
          >
            {segmentsToRender[0].fullLabel} — {segmentsToRender[0].longueurSegment.toFixed(2)} m
          </span>
          <span className="text-[11px] text-slate-300 font-semibold">
            {segmentsToRender[0].nbTraveesSegment} travées • Entraxe{" "}
            {segmentsToRender[0].largeurTraveeAxe.toFixed(2)}m • Coupe{" "}
            {(segmentsToRender[0].longueurCoupeLame * 100).toFixed(1)} cm
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{
          width: `${Math.max(100, Math.round(zoom * 100))}%`,
          minWidth: `${minWidthPx}px`,
          height: "auto",
        }}
        className="select-none block mx-auto"
        role="img"
        aria-label="Plan d'élévation 2D de la clôture"
      >
        <defs>
          <pattern
            id="wallHatchElev4"
            width="8"
            height="8"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke="#64748B" strokeWidth="2.2" />
          </pattern>
          <pattern
            id="muretConcretePattern4"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <rect width="16" height="16" fill="#334155" />
            <circle cx="4" cy="4" r="1" fill="#64748B" />
            <circle cx="12" cy="10" r="1.2" fill="#475569" />
            <path d="M 0 16 L 16 16" stroke="#1E293B" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Fond élévation */}
        <rect x="0" y="0" width={svgWidth} height={groundY} fill="#090D16" />

        {/* Fond sous-sol */}
        <rect
          x="0"
          y={groundY}
          width={svgWidth}
          height={svgHeight - groundY}
          fill="#0F172A"
        />

        {/* Muret béton si SUR_MURET */}
        {config.typePoseSol === "SUR_MURET" && (
          <g>
            <rect
              x={marginLeft - (hasLeftWall ? wallWidthPx : 16)}
              y={groundY}
              width={
                drawingWidthPx +
                (hasLeftWall ? wallWidthPx : 16) +
                (hasRightWall ? wallWidthPx : 16)
              }
              height={foundationDepthPx}
              fill="url(#muretConcretePattern4)"
              stroke="#64748B"
              strokeWidth="1.5"
            />
            <text
              x={marginLeft + drawingWidthPx / 2}
              y={groundY + foundationDepthPx / 2 + 4}
              textAnchor="middle"
              fill="#CBD5E1"
              fontSize="10"
              fontWeight="bold"
              letterSpacing="1"
            >
              MURET BÉTON EXISTANT (POSE SUR PLATINES + GARDE +2 CM)
            </text>
          </g>
        )}

        {/* Mur maçonné hachuré à gauche */}
        {hasLeftWall && (
          <g>
            <rect
              x={marginLeft - wallWidthPx}
              y={marginTop - 10}
              width={wallWidthPx}
              height={fenceHeightPx + 10}
              fill="url(#wallHatchElev4)"
              stroke="#94A3B8"
              strokeWidth="1.5"
            />
            <text
              x={marginLeft - wallWidthPx / 2}
              y={marginTop - 16}
              textAnchor="middle"
              fill="#38BDF8"
              fontSize="9"
              fontWeight="bold"
            >
              MUR
            </text>
          </g>
        )}

        {/* Mur maçonné hachuré à droite */}
        {hasRightWall && (
          <g>
            <rect
              x={marginLeft + drawingWidthPx}
              y={marginTop - 10}
              width={wallWidthPx}
              height={fenceHeightPx + 10}
              fill="url(#wallHatchElev4)"
              stroke="#94A3B8"
              strokeWidth="1.5"
            />
            <text
              x={marginLeft + drawingWidthPx + wallWidthPx / 2}
              y={marginTop - 16}
              textAnchor="middle"
              fill="#38BDF8"
              fontSize="9"
              fontWeight="bold"
            >
              MUR
            </text>
          </g>
        )}

        {/* Rendu de chaque segment */}
        {segmentLayouts.map(({ seg, segIdx, segStartPx, segEndPx, segWidthPx, bayWidthPx }) => {
          const bladeHeightPx = fenceHeightPx / seg.nbLamesParTravee;

          return (
            <g key={seg.id}>
              {/* Bandeau supérieur du Côté */}
              <g>
                <rect
                  x={segStartPx + 4}
                  y={10}
                  width={Math.max(130, segWidthPx - 8)}
                  height={24}
                  rx="6"
                  fill="#1E293B"
                  stroke={seg.accentHex}
                  strokeWidth="1.3"
                />
                <text
                  x={segStartPx + segWidthPx / 2}
                  y={26}
                  textAnchor="middle"
                  fill="#F8FAFC"
                  fontSize="11"
                  fontWeight="bold"
                >
                  {seg.fullLabel} — {seg.longueurSegment.toFixed(2)} m ({seg.nbTraveesSegment} travées)
                </text>
              </g>

              {/* Travées & Lames */}
              {Array.from({ length: seg.nbTraveesSegment }).map((_, bayIdx) => {
                const bayX = segStartPx + bayIdx * bayWidthPx;
                const bayKey = `${seg.id}-${bayIdx}`;
                const isHovered = hoveredBayKey === bayKey;

                return (
                  <g
                    key={bayKey}
                    onMouseEnter={() => setHoveredBayKey(bayKey)}
                    onMouseLeave={() => setHoveredBayKey(null)}
                    className="cursor-pointer"
                  >
                    {/* Lames empilées */}
                    {Array.from({ length: seg.nbLamesParTravee }).map((__, bladeIdx) => {
                      const bladeY = marginTop + bladeIdx * bladeHeightPx;
                      return (
                        <rect
                          key={`${bayKey}-blade-${bladeIdx}`}
                          x={bayX + postWidthPx / 2 - 2}
                          y={bladeY + 0.6}
                          width={Math.max(10, bayWidthPx - postWidthPx + 4)}
                          height={Math.max(2, bladeHeightPx - 1.2)}
                          fill={preset.colorHex}
                          stroke={isHovered ? "#F97316" : preset.strokeHex}
                          strokeWidth={isHovered ? "1.2" : "0.7"}
                        />
                      );
                    })}

                    {/* Numéro de travée T1, T2... en haut de chaque travée */}
                    <text
                      x={bayX + bayWidthPx / 2}
                      y={marginTop - 12}
                      textAnchor="middle"
                      fill="#FDBA74"
                      fontSize="9.5"
                      fontWeight="bold"
                    >
                      T{bayIdx + 1} ({seg.largeurTraveeAxe.toFixed(2)}m)
                    </text>

                    {/* Cartouche cote de coupe sur la 1ère travée ou la travée survolée */}
                    {(bayIdx === 0 || isHovered) && (
                      <g>
                        <rect
                          x={bayX + bayWidthPx / 2 - 58}
                          y={marginTop + fenceHeightPx / 2 - 18}
                          width="116"
                          height="34"
                          rx="6"
                          fill="#0F172A"
                          fillOpacity="0.92"
                          stroke="#F97316"
                          strokeWidth="1"
                        />
                        <text
                          x={bayX + bayWidthPx / 2}
                          y={marginTop + fenceHeightPx / 2 - 4}
                          textAnchor="middle"
                          fill="#F8FAFC"
                          fontSize="9.5"
                          fontWeight="bold"
                        >
                          Coupe : {(seg.longueurCoupeLame * 100).toFixed(1)} cm
                        </text>
                        <text
                          x={bayX + bayWidthPx / 2}
                          y={marginTop + fenceHeightPx / 2 + 9}
                          textAnchor="middle"
                          fill="#FB923C"
                          fontSize="8"
                        >
                          (-1cm dilatation incl.)
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Poteaux intermédiaires */}
              {Array.from({ length: seg.nbPoteauxIntermediaires }).map((_, pIdx) => {
                const postCenterX = segStartPx + (pIdx + 1) * bayWidthPx;
                return (
                  <g key={`${seg.id}-inter-${pIdx}`}>
                    {config.typePoseSol === "DIRECT_SOL" ? (
                      <g>
                        <rect
                          x={postCenterX - postWidthPx * 1.3}
                          y={groundY}
                          width={postWidthPx * 2.6}
                          height={foundationDepthPx}
                          fill="#1E293B"
                          fillOpacity="0.7"
                          stroke="#94A3B8"
                          strokeWidth="1.2"
                          strokeDasharray="4 3"
                        />
                        <rect
                          x={postCenterX - postWidthPx / 2}
                          y={groundY}
                          width={postWidthPx}
                          height={foundationDepthPx - 4}
                          fill="#4B5563"
                          fillOpacity="0.6"
                          stroke="#CBD5E1"
                          strokeWidth="0.9"
                          strokeDasharray="3 2"
                        />
                      </g>
                    ) : (
                      <rect
                        x={postCenterX - postWidthPx * 1.2}
                        y={groundY - 5}
                        width={postWidthPx * 2.4}
                        height={6}
                        rx="1"
                        fill="#E2E8F0"
                        stroke="#0F172A"
                        strokeWidth="1"
                      />
                    )}

                    <rect
                      x={postCenterX - postWidthPx / 2}
                      y={marginTop - 4}
                      width={postWidthPx}
                      height={fenceHeightPx + 4}
                      rx="1.5"
                      fill="#4B5563"
                      stroke="#1F2937"
                      strokeWidth="1.2"
                    />
                  </g>
                );
              })}

              {/* Poteau de DÉPART (1er segment affiché) */}
              {segIdx === 0 && (
                <g>
                  {seg.departType === "DEMI_MURAL" ? (
                    <g>
                      <rect
                        x={segStartPx}
                        y={marginTop - 2}
                        width={halfPostWidthPx}
                        height={fenceHeightPx + 2}
                        fill="#0284C7"
                        stroke="#38BDF8"
                        strokeWidth="1.2"
                      />
                      <rect
                        x={segStartPx - 4}
                        y={marginTop - 42}
                        width="86"
                        height="18"
                        rx="4"
                        fill="#0C4A6E"
                        stroke="#38BDF8"
                        strokeWidth="1"
                      />
                      <text
                        x={segStartPx + 39}
                        y={marginTop - 30}
                        textAnchor="middle"
                        fill="#E0F2FE"
                        fontSize="8.5"
                        fontWeight="bold"
                      >
                        1/2 POTEAU MURAL
                      </text>
                    </g>
                  ) : seg.departType === "ANGLE" ? (
                    <g>
                      {config.typePoseSol === "DIRECT_SOL" ? (
                        <rect
                          x={segStartPx - postWidthPx * 1.4}
                          y={groundY}
                          width={postWidthPx * 2.8}
                          height={foundationDepthPx}
                          fill="#431407"
                          fillOpacity="0.6"
                          stroke="#F97316"
                          strokeWidth="1.3"
                          strokeDasharray="4 3"
                        />
                      ) : (
                        <rect
                          x={segStartPx - postWidthPx * 1.3}
                          y={groundY - 5}
                          width={postWidthPx * 2.6}
                          height={6}
                          fill="#FDBA74"
                          stroke="#0F172A"
                          strokeWidth="1"
                        />
                      )}
                      <rect
                        x={segStartPx - postWidthPx / 2}
                        y={marginTop - 6}
                        width={postWidthPx + 2}
                        height={fenceHeightPx + 6}
                        rx="2"
                        fill="#D97732"
                        stroke="#FDBA74"
                        strokeWidth="1.4"
                      />
                      <rect
                        x={segStartPx - 36}
                        y={marginTop - 42}
                        width="72"
                        height="18"
                        rx="4"
                        fill="#7C2D12"
                        stroke="#F97316"
                        strokeWidth="1.2"
                      />
                      <text
                        x={segStartPx}
                        y={marginTop - 30}
                        textAnchor="middle"
                        fill="#FFEDD5"
                        fontSize="8.5"
                        fontWeight="bold"
                      >
                        ANGLE 90°
                      </text>
                    </g>
                  ) : (
                    <g>
                      {config.typePoseSol === "DIRECT_SOL" ? (
                        <rect
                          x={segStartPx - postWidthPx * 1.3}
                          y={groundY}
                          width={postWidthPx * 2.6}
                          height={foundationDepthPx}
                          fill="#1E293B"
                          stroke="#94A3B8"
                          strokeWidth="1.2"
                          strokeDasharray="4 3"
                        />
                      ) : (
                        <rect
                          x={segStartPx - postWidthPx * 1.2}
                          y={groundY - 5}
                          width={postWidthPx * 2.4}
                          height={6}
                          fill="#E2E8F0"
                          stroke="#0F172A"
                          strokeWidth="1"
                        />
                      )}
                      <rect
                        x={segStartPx - postWidthPx / 2}
                        y={marginTop - 4}
                        width={postWidthPx}
                        height={fenceHeightPx + 4}
                        rx="1.5"
                        fill="#4B5563"
                        stroke="#CBD5E1"
                        strokeWidth="1.2"
                      />
                    </g>
                  )}
                </g>
              )}

              {/* Poteau d'ARRIVÉE du segment */}
              <g>
                {seg.arriveeType === "ANGLE" ? (
                  <g>
                    {config.typePoseSol === "DIRECT_SOL" ? (
                      <rect
                        x={segEndPx - postWidthPx * 1.4}
                        y={groundY}
                        width={postWidthPx * 2.8}
                        height={foundationDepthPx}
                        fill="#431407"
                        fillOpacity="0.6"
                        stroke="#F97316"
                        strokeWidth="1.3"
                        strokeDasharray="4 3"
                      />
                    ) : (
                      <rect
                        x={segEndPx - postWidthPx * 1.3}
                        y={groundY - 5}
                        width={postWidthPx * 2.6}
                        height={6}
                        fill="#FDBA74"
                        stroke="#0F172A"
                        strokeWidth="1"
                      />
                    )}
                    <rect
                      x={segEndPx - (postWidthPx + 2) / 2}
                      y={marginTop - 6}
                      width={postWidthPx + 2}
                      height={fenceHeightPx + 6}
                      rx="2"
                      fill="#D97732"
                      stroke="#FDBA74"
                      strokeWidth="1.5"
                    />
                    <rect
                      x={segEndPx - 38}
                      y={marginTop - 42}
                      width="76"
                      height="18"
                      rx="4"
                      fill="#7C2D12"
                      stroke="#F97316"
                      strokeWidth="1.2"
                    />
                    <text
                      x={segEndPx}
                      y={marginTop - 30}
                      textAnchor="middle"
                      fill="#FFEDD5"
                      fontSize="8.5"
                      fontWeight="bold"
                    >
                      ANGLE 90°
                    </text>
                  </g>
                ) : seg.arriveeType === "DEMI_MURAL" ? (
                  <g>
                    <rect
                      x={segEndPx - halfPostWidthPx}
                      y={marginTop - 2}
                      width={halfPostWidthPx}
                      height={fenceHeightPx + 2}
                      fill="#0284C7"
                      stroke="#38BDF8"
                      strokeWidth="1.2"
                    />
                    <rect
                      x={segEndPx - 82}
                      y={marginTop - 42}
                      width="86"
                      height="18"
                      rx="4"
                      fill="#0C4A6E"
                      stroke="#38BDF8"
                      strokeWidth="1"
                    />
                    <text
                      x={segEndPx - 39}
                      y={marginTop - 30}
                      textAnchor="middle"
                      fill="#E0F2FE"
                      fontSize="8.5"
                      fontWeight="bold"
                    >
                      1/2 POTEAU MURAL
                    </text>
                  </g>
                ) : (
                  <g>
                    {config.typePoseSol === "DIRECT_SOL" ? (
                      <rect
                        x={segEndPx - postWidthPx * 1.3}
                        y={groundY}
                        width={postWidthPx * 2.6}
                        height={foundationDepthPx}
                        fill="#1E293B"
                        stroke="#94A3B8"
                        strokeWidth="1.2"
                        strokeDasharray="4 3"
                      />
                    ) : (
                      <rect
                        x={segEndPx - postWidthPx * 1.2}
                        y={groundY - 5}
                        width={postWidthPx * 2.4}
                        height={6}
                        fill="#E2E8F0"
                        stroke="#0F172A"
                        strokeWidth="1"
                      />
                    )}
                    <rect
                      x={segEndPx - postWidthPx / 2}
                      y={marginTop - 4}
                      width={postWidthPx}
                      height={fenceHeightPx + 4}
                      rx="1.5"
                      fill="#4B5563"
                      stroke="#CBD5E1"
                      strokeWidth="1.2"
                    />
                  </g>
                )}
              </g>
            </g>
          );
        })}

        {/* Ligne de sol finie */}
        <line
          x1="15"
          y1={groundY}
          x2={svgWidth - 15}
          y2={groundY}
          stroke="#10B981"
          strokeWidth="2"
        />
        <text x="20" y={groundY - 6} fill="#10B981" fontSize="9" fontWeight="bold">
          NIVEAU SOL FINI (±0.00)
        </text>

        {/* Cotation verticale Hauteur utile */}
        <g>
          <line
            x1="24"
            y1={marginTop}
            x2="24"
            y2={groundY}
            stroke="#94A3B8"
            strokeWidth="1.2"
          />
          <line x1="19" y1={marginTop} x2="29" y2={marginTop} stroke="#94A3B8" strokeWidth="1.2" />
          <line x1="19" y1={groundY} x2="29" y2={groundY} stroke="#94A3B8" strokeWidth="1.2" />
          <text
            x="16"
            y={marginTop + fenceHeightPx / 2}
            textAnchor="middle"
            fill="#E2E8F0"
            fontSize="10"
            fontWeight="bold"
            transform={`rotate(-90, 16, ${marginTop + fenceHeightPx / 2})`}
          >
            H. {config.hauteurUtile.toFixed(2)}m ({result.nbLamesParTravee} lames)
          </text>
        </g>

        {/* Mention scellement +50cm si DIRECT_SOL */}
        {config.typePoseSol === "DIRECT_SOL" && (
          <g>
            <line
              x1="24"
              y1={groundY}
              x2="24"
              y2={groundY + foundationDepthPx}
              stroke="#F59E0B"
              strokeWidth="1.2"
              strokeDasharray="3 2"
            />
            <line
              x1="19"
              y1={groundY + foundationDepthPx}
              x2="29"
              y2={groundY + foundationDepthPx}
              stroke="#F59E0B"
              strokeWidth="1.2"
            />
            <text
              x={marginLeft + drawingWidthPx / 2}
              y={groundY + foundationDepthPx + 22}
              textAnchor="middle"
              fill="#FBBF24"
              fontSize="10"
              fontWeight="bold"
            >
              ANCRAGE BÉTON DIRECT SOL : +50 CM SOUS NIVEAU SOL (Poteaux commandés en{" "}
              {result.longueurCommandePoteauM.toFixed(2)} m)
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export const ClotureCalepinagePanel: React.FC<ClotureCalepinagePanelProps> = ({
  initialConfig,
}) => {
  // Par défaut : 4_COTES pour montrer immédiatement le plan 2D professionnel des 4 côtés
  const [forme, setForme] = useState<FenceShape>(initialConfig?.forme ?? "4_COTES");
  const [segAInput, setSegAInput] = useState<string>(
    String(initialConfig?.segments?.A ?? 12.5)
  );
  const [segBInput, setSegBInput] = useState<string>(
    String(initialConfig?.segments?.B ?? 8.4)
  );
  const [segCInput, setSegCInput] = useState<string>(
    String(initialConfig?.segments?.C ?? 12.5)
  );
  const [segDInput, setSegDInput] = useState<string>(
    String(initialConfig?.segments?.D ?? 8.4)
  );

  const [hauteurUtileInput, setHauteurUtileInput] = useState<string>(
    String(initialConfig?.hauteurUtile ?? 1.8)
  );

  const [materiau, setMateriau] = useState<FenceMaterial>(
    initialConfig?.materiau ?? "COMPOSITE"
  );

  const [longueurLameInput, setLongueurLameInput] = useState<string>(
    String(
      initialConfig?.longueurLameBrute ??
        FENCE_MATERIAL_PRESETS[initialConfig?.materiau ?? "COMPOSITE"].defaultBladeLengthM
    )
  );

  const [hauteurLameInput, setHauteurLameInput] = useState<string>(
    String(
      initialConfig?.hauteurLame ??
        FENCE_MATERIAL_PRESETS[initialConfig?.materiau ?? "COMPOSITE"].defaultBladeHeightM
    )
  );

  const [extremites, setExtremites] = useState<FenceEndsConfig>(
    initialConfig?.extremites ?? "LIBRE"
  );

  const [typePoseSol, setTypePoseSol] = useState<FenceGroundType>(
    initialConfig?.typePoseSol ?? "DIRECT_SOL"
  );

  // Mode d'affichage de l'élévation 2D : "GRILLE" (les 4 côtés en grille) par défaut
  const [activeElevationView, setActiveElevationView] = useState<ElevationViewMode>("GRILLE");
  const [zoom, setZoom] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  const handleSelectMaterial = (newMat: FenceMaterial): void => {
    const preset = FENCE_MATERIAL_PRESETS[newMat];
    setMateriau(newMat);
    setLongueurLameInput(preset.defaultBladeLengthM.toFixed(2));
    setHauteurLameInput(String(preset.defaultBladeHeightM));
  };

  const handleSelectShape = (newShape: FenceShape): void => {
    setForme(newShape);
    if (
      activeElevationView !== "GRILLE" &&
      activeElevationView !== "GLOBAL"
    ) {
      if (newShape === "DROITE" && activeElevationView !== "A") {
        setActiveElevationView("GRILLE");
      } else if (
        newShape === "EN_L" &&
        (activeElevationView === "C" || activeElevationView === "D")
      ) {
        setActiveElevationView("GRILLE");
      } else if (newShape === "EN_U" && activeElevationView === "D") {
        setActiveElevationView("GRILLE");
      }
    }
  };

  const rawBladeLength = parsePositiveFloat(
    longueurLameInput,
    FENCE_MATERIAL_PRESETS[materiau].defaultBladeLengthM
  );
  const isBladeLengthOutOfBounds =
    rawBladeLength < FENCE_CONSTANTS.LAME_BRUTE_MIN_M ||
    rawBladeLength > FENCE_CONSTANTS.LAME_BRUTE_MAX_M;

  const fenceConfig: FenceConfig = useMemo(
    () => ({
      forme,
      segments: {
        A: parsePositiveFloat(segAInput, 12.5),
        B: parsePositiveFloat(segBInput, 8.4),
        C: parsePositiveFloat(segCInput, 12.5),
        D: parsePositiveFloat(segDInput, 8.4),
      },
      hauteurUtile: parsePositiveFloat(hauteurUtileInput, 1.8),
      materiau,
      longueurLameBrute: clampNumber(
        rawBladeLength,
        FENCE_CONSTANTS.LAME_BRUTE_MIN_M,
        FENCE_CONSTANTS.LAME_BRUTE_MAX_M
      ),
      hauteurLame: parsePositiveFloat(
        hauteurLameInput,
        FENCE_MATERIAL_PRESETS[materiau].defaultBladeHeightM
      ),
      extremites,
      typePoseSol,
    }),
    [
      forme,
      segAInput,
      segBInput,
      segCInput,
      segDInput,
      hauteurUtileInput,
      materiau,
      rawBladeLength,
      hauteurLameInput,
      extremites,
      typePoseSol,
    ]
  );

  const result: FenceResult = useMemo(
    () => calculateFenceLayout(fenceConfig),
    [fenceConfig]
  );

  const handleCopyDebitSheet = async (): Promise<void> => {
    const lines: string[] = [
      `=== CALEPINAGE CLÔTURE BNA (${FENCE_MATERIAL_PRESETS[result.config.materiau].label}) ===`,
      `Implantation : ${result.config.forme} | Périmètre total : ${result.lineaireTotalM.toFixed(2)} m | Hauteur utile : ${result.config.hauteurUtile.toFixed(2)} m`,
      `Pose : ${result.config.typePoseSol === "DIRECT_SOL" ? "Scellement béton direct (+0.50m)" : "Sur muret béton avec platines (+0.02m)"}`,
      "",
      "--- DÉBIT PAR CÔTÉ ---",
      ...result.segmentsActifs.map(
        (s) =>
          `• ${s.fullLabel} (${s.longueurSegment.toFixed(2)}m) : ${s.nbTraveesSegment} travées | Entraxe ${s.largeurTraveeAxe.toFixed(3)}m | Coupe lame = ${(s.longueurCoupeLame * 100).toFixed(1)} cm (${Math.round(s.longueurCoupeLame * 1000)} mm, -1cm dilatation incl.)`
      ),
      "",
      "--- NOMENCLATURE POTEAUX ---",
      `• Poteaux droits (intermédiaires + terminaison) : ${result.nbPoteauxDroitsTotal} u (${result.nbPoteauxIntermediaires} inter. + ${result.nbPoteauxBoutStandards} bout)`,
      `• Poteaux d'angle 90° : ${result.nbPoteauxAngle} u`,
      `• Demi-poteaux muraux : ${result.nbDemiPoteauxMuraux} u`,
      `• TOTAL Poteaux complets : ${result.totalPoteauxComplets} u en longueur ${result.longueurCommandePoteauM.toFixed(2)} m`,
      "",
      "--- QUANTITATIF LAMES & CONSOMMABLES ---",
      `• Lames par travée : ${result.nbLamesParTravee} lames/travée (H. lame ${result.config.hauteurLame}m)`,
      `• Total Lames brutes à commander : ${result.nbTotalLames} lames (en ${result.config.longueurLameBrute.toFixed(2)} m)`,
      `• Taux de chute global : ${result.tauxChuteGlobalPct.toFixed(1)} %`,
      result.config.typePoseSol === "DIRECT_SOL"
        ? `• Béton scellement : ${result.nbSacsBeton35kg} sacs de 35 kg (2 sacs / poteau complet)`
        : `• Platines de fixation muret : ${result.nbPlatines} platines`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      // Fallback silencieux
    }
  };

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-[70] overflow-y-auto bg-slate-950 text-slate-100 p-4 sm:p-6"
    : "mt-4 rounded-2xl bg-slate-950 text-slate-100 border border-slate-800 p-3.5 sm:p-5 shadow-2xl";

  return (
    <div className={containerClasses}>
      {/* EN-TÊTE DU MODULE PRO DARK UI */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Calepinage Clôture Pro — 4 Côtés
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                Plan 2D Architectural & Feuille de Débit
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Implantation 1 à 4 côtés (A, B, C, D), jeu de dilatation (-1 cm/travée) & gestion des 4 angles sans doublon
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyDebitSheet}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            {copiedSummary ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Feuille copiée</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copier débit</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-colors"
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* SECTION 1 : CONFIGURATION DES 4 CÔTÉS, MATÉRIAU & POSE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
        {/* COLONNE GAUCHE (7 cols) : IMPLANTATION 1 À 4 CÔTÉS & LAMES */}
        <div className="lg:col-span-7 space-y-4">
          {/* 1. FORME DE LA CLÔTURE (1 À 4 CÔTÉS) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-orange-400" />
                1. Implantation & Côtés du Terrain (m)
              </span>
              <span className="text-xs font-bold text-orange-400">
                Périmètre clôturé : {formatMeters(result.lineaireTotalM)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SHAPE_OPTIONS.map((opt) => {
                const selected = forme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectShape(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selected
                        ? "bg-orange-500/15 border-orange-500 text-white shadow-sm"
                        : "bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{opt.subtitle}</div>
                    <span
                      className={`inline-block mt-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        selected
                          ? "bg-orange-500/30 text-orange-200"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {opt.anglesBadge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Saisie des longueurs des côtés actifs (A, B, C, D) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {/* Côté A (Sud / Avant) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <label className="text-[10px] font-bold text-orange-400 uppercase block">
                  Côté A (Sud/Avant)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={segAInput}
                  onChange={(e) => setSegAInput(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-hidden focus:border-orange-500"
                  placeholder="12.50"
                />
              </div>

              {/* Côté B (Est / Droite) */}
              {(forme === "EN_L" || forme === "EN_U" || forme === "4_COTES") && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <label className="text-[10px] font-bold text-sky-400 uppercase block">
                    Côté B (Est/Droite)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={segBInput}
                    onChange={(e) => setSegBInput(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-hidden focus:border-sky-400"
                    placeholder="8.40"
                  />
                </div>
              )}

              {/* Côté C (Nord / Arrière) */}
              {(forme === "EN_U" || forme === "4_COTES") && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <label className="text-[10px] font-bold text-emerald-400 uppercase block">
                    Côté C (Nord/Arr.)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={segCInput}
                    onChange={(e) => setSegCInput(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-hidden focus:border-emerald-400"
                    placeholder="12.50"
                  />
                </div>
              )}

              {/* Côté D (Ouest / Gauche) */}
              {forme === "4_COTES" && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <label className="text-[10px] font-bold text-purple-400 uppercase block">
                    Côté D (Ouest/G.)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={segDInput}
                    onChange={(e) => setSegDInput(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-hidden focus:border-purple-400"
                    placeholder="8.40"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 2. MATÉRIAU (SANS TRONCATURE MOBILE), HAUTEUR & LAMES BRUTES */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-orange-400" />
              2. Matériau de remplissage & Dimensions Lames
            </span>

            {/* Sélecteur de matériau optimisé mobile : COMPOSITE affiché en entier sans coupure */}
            <div className="grid grid-cols-3 gap-2">
              {(["BOIS", "COMPOSITE", "ALU"] as const).map((matKey) => {
                const preset = FENCE_MATERIAL_PRESETS[matKey];
                const selected = materiau === matKey;
                return (
                  <button
                    key={matKey}
                    type="button"
                    onClick={() => handleSelectMaterial(matKey)}
                    className={`px-2 py-2.5 sm:p-2.5 rounded-xl border text-left transition-all flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5 ${
                      selected
                        ? "bg-orange-500/15 border-orange-500 text-white"
                        : "bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md shrink-0 border border-white/25"
                        style={{ backgroundColor: preset.colorHex }}
                      />
                      <span className="text-[11px] sm:text-xs font-extrabold tracking-tight whitespace-nowrap">
                        {preset.shortName}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 sm:ml-auto whitespace-nowrap">
                      {preset.defaultBladeLengthM.toFixed(2)}m × {preset.defaultBladeHeightM}m
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Hauteur utile clôture */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase block">
                  Hauteur utile (m)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={hauteurUtileInput}
                  onChange={(e) => setHauteurUtileInput(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-hidden focus:border-orange-500"
                />
                <div className="flex items-center gap-1 mt-1.5">
                  {HAUTEUR_UTILE_PRESETS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHauteurUtileInput(h.toFixed(2))}
                      className={`flex-1 py-0.5 rounded text-[10px] font-bold border ${
                        Math.abs(result.config.hauteurUtile - h) < 0.01
                          ? "bg-orange-500/20 border-orange-500 text-orange-300"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {h.toFixed(2)}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Longueur brute lame */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase block">
                  Long. lame brute (m)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={longueurLameInput}
                  onChange={(e) => setLongueurLameInput(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-hidden focus:border-orange-500"
                />
                <span
                  className={`block mt-1 text-[10px] ${
                    isBladeLengthOutOfBounds ? "text-amber-400 font-semibold" : "text-slate-400"
                  }`}
                >
                  Bornée 1.50m–2.40m (retenue : {result.config.longueurLameBrute.toFixed(2)}m)
                </span>
              </div>

              {/* Hauteur utile d'une lame */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase block">
                  Haut. utile lame (m)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={hauteurLameInput}
                  onChange={(e) => setHauteurLameInput(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-hidden focus:border-orange-500"
                />
                <span className="block mt-1 text-[10px] text-slate-400">
                  Soit {result.nbLamesParTravee} lames / travée
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE (5 cols) : EXTRÉMITÉS, POSE AU SOL & KPI SYNTHÈSE */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              3. Configuration des extrémités & Murs
            </label>
            <select
              value={extremites}
              onChange={(e) => setExtremites(e.target.value as FenceEndsConfig)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-hidden focus:border-orange-500"
            >
              {ENDS_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 leading-snug">
              {ENDS_OPTIONS.find((o) => o.id === extremites)?.description}
            </p>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                4. Typologie de pose au sol
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTypePoseSol("DIRECT_SOL")}
                  className={`py-2 px-2.5 rounded-xl border text-left transition-all ${
                    typePoseSol === "DIRECT_SOL"
                      ? "bg-orange-500/15 border-orange-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="text-xs font-bold">Direct Sol</div>
                  <div className="text-[10px] text-slate-400">Scellement béton +0.50m</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTypePoseSol("SUR_MURET")}
                  className={`py-2 px-2.5 rounded-xl border text-left transition-all ${
                    typePoseSol === "SUR_MURET"
                      ? "bg-orange-500/15 border-orange-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="text-xs font-bold">Sur Muret</div>
                  <div className="text-[10px] text-slate-400">Sur platines (+0.02m)</div>
                </button>
              </div>
            </div>
          </div>

          {/* KPI Synthèse Rapide */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Synthèse Globale ({result.segmentsActifs.length} côtés)
              </span>
              {result.alerteChuteElevee ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <AlertTriangle className="w-3 h-3" />
                  Chute : {result.tauxChuteGlobalPct.toFixed(1)}% (&gt; 15%)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 className="w-3 h-3" />
                  Chute : {result.tauxChuteGlobalPct.toFixed(1)}%
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 uppercase block">Total Travées</span>
                <span className="text-base font-extrabold text-white">
                  {result.nbTraveesTotal} travées
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Portée max ≤ {result.porteeMaxRetenueM.toFixed(2)}m
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 uppercase block">
                  Poteaux Complets
                </span>
                <span className="text-base font-extrabold text-orange-400">
                  {result.totalPoteauxComplets} u ({result.nbPoteauxAngle} angles)
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Long. {result.longueurCommandePoteauM.toFixed(2)} m
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 uppercase block">
                  Lames à commander
                </span>
                <span className="text-base font-extrabold text-emerald-400">
                  {result.nbTotalLames} lames
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {result.nbLamesParTravee} lames / travée
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 uppercase block">
                  {result.config.typePoseSol === "DIRECT_SOL"
                    ? "Béton scellement"
                    : "Platines muret"}
                </span>
                <span className="text-base font-extrabold text-sky-400">
                  {result.config.typePoseSol === "DIRECT_SOL"
                    ? `${result.nbSacsBeton35kg} sacs`
                    : `${result.nbPlatines} platines`}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {result.config.typePoseSol === "DIRECT_SOL"
                    ? "Sacs 35 kg (2/poteau)"
                    : "1 platine / poteau"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 : VRAI PLAN DE CALEPINAGE 2D DES 4 CÔTÉS (GRAND FORMAT ARCHITECTURAL) */}
      <div className="mt-5">
        <PlanCalepinage4Cotes2DSvg
          result={result}
          selectedView={activeElevationView}
          onSelectSide={(sideId) => setActiveElevationView(sideId)}
        />
      </div>

      {/* SECTION 3 : PLANS D'ÉLÉVATION 2D (GRILLE DES 4 CÔTÉS + VUE DÉPLIÉE + ONGLETS A/B/C/D) */}
      <div className="mt-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white block">
              Plans d&apos;Élévation 2D (Vues de Face Cotées par Côté)
            </span>
            <span className="text-[11px] text-slate-400">
              Visualisez les 4 faces simultanément en grille ou inspectez un côté spécifique • Scroll horizontal fluide sur mobile
            </span>
          </div>

          {/* Sélecteur : Grille des 4 Côtés | Vue Dépliée | Côté A | Côté B | Côté C | Côté D */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center flex-wrap gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveElevationView("GRILLE")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                  activeElevationView === "GRILLE"
                    ? "bg-orange-500 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Grille des {result.segmentsActifs.length} Côtés</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveElevationView("GLOBAL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  activeElevationView === "GLOBAL"
                    ? "bg-orange-500 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Vue Dépliée
              </button>

              {result.segmentsActifs.map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setActiveElevationView(seg.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    activeElevationView === seg.id
                      ? "bg-orange-500 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {seg.label}
                </button>
              ))}
            </div>

            {/* Contrôles de Zoom */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
                className="p-1 text-slate-400 hover:text-white"
                title="Zoom arrière"
                aria-label="Zoom arrière"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-[11px] font-bold text-slate-300">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.0, +(z + 0.25).toFixed(2)))}
                className="p-1 text-slate-400 hover:text-white"
                title="Zoom avant"
                aria-label="Zoom avant"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Rendu selon le mode choisi : Grille des 4 Côtés vs Vue Dépliée vs Côté Individuel */}
        {activeElevationView === "GRILLE" ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {result.segmentsActifs.map((seg) => (
              <ElevationPlan2DSvg
                key={`grid-elev-${seg.id}`}
                result={result}
                segmentsToRender={[seg]}
                zoom={zoom}
                compactHeader
              />
            ))}
          </div>
        ) : activeElevationView === "GLOBAL" ? (
          <ElevationPlan2DSvg
            result={result}
            segmentsToRender={result.segmentsActifs}
            zoom={zoom}
          />
        ) : (
          <ElevationPlan2DSvg
            result={result}
            segmentsToRender={result.segmentsActifs.filter(
              (s) => s.id === activeElevationView
            )}
            zoom={zoom}
          />
        )}

        {/* Légende détaillée du plan d'élévation */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="w-3.5 h-2.5 rounded-xs inline-block border border-white/20"
                style={{ backgroundColor: FENCE_MATERIAL_PRESETS[materiau].colorHex }}
              />
              Lames {materiau} ({FENCE_MATERIAL_PRESETS[materiau].colorHex})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#4B5563] inline-block border border-slate-400" />
              Poteau standard 70mm (#4B5563)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#D97732] inline-block border border-orange-300" />
              Poteau d&apos;angle 90°
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-3 rounded-xs bg-[#0284C7] inline-block border border-sky-300" />
              Demi-poteau mural
            </span>
          </div>
          <span className="text-slate-400">
            Feuillures : 2 × 15 mm | Jeu de dilatation thermique déduit :{" "}
            <strong className="text-orange-300">-1 cm / travée</strong>
          </span>
        </div>
      </div>

      {/* SECTION 4 : RÉSUMÉ CHANTIER / FEUILLE DE DÉBIT (CARDS UI) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
        {/* CARTE 1 : DÉTAIL DE DÉBIT PAR CÔTÉ (A, B, C, D) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Scissors className="w-4 h-4 text-orange-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              1. Feuille de Débit par Côté (A, B, C, D)
            </h3>
          </div>

          <div className="space-y-2.5">
            {result.segmentsActifs.map((seg) => (
              <div
                key={seg.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-xs font-extrabold"
                    style={{ color: seg.accentHex }}
                  >
                    {seg.fullLabel} ({seg.longueurSegment.toFixed(2)} m)
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 shrink-0">
                    {seg.nbTraveesSegment} travées
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Entraxe poteaux</span>
                    <span className="font-bold text-slate-100">
                      {formatMeters(seg.largeurTraveeAxe, 3)} (
                      {formatCm(seg.largeurTraveeAxe, 1)})
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Largeur libre</span>
                    <span className="font-bold text-slate-100">
                      {formatCm(seg.largeurLibre, 1)} ({formatMm(seg.largeurLibre)})
                    </span>
                  </div>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-orange-300 block">
                      Cote de coupe exacte des lames
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {seg.nbLamesSegment} lames ({seg.nbLamesParTravee}/travée • -1cm dilat.)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-orange-300 block">
                      {formatCm(seg.longueurCoupeLame, 1)}
                    </span>
                    <span className="text-[11px] font-bold text-slate-300">
                      ({formatMm(seg.longueurCoupeLame)})
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARTE 2 : NOMENCLATURE POTEAUX DÉTAILLÉE */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Wrench className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                2. Nomenclature Poteaux (Sans doublon)
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 block">
                    Poteaux droits (Inter. + Terminaison)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {result.nbPoteauxIntermediaires} intermédiaires +{" "}
                    {result.nbPoteauxBoutStandards} terminaison
                  </span>
                </div>
                <span className="text-sm font-extrabold text-white">
                  {result.nbPoteauxDroitsTotal} u
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-bold text-orange-300 block">
                    Poteaux d&apos;angle (90°)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {result.isClosedLoop
                      ? "4 coins fermés du terrain (0 doublon)"
                      : `Jonctions fixes entre côtés (${result.config.forme})`}
                  </span>
                </div>
                <span className="text-sm font-extrabold text-orange-400">
                  {result.nbPoteauxAngle} u
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-bold text-sky-300 block">
                    Demi-poteaux / Profils départ mural
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Fixation contre mur ({result.config.extremites})
                  </span>
                </div>
                <span className="text-sm font-extrabold text-sky-400">
                  {result.nbDemiPoteauxMuraux} u
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-200">
                Total Poteaux Complets à commander
              </span>
              <span className="text-base font-extrabold text-white">
                {result.totalPoteauxComplets} poteaux
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">Longueur unitaire poteau :</span>
              <span className="font-bold text-orange-300">
                {formatMeters(result.longueurCommandePoteauM)} (
                {result.config.typePoseSol === "DIRECT_SOL"
                  ? "scellement +50cm inclus"
                  : "sur platine +2cm garde"}
                )
              </span>
            </div>
          </div>
        </div>

        {/* CARTE 3 : QUANTITATIF LAMES BRUTES, CHUTES & FIXATIONS SOL */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Package className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                3. Commande Lames & Fondations
              </h3>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-200">
                  Total Lames brutes à commander
                </span>
                <span className="text-lg font-extrabold text-emerald-300">
                  {result.nbTotalLames} lames
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Format brut :{" "}
                <strong>{formatMeters(result.config.longueurLameBrute)}</strong> × H.{" "}
                <strong>{formatCm(result.config.hauteurLame, 1)}</strong> (
                {result.nbLamesParTravee} lames/travée × {result.nbTraveesTotal} travées)
              </p>
            </div>

            <div
              className={`p-3 rounded-xl border ${
                result.alerteChuteElevee
                  ? "bg-amber-500/10 border-amber-500/40"
                  : "bg-slate-950 border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">
                  Taux de chute moyen global
                </span>
                <span
                  className={`text-sm font-extrabold ${
                    result.alerteChuteElevee ? "text-amber-300" : "text-emerald-400"
                  }`}
                >
                  {result.tauxChuteGlobalPct.toFixed(1)} %
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Linéaire brut : {result.longueurTotaleLamesBrutesM.toFixed(1)} m • Linéaire
                posé : {result.longueurTotaleLamesCoupeM.toFixed(1)} m (Chute :{" "}
                {result.chuteTotaleM.toFixed(1)} m)
              </p>
              {result.alerteChuteElevee && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Alerte : Chute &gt; 15%. Vérifiez si une longueur de lame brute plus adaptée
                    réduit les pertes.
                  </span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              {result.config.typePoseSol === "DIRECT_SOL" ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Estimation Béton de scellement
                    </span>
                    <span className="text-sm font-extrabold text-orange-400">
                      {result.nbSacsBeton35kg} sacs de 35 kg
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Base : 2 sacs de 35 kg par poteau complet scellé ({result.totalPoteauxComplets}{" "}
                    poteaux × 2)
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Platines de fixation sur muret
                    </span>
                    <span className="text-sm font-extrabold text-sky-400">
                      {result.nbPlatines} platines
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    1 platine métallique par poteau complet + goujons d&apos;ancrage béton
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Conforme règles de pose : section poteau 70mm, feuillures 15mm, jeu de dilatation
              10mm/travée.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
