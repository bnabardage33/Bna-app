import {
  buildSystemPromptContext,
  parseNaturalDate,
  parseNaturalTime,
  detectAssistantActions,
  generateLocalAssistantResponse,
  type AssistantContext,
} from "./bnaAssistantService.ts";

let passed = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log(`✓ PASS: ${msg}`);
}

console.log("=== TESTS ASSISTANT IA CENTRAL BNA (COPILOTE GAËL) ===");

const mockContext: AssistantContext = {
  userName: "Gaël",
  userRole: "Gérant",
  currentDateIso: "2026-11-03",
  activeChantierId: "martin",
  chantiers: [
    {
      id: "martin",
      nom: "Terrasse Martin",
      ville: "Mérignac",
      metier: "terrasse",
      intervention: "Pose des lames Cumaru",
      avancementGlobal: 65,
      avancementDetails: [],
      prochaineEtape: {
        titre: "Bandeaux de finition",
        detail: "Demain 08h30",
      },
      meteoImpact: {
        alerte: "Conditions optimales DTU 51.4",
        consignes: ["Vérifier bande EPDM"],
      },
      materiaux: [{ nom: "Lames Cumaru", statut: "ok", detail: "Sur site" }],
      photosRecentesCount: 2,
    },
    {
      id: "dupont",
      nom: "Bardage Dupont",
      ville: "Pessac",
      metier: "facade",
      intervention: "Pose pare-pluie & chevrons",
      avancementGlobal: 40,
      avancementDetails: [],
      prochaineEtape: {
        titre: "Pose clins",
        detail: "Jeudi",
      },
      meteoImpact: {
        alerte: "Vent fort : interruption pose extérieure",
        consignes: ["Reporter la pose des clins"],
      },
      materiaux: [{ nom: "Pare-pluie HPV", statut: "vigilance", detail: "Point P" }],
      photosRecentesCount: 1,
    },
  ],
  rdvs: [
    {
      id: "rdv-1",
      chantier_id: "martin",
      chantier_nom: "Terrasse Martin",
      titre: "Contrôle plots",
      nature: "Réglage planéité",
      date: "2026-11-04",
      heure_debut: "09:30",
      statut: "confirme",
      created_at: "2026-11-01T10:00:00Z",
    },
  ],
  commandes: [
    {
      id: "cmd-1",
      entreprise_id: "ent-1",
      chantier_id: "martin",
      fournisseur_id: "four-1",
      version_source_id: null,
      version_source_numero: 1,
      numero_commande: "CMD-2026-0001",
      statut: "commandee",
      date_commande: "2026-10-30T08:00:00Z",
      date_livraison_souhaitee: "2026-11-05",
      commentaire: "Plots et vis inox A4",
      reference_fournisseur: "BC-01",
      piece_jointe_url: null,
      created_at: "2026-10-30T08:00:00Z",
      updated_at: "2026-10-30T08:00:00Z",
      fournisseur: {
        id: "four-1",
        entreprise_id: "ent-1",
        nom: "Point P Mérignac",
        telephone: null,
        email: null,
        notes: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    },
  ],
};

// 1. Test System Prompt Builder
const sysPrompt = buildSystemPromptContext(mockContext);
assert(sysPrompt.includes("Gaël (Gérant de BNA)"), "1.A: Identité Gaël Gérant injectée dans le System Prompt");
assert(sysPrompt.includes("Terrasse Martin"), "1.B: Chantier Martin injecté dans le contexte");
assert(sysPrompt.includes("CMD-2026-0001"), "1.C: Commande fournisseur injectée dans le contexte");

// 2. Test extraction dates et heures naturelles
assert(parseNaturalDate("Planifie un RDV demain", "2026-11-03") === "2026-11-04", "2.A: Calcul exact de 'demain'");
assert(parseNaturalDate("RDV le 15/11/2026", "2026-11-03") === "2026-11-15", "2.B: Extraction date format FR DD/MM/YYYY");
assert(parseNaturalTime("RDV demain à 14h30") === "14:30", "2.C: Extraction heure 14h30 -> 14:30");
assert(parseNaturalTime("RDV à 9h") === "09:00", "2.D: Extraction heure 9h -> 09:00");

// 3. Test détection d'actions (Tool Calling)
const rdvActions = detectAssistantActions(
  "Planifie un RDV demain à 10h30 sur Bardage Dupont pour pare-pluie",
  mockContext
);
assert(rdvActions.length === 1 && rdvActions[0].type === "create_rdv", "3.A: Action create_rdv détectée");
assert(rdvActions[0].payload.chantierId === "dupont", "3.B: Chantier Dupont ciblé automatiquement");
assert(rdvActions[0].payload.rdvDate === "2026-11-04", "3.C: Date demain 2026-11-04 extraite");
assert(rdvActions[0].payload.rdvHeureDebut === "10:30", "3.D: Heure 10:30 extraite");

const avActions = detectAssistantActions(
  "Passe l'avancement de Terrasse Martin à 85%",
  mockContext
);
assert(avActions.length === 1 && avActions[0].type === "update_avancement", "3.E: Action update_avancement détectée");
assert(avActions[0].payload.nouvelAvancement === 85, "3.F: Pourcentage 85% extrait");

// 4. Test Réponses Expertes BNA (Briefing, DTU, Météo, Chiffrage)
const resBriefing = generateLocalAssistantResponse("Fais-moi la synthèse du jour", mockContext);
assert(resBriefing.content.includes("Bonjour Gaël"), "4.A: Briefing salue Gaël");
assert(resBriefing.content.includes("Terrasse Martin"), "4.B: Briefing inclut les chantiers");

const resDtu = generateLocalAssistantResponse("Quelles sont les règles DTU 51.4 sur l'entraxe ?", mockContext);
assert(resDtu.content.includes("NF DTU 51.4"), "4.C: Réponse DTU cite NF DTU 51.4");
assert(resDtu.content.includes("40 cm"), "4.D: Réponse DTU précise l'entraxe lambourdes");

const resMeteo = generateLocalAssistantResponse("Vérifie la météo sur mes chantiers", mockContext);
assert(resMeteo.content.includes("POSE FAVORABLE") && resMeteo.content.includes("POSE DÉCONSEILLÉE"), "4.E: Analyse météo distingue les statuts de pose DTU");

const resChiffrage = generateLocalAssistantResponse("Donne un chiffrage pour une terrasse de 50 m²", mockContext);
assert(resChiffrage.content.includes("50 m²") && resChiffrage.content.includes("Cumaru"), "4.F: Chiffrage calcule les tarifs pour 50 m²");

console.log(`\n🎉 TOUS LES TESTS DE L'ASSISTANT IA BNA SONT VALIDÉS (${passed} assertions) !`);
