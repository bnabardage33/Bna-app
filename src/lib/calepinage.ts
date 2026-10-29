/**
 * Moteur de calcul déterministe pour le calepinage terrasse (règles DTU 51.4).
 * Formules formalisées, testables et indépendantes de toute IA.
 */

export interface CalepinageParams {
  longueur_m: number;
  largeur_m: number;
  largeur_lame_mm: number;
  longueur_lame_m: number;
  espace_inter_lames_mm?: number;
  entraxe_lambourdes_cm?: number;
  entraxe_plots_cm?: number;
  espace_entre_plots_cm?: number;
  type_fixation?: "vis" | "clips";
  marge_chutes_pct?: number;
}

export interface CalepinageResult {
  surface_nette_m2: number;
  nb_lames_theorique: number;
  nb_lames_avec_marge: number;
  ml_lames_total: number;
  nb_rangees: number;
  ml_lambourdes_total: number;
  nb_lambourdes_3m: number;
  nb_plots_necessaires: number;
  nb_fixations: number;
  type_fixation: "vis" | "clips";
  details: {
    entraxe_lambourdes_cm: number;
    entraxe_plots_cm: number;
    joint_inter_lames_mm: number;
    marge_appliquee_pct: number;
  };
}

export function calculerCalepinageTerrasse(p: CalepinageParams): CalepinageResult {
  if (p.longueur_m <= 0 || p.largeur_m <= 0 || p.largeur_lame_mm <= 0 || p.longueur_lame_m <= 0) {
    throw new Error("Dimensions invalides : les valeurs doivent être strictement supérieures à 0");
  }

  const espaceInter = p.espace_inter_lames_mm ?? 5;
  const entraxeLambourdes = p.entraxe_lambourdes_cm ?? 40;
  const entraxePlots = p.entraxe_plots_cm ?? p.espace_entre_plots_cm ?? 50;
  const margeChutes = p.marge_chutes_pct ?? 10;
  const typeFixation = p.type_fixation ?? "vis";

  // 1. Surface nette
  const surface = Math.round(p.longueur_m * p.largeur_m * 100) / 100;

  // 2. Lames de terrasse
  const largeurUtile = (p.largeur_lame_mm + espaceInter) / 1000;
  const nbRangees = Math.ceil(p.largeur_m / largeurUtile);
  const mlLamesBrut = nbRangees * p.longueur_m;
  const margeFacteur = 1 + margeChutes / 100;
  const mlLamesTotal = Math.round(mlLamesBrut * margeFacteur * 100) / 100;
  const nbLamesTheorique = Math.ceil(mlLamesBrut / p.longueur_lame_m);
  const nbLamesAvecMarge = Math.ceil(mlLamesTotal / p.longueur_lame_m);

  // 3. Lambourdes (ossature porteuse DTU 51.4)
  const entraxeM = entraxeLambourdes / 100;
  const nbLignesLambourdes = Math.ceil(p.longueur_m / entraxeM) + 1;
  const mlLambourdesBrut = nbLignesLambourdes * p.largeur_m;
  // Majoration de 7% pour chutes et aboutages lambourdes
  const mlLambourdesTotal = Math.round(mlLambourdesBrut * 1.07 * 100) / 100;
  const nbLambourdes3m = Math.ceil(mlLambourdesTotal / 3.0);

  // 4. Plots réglables ou points d'appui
  const espacePlotsM = entraxePlots / 100;
  const plotsParLigne = Math.ceil(p.largeur_m / espacePlotsM) + 1;
  const nbPlots = nbLignesLambourdes * plotsParLigne;

  // 5. Fixations (2 vis par appui si vissé, 1 clip par appui si clipsé + arrondi conditionnement)
  const nbPointsFixation = nbRangees * nbLignesLambourdes;
  const nbFixationsBrut = typeFixation === "vis" ? nbPointsFixation * 2 : nbPointsFixation;
  const nbFixations = Math.ceil((nbFixationsBrut * 1.05) / 100) * 100;

  return {
    surface_nette_m2: surface,
    nb_lames_theorique: nbLamesTheorique,
    nb_lames_avec_marge: nbLamesAvecMarge,
    ml_lames_total: mlLamesTotal,
    nb_rangees: nbRangees,
    ml_lambourdes_total: mlLambourdesTotal,
    nb_lambourdes_3m: nbLambourdes3m,
    nb_plots_necessaires: nbPlots,
    nb_fixations: nbFixations,
    type_fixation: typeFixation,
    details: {
      entraxe_lambourdes_cm: entraxeLambourdes,
      entraxe_plots_cm: entraxePlots,
      joint_inter_lames_mm: espaceInter,
      marge_appliquee_pct: margeChutes,
    },
  };
}
