import {
  buildUnifiedPlanning,
  generateMermaidGantt,
} from "./planningService.ts";
import {
  creerRendezVous,
  getRendezVous,
  supprimerRendezVous,
  updateRendezVous,
} from "./rendezVousService.ts";

let passed = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log(`✓ PASS: ${msg}`);
}

console.log("=== TESTS PLANNING GÉNÉRAL & JALONS MERMAID V1 ===");

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
    nature: "Contrôle planéité et humidité du bois",
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

// 2. Test génération Mermaid Gantt
const gantt = generateMermaidGantt(unified);
assert(gantt.includes("gantt"), "2.A: En-tête gantt Mermaid présent");
assert(gantt.includes("dateFormat YYYY-MM-DD"), "2.B: Format de date YYYY-MM-DD");
assert(gantt.includes("axisFormat %d/%m"), "2.C: Format d'axe jour/mois");
assert(gantt.includes("section Chantiers"), "2.D: Section Chantiers présente");
assert(gantt.includes("section RDV & Visites"), "2.E: Section RDV présente");
assert(gantt.includes("section Commandes & Livraisons"), "2.F: Section Commandes & Livraisons présente");
assert(gantt.includes("ch_0, 2026-10-25, 2026-11-06"), "2.G: Dates de début/fin du chantier injectées sans syntaxe parasite");
assert(gantt.includes(":crit, rdv_"), "2.H: RDV confirmé marqué avec jalon critique");
assert(gantt.includes(":milestone, cmd_"), "2.I: Livraisons marquées comme jalons milestone");

// 3. Test gestion des Rendez-vous (CRUD)
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

  assert(newRdv.id.startsWith("rdv-"), "3.A: Nouveau RDV généré avec identifiant");
  assert(newRdv.nature.includes("Signature PV"), "3.B: Encadré nature du RDV conservé fidèlement");

  const list = await getRendezVous(null);
  assert(list.some((r) => r.id === newRdv.id), "3.C: Le RDV apparaît dans la liste des RDVs");

  const updated = await updateRendezVous(null, newRdv.id, { statut: "effectue" });
  assert(updated?.statut === "effectue", "3.D: Statut du RDV mis à jour (effectue)");

  await supprimerRendezVous(null, newRdv.id);
  const listAfterDelete = await getRendezVous(null);
  assert(!listAfterDelete.some((r) => r.id === newRdv.id), "3.E: RDV supprimé avec succès");
}

await testRdvCrud();

console.log(`\n${passed} tests OK`);
