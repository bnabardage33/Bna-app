/**
 * Moteur de Calcul Complet — Calepinage Terrasse Pro (DTU 51.4)
 * Strictement typé (zéro `any`), pur et déterministe.
 * Gère : Forme Rectangle & En L, Trémie/Découpe, 3 modes de pose (Coupe perdue avec réemploi
 * réel des chutes >= 40cm, Quinconce 1/2, Joints alignés), Simple/Double structure (Solives + Lambourdes)
 * ou pose sur dalle (cales EPDM), Bandeaux de rive, Bande bitumineuse et Géotextile.
 */

import type { SensPoseLames, TypeFixationCalepinage } from "@/lib/calepinage";

export type TerrasseShape = "RECTANGLE" | "EN_L";

export type TerrasseMaterial =
  | "BOIS_EXOTIQUE"
  | "PIN_CLASSE_4"
  | "DOUGLAS_MELEZE"
  | "COMPOSITE_ANTHRACITE"
  | "COMPOSITE_TECK";

export type TerrassePoseMode = "COUPE_PERDUE" | "QUINCONCE_DEMI" | "ALIGNES";

export type TerrasseStructureType =
  | "SIMPLE_PLOTS"
  | "DOUBLE_STRUCTURE_SOLIVES"
  | "SUR_DALLE_CALES";

export interface TerrasseMaterialPreset {
  id: TerrasseMaterial;
  shortName: string;
  label: string;
  colorHex: string;
  grainHex: string;
  strokeHex: string;
  defaultBladeWidthMm: number;
  defaultBladeLengthM: number;
  defaultGapMm: number;
  recommendedEntraxeCm: number;
  needsBituminousTape: boolean;
}

export const TERRASSE_MATERIAL_PRESETS: Record<TerrasseMaterial, TerrasseMaterialPreset> = {
  BOIS_EXOTIQUE: {
    id: "BOIS_EXOTIQUE",
    shortName: "Exotique (Ipé/Cumaru)",
    label: "Bois Exotique (Ipé / Cumaru KD)",
    colorHex: "#7C3F1D",
    grainHex: "#5C2D12",
    strokeHex: "#3E1D0A",
    defaultBladeWidthMm: 145,
    defaultBladeLengthM: 2.45,
    defaultGapMm: 5,
    recommendedEntraxeCm: 40,
    needsBituminousTape: true,
  },
  PIN_CLASSE_4: {
    id: "PIN_CLASSE_4",
    shortName: "Pin Classe 4",
    label: "Pin Maritime / Sylvestre Autoclave Cl. 4",
    colorHex: "#A47148",
    grainHex: "#825634",
    strokeHex: "#5E3D22",
    defaultBladeWidthMm: 145,
    defaultBladeLengthM: 3.0,
    defaultGapMm: 5,
    recommendedEntraxeCm: 40,
    needsBituminousTape: true,
  },
  DOUGLAS_MELEZE: {
    id: "DOUGLAS_MELEZE",
    shortName: "Douglas / Mélèze",
    label: "Douglas Purgé d'Aubier / Mélèze",
    colorHex: "#B5653B",
    grainHex: "#8F4D2B",
    strokeHex: "#69361C",
    defaultBladeWidthMm: 145,
    defaultBladeLengthM: 3.0,
    defaultGapMm: 5,
    recommendedEntraxeCm: 45,
    needsBituminousTape: true,
  },
  COMPOSITE_ANTHRACITE: {
    id: "COMPOSITE_ANTHRACITE",
    shortName: "Composite Anthracite",
    label: "Composite Co-extrudé Anthracite (RAL 7016)",
    colorHex: "#2D3138",
    grainHex: "#1E2228",
    strokeHex: "#111317",
    defaultBladeWidthMm: 150,
    defaultBladeLengthM: 3.6,
    defaultGapMm: 4,
    recommendedEntraxeCm: 35,
    needsBituminousTape: false,
  },
  COMPOSITE_TECK: {
    id: "COMPOSITE_TECK",
    shortName: "Composite Teck",
    label: "Composite Co-extrudé Nuancé Teck",
    colorHex: "#8E5B3A",
    grainHex: "#6E4429",
    strokeHex: "#4D2E1A",
    defaultBladeWidthMm: 150,
    defaultBladeLengthM: 3.6,
    defaultGapMm: 4,
    recommendedEntraxeCm: 35,
    needsBituminousTape: false,
  },
};

