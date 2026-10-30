/**
 * Quantitatif Terrasse — estimation technique déterministe (V1.1, joints alignés).
 *
 * Ce moteur produit un quantitatif INDICATIF. Il ne constitue ni une certification,
 * ni une garantie de conformité à un DTU, un DTA ou une prescription fabricant.
 * Les règles dépendantes du produit, du support ou du fabricant sont des paramètres
 * configurables et ne sont jamais présentées comme universelles.
 *
 * Périmètre V1.1 : sens de pose, joints alignés, trame réelle des lambourdes,
 * plots, fixations (vis / clips), conditionnements configurables.
 * Hors périmètre : joints en quinconce, optimisation des chutes, réservations,
 * escalier, garde-corps, composite fabricant, accessoires.
 */

export type SensPoseLames = "longueur" | "largeur";
export type DispositionJoints = "alignes" | "quinconce";
export type TypeFixationCalepinage = "vis" | "clips";

export interface CalepinageParams {
  longueur_m: number;
  largeur_m: number;
  /** Direction dans laquelle courent les lames (défaut : longueur). */
  sens_pose_lames?: SensPoseLames;
  /** Seul "alignes" est implémenté. "quinconce" est réservé (rejeté pour l'instant). */
  disposition_joints?: DispositionJoints;

  largeur_lame_mm: number;
  longueur_lame_m: number;
  espace_inter_lames_mm?: number;
  marge_chutes_pct?: number;

  entraxe_lambourdes_cm?: number;
  /** Longueur commerciale des lambourdes (3, 4 ou saisie personnalisée). */
  longueur_lambourde_commerciale_m?: number;
  marge_lambourdes_pct?: number;
  /** Largeur de section d'une lambourde (hypothèse de géométrie des appuis jumelés). */
  largeur_lambourde_mm?: number;
  /** true : deux appuis distincts (un par extrémité de lame) au droit de chaque joint. */
  appuis_distincts_aboutage?: boolean;

  entraxe_plots_cm?: number;
  /** Ancien nom conservé pour compatibilité. */
  espace_entre_plots_cm?: number;

  type_fixation?: TypeFixationCalepinage;
  marge_fixations_pct?: number;
  /** Conditionnements : volontairement SANS valeur universelle par défaut. */
  taille_boite_vis?: number;
  taille_boite_clips?: number;
  taille_boite_clips_depart_fin?: number;
  utiliser_clips_depart_fin?: boolean;
}

export interface CalepinageResult {
  surface_nette_m2: number;
  sens_pose_lames: SensPoseLames;
  disposition_joints: DispositionJoints;
  longueur_pose_m: number;
  largeur_couverte_m: number;
  type_fixation: TypeFixationCalepinage;

  platelage: {
    nb_rangees: number;
    nb_rangees_geometrique_exact: number;
    ml_lames_brut: number;
    ml_lames_avec_marge: number;
    nb_lames_entieres_theorique: number;
    nb_lames_commandees: number;
    nb_segments_par_rangee: number;
    nb_aboutages_interieurs_par_rangee: number;
    nb_aboutages_total: number;
    positions_aboutages_m: number[];
    /** Estimation linéaire avec marge — pas une optimisation de débit. */
    estimation_lineaire: true;
  };

  structure: {
    positions_lambourdes_m: number[];
    positions_aboutages_m: number[];
    nb_lignes_lambourdes_base: number;
    nb_appuis_aboutage_ajoutes: number;
    nb_lignes_lambourdes_total: number;
    entraxe_max_reel_cm: number;
    longueur_lambourde_sur_terrasse_m: number;
    ml_lambourdes_brut: number;
    ml_lambourdes_avec_marge: number;
    longueur_commerciale_lambourde_m: number;
    nb_barres_lambourdes: number;
  };

  supports: {
    plots_par_ligne: number;
    plots_lignes_base: number;
    plots_appuis_aboutage: number;
    nb_plots_total: number;
  };

