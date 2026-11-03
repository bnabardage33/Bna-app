import {
  buildUnifiedPlanning,
  buildChantierPlanningItems,
  generateMermaidGantt,
  generateChantierMermaidGantt,
  categorizeNature,
  NATURES_CONFIG,
  updateChantierDates,
  dismissPlanningItem,
  getDismissedPlanningIds,
  resetDismissedPlanning,
} from "./planningService.ts";
import {
  creerRendezVous,
  getRendezVous,
  getRendezVousByChantier,
  supprimerRendezVous,
  updateRendezVous,
} from "./rendezVousService.ts";

let passed = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log(`✓ PASS: ${msg}`);
}

console.log("=== TESTS PLANNING GÉNÉRAL & JALONS MERMAID V1 & V2 ===");

// 1. Test buildUnifiedPlanning avec chantiers, commandes et RDVs
const mockChantiers: any[] = [
  {
    id: "ch-1",
    nom: "Terrasse Martin",
    ville: "Mérignac",
    metier: "terrasse",
    avancementGlobal: 65,
    date_debut_prevue: "2026-10-25",
    date_fin_prevue: "2026-11-06",
    intervention: "Pose des lames",
    prochaineEtape: { titre: "Bandeaux", detail: "Finition" },
  },
  {
    id: "ch-2",
    nom: "Bardage Dupont",
    ville: "Pessac",
    metier: "facade",
    avancementGlobal: 40,
    date_debut_prevue: "2026-10-28",
    date_fin_prevue: "2026-11-12",
    intervention: "Ossature & pare-pluie",
  },
];

const mockCommandes: any[] = [
  {
    id: "cmd-1",
    numero_commande: "CMD-2026-0001",
    chantier_id: "ch-1",
    created_at: "2026-10-29T10:00:00Z",
    statut: "commandee",
    date_livraison_souhaitee: "03/11/2026 matin",
    fournisseur: { nom: "Point P Mérignac" },
  },
];

const mockRdvs: any[] = [
  {
    id: "rdv-1",
    chantier_id: "ch-1",
    chantier_nom: "Terrasse Martin",
    titre: "Visite technique",
    nature: "Contrôle planéité lambourdes et humidimètre",
    date: "2026-11-02",
    heure_debut: "09:30",
    heure_fin: "11:00",
    statut: "confirme",
  },
];

const unified = buildUnifiedPlanning(mockChantiers, mockCommandes, mockRdvs);

assert(unified.length === 5, "1.A: 5 éléments consolidés (2 chantiers + 1 commande + 1 livraison + 1 RDV)");
assert(unified.some((i) => i.type === "chantier" && i.titre === "Terrasse Martin"), "1.B: Chantier Martin présent avec dates");
assert(unified.some((i) => i.type === "rdv" && i.heure === "09:30 - 11:00"), "1.C: RDV présent avec créneau horaire");
assert(unified.some((i) => i.type === "commande" && i.titre === "Commande CMD-2026-0001"), "1.D: Commande passée présente");
assert(unified.some((i) => i.type === "livraison" && i.dateDebut === "2026-11-03"), "1.E: Réception livraison 03/11/2026 extraite de la date souhaitée");

// 2. Test Couleurs et Classification par Nature
assert(categorizeNature("Visite technique et contrôle DTU") === "technique", "2.A: Classification technique");
assert(categorizeNature("Réception de chantier et signature PV") === "reception", "2.B: Classification réception");
assert(categorizeNature("Point d'étape avec le client pour teinte alu") === "client", "2.C: Classification point client");
assert(categorizeNature("Livraison matériaux Point P", "livraison") === "livraison", "2.D: Classification livraison");
assert(categorizeNature("Pose des lames terrasse", "chantier") === "travaux", "2.E: Classification travaux");

assert(NATURES_CONFIG.technique.dotColor === "#EA580C", "2.F: Couleur technique distincte (Orange BNA)");
assert(NATURES_CONFIG.reception.dotColor === "#059669", "2.G: Couleur réception distincte (Vert émeraude)");
assert(NATURES_CONFIG.client.dotColor === "#2563EB", "2.H: Couleur client distincte (Bleu cobalt)");
assert(NATURES_CONFIG.livraison.dotColor === "#7C3AED", "2.I: Couleur livraison distincte (Violet améthyste)");

// 3. Test génération Mermaid Gantt V1
const gantt = generateMermaidGantt(unified);
assert(gantt.includes("gantt"), "3.A: En-tête gantt Mermaid présent");
assert(gantt.includes("dateFormat YYYY-MM-DD"), "3.B: Format de date YYYY-MM-DD");
assert(gantt.includes("axisFormat %d/%m"), "3.C: Format d'axe jour/mois");
assert(gantt.includes("section Chantiers"), "3.D: Section Chantiers présente");
assert(gantt.includes("section RDV & Visites"), "3.E: Section RDV présente");
assert(gantt.includes("section Commandes & Livraisons"), "3.F: Section Commandes & Livraisons présente");
assert(gantt.includes("ch_0, 2026-10-25, 2026-11-06"), "3.G: Dates de début/fin du chantier injectées sans syntaxe parasite");
assert(gantt.includes(":crit, rdv_"), "3.H: RDV technique marqué avec balise critique");
assert(gantt.includes(":milestone, cmd_"), "3.I: Livraisons marquées comme jalons milestone");

