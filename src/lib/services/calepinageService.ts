import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CalepinageRow, CalepinageTerrasseRow, BesoinMateriauRow } from "../../types/database.types.ts";
import type { CalepinageParams, CalepinageResult } from "../calepinage.ts";
import { calculerCalepinageTerrasse } from "../calepinage.ts";

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
 * Récupère les besoins d'un chantier, séparés entre actifs (liés au calepinage terrasse valide
 * avec statut a_commander) et historique (archivés/annulés/commandés/reçus).
 */
export async function getBesoinsByChantier(
  supabase: SupabaseClient<Database>,
  chantierId: string
): Promise<BesoinsChantierResult> {
  try {
    // 1. Calepinage terrasse actuellement valide
    const { data: calValideData } = await supabase
      .from("calepinages")
      .select("id, version")
      .eq("chantier_id", chantierId)
      .eq("metier", "terrasse")
      .eq("statut", "valide")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const calValide = calValideData as { id: string; version: number } | null;

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
    const calValideId = calValide?.id;

    for (const b of besoins as BesoinMateriauRow[]) {
      const version = b.calepinage_id ? versionMap.get(b.calepinage_id) : undefined;
      // Les besoins actifs sont ceux du calepinage terrasse actuellement valide avec statut 'a_commander'
      if (calValideId && b.calepinage_id === calValideId && b.statut === "a_commander") {
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

