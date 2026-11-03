/**
 * Moteur de calcul complet — Calepinage Clôture (Fencing Calculator 1 à 4 côtés)
 * Strictement typé (aucun `any`), pur et déterministe.
 */

export type FenceShape = "DROITE" | "EN_L" | "EN_U" | "4_COTES";

export type FenceMaterial = "BOIS" | "COMPOSITE" | "ALU";

export type FenceEndsConfig = "LIBRE" | "DEPART_MUR" | "ENTRE_MURS";

export type FenceGroundType = "DIRECT_SOL" | "SUR_MURET";

export type SegmentId = "A" | "B" | "C" | "D";

export type PostExtremityType = "TERMINAISON" | "DEMI_MURAL" | "ANGLE";

export interface MaterialPreset {
  id: FenceMaterial;
  shortName: string;
  label: string;
  colorHex: string;
  strokeHex: string;
  defaultBladeLengthM: number;
  defaultBladeHeightM: number;
}

export const FENCE_MATERIAL_PRESETS: Record<FenceMaterial, MaterialPreset> = {
  BOIS: {
    id: "BOIS",
    shortName: "BOIS",
    label: "Bois (Pin / Exotique / Mélèze)",
    colorHex: "#8B5A2B",
    strokeHex: "#5C3A1B",
    defaultBladeLengthM: 2.0,
    defaultBladeHeightM: 0.145,
  },
  COMPOSITE: {
    id: "COMPOSITE",
    shortName: "COMPOSITE",
    label: "Composite (Anthracite RAL 7016)",
    colorHex: "#262626",
    strokeHex: "#404040",
    defaultBladeLengthM: 1.8,
    defaultBladeHeightM: 0.15,
  },
  ALU: {
    id: "ALU",
    shortName: "ALU",
    label: "Aluminium Thermolaqué (Gris)",
    colorHex: "#9CA3AF",
    strokeHex: "#6B7280",
    defaultBladeLengthM: 1.8,
    defaultBladeHeightM: 0.15,
  },
};

export const SEGMENT_METADATA: Record<
  SegmentId,
  {
    id: SegmentId;
    shortLabel: string;
    fullLabel: string;
    orientation: string;
    accentHex: string;
  }
> = {
  A: {
    id: "A",
    shortLabel: "Côté A",
    fullLabel: "Côté A (Sud / Avant)",
    orientation: "Sud / Façade avant",
    accentHex: "#F97316",
  },
  B: {
    id: "B",
    shortLabel: "Côté B",
    fullLabel: "Côté B (Est / Droite)",
    orientation: "Est / Pignon droit",
    accentHex: "#38BDF8",
  },
  C: {
    id: "C",
    shortLabel: "Côté C",
    fullLabel: "Côté C (Nord / Arrière)",
    orientation: "Nord / Fond de parcelle",
    accentHex: "#10B981",
  },
  D: {
    id: "D",
    shortLabel: "Côté D",
    fullLabel: "Côté D (Ouest / Gauche)",
    orientation: "Ouest / Pignon gauche",
    accentHex: "#A855F7",
  },
};

export const FENCE_CONSTANTS = {
  /** Largeur de section d'un poteau standard : 70 mm (0.07 m) */
  SECTION_POTEAU_M: 0.07,
  /** Profondeur d'une feuillure de poteau : 15 mm (0.015 m) de chaque côté */
  PROFONDEUR_FEUILLURE_M: 0.015,
  /** Jeu de dilatation thermique obligatoire par travée : 10 mm (0.01 m) */
  JEU_DILATATION_M: 0.01,
  /** Portée maximale absolue d'une travée : 2.00 m */
  PORTEE_MAX_ABSOLUE_M: 2.0,
  /** Bornes de longueur de lame brute */
  LAME_BRUTE_MIN_M: 1.5,
  LAME_BRUTE_MAX_M: 2.4,
  /** Scellement béton direct dans le sol : +0.50 m */
  GARDE_SCELLEMENT_SOL_M: 0.5,
  /** Garde sur platine muret : +0.02 m */
  GARDE_PLATINE_MURET_M: 0.02,
  /** Nombre de sacs de béton de 35 kg par poteau scellé */
  SACS_BETON_35KG_PAR_POTEAU: 2,
  /** Seuil d'alerte de chute en % */
  SEUIL_ALERTE_CHUTE_PCT: 15,
} as const;

