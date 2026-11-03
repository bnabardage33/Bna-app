import assert from "node:assert";
import {
  calculateFenceLayout,
  FENCE_MATERIAL_PRESETS,
  type FenceConfig,
} from "./calepinageCloture.ts";

console.log("=== TESTS CALEPINAGE CLÔTURE (FENCING CALCULATOR 1 À 4 CÔTÉS) ===");

// Test 1 : Clôture DROITE, Bois (2.00m), 12.50m, hauteur 1.80m, LIBRE, DIRECT_SOL
const configDroite: FenceConfig = {
  forme: "DROITE",
  segments: { A: 12.5, B: 4.2, C: 6.0, D: 4.2 },
  hauteurUtile: 1.8,
  materiau: "BOIS",
  longueurLameBrute: FENCE_MATERIAL_PRESETS.BOIS.defaultBladeLengthM, // 2.00m
  hauteurLame: FENCE_MATERIAL_PRESETS.BOIS.defaultBladeHeightM, // 0.145m
  extremites: "LIBRE",
  typePoseSol: "DIRECT_SOL",
};

const resDroite = calculateFenceLayout(configDroite);

assert.strictEqual(resDroite.segmentsActifs.length, 1, "DROITE = 1 segment actif");
assert.strictEqual(resDroite.nbPoteauxAngle, 0, "DROITE = 0 poteau d'angle");
assert.strictEqual(resDroite.segmentsActifs[0].nbTraveesSegment, 7, "12.50m / 2.00m -> 7 travées");
const expectedAxeA = 12.5 / 7;
assert.ok(Math.abs(resDroite.segmentsActifs[0].largeurTraveeAxe - expectedAxeA) < 1e-6);
assert.ok(
  Math.abs(resDroite.segmentsActifs[0].longueurCoupeLame - (expectedAxeA - 0.07 + 0.03 - 0.01)) < 1e-6,
  "Cote de coupe exacte avec feuillures (2x1.5cm) et dilatation (-1cm)"
);
assert.strictEqual(resDroite.nbPoteauxIntermediaires, 6);
assert.strictEqual(resDroite.nbPoteauxBoutStandards, 2);
assert.strictEqual(resDroite.nbDemiPoteauxMuraux, 0);
assert.strictEqual(resDroite.totalPoteauxComplets, 8);
assert.strictEqual(resDroite.longueurCommandePoteauM, 2.3, "1.80m + 0.50m scellement = 2.30m");
assert.strictEqual(resDroite.nbSacsBeton35kg, 16, "8 poteaux x 2 sacs = 16 sacs de 35kg");
console.log("✓ PASS: 1. Clôture DROITE + DIRECT_SOL + LIBRE");

// Test 2 : Clôture EN_L, Composite (1.80m), Seg A = 12.50m, Seg B = 4.20m, DEPART_MUR, SUR_MURET
const configEnL: FenceConfig = {
  forme: "EN_L",
  segments: { A: 12.5, B: 4.2, C: 5.0, D: 4.2 },
  hauteurUtile: 1.5,
  materiau: "COMPOSITE",
  longueurLameBrute: FENCE_MATERIAL_PRESETS.COMPOSITE.defaultBladeLengthM, // 1.80m
  hauteurLame: FENCE_MATERIAL_PRESETS.COMPOSITE.defaultBladeHeightM, // 0.15m
  extremites: "DEPART_MUR",
  typePoseSol: "SUR_MURET",
};

const resEnL = calculateFenceLayout(configEnL);
assert.strictEqual(resEnL.segmentsActifs.length, 2, "EN_L = 2 segments actifs (A, B)");
assert.strictEqual(resEnL.nbPoteauxAngle, 1, "EN_L = 1 poteau d'angle");
assert.strictEqual(resEnL.segmentsActifs[0].nbTraveesSegment, 7);
assert.strictEqual(resEnL.segmentsActifs[1].nbTraveesSegment, 3);
assert.strictEqual(resEnL.nbPoteauxIntermediaires, 8, "6 + 2 = 8 poteaux intermédiaires");
assert.strictEqual(resEnL.nbPoteauxBoutStandards, 1, "DEPART_MUR = 1 poteau de terminaison");
assert.strictEqual(resEnL.nbDemiPoteauxMuraux, 1, "DEPART_MUR = 1 demi-poteau mural");
assert.strictEqual(resEnL.totalPoteauxComplets, 10, "Sans doublon à l'angle : 8 + 1 + 1 = 10");
assert.strictEqual(resEnL.nbPlatines, 10, "SUR_MURET = 10 platines");
assert.ok(Math.abs(resEnL.longueurCommandePoteauM - 1.52) < 1e-6, "1.50m + 0.02m = 1.52m");
assert.strictEqual(resEnL.nbLamesParTravee, 10, "1.50m / 0.15m = 10 lames par travée");
assert.strictEqual(resEnL.nbTotalLames, 100, "(7 + 3) travées x 10 lames = 100 lames");
console.log("✓ PASS: 2. Clôture EN_L + SUR_MURET + DEPART_MUR");