export interface TremieConfig {
  active: boolean;
  nom: string;
  longueurM: number;
  largeurM: number;
  offsetXM: number;
  offsetYM: number;
}

export interface TerrasseProConfig {
  forme: TerrasseShape;
  /** Zone principale A */
  longueurM: number;
  largeurM: number;
  /** Retour en L (Zone B, accolée en haut à droite ou gauche de la zone A) */
  longueurRetourM: number;
  largeurRetourM: number;
  /** Trémie / réservation optionnelle (spa, arbre, pilier) */
  tremie: TremieConfig;

  materiau: TerrasseMaterial;
  sensPose: SensPoseLames;
  modePose: TerrassePoseMode;

  largeurLameMm: number;
  longueurLameM: number;
  jeuInterLamesMm: number;
  /** Longueur minimale d'une chute réemployable (DTU 51.4 : 0.40 m) */
  minChuteReemployableM: number;

  typeStructure: TerrasseStructureType;
  entraxeLambourdesCm: number;
  longueurLambourdeM: number;
  entraxePlotsCm: number;
  /** Pour double structure : entraxe entre solives porteuses (cm, ex: 140 cm) */
  entraxeSolivesCm: number;
  longueurSoliveM: number;

  typeFixation: TypeFixationCalepinage;
  tailleBoiteFixations: number;

  /** Finitions & Accessoires */
  nbCotesBandeauRive: 0 | 1 | 2 | 3 | 4;
  inclureBandeBitumineuse: boolean;
  inclureGeotextile: boolean;
}

export interface BladeSegmentPlan {
  rowIndex: number;
  segmentIndex: number;
  zone: "A" | "B";
  startM: number;
  endM: number;
  lengthM: number;
  fromOffcut: boolean;
}

export interface RowCalepinageDetail {
  rowIndex: number;
  zone: "A" | "B";
  yStartM: number;
  widthMm: number;
  targetLengthM: number;
  segments: BladeSegmentPlan[];
  jointsPositionsM: number[];
}

export interface LambourdeLinePlan {
  index: number;
  zone: "A" | "B";
  positionM: number;
  lengthM: number;
  isDoubleAboutage: boolean;
  plotsPositionsM: number[];
}

export interface TerrasseProResult {
  config: TerrasseProConfig;
  /** Surfaces & Périmètre */
  surfaceZoneAM2: number;
  surfaceRetourBM2: number;
  surfaceTremieM2: number;
  surfaceNetteM2: number;
  perimetreTotalM: number;

  /** Platelage & Simulation rangée par rangée */
  nbRangeesZoneA: number;
  nbRangeesRetourB: number;
  nbRangeesTotal: number;
  largeurDerniereRangeeMm: number;
  alerteDerniereRangeeEtroite: boolean;
  rowsPlan: RowCalepinageDetail[];
  nbLamesBrutesNecessaires: number;
  nbLamesBandeauRive: number;
  nbLamesTotalACommander: number;
  mlLamesPoses: number;
  mlLamesAchetes: number;
  chuteTotaleM: number;
  tauxChuteReellePct: number;
  nbChutesReemployees: number;
  nbAboutagesTotal: number;

  /** Structure (Lambourdes, Solives, Plots / Cales) */
  lambourdesPlan: LambourdeLinePlan[];
  nbLignesLambourdesBase: number;
  nbLignesLambourdesAboutage: number;
  nbLignesLambourdesTotal: number;
  entraxeLambourdesReelCm: number;
  mlLambourdesTotal: number;
  nbBarresLambourdes: number;

  /** Solives (si DOUBLE_STRUCTURE_SOLIVES) */
  nbLignesSolives: number;
  mlSolivesTotal: number;
  nbBarresSolives: number;

