import { NextResponse } from "next/server";
import { calculerCalepinageTerrasse, CalepinageParams } from "@/lib/calepinage";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CalepinageParams;
    const result = calculerCalepinageTerrasse({
      longueur_m: Number(body.longueur_m) || 5.0,
      largeur_m: Number(body.largeur_m) || 3.5,
      largeur_lame_mm: Number(body.largeur_lame_mm) || 145.0,
      longueur_lame_m: Number(body.longueur_lame_m) || 3.0,
      espace_inter_lames_mm: Number(body.espace_inter_lames_mm) || 5.0,
      entraxe_lambourdes_cm: Number(body.entraxe_lambourdes_cm) || 40.0,
      entraxe_plots_cm: Number(body.entraxe_plots_cm ?? body.espace_entre_plots_cm) || 50.0,
      marge_chutes_pct: Number(body.marge_chutes_pct) || 10.0,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