export interface FenceSegmentsLengths {
  A: number;
  B: number;
  C: number;
  D?: number;
}

export interface FenceConfig {
  forme: FenceShape;
  segments: FenceSegmentsLengths;
  hauteurUtile: number;
  materiau: FenceMaterial;
  longueurLameBrute: number;
  hauteurLame: number;
  extremites: FenceEndsConfig;
  typePoseSol: FenceGroundType;
}

export interface SegmentResult {
  id: SegmentId;
  label: string;
  fullLabel: string;
  orientation: string;
  accentHex: string;
  longueurSegment: number;
  porteeMax: number;
  nbTraveesSegment: number;
  largeurTraveeAxe: number;
  largeurLibre: number;
  longueurCoupeLame: number;
  nbPoteauxIntermediaires: number;
  nbLamesParTravee: number;
  nbLamesSegment: number;
  chuteParLameM: number;
  tauxChuteSegmentPct: number;
  departType: PostExtremityType;
  arriveeType: PostExtremityType;
}

export interface FenceResult {
  config: Required< Omit<FenceConfig, "segments"> > & {
    segments: Required<FenceSegmentsLengths>;
  };
  segmentsActifs: SegmentResult[];
  isClosedLoop: boolean;
  lineaireTotalM: number;
  porteeMaxRetenueM: number;
  nbTraveesTotal: number;
  nbPoteauxAngle: number;
  nbPoteauxIntermediaires: number;
  nbPoteauxBoutStandards: number;
  nbPoteauxDroitsTotal: number;
  nbDemiPoteauxMuraux: number;
  totalPoteauxComplets: number;
  longueurCommandePoteauM: number;
  nbPlatines: number;
  nbSacsBeton35kg: number;
  nbLamesParTravee: number;
  nbTotalLames: number;
  longueurTotaleLamesBrutesM: number;
  longueurTotaleLamesCoupeM: number;
  chuteTotaleM: number;
  tauxChuteGlobalPct: number;
  alerteChuteElevee: boolean;
}

/**
 * Retourne la liste ordonnée des identifiants de segments actifs selon la forme choisie.
 */
export function getActiveSegmentIds(forme: FenceShape): SegmentId[] {
  switch (forme) {
    case "DROITE":
      return ["A"];
    case "EN_L":
      return ["A", "B"];
    case "EN_U":
      return ["A", "B", "C"];
    case "4_COTES":
      return ["A", "B", "C", "D"];
  }
}

/**
 * Clamp une valeur numérique entre min et max.
 */
export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Fonction pure principale de calcul du calepinage de clôture par segment (1 à 4 côtés).
 */
