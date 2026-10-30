import { NextResponse } from "next/server";
import { calculerCalepinageTerrasse, CalepinageParams } from "@/lib/calepinage";

const NUMERIC_KEYS = [
  "longueur_m",
  "largeur_m",
  "largeur_lame_mm",
  "longueur_lame_m",
  "espace_inter_lames_mm",
  "marge_chutes_pct",
  "entraxe_lambourdes_cm",
  "longueur_lambourde_commerciale_m",
  "marge_lambourdes_pct",
  "largeur_lambourde_mm",
  "entraxe_plots_cm",
  "espace_entre_plots_cm",
  "marge_fixations_pct",
  "taille_boite_vis",
  "taille_boite_clips",
  "taille_boite_clips_depart_fin",
] as const;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const params: Record<string, unknown> = { ...body };

    // Aucune valeur par défaut silencieuse : une saisie vide, nulle ou invalide est refusée par le moteur.
    for (const key of NUMERIC_KEYS) {
      if (body[key] !== undefined && body[key] !== null) {
        params[key] = typeof body[key] === "string" ? Number((body[key] as string).replace(",", ".")) : body[key];
      }
    }

    const result = calculerCalepinageTerrasse(params as unknown as CalepinageParams);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
