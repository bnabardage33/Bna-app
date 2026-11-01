import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CalepinageRow, CalepinageTerrasseRow, BesoinMateriauRow } from "../../types/database.types.ts";
import type { CalepinageParams, CalepinageResult } from "../calepinage.ts";
import { calculerCalepinageTerrasse } from "../calepinage.ts";
import type { ResultatCalepinage } from "../bardage/calepinageCalcul.ts";
import type { FamillePose, ResultatPose } from "../bardage/poseCalcul.ts";
import { LABELS_FAMILLE } from "../bardage/poseCalcul.ts";

export interface FullCalepinageTerrasse {
  calepinage: CalepinageRow;
  details: CalepinageTerrasseRow;
  besoins: BesoinMateriauRow[];
}

export interface BesoinPayload {
  categorie: string;
  designation: string;
  unite: string;
  quantite: number;
}

/**
 * Construit les besoins matériaux (désignations génériques : aucune référence produit
 * ou fabricant n'est présumée).
 */
export function construireBesoinsTerrasse(result: CalepinageResult, params: CalepinageParams): BesoinPayload[] {
  const fx = result.fixations;
  const besoins: BesoinPayload[] = [
    {
      categorie: "lames",
      designation: `Lames de platelage (${params.largeur_lame_mm} mm x ${params.longueur_lame_m} m)`,
      unite: "lame(s)",
      quantite: result.platelage.nb_lames_commandees,
    },
    {
      categorie: "lambourdes",
      designation: `Lambourdes (barres de ${result.structure.longueur_commerciale_lambourde_m} m)`,
      unite: "barre(s)",
      quantite: result.structure.nb_barres_lambourdes,
    },
    {
      categorie: "plots",
      designation: `Plots (entraxe ${result.details.entraxe_plots_cm} cm)`,
      unite: "plot(s)",
      quantite: result.supports.nb_plots_total,
    },
  ];

  if (result.type_fixation === "vis") {
    besoins.push({
      categorie: "fixations",
      designation: "Vis de fixation des lames",
      unite: "vis",
      quantite: fx.nb_vis_conditionnees,
    });
  } else {
    besoins.push({
      categorie: "fixations",
      designation: "Clips de fixation (courants et aboutages)",
      unite: "clip(s)",
      quantite: fx.nb_clips_courants_aboutages_conditionnes,
    });
    if (fx.nb_clips_depart_fin > 0) {
      besoins.push({
        categorie: "fixations",
        designation: "Clips de départ / fin",
        unite: "clip(s)",
        quantite: fx.nb_clips_depart_fin_conditionnes,
      });
    }
  }
  return besoins;
}

/**
 * Enregistre un calepinage terrasse en créant une NOUVELLE version via la fonction
 * PostgreSQL atomique `creer_calepinage_terrasse` (archivage de l'ancienne version,
 * désactivation de ses besoins non commandés, création de la nouvelle version et de
 * ses besoins, le tout dans une seule transaction avec verrou par chantier).
 * L'entreprise est déduite de la session côté base : `entrepriseId` n'est utilisé que
 * comme contrôle de cohérence côté client.
 */
