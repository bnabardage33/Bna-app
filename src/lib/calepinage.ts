/**
 * Moteur de calcul déterministe pour le calepinage terrasse (règles DTU 51.4).
 * Même algorithme strict que le backend Python.
 */

export interface CalepinageParams {
  longueur_m: number;
  largeur_m: number;
  largeur_lame_mm: number;
  longueur_lame_m: number;
  espace_inter_lames_mm?: number;
  entraxe_lambourdes_cm?: number;
  espace_entre_plots_cm?: number;
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
  nb_vis_inox: number;
}

export function calculerCalepinageTerrasse(p: CalepinageParams): CalepinageResult {
  const espaceInter = p.espace_inter_lames_mm ?? 5;
  const entraxeLambourdes = p.entraxe_lambourdes_cm ?? 40;
  const espacePlots = p.espace_entre_plots_cm ?? 50;
  const margeChutes = p.marge_chutes_pct ?? 10;

  const surface = Math.round(p.longueur_m * p.largeur_m * 100) / 100;
  const largeurUtile = (p.largeur_lame_mm + espaceInter) / 1000;
  const nbRangees = Math.ceil(p.largeur_m / largeurUtile);

  const mlLamesBrut = nbRangees * p.longueur_m;
  const margeFacteur = 1 + margeChutes / 100;
  const mlLamesTotal = Math.round(mlLamesBrut * margeFacteur * 100) / 100;

  const nbLamesTheorique = Math.ceil(mlLamesBrut / p.longueur_lame_m);
  const nbLamesAvecMarge = Math.ceil(mlLamesTotal / p.longueur_lame_m);

  // Lambourdes
  const entraxeM = entraxeLambourdes / 100;
  const nbLignesLambourdes = Math.ceil(p.longueur_m / entraxeM) + 1;
  const mlLambourdesBrut = nbLignesLambourdes * p.largeur_m;
  const mlLambourdesTotal = Math.round(mlLambourdesBrut * 1.07 * 100) / 100;
  const nbLambourdes3m = Math.ceil(mlLambourdesTotal / 3.0);

  // Plots
  const espacePlotsM = espacePlots / 100;
  const plotsParLigne = Math.ceil(p.largeur_m / espacePlotsM) + 1;
  const nbPlots = nbLignesLambourdes * plotsParLigne;

  // Vis (2 vis par intersection lame/lambourde + 5% sécu arrondi paquet 100)
  const nbVisBrut = nbRangees * nbLignesLambourdes * 2;
  const nbVisInox = Math.ceil((nbVisBrut * 1.05) / 100) * 100;

  return {
    surface_nette_m2: surface,
    nb_lames_theorique: nbLamesTheorique,
    nb_lames_avec_marge: nbLamesAvecMarge,
    ml_lames_total: mlLamesTotal,
    nb_rangees: nbRangees,
    ml_lambourdes_total: mlLambourdesTotal,
    nb_lambourdes_3m: nbLambourdes3m,
    nb_plots_necessaires: nbPlots,
    nb_vis_inox: nbVisInox,
  };
}
