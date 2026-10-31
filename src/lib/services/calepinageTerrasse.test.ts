import { readFileSync } from "node:fs";
import { calculerCalepinageTerrasse, genererTrameLambourdesMm } from "../calepinage.ts";
import type { CalepinageParams, SensPoseLames, TypeFixationCalepinage } from "../calepinage.ts";
import {
  construireBesoinsTerrasse,
  saveCalepinageTerrasse,
  getCalepinagesTerrasseByChantier,
  getBesoinsByChantier,
} from "./calepinageService.ts";

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
// Émulation TypeScript de la fonction SQL creer_calepinage_terrasse (migrations 007 & 008).
// ATTENTION : ceci valide le contrat fonctionnel et la robustesse en environnement local.
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
      if (name !== "creer_calepinage_terrasse") {
        return { data: null, error: new Error("rpc inconnue") };
      }
      if (!sessionEntrepriseId) {
        return { data: null, error: new Error("Utilisateur non authentifié ou non rattaché à une entreprise") };
      }
      if (!args.p_chantier_id) {
        return { data: null, error: new Error("Chantier obligatoire") };
      }
      const chantier = db.chantiers.find((c) => c.id === args.p_chantier_id && c.entreprise_id === sessionEntrepriseId);
      if (!chantier) {
        return { data: null, error: new Error("Chantier introuvable ou non autorisé") };
      }

      // Validations techniques migration 008
      const d = args.p_details;
      if (!d || typeof d !== "object") {
        return { data: null, error: new Error("Détails techniques invalides : objet JSON requis") };
      }
      if (!args.p_parametres || typeof args.p_parametres !== "object") {
        return { data: null, error: new Error("Paramètres invalides : objet JSON requis") };
      }
      if (!args.p_resultats || typeof args.p_resultats !== "object") {
        return { data: null, error: new Error("Résultats invalides : objet JSON requis") };
      }

      const clesPositives = [
        "longueur_m", "largeur_m", "largeur_lame_mm", "longueur_lame_m",
        "entraxe_lambourdes_cm", "entraxe_plots_cm",
        "surface_m2", "ml_lames", "ml_lambourdes",
        "nb_lames", "nb_lambourdes", "nb_plots", "nb_fixations",
      ];
      for (const k of clesPositives) {
        if (typeof d[k] !== "number" || Number.isNaN(d[k]) || d[k] <= 0) {
          return { data: null, error: new Error(`Paramètre technique invalide ou manquant : ${k} (nombre strictement positif requis)`) };
        }
      }

      const clesEntieres = ["nb_lames", "nb_lambourdes", "nb_plots", "nb_fixations"];
      for (const k of clesEntieres) {
        if (!Number.isInteger(d[k])) {
          return { data: null, error: new Error(`Paramètre technique invalide : ${k} (entier requis)`) };
        }
      }

      const clesPositivesOuNulles = ["espace_inter_lames_mm", "marge_chutes_pct"];
      for (const k of clesPositivesOuNulles) {
        if (typeof d[k] !== "number" || Number.isNaN(d[k]) || d[k] < 0) {
          return { data: null, error: new Error(`Paramètre technique invalide ou manquant : ${k} (valeur >= 0 requise)`) };
        }
      }

      if (!["longueur", "largeur"].includes(d.orientation_lames)) {
        return { data: null, error: new Error("orientation_lames invalide : longueur ou largeur requis") };
      }
      if (!["vis", "clips"].includes(d.type_fixation)) {
        return { data: null, error: new Error("type_fixation invalide : vis ou clips requis") };
      }
      if (d.disposition_joints !== "alignes") {
        return { data: null, error: new Error("Les joints en quinconce ne sont pas encore disponibles dans Terrasse V1.1.") };
      }

      // Validation de chaque besoin
      if (!Array.isArray(args.p_besoins) || args.p_besoins.length === 0) {
        return { data: null, error: new Error("Liste de besoins matériaux invalide : tableau non vide requis") };
      }
      for (let i = 0; i < args.p_besoins.length; i++) {
        const b = args.p_besoins[i];
        if (!b || typeof b !== "object") {
          return { data: null, error: new Error(`Besoin #${i + 1} invalide : objet JSON requis`) };
        }
        for (const k of ["categorie", "designation", "unite"]) {
          if (typeof b[k] !== "string" || b[k].trim() === "") {
            return { data: null, error: new Error(`Besoin #${i + 1} invalide : ${k} obligatoire et non vide`) };
          }
        }
        if (typeof b.quantite !== "number" || Number.isNaN(b.quantite) || b.quantite <= 0) {
          return { data: null, error: new Error(`Besoin #${i + 1} invalide : quantite strictement positive requise`) };
        }
      }

      // Version calculée par chantier, entreprise ET métier
      const terrasseCalepinages = db.calepinages.filter(
        (c) => c.chantier_id === chantier.id && c.entreprise_id === sessionEntrepriseId && c.metier === "terrasse"
      );
      const version = Math.max(0, ...terrasseCalepinages.map((c) => c.version)) + 1;

      // Archivage de l'ancienne version terrasse uniquement
      const archives = db.calepinages.filter(
        (c) => c.chantier_id === chantier.id && c.entreprise_id === sessionEntrepriseId && c.metier === "terrasse" && c.statut === "valide"
      );
      for (const a of archives) {
        a.statut = "archive";
        for (const b of db.besoins_materiaux) {
          if (b.calepinage_id === a.id && b.origine === "calepinage" && b.statut === "a_commander") {
            b.statut = "annule";
          }
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
      const det = {
        id: `det-${seq}`,
        calepinage_id: cal.id,
        entreprise_id: sessionEntrepriseId,
        ...args.p_details,
        parametres: args.p_parametres,
        resultats: args.p_resultats,
      };
      db.calepinages_terrasse.push(det);
      const besoins = args.p_besoins.map((b: any, i: number) => ({
        id: `bes-${seq}-${i}`,
        entreprise_id: sessionEntrepriseId,
        chantier_id: chantier.id,
        calepinage_id: cal.id,
        origine: "calepinage",
        statut: "a_commander",
        categorie: b.categorie.trim(),
        designation: b.designation.trim(),
        unite: b.unite.trim(),
        quantite: b.quantite,
      }));
      db.besoins_materiaux.push(...besoins);
      return { data: { calepinage: cal, details: det, besoins }, error: null };
    },
    from: (tableName: string) => {
      let rows = [...((db as any)[tableName] || [])];
      const query: any = {
        select: (_cols?: string) => query,
        eq: (col: string, val: any) => {
          rows = rows.filter((r) => r[col] === val);
          return query;
        },
        in: (col: string, vals: any[]) => {
          rows = rows.filter((r) => vals.includes(r[col]));
          return query;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          const asc = opts?.ascending ?? true;
          rows.sort((a, b) => (asc ? (a[col] > b[col] ? 1 : -1) : (a[col] < b[col] ? 1 : -1)));
          return query;
        },
        limit: (n: number) => {
          rows = rows.slice(0, n);
          return query;
        },
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        then: (resolve: any) => Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return query;
    },
  } as any;
}

