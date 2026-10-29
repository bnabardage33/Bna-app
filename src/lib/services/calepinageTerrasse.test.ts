import { calculerCalepinageTerrasse } from "../calepinage.ts";
import { parseDecimal } from "../decimalInput.ts";
import { saveCalepinageTerrasse } from "./calepinageService.ts";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`✓ PASS: ${msg}`);
}

async function runTests() {
  console.log("=== TESTS CALEPINAGE TERRASSE DÉTERMINISTE & PERSISTANT ===");

  // 1. Petite terrasse (2m x 2m)
  const t1 = calculerCalepinageTerrasse({
    longueur_m: 2,
    largeur_m: 2,
    largeur_lame_mm: 140,
    longueur_lame_m: 2.4,
    espace_inter_lames_mm: 5,
    entraxe_lambourdes_cm: 40,
    entraxe_plots_cm: 50,
    marge_chutes_pct: 10,
    type_fixation: "vis",
  });
  assert(t1.surface_nette_m2 === 4, "T1: surface nette 2x2 = 4m²");
  assert(t1.nb_rangees === 14, `T1: nb_rangees = ceil(2 / 0.145) = 14 (got ${t1.nb_rangees})`);
  assert(t1.ml_lambourdes_total > 0, "T1: ml_lambourdes_total calculé");
  assert(t1.nb_plots_necessaires === 30, `T1: plots = (ceil(2/0.4)+1) * (ceil(2/0.5)+1) = 6*5 = 30 (got ${t1.nb_plots_necessaires})`);

  // 2. Dimensions décimales (5.4m x 3.2m)
  const t2 = calculerCalepinageTerrasse({
    longueur_m: 5.4,
    largeur_m: 3.2,
    largeur_lame_mm: 140,
    longueur_lame_m: 3.0,
    espace_inter_lames_mm: 5,
    marge_chutes_pct: 10,
  });
  assert(t2.surface_nette_m2 === 17.28, `T2: surface nette 5.4x3.2 = 17.28m² (got ${t2.surface_nette_m2})`);
  assert(t2.nb_rangees === Math.ceil(3.2 / 0.145), "T2: nb_rangees exact");
  assert(t2.nb_lames_avec_marge >= t2.nb_lames_theorique, "T2: lames avec marge >= lames théorique");

  // 3. Virgule française côté interface ("2,10" parsé via parseDecimal)
  const parsedFr = parseDecimal("2,10");
  assert(parsedFr === 2.1, `T3: parseDecimal('2,10') = 2.1 (got ${parsedFr})`);
  const t3 = calculerCalepinageTerrasse({
    longueur_m: parsedFr!,
    largeur_m: 3.0,
    largeur_lame_mm: 140,
    longueur_lame_m: 2.4,
  });
  assert(t3.surface_nette_m2 === 6.3, `T3: surface avec valeur parsée = 6.3m² (got ${t3.surface_nette_m2})`);

  // 4. Dimensions nulles ou interdites (rejet strict)
  let rejected = false;
  try {
    calculerCalepinageTerrasse({
      longueur_m: 0,
      largeur_m: 4,
      largeur_lame_mm: 140,
      longueur_lame_m: 2.4,
    });
  } catch (e: any) {
    rejected = true;
  }
  assert(rejected, "T4: rejet strict dimension longueur = 0");

  let rejectedNeg = false;
  try {
    calculerCalepinageTerrasse({
      longueur_m: 5,
      largeur_m: -2,
      largeur_lame_mm: 140,
      longueur_lame_m: 2.4,
    });
  } catch (e: any) {
    rejectedNeg = true;
  }
  assert(rejectedNeg, "T4: rejet strict dimension largeur négative");

  // 5. Changement de marge (8% vs 15%)
  const baseParams = {
    longueur_m: 6,
    largeur_m: 4,
    largeur_lame_mm: 140,
    longueur_lame_m: 3.0,
  };
  const t5_8 = calculerCalepinageTerrasse({ ...baseParams, marge_chutes_pct: 8 });
  const t5_15 = calculerCalepinageTerrasse({ ...baseParams, marge_chutes_pct: 15 });
  assert(t5_15.ml_lames_total > t5_8.ml_lames_total, "T5: marge 15% donne plus de ml_lames que marge 8%");
  assert(t5_15.nb_lames_avec_marge >= t5_8.nb_lames_avec_marge, "T5: marge 15% donne >= nb lames que marge 8%");

  // 6. Changement longueur commerciale (2.4m vs 3.0m vs 4.0m)
  const t6_24 = calculerCalepinageTerrasse({ ...baseParams, longueur_lame_m: 2.4 });
  const t6_30 = calculerCalepinageTerrasse({ ...baseParams, longueur_lame_m: 3.0 });
  const t6_40 = calculerCalepinageTerrasse({ ...baseParams, longueur_lame_m: 4.0 });
  assert(t6_24.nb_lames_avec_marge > t6_30.nb_lames_avec_marge, "T6: lames 2.4m requiert plus de pièces que 3.0m");
  assert(t6_30.nb_lames_avec_marge > t6_40.nb_lames_avec_marge, "T6: lames 3.0m requiert plus de pièces que 4.0m");

  // 7. Changement largeur utile (120mm vs 145mm)
  const t7_120 = calculerCalepinageTerrasse({ ...baseParams, largeur_lame_mm: 120 });
  const t7_145 = calculerCalepinageTerrasse({ ...baseParams, largeur_lame_mm: 145 });
  assert(t7_120.nb_rangees > t7_145.nb_rangees, "T7: lames 120mm requièrent plus de rangées que 145mm");

  // 8. Changement entraxe lambourdes (40cm vs 50cm)
  const t8_40 = calculerCalepinageTerrasse({ ...baseParams, entraxe_lambourdes_cm: 40 });
  const t8_50 = calculerCalepinageTerrasse({ ...baseParams, entraxe_lambourdes_cm: 50 });
  assert(t8_40.ml_lambourdes_total > t8_50.ml_lambourdes_total, "T8: entraxe lambourdes 40cm requiert plus de ml que 50cm");
  assert(t8_40.nb_plots_necessaires > t8_50.nb_plots_necessaires, "T8: entraxe 40cm donne plus de lignes de plots que 50cm");

  // 9. Changement entraxe plots (40cm vs 60cm)
  const t9_40 = calculerCalepinageTerrasse({ ...baseParams, entraxe_plots_cm: 40 });
  const t9_60 = calculerCalepinageTerrasse({ ...baseParams, entraxe_plots_cm: 60 });
  assert(t9_40.nb_plots_necessaires > t9_60.nb_plots_necessaires, "T9: entraxe plots 40cm requiert plus de plots que 60cm");

  // 10 & 11. Mock Supabase pour tester l'incrémentation Version 1 -> Version 2, archivage et génération besoins matériaux
  const mockDb = {
    calepinages: [] as any[],
    calepinages_terrasse: [] as any[],
    besoins_materiaux: [] as any[],
  };

  const createMockSupabase = () => {
    return {
      from: (table: string) => {
        let currentFilter: any = {};
        let currentOrder: any = null;
        let currentLimit: number | null = null;
        let isSingle = false;

        const builder: any = {
          select: () => builder,
          eq: (col: string, val: any) => {
            currentFilter[col] = val;
            return builder;
          },
          order: (col: string, opt: any) => {
            currentOrder = { col, ...opt };
            return builder;
          },
          limit: (n: number) => {
            currentLimit = n;
            return builder;
          },
          single: () => {
            isSingle = true;
            return builder;
          },
          insert: (data: any) => {
            const items = Array.isArray(data) ? data : [data];
            const inserted = items.map((it, idx) => ({
              id: `${table}-${Date.now()}-${idx}`,
              created_at: new Date().toISOString(),
              ...it,
            }));
            (mockDb as any)[table].push(...inserted);
            return {
              select: () => ({
                single: async () => ({ data: inserted[0], error: null }),
                then: (resolve: any) => resolve({ data: Array.isArray(data) ? inserted : inserted[0], error: null }),
              }),
              then: (resolve: any) => resolve({ data: Array.isArray(data) ? inserted : inserted[0], error: null }),
            };
          },
          update: (data: any) => ({
            eq: (col1: string, val1: any) => ({
              eq: async (col2: string, val2: any) => {
                const list = (mockDb as any)[table];
                for (const row of list) {
                  if (row[col1] === val1 && row[col2] === val2) {
                    Object.assign(row, data);
                  }
                }
                return { data: null, error: null };
              },
            }),
          }),
          then: (resolve: any) => {
            let res = [...((mockDb as any)[table] || [])];
            for (const key of Object.keys(currentFilter)) {
              res = res.filter((r) => r[key] === currentFilter[key]);
            }
            if (currentOrder) {
              res.sort((a, b) => (currentOrder.ascending ? a[currentOrder.col] - b[currentOrder.col] : b[currentOrder.col] - a[currentOrder.col]));
            }
            if (currentLimit !== null) {
              res = res.slice(0, currentLimit);
            }
            resolve({ data: isSingle ? res[0] || null : res, error: null });
          },
        };
        return builder;
      },
    } as any;
  };

  const mockSupabase = createMockSupabase();
  const chantierId = "chantier-uuid-test";
  const entrepriseId = "ent-uuid-test";

  // Premier enregistrement -> V1
  const v1Result = await saveCalepinageTerrasse(mockSupabase, {
    entrepriseId,
    chantierId,
    calcParams: {
      longueur_m: 5,
      largeur_m: 3,
      largeur_lame_mm: 140,
      longueur_lame_m: 3.0,
      marge_chutes_pct: 10,
    },
  });

  assert(v1Result.calepinage.version === 1, `T10: Premier calepinage est en V1 (got ${v1Result.calepinage.version})`);
  assert(v1Result.calepinage.statut === "valide", "T10: V1 statut est 'valide'");

  // Deuxième enregistrement -> V2
  const v2Result = await saveCalepinageTerrasse(mockSupabase, {
    entrepriseId,
    chantierId,
    calcParams: {
      longueur_m: 5,
      largeur_m: 3.5,
      largeur_lame_mm: 140,
      longueur_lame_m: 3.0,
      marge_chutes_pct: 12,
    },
  });

  assert(v2Result.calepinage.version === 2, `T10: Deuxième calepinage incrémenté en V2 (got ${v2Result.calepinage.version})`);
  const v1Record = mockDb.calepinages.find((c) => c.version === 1);
  assert(v1Record.statut === "archive", `T10: V1 archivée après création de V2 (statut: ${v1Record.statut})`);

  // Vérification des Besoins Matériaux générés (T11)
  assert(v2Result.besoins.length === 4, `T11: 4 besoins matériaux générés pour V2 (got ${v2Result.besoins.length})`);
  const categories = v2Result.besoins.map((b) => b.categorie).sort();
  assert(
    JSON.stringify(categories) === JSON.stringify(["fixations", "lambourdes", "lames", "plots"]),
    `T11: Catégories requises présentes (lames, lambourdes, plots, fixations) (got ${categories.join(",")})`
  );
  for (const b of v2Result.besoins) {
    assert(b.quantite > 0, `T11: Quantité > 0 pour ${b.categorie} (${b.quantite})`);
    assert(b.statut === "a_commander", `T11: Statut 'a_commander' pour ${b.categorie}`);
    assert(b.calepinage_id === v2Result.calepinage.id, `T11: Lié au calepinage ${v2Result.calepinage.id}`);
  }

  console.log("=== TOUS LES 11 SCÉNARIOS ONT RÉUSSI AVEC SUCCÈS ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