export async function saveCalepinageTerrasse(
  supabase: SupabaseClient<Database>,
  params: {
    entrepriseId: string;
    chantierId: string;
    userId?: string | null;
    calcParams: CalepinageParams;
  }
): Promise<FullCalepinageTerrasse> {
  if (!params.entrepriseId) throw new Error("Entreprise non identifiée : enregistrement refusé");
  if (!params.chantierId) throw new Error("Chantier non identifié : enregistrement refusé");

  const cp = params.calcParams;
  const result: CalepinageResult = calculerCalepinageTerrasse(cp);

  const details = {
    longueur_m: cp.longueur_m,
    largeur_m: cp.largeur_m,
    orientation_lames: result.sens_pose_lames,
    largeur_lame_mm: cp.largeur_lame_mm,
    longueur_lame_m: cp.longueur_lame_m,
    espace_inter_lames_mm: result.details.joint_inter_lames_mm,
    entraxe_lambourdes_cm: result.details.entraxe_lambourdes_cm,
    entraxe_plots_cm: result.details.entraxe_plots_cm,
    type_fixation: result.type_fixation,
    marge_chutes_pct: result.details.marge_appliquee_pct,
    surface_m2: result.surface_nette_m2,
    ml_lames: result.platelage.ml_lames_avec_marge,
    nb_lames: result.platelage.nb_lames_commandees,
    ml_lambourdes: result.structure.ml_lambourdes_avec_marge,
    nb_lambourdes: result.structure.nb_barres_lambourdes,
    nb_plots: result.supports.nb_plots_total,
    nb_fixations: result.fixations.nb_fixations_a_commander,
    disposition_joints: result.disposition_joints,
  };

  const { data, error } = await (supabase as any).rpc("creer_calepinage_terrasse", {
    p_chantier_id: params.chantierId,
    p_details: details,
    p_parametres: cp,
    p_resultats: result,
    p_besoins: construireBesoinsTerrasse(result, cp),
  });

  if (error) throw error;
  if (!data || !data.calepinage || !data.details) {
    throw new Error("Réponse invalide de la création de calepinage");
  }

  return {
    calepinage: data.calepinage as CalepinageRow,
    details: data.details as CalepinageTerrasseRow,
    besoins: (data.besoins as BesoinMateriauRow[]) || [],
  };
}

/**
 * Récupère le dernier calepinage valide d'un chantier (besoins actifs de cette version uniquement).
 */
export async function getLatestCalepinageTerrasse(
  supabase: SupabaseClient<Database>,
  chantierId: string
): Promise<FullCalepinageTerrasse | null> {
  try {
    const { data: calepinageData, error: calError } = await supabase
      .from("calepinages")
      .select("*")
      .eq("chantier_id", chantierId)
      .eq("metier", "terrasse")
      .eq("statut", "valide")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (calError || !calepinageData) return null;
    const calepinage = calepinageData as CalepinageRow;

    const { data: detailsData, error: detError } = await supabase
      .from("calepinages_terrasse")
      .select("*")
      .eq("calepinage_id", calepinage.id)
      .maybeSingle();

    if (detError || !detailsData) return null;
    const details = detailsData as CalepinageTerrasseRow;

    const { data: besoinsData } = await supabase
      .from("besoins_materiaux")
      .select("*")
      .eq("calepinage_id", calepinage.id);

    return {
      calepinage,
      details,
      besoins: (besoinsData as BesoinMateriauRow[]) || [],
    };
  } catch {
    return null;
  }
}

export interface CalepinageVersionItem {
  calepinage: CalepinageRow;
  details: CalepinageTerrasseRow | null;
}

/**
 * Récupère l'ensemble des versions calepinage terrasse d'un chantier (actifs et archivés)
 * ordonnés par version décroissante (V2, V1, etc.).
 */
export async function getCalepinagesTerrasseByChantier(
  supabase: SupabaseClient<Database>,
  chantierId: string
): Promise<CalepinageVersionItem[]> {
  try {
    const { data: calepinages, error: calError } = await supabase
      .from("calepinages")
      .select("*")
      .eq("chantier_id", chantierId)
      .eq("metier", "terrasse")
      .order("version", { ascending: false });

    if (calError || !calepinages || calepinages.length === 0) return [];

    const calList = calepinages as CalepinageRow[];
    const calIds = calList.map((c) => c.id);
    const { data: detailsData, error: detError } = await supabase
      .from("calepinages_terrasse")
      .select("*")
      .in("calepinage_id", calIds);

    const detailsMap = new Map<string, CalepinageTerrasseRow>();
    if (!detError && detailsData) {
      for (const d of detailsData as CalepinageTerrasseRow[]) {
        detailsMap.set(d.calepinage_id, d);
      }
    }

    return calList.map((c) => ({
      calepinage: c,
      details: detailsMap.get(c.id) || null,
    }));
  } catch {
    return [];
  }
}

export interface BesoinAvecVersion extends BesoinMateriauRow {
  versionCalepinage?: number;
}

export interface BesoinsChantierResult {
  actifs: BesoinMateriauRow[];
  historique: BesoinAvecVersion[];
  totalACommander: number;
}

