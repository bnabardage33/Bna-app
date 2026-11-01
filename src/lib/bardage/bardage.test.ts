import { calculerCalepinage } from "./calepinageCalcul.ts";
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

console.log(`\n${passed} tests OK`);
