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
  Recycle,
  Ruler,
  Scissors,
  ShieldCheck,
  Sliders,
  Wrench,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  calculateTerrasseProLayout,
  TERRASSE_MATERIAL_PRESETS,
  type TerrasseMaterial,
  type TerrassePoseMode,
  type TerrasseProConfig,
  type TerrasseProResult,
  type TerrasseShape,
  type TerrasseStructureType,
} from "@/lib/terrasse/calepinageTerrassePro";
import type { CalepinageParams, SensPoseLames, TypeFixationCalepinage } from "@/lib/calepinage";

export interface TerrasseCalepinagePanelProps {
  chantierId?: string;
  entrepriseId?: string;
  onSaveToChantier?: (compatParams: CalepinageParams) => Promise<void>;
  isSaving?: boolean;
}

type PlanTabMode = "PLATELAGE" | "STRUCTURE";

function parseNum(raw: string, fallback: number): number {
  const n = Number.parseFloat(raw.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * PLAN 2D INTERACTIF DE LA TERRASSE (Vue Platelage Lames + Joints + Chutes réemployées OU Vue Structure Lambourdes + Solives + Plots)
 */
const TerrasseProPlan2DSvg: React.FC<{
  result: TerrasseProResult;
  activeTab: PlanTabMode;
  zoom: number;
}> = ({ result, activeTab, zoom }) => {
  const [hoveredRowIdx, setHoveredRowIdx] = useState<number | null>(null);
  const { config } = result;
  const preset = TERRASSE_MATERIAL_PRESETS[config.materiau];

  const PX_PER_M = 78;
  const marginLeft = 75;
  const marginRight = 75;
  const marginTop = 68;
  const marginBottom = 68;

  const totalWidthM =
    config.forme === "EN_L"
      ? Math.max(config.longueurM, config.longueurRetourM)
      : config.longueurM;
  const totalHeightM =
    config.forme === "EN_L"
      ? config.largeurM + config.largeurRetourM
      : config.largeurM;

  const drawW = Math.max(320, totalWidthM * PX_PER_M);
  const drawH = Math.max(220, totalHeightM * PX_PER_M);
  const svgW = marginLeft + drawW + marginRight;
  const svgH = marginTop + drawH + marginBottom;

  const zoneAW = config.longueurM * PX_PER_M;
  const zoneAH = config.largeurM * PX_PER_M;
  const zoneBW = config.forme === "EN_L" ? config.longueurRetourM * PX_PER_M : 0;
  const zoneBH = config.forme === "EN_L" ? config.largeurRetourM * PX_PER_M : 0;

  const minWidthPx = Math.max(580, Math.round(totalWidthM * 68));

  const rowsA = result.rowsPlan.filter((r) => r.zone === "A");
  const rowsB = result.rowsPlan.filter((r) => r.zone === "B");

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-2">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{
          width: `${Math.max(100, Math.round(zoom * 100))}%`,
          minWidth: `${minWidthPx}px`,
          height: "auto",
        }}
        className="select-none block mx-auto"
        role="img"
        aria-label="Plan de calepinage 2D professionnel de la terrasse"
      >
        <defs>
          <pattern
            id="terrasseProGrid"
            width="26"
            height="26"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 26 0 L 0 0 0 26"
              fill="none"
              stroke="#1E293B"
              strokeWidth="0.7"
            />
          </pattern>
          <pattern
            id="tremieHatchPattern"
            width="8"
            height="8"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke="#38BDF8" strokeWidth="2" />
          </pattern>
        </defs>

        {/* Grille de fond */}
        <rect x="0" y="0" width={svgW} height={svgH} fill="url(#terrasseProGrid)" />

        {/* MODE 1 : VUE PLATELAGE (Lames, Découpes, Joints d'aboutage, Chutes réemployées) */}
        {activeTab === "PLATELAGE" && (
          <g>
            {/* Rendu des rangées de la Zone Principale A */}
            {rowsA.map((row, idx) => {
              const isHovered = hoveredRowIdx === row.rowIndex;
              const nRows = rowsA.length;

              if (config.sensPose === "longueur") {
                const rowH = zoneAH / nRows;
                const y = marginTop + idx * rowH;

                return (
                  <g
                    key={`rowA-${row.rowIndex}`}
                    onMouseEnter={() => setHoveredRowIdx(row.rowIndex)}
                    onMouseLeave={() => setHoveredRowIdx(null)}
                    className="cursor-pointer"
                  >
                    {row.segments.map((seg) => {
                      const x = marginLeft + (seg.startM / config.longueurM) * zoneAW;
                      const w = ((seg.endM - seg.startM) / config.longueurM) * zoneAW;
                      return (
                        <g key={`segA-${row.rowIndex}-${seg.segmentIndex}`}>
                          <rect
                            x={x + 0.6}
                            y={y + 0.5}
                            width={Math.max(2, w - 1.2)}
                            height={Math.max(2, rowH - 1)}
                            fill={preset.colorHex}
                            stroke={
                              isHovered
                                ? "#F97316"
                                : seg.fromOffcut
                                ? "#10B981"
                                : preset.strokeHex
                            }
                            strokeWidth={isHovered || seg.fromOffcut ? "1.3" : "0.7"}
                          />
                          {/* Indicateur visuel chute réemployée */}
                          {seg.fromOffcut && rowH >= 7 && w >= 28 && (
                            <circle
                              cx={x + 8}
                              cy={y + rowH / 2}
                              r={2.5}
                              fill="#10B981"
                            />
                          )}
                        </g>
                      );
                    })}

                    {/* Joints d'aboutage de la rangée */}
                    {row.jointsPositionsM.map((jM, jIdx) => {
                      const jX = marginLeft + (jM / config.longueurM) * zoneAW;
                      return (
                        <line
                          key={`jointA-${row.rowIndex}-${jIdx}`}
                          x1={jX}
                          y1={y}
                          x2={jX}
                          y2={y + rowH}
                          stroke="#FDBA74"
                          strokeWidth="1.8"
                        />
                      );
                    })}
                  </g>
                );
              } else {
                // Pose dans la largeur (lames verticales)
                const colW = zoneAW / nRows;
                const x = marginLeft + idx * colW;

                return (
                  <g
                    key={`rowA-v-${row.rowIndex}`}
                    onMouseEnter={() => setHoveredRowIdx(row.rowIndex)}
                    onMouseLeave={() => setHoveredRowIdx(null)}
                    className="cursor-pointer"
                  >
                    {row.segments.map((seg) => {
                      const y = marginTop + (seg.startM / config.largeurM) * zoneAH;
                      const h = ((seg.endM - seg.startM) / config.largeurM) * zoneAH;
                      return (
                        <rect
                          key={`segAv-${row.rowIndex}-${seg.segmentIndex}`}
                          x={x + 0.5}
                          y={y + 0.6}
                          width={Math.max(2, colW - 1)}
                          height={Math.max(2, h - 1.2)}
                          fill={preset.colorHex}
                          stroke={
                            isHovered
                              ? "#F97316"
                              : seg.fromOffcut
                              ? "#10B981"
                              : preset.strokeHex
                          }
                          strokeWidth={isHovered || seg.fromOffcut ? "1.3" : "0.7"}
                        />
                      );
                    })}
                  </g>
                );
              }
            })}

            {/* Rendu du Retour en L (Zone B, en bas à gauche sous la Zone A) */}
            {config.forme === "EN_L" &&
              rowsB.map((row, idx) => {
                const nRowsB = Math.max(1, rowsB.length);
                const rowH = zoneBH / nRowsB;
                const y = marginTop + zoneAH + idx * rowH;

                return (
                  <g key={`rowB-${row.rowIndex}`}>
                    {row.segments.map((seg) => {
                      const x =
                        marginLeft + (seg.startM / config.longueurRetourM) * zoneBW;
                      const w =
                        ((seg.endM - seg.startM) / config.longueurRetourM) * zoneBW;
                      return (
                        <rect
                          key={`segB-${row.rowIndex}-${seg.segmentIndex}`}
                          x={x + 0.6}
                          y={y + 0.5}
                          width={Math.max(2, w - 1.2)}
                          height={Math.max(2, rowH - 1)}
                          fill={preset.colorHex}
                          stroke={seg.fromOffcut ? "#10B981" : preset.strokeHex}
                          strokeWidth="0.8"
                        />
                      );
                    })}
                  </g>
                );
              })}

            {/* Bandeaux de rive périphériques mis en évidence */}
            {config.nbCotesBandeauRive > 0 && (
              <rect
                x={marginLeft - 3}
                y={marginTop - 3}
                width={zoneAW + 6}
                height={zoneAH + 6}
                fill="none"
                stroke="#F97316"
                strokeWidth="3"
                strokeDasharray={config.nbCotesBandeauRive < 4 ? "12 4" : undefined}
              />
            )}
          </g>
        )}

        {/* MODE 2 : VUE STRUCTURE PORTEUSE (Solives + Lambourdes + Doublages d'aboutage + Plots) */}
        {activeTab === "STRUCTURE" && (
          <g>
            {/* Contour de la dalle / emprise terrasse */}
            <rect
              x={marginLeft}
              y={marginTop}
              width={zoneAW}
              height={zoneAH}
              fill="#0F172A"
              stroke="#475569"
              strokeWidth="2"
            />
            {config.forme === "EN_L" && (
              <rect
                x={marginLeft}
                y={marginTop + zoneAH}
                width={zoneBW}
                height={zoneBH}
                fill="#0F172A"
                stroke="#475569"
                strokeWidth="2"
              />
            )}

            {/* Si DOUBLE_STRUCTURE_SOLIVES : Solives porteuses en trait épais ambre */}
            {config.typeStructure === "DOUBLE_STRUCTURE_SOLIVES" &&
              Array.from({ length: result.nbLignesSolives }).map((_, sIdx) => {
                const ratio =
                  result.nbLignesSolives > 1 ? sIdx / (result.nbLignesSolives - 1) : 0;
                if (config.sensPose === "longueur") {
                  const y = marginTop + ratio * zoneAH;
                  return (
                    <line
                      key={`solive-${sIdx}`}
                      x1={marginLeft}
                      y1={y}
                      x2={marginLeft + zoneAW}
                      y2={y}
                      stroke="#F59E0B"
                      strokeWidth="5"
                      strokeOpacity="0.65"
                    />
                  );
                } else {
                  const x = marginLeft + ratio * zoneAW;
                  return (
                    <line
                      key={`solive-v-${sIdx}`}
                      x1={x}
                      y1={marginTop}
                      x2={x}
                      y2={marginTop + zoneAH}
                      stroke="#F59E0B"
                      strokeWidth="5"
                      strokeOpacity="0.65"
                    />
                  );
                }
              })}

            {/* Lignes de lambourdes et Plots sur la Zone A */}
            {result.lambourdesPlan
              .filter((l) => l.zone === "A")
              .map((lamb, lIdx) => {
                if (config.sensPose === "longueur") {
                  const x =
                    marginLeft + (lamb.positionM / config.longueurM) * zoneAW;
                  return (
                    <g key={`struct-lambA-${lIdx}`}>
                      <line
                        x1={x}
                        y1={marginTop}
                        x2={x}
                        y2={marginTop + zoneAH}
                        stroke={lamb.isDoubleAboutage ? "#38BDF8" : "#FDBA74"}
                        strokeWidth={lamb.isDoubleAboutage ? "3.2" : "2"}
                      />
                      {lamb.isDoubleAboutage && (
                        <line
                          x1={x + 3.5}
                          y1={marginTop}
                          x2={x + 3.5}
                          y2={marginTop + zoneAH}
                          stroke="#38BDF8"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                        />
                      )}
                      {/* Plots ou Cales EPDM */}
                      {lamb.plotsPositionsM.map((pM, pIdx) => {
                        const py = marginTop + (pM / config.largeurM) * zoneAH;
                        return config.typeStructure === "SUR_DALLE_CALES" ? (
                          <rect
                            key={`cale-${lIdx}-${pIdx}`}
                            x={x - 3.5}
                            y={py - 3.5}
                            width={7}
                            height={7}
                            fill="#10B981"
                            stroke="#090D16"
                            strokeWidth="1"
                          />
                        ) : (
                          <circle
                            key={`plot-${lIdx}-${pIdx}`}
                            cx={x}
                            cy={py}
                            r={4.2}
                            fill="#090D16"
                            stroke={lamb.isDoubleAboutage ? "#38BDF8" : "#F97316"}
                            strokeWidth="1.8"
                          />
                        );
                      })}
                    </g>
                  );
                } else {
                  const y =
                    marginTop + (lamb.positionM / config.largeurM) * zoneAH;
                  return (
                    <g key={`struct-lambAv-${lIdx}`}>
                      <line
                        x1={marginLeft}
                        y1={y}
                        x2={marginLeft + zoneAW}
                        y2={y}
                        stroke={lamb.isDoubleAboutage ? "#38BDF8" : "#FDBA74"}
                        strokeWidth={lamb.isDoubleAboutage ? "3.2" : "2"}
                      />
                      {lamb.plotsPositionsM.map((pM, pIdx) => {
                        const px = marginLeft + (pM / config.longueurM) * zoneAW;
                        return (
                          <circle
                            key={`plotv-${lIdx}-${pIdx}`}
                            cx={px}
                            cy={y}
                            r={4.2}
                            fill="#090D16"
                            stroke={lamb.isDoubleAboutage ? "#38BDF8" : "#F97316"}
                            strokeWidth="1.8"
                          />
                        );
                      })}
                    </g>
                  );
                }
              })}
          </g>
        )}

        {/* Trémie / Réservation (Spa, Piscine, Arbre) si active */}
        {config.tremie.active && (
          <g>
            <rect
              x={marginLeft + config.tremie.offsetXM * PX_PER_M}
              y={marginTop + config.tremie.offsetYM * PX_PER_M}
              width={config.tremie.longueurM * PX_PER_M}
              height={config.tremie.largeurM * PX_PER_M}
              fill="#090D16"
              stroke="#38BDF8"
              strokeWidth="2"
            />
            <rect
              x={marginLeft + config.tremie.offsetXM * PX_PER_M}
              y={marginTop + config.tremie.offsetYM * PX_PER_M}
              width={config.tremie.longueurM * PX_PER_M}
              height={config.tremie.largeurM * PX_PER_M}
              fill="url(#tremieHatchPattern)"
            />
            <rect
              x={
                marginLeft +
                (config.tremie.offsetXM + config.tremie.longueurM / 2) * PX_PER_M -
                55
              }
              y={
                marginTop +
                (config.tremie.offsetYM + config.tremie.largeurM / 2) * PX_PER_M -
                12
              }
              width="110"
              height="24"
              rx="5"
              fill="#0F172A"
              stroke="#38BDF8"
              strokeWidth="1.2"
            />
            <text
              x={
                marginLeft +
                (config.tremie.offsetXM + config.tremie.longueurM / 2) * PX_PER_M
              }
              y={
                marginTop +
                (config.tremie.offsetYM + config.tremie.largeurM / 2) * PX_PER_M +
                4
              }
              textAnchor="middle"
              fill="#E0F2FE"
              fontSize="9.5"
              fontWeight="bold"
            >
              {config.tremie.nom} ({config.tremie.longueurM}×{config.tremie.largeurM}m)
            </text>
          </g>
        )}

        {/* COTATION ARCHITECTURALE HAUT (Longueur Zone A) */}
        <g>
          <line
            x1={marginLeft}
            y1={marginTop - 26}
            x2={marginLeft + zoneAW}
            y2={marginTop - 26}
            stroke="#F97316"
            strokeWidth="1.5"
          />
          <rect
            x={marginLeft + zoneAW / 2 - 115}
            y={marginTop - 39}
            width="230"
            height="24"
            rx="6"
            fill="#0F172A"
            stroke="#F97316"
            strokeWidth="1.3"
          />
          <text
            x={marginLeft + zoneAW / 2}
            y={marginTop - 23}
            textAnchor="middle"
            fill="#F8FAFC"
            fontSize="10.5"
            fontWeight="bold"
          >
            Longueur A : {config.longueurM.toFixed(2)} m ({result.nbRangeesZoneA} rangées)
          </text>
        </g>

        {/* COTATION ARCHITECTURALE GAUCHE (Largeur Zone A) */}
        <g
          transform={`translate(${marginLeft - 30}, ${marginTop + zoneAH / 2}) rotate(-90)`}
        >
          <rect
            x="-85"
            y="-12"
            width="170"
            height="24"
            rx="6"
            fill="#0F172A"
            stroke="#38BDF8"
            strokeWidth="1.3"
          />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fill="#F8FAFC"
            fontSize="10.5"
            fontWeight="bold"
          >
            Largeur A : {config.largeurM.toFixed(2)} m
          </text>
        </g>

        {/* Info-bulle de la rangée survolée en bas du plan */}
        {hoveredRowIdx !== null && result.rowsPlan[hoveredRowIdx] && (
          <g>
            <rect
              x={svgW / 2 - 190}
              y={svgH - 36}
              width="380"
              height="26"
              rx="6"
              fill="#0F172A"
              stroke="#F97316"
              strokeWidth="1.2"
            />
            <text
              x={svgW / 2}
              y={svgH - 19}
              textAnchor="middle"
              fill="#F8FAFC"
              fontSize="10"
              fontWeight="bold"
            >
              Rangée #{hoveredRowIdx + 1} (Larg. {result.rowsPlan[hoveredRowIdx].widthMm}mm) — Coupes :{" "}
              {result.rowsPlan[hoveredRowIdx].segments
                .map(
                  (s) =>
                    `${(s.lengthM * 100).toFixed(0)}cm${s.fromOffcut ? " (chute)" : ""}`
                )
                .join(" + ")}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export const TerrasseCalepinagePanel: React.FC<TerrasseCalepinagePanelProps> = ({
  chantierId,
  onSaveToChantier,
  isSaving = false,
}) => {
  // États réactifs du formulaire Terrasse Pro
  const [forme, setForme] = useState<TerrasseShape>("RECTANGLE");
  const [longueurInput, setLongueurInput] = useState<string>("6.00");
  const [largeurInput, setLargeurInput] = useState<string>("4.00");
  const [longueurRetourInput, setLongueurRetourInput] = useState<string>("3.00");
  const [largeurRetourInput, setLargeurRetourInput] = useState<string>("2.20");

  // Trémie / Réservation (Spa, Piscine, Arbre)
  const [tremieActive, setTremieActive] = useState<boolean>(false);
  const [tremieNom, setTremieNom] = useState<string>("Spa / Trémie");
  const [tremieLongInput, setTremieLongInput] = useState<string>("2.00");
  const [tremieLargInput, setTremieLargInput] = useState<string>("1.50");
  const [tremieXInput, setTremieXInput] = useState<string>("1.00");
  const [tremieYInput, setTremieYInput] = useState<string>("1.00");

  // Matériau & Pose des lames
  const [materiau, setMateriau] = useState<TerrasseMaterial>("BOIS_EXOTIQUE");
  const [sensPose, setSensPose] = useState<SensPoseLames>("longueur");
  const [modePose, setModePose] = useState<TerrassePoseMode>("COUPE_PERDUE");
  const [largeurLameInput, setLargeurLameInput] = useState<string>("145");
  const [longueurLameInput, setLongueurLameInput] = useState<string>("2.45");
  const [jeuInput, setJeuInput] = useState<string>("5");

  // Structure & Fondations
  const [typeStructure, setTypeStructure] =
    useState<TerrasseStructureType>("SIMPLE_PLOTS");
  const [entraxeLambInput, setEntraxeLambInput] = useState<string>("40");
  const [longueurLambInput, setLongueurLambInput] = useState<string>("3.00");
  const [entraxePlotsInput, setEntraxePlotsInput] = useState<string>("70");
  const [entraxeSolivesInput, setEntraxeSolivesInput] = useState<string>("140");
  const [longueurSoliveInput, setLongueurSoliveInput] = useState<string>("4.00");

  // Fixations & Finitions
  const [typeFixation, setTypeFixation] = useState<TypeFixationCalepinage>("vis");
  const [tailleBoiteInput, setTailleBoiteInput] = useState<string>("200");
  const [nbCotesBandeauRive, setNbCotesBandeauRive] = useState<0 | 1 | 2 | 3 | 4>(3);
  const [inclureBandeBitumineuse, setInclureBandeBitumineuse] = useState<boolean>(true);
  const [inclureGeotextile, setInclureGeotextile] = useState<boolean>(true);

  // États UI
  const [activePlanTab, setActivePlanTab] = useState<PlanTabMode>("PLATELAGE");
  const [zoom, setZoom] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  const handleSelectMaterial = (newMat: TerrasseMaterial): void => {
    const preset = TERRASSE_MATERIAL_PRESETS[newMat];
    setMateriau(newMat);
    setLargeurLameInput(String(preset.defaultBladeWidthMm));
    setLongueurLameInput(preset.defaultBladeLengthM.toFixed(2));
    setJeuInput(String(preset.defaultGapMm));
    setEntraxeLambInput(String(preset.recommendedEntraxeCm));
    setInclureBandeBitumineuse(preset.needsBituminousTape);
  };

  const proConfig: TerrasseProConfig = useMemo(
    () => ({
      forme,
      longueurM: parseNum(longueurInput, 6.0),
      largeurM: parseNum(largeurInput, 4.0),
      longueurRetourM: parseNum(longueurRetourInput, 3.0),
      largeurRetourM: parseNum(largeurRetourInput, 2.2),
      tremie: {
        active: tremieActive,
        nom: tremieNom,
        longueurM: parseNum(tremieLongInput, 2.0),
        largeurM: parseNum(tremieLargInput, 1.5),
        offsetXM: parseNum(tremieXInput, 1.0),
        offsetYM: parseNum(tremieYInput, 1.0),
      },
      materiau,
      sensPose,
      modePose,
      largeurLameMm: parseNum(largeurLameInput, 145),
      longueurLameM: parseNum(longueurLameInput, 2.45),
      jeuInterLamesMm: parseNum(jeuInput, 5),
      minChuteReemployableM: 0.4,
      typeStructure,
      entraxeLambourdesCm: parseNum(entraxeLambInput, 40),
      longueurLambourdeM: parseNum(longueurLambInput, 3.0),
      entraxePlotsCm: parseNum(entraxePlotsInput, 70),
      entraxeSolivesCm: parseNum(entraxeSolivesInput, 140),
      longueurSoliveM: parseNum(longueurSoliveInput, 4.0),
      typeFixation,
      tailleBoiteFixations: parseNum(tailleBoiteInput, 200),
      nbCotesBandeauRive,
      inclureBandeBitumineuse,
      inclureGeotextile,
    }),
    [
      forme,
      longueurInput,
      largeurInput,
      longueurRetourInput,
      largeurRetourInput,
      tremieActive,
      tremieNom,
      tremieLongInput,
      tremieLargInput,
      tremieXInput,
      tremieYInput,
      materiau,
      sensPose,
      modePose,
      largeurLameInput,
      longueurLameInput,
      jeuInput,
      typeStructure,
      entraxeLambInput,
      longueurLambInput,
      entraxePlotsInput,
      entraxeSolivesInput,
      longueurSoliveInput,
      typeFixation,
      tailleBoiteInput,
      nbCotesBandeauRive,
      inclureBandeBitumineuse,
      inclureGeotextile,
    ]
  );

  const result: TerrasseProResult = useMemo(
    () => calculateTerrasseProLayout(proConfig),
    [proConfig]
  );

  const handleCopyDebitSheet = async (): Promise<void> => {
    const lines: string[] = [
      `=== CALEPINAGE TERRASSE PRO BNA (DTU 51.4) — ${TERRASSE_MATERIAL_PRESETS[result.config.materiau].label} ===`,
      `Forme : ${result.config.forme} | Surface nette : ${result.surfaceNetteM2} m² | Mode de pose : ${result.config.modePose}`,
      "",
      "--- 1. PLATELAGE & BANDEAUX DE RIVE ---",
      `• Lames de platelage (${result.config.largeurLameMm}mm × ${result.config.longueurLameM.toFixed(2)}m) : ${result.nbLamesBrutesNecessaires} lames`,
      `• Bandeaux de rive (${result.config.nbCotesBandeauRive} côtés = ${result.mlBandeauRive} ml) : ${result.nbLamesBandeauRive} lames`,
      `• TOTAL LAMES À COMMANDER : ${result.nbLamesTotalACommander} lames (${result.mlLamesAchetes} ml)`,
      `• Chutes réemployées (>= 40cm) : ${result.nbChutesReemployees} coupes | Taux de chute réel : ${result.tauxChuteReellePct}%`,
      "",
      "--- 2. STRUCTURE & SUPPORTS ---",
      `• Lambourdes (barres de ${result.config.longueurLambourdeM.toFixed(2)}m, entraxe réel ${result.entraxeLambourdesReelCm}cm) : ${result.nbBarresLambourdes} barres (${result.mlLambourdesTotal} ml)`,
      ...(result.config.typeStructure === "DOUBLE_STRUCTURE_SOLIVES"
        ? [
            `• Solives porteuses (barres de ${result.config.longueurSoliveM.toFixed(2)}m) : ${result.nbBarresSolives} barres (${result.mlSolivesTotal} ml)`,
          ]
        : []),
      result.config.typeStructure === "SUR_DALLE_CALES"
        ? `• Cales EPDM sur dalle : ${result.nbCalesEpdmDalle} cales + ${result.nbGoujonsAncrageDalle} goujons d'ancrage`
        : `• Plots réglables PVC : ${result.nbPlotsReglables} plots`,
      "",
      "--- 3. FIXATIONS & ACCESSOIRES DTU 51.4 ---",
      `• Fixations (${result.config.typeFixation.toUpperCase()}) : ${result.nbFixationsPrincipales} u (${result.nbBoitesFixations} boîtes de ${result.config.tailleBoiteFixations})`,
      ...(result.nbClipsDepartFin > 0
        ? [`• Clips de départ / fin : ${result.nbClipsDepartFin} clips`]
        : []),
      ...(result.nbRouleauxBandeBitumineuse20m > 0
        ? [
            `• Bande bitumineuse protection lambourdes : ${result.nbRouleauxBandeBitumineuse20m} rouleaux de 20m (${result.mlBandeBitumineuse} ml)`,
          ]
        : []),
      ...(result.surfaceGeotextileM2 > 0
        ? [`• Feutre géotextile sous terrasse (+15% recouv.) : ${result.surfaceGeotextileM2} m²`]
        : []),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      // Fallback silencieux
    }
  };

  const handleTriggerSave = async (): Promise<void> => {
    if (!onSaveToChantier) return;
    // Passer les paramètres compatibles avec l'enregistrement atomique Supabase
    const compatParams: CalepinageParams = {
      longueur_m: result.config.longueurM,
      largeur_m:
        result.config.forme === "EN_L"
          ? +(result.surfaceNetteM2 / result.config.longueurM).toFixed(2)
          : result.config.largeurM,
      sens_pose_lames: result.config.sensPose,
      disposition_joints: "alignes",
      largeur_lame_mm: result.config.largeurLameMm,
      longueur_lame_m: result.config.longueurLameM,
      espace_inter_lames_mm: result.config.jeuInterLamesMm,
      marge_chutes_pct: Math.max(3, Math.round(result.tauxChuteReellePct)),
      entraxe_lambourdes_cm: result.config.entraxeLambourdesCm,
      longueur_lambourde_commerciale_m: result.config.longueurLambourdeM,
      marge_lambourdes_pct: 8,
      entraxe_plots_cm: result.config.entraxePlotsCm,
      type_fixation: result.config.typeFixation,
      marge_fixations_pct: 10,
      taille_boite_vis:
        result.config.typeFixation === "vis" ? result.config.tailleBoiteFixations : undefined,
      taille_boite_clips:
        result.config.typeFixation === "clips" ? result.config.tailleBoiteFixations : undefined,
      utiliser_clips_depart_fin: result.config.typeFixation === "clips",
    };
    await onSaveToChantier(compatParams);
  };

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-[70] overflow-y-auto bg-slate-950 text-slate-100 p-4 pb-24 sm:p-6"
    : "mt-4 rounded-2xl bg-slate-950 text-slate-100 border border-slate-800 p-3.5 sm:p-5 shadow-2xl";

  return (
    <div className={containerClasses}>
      {/* EN-TÊTE DARK UI PRO */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Calepinage Terrasse Pro (DTU 51.4)
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                Coupe Perdue • Quinconce • Double Structure
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Réemploi automatique des chutes ≥ 40 cm, double lambourdage aux aboutages, bandeaux de rive &amp; accessoires
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

      {/* GRILLE PRINCIPALE : PARAMÈTRES (GAUCHE) & SYNTHÈSE / STRUCTURE (DROITE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
        {/* COLONNE GAUCHE (7 cols) : FORME, MATÉRIAU & MODE DE POSE */}
        <div className="lg:col-span-7 space-y-4">
          {/* 1. FORME DE LA TERRASSE & TRÉMIE */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-orange-400" />
                1. Forme de la Terrasse &amp; Dimensions (m)
              </span>
              <span className="text-xs font-bold text-orange-400">
                Surface nette : {result.surfaceNetteM2} m² (Périmètre : {result.perimetreTotalM} m)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForme("RECTANGLE")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  forme === "RECTANGLE"
                    ? "bg-orange-500/15 border-orange-500 text-white"
                    : "bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-xs font-bold">Rectangulaire (Zone A)</div>
                <div className="text-[10px] text-slate-400">Terrasse droite standard L × l</div>
              </button>
              <button
                type="button"
                onClick={() => setForme("EN_L")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  forme === "EN_L"
                    ? "bg-orange-500/15 border-orange-500 text-white"
                    : "bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-xs font-bold">Forme en L (Zone A + Retour B)</div>
                <div className="text-[10px] text-slate-400">Terrasse d&apos;angle avec aile en retour</div>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <label className="text-[10px] font-bold text-orange-400 uppercase block">
                  Longueur A (m)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={longueurInput}
                  onChange={(e) => setLongueurInput(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-hidden focus:border-orange-500"
                />
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <label className="text-[10px] font-bold text-orange-400 uppercase block">
                  Largeur A (m)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={largeurInput}
                  onChange={(e) => setLargeurInput(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-hidden focus:border-orange-500"
                />
              </div>

              {forme === "EN_L" && (
                <>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    <label className="text-[10px] font-bold text-sky-400 uppercase block">
                      Long. Retour B (m)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={longueurRetourInput}
                      onChange={(e) => setLongueurRetourInput(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-hidden focus:border-sky-400"
                    />
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    <label className="text-[10px] font-bold text-sky-400 uppercase block">
                      Larg. Retour B (m)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={largeurRetourInput}
                      onChange={(e) => setLargeurRetourInput(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-hidden focus:border-sky-400"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Option Trémie / Découpe (Spa, Piscine, Arbre) */}
            <div className="pt-1 border-t border-slate-800/80">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tremieActive}
                  onChange={(e) => setTremieActive(e.target.checked)}
                />
                <span>Ajouter une trémie / découpe (Spa, Piscine, Arbre, Pilier)</span>
              </label>

              {tremieActive && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 block">Nom</span>
                    <input
                      type="text"
                      value={tremieNom}
                      onChange={(e) => setTremieNom(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Long. (m)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tremieLongInput}
                      onChange={(e) => setTremieLongInput(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Larg. (m)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tremieLargInput}
                      onChange={(e) => setTremieLargInput(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Décalage X (m)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tremieXInput}
                      onChange={(e) => setTremieXInput(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Décalage Y (m)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tremieYInput}
                      onChange={(e) => setTremieYInput(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. ESSENCE / MATÉRIAU & MODE DE POSE DES LAMES */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-orange-400" />
              2. Essence de Platelage &amp; Mode de Calepinage des Lames
            </span>

            {/* Choix de l'essence / matériau */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {(
                [
                  "BOIS_EXOTIQUE",
                  "PIN_CLASSE_4",
                  "DOUGLAS_MELEZE",
                  "COMPOSITE_ANTHRACITE",
                  "COMPOSITE_TECK",
                ] as const
              ).map((matKey) => {
                const preset = TERRASSE_MATERIAL_PRESETS[matKey];
                const selected = materiau === matKey;
                return (
                  <button
                    key={matKey}
                    type="button"
                    onClick={() => handleSelectMaterial(matKey)}
                    className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 ${
                      selected
                        ? "bg-orange-500/15 border-orange-500 text-white"
                        : "bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-md shrink-0 border border-white/25"
                      style={{ backgroundColor: preset.colorHex }}
                    />
                    <span className="text-[11px] font-bold leading-tight">
                      {preset.shortName}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 3 Modes de Pose Réels */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setModePose("COUPE_PERDUE")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  modePose === "COUPE_PERDUE"
                    ? "bg-emerald-500/15 border-emerald-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Recycle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Coupe perdue (DTU)</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Chute ≥ 40 cm réemployée en début de rangée suivante
                </div>
              </button>

              <button
                type="button"
                onClick={() => setModePose("QUINCONCE_DEMI")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  modePose === "QUINCONCE_DEMI"
                    ? "bg-orange-500/15 border-orange-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <div className="text-xs font-bold">Quinconce (1/2 lame)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Joints décalés d&apos;une demi-lame 1 rangée sur 2
                </div>
              </button>

              <button
                type="button"
                onClick={() => setModePose("ALIGNES")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  modePose === "ALIGNES"
                    ? "bg-orange-500/15 border-orange-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <div className="text-xs font-bold">Joints alignés</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Alignement régulier sur la même ligne de lambourde
                </div>
              </button>
            </div>

            {/* Dimensions Lame & Sens */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <label className="text-[10px] font-bold text-slate-300 uppercase block">
                  Sens des lames
                </label>
                <select
                  value={sensPose}
                  onChange={(e) => setSensPose(e.target.value as SensPoseLames)}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                >
                  <option value="longueur">Dans la longueur</option>
                  <option value="largeur">Dans la largeur</option>
                </select>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <label className="text-[10px] font-bold text-slate-300 uppercase block">
                  Larg. lame (mm)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={largeurLameInput}
                  onChange={(e) => setLargeurLameInput(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <label className="text-[10px] font-bold text-slate-300 uppercase block">
                  Long. lame (m)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={longueurLameInput}
                  onChange={(e) => setLongueurLameInput(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <label className="text-[10px] font-bold text-slate-300 uppercase block">
                  Jeu lames (mm)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={jeuInput}
                  onChange={(e) => setJeuInput(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE (5 cols) : STRUCTURE, FINITIONS & SYNTHÈSE RAPIDE */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          {/* 3. STRUCTURE PORTEUSE & FINITIONS */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              3. Structure Porteuse &amp; Finitions (DTU 51.4)
            </span>

            <select
              value={typeStructure}
              onChange={(e) =>
                setTypeStructure(e.target.value as TerrasseStructureType)
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
            >
              <option value="SIMPLE_PLOTS">
                Simple lambourdage sur plots réglables PVC
              </option>
              <option value="DOUBLE_STRUCTURE_SOLIVES">
                Double structure (Solives porteuses + Lambourdes croisées)
              </option>
              <option value="SUR_DALLE_CALES">
                Pose sur dalle béton (Cales amortisseurs EPDM + Goujons)
              </option>
            </select>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
                <span className="text-[10px] text-slate-400 block">Entraxe lamb. (cm)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={entraxeLambInput}
                  onChange={(e) => setEntraxeLambInput(e.target.value)}
                  className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                />
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
                <span className="text-[10px] text-slate-400 block">Barre lamb. (m)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={longueurLambInput}
                  onChange={(e) => setLongueurLambInput(e.target.value)}
                  className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                />
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
                <span className="text-[10px] text-slate-400 block">Entraxe plots (cm)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={entraxePlotsInput}
                  onChange={(e) => setEntraxePlotsInput(e.target.value)}
                  className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                />
              </div>
            </div>

            {/* Fixations & Bandeaux de rive */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
                <span className="text-[10px] text-slate-400 block">Type de fixation</span>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setTypeFixation("vis")}
                    className={`py-1 rounded text-xs font-bold ${
                      typeFixation === "vis"
                        ? "bg-orange-500 text-white"
                        : "bg-slate-900 text-slate-400"
                    }`}
                  >
                    Vis Inox
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypeFixation("clips")}
                    className={`py-1 rounded text-xs font-bold ${
                      typeFixation === "clips"
                        ? "bg-orange-500 text-white"
                        : "bg-slate-900 text-slate-400"
                    }`}
                  >
                    Clips
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
                <span className="text-[10px] text-slate-400 block">
                  Bandeaux de rive (côtés)
                </span>
                <div className="grid grid-cols-5 gap-1 mt-1">
                  {([0, 1, 2, 3, 4] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNbCotesBandeauRive(n)}
                      className={`py-1 rounded text-xs font-bold ${
                        nbCotesBandeauRive === n
                          ? "bg-orange-500 text-white"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Options Bande bitumineuse & Géotextile */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-300">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inclureBandeBitumineuse}
                  onChange={(e) => setInclureBandeBitumineuse(e.target.checked)}
                />
                <span>Bande bitumineuse</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inclureGeotextile}
                  onChange={(e) => setInclureGeotextile(e.target.checked)}
                />
                <span>Feutre géotextile (+15%)</span>
              </label>
            </div>
          </div>

          {/* KPI Synthèse Immédiate */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Synthèse Quantitatif Pro
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <Recycle className="w-3 h-3" />
                {result.nbChutesReemployees} chutes réemployées • Chute :{" "}
                {result.tauxChuteReellePct}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 uppercase block">
                  Total Lames ({result.config.longueurLameM}m)
                </span>
                <span className="text-base font-extrabold text-orange-400">
                  {result.nbLamesTotalACommander} lames
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {result.nbLamesBrutesNecessaires} platelage + {result.nbLamesBandeauRive} rive
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 uppercase block">
                  Lambourdes ({result.config.longueurLambourdeM}m)
                </span>
                <span className="text-base font-extrabold text-sky-400">
                  {result.nbBarresLambourdes} barres
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {result.mlLambourdesTotal} ml (entraxe {result.entraxeLambourdesReelCm}cm)
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 uppercase block">
                  {result.config.typeStructure === "SUR_DALLE_CALES"
                    ? "Cales EPDM sur dalle"
                    : "Plots réglables"}
                </span>
                <span className="text-base font-extrabold text-emerald-400">
                  {result.config.typeStructure === "SUR_DALLE_CALES"
                    ? `${result.nbCalesEpdmDalle} cales`
                    : `${result.nbPlotsReglables} plots`}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {result.config.typeStructure === "DOUBLE_STRUCTURE_SOLIVES"
                    ? `+ ${result.nbBarresSolives} solives (${result.config.longueurSoliveM}m)`
                    : "Appuis d'aboutage inclus"}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 uppercase block">
                  Fixations ({result.config.typeFixation})
                </span>
                <span className="text-base font-extrabold text-white">
                  {result.nbFixationsPrincipales} u
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Soit {result.nbBoitesFixations} boîte(s) de {result.config.tailleBoiteFixations}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 : DOUBLE PLAN 2D INTERACTIF (VUE PLATELAGE LAMES vs VUE STRUCTURE & PLOTS) */}
      <div className="mt-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white block">
              Plan de Calepinage 2D Interactif (Platelage &amp; Structure Porteuse)
            </span>
            <span className="text-[11px] text-slate-400">
              Survolez une rangée pour voir le détail de ses coupes • Les pastilles vertes indiquent les chutes réemployées (≥ 40 cm)
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActivePlanTab("PLATELAGE")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  activePlanTab === "PLATELAGE"
                    ? "bg-orange-500 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                1. Plan de Platelage &amp; Coupes
              </button>
              <button
                type="button"
                onClick={() => setActivePlanTab("STRUCTURE")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  activePlanTab === "STRUCTURE"
                    ? "bg-orange-500 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                2. Plan de Structure &amp; Plots
              </button>
            </div>

            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
                className="p-1 text-slate-400 hover:text-white"
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
                aria-label="Zoom avant"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <TerrasseProPlan2DSvg
          result={result}
          activeTab={activePlanTab}
          zoom={zoom}
        />

        {/* Légende du Plan 2D */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="w-3.5 h-2.5 rounded-xs inline-block border border-white/20"
                style={{ backgroundColor: TERRASSE_MATERIAL_PRESETS[materiau].colorHex }}
              />
              {TERRASSE_MATERIAL_PRESETS[materiau].shortName}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Chute réemployée (≥ 40 cm)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-sky-400 inline-block" />
              Double lambourde d&apos;aboutage
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-orange-500 inline-block" />
              Plot réglable
            </span>
          </div>
          <span>
            Dernière rangée délignée :{" "}
            <strong
              className={
                result.alerteDerniereRangeeEtroite ? "text-amber-400" : "text-emerald-400"
              }
            >
              {result.largeurDerniereRangeeMm} mm
            </strong>
          </span>
        </div>
      </div>

      {/* SECTION 3 : FEUILLE DE DÉBIT & NOMENCLATURE COMPLÈTE (3 CARTES PRO) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
        {/* CARTE 1 : FEUILLE DE DÉBIT PLATELAGE & RANGÉES */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Scissors className="w-4 h-4 text-orange-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              1. Débit Lames &amp; Platelage ({result.nbRangeesTotal} rangées)
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-300">Lames de platelage ({result.config.longueurLameM}m)</span>
              <span className="font-extrabold text-white">
                {result.nbLamesBrutesNecessaires} lames
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-300">
                Bandeaux de rive ({result.config.nbCotesBandeauRive} côtés • {result.mlBandeauRive} ml)
              </span>
              <span className="font-extrabold text-orange-400">
                {result.nbLamesBandeauRive} lames
              </span>
            </div>
          </div>

          {/* Aperçu des 6 premières rangées types de coupe */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
               Séquence de coupe des rangées (départ → fin)
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {result.rowsPlan.slice(0, 10).map((r) => (
                <div
                  key={`debit-row-${r.rowIndex}`}
                  className="flex items-center justify-between text-[11px] py-1 border-b last:border-b-0 border-slate-800/80"
                >
                  <span className="font-bold text-orange-300">
                    Rang {r.rowIndex + 1} ({r.zone})
                  </span>
                  <span className="text-slate-300 font-mono">
                    {r.segments
                      .map(
                        (s) =>
                          `${(s.lengthM * 100).toFixed(0)}cm${s.fromOffcut ? "♻️" : ""}`
                      )
                      .join(" + ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CARTE 2 : NOMENCLATURE STRUCTURE & SUPPORTS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Wrench className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                2. Structure Porteuse &amp; Fondations
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 block">
                    Lambourdes ({result.config.longueurLambourdeM.toFixed(2)} m)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {result.nbLignesLambourdesBase} lignes trame +{" "}
                    {result.nbLignesLambourdesAboutage} doublages aboutage
                  </span>
                </div>
                <span className="text-sm font-extrabold text-sky-400">
                  {result.nbBarresLambourdes} barres
                </span>
              </div>

              {result.config.typeStructure === "DOUBLE_STRUCTURE_SOLIVES" && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="font-bold text-amber-300 block">
                      Solives porteuses ({result.config.longueurSoliveM.toFixed(2)} m)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {result.nbLignesSolives} lignes porteuses ({result.mlSolivesTotal} ml)
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-amber-400">
                    {result.nbBarresSolives} barres
                  </span>
                </div>
              )}

              {result.config.typeStructure === "SUR_DALLE_CALES" ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="font-bold text-emerald-300 block">
                      Cales EPDM &amp; Goujons sur dalle
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Isolation phonique/humidité sous lambourdes
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {result.nbCalesEpdmDalle} cales / {result.nbGoujonsAncrageDalle} goujons
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="font-bold text-emerald-300 block">
                      Plots réglables PVC
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Entraxe {result.config.entraxePlotsCm} cm + renforts aboutages
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {result.nbPlotsReglables} plots
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs flex items-center justify-between">
            <span className="font-bold text-sky-200">Entraxe max réel lambourdes :</span>
            <span className="text-sm font-extrabold text-white">
              {result.entraxeLambourdesReelCm} cm
            </span>
          </div>
        </div>

        {/* CARTE 3 : QUINCAILLERIE, ÉTANCHÉITÉ & VALIDATION CHANTIER */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Package className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                3. Fixations &amp; Accessoires DTU 51.4
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 block">
                    {result.config.typeFixation === "vis"
                      ? "Vis Inox A2/A4 terrasse"
                      : "Clips invisibles + vis"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {result.nbBoitesFixations} boîte(s) de {result.config.tailleBoiteFixations} u
                  </span>
                </div>
                <span className="text-sm font-extrabold text-white">
                  {result.nbFixationsPrincipales} u
                </span>
              </div>

              {result.nbRouleauxBandeBitumineuse20m > 0 && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="font-bold text-slate-200 block">
                      Bande bitumineuse (rouleaux 20m)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Protection lambourdes ({result.mlBandeBitumineuse} ml)
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-orange-400">
                    {result.nbRouleauxBandeBitumineuse20m} rl.
                  </span>
                </div>
              )}

              {result.surfaceGeotextileM2 > 0 && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="font-bold text-slate-200 block">
                      Feutre géotextile anti-repousse
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Recouvrement +15% inclus
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {result.surfaceGeotextileM2} m²
                  </span>
                </div>
              )}
            </div>

            {result.avertissementsDtu.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-1">
                {result.avertissementsDtu.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-300 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          {onSaveToChantier && (
            <button
              type="button"
              onClick={handleTriggerSave}
              disabled={isSaving || !chantierId}
              className={`w-full min-h-[42px] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                isSaving || !chantierId
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSaving
                  ? "Enregistrement en cours..."
                  : chantierId
                  ? "Enregistrer le quantitatif sur le chantier"
                  : "Sélectionnez un chantier en haut pour enregistrer"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