/**
 * Récupère les besoins d'un chantier, séparés entre actifs (liés au calepinage valide
 * avec statut a_commander) et historique (archivés/annulés/commandés/reçus).
 */
export async function getBesoinsByChantier(
  supabase: SupabaseClient<Database>,
  chantierId: string
): Promise<BesoinsChantierResult> {
  try {
    // 1. Calepinages actuellement valides du chantier (terrasse, facade, cloture)
    const { data: calValidesData } = await supabase
      .from("calepinages")
      .select("id, version")
      .eq("chantier_id", chantierId)
      .eq("statut", "valide");

    const validCalIds = new Set<string>(
      ((calValidesData as { id: string; version: number }[] | null) || []).map((c) => c.id)
    );

    // 2. Dictionnaire des versions de tous les calepinages du chantier
    const { data: allCalsData } = await supabase
      .from("calepinages")
      .select("id, version")
      .eq("chantier_id", chantierId);

    const versionMap = new Map<string, number>();
    if (allCalsData) {
      for (const c of allCalsData as { id: string; version: number }[]) {
        versionMap.set(c.id, c.version);
      }
    }

    // 3. Récupérer tous les besoins du chantier
    const { data: besoins, error } = await supabase
      .from("besoins_materiaux")
      .select("*")
      .eq("chantier_id", chantierId)
      .order("created_at", { ascending: true });

    if (error || !besoins) return { actifs: [], historique: [], totalACommander: 0 };

    const actifs: BesoinMateriauRow[] = [];
    const historique: BesoinAvecVersion[] = [];

    for (const b of besoins as BesoinMateriauRow[]) {
      const version = b.calepinage_id ? versionMap.get(b.calepinage_id) : undefined;
      // Les besoins actifs sont ceux d'un calepinage valide (ou manuels sans calepinage_id) avec statut 'a_commander'
      const isFromValidCal = b.calepinage_id ? validCalIds.has(b.calepinage_id) : true;
      if (isFromValidCal && b.statut === "a_commander") {
        actifs.push(b);
      } else {
        historique.push({
          ...b,
          versionCalepinage: version,
        });
      }
    }

    return {
      actifs,
      historique,
      totalACommander: actifs.length,
    };
  } catch {
    return { actifs: [], historique: [], totalACommander: 0 };
  }
}

export interface BardageBesoinsParams {
  famille: FamillePose;
  largeurM: number;
  hauteurM: number;
  estPignon?: boolean;
  hauteurFaiteM?: number | null;
}

/**
 * Fonction pure : transforme les résultats du moteur Bardage (calepinage + ossature/ITE)
 * en liste de besoins matériaux normalisés prêts pour les commandes fournisseurs.
 */