  fixations: {
    type: TypeFixationCalepinage;
    nb_croisements_courants: number;
    nb_croisements_aboutage: number;
    marge_fixations_pct: number;
    /** Vis */
    nb_vis_courantes: number;
    nb_vis_aboutages: number;
    nb_vis_brut: number;
    nb_vis_avec_marge: number;
    taille_boite_vis: number | null;
    nb_boites_vis: number | null;
    nb_vis_conditionnees: number;
    /** Clips */
    nb_clips_courants: number;
    nb_clips_aboutages: number;
    nb_clips_depart_fin: number;
    nb_clips_total: number;
    taille_boite_clips: number | null;
    taille_boite_clips_depart_fin: number | null;
    nb_boites_clips: number | null;
    nb_boites_clips_depart_fin: number | null;
    nb_clips_conditionnes: number;
    nb_clips_courants_aboutages_conditionnes: number;
    nb_clips_depart_fin_conditionnes: number;
    /** Quantité principale à commander (vis OU clips, départ/fin inclus). */
    nb_fixations_a_commander: number;
  };

  avertissements: string[];

  details: {
    entraxe_lambourdes_cm: number;
    entraxe_plots_cm: number;
    joint_inter_lames_mm: number;
    marge_appliquee_pct: number;
    marge_lambourdes_pct: number;
    largeur_lambourde_mm: number;
    appuis_distincts_aboutage: boolean;
  };
}

const EPS_MM = 0.5;

function fail(msg: string): never {
  throw new Error(msg);
}

function requirePositive(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    fail(`${label} invalide : une valeur strictement supérieure à 0 est requise`);
  }
  return value;
}

function requirePercent(value: unknown, label: string, max = 100): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) {
    fail(`${label} invalide : valeur comprise entre 0 et ${max} requise`);
  }
  return value;
}

function optionalBoxSize(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    fail(`${label} invalide : entier strictement positif requis`);
  }
  return value;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;
const mmToM = (mm: number) => Math.round(mm * 10) / 10 / 1000;

/** Positions (mm) des joints alignés : multiples de la longueur de lame, strictement < longueur_pose. */
export function positionsAboutagesMm(longueurPoseMm: number, longueurLameMm: number): number[] {
  const res: number[] = [];
  for (let k = 1; k * longueurLameMm < longueurPoseMm - EPS_MM; k++) {
    res.push(k * longueurLameMm);
  }
  return res;
}

/**
 * Génère la trame réelle des lambourdes le long de l'axe de pose (mm).
 * 1) grille régulière à l'entraxe maximal, rives incluses ;
 * 2) appuis d'aboutage (1 ou 2 par joint) ;
 * 3) retrait des lignes régulières qui chevaucheraient physiquement un appui d'aboutage ;
 * 4) subdivision de tout intervalle > entraxe ;
 * 5) tri + dédoublonnage.
 */
export function genererTrameLambourdesMm(opts: {
  longueurPoseMm: number;
  entraxeMm: number;
  aboutagesMm: number[];
  largeurLambourdeMm: number;
  appuisDistincts: boolean;
}): { positionsMm: number[]; baseCount: number } {
  const { longueurPoseMm: L, entraxeMm: e, aboutagesMm, largeurLambourdeMm: w, appuisDistincts } = opts;

  // 1. grille régulière
  const regular: number[] = [];
  for (let p = 0; p < L - EPS_MM; p += e) regular.push(p);
  regular.push(L);
  const baseCount = regular.length;

  // 2. appuis d'aboutage
  const appuis: number[] = [];
  for (const x of aboutagesMm) {
    if (appuisDistincts) {
      appuis.push(round1(x - w / 2), round1(x + w / 2));
    } else {
      appuis.push(x);
    }
  }
  const demi = appuisDistincts ? w / 2 : 0;
  for (const x of aboutagesMm) {
    if (x - demi < w - EPS_MM || x + demi > L - w + EPS_MM) {
      fail("Aboutage trop proche d'une rive : la pièce résiduelle est trop courte pour disposer ses appuis");
    }
  }

  // 3. retrait des lignes régulières en conflit (hors rives)
  const kept = regular.filter((p, i) => {
    if (i === 0 || i === regular.length - 1) return true;
    return !appuis.some((a) => Math.abs(p - a) < w - EPS_MM);
  });

  // 5 (partiel). tri + dédoublonnage
  const merged = [...kept, ...appuis].sort((a, b) => a - b);
  let positions: number[] = [];
  for (const p of merged) {
    if (positions.length === 0 || p - positions[positions.length - 1] > EPS_MM) positions.push(p);
  }

  // 4. subdivision des intervalles > entraxe
  const filled: number[] = [positions[0]];
  for (let i = 1; i < positions.length; i++) {
    const a = positions[i - 1];
    const b = positions[i];
    const gap = b - a;
    if (gap > e + 1e-6) {
      const n = Math.ceil(gap / e - 1e-9);
      for (let k = 1; k < n; k++) filled.push(round1(a + (gap * k) / n));
    }
    filled.push(b);
  }
  positions = filled;

  return { positionsMm: positions, baseCount };
}

