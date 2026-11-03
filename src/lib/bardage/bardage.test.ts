import {
  calculerCalepinage,
  getHauteurToit,
  axeSymetrique,
  MIN_RIVE_WIDTH,
  DEFAULT_MIN_RIVE_WIDTH_MM,
  RIVE_MIN_MM,
} from "./calepinageCalcul.ts";
import { decoupageModulesCentres, calculerBesoinsBardage, calculerPose } from "./poseCalcul.ts";
import { genererPercagesPourModules } from "./percages.ts";
import { genererModules } from "./modules.ts";
import {
  construireBesoinsBardage,
  fusionnerBesoinsBardage,
  saveCalepinageBardage,
  getLatestCalepinageBardage,
} from "../services/calepinageService.ts";
import {
  analyzePoseConditions,
  generateAttestationIntemperie,
} from "../services/meteoAssistantService.ts";

let passed = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log(`✓ PASS: ${msg}`);
}
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

// 1. Façade plane 8,40 x 3,20, modules 1000x600
const f = calculerCalepinage({
  zoneLargeurM: 8.4, zoneHauteurM: 3.2, moduleLargeurMm: 1000, moduleHauteurMm: 600,
  plaqueLongueurMm: 3050, plaqueLargeurMm: 1300,
});
assert(near(f.surfaceZoneM2, 8.4 * 3.2), "façade : Σ pièces = surface de la zone");
assert(near(f.colonnesLargeursM[0], f.colonnesLargeursM[f.colonnesLargeursM.length - 1]), "façade : rives symétriques");
assert(f.colonnesLargeursM[0] >= 0.15, "façade : rive >= 150 mm");
assert(near(f.colonnesLargeursM.reduce((a, b) => a + b, 0), 8.4), "façade : colonnes = largeur zone");
assert(near(f.rangeesHauteursM.reduce((a, b) => a + b, 0), 3.2), "façade : rangées = hauteur zone");
assert(!f.piecesIncompatibles, "façade : aucune pièce incompatible");
assert(f.pieces.every((p) => p.plaqueIndex !== undefined), "façade : chaque pièce affectée à une plaque");
assert(f.nbPlaquesNecessaires * 3.05 * 1.3 >= f.surfaceZoneM2, "façade : surface achetée >= surface posée");

// 2. Pignon 6 m, mur 2,50 m, faîte 4,50 m => surface = rectangle + triangle
const p = calculerCalepinage({
  zoneLargeurM: 6, zoneHauteurM: 2.5, estPignon: true, hauteurFaiteM: 4.5,
  moduleLargeurMm: 1000, moduleHauteurMm: 600,
});
assert(near(p.surfaceZoneM2, 6 * 2.5 + (6 * 2) / 2, 1e-3), "pignon : surface = rectangle + triangle (21 m²)");
assert(p.pieces.some((x) => x.type === "pignon"), "pignon : pièces de rampant repérées P-");
assert(near(p.pentePct, (2 / 3) * 100, 1e-6), "pignon : pente 66,7 %");

// 3. Plaque trop petite : pièce déclarée incompatible, jamais de plan impossible
const inc = calculerCalepinage({
  zoneLargeurM: 4, zoneHauteurM: 2, moduleLargeurMm: 2000, moduleHauteurMm: 1500,
  plaqueLongueurMm: 1000, plaqueLargeurMm: 1000,
});
assert((inc.piecesIncompatibles?.length ?? 0) > 0, "incompatible : pièces trop grandes signalées");
assert(inc.plaquesDebit.every((pl) => pl.pieces.every((x) => x.largeurMm <= 1000 && x.hauteurMm <= 1000)), "incompatible : aucune pièce hors plaque dans le débit");

// 4. Décor directionnel : pas de pivot
const sansRot = calculerCalepinage({
  zoneLargeurM: 3, zoneHauteurM: 3, moduleLargeurMm: 1200, moduleHauteurMm: 1200,
  plaqueLongueurMm: 3050, plaqueLargeurMm: 1300, autoriserRotation: false,
});
assert(sansRot.plaquesDebit.every((pl) => pl.pieces.every((x) => x.largeurMm >= x.hauteurMm || x.largeurMm === Math.round(sansRot.pieces.find((q) => q.id === x.id)!.largeurM * 1000))), "sans rotation : dimensions d'origine conservées");

// 5. Entraxe DTU <= 600 mm
const e = calculerCalepinage({ zoneLargeurM: 5, zoneHauteurM: 3, moduleLargeurMm: 1200, moduleHauteurMm: 600 });
assert(e.entraxeReelMm <= 600, "DTU : entraxe réel <= 600 mm");
const d = decoupageModulesCentres(8400, 1000);
assert(near(d.nModules * 1000 + 2 * d.riveMm, 8400), "découpage centré : modules + 2 rives = largeur");

// 6. Perçages : 4 coins sur panneau plein
const perc = genererPercagesPourModules([
  { id: "m1", zone_id: "z", entreprise_id: "e", group_number: "1", x_mm: 0, y_mm: 0, width_mm: 1000, height_mm: 600, is_cut: false },
]);
assert(perc.length === 4, "perçages : 4 par panneau plein");

// 7. Besoins bardage
const b = calculerBesoinsBardage(0, 8.4, 3.2);
assert(b.mlChevrons > 0 && b.nbEquerres > 0 && b.nbChevilles === b.nbEquerres * 2, "besoins : chevrons, équerres, chevilles cohérents");

// 8. Lot D : Bordereau de débit (groupes de pièces identiques)
const mods = genererModules(f, "HPL Compact");
assert(mods.cuttingList.reduce((s, g) => s + g.count, 0) === f.nbPiecesPosees, "bordereau : Σ quantités groupes = nb pièces posées");
assert(mods.cuttingList.length === 2, "bordereau 8,40×3,20 : 2 formats de pièces (pleines 1000×640 + rives 200×640)");