export function construireBesoinsBardage(
  cal: ResultatCalepinage | null,
  pose: ResultatPose,
  params: BardageBesoinsParams
): BesoinPayload[] {
  const besoins: BesoinPayload[] = [];
  const labelFamille = LABELS_FAMILLE[params.famille] || params.famille;

  // 1. Parement (Plaques HPL / Cassettes ou Lames Bois / Composite)
  if (cal && (params.famille === "hpl" || params.famille === "cassette")) {
    if (cal.nbPlaquesNecessaires > 0) {
      besoins.push({
        categorie: "panneaux",
        designation:
          params.famille === "hpl"
            ? `Plaques brutes HPL (${cal.plaqueBruteLongueurMm} × ${cal.plaqueBruteLargeurMm} mm)`
            : `Cassettes / tôles (${cal.plaqueBruteLongueurMm} × ${cal.plaqueBruteLargeurMm} mm)`,
        unite: "plaque(s)",
        quantite: cal.nbPlaquesNecessaires,
      });
    }
  } else {
    const surfParementM2 = Math.round(pose.isolant.surfaceNetteM2 * 1.1 * 10) / 10;
    if (surfParementM2 > 0) {
      besoins.push({
        categorie: "lames",
        designation: `Clins / Lames de bardage ${labelFamille} (+10% coupe)`,
        unite: "m²",
        quantite: surfParementM2,
      });
    }
  }

  // 2. Ossature primaire (Chevrons / Montants 3,00 m)
  if (pose.nbSegmentsChevrons > 0) {
    besoins.push({
      categorie: "ossature",
      designation:
        params.famille === "cassette"
          ? "Montants ossature aluminium 3,00 m"
          : "Chevrons ossature bois 3,00 m",
      unite: "barre(s)",
      quantite: pose.nbSegmentsChevrons,
    });
  }

  // 3. Équerres de bardage (Porteuses point fixe & Guides coulissantes)
  if (pose.nbEquerresPorteuses > 0) {
    besoins.push({
      categorie: "equerres",
      designation: `Équerres porteuses point fixe — ${pose.isolant.modeleEquerreIsolco}`,
      unite: "pce(s)",
      quantite: pose.nbEquerresPorteuses,
    });
  }
  if (pose.nbEquerresGuides > 0) {
    besoins.push({
      categorie: "equerres",
      designation: `Équerres guides coulissantes — ${pose.isolant.modeleEquerreIsolco}`,
      unite: "pce(s)",
      quantite: pose.nbEquerresGuides,
    });
  }

  // 4. Fixations & Ancrages (Chevilles maçonnerie, Vis ossature, Vis parement)
  if (pose.nbChevillesMurales > 0) {
    besoins.push({
      categorie: "fixations",
      designation: "Chevilles d'ancrage maçonnerie Ø12 mm (2 par équerre)",
      unite: "pce(s)",
      quantite: pose.nbChevillesMurales,
    });
  }
  if (pose.nbVisChevronEquerre > 0) {
    besoins.push({
      categorie: "fixations",
      designation: "Vis inox fixation chevron sur équerre (4/porteuse, 2/guide)",
      unite: "vis",
      quantite: pose.nbVisChevronEquerre,
    });
  }
  if (pose.nbVisParement > 0) {
    besoins.push({
      categorie: "fixations",
      designation:
        params.famille === "hpl"
          ? "Vis parement HPL tête laquée inox"
          : "Vis / pointes inox A2/A4 parement bardage",
      unite: "vis",
      quantite: pose.nbVisParement,
    });
  }

  // 5. Étanchéité & Ventilation (Bande EPDM & Grille anti-rongeurs)
  if (pose.lineaireBandeEPDMM > 0) {
    besoins.push({
      categorie: "etancheite",
      designation: "Bande EPDM protection chevrons 80-100 mm",
      unite: "ml",
      quantite: pose.lineaireBandeEPDMM,
    });
  }
  const nbGrilles = Math.max(1, Math.ceil(params.largeurM / 2.5));
  besoins.push({
    categorie: "etancheite",
    designation: "Profilé grille anti-rongeurs ventilation basse (barre 2,50 m)",
    unite: "barre(s)",
    quantite: nbGrilles,
  });

  // 6. Isolation thermique par l'extérieur (ITE)
  if (pose.isolant.actif && pose.isolant.nbPaquetsACommander > 0) {
    besoins.push({
      categorie: "isolant",
      designation: `Isolant ITE ${pose.isolant.typeIsolant} ép. ${pose.isolant.epaisseurMm} mm`,
      unite: "paquet(s)",
      quantite: pose.isolant.nbPaquetsACommander,
    });
    if (pose.isolant.nbChevillesRosaces > 0) {
      besoins.push({
        categorie: "fixations",
        designation: "Chevilles rosaces d'isolant ITE à frapper (5/m²)",
        unite: "pce(s)",
        quantite: pose.isolant.nbChevillesRosaces,
      });
    }
  }

  return besoins;
}

/**
 * Fusionne et additionne les besoins matériaux de plusieurs façades d'un même chantier
 * (regroupement exact par catégorie + désignation + unité).
 */
export function fusionnerBesoinsBardage(listes: BesoinPayload[][]): BesoinPayload[] {
  const map = new Map<string, BesoinPayload>();
  for (const liste of listes) {
    for (const b of liste) {
      const key = `${b.categorie}||${b.designation}||${b.unite}`;
      const exist = map.get(key);
      if (exist) {
        exist.quantite = Math.round((exist.quantite + b.quantite) * 100) / 100;
      } else {
        map.set(key, { ...b });
      }
    }
  }
  return [...map.values()];
}

