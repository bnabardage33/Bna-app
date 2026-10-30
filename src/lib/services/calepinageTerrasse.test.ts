import { readFileSync } from "node:fs";
import { calculerCalepinageTerrasse, genererTrameLambourdesMm } from "../calepinage.ts";
import type { CalepinageParams } from "../calepinage.ts";
import { construireBesoinsTerrasse, saveCalepinageTerrasse } from "./calepinageService.ts";

let passed = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log(`✓ PASS: ${msg}`);
}

function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

const REF: CalepinageParams = {
  longueur_m: 6,
  largeur_m: 4,
  sens_pose_lames: "longueur",
  disposition_joints: "alignes",
  largeur_lame_mm: 145,
  longueur_lame_m: 3,
  espace_inter_lames_mm: 5,
  marge_chutes_pct: 10,
  entraxe_lambourdes_cm: 40,
  longueur_lambourde_commerciale_m: 3,
  marge_lambourdes_pct: 8,
  entraxe_plots_cm: 60,
  type_fixation: "vis",
};

// ---------------------------------------------------------------------------
// Émulation TypeScript de la fonction SQL creer_calepinage_terrasse (migration 007).
// ATTENTION : ceci teste la logique documentée, pas le SQL lui-même (aucun Postgres local).
// ---------------------------------------------------------------------------
type Db = {
  chantiers: { id: string; entreprise_id: string }[];
  calepinages: any[];
  calepinages_terrasse: any[];
  besoins_materiaux: any[];
};

function createMockSupabase(db: Db, sessionEntrepriseId: string | null) {
  let seq = 0;
  return {
    rpc: async (name: string, args: any) => {
      if (name !== "creer_calepinage_terrasse") return { data: null, error: new Error("rpc inconnue") };
      if (!sessionEntrepriseId) return { data: null, error: new Error("Utilisateur non authentifié") };
      const chantier = db.chantiers.find((c) => c.id === args.p_chantier_id && c.entreprise_id === sessionEntrepriseId);
      if (!chantier) return { data: null, error: new Error("Chantier introuvable ou non autorisé") };
      if (!Array.isArray(args.p_besoins) || args.p_besoins.length === 0) {
        return { data: null, error: new Error("Liste de besoins matériaux invalide") };
      }
      const version = Math.max(0, ...db.calepinages.filter((c) => c.chantier_id === chantier.id).map((c) => c.version)) + 1;
      const archivés = db.calepinages.filter(
        (c) => c.chantier_id === chantier.id && c.metier === "terrasse" && c.statut === "valide"
      );
      for (const a of archivés) {
        a.statut = "archive";
        for (const b of db.besoins_materiaux) {
          if (b.calepinage_id === a.id && b.origine === "calepinage" && b.statut === "a_commander") b.statut = "annule";
        }
      }
      const cal = {
        id: `cal-${++seq}`,
        entreprise_id: sessionEntrepriseId,
        chantier_id: chantier.id,
        metier: "terrasse",
        version,
        statut: "valide",
      };
      db.calepinages.push(cal);
      const det = { id: `det-${seq}`, calepinage_id: cal.id, entreprise_id: sessionEntrepriseId, ...args.p_details };
      db.calepinages_terrasse.push(det);
      const besoins = args.p_besoins.map((b: any, i: number) => ({
        id: `bes-${seq}-${i}`,
        entreprise_id: sessionEntrepriseId,
        chantier_id: chantier.id,
        calepinage_id: cal.id,
        origine: "calepinage",
        statut: "a_commander",
        ...b,
      }));
      db.besoins_materiaux.push(...besoins);
      return { data: { calepinage: cal, details: det, besoins }, error: null };
    },
  } as any;
}

