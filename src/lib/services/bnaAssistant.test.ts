import {
  buildSystemPromptContext,
  parseNaturalDate,
  parseNaturalTime,
  detectAssistantActions,
  generateLocalAssistantResponse,
  type AssistantContext,
} from "./bnaAssistantService.ts";
import {
  calculerDevis,
  calculerMontantsFacture,
  calculerBilanFinancierGlobal,
  getDevisList,
  getFacturesList,
} from "./devisFinanceService.ts";
import {
  getPvReceptions,
  getTicketsSav,
  calculerSynthesePvSav,
} from "./pvSavService.ts";

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

// 5. Test Moteur Financier (Devis, Marges, Retenue de Garantie Loi 71-584 & Factures)
const calcDev = calculerDevis(
  [
    {
      id: "l1",
      designation: "Fourniture Lames",
      qte: 40,
      unite: "m²",
      pu_ht: 100,
      pu_revient: 60,
      type_cout: "matiere",
    },
    {
      id: "l2",
      designation: "Pose",
      qte: 40,
      unite: "m²",
      pu_ht: 75,
      pu_revient: 40,
      type_cout: "main_oeuvre",
    },
  ],
  10,
  30
);
assert(calcDev.total_ht === 7000, "5.A: Total HT devis = 7000 €");
assert(calcDev.total_ttc === 7700, "5.B: Total TTC devis (TVA 10%) = 7700 €");
assert(calcDev.marge_ht === 3000, "5.C: Marge brute HT = 3000 €");
assert(calcDev.acompte_ttc === 2310, "5.D: Acompte 30% TTC = 2310 €");

const calcFac = calculerMontantsFacture(5000, 10, 5);
assert(calcFac.montant_ttc === 5500, "5.E: Facture TTC = 5500 €");
assert(calcFac.montant_retenue_ttc === 275, "5.F: Retenue de garantie 5% (Loi 71-584) = 275 € TTC");
assert(calcFac.net_a_payer_ttc === 5225, "5.G: Net à payer TTC après retenue 5% = 5225 €");

// 6. Test Intégration Finances <-> Assistant IA Central
mockContext.devis = getDevisList();
mockContext.factures = getFacturesList();
const bilan = calculerBilanFinancierGlobal(mockContext.devis, mockContext.factures);
assert(bilan.ca_signe_ht > 20000, "6.A: Bilan financier consolide le CA signé HT");
assert(bilan.nb_factures_retard === 1, "6.B: Détection automatique de la facture en retard (Clôture Bernard)");

const resTresorerie = generateLocalAssistantResponse(
  "Quel est mon chiffre d'affaires, ma trésorerie et mes factures en retard ?",
  mockContext
);
assert(resTresorerie.content.includes("Bilan Financier & Trésorerie BNA"), "6.C: Assistant IA répond avec le bilan financier complet");
assert(resTresorerie.content.includes("FAC-2026-0086"), "6.D: Assistant IA signale la facture en retard FAC-2026-0086");

const devActions = detectAssistantActions("Crée un devis pour Terrasse Martin de 45 m²", mockContext);
assert(devActions.some((a) => a.type === "create_devis" && a.payload.devisQuantite === 45), "6.E: Action Card create_devis (45 m²) générée par l'IA");

// 7. Test PV de Réception, Réserves & Interventions SAV Décennale (Art. 1792-6 Code Civil)
const pvs = getPvReceptions();
const savs = getTicketsSav();
const synthesePvSav = calculerSynthesePvSav(pvs, savs);
assert(synthesePvSav.total_pv === 2, "7.A: 2 PV de réception initiaux chargés");
assert(synthesePvSav.nb_reserves_non_levees === 1, "7.B: 1 réserve active à lever détectée sur Terrasse Martin");
assert(synthesePvSav.tickets_sav_ouverts === 1, "7.C: 1 intervention SAV active détectée sur Bardage Dupont");

const resPvSav = generateLocalAssistantResponse(
  "Quelles sont les réserves à lever sur mes PV de réception et mes interventions SAV ?",
  mockContext
);
assert(resPvSav.content.includes("PV-2026-0014") && resPvSav.content.includes("SAV-2026-0008"), "7.D: Assistant IA liste les PV, les réserves à lever et les tickets SAV DTU");

console.log(`\n🎉 TOUS LES TESTS DE L'ASSISTANT IA, FINANCES, PV & SAV BNA SONT VALIDÉS (${passed} assertions) !`);