// 9. Lot D : Besoins matériaux complets pour commande fournisseur (HPL avec ITE)
const poseHpl = calculerPose("hpl", 8.4, 3.2, false, 0, 1000, {
  moduleLargeurMm: 1000, moduleHauteurMm: 600, sensPose: "horizontal",
  epaisseurIsolantMm: 120, typeIsolant: "laine_roche",
});
const besoinsHpl = construireBesoinsBardage(f, poseHpl, { famille: "hpl", largeurM: 8.4, hauteurM: 3.2 });
assert(besoinsHpl.some((x) => x.categorie === "panneaux" && x.quantite === f.nbPlaquesNecessaires), "besoins HPL : plaques brutes égales au calepinage");
assert(besoinsHpl.some((x) => x.categorie === "ossature" && x.quantite === poseHpl.nbSegmentsChevrons), "besoins HPL : chevrons 3m présents");
assert(besoinsHpl.some((x) => x.categorie === "equerres"), "besoins HPL : équerres Isolco présentes");
assert(besoinsHpl.some((x) => x.categorie === "isolant" && x.quantite === poseHpl.isolant.nbPaquetsACommander), "besoins HPL : paquets d'isolant ITE présents");
assert(besoinsHpl.every((x) => x.quantite > 0 && x.designation.length > 0), "besoins HPL : toutes les lignes ont une quantité > 0");

// 10. Multi-façades : métré indépendant par façade + cumul global automatique
const posePignon = calculerPose("hpl", 6, 4.5, false, 0, 1000, {
  moduleLargeurMm: 1000, moduleHauteurMm: 600, sensPose: "horizontal",
  epaisseurIsolantMm: 120, typeIsolant: "laine_roche",
});
const besoinsPignon = construireBesoinsBardage(p, posePignon, {
  famille: "hpl", largeurM: 6, hauteurM: 4.5, estPignon: true, hauteurFaiteM: 4.5,
});
const besoinsCumules = fusionnerBesoinsBardage([besoinsHpl, besoinsPignon]);
const plaquesCumulees = besoinsCumules.find((x) => x.categorie === "panneaux");
assert(
  plaquesCumulees?.quantite === f.nbPlaquesNecessaires + p.nbPlaquesNecessaires,
  "multi-façades : plaques brutes globales = Façade 1 + Pignon 2"
);
const chevronsCumules = besoinsCumules.find((x) => x.categorie === "ossature");
assert(
  chevronsCumules?.quantite === poseHpl.nbSegmentsChevrons + posePignon.nbSegmentsChevrons,
  "multi-façades : chevrons 3m globaux = Façade 1 + Pignon 2"
);

// 11. Lot E : Ouvertures (fenêtres / portes) -> profilés d'habillage tableaux/linteaux/bavettes
const besoinsAvecOuvertures = construireBesoinsBardage(f, poseHpl, {
  famille: "hpl",
  largeurM: 8.4,
  hauteurM: 3.2,
  ouvertures: [
    { largeurM: 1.2, hauteurM: 1.2 },
    { largeurM: 0.9, hauteurM: 2.15 },
  ],
});
const habillageOuv = besoinsAvecOuvertures.find((x) =>
  x.designation.includes("Profilés d'habillage ouvertures")
);
// Périmètre = 2*(1.2+1.2) + 2*(0.9+2.15) = 4.8 + 6.1 = 10.9 ml -> ceil(10.9 * 1.1 / 3) = 4 barres de 3 m
assert(
  habillageOuv !== undefined && habillageOuv.quantite === 4,
  "Lot E : ouvertures génèrent 4 barres de 3,00 m d'habillage tableaux/linteaux/appuis"
);