async function runTests() {
  console.log("=== TESTS QUANTITATIF TERRASSE V1.1 (JOINTS ALIGNÉS) ===");

  // A. 2 × 2 m, lames 3 m : zéro aboutage
  const a = calculerCalepinageTerrasse({ ...REF, longueur_m: 2, largeur_m: 2 });
  assert(a.platelage.nb_aboutages_interieurs_par_rangee === 0, "A: 2×2 lames 3 m -> 0 aboutage");
  assert(a.platelage.positions_aboutages_m.length === 0, "A: aucune position de joint");
  assert(a.structure.nb_lignes_lambourdes_total === 6, "A: 6 lignes (0 à 2,00 m tous les 40 cm)");
  assert(a.structure.nb_appuis_aboutage_ajoutes === 0, "A: aucun appui d'aboutage ajouté");

  // B. 6 × 4 m, lames 3 m : 1 aboutage à 3 m, aucune rive comptée
  const b = calculerCalepinageTerrasse(REF);
  assert(b.platelage.nb_aboutages_interieurs_par_rangee === 1, "B: ceil(6/3)-1 = 1 aboutage intérieur");
  assert(JSON.stringify(b.platelage.positions_aboutages_m) === "[3]", "B: joint à 3,00 m uniquement (rive 6,00 m exclue)");
  assert(b.platelage.nb_segments_par_rangee === 2, "B: 2 segments par rangée");
  assert(b.platelage.nb_rangees === 27 && b.platelage.ml_lames_brut === 162, "B: 27 rangées, 162 ml bruts");
  assert(b.platelage.ml_lames_avec_marge === 178.2 && b.platelage.nb_lames_commandees === 60, "B: 178,2 ml, 60 lames");
  const pos = b.structure.positions_lambourdes_m;
  assert(pos[0] === 0 && pos[pos.length - 1] === 6, "B: rives incluses dans la trame");
  assert(pos.includes(2.9775) && pos.includes(3.0225), "B: deux appuis distincts de part et d'autre du joint (2,9775 / 3,0225)");
  assert(!pos.includes(3), "B: aucun appui unique au droit du joint (appuis distincts)");
  assert(b.structure.nb_lignes_lambourdes_base === 16, "B: 16 lignes de base");
  assert(b.structure.nb_appuis_aboutage_ajoutes === 2 && b.structure.nb_lignes_lambourdes_total === 18, "B: +2 appuis -> 18 lignes (trame géométrique exacte)");
  assert(b.structure.entraxe_max_reel_cm === 40, "B: entraxe maximal réel = 40 cm (non dépassé)");
  assert(b.structure.ml_lambourdes_brut === 72 && b.structure.ml_lambourdes_avec_marge === 77.76, "B: 72 ml bruts, 77,76 ml avec 8 %");
  assert(b.structure.nb_barres_lambourdes === 26, "B: ceil(77,76/3) = 26 barres");
  assert(b.supports.plots_par_ligne === 8, "B: ceil(4/0,6)+1 = 8 plots par ligne");
  assert(b.supports.plots_lignes_base === 128 && b.supports.plots_appuis_aboutage === 16 && b.supports.nb_plots_total === 144, "B: plots 128 + 16 = 144 (depuis la trame réelle)");
  assert(b.fixations.nb_croisements_courants === 432 && b.fixations.nb_croisements_aboutage === 54, "B: croisements 432 courants + 54 d'aboutage = 486 = 27×18");
  assert(b.fixations.nb_vis_courantes === 864 && b.fixations.nb_vis_aboutages === 108, "B: vis 864 courantes + 108 d'aboutage");
  assert(b.fixations.nb_vis_brut === 972 && b.fixations.nb_vis_avec_marge === 1021, "B: 972 vis brutes, 1021 avec 5 %");
  assert(b.fixations.nb_boites_vis === null && b.fixations.nb_vis_conditionnees === 1021, "B: sans taille de boîte renseignée -> pas d'arrondi universel");

  // C. 6 × 4 m, lames 4 m : 1 aboutage à 4 m (la ligne régulière à 4,00 m est remplacée par la paire)
  const c = calculerCalepinageTerrasse({ ...REF, longueur_lame_m: 4 });
  assert(c.platelage.nb_aboutages_interieurs_par_rangee === 1, "C: ceil(6/4)-1 = 1 aboutage");
  assert(JSON.stringify(c.platelage.positions_aboutages_m) === "[4]", "C: joint à 4,00 m");
  assert(c.platelage.nb_lames_commandees === 45, "C: 45 lames de 4 m");
  assert(!c.structure.positions_lambourdes_m.includes(4), "C: la ligne régulière à 4,00 m est remplacée par la paire d'appuis");
  assert(c.structure.nb_lignes_lambourdes_total === 17, "C: 16 - 1 + 2 = 17 lignes");
  assert(c.structure.entraxe_max_reel_cm <= 40, "C: entraxe respecté");

  // D. 7 × 4 m, lames 3 m : joints à 3 et 6 m
  const d = calculerCalepinageTerrasse({ ...REF, longueur_m: 7 });
  assert(d.platelage.nb_aboutages_interieurs_par_rangee === 2, "D: ceil(7/3)-1 = 2 aboutages");
  assert(JSON.stringify(d.platelage.positions_aboutages_m) === "[3,6]", "D: joints à 3 m et 6 m");
  assert(d.structure.nb_lignes_lambourdes_base === 19, "D: 19 lignes de base (0 à 7 m)");
  assert(d.structure.nb_lignes_lambourdes_total === 22, "D: 19 + 4 - 1 (ligne à 6,00 m remplacée) = 22");
  assert(d.structure.entraxe_max_reel_cm <= 40, "D: entraxe respecté");

  // E. Sens longueur / largeur
  const e = calculerCalepinageTerrasse({ ...REF, sens_pose_lames: "largeur" });
  assert(e.longueur_pose_m === 4 && e.largeur_couverte_m === 6, "E: sens largeur -> pose sur 4 m, couverture 6 m");
  assert(e.platelage.nb_rangees === 40, "E: ceil(6/0,15) = 40 rangées");
  assert(e.platelage.nb_aboutages_interieurs_par_rangee === 1 && JSON.stringify(e.platelage.positions_aboutages_m) === "[3]", "E: 1 aboutage à 3 m sur 4 m");
  assert(e.structure.nb_lignes_lambourdes_total === 13, "E: 13 lignes le long de l'axe de 4 m");
  assert(e.structure.longueur_lambourde_sur_terrasse_m === 6 && e.structure.ml_lambourdes_brut === 78, "E: lambourdes de 6 m, 78 ml bruts");
  assert(e.surface_nette_m2 === b.surface_nette_m2, "E: surface identique quel que soit le sens");

  // F. Entraxe jamais dépassé : balayage
  let balayages = 0;
  for (const L of [1.2, 2, 2.4, 3, 3.02, 4.5, 5.4, 6, 6.6, 7, 9.1, 12]) {
    for (const lame of [2.4, 3, 4]) {
      for (const entraxe of [30, 40, 45, 50, 60]) {
        for (const distincts of [true, false]) {
          let r;
          try {
            r = calculerCalepinageTerrasse({ ...REF, longueur_m: L, longueur_lame_m: lame, entraxe_lambourdes_cm: entraxe, appuis_distincts_aboutage: distincts });
          } catch (err) {
            // Cas géométriquement refusé (pièce résiduelle trop courte) : doit être un message explicite
            if (!(err as Error).message.includes("trop proche")) throw err;
            continue;
          }
          const p = r.structure.positions_lambourdes_m;
          const sorted = p.every((v, i) => i === 0 || v > p[i - 1]);
          let ecartMax = 0;
          for (let i = 1; i < p.length; i++) ecartMax = Math.max(ecartMax, p[i] - p[i - 1]);
          if (!(sorted && p[0] === 0 && Math.abs(p[p.length - 1] - L) < 1e-9 && ecartMax <= entraxe / 100 + 1e-9)) {
            throw new Error(`FAIL: trame invalide L=${L} lame=${lame} entraxe=${entraxe}`);
          }
          const attendu = Math.max(0, Math.ceil(L / lame - 1e-9) - 1);
          if (r.platelage.nb_aboutages_interieurs_par_rangee !== attendu) {
            throw new Error(`FAIL: aboutages L=${L} lame=${lame}`);
          }
          balayages++;
        }
      }
    }
  }
  assert(balayages > 100, `F: ${balayages} configurations — trame triée, rives incluses, entraxe jamais dépassé, aboutages = max(0, ceil(L/lame)-1)`);

  const tr = genererTrameLambourdesMm({ longueurPoseMm: 6000, entraxeMm: 400, aboutagesMm: [3000], largeurLambourdeMm: 45, appuisDistincts: false });
  assert(tr.positionsMm.includes(3000) && tr.positionsMm.length === 17, "F: appui unique -> 1 appui au joint (17 lignes)");

  // G. Conditionnement vis configurable
  const g200 = calculerCalepinageTerrasse({ ...REF, taille_boite_vis: 200 });
  const g250 = calculerCalepinageTerrasse({ ...REF, taille_boite_vis: 250 });
  assert(g200.fixations.nb_boites_vis === 6 && g200.fixations.nb_vis_conditionnees === 1200, "G: boîtes de 200 -> 6 boîtes, 1200 vis");
  assert(g250.fixations.nb_boites_vis === 5 && g250.fixations.nb_vis_conditionnees === 1250, "G: boîtes de 250 -> 5 boîtes, 1250 vis");
  const gMarge = calculerCalepinageTerrasse({ ...REF, marge_fixations_pct: 0 });
  assert(gMarge.fixations.nb_vis_avec_marge === 972, "G: marge fixations configurable (0 % -> 972)");

  // H. Clips avec / sans départ-fin
  const hSans = calculerCalepinageTerrasse({ ...REF, type_fixation: "clips", taille_boite_clips: 100 });
  assert(hSans.fixations.nb_clips_courants === 432 && hSans.fixations.nb_clips_aboutages === 54, "H: 432 clips courants + 54 d'aboutage");
  assert(hSans.fixations.nb_clips_depart_fin === 0 && hSans.fixations.nb_clips_total === 511, "H: sans départ/fin -> 511 clips (avec 5 %)");
  assert(hSans.fixations.nb_boites_clips === 6 && hSans.fixations.nb_clips_conditionnes === 600, "H: boîtes de 100 -> 6 boîtes");
  const hAvec = calculerCalepinageTerrasse({ ...REF, type_fixation: "clips", taille_boite_clips: 100, utiliser_clips_depart_fin: true, taille_boite_clips_depart_fin: 50 });
  assert(hAvec.fixations.nb_clips_depart_fin === 36, "H: départ/fin = 2 × 18 lignes = 36");
  assert(hAvec.fixations.nb_clips_total === 511 + 36, "H: total = 511 + 36");
  assert(hAvec.fixations.nb_boites_clips_depart_fin === 1 && hAvec.fixations.nb_clips_depart_fin_conditionnes === 50, "H: boîte départ/fin de 50 -> 1 boîte");
  const besoinsClips = construireBesoinsTerrasse(hAvec, { ...REF, type_fixation: "clips" });
  assert(besoinsClips.length === 5, "H: 5 besoins avec clips départ/fin");
  assert(construireBesoinsTerrasse(hSans, REF).length === 4, "H: 4 besoins sans clips départ/fin");

  // I. Création V1 puis V2
  const db: Db = {
    chantiers: [
      { id: "ch-A", entreprise_id: "ent-A" },
      { id: "ch-B", entreprise_id: "ent-B" },
    ],
    calepinages: [],
    calepinages_terrasse: [],
    besoins_materiaux: [],
  };
  const sbA = createMockSupabase(db, "ent-A");
  const v1 = await saveCalepinageTerrasse(sbA, { entrepriseId: "ent-A", chantierId: "ch-A", calcParams: REF });
  assert(v1.calepinage.version === 1 && v1.calepinage.statut === "valide", "I: V1 créée et valide");
  assert(v1.besoins.length === 4 && v1.besoins.every((x) => x.statut === "a_commander"), "I: besoins V1 actifs (a_commander)");
  assert(v1.details.disposition_joints === "alignes", "I: disposition des joints persistée");

  const v2 = await saveCalepinageTerrasse(sbA, { entrepriseId: "ent-A", chantierId: "ch-A", calcParams: { ...REF, longueur_m: 7 } });
  assert(v2.calepinage.version === 2 && v2.calepinage.statut === "valide", "I: V2 créée et valide");
  const v1Row = db.calepinages.find((x) => x.version === 1);
  assert(v1Row.statut === "archive", "I: V1 archivée");
  const besoinsV1 = db.besoins_materiaux.filter((x) => x.calepinage_id === v1Row.id);
  assert(besoinsV1.length === 4 && besoinsV1.every((x) => x.statut === "annule"), "I: besoins V1 conservés mais désactivés (annule)");
  const actifs = db.besoins_materiaux.filter((x) => x.chantier_id === "ch-A" && x.statut === "a_commander");
  assert(actifs.length === 4 && actifs.every((x) => x.calepinage_id === v2.calepinage.id), "I: seuls les besoins V2 sont actifs");
  assert(db.calepinages.filter((x) => x.statut === "valide").length === 1, "I: une seule version valide");

  // I bis. Besoins déjà commandés non modifiés
  db.besoins_materiaux.find((x) => x.calepinage_id === v2.calepinage.id && x.categorie === "lames").statut = "commande";
  await saveCalepinageTerrasse(sbA, { entrepriseId: "ent-A", chantierId: "ch-A", calcParams: REF });
  const lamesV2 = db.besoins_materiaux.find((x) => x.calepinage_id === v2.calepinage.id && x.categorie === "lames");
  assert(lamesV2.statut === "commande", "I: un besoin déjà commandé n'est pas annulé silencieusement");

  // J. Croisement inter-tenant refusé
  let refuse = false;
  try {
    await saveCalepinageTerrasse(sbA, { entrepriseId: "ent-A", chantierId: "ch-B", calcParams: REF });
  } catch {
    refuse = true;
  }
  assert(refuse, "J: chantier d'une autre entreprise refusé");
  assert(db.calepinages.every((x) => x.chantier_id !== "ch-B"), "J: aucune ligne créée pour le chantier d'une autre entreprise");
  let sansSession = false;
  try {
    await saveCalepinageTerrasse(createMockSupabase(db, null), { entrepriseId: "ent-A", chantierId: "ch-A", calcParams: REF });
  } catch {
    sansSession = true;
  }
  assert(sansSession, "J: création refusée sans session");
  let sansEntreprise = false;
  try {
    await saveCalepinageTerrasse(sbA, { entrepriseId: "", chantierId: "ch-A", calcParams: REF });
  } catch {
    sansEntreprise = true;
  }
  assert(sansEntreprise, "J: enregistrement refusé sans entreprise identifiée");

  // Contrôle statique de la migration additive 007
  const sql = readFileSync(new URL("../../../supabase/migrations/20261030000007_terrasse_v1_1_versionnement_et_coherence.sql", import.meta.url), "utf8");
  assert(sql.includes("pg_advisory_xact_lock"), "SQL: verrou consultatif par chantier (anti-course sur max(version)+1)");
  assert(sql.includes("statut = 'annule'") && sql.includes("statut = 'archive'"), "SQL: archivage version + désactivation besoins");
  assert(sql.includes("SECURITY INVOKER") && sql.includes("get_auth_entreprise_id()"), "SQL: RLS conservée, entreprise déduite de la session");
  assert(
    ["fk_calepinages_chantier_entreprise", "fk_calepinages_terrasse_calepinage_entreprise", "fk_besoins_chantier_entreprise", "fk_besoins_calepinage_entreprise"].every((n) => sql.includes(n)),
    "SQL: clés étrangères composites anti-croisement inter-tenant"
  );
  assert(sql.includes("ON DELETE SET NULL (calepinage_id)"), "SQL: SET NULL limité à calepinage_id");
  assert(!/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i.test(sql), "SQL: migration strictement additive");

  // K. Saisies vides, nulles ou négatives refusées
  const invalides: Partial<CalepinageParams>[] = [
    { longueur_m: 0 },
    { longueur_m: -2 },
    { largeur_m: 0 },
    { largeur_m: -1 },
    { longueur_m: NaN },
    { largeur_m: undefined as any },
    { largeur_lame_mm: 0 },
    { longueur_lame_m: -3 },
    { longueur_lame_m: NaN },
    { entraxe_lambourdes_cm: 0 },
    { entraxe_lambourdes_cm: -40 },
    { entraxe_plots_cm: 0 },
    { longueur_lambourde_commerciale_m: 0 },
    { longueur_lambourde_commerciale_m: -3 },
    { marge_lambourdes_pct: -1 },
    { marge_chutes_pct: -5 },
    { marge_fixations_pct: -1 },
    { espace_inter_lames_mm: -1 },
    { taille_boite_vis: 0 },
    { taille_boite_vis: -10 },
    { taille_boite_clips: 2.5 },
    { sens_pose_lames: "diagonale" as any },
    { disposition_joints: "quinconce" },
  ];
  for (const inv of invalides) {
    assert(throws(() => calculerCalepinageTerrasse({ ...REF, ...inv })), `K: refusé ${JSON.stringify(inv)}`);
  }

  // L. Aucun NaN / Infinity dans les résultats
  let nombres = 0;
  const verifier = (v: unknown, path: string) => {
    if (typeof v === "number") {
      nombres++;
      if (!Number.isFinite(v)) throw new Error(`FAIL: valeur non finie ${path}`);
    } else if (Array.isArray(v)) v.forEach((x, i) => verifier(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) verifier(x, `${path}.${k}`);
  };
  for (const sens of ["longueur", "largeur"] as const) {
    for (const fix of ["vis", "clips"] as const) {
      for (const L of [0.5, 1, 2.4, 6, 12.5]) {
        let r;
        try {
          r = calculerCalepinageTerrasse({ ...REF, longueur_m: L, sens_pose_lames: sens, type_fixation: fix, utiliser_clips_depart_fin: fix === "clips", taille_boite_vis: 200, taille_boite_clips: 100, taille_boite_clips_depart_fin: 50 });
        } catch (err) {
          if (!(err as Error).message.includes("trop proche")) throw err;
          continue;
        }
        verifier(r, `L=${L}/${sens}/${fix}`);
      }
    }
  }
  assert(nombres > 500, `L: ${nombres} valeurs numériques toutes finies`);

  console.log(`\n=== ${passed} VÉRIFICATIONS RÉUSSIES ===`);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
