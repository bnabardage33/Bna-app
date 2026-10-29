import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CalepinageRow, CalepinageTerrasseRow, BesoinMateriauRow } from "../../types/database.types.ts";
import type { CalepinageParams, CalepinageResult } from "../calepinage.ts";
import { calculerCalepinageTerrasse } from "../calepinage.ts";

export interface FullCalepinageTerrasse {
  calepinage: CalepinageRow;
  details: CalepinageTerrasseRow;
  besoins: BesoinMateriauRow[];
}

/**
 * Enregistre ou versionne un calepinage terrasse et génère les besoins matériaux associés
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
  const result: CalepinageResult = calculerCalepinageTerrasse(params.calcParams);

  // 1. Déterminer la version suivante pour ce chantier
  const { data: existing } = await (supabase.from("calepinages") as any)
    .select("version")
    .eq("chantier_id", params.chantierId)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = existing && existing.length > 0 ? (existing[0] as any).version + 1 : 1;

  // 2. Si versions antérieures, archiver les anciennes versions
  if (nextVersion > 1) {
    await (supabase.from("calepinages") as any)
      .update({ statut: "archive" })
      .eq("chantier_id", params.chantierId)
      .eq("statut", "valide");
  }

  // 3. Créer le calepinage parent
  const { data: calepinageData, error: calError } = await (supabase.from("calepinages") as any)
    .insert({
      entreprise_id: params.entrepriseId,
      chantier_id: params.chantierId,
      metier: "terrasse",
      version: nextVersion,
      statut: "valide",
      created_by: params.userId || null,
    })
    .select()
    .single();

  if (calError) throw calError;
  const calepinage = calepinageData as CalepinageRow;

  // 4. Créer les détails techniques terrasse
  const { data: terrasseData, error: terError } = await (supabase.from("calepinages_terrasse") as any)
    .insert({
      calepinage_id: calepinage.id,
      entreprise_id: params.entrepriseId,
      longueur_m: params.calcParams.longueur_m,
      largeur_m: params.calcParams.largeur_m,
      orientation_lames: "longueur",
      largeur_lame_mm: params.calcParams.largeur_lame_mm,
      longueur_lame_m: params.calcParams.longueur_lame_m,
      espace_inter_lames_mm: params.calcParams.espace_inter_lames_mm ?? 5.0,
      entraxe_lambourdes_cm: params.calcParams.entraxe_lambourdes_cm ?? 40.0,
      entraxe_plots_cm: params.calcParams.entraxe_plots_cm ?? 50.0,
      type_fixation: result.type_fixation,
      marge_chutes_pct: params.calcParams.marge_chutes_pct ?? 10.0,
      surface_m2: result.surface_nette_m2,
      ml_lames: result.ml_lames_total,
      nb_lames: result.nb_lames_avec_marge,
      ml_lambourdes: result.ml_lambourdes_total,
      nb_lambourdes: result.nb_lambourdes_3m,
      nb_plots: result.nb_plots_necessaires,
      nb_fixations: result.nb_fixations,
    })
    .select()
    .single();

  if (terError) throw terError;
  const details = terrasseData as CalepinageTerrasseRow;

  // 5. Génération automatique des Besoins Matériaux
  const besoinsToInsert = [
    {
      entreprise_id: params.entrepriseId,
      chantier_id: params.chantierId,
      calepinage_id: calepinage.id,
      categorie: "lames",
      designation: `Lames terrasse (${params.calcParams.largeur_lame_mm}mm x ${params.calcParams.longueur_lame_m}m)`,
      unite: "lame(s)",
      quantite: result.nb_lames_avec_marge,
      origine: "calepinage",
      statut: "a_commander",
    },
    {
      entreprise_id: params.entrepriseId,
      chantier_id: params.chantierId,
      calepinage_id: calepinage.id,
      categorie: "lambourdes",
      designation: "Lambourdes pin classe 4 (section 45x70mm, 3m)",
      unite: "lambourde(s)",
      quantite: result.nb_lambourdes_3m,
      origine: "calepinage",
      statut: "a_commander",
    },
    {
      entreprise_id: params.entrepriseId,
      chantier_id: params.chantierId,
      calepinage_id: calepinage.id,
      categorie: "plots",
      designation: `Plots réglables (entraxe ${params.calcParams.entraxe_plots_cm ?? 50}cm)`,
      unite: "plot(s)",
      quantite: result.nb_plots_necessaires,
      origine: "calepinage",
      statut: "a_commander",
    },
    {
      entreprise_id: params.entrepriseId,
      chantier_id: params.chantierId,
      calepinage_id: calepinage.id,
      categorie: "fixations",
      designation:
        result.type_fixation === "vis"
          ? "Vis Inox A4 terrasse"
          : "Clips de fixation invisible + vis inox",
      unite: "unité(s)",
      quantite: result.nb_fixations,
      origine: "calepinage",
      statut: "a_commander",
    },
  ];

  const { data: besoinsData, error: besError } = await (supabase.from("besoins_materiaux") as any)
    .insert(besoinsToInsert)
    .select();

  if (besError) throw besError;

  return {
    calepinage,
    details,
    besoins: (besoinsData as BesoinMateriauRow[]) || [],
  };
}

/**
 * Récupère le dernier calepinage valide d'un chantier
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