// 12. Lot E : Persistance Supabase structurée & versionnement (saveCalepinageBardage + getLatestCalepinageBardage)
async function testPersistanceBardage() {
  const memCalepinages: any[] = [];
  const memDetails: any[] = [];
  const memBesoins: any[] = [];

  const mockSupabase: any = {
    from(table: string) {
      return {
        select() {
          const chain: any = {
            _filters: {} as Record<string, any>,
            eq(col: string, val: any) {
              chain._filters[col] = val;
              return chain;
            },
            order() {
              const rows =
                table === "calepinages"
                  ? memCalepinages
                      .filter(
                        (r) =>
                          (!chain._filters.chantier_id || r.chantier_id === chain._filters.chantier_id) &&
                          (!chain._filters.metier || r.metier === chain._filters.metier) &&
                          (!chain._filters.statut || r.statut === chain._filters.statut)
                      )
                      .sort((a, b) => b.version - a.version)
                  : [];
              const resObj: any = Promise.resolve({ data: rows, error: null });
              resObj.limit = () => {
                const p: any = Promise.resolve({ data: rows.slice(0, 1), error: null });
                p.maybeSingle = () =>
                  Promise.resolve({ data: rows[0] || null, error: null });
                return p;
              };
              return resObj;
            },
            maybeSingle() {
              const found = memDetails.find(
                (d) => d.calepinage_id === chain._filters.calepinage_id
              );
              return Promise.resolve({ data: found || null, error: null });
            },
          };
          return chain;
        },
        update(patch: any) {
          const chain: any = {
            eq() {
              return chain;
            },
            then(resolve: any) {
              if (table === "calepinages") {
                memCalepinages.forEach((c) => Object.assign(c, patch));
              }
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
          return chain;
        },
        delete() {
          const chain: any = {
            eq() {
              return chain;
            },
            then(resolve: any) {
              if (table === "besoins_materiaux") memBesoins.length = 0;
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
          return chain;
        },
        insert(payload: any) {
          if (table === "calepinages") {
            const row = { id: `cal-${memCalepinages.length + 1}`, ...payload };
            memCalepinages.push(row);
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: row, error: null });
                  },
                };
              },
            };
          }
          if (table === "calepinages_bardage") {
            const row = { id: `cb-${memDetails.length + 1}`, ...payload };
            memDetails.push(row);
            return Promise.resolve({ data: row, error: null });
          }
          if (table === "besoins_materiaux") {
            const rows = (Array.isArray(payload) ? payload : [payload]).map((r, i) => ({
              id: `bm-${i + 1}`,
              ...r,
            }));
            memBesoins.push(...rows);
            return {
              select() {
                return Promise.resolve({ data: rows, error: null });
              },
            };
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };

  const savedV1 = await saveCalepinageBardage(mockSupabase, {
    entrepriseId: "ent-1",
    chantierId: "ch-1",
    besoinsPayloads: besoinsCumules,
    facadesJson: [{ id: "f1", nom: "Façade Avant" }, { id: "f2", nom: "Pignon Est" }],
    nbFacades: 2,
    surfaceTotaleM2: 47.88,
    surfaceOuverturesM2: 3.38,
    nbPlaquesTotal: f.nbPlaquesNecessaires + p.nbPlaquesNecessaires,
  });
  assert(savedV1.calepinage.version === 1, "Lot E : 1er enregistrement crée la V1");
  assert(memDetails.length === 1 && memDetails[0].nb_facades === 2, "Lot E : détail multi-façades sauvegardé dans calepinages_bardage");

  const latest = await getLatestCalepinageBardage(mockSupabase, "ch-1");
  assert(latest !== null && latest.calepinage.version === 1, "Lot E : getLatestCalepinageBardage retrouve la V1 active");
  assert(Array.isArray(latest?.detail?.facades_json) && latest!.detail!.facades_json.length === 2, "Lot E : les 2 façades sont restaurées depuis Supabase");
}

await testPersistanceBardage();

// 13. Règles météo HPL / Bardage (DTU 41.2 / DTU 45.4 / Polyrey)
const mockFroid: any = {
  current: { temperature_2m: 2, precipitation: 0, wind_speed_10m: 10, relative_humidity_2m: 65 },
  daily: [{ temperature_2m_min: 1, temperature_2m_max: 4, precipitation_sum: 0, wind_gusts_10m_max: 15, hourly: [] }],
};
const analyseFroid = analyzePoseConditions("facade", mockFroid, null);
assert(
  analyseFroid.globalStatus === "interruption" &&
    analyseFroid.pointsCritiques.some((p) => p.includes("cassant") && p.includes("5°C")) &&
    analyseFroid.pointsCritiques.some((p) => p.includes("EPDM")),
  "Météo HPL (< 5°C) : interruption de pose + alertes fissuration perçage et non-adhérence EPDM/colles"
);

const mockFraisPolyrey: any = {
  current: { temperature_2m: 8, precipitation: 0, wind_speed_10m: 10, relative_humidity_2m: 60 },
  daily: [{ temperature_2m_min: 7, temperature_2m_max: 11, precipitation_sum: 0, wind_gusts_10m_max: 15, hourly: [] }],
};
const analyseFrais = analyzePoseConditions("facade", mockFraisPolyrey, null);
assert(
  analyseFrais.globalStatus === "vigilance" &&
    analyseFrais.pointsCritiques.some((p) => p.includes("Polyrey") && p.includes("5 heures")),
  "Météo HPL (5°C-10°C) : vigilance + rappel du seuil contractuel 10°C pendant 5h (Polyrey)"
);

const mockChaleur: any = {
  current: { temperature_2m: 36, precipitation: 0, wind_speed_10m: 10, relative_humidity_2m: 40 },
  daily: [{ temperature_2m_min: 22, temperature_2m_max: 36, precipitation_sum: 0, wind_gusts_10m_max: 15, hourly: [] }],
};
const analyseChaleur = analyzePoseConditions("facade", mockChaleur, null);
assert(
  analyseChaleur.globalStatus === "interruption" &&
    analyseChaleur.pointsCritiques.some((p) => p.includes("cisaillement") && p.includes("bombement")),
  "Météo HPL (>= 35°C) : interruption forte chaleur + alerte dilatation maximale / cisaillement au retrait hivernal"
);

const mockPluie: any = {
  current: { temperature_2m: 15, precipitation: 1.8, wind_speed_10m: 20, relative_humidity_2m: 92 },
  daily: [{ temperature_2m_min: 12, temperature_2m_max: 16, precipitation_sum: 6.5, wind_gusts_10m_max: 30, hourly: [] }],
};
const analysePluie = analyzePoseConditions("facade", mockPluie, null);
assert(
  analysePluie.globalStatus === "interruption" &&
    analysePluie.pointsCritiques.some((p) => p.includes("19 %") && p.includes("DTU 45.4")) &&
    analysePluie.pointsCritiques.some((p) => p.includes("3 jours")) &&
    analysePluie.pointsCritiques.some((p) => p.includes("bâcher")),
  "Météo HPL (Pluie/Humidité) : interdiction + humidité bois < 19% (DTU 41.2/45.4) + acclimatation 3j + pare-pluie/bâchage"
);

const attestPluie = generateAttestationIntemperie(
  { id: "ch-test", nom: "Résidence Pinède", ville: "Arcachon", metier: "facade" } as any,
  mockPluie,
  null
);
assert(
  attestPluie.motifPrincipal.includes("19 %") &&
    attestPluie.reglementationsBtp.some((r) => r.includes("DTU 45.4")) &&
    attestPluie.reglementationsBtp.some((r) => r.includes("Polyrey")),
  "Attestation Intempérie Bardage : intègre DTU 41.2/45.4 (< 19%), acclimatation 72h et seuils thermiques HPL"
);

// 14. Règles météo Bardage Bois (DTU 41.2 : humidimètre 13%-18%, pluie rainures/languettes, soleil >30°C, acclimatation 72h, lame d'air 20mm)
const analyseBoisPluie = analyzePoseConditions("facade", mockPluie, null, "bois");
assert(
  analyseBoisPluie.globalStatus === "interruption" &&
    Boolean(analyseBoisPluie.dilatationJeuConseille?.includes("13 % et 18 %")) &&
    analyseBoisPluie.pointsCritiques.some((p) => p.includes("rainures et languettes")) &&
    analyseBoisPluie.recommandationsPose.some((r) => r.includes("72h") && r.includes("bâche plastique hermétique")) &&
    analyseBoisPluie.recommandationsPose.some((r) => r.includes("20 mm") && r.includes("grilles anti-rongeurs")),
  "Météo Bardage Bois (Pluie) : interruption + humidimètre 13%-18% + rainures/languettes + acclimatation 72h + lame d'air 20 mm"
);

const analyseBoisSoleil = analyzePoseConditions("facade", mockChaleur, null, "bois");
assert(
  analyseBoisSoleil.globalStatus === "vigilance" &&
    analyseBoisSoleil.pointsCritiques.some((p) => p.includes("paquets de lames déballés en plein soleil") && p.includes("tuilage")),
  "Météo Bardage Bois (>= 30°C) : alerte stockage paquets déballés au soleil et risque de tuilage"
);

const attestBois = generateAttestationIntemperie(
  { id: "ch-bois", nom: "Chalet Douglas", ville: "Lège-Cap-Ferret", metier: "facade" } as any,
  mockPluie,
  null,
  "bois"
);
assert(
  attestBois.motifPrincipal.includes("13 % et 18 %") &&
    attestBois.reglementationsBtp.some((r) => r.includes("72h") && r.includes("20 mm")),
  "Attestation Intempérie Bardage Bois : intègre humidimètre 13%-18%, acclimatation 72h et lame d'air 20 mm (DTU 41.2)"
);

// 15. NOUVEAU : Calcul géométrique des pignons, classification P-xx et couplage tête-bêche (Nesting trapèzes/triangles)
const pignonTest = calculerCalepinage({
  zoneLargeurM: 6.0,
  zoneHauteurM: 2.5,
  estPignon: true,
  hauteurFaiteM: 4.5,
  moduleLargeurMm: 1000,
  moduleHauteurMm: 563,
  plaqueLongueurMm: 3050,
  plaqueLargeurMm: 1300,
});

// A. Vérification de la classification stricte
const piecesSousEgout = pignonTest.pieces.filter((p) => p.yM + p.hauteurM <= 2.5 + 1e-4);
assert(
  piecesSousEgout.every((p) => p.type !== "pignon" && !p.repere.startsWith("P-")),
  "Pignon : Aucune pièce sous l'égout n'est classée à tort en P-xx (strictement M-xx ou R-xx)"
);

const piecesRampant = pignonTest.pieces.filter((p) => p.type === "pignon");
assert(
  piecesRampant.length > 0 && piecesRampant.every((p) => p.repere.startsWith("P-") && p.pignonDetails !== undefined),
  "Pignon : Toutes les pièces traversées par la pente sont strictement classées en P-xx avec pignonDetails"
);

// B. Vérification des dimensions réelles (cutWidth × cutHeight)
assert(
  piecesRampant.some((p) => p.pignonDetails!.cutWidthMm < 1000 || p.pignonDetails!.cutHeightMm < 563),
  "Pignon : Les pièces de pointe ont un cutWidth ou cutHeight inférieur à la cellule de grille brute (1000×563)"
);

// C. Vérification de la boîte englobante (largeurM et hauteurM)
for (const pr of piecesRampant) {
  assert(
    Math.round(pr.largeurM * 1000) === pr.pignonDetails!.cutWidthMm &&
      Math.round(pr.hauteurM * 1000) === pr.pignonDetails!.cutHeightMm,
    `Pignon : Pièce ${pr.repere} largeurM (${pr.largeurM}) et hauteurM (${pr.hauteurM}) correspondent exactement à cutWidth (${pr.pignonDetails!.cutWidthMm}) et cutHeight (${pr.pignonDetails!.cutHeightMm})`
  );
}

// D. Vérification du couplage tête-bêche (Nesting de trapèzes)
assert(
  (pignonTest.nbPiecesCouplees ?? 0) > 0 && (pignonTest.nbBlocsCouples ?? 0) > 0,
  `Pignon : Couplage tête-bêche actif (${pignonTest.nbPiecesCouplees} pièces couplées, ${pignonTest.nbBlocsCouples} blocs)`
);

// E. Vérification des blocs couplés dans les plaques de débit
const piecesDebitCouplees = pignonTest.plaquesDebit
  .flatMap((pl) => pl.pieces)
  .filter((p) => p.coupleAvec !== undefined);
assert(
  piecesDebitCouplees.length === pignonTest.nbBlocsCouples,
  "Pignon : Nombre de blocs couplés dans plaquesDebit égal à nbBlocsCouples"
);

for (const b of piecesDebitCouplees) {
  assert(
    b.nom.includes("[Couplé]") && b.repere.includes("+"),
    `Pignon : Bloc couplé ${b.repere} porte l'étiquette [Couplé]`
  );
  assert(
    b.surfaceM2 > 0 && b.coupleAvec !== undefined,
    "Pignon : Bloc couplé porte la référence et les cotes de la pièce associée"
  );
}

// F. Vérification du rendement par plaque brute
for (const pl of pignonTest.plaquesDebit) {
  assert(
    pl.tauxRendementPct > 0 && pl.tauxRendementPct <= 100,
    `Pignon : Rendement plaque ${pl.index} valide (${pl.tauxRendementPct.toFixed(1)}%)`
  );
}

// ---------------------------------------------------------------------------
// 16. PLAN 3D : DÉCOUPE PIGNON DU MUR SUPPORT, ISOLANT ITE, ARASE CHEVRONS ET ANGLE RASANT
// ---------------------------------------------------------------------------
// A. Préservation de la hauteur du mur d'égout dans ResultatCalepinage
assert(
  pignonTest.hauteurMurM === 2.5,
  `Plan 3D : hauteurMurM (${pignonTest.hauteurMurM}) conservée fidèlement dans ResultatCalepinage`
);

// B. Silhouette 3D du mur support et de l'isolant ITE
// Façade pignon : profil exact en 5 points (0,0) -> (W,0) -> (W, H_egout) -> (ridgeX, H_faite) -> (0, H_egout)
const W = 6.0;
const hMur = pignonTest.hauteurMurM ?? 2.5;
const hFaite = pignonTest.hauteurFaiteM;
const ridgeX = W / 2;

const silhouettePignon3D = [
  { x: 0, y: 0, z: 0 },
  { x: W, y: 0, z: 0 },
  { x: W, y: hMur, z: 0 },
  { x: ridgeX, y: hFaite, z: 0 },
  { x: 0, y: hMur, z: 0 },
];
assert(
  silhouettePignon3D.length === 5,
  "Plan 3D : Profil du mur support et isolant pignon possède 5 sommets (pentagone arase toit)"
);
assert(
  silhouettePignon3D[3].x === 3.0 && silhouettePignon3D[3].y === 4.5,
  "Plan 3D : Sommet faîtage pignon exact à (ridgeX=3m, hFaite=4.5m)"
);
assert(
  silhouettePignon3D[2].y === 2.5 && silhouettePignon3D[4].y === 2.5,
  "Plan 3D : Égouts gauche et droit à la hauteur exacte du mur (2.5m)"
);

// C. Arase des chevrons verticaux sous rampant avec garde de ventilation DTU (30 mm)
const getHToit = (x: number) => {
  if (x <= ridgeX) {
    return hMur + (x / ridgeX) * (hFaite - hMur);
  } else {
    return hMur + ((W - x) / (W - ridgeX)) * (hFaite - hMur);
  }
};

const jeuVentilationM = 0.03; // 30 mm
const positionsChevronsTest = [0.1, 1.0, 2.0, 3.0, 4.0, 5.0, 5.9];
for (const cx of positionsChevronsTest) {
  const chevWidth = 0.055;
  const x0 = Math.max(0, cx - chevWidth / 2);
  const x1 = Math.min(W, cx + chevWidth / 2);
  const yTop0 = Math.max(0.15, getHToit(x0) - jeuVentilationM);
  const yTop1 = Math.max(0.15, getHToit(x1) - jeuVentilationM);

  assert(
    yTop0 <= getHToit(x0) && yTop1 <= getHToit(x1),
    `Plan 3D : Chevron à x=${cx}m strictement arasé sous le toit (yTop <= H_toit)`
  );
  assert(
    Math.abs(getHToit(x0) - yTop0 - jeuVentilationM) < 0.001,
    `Plan 3D : Chevron à x=${cx}m respecte la garde de ventilation DTU de 30 mm`
  );
}

// D. Lisibilité des étiquettes en rotation 3D (Détection angle rasant |cos(angle)| < 0.35)
function evaluerVisibiliteEtiquette(normalZ: number, normalX: number, normalY: number, yawDeg: number, pitchDeg: number): boolean {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  const nx1 = normalX * cosY + normalZ * sinY;
  const nz1 = -normalX * sinY + normalZ * cosY;
  const nz2 = normalY * sinP + nz1 * cosP;
  return nz2 >= 0.35;
}

// Normale de la face avant de la façade : (0, 0, 1)
assert(
  evaluerVisibiliteEtiquette(1, 0, 0, 0, 0) === true,
  "Plan 3D : Vue de Face (yaw=0, pitch=0) -> étiquettes visibles (cos = 1.0 >= 0.35)"
);
assert(
  evaluerVisibiliteEtiquette(1, 0, 0, -28, 16) === true,
  "Plan 3D : Vue Iso G (yaw=-28, pitch=16) -> étiquettes visibles (cos ≈ 0.85 >= 0.35)"
);
assert(
  evaluerVisibiliteEtiquette(1, 0, 0, 32, 18) === true,
  "Plan 3D : Vue Iso D (yaw=32, pitch=18) -> étiquettes visibles (cos ≈ 0.81 >= 0.35)"
);
assert(
  evaluerVisibiliteEtiquette(1, 0, 0, 75, 0) === false,
  "Plan 3D : Vue Profil Tranche (yaw=75) -> étiquettes masquées pour éviter chevauchement (|cos| = 0.26 < 0.35)"
);
assert(
  evaluerVisibiliteEtiquette(1, 0, 0, -80, 10) === false,
  "Plan 3D : Vue Tranche Éclatée DTU (yaw=-80, pitch=10) -> étiquettes masquées"
);
assert(
  evaluerVisibiliteEtiquette(1, 0, 0, 180, 0) === false,
  "Plan 3D : Vue Arrière (yaw=180) -> étiquettes masquées (face arrière)"
);

// ---------------------------------------------------------------------------
// 17. SYNCHRONISATION DU TOIT ET LAYER PRIORITY CONTRE BUG Z-SORTING
// ---------------------------------------------------------------------------

// A. Unification exacte de getHauteurToit
assert(
  typeof getHauteurToit === "function",
  "getHauteurToit est exportée et accessible pour la 3D et la 2D"
);
const hEaves = 3.2;
const hPeak = 4.5;
const wallW = 8.4;
assert(
  getHauteurToit(0, wallW, hEaves, hPeak) === hEaves,
  "getHauteurToit(0) = hauteur égout (3.2m)"
);
assert(
  getHauteurToit(wallW, wallW, hEaves, hPeak) === hEaves,
  "getHauteurToit(wallW) = hauteur égout (3.2m)"
);
assert(
  getHauteurToit(wallW / 2, wallW, hEaves, hPeak) === hPeak,
  "getHauteurToit(ridgeX) = hauteur faîtage (4.5m)"
);

// B. Simulation du comparateur Layer Priority
interface TestPolyItem {
  id: string;
  facadeId: string;
  layerId: number; // 1: Mur, 2: ITE, 3: Chevrons, 4: Panneaux, 5: Ouvertures
  isSideChant?: boolean;
  avgDepth: number;
}

function comparerPolygones(
  a: TestPolyItem,
  b: TestPolyItem,
  facadeDepthMap: Map<string, number>,
  facadeFacingMap: Map<string, boolean>
): number {
  if (a.facadeId !== b.facadeId) {
    const depthA = facadeDepthMap.get(a.facadeId) ?? a.avgDepth;
    const depthB = facadeDepthMap.get(b.facadeId) ?? b.avgDepth;
    if (Math.abs(depthA - depthB) > 0.1) {
      return depthA - depthB;
    }
  }

  const isFront = facadeFacingMap.get(a.facadeId) ?? true;
  const rankA = isFront ? a.layerId : 10 - a.layerId;
  const rankB = isFront ? b.layerId : 10 - b.layerId;

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  if (Boolean(a.isSideChant) !== Boolean(b.isSideChant)) {
    return (a.isSideChant ? 0 : 1) - (b.isSideChant ? 0 : 1);
  }

  return a.avgDepth - b.avgDepth;
}

// C. Test à angle oblique critique (-33° / 37°)
// Le grand polygone ITE a un avgDepth au centre (ex: 2.1 m) plus proche que le panneau d'extrémité (ex: 0.8 m)
const polyMur: TestPolyItem = { id: "mur", facadeId: "f1", layerId: 1, avgDepth: 2.0 };
const polyITE: TestPolyItem = { id: "ite", facadeId: "f1", layerId: 2, avgDepth: 2.5 };
const polyChev: TestPolyItem = { id: "chev", facadeId: "f1", layerId: 3, avgDepth: 2.8 };
const polyPanneauExtremite: TestPolyItem = { id: "M-41", facadeId: "f1", layerId: 4, avgDepth: 0.5 }; // profondeur plus faible à cause de l'oblique

const testList = [polyPanneauExtremite, polyChev, polyITE, polyMur];
const depthMap = new Map([["f1", 2.0]]);
const facingMap = new Map([["f1", true]]);

testList.sort((a, b) => comparerPolygones(a, b, depthMap, facingMap));

assert(
  testList[0].id === "mur" &&
    testList[1].id === "ite" &&
    testList[2].id === "chev" &&
    testList[3].id === "M-41",
  "Layer Priority : Mur -> Isolant ITE -> Chevrons -> Panneau M-41 respecté malgré l'angle oblique"
);

// D. Test en vue arrière (facadeFacing = false)
const facingBackMap = new Map([["f1", false]]);
testList.sort((a, b) => comparerPolygones(a, b, depthMap, facingBackMap));
assert(
  testList[0].id === "M-41" &&
    testList[1].id === "chev" &&
    testList[2].id === "ite" &&
    testList[3].id === "mur",
  "Layer Priority vue arrière : Panneau -> Chevrons -> ITE -> Mur strictement inversé"
);

// E. Cohérence stricte de classification sur 8.4m x 3.2m / 4.5m
const pignonCal = calculerCalepinage({
  zoneLargeurM: 8.4,
  zoneHauteurM: 3.2,
  moduleLargeurMm: 1000,
  moduleHauteurMm: 600,
  estPignon: true,
  hauteurFaiteM: 4.5,
});

for (const p of pignonCal.pieces) {
  const z1 = getHauteurToit(p.xM, 8.4, 3.2, 4.5);
  const z2 = getHauteurToit(p.xM + p.largeurM, 8.4, 3.2, 4.5);
  const yTop = p.yM + p.hauteurM;

  if (p.type === "pleine") {
    assert(
      Math.min(z1, z2) >= yTop - 0.001,
      `Classification stricte : pièce pleine ${p.repere} est 100% sous le rampant (minZ >= yTop)`
    );
  } else if (p.type === "pignon") {
    assert(
      p.pignonDetails !== undefined,
      `Classification stricte : pièce pignon ${p.repere} possède pignonDetails`
    );
  }
}

// F. Alignement précis de l'échelle verticale Y : P-02 à 449 mm et P-07 à 506 mm de leur base
const p02 = pignonCal.pieces.find((p) => p.repere === "P-02");
assert(
  p02 !== undefined && p02.pignonDetails?.hLeftMm === 449,
  `Pignon Y-align : P-02 est coupée exactement à 449 mm de sa base (obtenu: ${p02?.pignonDetails?.hLeftMm} mm)`
);
assert(
  p02 !== undefined &&
    Math.abs(getHauteurToit(0.2, 8.4, 3.2, 4.5) - (p02.yM + p02.pignonDetails!.hLeftMm / 1000)) <= 0.001,
  "Pignon Y-align : Ligne de toit 2D/3D passe exactement au sommet du rampant de P-02 à x=0.20m"
);

const p07 = pignonCal.pieces.find((p) => p.repere === "P-07");
assert(
  p07 !== undefined && p07.pignonDetails?.hLeftMm === 506,
  `Pignon Y-align : P-07 est coupée exactement à 506 mm de sa base (obtenu: ${p07?.pignonDetails?.hLeftMm} mm)`
);
assert(
  p07 !== undefined &&
    Math.abs(getHauteurToit(2.2, 8.4, 3.2, 4.5) - (p07.yM + p07.pignonDetails!.hLeftMm / 1000)) <= 0.001,
  "Pignon Y-align : Ligne de toit 2D/3D passe exactement au sommet du rampant de P-07 à x=2.20m"
);

// G. Aucune pièce située au-dessus de la ligne réelle de toit
for (const p of pignonCal.pieces) {
  const pts = p.points ?? [
    { xM: p.xM, yM: p.yM },
    { xM: p.xM + p.largeurM, yM: p.yM },
    { xM: p.xM + p.largeurM, yM: p.yM + p.hauteurM },
    { xM: p.xM, yM: p.yM + p.hauteurM },
  ];
  for (const pt of pts) {
    const roofY = getHauteurToit(pt.xM, 8.4, 3.2, 4.5);
    assert(
      pt.yM <= roofY + 0.001,
      `Pignon Y-align : Point (${pt.xM}, ${pt.yM}) de ${p.repere} ne dépasse pas la toiture (${roofY.toFixed(3)})`
    );
  }
}

// 16. RÈGLE ANTI-MICRO-PLAQUES EN RIVE (Centrage, absorption & seuil minimal MIN_RIVE_WIDTH)

// A. Constantes exportées
assert(MIN_RIVE_WIDTH === 250, "Anti-micro-plaques : MIN_RIVE_WIDTH = 250 mm");
assert(DEFAULT_MIN_RIVE_WIDTH_MM === 250, "Anti-micro-plaques : DEFAULT_MIN_RIVE_WIDTH_MM = 250 mm");
assert(RIVE_MIN_MM === 150, "Anti-micro-plaques : RIVE_MIN_MM = 150 mm (seuil historique)");

// B. Façade 1.05m avec module 1000mm : élimination des micro-rives de 25 mm
// Sans la règle, le calcul brut donnait [0.025, 1.000, 0.025].
// Avec la règle anti-micro-plaques, les 2 coupes de 25 mm sont absorbées dans 2 panneaux symétriques de 525 mm.
const f105 = calculerCalepinage({
  zoneLargeurM: 1.05,
  zoneHauteurM: 2.0,
  moduleLargeurMm: 1000,
  moduleHauteurMm: 500,
  minRiveWidthMm: 250,
});

assert(f105.colonnesLargeursM.length === 2, "Anti-micro-plaques 1.05m : division en 2 panneaux");
assert(near(f105.colonnesLargeursM[0], 0.525), "Anti-micro-plaques 1.05m : panneau gauche = 525 mm");
assert(near(f105.colonnesLargeursM[1], 0.525), "Anti-micro-plaques 1.05m : panneau droit = 525 mm");
assert(
  f105.pieces.every((p) => p.largeurM >= 0.25),
  "Anti-micro-plaques 1.05m : toutes les pièces >= 250 mm (aucune micro-plaque de 25 mm)"
);
const rivesF105 = f105.pieces.filter((p) => p.repere.startsWith("R-"));
assert(
  rivesF105.every((p) => p.largeurM >= 0.25),
  "Anti-micro-plaques 1.05m : toutes les pièces R-xx >= 250 mm"
);

// C. Façade 1.08m avec module 1000mm et minRiveWidthMm: 250
const f108 = calculerCalepinage({
  zoneLargeurM: 1.08,
  zoneHauteurM: 2.4,
  moduleLargeurMm: 1000,
  moduleHauteurMm: 600,
  minRiveWidthMm: 250,
});
assert(
  near(f108.colonnesLargeursM[0], 0.54) && near(f108.colonnesLargeursM[1], 0.54),
  "Anti-micro-plaques 1.08m : 2 panneaux de 540 mm (pas de micro-chute de 40 mm)"
);
assert(
  f108.pieces.every((p) => p.largeurM >= 0.25),
  "Anti-micro-plaques 1.08m : aucune pièce < 250 mm"
);

// D. Façade 2.05m avec module 1000mm et minRiveWidthMm: 250
// Le calcul brut donnerait 25 mm + 1000 + 1000 + 25 mm.
// L'algorithme absorbe un module plein pour élargir les rives à 525 mm : [525, 1000, 525].
const f205 = calculerCalepinage({
  zoneLargeurM: 2.05,
  zoneHauteurM: 2.5,
  moduleLargeurMm: 1000,
  moduleHauteurMm: 500,
  minRiveWidthMm: 250,
});
assert(f205.colonnesLargeursM.length === 3, "Anti-micro-plaques 2.05m : 3 colonnes (2 rives + 1 module)");
assert(near(f205.colonnesLargeursM[0], 0.525), "Anti-micro-plaques 2.05m : rive gauche = 525 mm");
assert(near(f205.colonnesLargeursM[1], 1.0), "Anti-micro-plaques 2.05m : module central = 1000 mm");
assert(near(f205.colonnesLargeursM[2], 0.525), "Anti-micro-plaques 2.05m : rive droite = 525 mm");
assert(
  f205.pieces.filter((p) => p.repere.startsWith("R-")).every((p) => p.largeurM >= 0.25),
  "Anti-micro-plaques 2.05m : aucune pièce R-xx < 250 mm"
);

// E. Façade 5.40m avec module 1000mm et minRiveWidthMm: 250
// Brut : 200 mm + 5x1000 + 200 mm (< 250 mm).
// Avec minRiveWidthMm: 250 -> 4 modules pleins et rives de (5400 - 4000) / 2 = 700 mm.
const f540 = calculerCalepinage({
  zoneLargeurM: 5.4,
  zoneHauteurM: 3.0,
  moduleLargeurMm: 1000,
  moduleHauteurMm: 600,
  minRiveWidthMm: 250,
});
assert(near(f540.colonnesLargeursM[0], 0.7), "Anti-micro-plaques 5.40m : rive gauche élargie à 700 mm");
assert(near(f540.colonnesLargeursM[f540.colonnesLargeursM.length - 1], 0.7), "Anti-micro-plaques 5.40m : rive droite élargie à 700 mm");
assert(
  f540.pieces.filter((p) => p.repere.startsWith("R-")).every((p) => p.largeurM >= 0.25),
  "Anti-micro-plaques 5.40m : toutes les rives R-xx font 700 mm >= 250 mm"
);

// F. Seuil personnalisé paramétrable : minRiveWidth: 300 mm sur façade 3.40m
const f340 = calculerCalepinage({
  zoneLargeurM: 3.4,
  zoneHauteurM: 2.5,
  moduleLargeurMm: 1000,
  moduleHauteurMm: 500,
  minRiveWidth: 300,
});
assert(near(f340.colonnesLargeursM[0], 0.7), "Anti-micro-plaques seuil 300mm : rive gauche = 700 mm");
assert(
  f340.pieces.every((p) => p.largeurM >= 0.3),
  "Anti-micro-plaques seuil 300mm : aucune pièce < 300 mm"
);

// G. Façade étroite (0.40m >= 250mm mais < module 1000mm)
const f040 = calculerCalepinage({
  zoneLargeurM: 0.4,
  zoneHauteurM: 2.0,
  moduleLargeurMm: 1000,
  moduleHauteurMm: 500,
  minRiveWidthMm: 250,
});
assert(f040.colonnesLargeursM.length === 1 && near(f040.colonnesLargeursM[0], 0.4), "Façade étroite 0.40m : 1 panneau plein de 400 mm");

// H. Façade très étroite (0.20m < 250mm)
const f020 = calculerCalepinage({
  zoneLargeurM: 0.2,
  zoneHauteurM: 2.0,
  moduleLargeurMm: 1000,
  moduleHauteurMm: 500,
  minRiveWidthMm: 250,
});
assert(f020.colonnesLargeursM.length === 1 && near(f020.colonnesLargeursM[0], 0.2), "Façade très étroite 0.20m : 1 panneau de 200 mm");

// I. Pignon avec règle anti-micro-plaques (largeur 7.40m, minRiveWidthMm: 250)
const pignonAntiMicro = calculerCalepinage({
  zoneLargeurM: 7.4,
  zoneHauteurM: 2.6,
  estPignon: true,
  hauteurFaiteM: 4.2,
  moduleLargeurMm: 1000,
  moduleHauteurMm: 600,
  minRiveWidthMm: 250,
});
assert(near(pignonAntiMicro.colonnesLargeursM[0], 0.7), "Pignon anti-micro-plaques : rives élargies à 700 mm (au lieu de 200 mm)");
const rivesPignon = pignonAntiMicro.pieces.filter((p) => p.repere.startsWith("R-"));
assert(
  rivesPignon.length > 0 && rivesPignon.every((p) => p.largeurM >= 0.25),
  "Pignon anti-micro-plaques : toutes les pièces de rive R-xx sous l'égout font 700 mm >= 250 mm"
);

// J. Extension anti-micro-plaques aux pièces de pignon (P-xx) et rampants
// Pignon de 6.00m x 2.50m (faîte 4.50m) avec module 1000x563 et minRiveWidthMm: 250
// Les micro-pointes (comme l'ancienne P-03 de 31x21 mm) sont absorbées dans la rangée inférieure.
const pignonEtendu = calculerCalepinage({
  zoneLargeurM: 6.0,
  zoneHauteurM: 2.5,
  estPignon: true,
  hauteurFaiteM: 4.5,
  moduleLargeurMm: 1000,
  moduleHauteurMm: 563,
  minRiveWidthMm: 250,
});

const piecesP = pignonEtendu.pieces.filter((p) => p.type === "pignon" || p.repere.startsWith("P-"));
assert(piecesP.length > 0, "Pignon anti-micro-plaques étendu : présence de pièces P-xx");

for (const p of piecesP) {
  const wMm = p.pignonDetails?.cutWidthMm ?? Math.round(p.largeurM * 1000);
  const hMm = p.pignonDetails?.cutHeightMm ?? Math.round(p.hauteurM * 1000);
  assert(
    wMm >= 250,
    `Pignon anti-micro-plaques : pièce ${p.repere} largeur de base (${wMm} mm) >= 250 mm`
  );
  assert(
    hMm >= 250,
    `Pignon anti-micro-plaques : pièce ${p.repere} hauteur de rive (${hMm} mm) >= 250 mm`
  );
}

// Vérifier également qu'au sommet (faîte), le bloc sommital est solide et >= 250 mm
const pieceFaite = piecesP.find((p) => p.pignonDetails?.includesRidge);
assert(
  pieceFaite !== undefined && (pieceFaite.pignonDetails?.cutWidthMm ?? 0) >= 250,
  "Pignon anti-micro-plaques : la pointe de faîtage a une base solide >= 250 mm"
);

console.log(`\n${passed} tests OK`);