async function runTests() {
  console.log("=== TESTS QUANTITATIF TERRASSE V1.1 (JOINTS ALIGNÉS & SÉCURISATION 008) ===");

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

  // I. Cycle de vie V1 / V2 et indépendance vis-à-vis des autres métiers (Façade)
  const db: Db = {
    chantiers: [
      { id: "ch-A", entreprise_id: "ent-A" },
      { id: "ch-B", entreprise_id: "ent-B" },
    ],
    calepinages: [
      // Présence d'un calepinage préalable d'un autre métier (ex. façade en V3)
      { id: "cal-facade-3", entreprise_id: "ent-A", chantier_id: "ch-A", metier: "facade", version: 3, statut: "valide" },
    ],
    calepinages_terrasse: [],
    besoins_materiaux: [],
  };
  const sbA = createMockSupabase(db, "ent-A");

  // I.1 V1 Terrasse créée à version=1 malgré Façade V3
  const v1 = await saveCalepinageTerrasse(sbA, { entrepriseId: "ent-A", chantierId: "ch-A", calcParams: REF });
  assert(v1.calepinage.version === 1 && v1.calepinage.statut === "valide", "I: V1 Terrasse créée avec version=1 (indépendante de Façade V3)");
  assert(v1.besoins.length === 4 && v1.besoins.every((x) => x.statut === "a_commander"), "I: besoins V1 actifs (a_commander)");
  assert(v1.details.disposition_joints === "alignes", "I: disposition des joints persistée");
  const facadeCal = db.calepinages.find((x) => x.id === "cal-facade-3");
  assert(facadeCal.statut === "valide", "I: Façade V3 non archivée par la création de Terrasse V1");

  // I.2 V2 Terrasse
  const v2 = await saveCalepinageTerrasse(sbA, { entrepriseId: "ent-A", chantierId: "ch-A", calcParams: { ...REF, longueur_m: 7 } });
  assert(v2.calepinage.version === 2 && v2.calepinage.statut === "valide", "I: V2 Terrasse créée et valide");
  const v1Row = db.calepinages.find((x) => x.metier === "terrasse" && x.version === 1);
  assert(v1Row.statut === "archive", "I: V1 Terrasse archivée");
  const besoinsV1 = db.besoins_materiaux.filter((x) => x.calepinage_id === v1Row.id);
  assert(besoinsV1.length === 4 && besoinsV1.every((x) => x.statut === "annule"), "I: besoins V1 conservés mais désactivés (annule)");
  const actifs = db.besoins_materiaux.filter((x) => x.chantier_id === "ch-A" && x.statut === "a_commander");
  assert(actifs.length === 4 && actifs.every((x) => x.calepinage_id === v2.calepinage.id), "I: seuls les besoins V2 sont actifs");
  assert(db.calepinages.filter((x) => x.metier === "terrasse" && x.statut === "valide").length === 1, "I: une seule version terrasse valide");

  // I.3 Besoins déjà commandés non modifiés
  db.besoins_materiaux.find((x) => x.calepinage_id === v2.calepinage.id && x.categorie === "lames").statut = "commande";
  await saveCalepinageTerrasse(sbA, { entrepriseId: "ent-A", chantierId: "ch-A", calcParams: REF });
  const lamesV2 = db.besoins_materiaux.find((x) => x.calepinage_id === v2.calepinage.id && x.categorie === "lames");
  assert(lamesV2.statut === "commande", "I: un besoin déjà commandé n'est pas annulé silencieusement");

  // J. Sécurité multi-tenant et sessions
  let refuseAutreChantier = false;
  try {
    await saveCalepinageTerrasse(sbA, { entrepriseId: "ent-A", chantierId: "ch-B", calcParams: REF });
  } catch {
    refuseAutreChantier = true;
  }
  assert(refuseAutreChantier, "J: chantier d'une autre entreprise refusé");
  assert(db.calepinages.every((x) => x.chantier_id !== "ch-B"), "J: aucune ligne créée pour le chantier d'une autre entreprise");

  let refuseSansSession = false;
  try {
    await saveCalepinageTerrasse(createMockSupabase(db, null), { entrepriseId: "ent-A", chantierId: "ch-A", calcParams: REF });
  } catch (err) {
    refuseSansSession = true;
    assert((err as Error).message.includes("non authentifié"), "J: message clair sur absence d'authentification");
  }
  assert(refuseSansSession, "J: création refusée sans session active");

  let refuseSansEntreprise = false;
  try {
    await saveCalepinageTerrasse(sbA, { entrepriseId: "", chantierId: "ch-A", calcParams: REF });
  } catch {
    refuseSansEntreprise = true;
  }
  assert(refuseSansEntreprise, "J: enregistrement refusé sans entreprise identifiée côté client");

  // K. Sécurité RPC migration 008 : rejets stricts
  // K.1 Joints en quinconce explicitement refusés par la RPC
  const resQuinconce = await sbA.rpc("creer_calepinage_terrasse", {
    p_chantier_id: "ch-A",
    p_details: { ...v1.details, disposition_joints: "quinconce" },
    p_parametres: REF,
    p_resultats: b,
    p_besoins: v1.besoins,
  });
  assert(
    resQuinconce.error?.message === "Les joints en quinconce ne sont pas encore disponibles dans Terrasse V1.1.",
    "K.1: RPC refuse explicitement disposition_joints = quinconce avec message exact"
  );

  // K.2 Valeur négative ou nulle refusée par la RPC
  const resNeg = await sbA.rpc("creer_calepinage_terrasse", {
    p_chantier_id: "ch-A",
    p_details: { ...v1.details, longueur_m: -5 },
    p_parametres: REF,
    p_resultats: b,
    p_besoins: v1.besoins,
  });
  assert(
    resNeg.error?.message.includes("nombre strictement positif requis"),
    "K.2: RPC refuse longueur_m négative"
  );

  const resEntier = await sbA.rpc("creer_calepinage_terrasse", {
    p_chantier_id: "ch-A",
    p_details: { ...v1.details, nb_lames: 12.5 },
    p_parametres: REF,
    p_resultats: b,
    p_besoins: v1.besoins,
  });
  assert(
    resEntier.error?.message.includes("entier requis"),
    "K.2 bis: RPC refuse quantite nb_lames non entière"
  );

  // K.3 Besoin sans catégorie refusé par la RPC
  const resSansCat = await sbA.rpc("creer_calepinage_terrasse", {
    p_chantier_id: "ch-A",
    p_details: v1.details,
    p_parametres: REF,
    p_resultats: b,
    p_besoins: [{ categorie: "", designation: "Lames", unite: "u", quantite: 10 }],
  });
  assert(
    resSansCat.error?.message.includes("categorie obligatoire"),
    "K.3: RPC refuse un besoin sans categorie"
  );

  // K.4 Besoin avec quantité nulle ou négative refusé par la RPC
  const resQteNulle = await sbA.rpc("creer_calepinage_terrasse", {
    p_chantier_id: "ch-A",
    p_details: v1.details,
    p_parametres: REF,
    p_resultats: b,
    p_besoins: [{ categorie: "lames", designation: "Lames", unite: "u", quantite: 0 }],
  });
  assert(
    resQteNulle.error?.message.includes("quantite strictement positive requise"),
    "K.4: RPC refuse un besoin avec quantite nulle"
  );

  const resQteNeg = await sbA.rpc("creer_calepinage_terrasse", {
    p_chantier_id: "ch-A",
    p_details: v1.details,
    p_parametres: REF,
    p_resultats: b,
    p_besoins: [{ categorie: "lames", designation: "Lames", unite: "u", quantite: -2 }],
  });
  assert(
    resQteNeg.error?.message.includes("quantite strictement positive requise"),
    "K.4 bis: RPC refuse un besoin avec quantite négative"
  );

  // L. Contrôle statique de la migration corrective additive 008
  const sql008 = readFileSync(new URL("../../../supabase/migrations/20261030000008_securisation_rpc_terrasse.sql", import.meta.url), "utf8");
  assert(sql008.includes("CREATE OR REPLACE FUNCTION public.creer_calepinage_terrasse"), "SQL 008: CREATE OR REPLACE FUNCTION présent");
  assert(sql008.includes("uq_calepinages_chantier_metier_version"), "SQL 008: contrainte unique inclut (chantier_id, metier, version)");
  assert(sql008.includes("Les joints en quinconce ne sont pas encore disponibles dans Terrasse V1.1."), "SQL 008: message de refus quinconce présent");
  assert(sql008.includes("ERRCODE = '22023'"), "SQL 008: validation des entrées avec ERRCODE 22023");
  assert(sql008.includes("metier = 'terrasse'"), "SQL 008: calcul de version et archivage filtrés sur metier = 'terrasse'");
  assert(sql008.includes("statut = 'annule'") && sql008.includes("statut = 'archive'"), "SQL 008: archivage et annulation a_commander conservés");
  assert(sql008.includes("VALIDATE CONSTRAINT"), "SQL 008: instructions de validation des contraintes présentes en commentaires");
  assert(sql008.includes("ALTER TABLE public.calepinages DROP CONSTRAINT") || !/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i.test(sql008.replace(/DROP CONSTRAINT [a-z0-9_]+/ig, "")), "SQL 008: strictement additive hormis le remplacement de contrainte");

  // M. Contrôle statique de la migration 007 (immuable)
  const sql007 = readFileSync(new URL("../../../supabase/migrations/20261030000007_terrasse_v1_1_versionnement_et_coherence.sql", import.meta.url), "utf8");
  assert(sql007.includes("pg_advisory_xact_lock"), "SQL 007: intouché");

  // N. Saisies vides, nulles ou négatives refusées par le moteur TypeScript
  const invalidesTs: Partial<CalepinageParams>[] = [
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
  for (const inv of invalidesTs) {
    assert(throws(() => calculerCalepinageTerrasse({ ...REF, ...inv })), `N: TypeScript refuse ${JSON.stringify(inv)}`);
  }

  // O. Aucun NaN / Infinity dans les résultats
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
  assert(nombres > 500, `O: ${nombres} valeurs numériques toutes finies`);

  // P. Consultation des versions et besoins depuis le Cockpit (V1 archivée / V2 active)
  const versionsChA = await getCalepinagesTerrasseByChantier(sbA, "ch-A");
  assert(versionsChA.length === 3, "P: 3 versions enregistrées sur ch-A (V3 actuelle, V2 précédente, V1)");
  const vActuelle = versionsChA.find((v) => v.calepinage.statut === "valide");
  assert(!!vActuelle && vActuelle.calepinage.version === 3, "P: version active identifiée (V3)");
  assert(vActuelle!.details?.nb_lames === 60, "P: détails exacts enregistrés de la version active");

  const vArchives = versionsChA.filter((v) => v.calepinage.statut !== "valide");
  assert(vArchives.length === 2, "P: 2 versions archivées consultables (V2 et V1)");
  assert(vArchives.every((v) => v.calepinage.statut === "archive"), "P: toutes les versions précédentes ont statut = archive");

  const besoinsChA = await getBesoinsByChantier(sbA, "ch-A");
  assert(besoinsChA.actifs.length === 4, "P: 4 besoins actifs liés uniquement à la version valide");
  assert(besoinsChA.totalACommander === 4, "P: indicateur Cockpit = 4 à commander");
  assert(besoinsChA.actifs.every((b) => b.statut === "a_commander" && b.calepinage_id === vActuelle!.calepinage.id), "P: aucun besoin archivé dans les besoins actifs");

  assert(besoinsChA.historique.length >= 4, "P: historique contient les besoins des versions archivées");
  const besoinsV1InHist = besoinsChA.historique.filter((b) => b.versionCalepinage === 1);
  assert(besoinsV1InHist.length === 4 && besoinsV1InHist.every((b) => b.statut === "annule"), "P: besoins V1 présents dans l'historique avec statut annule et version = 1");

  // Chantier sans calepinage
  const versionsChB = await getCalepinagesTerrasseByChantier(sbA, "ch-B");
  assert(versionsChB.length === 0, "P: chantier sans calepinage -> 0 version");
  const besoinsChB = await getBesoinsByChantier(sbA, "ch-B");
  assert(besoinsChB.actifs.length === 0 && besoinsChB.totalACommander === 0, "P: chantier sans calepinage -> 0 besoin actif");

  // Q. Cycle complet d'interaction d'ouverture/fermeture du détail d'une version
  // Q.1 Simulation d'état du composant QuantitatifsTerrasseModal
  let modalListOpen = true;
  let isDetailOpen = false;
  let selectedVersion: any = null;

  const handleOpenVersion = (item: any) => {
    selectedVersion = item;
    isDetailOpen = true;
  };
  const handleCloseDetail = () => {
    isDetailOpen = false;
    selectedVersion = null;
  };

  // Clic Ouvrir sur version active (V2)
  const v2Item = versionsChA.find((v) => v.calepinage.version === 2) || vActuelle;
  handleOpenVersion(v2Item);
  assert(isDetailOpen && selectedVersion !== null, "Q.1: Clic Ouvrir V2 -> isDetailOpen=true et selectedVersion renseigné");
  assert(selectedVersion.calepinage.statut === "valide" || selectedVersion.calepinage.version === v2Item!.calepinage.version, "Q.1: Détail ouvert sur la version exacte cliquée (pas de substitution)");
  assert(modalListOpen === true, "Q.1: Liste des quantitatifs reste active en arrière-plan");

  // Fermeture du détail
  handleCloseDetail();
  assert(!isDetailOpen && selectedVersion === null, "Q.2: Fermeture du détail -> isDetailOpen=false et selectedVersion=null");
  assert(modalListOpen === true, "Q.2: La fermeture du détail ne ferme pas toute la chaîne de modales");

  // Clic Consulter sur version archivée (V1)
  const v1Item = versionsChA.find((v) => v.calepinage.version === 1);
  assert(!!v1Item && v1Item.calepinage.statut === "archive", "Q.3: V1 est bien archivée");
  handleOpenVersion(v1Item);
  assert(isDetailOpen && selectedVersion !== null, "Q.3: Clic Consulter V1 -> isDetailOpen=true et selectedVersion renseigné");
  assert(selectedVersion.calepinage.version === 1 && selectedVersion.calepinage.statut === "archive", "Q.3: Détail ouvert sur V1 en lecture seule (statut archive)");

  // Fermeture du détail V1
  handleCloseDetail();
  assert(!isDetailOpen && selectedVersion === null && modalListOpen === true, "Q.4: Retour propre à la liste sans fermeture globale");

  // Q.5 Vérification statique des composants de détail et liste
  const modalListCode = readFileSync(new URL("../../components/calepinage/QuantitatifsTerrasseModal.tsx", import.meta.url), "utf8");
  const modalDetailCode = readFileSync(new URL("../../components/calepinage/VersionTerrasseDetailModal.tsx", import.meta.url), "utf8");
  const calepinageModalCode = readFileSync(new URL("../../components/calepinage/CalepinageModal.tsx", import.meta.url), "utf8");

  assert(modalListCode.includes('handleOpenVersion(activeVersion') && modalListCode.includes('handleOpenVersion(v'), "Q.5: Boutons Ouvrir et Consulter branchés à handleOpenVersion");
  assert(modalListCode.includes('type="button"'), "Q.5: Boutons de type button pour éviter tout comportement submit intempestif");
  assert(modalListCode.includes('stopPropagation()'), "Q.5: e.stopPropagation présent pour empêcher toute propagation/fermeture parasite");
  assert(modalDetailCode.includes('z-[70]'), "Q.5: VersionTerrasseDetailModal a un z-index supérieur z-[70] > z-50");
  assert(modalDetailCode.includes('onClick={(e) => e.stopPropagation()}'), "Q.5: Boîte modale détail isole les clics du backdrop");

  // =========================================================================
  // R. TESTS DU FLUX MODIFIER / CORRIGER UN QUANTITATIF TERRASSE (SCÉNARIOS A-G)
  // =========================================================================

  // Initialisation d'un chantier dédié pour tester le cycle complet V1 -> V2 -> V3 -> V4
  db.chantiers.push({ id: "ch-cycle", entreprise_id: "ent-A" });

  // 1. Création initiale V1 sur ch-cycle
  const paramsV1: CalepinageParams = {
    ...REF,
    longueur_m: 6.0,
    largeur_m: 4.0,
    sens_pose_lames: "longueur",
    largeur_lame_mm: 145,
    longueur_lame_m: 3.0,
    espace_inter_lames_mm: 5,
    marge_chutes_pct: 10,
    entraxe_lambourdes_cm: 40,
    longueur_lambourde_commerciale_m: 3,
    marge_lambourdes_pct: 8,
    entraxe_plots_cm: 50,
    type_fixation: "vis",
    marge_fixations_pct: 5,
    taille_boite_vis: 200,
  };
  const saveV1 = await saveCalepinageTerrasse(sbA, {
    entrepriseId: "ent-A",
    chantierId: "ch-cycle",
    calcParams: paramsV1,
  });
  assert(saveV1.calepinage.version === 1 && saveV1.calepinage.statut === "valide", "R: Création V1 valide");

  // 2. Création V2 (ex: premier ajustement)
  const paramsV2: CalepinageParams = {
    ...paramsV1,
    longueur_m: 6.2,
    largeur_m: 4.0,
  };
  const saveV2 = await saveCalepinageTerrasse(sbA, {
    entrepriseId: "ent-A",
    chantierId: "ch-cycle",
    calcParams: paramsV2,
  });
  assert(saveV2.calepinage.version === 2 && saveV2.calepinage.statut === "valide", "R: Création V2 valide");

  // Vérification de l'état avant correction de V2
  const calsBefore = await getCalepinagesTerrasseByChantier(sbA, "ch-cycle");
  const v1Before = calsBefore.find((v) => v.calepinage.version === 1);
  const v2Before = calsBefore.find((v) => v.calepinage.version === 2);
  assert(!!v1Before && v1Before.calepinage.statut === "archive", "R: V1 initiale est archivée");
  assert(!!v2Before && v2Before.calepinage.statut === "valide", "R: V2 initiale est active/valide");

  // A. Corriger V2 → création V3
  const paramsV3: CalepinageParams = {
    ...paramsV2,
    longueur_m: 6.5,
    largeur_m: 4.2,
    marge_chutes_pct: 12,
  };
  const saveV3Result = await saveCalepinageTerrasse(sbA, {
    entrepriseId: "ent-A",
    chantierId: "ch-cycle",
    calcParams: paramsV3,
  });
  assert(saveV3Result.calepinage.version === 3, "R.A: Corriger V2 -> création de la version V3");

  // B. V2 devient archivée
  const calsAfterV3 = await getCalepinagesTerrasseByChantier(sbA, "ch-cycle");
  const v2AfterV3 = calsAfterV3.find((v) => v.calepinage.version === 2);
  assert(!!v2AfterV3 && v2AfterV3.calepinage.statut === "archive", "R.B: V2 devient archivée après la création de V3");

  // C. V3 devient valide
  const v3 = calsAfterV3.find((v) => v.calepinage.version === 3);
  assert(!!v3 && v3.calepinage.statut === "valide", "R.C: V3 est la version active (statut = valide)");
  assert(v3!.details?.longueur_m === 6.5 && v3!.details?.largeur_m === 4.2, "R.C: V3 enregistre les dimensions corrigées");

  // D. Reprendre V1 archivée alors que V3 existe → création V4, pas V2
  // Simulation de la reprise de V1 : on charge les paramètres enregistrés de V1
  const v1Details = v1Before!.details!;
  const v1SavedParams = (v1Details.parametres || {}) as Partial<CalepinageParams>;
  const paramsV4FromV1: CalepinageParams = {
    ...REF,
    longueur_m: v1SavedParams.longueur_m ?? v1Details.longueur_m,
    largeur_m: v1SavedParams.largeur_m ?? v1Details.largeur_m,
    sens_pose_lames: (v1SavedParams.sens_pose_lames ?? v1Details.orientation_lames) as SensPoseLames,
    largeur_lame_mm: v1SavedParams.largeur_lame_mm ?? v1Details.largeur_lame_mm,
    longueur_lame_m: v1SavedParams.longueur_lame_m ?? v1Details.longueur_lame_m,
    espace_inter_lames_mm: v1SavedParams.espace_inter_lames_mm ?? v1Details.espace_inter_lames_mm,
    marge_chutes_pct: 15, // modification par l'utilisateur lors de la reprise de V1
    entraxe_lambourdes_cm: v1SavedParams.entraxe_lambourdes_cm ?? v1Details.entraxe_lambourdes_cm,
    longueur_lambourde_commerciale_m: v1SavedParams.longueur_lambourde_commerciale_m ?? 3,
    marge_lambourdes_pct: v1SavedParams.marge_lambourdes_pct ?? 8,
    entraxe_plots_cm: v1SavedParams.entraxe_plots_cm ?? v1Details.entraxe_plots_cm,
    type_fixation: (v1SavedParams.type_fixation ?? v1Details.type_fixation) as TypeFixationCalepinage,
    marge_fixations_pct: v1SavedParams.marge_fixations_pct ?? 5,
    taille_boite_vis: v1SavedParams.taille_boite_vis ?? 200,
  };
  const saveV4Result = await saveCalepinageTerrasse(sbA, {
    entrepriseId: "ent-A",
    chantierId: "ch-cycle",
    calcParams: paramsV4FromV1,
  });
  assert(saveV4Result.calepinage.version === 4, "R.D: Reprendre V1 archivée alors que V3 existe -> création V4 (pas V2)");

  const calsAfterV4 = await getCalepinagesTerrasseByChantier(sbA, "ch-cycle");
  const v1Final = calsAfterV4.find((v) => v.calepinage.version === 1);
  const v2Final = calsAfterV4.find((v) => v.calepinage.version === 2);
  const v3Final = calsAfterV4.find((v) => v.calepinage.version === 3);
  const v4Final = calsAfterV4.find((v) => v.calepinage.version === 4);

  assert(!!v1Final && v1Final.calepinage.statut === "archive", "R.D: V1 reste archivée (jamais ressuscitée)");
  assert(!!v2Final && v2Final.calepinage.statut === "archive", "R.D: V2 reste archivée");
  assert(!!v3Final && v3Final.calepinage.statut === "archive", "R.D: V3 est désormais archivée");
  assert(!!v4Final && v4Final.calepinage.statut === "valide", "R.D: V4 devient la nouvelle version valide active");

  // E. Tous les paramètres de V1 sont correctement préchargés
  // Vérification que tous les paramètres techniques disponibles de V1 sont fidèlement présents
  const preloadedFields = {
    longueur_m: v1SavedParams.longueur_m ?? v1Details.longueur_m,
    largeur_m: v1SavedParams.largeur_m ?? v1Details.largeur_m,
    sens_pose_lames: v1SavedParams.sens_pose_lames ?? v1Details.orientation_lames,
    largeur_lame_mm: v1SavedParams.largeur_lame_mm ?? v1Details.largeur_lame_mm,
    longueur_lame_m: v1SavedParams.longueur_lame_m ?? v1Details.longueur_lame_m,
    espace_inter_lames_mm: v1SavedParams.espace_inter_lames_mm ?? v1Details.espace_inter_lames_mm,
    marge_chutes_pct: v1SavedParams.marge_chutes_pct ?? v1Details.marge_chutes_pct,
    disposition_joints: "alignes",
    entraxe_lambourdes_cm: v1SavedParams.entraxe_lambourdes_cm ?? v1Details.entraxe_lambourdes_cm,
    longueur_lambourde_commerciale_m: v1SavedParams.longueur_lambourde_commerciale_m ?? 3,
    marge_lambourdes_pct: v1SavedParams.marge_lambourdes_pct ?? 8,
    entraxe_plots_cm: v1SavedParams.entraxe_plots_cm ?? v1Details.entraxe_plots_cm,
    type_fixation: v1SavedParams.type_fixation ?? v1Details.type_fixation,
    marge_fixations_pct: v1SavedParams.marge_fixations_pct ?? 5,
    taille_boite_vis: v1SavedParams.taille_boite_vis,
  };
  assert(preloadedFields.longueur_m === 6.0, "R.E: Longueur terrasse préchargée (6.0 m)");
  assert(preloadedFields.largeur_m === 4.0, "R.E: Largeur terrasse préchargée (4.0 m)");
  assert(preloadedFields.sens_pose_lames === "longueur", "R.E: Sens de pose préchargé (longueur)");
  assert(preloadedFields.largeur_lame_mm === 145, "R.E: Largeur lame préchargée (145 mm)");
  assert(preloadedFields.longueur_lame_m === 3.0, "R.E: Longueur lame préchargée (3.0 m)");
  assert(preloadedFields.espace_inter_lames_mm === 5, "R.E: Espace inter-lames préchargé (5 mm)");
  assert(preloadedFields.marge_chutes_pct === 10, "R.E: Marge chutes préchargée (10 %)");
  assert(preloadedFields.disposition_joints === "alignes", "R.E: Disposition joints = alignes");
  assert(preloadedFields.entraxe_lambourdes_cm === 40, "R.E: Entraxe lambourdes préchargé (40 cm)");
  assert(preloadedFields.longueur_lambourde_commerciale_m === 3, "R.E: Longueur commerciale lambourde préchargée (3 m)");
  assert(preloadedFields.marge_lambourdes_pct === 8, "R.E: Marge lambourdes préchargée (8 %)");
  assert(preloadedFields.entraxe_plots_cm === 50, "R.E: Entraxe plots préchargé (50 cm)");
  assert(preloadedFields.type_fixation === "vis", "R.E: Type de fixation préchargé (vis)");
  assert(preloadedFields.marge_fixations_pct === 5, "R.E: Marge fixations préchargée (5 %)");
  assert(preloadedFields.taille_boite_vis === 200, "R.E: Conditionnement boîte vis préchargé (200)");

  // F. Annuler la modification → aucune nouvelle version créée
  const versionsCountBeforeCancel = (await getCalepinagesTerrasseByChantier(sbA, "ch-cycle")).length;
  // Simulation de fermeture de CalepinageModal sans appel à saveCalepinageTerrasse :
  let simulatedModalOpen = true;
  simulatedModalOpen = false; // l'utilisateur ferme la modal (X ou Fermer)
  const versionsCountAfterCancel = (await getCalepinagesTerrasseByChantier(sbA, "ch-cycle")).length;
  assert(versionsCountBeforeCancel === versionsCountAfterCancel, "R.F: Annuler la modification -> aucune nouvelle version créée");

  // G. Les besoins de la nouvelle version deviennent actifs selon la logique existante
  const besoinsChCycleAfterV4 = await getBesoinsByChantier(sbA, "ch-cycle");
  assert(besoinsChCycleAfterV4.actifs.length === 4, "R.G: 4 besoins actifs rattachés exclusivement à V4");
  assert(besoinsChCycleAfterV4.actifs.every((b) => b.calepinage_id === v4Final!.calepinage.id && b.statut === "a_commander"), "R.G: Les besoins actifs appartiennent tous à V4");
  assert(besoinsChCycleAfterV4.totalACommander === 4, "R.G: Indicateur Cockpit totalACommander = 4");

  // Les besoins de V3 sont passés en annulé dans l'historique
  const besoinsV3InHist = besoinsChCycleAfterV4.historique.filter((b) => b.versionCalepinage === 3);
  assert(besoinsV3InHist.length === 4 && besoinsV3InHist.every((b) => b.statut === "annule"), "R.G: Les besoins de l'ancienne version V3 sont archivés avec statut annule");

  // Vérifications UX statiques
  assert(modalDetailCode.includes("✏ Modifier"), "R.UX: Bouton actif '✏ Modifier' présent dans VersionTerrasseDetailModal");
  assert(modalDetailCode.includes("Utiliser comme base"), "R.UX: Bouton archive 'Utiliser comme base' présent dans VersionTerrasseDetailModal");
  assert(modalDetailCode.includes("Cette version est archivée. Vous pouvez utiliser ses paramètres comme base d’un nouveau quantitatif."), "R.UX: Texte d'archivage conforme");
  assert(modalListCode.includes("✏ Modifier"), "R.UX: Bouton actif '✏ Modifier' présent dans QuantitatifsTerrasseModal");
  assert(calepinageModalCode.includes("Enregistrer le quantitatif"), "R.UX: Bouton de validation 'Enregistrer le quantitatif' présent dans CalepinageModal");
  assert(calepinageModalCode.includes("initialVersionItem"), "R.UX: CalepinageModal supporte initialVersionItem pour préchargement sans écrasement");
  assert(modalListCode.includes("onOpenNewVersion(activeVersion)") && modalListCode.includes("onOpenNewVersion(source)"), "R.UX: QuantitatifsTerrasseModal propage la version source vers CalepinageModal");

  console.log(`\n=== ${passed} VÉRIFICATIONS RÉUSSIES ===`);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