// Test 3 : Clôture EN_U, ALU (1.80m), ENTRE_MURS
const configEnU: FenceConfig = {
  forme: "EN_U",
  segments: { A: 6.0, B: 10.0, C: 6.0, D: 10.0 },
  hauteurUtile: 1.8,
  materiau: "ALU",
  longueurLameBrute: 1.8,
  hauteurLame: 0.15,
  extremites: "ENTRE_MURS",
  typePoseSol: "DIRECT_SOL",
};

const resEnU = calculateFenceLayout(configEnU);
assert.strictEqual(resEnU.segmentsActifs.length, 3, "EN_U = 3 segments actifs (A, B, C)");
assert.strictEqual(resEnU.nbPoteauxAngle, 2, "EN_U = 2 poteaux d'angle");
assert.strictEqual(resEnU.nbPoteauxBoutStandards, 0, "ENTRE_MURS = 0 poteau de bout standard");
assert.strictEqual(resEnU.nbDemiPoteauxMuraux, 2, "ENTRE_MURS = 2 demi-poteaux muraux");
assert.strictEqual(resEnU.nbPoteauxIntermediaires, 11);
assert.strictEqual(resEnU.totalPoteauxComplets, 13);
assert.strictEqual(resEnU.alerteChuteElevee, true, "Chute > 15% détectée et signalée");
console.log("✓ PASS: 3. Clôture EN_U + ENTRE_MURS + Alerte chute > 15%");

// Test 4 : Clôture 4_COTES (Périmètre complet), LIBRE (boucle fermée)
const config4CotesLibre: FenceConfig = {
  forme: "4_COTES",
  segments: { A: 12.0, B: 8.0, C: 12.0, D: 8.0 },
  hauteurUtile: 1.8,
  materiau: "BOIS",
  longueurLameBrute: 2.0,
  hauteurLame: 0.15,
  extremites: "LIBRE",
  typePoseSol: "DIRECT_SOL",
};

const res4Libre = calculateFenceLayout(config4CotesLibre);
assert.strictEqual(res4Libre.segmentsActifs.length, 4, "4_COTES = 4 segments actifs (A, B, C, D)");
assert.strictEqual(res4Libre.isClosedLoop, true, "4_COTES + LIBRE = boucle fermée");
assert.strictEqual(res4Libre.lineaireTotalM, 40.0, "Périmètre = 12 + 8 + 12 + 8 = 40.00m");
assert.strictEqual(res4Libre.nbPoteauxAngle, 4, "4_COTES + LIBRE = 4 poteaux d'angle 90°");
assert.strictEqual(res4Libre.nbPoteauxBoutStandards, 0, "Boucle fermée = 0 poteau de terminaison");
assert.strictEqual(res4Libre.nbDemiPoteauxMuraux, 0, "Boucle fermée = 0 demi-poteau mural");
// Seg A: 12/2 = 6 travées (5 inter), Seg B: 8/2 = 4 travées (3 inter), Seg C: 6 (5 inter), Seg D: 4 (3 inter)
// Total inter = 5 + 3 + 5 + 3 = 16 ; Total poteaux complets = 16 + 4 angles = 20 poteaux
assert.strictEqual(res4Libre.nbTraveesTotal, 20);
assert.strictEqual(res4Libre.nbPoteauxIntermediaires, 16);
assert.strictEqual(res4Libre.totalPoteauxComplets, 20, "16 intermédiaires + 4 angles = 20 poteaux sans doublon");
assert.strictEqual(res4Libre.segmentsActifs[0].departType, "ANGLE");
assert.strictEqual(res4Libre.segmentsActifs[3].arriveeType, "ANGLE");
console.log("✓ PASS: 4. Clôture 4_COTES (Périmètre complet boucle fermée) : 4 angles, 0 doublon");

// Test 5 : Clôture 4_COTES avec ENTRE_MURS (3 angles + 2 demi-poteaux muraux)
const res4EntreMurs = calculateFenceLayout({
  ...config4CotesLibre,
  extremites: "ENTRE_MURS",
});
assert.strictEqual(res4EntreMurs.isClosedLoop, false);
assert.strictEqual(res4EntreMurs.nbPoteauxAngle, 3, "4_COTES + ENTRE_MURS = 3 poteaux d'angle");
assert.strictEqual(res4EntreMurs.nbDemiPoteauxMuraux, 2, "2 demi-poteaux muraux");
assert.strictEqual(res4EntreMurs.nbPoteauxBoutStandards, 0);
assert.strictEqual(res4EntreMurs.totalPoteauxComplets, 19, "16 inter + 3 angles = 19 poteaux complets");
console.log("✓ PASS: 5. Clôture 4_COTES + ENTRE_MURS : 3 angles + 2 demi-poteaux muraux");

console.log("\n🎉 TOUS LES TESTS DU MOTEUR CLÔTURE (1 À 4 CÔTÉS) SONT VALIDÉS AVEC SUCCÈS !");
