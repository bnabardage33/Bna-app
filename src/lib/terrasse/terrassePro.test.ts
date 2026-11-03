import assert from "node:assert";
import {
  calculateTerrasseProLayout,
  TERRASSE_MATERIAL_PRESETS,
  type TerrasseProConfig,
} from "./calepinageTerrassePro.ts";

console.log("=== TESTS MOTEUR TERRASSE PRO (DTU 51.4) ===");

// Test 1 : Terrasse Rectangulaire 6.00m x 4.00m, Pose à coupe perdue, Ipé 145mm x 2.45m
const baseConfig: TerrasseProConfig = {
  forme: "RECTANGLE",
  longueurM: 6.0,
  largeurM: 4.0,
  longueurRetourM: 3.0,
  largeurRetourM: 2.5,
  tremie: {
    active: false,
    nom: "Spa",
    longueurM: 2.0,
    largeurM: 2.0,
    offsetXM: 1.0,
    offsetYM: 1.0,
  },
  materiau: "BOIS_EXOTIQUE",
  sensPose: "longueur",
  modePose: "COUPE_PERDUE",
  largeurLameMm: TERRASSE_MATERIAL_PRESETS.BOIS_EXOTIQUE.defaultBladeWidthMm, // 145
  longueurLameM: TERRASSE_MATERIAL_PRESETS.BOIS_EXOTIQUE.defaultBladeLengthM, // 2.45
  jeuInterLamesMm: 5,
  minChuteReemployableM: 0.4,
  typeStructure: "SIMPLE_PLOTS",
  entraxeLambourdesCm: 40,
  longueurLambourdeM: 3.0,
  entraxePlotsCm: 70,
  entraxeSolivesCm: 140,
  longueurSoliveM: 4.0,
  typeFixation: "vis",
  tailleBoiteFixations: 200,
  nbCotesBandeauRive: 3,
  inclureBandeBitumineuse: true,
  inclureGeotextile: true,
};

const resCoupePerdue = calculateTerrasseProLayout(baseConfig);
assert.strictEqual(resCoupePerdue.surfaceNetteM2, 24.0, "6 x 4 = 24 m²");
assert.ok(resCoupePerdue.nbRangeesZoneA >= 26, "4.0m / 0.15m = ~27 rangées");
assert.ok(resCoupePerdue.nbChutesReemployees > 0, "En coupe perdue, les chutes >= 40cm sont réemployées");
// Aucun segment de lame ne doit être < 40cm
for (const row of resCoupePerdue.rowsPlan) {
  for (const seg of row.segments) {
    assert.ok(
      seg.lengthM >= 0.4 - 1e-3,
      `Segment R${row.rowIndex + 1}-S${seg.segmentIndex + 1} (${seg.lengthM}m) >= 0.40m (DTU 51.4)`
    );
  }
}
assert.ok(resCoupePerdue.nbLamesBandeauRive > 0, "Bandeaux de rive comptés sur 3 côtés");
assert.ok(resCoupePerdue.nbRouleauxBandeBitumineuse20m > 0, "Rouleaux bande bitumineuse calculés");
assert.ok(resCoupePerdue.surfaceGeotextileM2 > 24, "Géotextile avec recouvrement +15%");
console.log("✓ PASS: 1. Terrasse Rectangulaire + Coupe perdue (réemploi chutes >= 40cm validé)");

// Test 2 : Comparaison Coupe perdue vs Joints alignés (Coupe perdue consomme moins ou autant de lames brutes)
const resAlignes = calculateTerrasseProLayout({
  ...baseConfig,
  modePose: "ALIGNES",
});
assert.ok(
  resCoupePerdue.nbLamesBrutesNecessaires <= resAlignes.nbLamesBrutesNecessaires,
  `Coupe perdue (${resCoupePerdue.nbLamesBrutesNecessaires} lames) <= Joints alignés (${resAlignes.nbLamesBrutesNecessaires} lames)`
);
console.log("✓ PASS: 2. Optimisation Coupe perdue vs Joints alignés vérifiée");

// Test 3 : Pose en Quinconce 1/2 lame
const resQuinconce = calculateTerrasseProLayout({
  ...baseConfig,
  modePose: "QUINCONCE_DEMI",
});
assert.ok(resQuinconce.rowsPlan.length === resCoupePerdue.rowsPlan.length);
assert.notStrictEqual(
  resQuinconce.rowsPlan[0].segments[0].lengthM,
  resQuinconce.rowsPlan[1].segments[0].lengthM,
  "Quinconce 1/2 : décalage effectif entre rangée paire et impaire"
);
console.log("✓ PASS: 3. Pose en Quinconce 1/2 lame fonctionnelle");

// Test 4 : Forme EN_L + Trémie active + Double structure (Solives + Lambourdes)
const resEnL = calculateTerrasseProLayout({
  ...baseConfig,
  forme: "EN_L",
  longueurRetourM: 3.0,
  largeurRetourM: 2.0,
  tremie: {
    active: true,
    nom: "Spa encastré",
    longueurM: 2.0,
    largeurM: 1.5,
    offsetXM: 1.0,
    offsetYM: 1.0,
  },
  typeStructure: "DOUBLE_STRUCTURE_SOLIVES",
  typeFixation: "clips",
});
// Surface : (6*4) + (3*2) - (2*1.5) = 24 + 6 - 3 = 27 m²
assert.strictEqual(resEnL.surfaceNetteM2, 27.0, "Surface En L (24 + 6) - Trémie (3) = 27 m²");
assert.ok(resEnL.nbBarresSolives > 0, "Double structure : barres de solives calculées");
assert.ok(resEnL.nbClipsDepartFin > 0, "Fixation clips : clips départ/fin calculés");
console.log("✓ PASS: 4. Forme EN_L + Trémie déduite + Double structure solives");

// Test 5 : Pose sur dalle béton avec cales EPDM
const resDalle = calculateTerrasseProLayout({
  ...baseConfig,
  typeStructure: "SUR_DALLE_CALES",
});
assert.strictEqual(resDalle.nbPlotsReglables, 0, "Sur dalle : 0 plot réglable");
assert.ok(resDalle.nbCalesEpdmDalle > 0, "Sur dalle : cales EPDM calculées");
assert.ok(resDalle.nbGoujonsAncrageDalle > 0, "Sur dalle : goujons d'ancrage calculés");
console.log("✓ PASS: 5. Pose sur dalle béton (cales EPDM + goujons)");

console.log("\n🎉 TOUS LES TESTS DU MOTEUR TERRASSE PRO SONT VALIDÉS AVEC SUCCÈS !");