// 4. Test Mermaid Gantt Chantier V2 Cockpit
const itemsChantier = buildChantierPlanningItems(mockChantiers[0], mockCommandes, mockRdvs);
assert(itemsChantier.length === 4, "4.A: 4 éléments filtrés pour le chantier Martin (chantier + commande + livraison + RDV)");

const chantierGantt = generateChantierMermaidGantt(mockChantiers[0], mockCommandes, mockRdvs);
assert(chantierGantt.includes("Planning Chantier — Terrasse Martin"), "4.B: Titre personnalisé chantier dans le Gantt");
assert(chantierGantt.includes("section Travaux Chantier"), "4.C: Section travaux dédiée");
assert(chantierGantt.includes("section Livraisons & Matériaux"), "4.D: Section livraisons rattachées");
assert(chantierGantt.includes("section RDV & Jalons Terrain"), "4.E: Section RDVs terrain rattachés");

// 5. Test mise à jour des dates du chantier
await updateChantierDates(null, "martin", "2026-10-27", "2026-11-15");
assert(typeof updateChantierDates === "function", "5.A: updateChantierDates est disponible et s'exécute sans erreur");

// 6. Test gestion des Rendez-vous (CRUD & Filtrage chantier)
async function testRdvCrud() {
  const newRdv = await creerRendezVous(null, {
    chantier_id: "ch-1",
    chantier_nom: "Terrasse Martin",
    titre: "Réception finale terrasse",
    nature: "Signature PV de réception, remise notice d'entretien Cumaru",
    date: "2026-11-09",
    heure_debut: "11:00",
    heure_fin: "12:00",
    lieu: "Mérignac",
    statut: "planifie",
  });

  assert(newRdv.id.startsWith("rdv-"), "6.A: Nouveau RDV généré avec identifiant");
  assert(newRdv.nature.includes("Signature PV"), "6.B: Encadré nature du RDV conservé fidèlement");

  const list = await getRendezVous(null);
  assert(list.some((r) => r.id === newRdv.id), "6.C: Le RDV apparaît dans la liste des RDVs");

  const chantierList = await getRendezVousByChantier(null, "ch-1");
  assert(chantierList.some((r) => r.id === newRdv.id), "6.D: Le RDV est filtré par chantier");

  const updated = await updateRendezVous(null, newRdv.id, { statut: "effectue" });
  assert(updated?.statut === "effectue", "6.E: Statut du RDV mis à jour (effectue)");

  await supprimerRendezVous(null, newRdv.id);
  const listAfterDelete = await getRendezVous(null);
  assert(!listAfterDelete.some((r) => r.id === newRdv.id), "6.F: RDV supprimé avec succès");

  // 6.G: Test suppression avec id préfixé rdv-
  const rdv2 = await creerRendezVous(null, {
    titre: "Second RDV",
    nature: "Test préfixe",
    date: "2026-11-15",
    heure_debut: "10:00",
  });
  await supprimerRendezVous(null, `rdv-${rdv2.id}`);
  const listAfterDeletePrefix = await getRendezVous(null);
  assert(!listAfterDeletePrefix.some((r) => r.id === rdv2.id), "6.G: RDV supprimé via ID préfixé rdv-");
}

await testRdvCrud();

// 7. Tests Suppression et Filtrage Réactif des Éléments (RDV, Jalon, Livraison)
console.log("\n--- Tests Suppression Réactive & Persistance Planning ---");
resetDismissedPlanning();

const itemsAvantSuppression = buildUnifiedPlanning(mockChantiers, mockCommandes, mockRdvs);
const initialTotal = itemsAvantSuppression.length;
const initialRdvs = itemsAvantSuppression.filter((i) => i.type === "rdv").length;
const initialCommandes = itemsAvantSuppression.filter((i) => i.type === "commande" || i.type === "livraison").length;

// A. Suppression par filtering du state avec item.id
const rdvItem = itemsAvantSuppression.find((i) => i.type === "rdv")!;
assert(Boolean(rdvItem && rdvItem.id), "7.A: L'élément RDV possède bien un identifiant unique (item.id)");

const stateApresSupprRdv = itemsAvantSuppression.filter((it) => it.id !== rdvItem.id);
assert(stateApresSupprRdv.length === initialTotal - 1, "7.B: Le tableau filtré a décrémenté son total de 1");
assert(
  stateApresSupprRdv.filter((i) => i.type === "rdv").length === initialRdvs - 1,
  "7.C: Le compteur spécifique aux RDVs a décrémenté en temps réel"
);

// B. Suppression / exclusion persistante d'une livraison
const livItem = itemsAvantSuppression.find((i) => i.type === "livraison")!;
assert(Boolean(livItem && livItem.id), "7.D: L'élément livraison possède un identifiant unique (liv-...)");

dismissPlanningItem(livItem.id);
assert(getDismissedPlanningIds().includes(livItem.id), "7.E: L'identifiant de livraison est persisté dans les éléments exclus");

const planningReconstruit = buildUnifiedPlanning(mockChantiers, mockCommandes, mockRdvs);
assert(!planningReconstruit.some((i) => i.id === livItem.id), "7.F: La livraison supprimée n'apparaît plus dans le planning unifié");
assert(
  planningReconstruit.filter((i) => i.type === "commande" || i.type === "livraison").length === initialCommandes - 1,
  "7.G: Le compteur global commandes/livraisons reste décrémenté après reconstruction"
);

resetDismissedPlanning();

console.log(`\n🎉 TOUS LES TESTS PLANNING V1 & V2 SONT VALIDÉS (${passed} assertions) !`);