export function calculateFenceLayout(rawConfig: FenceConfig): FenceResult {
  const longueurLameBrute = clampNumber(
    rawConfig.longueurLameBrute,
    FENCE_CONSTANTS.LAME_BRUTE_MIN_M,
    FENCE_CONSTANTS.LAME_BRUTE_MAX_M
  );
  const hauteurUtile = Math.max(
    0.4,
    Number.isFinite(rawConfig.hauteurUtile) ? rawConfig.hauteurUtile : 1.8
  );
  const hauteurLame = Math.max(
    0.05,
    Number.isFinite(rawConfig.hauteurLame) ? rawConfig.hauteurLame : 0.15
  );

  const normalizedSegments: Required<FenceSegmentsLengths> = {
    A: Math.max(0.5, Number.isFinite(rawConfig.segments.A) ? rawConfig.segments.A : 12.5),
    B: Math.max(0.5, Number.isFinite(rawConfig.segments.B) ? rawConfig.segments.B : 8.0),
    C: Math.max(0.5, Number.isFinite(rawConfig.segments.C) ? rawConfig.segments.C : 12.5),
    D: Math.max(
      0.5,
      Number.isFinite(rawConfig.segments.D ?? NaN)
        ? (rawConfig.segments.D as number)
        : Number.isFinite(rawConfig.segments.B)
        ? rawConfig.segments.B
        : 8.0
    ),
  };

  const config = {
    ...rawConfig,
    longueurLameBrute,
    hauteurUtile,
    hauteurLame,
    segments: normalizedSegments,
  };

  const activeIds = getActiveSegmentIds(config.forme);
  const isClosedLoop = config.forme === "4_COTES" && config.extremites === "LIBRE";
  const porteeMax = Math.min(FENCE_CONSTANTS.PORTEE_MAX_ABSOLUE_M, config.longueurLameBrute);
  const nbLamesParTravee = Math.ceil(config.hauteurUtile / config.hauteurLame);

  const segmentsActifs: SegmentResult[] = activeIds.map((segId, index) => {
    const meta = SEGMENT_METADATA[segId];
    const longueurSegment = config.segments[segId];
    const nbTraveesSegment = Math.max(1, Math.ceil(longueurSegment / porteeMax));
    const largeurTraveeAxe = longueurSegment / nbTraveesSegment;

    // Cote de coupe des lames & jeu de dilatation (1 cm obligatoire par travée)
    // Section poteau = 0.07m, profondeur feuillure = 0.015m de chaque côté, jeu dilatation = 0.01m
    const largeurLibre = Math.max(0, largeurTraveeAxe - FENCE_CONSTANTS.SECTION_POTEAU_M);
    const longueurCoupeLame = Math.max(
      0,
      largeurLibre + 2 * FENCE_CONSTANTS.PROFONDEUR_FEUILLURE_M - FENCE_CONSTANTS.JEU_DILATATION_M
    );

    const nbPoteauxIntermediaires = Math.max(0, nbTraveesSegment - 1);
    const nbLamesSegment = nbTraveesSegment * nbLamesParTravee;
    const chuteParLameM = Math.max(0, config.longueurLameBrute - longueurCoupeLame);
    const tauxChuteSegmentPct =
      config.longueurLameBrute > 0 ? (chuteParLameM / config.longueurLameBrute) * 100 : 0;

    // Détermination du type de poteau au départ et à l'arrivée du segment
    const isFirstSegment = index === 0;
    const isLastSegment = index === activeIds.length - 1;

    let departType: PostExtremityType = "ANGLE";
    let arriveeType: PostExtremityType = "ANGLE";

    if (isClosedLoop) {
      // En boucle fermée 4 côtés LIBRE : les 4 coins sont des poteaux d'angle 90°
      departType = "ANGLE";
      arriveeType = "ANGLE";
    } else {
      if (isFirstSegment) {
        departType =
          config.extremites === "DEPART_MUR" || config.extremites === "ENTRE_MURS"
            ? "DEMI_MURAL"
            : "TERMINAISON";
      }
      if (isLastSegment) {
        arriveeType = config.extremites === "ENTRE_MURS" ? "DEMI_MURAL" : "TERMINAISON";
      }
    }

    return {
      id: segId,
      label: meta.shortLabel,
      fullLabel: meta.fullLabel,
      orientation: meta.orientation,
      accentHex: meta.accentHex,
      longueurSegment,
      porteeMax,
      nbTraveesSegment,
      largeurTraveeAxe,
      largeurLibre,
      longueurCoupeLame,
      nbPoteauxIntermediaires,
      nbLamesParTravee,
      nbLamesSegment,
      chuteParLameM,
      tauxChuteSegmentPct,
      departType,
      arriveeType,
    };
  });

  // 3. Calcul exact des Poteaux (Sans doublon aux angles)
  const nbPoteauxIntermediaires = segmentsActifs.reduce(
    (acc, seg) => acc + seg.nbPoteauxIntermediaires,
    0
  );

  let nbPoteauxAngle = 0;
  let nbPoteauxBoutStandards = 0;
  let nbDemiPoteauxMuraux = 0;

  if (config.forme === "4_COTES") {
    if (config.extremites === "LIBRE") {
      // Boucle fermée sur 4 côtés : 4 poteaux d'angle (90°) aux 4 coins et 0 poteau de terminaison
      nbPoteauxAngle = 4;
      nbPoteauxBoutStandards = 0;
      nbDemiPoteauxMuraux = 0;
    } else if (config.extremites === "DEPART_MUR") {
      // Départ contre mur + 3 angles + 1 terminaison
      nbPoteauxAngle = 3;
      nbPoteauxBoutStandards = 1;
      nbDemiPoteauxMuraux = 1;
    } else {
      // ENTRE_MURS : départ et arrivée contre mur + 3 angles
      nbPoteauxAngle = 3;
      nbPoteauxBoutStandards = 0;
      nbDemiPoteauxMuraux = 2;
    }
  } else {
    nbPoteauxAngle =
      config.forme === "DROITE" ? 0 : config.forme === "EN_L" ? 1 : 2;

    if (config.extremites === "LIBRE") {
      nbPoteauxBoutStandards = 2;
      nbDemiPoteauxMuraux = 0;
    } else if (config.extremites === "DEPART_MUR") {
      nbPoteauxBoutStandards = 1;
      nbDemiPoteauxMuraux = 1;
    } else {
      nbPoteauxBoutStandards = 0;
      nbDemiPoteauxMuraux = 2;
    }
  }

  const nbPoteauxDroitsTotal = nbPoteauxIntermediaires + nbPoteauxBoutStandards;
  const totalPoteauxComplets =
    nbPoteauxIntermediaires + nbPoteauxAngle + nbPoteauxBoutStandards;

  const longueurCommandePoteauM =
    config.typePoseSol === "DIRECT_SOL"
      ? config.hauteurUtile + FENCE_CONSTANTS.GARDE_SCELLEMENT_SOL_M
      : config.hauteurUtile + FENCE_CONSTANTS.GARDE_PLATINE_MURET_M;

  const nbPlatines = config.typePoseSol === "SUR_MURET" ? totalPoteauxComplets : 0;
  const nbSacsBeton35kg =
    config.typePoseSol === "DIRECT_SOL"
      ? totalPoteauxComplets * FENCE_CONSTANTS.SACS_BETON_35KG_PAR_POTEAU
      : 0;

  // 4. Quantitatif Lames & Chutes Globales
  const nbTraveesTotal = segmentsActifs.reduce((acc, seg) => acc + seg.nbTraveesSegment, 0);
  const nbTotalLames = nbTraveesTotal * nbLamesParTravee;
  const lineaireTotalM = segmentsActifs.reduce((acc, seg) => acc + seg.longueurSegment, 0);

  const longueurTotaleLamesBrutesM = nbTotalLames * config.longueurLameBrute;
  const longueurTotaleLamesCoupeM = segmentsActifs.reduce(
    (acc, seg) => acc + seg.nbLamesSegment * seg.longueurCoupeLame,
    0
  );
  const chuteTotaleM = Math.max(0, longueurTotaleLamesBrutesM - longueurTotaleLamesCoupeM);
  const tauxChuteGlobalPct =
    longueurTotaleLamesBrutesM > 0
      ? (chuteTotaleM / longueurTotaleLamesBrutesM) * 100
      : 0;

  const alerteChuteElevee = tauxChuteGlobalPct > FENCE_CONSTANTS.SEUIL_ALERTE_CHUTE_PCT;

  return {
    config,
    segmentsActifs,
    isClosedLoop,
    lineaireTotalM,
    porteeMaxRetenueM: porteeMax,
    nbTraveesTotal,
    nbPoteauxAngle,
    nbPoteauxIntermediaires,
    nbPoteauxBoutStandards,
    nbPoteauxDroitsTotal,
    nbDemiPoteauxMuraux,
    totalPoteauxComplets,
    longueurCommandePoteauM,
    nbPlatines,
    nbSacsBeton35kg,
    nbLamesParTravee,
    nbTotalLames,
    longueurTotaleLamesBrutesM,
    longueurTotaleLamesCoupeM,
    chuteTotaleM,
    tauxChuteGlobalPct,
    alerteChuteElevee,
  };
}
