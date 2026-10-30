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