export function calculerCalepinageTerrasse(p: CalepinageParams): CalepinageResult {
  const longueur = requirePositive(p.longueur_m, "Longueur");
  const largeur = requirePositive(p.largeur_m, "Largeur");
  const largeurLameMm = requirePositive(p.largeur_lame_mm, "Largeur de lame");
  const longueurLame = requirePositive(p.longueur_lame_m, "Longueur de lame");

  const sens: SensPoseLames = p.sens_pose_lames ?? "longueur";
  if (sens !== "longueur" && sens !== "largeur") fail("Sens de pose invalide");

  const disposition: DispositionJoints = p.disposition_joints ?? "alignes";
  if (disposition === "quinconce") {
    fail("Disposition des joints « quinconce » : calcul non disponible dans cette version");
  }
  if (disposition !== "alignes") fail("Disposition des joints invalide");

  const espaceInter = p.espace_inter_lames_mm ?? 5;
  if (typeof espaceInter !== "number" || !Number.isFinite(espaceInter) || espaceInter < 0) {
    fail("Jeu entre lames invalide : valeur positive ou nulle requise");
  }
  const margeLames = requirePercent(p.marge_chutes_pct ?? 10, "Marge lames", 100);

  const entraxeLambCm = requirePositive(p.entraxe_lambourdes_cm ?? 40, "Entraxe lambourdes");
  if (entraxeLambCm < 10) fail("Entraxe lambourdes invalide : minimum 10 cm");
  const longueurCommLamb = requirePositive(p.longueur_lambourde_commerciale_m ?? 3, "Longueur commerciale lambourdes");
  const margeLamb = requirePercent(p.marge_lambourdes_pct ?? 8, "Marge lambourdes", 100);
  const largeurLambMm = requirePositive(p.largeur_lambourde_mm ?? 45, "Largeur de lambourde");
  const appuisDistincts = p.appuis_distincts_aboutage ?? true;

  const entraxePlotsCm = requirePositive(p.entraxe_plots_cm ?? p.espace_entre_plots_cm ?? 50, "Entraxe plots");

  const typeFixation: TypeFixationCalepinage = p.type_fixation ?? "vis";
  if (typeFixation !== "vis" && typeFixation !== "clips") fail("Type de fixation invalide");
  const margeFix = requirePercent(p.marge_fixations_pct ?? 5, "Marge fixations", 100);
  const boiteVis = optionalBoxSize(p.taille_boite_vis, "Taille boîte de vis");
  const boiteClips = optionalBoxSize(p.taille_boite_clips, "Taille boîte de clips");
  const boiteClipsDF = optionalBoxSize(p.taille_boite_clips_depart_fin, "Taille boîte de clips départ/fin");
  const clipsDepartFin = p.utiliser_clips_depart_fin ?? false;

  // --- Géométrie : sens de pose ---
  const longueurPose = sens === "longueur" ? longueur : largeur;
  const largeurCouverte = sens === "longueur" ? largeur : longueur;
  const surface = round2(longueur * largeur);

  const longueurPoseMm = Math.round(longueurPose * 1000);
  const longueurLameMm = Math.round(longueurLame * 1000);

  // --- Aboutages alignés ---
  const nbSegments = Math.ceil((longueurPoseMm - EPS_MM) / longueurLameMm);
  const nbAboutagesParRangee = Math.max(0, nbSegments - 1);
  const aboutagesMm = positionsAboutagesMm(longueurPoseMm, longueurLameMm);
  if (aboutagesMm.length !== nbAboutagesParRangee) {
    fail("Incohérence interne : nombre d'aboutages et positions divergent");
  }

  // --- Lames ---
  const largeurUtileM = (largeurLameMm + espaceInter) / 1000;
  const nbRangeesExact = largeurCouverte / largeurUtileM;
  const nbRangees = Math.ceil(nbRangeesExact - 1e-9);
  const mlLamesBrut = nbRangees * longueurPose;
  const mlLamesMarge = mlLamesBrut * (1 + margeLames / 100);
  const nbLamesTheorique = Math.ceil(mlLamesBrut / longueurLame - 1e-9);
  const nbLamesCommandees = Math.ceil(mlLamesMarge / longueurLame - 1e-9);
  const nbAboutagesTotal = nbRangees * nbAboutagesParRangee;

  // --- Trame de lambourdes ---
  const entraxeMm = entraxeLambCm * 10;
  const trame = genererTrameLambourdesMm({
    longueurPoseMm,
    entraxeMm,
    aboutagesMm,
    largeurLambourdeMm: largeurLambMm,
    appuisDistincts,
  });
  const nbLignes = trame.positionsMm.length;
  const nbAjoutes = nbLignes - trame.baseCount;
  let ecartMax = 0;
  for (let i = 1; i < trame.positionsMm.length; i++) {
    ecartMax = Math.max(ecartMax, trame.positionsMm[i] - trame.positionsMm[i - 1]);
  }
  if (ecartMax > entraxeMm + 1e-6) fail("Incohérence interne : entraxe maximal dépassé dans la trame");

  const mlLambBrut = nbLignes * largeurCouverte;
  const mlLambMarge = mlLambBrut * (1 + margeLamb / 100);
  const nbBarres = Math.ceil(mlLambMarge / longueurCommLamb - 1e-9);

  // --- Plots ---
  const entraxePlotsMm = entraxePlotsCm * 10;
  const plotsParLigne = Math.ceil(Math.round(largeurCouverte * 1000) / entraxePlotsMm - 1e-9) + 1;
  const plotsTotal = nbLignes * plotsParLigne;
  const plotsBase = trame.baseCount * plotsParLigne;
  const plotsAboutage = plotsTotal - plotsBase;

  // --- Fixations ---
  const supportsParJoint = appuisDistincts ? 2 : 1;
  const nbLignesAboutage = nbAboutagesParRangee * supportsParJoint;
  const nbLignesCourantes = nbLignes - nbLignesAboutage;
  const croisementsCourants = nbRangees * nbLignesCourantes;
  // chaque extrémité de lame d'un joint est fixée : 2 extrémités par joint et par rangée
  const extremitesAboutage = nbRangees * nbAboutagesParRangee * 2;
  const croisementsAboutage = nbRangees * nbLignesAboutage;

  const vis = {
    courantes: 2 * croisementsCourants,
    aboutages: 2 * extremitesAboutage,
  };
  const visBrut = vis.courantes + vis.aboutages;
  const visMarge = Math.ceil(visBrut * (1 + margeFix / 100) - 1e-9);
  const nbBoitesVis = boiteVis ? Math.ceil(visMarge / boiteVis) : null;
  const visCond = boiteVis && nbBoitesVis !== null ? nbBoitesVis * boiteVis : visMarge;

  const clipsCourants = croisementsCourants;
  const clipsAboutages = extremitesAboutage;
  const clipsDF = clipsDepartFin ? 2 * nbLignes : 0;
  const clipsCABrut = clipsCourants + clipsAboutages;
  const clipsCAMarge = Math.ceil(clipsCABrut * (1 + margeFix / 100) - 1e-9);
  const clipsTotal = clipsCAMarge + clipsDF;
  const nbBoitesClips = boiteClips ? Math.ceil(clipsCAMarge / boiteClips) : null;
  const nbBoitesClipsDF = clipsDF > 0 && boiteClipsDF ? Math.ceil(clipsDF / boiteClipsDF) : null;
  const clipsCACond = boiteClips && nbBoitesClips !== null ? nbBoitesClips * boiteClips : clipsCAMarge;
  const clipsDFCond = clipsDF > 0 && boiteClipsDF && nbBoitesClipsDF !== null ? nbBoitesClipsDF * boiteClipsDF : clipsDF;
  const clipsCond = clipsCACond + clipsDFCond;

  const aCommander = typeFixation === "vis" ? visCond : clipsCond;

  const avertissements: string[] = [];
  if (largeurCouverte > longueurCommLamb + 1e-9) {
    avertissements.push(
      "La longueur de chaque lambourde dépasse la longueur commerciale : les aboutages de lambourdes ne sont pas modélisés (quantité linéaire avec marge)."
    );
  }
  if (typeFixation === "vis" && !boiteVis) {
    avertissements.push("Conditionnement des vis non renseigné : quantité non arrondie à la boîte.");
  }
  if (typeFixation === "clips" && !boiteClips) {
    avertissements.push("Conditionnement des clips non renseigné : quantité non arrondie à la boîte.");
  }
  if (typeFixation === "clips" && clipsDF > 0 && !boiteClipsDF) {
    avertissements.push("Conditionnement des clips départ/fin non renseigné : quantité non arrondie à la boîte.");
  }
  avertissements.push(
    "Quantité de lames = estimation linéaire avec marge ; aucune optimisation de débit ni réutilisation de chutes n'est modélisée."
  );

  const result: CalepinageResult = {
    surface_nette_m2: surface,
    sens_pose_lames: sens,
    disposition_joints: disposition,
    longueur_pose_m: round2(longueurPose),
    largeur_couverte_m: round2(largeurCouverte),
    type_fixation: typeFixation,
    platelage: {
      nb_rangees: nbRangees,
      nb_rangees_geometrique_exact: Math.round(nbRangeesExact * 1000) / 1000,
      ml_lames_brut: round2(mlLamesBrut),
      ml_lames_avec_marge: round2(mlLamesMarge),
      nb_lames_entieres_theorique: nbLamesTheorique,
      nb_lames_commandees: nbLamesCommandees,
      nb_segments_par_rangee: nbSegments,
      nb_aboutages_interieurs_par_rangee: nbAboutagesParRangee,
      nb_aboutages_total: nbAboutagesTotal,
      positions_aboutages_m: aboutagesMm.map(mmToM),
      estimation_lineaire: true,
    },
    structure: {
      positions_lambourdes_m: trame.positionsMm.map(mmToM),
      positions_aboutages_m: aboutagesMm.map(mmToM),
      nb_lignes_lambourdes_base: trame.baseCount,
      nb_appuis_aboutage_ajoutes: nbAjoutes,
      nb_lignes_lambourdes_total: nbLignes,
      entraxe_max_reel_cm: Math.round(ecartMax) / 10,
      longueur_lambourde_sur_terrasse_m: round2(largeurCouverte),
      ml_lambourdes_brut: round2(mlLambBrut),
      ml_lambourdes_avec_marge: round2(mlLambMarge),
      longueur_commerciale_lambourde_m: longueurCommLamb,
      nb_barres_lambourdes: nbBarres,
    },
    supports: {
      plots_par_ligne: plotsParLigne,
      plots_lignes_base: plotsBase,
      plots_appuis_aboutage: plotsAboutage,
      nb_plots_total: plotsTotal,
    },
    fixations: {
      type: typeFixation,
      nb_croisements_courants: croisementsCourants,
      nb_croisements_aboutage: croisementsAboutage,
      marge_fixations_pct: margeFix,
      nb_vis_courantes: vis.courantes,
      nb_vis_aboutages: vis.aboutages,
      nb_vis_brut: visBrut,
      nb_vis_avec_marge: visMarge,
      taille_boite_vis: boiteVis,
      nb_boites_vis: nbBoitesVis,
      nb_vis_conditionnees: visCond,
      nb_clips_courants: clipsCourants,
      nb_clips_aboutages: clipsAboutages,
      nb_clips_depart_fin: clipsDF,
      nb_clips_total: clipsTotal,
      taille_boite_clips: boiteClips,
      taille_boite_clips_depart_fin: boiteClipsDF,
      nb_boites_clips: nbBoitesClips,
      nb_boites_clips_depart_fin: nbBoitesClipsDF,
      nb_clips_conditionnes: clipsCond,
      nb_clips_courants_aboutages_conditionnes: clipsCACond,
      nb_clips_depart_fin_conditionnes: clipsDFCond,
      nb_fixations_a_commander: aCommander,
    },
    avertissements,
    details: {
      entraxe_lambourdes_cm: entraxeLambCm,
      entraxe_plots_cm: entraxePlotsCm,
      joint_inter_lames_mm: espaceInter,
      marge_appliquee_pct: margeLames,
      marge_lambourdes_pct: margeLamb,
      largeur_lambourde_mm: largeurLambMm,
      appuis_distincts_aboutage: appuisDistincts,
    },
  };

  assertFinite(result);
  return result;
}

function assertFinite(value: unknown, path = "resultat"): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(`Résultat non fini (${path})`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => assertFinite(v, `${path}[${i}]`));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertFinite(v, `${path}.${k}`);
  }
}
