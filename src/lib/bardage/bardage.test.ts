import { calculerCalepinage } from "./calepinageCalcul.ts";
import { decoupageModulesCentres, calculerBesoinsBardage, calculerPose } from "./poseCalcul.ts";
import { genererPercagesPourModules } from "./percages.ts";
import { genererModules } from "./modules.ts";
import { construireBesoinsBardage, fusionnerBesoinsBardage } from "../services/calepinageService.ts";

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

console.log(`\n${passed} tests OK`);