/**
 * Enregistre une version de calepinage Bardage/Façade sur le chantier et génère
 * la liste de ses besoins matériaux dans `besoins_materiaux` (statut `a_commander`),
 * en archivant proprement l'éventuelle version façade précédente et ses besoins non commandés.
 */
export async function saveCalepinageBardage(
  supabase: SupabaseClient<Database>,
  params: {
    entrepriseId: string;
    chantierId: string;
    userId?: string | null;
    cal?: ResultatCalepinage | null;
    pose?: ResultatPose;
    bardageParams?: BardageBesoinsParams;
    besoinsPayloads?: BesoinPayload[];
  }
): Promise<{ calepinage: CalepinageRow; besoins: BesoinMateriauRow[]; payloads: BesoinPayload[] }> {
  if (!params.entrepriseId) throw new Error("Entreprise non identifiée : enregistrement refusé");
  if (!params.chantierId) throw new Error("Chantier non identifié : enregistrement refusé");

  const payloads =
    params.besoinsPayloads && params.besoinsPayloads.length > 0
      ? params.besoinsPayloads
      : params.pose && params.bardageParams
      ? construireBesoinsBardage(params.cal ?? null, params.pose, params.bardageParams)
      : [];
  if (payloads.length === 0) {
    throw new Error("Aucun besoin matériau généré : vérifiez les dimensions de la façade");
  }

  // 1. Récupérer les versions existantes du métier 'facade' sur ce chantier
  const { data: existingCals, error: listErr } = await supabase
    .from("calepinages")
    .select("*")
    .eq("chantier_id", params.chantierId)
    .eq("metier", "facade")
    .order("version", { ascending: false });

  if (listErr) throw listErr;

  const calList = (existingCals as CalepinageRow[] | null) || [];
  const maxVersion = calList.reduce((m, c) => Math.max(m, c.version), 0);
  const nextVersion = maxVersion + 1;
  const activeIds = calList.filter((c) => c.statut === "valide").map((c) => c.id);

  // 2. Archiver l'ancienne version façade active et annuler ses besoins encore 'a_commander'
  if (activeIds.length > 0) {
    const { error: archErr } = await (supabase.from("calepinages") as any)
      .update({ statut: "archive" })
      .in("id", activeIds);
    if (archErr) throw archErr;

    const { error: cancelErr } = await (supabase.from("besoins_materiaux") as any)
      .update({ statut: "annule" })
      .in("calepinage_id", activeIds)
      .eq("statut", "a_commander");
    if (cancelErr) throw cancelErr;
  }

  // 3. Créer la nouvelle version 'valide'
  const { data: newCal, error: insCalErr } = await (supabase.from("calepinages") as any)
    .insert({
      entreprise_id: params.entrepriseId,
      chantier_id: params.chantierId,
      metier: "facade",
      version: nextVersion,
      statut: "valide",
      created_by: params.userId || null,
    })
    .select("*")
    .single();

  if (insCalErr || !newCal) {
    throw insCalErr || new Error("Impossible de créer la version de calepinage façade");
  }

  const calepinage = newCal as CalepinageRow;

  // 4. Insérer les besoins matériaux rattachés à cette nouvelle version
  const rowsToInsert = payloads.map((b) => ({
    entreprise_id: params.entrepriseId,
    chantier_id: params.chantierId,
    calepinage_id: calepinage.id,
    categorie: b.categorie,
    designation: b.designation,
    unite: b.unite,
    quantite: b.quantite,
    origine: "calepinage",
    statut: "a_commander",
  }));

  const { data: insertedBesoins, error: insBesErr } = await (supabase.from("besoins_materiaux") as any)
    .insert(rowsToInsert)
    .select("*");

  if (insBesErr) throw insBesErr;

  return {
    calepinage,
    besoins: (insertedBesoins as BesoinMateriauRow[]) || [],
    payloads,
  };
}


