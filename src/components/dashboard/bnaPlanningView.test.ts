import assert from "node:assert";

// Simulation des fonctions de date du BnaPlanningView
function parseYMD(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split("/").map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = (d.getDay() + 6) % 7; // 0 = Lundi, 6 = Dimanche
  d.setDate(d.getDate() - dayOfWeek);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(startOfWeek: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    days.push(d);
  }
  return days;
}

function getMonthDays(currentDate: Date): Date[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const days: Date[] = [];
  for (let i = 1; i <= totalDays; i++) {
    days.push(new Date(year, month, i));
  }
  return days;
}

console.log("=== TESTS BnaPlanningView (Timeline & Gantt Mobile) ===");

// Test 1: Date parsing
const d1 = parseYMD("2026-11-03");
assert.ok(d1 !== null);
assert.strictEqual(d1.getFullYear(), 2026);
assert.strictEqual(d1.getMonth(), 10); // 0-indexed: Nov = 10
assert.strictEqual(d1.getDate(), 3);
console.log("✓ PASS: parseYMD format ISO YYYY-MM-DD");

const d2 = parseYMD("03/11/2026");
assert.ok(d2 !== null);
assert.strictEqual(d2.getFullYear(), 2026);
assert.strictEqual(d2.getMonth(), 10);
assert.strictEqual(d2.getDate(), 3);
console.log("✓ PASS: parseYMD format FR DD/MM/YYYY");

// Test 2: Semaine commence un lundi
// 2026-11-04 est un mercredi
const testMercredi = new Date(2026, 10, 4);
const monday = getStartOfWeek(testMercredi);
assert.strictEqual(monday.getDay(), 1, "Le premier jour de la semaine doit être Lundi (1)");
assert.strictEqual(monday.getDate(), 2, "Le lundi correspondant doit être le 2 novembre 2026");
console.log("✓ PASS: getStartOfWeek calcule bien le Lundi");

const week = getWeekDays(monday);
assert.strictEqual(week.length, 7);
assert.strictEqual(week[0].getDate(), 2); // Lundi 2
assert.strictEqual(week[6].getDate(), 8); // Dimanche 8
console.log("✓ PASS: getWeekDays génère 7 jours du Lundi au Dimanche");

// Test 3: Mois complet
// Novembre 2026 a 30 jours
const monthDaysNov = getMonthDays(new Date(2026, 10, 15));
assert.strictEqual(monthDaysNov.length, 30);
assert.strictEqual(monthDaysNov[0].getDate(), 1);
assert.strictEqual(monthDaysNov[29].getDate(), 30);
console.log("✓ PASS: getMonthDays génère 30 jours pour Novembre");

// Février 2028 (bissextile)
const feb2028 = getMonthDays(new Date(2028, 1, 10));
assert.strictEqual(feb2028.length, 29);
console.log("✓ PASS: getMonthDays gère les années bissextiles (29 jours en fév 2028)");

// Test 4: Calcul des indices de chevauchement chantier
const rangeStart = new Date(2026, 10, 2, 0, 0, 0); // Lundi 2 nov
const rangeEnd = new Date(2026, 10, 8, 0, 0, 0); // Dimanche 8 nov
const msPerDay = 86400000;
const totalDays = 7;

// Chantier 1: du 3 nov au 6 nov (pleinement dans la semaine)
const ch1Start = new Date(2026, 10, 3).getTime();
const ch1End = new Date(2026, 10, 6).getTime();
const ch1StartIdx = Math.max(0, Math.min(totalDays - 1, Math.round((Math.max(rangeStart.getTime(), ch1Start) - rangeStart.getTime()) / msPerDay)));
const ch1EndIdx = Math.max(ch1StartIdx, Math.min(totalDays - 1, Math.round((Math.min(rangeEnd.getTime(), ch1End) - rangeStart.getTime()) / msPerDay)));
assert.strictEqual(ch1StartIdx, 1); // Mardi (index 1)
assert.strictEqual(ch1EndIdx, 4); // Vendredi (index 4)
console.log("✓ PASS: Chantier intérieur borné aux bons index (1 à 4)");

// Chantier 2: a commencé avant (28 oct) et se termine après (15 nov)
const ch2Start = new Date(2026, 9, 28).getTime();
const ch2End = new Date(2026, 10, 15).getTime();
const ch2StartIdx = Math.max(0, Math.min(totalDays - 1, Math.round((Math.max(rangeStart.getTime(), ch2Start) - rangeStart.getTime()) / msPerDay)));
const ch2EndIdx = Math.max(ch2StartIdx, Math.min(totalDays - 1, Math.round((Math.min(rangeEnd.getTime(), ch2End) - rangeStart.getTime()) / msPerDay)));
assert.strictEqual(ch2StartIdx, 0); // Clamped au début de semaine (Lundi)
assert.strictEqual(ch2EndIdx, 6); // Clamped à la fin de semaine (Dimanche)
const continuesBefore = ch2Start < rangeStart.getTime();
const continuesAfter = ch2End > rangeEnd.getTime();
assert.strictEqual(continuesBefore, true);
assert.strictEqual(continuesAfter, true);
console.log("✓ PASS: Chantier traversant clamped à [0, 6] avec flags continuesBefore/After");

// Test 5: Placement des RDVs
const rdvDay = new Date(2026, 10, 5).getTime(); // Jeudi 5 nov
const rdvIdx = Math.round((rdvDay - rangeStart.getTime()) / msPerDay);
assert.strictEqual(rdvIdx, 3); // Jeudi est à l'index 3 (0=Lun, 1=Mar, 2=Mer, 3=Jeu)
console.log("✓ PASS: RDV placé exactement sur la colonne du jour correspondant (Jeudi = index 3)");

console.log("\n🎉 TOUS LES TESTS BnaPlanningView SONT VALIDÉS AVEC SUCCÈS !");
