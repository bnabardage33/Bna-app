import { isValidDecimalInput, parseDecimal } from "./decimalInput.ts";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`✓ PASS: ${msg}`);
}

console.log("=== TESTS GESTION DES SAISIES DÉCIMALES BNA ===");

// 1. Caractère non numérique refusé
assert(!isValidDecimalInput("abc"), "refuser 'abc'");
assert(!isValidDecimalInput("2a"), "refuser '2a'");
assert(!isValidDecimalInput("2..1"), "refuser double point '2..1'");
assert(!isValidDecimalInput("2,,1"), "refuser double virgule '2,,1'");
assert(!isValidDecimalInput("2,1,0"), "refuser séparateurs multiples '2,1,0'");

// 2. Effacer entièrement la valeur (champ vide)
assert(isValidDecimalInput(""), "autoriser champ vide ''");
assert(parseDecimal("") === null, "champ vide parse en null (pas 0 ni NaN)");

// 3. Saisir 6
assert(isValidDecimalInput("6"), "autoriser '6'");
assert(parseDecimal("6") === 6, "parse '6' -> 6");

// 4. Saisir une virgule après un entier
assert(isValidDecimalInput("2,"), "autoriser '2,' en cours de frappe");
assert(parseDecimal("2,") === 2, "parse '2,' -> 2 (pas d'erreur)");

// 5. Saisir 2,10
assert(isValidDecimalInput("2,10"), "autoriser '2,10'");
assert(parseDecimal("2,10") === 2.1, "parse '2,10' -> 2.1");

// 6. Saisir 2.10
assert(isValidDecimalInput("2.10"), "autoriser '2.10'");
assert(parseDecimal("2.10") === 2.1, "parse '2.10' -> 2.1");

// 7. Saisir 0,5
assert(isValidDecimalInput("0,5"), "autoriser '0,5'");
assert(parseDecimal("0,5") === 0.5, "parse '0,5' -> 0.5");

// 8. Changer rapidement toute la valeur (ex: collage ou remplacement direct)
assert(isValidDecimalInput("14.75"), "autoriser remplacement rapide '14.75'");
assert(parseDecimal("14.75") === 14.75, "parse '14.75' -> 14.75");

// 9. Sécurité point seul ou virgule seule en cours de saisie
assert(isValidDecimalInput("."), "autoriser '.' initial");
assert(isValidDecimalInput(","), "autoriser ',' initial");
assert(parseDecimal(".") === null, "parse '.' -> null");
assert(parseDecimal(",") === null, "parse ',' -> null");

console.log("\nTous les tests de saisie décimale sont validés avec succès !");