  /** Supports (Plots réglables ou Cales EPDM sur dalle) */
  nbPlotsReglables: number;
  nbCalesEpdmDalle: number;
  nbGoujonsAncrageDalle: number;

  /** Fixations & Accessoires */
  nbFixationsPrincipales: number;
  nbClipsDepartFin: number;
  nbVisBandeauRive: number;
  nbBoitesFixations: number;
  mlBandeauRive: number;
  mlBandeBitumineuse: number;
  nbRouleauxBandeBitumineuse20m: number;
  surfaceGeotextileM2: number;

  avertissementsDtu: string[];
}

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
}

/**
 * Calcule le calepinage complet d'une terrasse (Rectangle ou En L) avec simulation
 * rangée par rangée des coupes de lames et de l'implantation des lambourdes / plots.
 */
export function calculateTerrasseProLayout(rawConfig: TerrasseProConfig): TerrasseProResult {
  const longueurM = clamp(rawConfig.longueurM, 1.0, 40.0);
  const largeurM = clamp(rawConfig.largeurM, 0.8, 30.0);
  const longueurRetourM =
    rawConfig.forme === "EN_L" ? clamp(rawConfig.longueurRetourM, 0.8, 25.0) : 0;
  const largeurRetourM =
    rawConfig.forme === "EN_L" ? clamp(rawConfig.largeurRetourM, 0.8, 25.0) : 0;

  const largeurLameMm = clamp(rawConfig.largeurLameMm, 90, 250);
  const longueurLameM = clamp(rawConfig.longueurLameM, 1.5, 6.0);
  const jeuInterLamesMm = clamp(rawConfig.jeuInterLamesMm, 3, 12);
  const minChuteM = clamp(rawConfig.minChuteReemployableM, 0.3, 0.8);

  const entraxeLambourdesCm = clamp(rawConfig.entraxeLambourdesCm, 25, 65);
  const longueurLambourdeM = clamp(rawConfig.longueurLambourdeM, 2.0, 6.0);
  const entraxePlotsCm = clamp(rawConfig.entraxePlotsCm, 40, 120);
  const entraxeSolivesCm = clamp(rawConfig.entraxeSolivesCm, 80, 200);
  const longueurSoliveM = clamp(rawConfig.longueurSoliveM, 2.4, 6.0);
  const tailleBoiteFixations = Math.max(50, Math.round(rawConfig.tailleBoiteFixations || 200));

  const tremie: TremieConfig = {
    active: Boolean(rawConfig.tremie?.active),
    nom: rawConfig.tremie?.nom || "Trémie / Spa",
    longueurM: clamp(rawConfig.tremie?.longueurM ?? 1.5, 0.3, longueurM - 0.2),
    largeurM: clamp(rawConfig.tremie?.largeurM ?? 1.2, 0.3, largeurM - 0.2),
    offsetXM: clamp(rawConfig.tremie?.offsetXM ?? 0.5, 0, Math.max(0, longueurM - 0.5)),
    offsetYM: clamp(rawConfig.tremie?.offsetYM ?? 0.5, 0, Math.max(0, largeurM - 0.5)),
  };

  const config: TerrasseProConfig = {
    ...rawConfig,
    longueurM,
    largeurM,
    longueurRetourM,
    largeurRetourM,
    tremie,
    largeurLameMm,
    longueurLameM,
    jeuInterLamesMm,
    minChuteReemployableM: minChuteM,
    entraxeLambourdesCm,
    longueurLambourdeM,
    entraxePlotsCm,
    entraxeSolivesCm,
    longueurSoliveM,
    tailleBoiteFixations,
  };

  // 1. Surfaces & Périmètre
  const surfaceZoneAM2 = longueurM * largeurM;
  const surfaceRetourBM2 = config.forme === "EN_L" ? longueurRetourM * largeurRetourM : 0;
  const surfaceTremieM2 = tremie.active ? tremie.longueurM * tremie.largeurM : 0;
  const surfaceNetteM2 = Math.max(0.5, +(surfaceZoneAM2 + surfaceRetourBM2 - surfaceTremieM2).toFixed(2));

  const perimetreTotalM =
    config.forme === "RECTANGLE"
      ? 2 * (longueurM + largeurM)
      : 2 * (longueurM + largeurM + largeurRetourM);

  // 2. Calcul des rangées de lames (Zone A et éventuellement Retour B)
  const pasRangeeM = (largeurLameMm + jeuInterLamesMm) / 1000;
  const bladeWidthM = largeurLameMm / 1000;

  // Selon le sens de pose :
  // - si sensPose === "longueur", les lames courent le long de longueurM (X) et les rangées s'empilent sur largeurM (Y)
  // - si sensPose === "largeur", les lames courent le long de largeurM (Y) et les rangées s'empilent sur longueurM (X)
  const spanBladeZoneA = config.sensPose === "longueur" ? longueurM : largeurM;
  const spanRowsZoneA = config.sensPose === "longueur" ? largeurM : longueurM;

  const spanBladeZoneB = config.sensPose === "longueur" ? longueurRetourM : largeurRetourM;
  const spanRowsZoneB = config.sensPose === "longueur" ? largeurRetourM : longueurRetourM;

  const nbRangeesZoneA = Math.max(1, Math.ceil((spanRowsZoneA + jeuInterLamesMm / 1000) / pasRangeeM));
  const nbRangeesRetourB =
    config.forme === "EN_L"
      ? Math.max(1, Math.ceil((spanRowsZoneB + jeuInterLamesMm / 1000) / pasRangeeM))
      : 0;
  const nbRangeesTotal = nbRangeesZoneA + nbRangeesRetourB;

  // Largeur de la dernière lame délignée sur la zone A
  const largeurCouverteCompleteMm =
    (nbRangeesZoneA - 1) * (largeurLameMm + jeuInterLamesMm);
  const resteMm = Math.round(spanRowsZoneA * 1000 - largeurCouverteCompleteMm);
  const largeurDerniereRangeeMm = clamp(resteMm, 10, largeurLameMm);
  const alerteDerniereRangeeEtroite = largeurDerniereRangeeMm < 50;

  // 3. Simulation rangée par rangée de la découpe des lames
  const rowsPlan: RowCalepinageDetail[] = [];
  let nbLamesBrutesNecessaires = 0;
  let nbChutesReemployees = 0;
  let nbAboutagesTotal = 0;
  let carryOverOffcutM = 0;

  const buildRowsForZone = (
    zone: "A" | "B",
    nbRows: number,
    rowTargetLengthM: number,
    startIndexOffset: number
  ): void => {
    for (let r = 0; r < nbRows; r++) {
      const globalRowIdx = startIndexOffset + r;
      const isLastRowA = zone === "A" && r === nbRows - 1;
      const rowWidthMm = isLastRowA ? largeurDerniereRangeeMm : largeurLameMm;
      const yStartM = +(r * pasRangeeM).toFixed(3);

      const segments: BladeSegmentPlan[] = [];
      const jointsPositionsM: number[] = [];
      let cursorM = 0;
      let segIdx = 0;

      if (config.modePose === "ALIGNES") {
        // Pose à joints alignés : chaque rangée recommence avec une lame entière
        while (cursorM < rowTargetLengthM - 1e-4) {
          const remainingM = rowTargetLengthM - cursorM;
          let segLen = Math.min(longueurLameM, remainingM);

          // Éviter un dernier morceau < minChuteM si la rangée nécessite un aboutage
          if (
            remainingM > longueurLameM &&
            remainingM - longueurLameM < minChuteM &&
            longueurLameM > minChuteM * 1.5
          ) {
            segLen = +(remainingM - minChuteM).toFixed(3);
          }

          nbLamesBrutesNecessaires += 1;
          const endM = +(cursorM + segLen).toFixed(3);
          segments.push({
            rowIndex: globalRowIdx,
            segmentIndex: segIdx,
            zone,
            startM: +cursorM.toFixed(3),
            endM,
            lengthM: +segLen.toFixed(3),
            fromOffcut: false,
          });
          if (endM < rowTargetLengthM - 1e-3) {
            jointsPositionsM.push(endM);
            nbAboutagesTotal += 1;
          }
          cursorM = endM;
          segIdx += 1;
        }
      } else if (config.modePose === "QUINCONCE_DEMI") {
        // Pose en quinconce 1/2 lame : rangées paires démarrent par une demi-lame
        const isOddOffset = r % 2 === 1;
        while (cursorM < rowTargetLengthM - 1e-4) {
          const remainingM = rowTargetLengthM - cursorM;
          let maxAvailableM = longueurLameM;
          let usedOffcut = false;

          if (segIdx === 0 && isOddOffset) {
            const halfBladeM = Math.max(minChuteM, +(longueurLameM / 2).toFixed(3));
            if (carryOverOffcutM >= halfBladeM) {
              maxAvailableM = halfBladeM;
              carryOverOffcutM = +(carryOverOffcutM - halfBladeM).toFixed(3);
              usedOffcut = true;
              nbChutesReemployees += 1;
            } else {
              nbLamesBrutesNecessaires += 1;
              maxAvailableM = halfBladeM;
              carryOverOffcutM = +(longueurLameM - halfBladeM).toFixed(3);
            }
          } else if (carryOverOffcutM >= remainingM && remainingM >= minChuteM) {
            maxAvailableM = remainingM;
            carryOverOffcutM = +(carryOverOffcutM - remainingM).toFixed(3);
            usedOffcut = true;
            nbChutesReemployees += 1;
          } else {
            nbLamesBrutesNecessaires += 1;
            maxAvailableM = longueurLameM;
          }

          const segLen = Math.min(maxAvailableM, remainingM);
          if (!usedOffcut && !(segIdx === 0 && isOddOffset)) {
            carryOverOffcutM = +(longueurLameM - segLen).toFixed(3);
          }

          const endM = +(cursorM + segLen).toFixed(3);
          segments.push({
            rowIndex: globalRowIdx,
            segmentIndex: segIdx,
            zone,
            startM: +cursorM.toFixed(3),
            endM,
            lengthM: +segLen.toFixed(3),
            fromOffcut: usedOffcut,
          });
          if (endM < rowTargetLengthM - 1e-3) {
            jointsPositionsM.push(endM);
            nbAboutagesTotal += 1;
          }
          cursorM = endM;
          segIdx += 1;
        }
      } else {
        // COUPE_PERDUE : la chute >= minChuteM de la rangée N démarre la rangée N+1
        while (cursorM < rowTargetLengthM - 1e-4) {
          const remainingM = rowTargetLengthM - cursorM;
          let availableM = 0;
          let usedOffcut = false;

          if (carryOverOffcutM >= minChuteM) {
            availableM = carryOverOffcutM;
            carryOverOffcutM = 0;
            usedOffcut = true;
            nbChutesReemployees += 1;
          } else {
            nbLamesBrutesNecessaires += 1;
            availableM = longueurLameM;
          }

          let segLen = Math.min(availableM, remainingM);
          // Si le reste après cette lame est > 0 mais < minChuteM, on raccourcit légèrement ce segment
          if (
            remainingM > segLen &&
            remainingM - segLen < minChuteM &&
            segLen > minChuteM * 1.6
          ) {
            segLen = +(remainingM - minChuteM).toFixed(3);
          }

          const leftoverM = +(availableM - segLen).toFixed(3);
          if (leftoverM >= minChuteM) {
            carryOverOffcutM = leftoverM;
          }

          const endM = +(cursorM + segLen).toFixed(3);
          segments.push({
            rowIndex: globalRowIdx,
            segmentIndex: segIdx,
            zone,
            startM: +cursorM.toFixed(3),
            endM,
            lengthM: +segLen.toFixed(3),
            fromOffcut: usedOffcut,
          });
          if (endM < rowTargetLengthM - 1e-3) {
            jointsPositionsM.push(endM);
            nbAboutagesTotal += 1;
          }
          cursorM = endM;
          segIdx += 1;
        }
      }

      rowsPlan.push({
        rowIndex: globalRowIdx,
        zone,
        yStartM,
        widthMm: rowWidthMm,
        targetLengthM: rowTargetLengthM,
        segments,
        jointsPositionsM,
      });
    }
  };

  buildRowsForZone("A", nbRangeesZoneA, spanBladeZoneA, 0);
  if (config.forme === "EN_L" && nbRangeesRetourB > 0) {
    buildRowsForZone("B", nbRangeesRetourB, spanBladeZoneB, nbRangeesZoneA);
  }

  // Bandeaux de rive périphériques
  const cotesLengthsM = [longueurM, largeurM, longueurM, largeurM];
  let mlBandeauRive = 0;
  for (let i = 0; i < config.nbCotesBandeauRive; i++) {
    mlBandeauRive += cotesLengthsM[i];
  }
  const nbLamesBandeauRive =
    mlBandeauRive > 0 ? Math.ceil((mlBandeauRive * 1.05) / longueurLameM) : 0;

  const nbLamesTotalACommander = nbLamesBrutesNecessaires + nbLamesBandeauRive;
  const mlLamesPoses = +(
    rowsPlan.reduce((acc, r) => acc + r.targetLengthM, 0) + mlBandeauRive
  ).toFixed(2);
  const mlLamesAchetes = +(nbLamesTotalACommander * longueurLameM).toFixed(2);
  const chuteTotaleM = Math.max(0, +(mlLamesAchetes - mlLamesPoses).toFixed(2));
  const tauxChuteReellePct =
    mlLamesAchetes > 0 ? +((chuteTotaleM / mlLamesAchetes) * 100).toFixed(1) : 0;

  // 4. Structure : Lambourdes (perpendiculaires aux lames)
  const entraxeLambM = entraxeLambourdesCm / 100;
  const entraxePlotM = entraxePlotsCm / 100;

  const nbIntervallesLambA = Math.max(1, Math.ceil(spanBladeZoneA / entraxeLambM));
  const pasLambReelA = spanBladeZoneA / nbIntervallesLambA;
  const entraxeLambourdesReelCm = +(pasLambReelA * 100).toFixed(1);

  const lambourdesPlan: LambourdeLinePlan[] = [];
  let nbLignesLambourdesBase = 0;
  let nbLignesLambourdesAboutage = 0;

  // Collecte des positions uniques d'aboutage sur la Zone A
  const uniqueJointsA = Array.from(
    new Set(
      rowsPlan
        .filter((r) => r.zone === "A")
        .flatMap((r) => r.jointsPositionsM.map((j) => +j.toFixed(2)))
    )
  ).sort((a, b) => a - b);

  for (let i = 0; i <= nbIntervallesLambA; i++) {
    const posM = +(i * pasLambReelA).toFixed(3);
    const isNearJoint = uniqueJointsA.some((j) => Math.abs(j - posM) < 0.08);
    const nbPlotsLine = Math.max(2, Math.ceil(spanRowsZoneA / entraxePlotM) + 1);
    const pasPlot = spanRowsZoneA / (nbPlotsLine - 1);
    const plotsPositionsM = Array.from({ length: nbPlotsLine }, (_, pIdx) =>
      +(pIdx * pasPlot).toFixed(3)
    );

    nbLignesLambourdesBase += 1;
    if (isNearJoint) {
      nbLignesLambourdesAboutage += 1;
    }

    lambourdesPlan.push({
      index: i,
      zone: "A",
      positionM: posM,
      lengthM: spanRowsZoneA,
      isDoubleAboutage: isNearJoint,
      plotsPositionsM,
    });
  }

  // Ajout des lignes d'aboutage dédiées si un joint tombe entre deux lambourdes de trame
  for (const jointM of uniqueJointsA) {
    const alreadyCovered = lambourdesPlan.some(
      (l) => l.zone === "A" && Math.abs(l.positionM - jointM) < 0.08
    );
    if (!alreadyCovered) {
      const nbPlotsLine = Math.max(2, Math.ceil(spanRowsZoneA / entraxePlotM) + 1);
      const pasPlot = spanRowsZoneA / (nbPlotsLine - 1);
      const plotsPositionsM = Array.from({ length: nbPlotsLine }, (_, pIdx) =>
        +(pIdx * pasPlot).toFixed(3)
      );
      nbLignesLambourdesAboutage += 2; // Double lambourdage au droit du joint
      lambourdesPlan.push({
        index: lambourdesPlan.length,
        zone: "A",
        positionM: jointM,
        lengthM: spanRowsZoneA,
        isDoubleAboutage: true,
        plotsPositionsM,
      });
    }
  }

  lambourdesPlan.sort((a, b) => a.positionM - b.positionM);

  // Si forme EN_L : lambourdes du retour B
  if (config.forme === "EN_L") {
    const nbIntervallesLambB = Math.max(1, Math.ceil(spanBladeZoneB / entraxeLambM));
    const pasLambB = spanBladeZoneB / nbIntervallesLambB;
    for (let i = 0; i <= nbIntervallesLambB; i++) {
      const posM = +(i * pasLambB).toFixed(3);
      const nbPlotsLine = Math.max(2, Math.ceil(spanRowsZoneB / entraxePlotM) + 1);
      const pasPlot = spanRowsZoneB / (nbPlotsLine - 1);
      const plotsPositionsM = Array.from({ length: nbPlotsLine }, (_, pIdx) =>
        +(pIdx * pasPlot).toFixed(3)
      );
      nbLignesLambourdesBase += 1;
      lambourdesPlan.push({
        index: lambourdesPlan.length,
        zone: "B",
        positionM: posM,
        lengthM: spanRowsZoneB,
        isDoubleAboutage: false,
        plotsPositionsM,
      });
    }
  }

  const nbLignesLambourdesTotal = nbLignesLambourdesBase + nbLignesLambourdesAboutage;
  const mlLambourdesBrut =
    lambourdesPlan.reduce(
      (acc, l) => acc + l.lengthM * (l.isDoubleAboutage ? 2 : 1),
      0
    );
  const mlLambourdesTotal = +(mlLambourdesBrut * 1.08).toFixed(2);
  const nbBarresLambourdes = Math.ceil(mlLambourdesTotal / longueurLambourdeM);

  // 5. Solives & Supports (Plots ou Cales EPDM)
  let nbLignesSolives = 0;
  let mlSolivesTotal = 0;
  let nbBarresSolives = 0;
  let nbPlotsReglables = 0;
  let nbCalesEpdmDalle = 0;
  let nbGoujonsAncrageDalle = 0;

  const rawTotalPlotsOnLambourdes = lambourdesPlan.reduce(
    (acc, l) => acc + l.plotsPositionsM.length * (l.isDoubleAboutage ? 1.5 : 1),
    0
  );

  if (config.typeStructure === "SIMPLE_PLOTS") {
    nbPlotsReglables = Math.ceil(rawTotalPlotsOnLambourdes);
  } else if (config.typeStructure === "DOUBLE_STRUCTURE_SOLIVES") {
    const entraxeSoliveM = entraxeSolivesCm / 100;
    nbLignesSolives = Math.max(2, Math.ceil(spanRowsZoneA / entraxeSoliveM) + 1);
    mlSolivesTotal = +(nbLignesSolives * spanBladeZoneA * 1.08).toFixed(2);
    nbBarresSolives = Math.ceil(mlSolivesTotal / longueurSoliveM);
    // Plots uniquement sous les solives (portée tous les ~1.20m)
    const plotsParSolive = Math.max(2, Math.ceil(spanBladeZoneA / 1.2) + 1);
    nbPlotsReglables = nbLignesSolives * plotsParSolive;
  } else {
    // SUR_DALLE_CALES : cales amortisseurs EPDM sous lambourdes + goujons béton
    nbCalesEpdmDalle = Math.ceil(mlLambourdesBrut / 0.5);
    nbGoujonsAncrageDalle = Math.ceil(mlLambourdesBrut / 0.8);
  }

  // 6. Fixations & Accessoires
  const nbCroisementsBase = nbRangeesTotal * nbLignesLambourdesBase;
  const nbCroisementsAboutage = nbAboutagesTotal * 2;

  let nbFixationsPrincipales = 0;
  let nbClipsDepartFin = 0;

  if (config.typeFixation === "vis") {
    // 2 vis inox par croisement lame/lambourde + 4 vis par joint d'aboutage + 10% marge
    nbFixationsPrincipales = Math.ceil((nbCroisementsBase * 2 + nbCroisementsAboutage * 2) * 1.1);
  } else {
    // 1 clip invisible par croisement + 2 clips par aboutage + 8% marge
    nbFixationsPrincipales = Math.ceil((nbCroisementsBase + nbCroisementsAboutage) * 1.08);
    nbClipsDepartFin = nbLignesLambourdesBase * 2;
  }

  const nbVisBandeauRive =
    mlBandeauRive > 0 ? Math.ceil(mlBandeauRive / 0.4) * 2 : 0;
  const nbBoitesFixations = Math.ceil(
    (nbFixationsPrincipales + nbVisBandeauRive) / tailleBoiteFixations
  );

  // Bande bitumineuse sur lambourdes (et solives éventuelles)
  const mlBandeBitumineuse = config.inclureBandeBitumineuse
    ? +(mlLambourdesBrut + mlSolivesTotal).toFixed(1)
    : 0;
  const nbRouleauxBandeBitumineuse20m =
    mlBandeBitumineuse > 0 ? Math.ceil(mlBandeBitumineuse / 20) : 0;

  // Géotextile sous terrasse (+15% recouvrement des lés)
  const surfaceGeotextileM2 = config.inclureGeotextile
    ? +(surfaceNetteM2 * 1.15).toFixed(1)
    : 0;

  // 7. Contrôles DTU 51.4 & Avertissements
  const avertissementsDtu: string[] = [];
  const preset = TERRASSE_MATERIAL_PRESETS[config.materiau];

  if (entraxeLambourdesCm > preset.recommendedEntraxeCm) {
    avertissementsDtu.push(
      `L'entraxe choisi (${entraxeLambourdesCm} cm) dépasse l'entraxe conseillé (${preset.recommendedEntraxeCm} cm) pour ${preset.shortName}.`
    );
  }
  if (alerteDerniereRangeeEtroite) {
    avertissementsDtu.push(
      `La dernière rangée délignée mesure ${largeurDerniereRangeeMm} mm (< 50 mm DTU 51.4) : délignez également la 1ère rangée pour équilibrer.`
    );
  }
  if (tauxChuteReellePct > 15) {
    avertissementsDtu.push(
      `Taux de chute de ${tauxChuteReellePct}% (> 15%) : essayez le mode "Coupe perdue" ou une longueur de lame mieux adaptée.`
    );
  }

  return {
    config,
    surfaceZoneAM2: +surfaceZoneAM2.toFixed(2),
    surfaceRetourBM2: +surfaceRetourBM2.toFixed(2),
    surfaceTremieM2: +surfaceTremieM2.toFixed(2),
    surfaceNetteM2,
    perimetreTotalM: +perimetreTotalM.toFixed(2),

    nbRangeesZoneA,
    nbRangeesRetourB,
    nbRangeesTotal,
    largeurDerniereRangeeMm,
    alerteDerniereRangeeEtroite,
    rowsPlan,
    nbLamesBrutesNecessaires,
    nbLamesBandeauRive,
    nbLamesTotalACommander,
    mlLamesPoses,
    mlLamesAchetes,
    chuteTotaleM,
    tauxChuteReellePct,
    nbChutesReemployees,
    nbAboutagesTotal,

    lambourdesPlan,
    nbLignesLambourdesBase,
    nbLignesLambourdesAboutage,
    nbLignesLambourdesTotal,
    entraxeLambourdesReelCm,
    mlLambourdesTotal,
    nbBarresLambourdes,

    nbLignesSolives,
    mlSolivesTotal,
    nbBarresSolives,

    nbPlotsReglables,
    nbCalesEpdmDalle,
    nbGoujonsAncrageDalle,

    nbFixationsPrincipales,
    nbClipsDepartFin,
    nbVisBandeauRive,
    nbBoitesFixations,
    mlBandeauRive: +mlBandeauRive.toFixed(2),
    mlBandeBitumineuse,
    nbRouleauxBandeBitumineuse20m,
    surfaceGeotextileM2,

    avertissementsDtu,
  };
}
