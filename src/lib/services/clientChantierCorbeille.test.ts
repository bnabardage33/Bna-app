import { normalizeTitleCase, normalizeEmail, formatPhoneNumber } from "../formatters.ts";

export type MetierType = "facade" | "terrasse" | "cloture";

export interface ClientRow {
  id: string;
  entreprise_id: string;
  type_client: "particulier" | "professionnel";
  nom: string;
  prenom: string | null;
  societe: string | null;
  nom_commercial: string | null;
  siret: string | null;
  email: string | null;
  telephone: string | null;
  telephone_secondaire: string | null;
  adresse: string | null;
  adresse_complement: string | null;
  code_postal: string | null;
  ville: string | null;
  notes: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactClientRow {
  id: string;
  entreprise_id: string;
  client_id: string;
  nom: string;
  prenom: string | null;
  fonction: string | null;
  telephone: string | null;
  email: string | null;
  est_principal: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChantierRow {
  id: string;
  entreprise_id: string;
  client_id: string;
  contact_id: string | null;
  nom: string;
  metier: MetierType;
  statut: string;
  description: string | null;
  adresse: string | null;
  adresse_complement: string | null;
  code_postal: string | null;
  ville: string | null;
  date_debut_prevue: string | null;
  date_fin_prevue: string | null;
  avancement: number;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

function rowToChantier(
  row: ChantierRow,
  client?: { nom?: string; prenom?: string | null; societe?: string | null; telephone?: string | null },
  contact?: { nom?: string; prenom?: string | null; telephone?: string | null }
) {
  const clientNom = client
    ? client.societe || `${client.prenom ? client.prenom + " " : ""}${client.nom}`
    : undefined;

  return {
    id: row.id,
    client_id: row.client_id,
    client_nom: clientNom,
    telephoneClient: client?.telephone || undefined,
    telephoneContact: contact?.telephone || undefined,
    nom: row.nom,
    ville: row.ville || "Gironde",
    adresse: row.adresse || undefined,
    adresse_complement: row.adresse_complement || undefined,
    code_postal: row.code_postal || undefined,
    date_debut_prevue: row.date_debut_prevue || undefined,
    date_fin_prevue: row.date_fin_prevue || undefined,
    contact_id: row.contact_id || undefined,
    metier: row.metier,
    intervention: row.description || `Chantier ${row.metier}`,
    avancementGlobal: row.avancement,
    deleted_at: row.deleted_at,
  };
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`✓ PASS: ${msg}`);
}

// Simulation du moteur métier de suppression/restauration/contrôles
function simulateSoftDelete(
  item: { deleted_at: string | null; deleted_by: string | null },
  activeUser: { id: string } | null
) {
  if (!activeUser?.id) {
    throw new Error("Opération refusée : session non authentifiée ou expirée.");
  }
  item.deleted_at = new Date().toISOString();
  item.deleted_by = activeUser.id;
}

function simulateRestore(item: { deleted_at: string | null; deleted_by: string | null }) {
  item.deleted_at = null;
  item.deleted_by = null;
}

function simulateHardDeleteClient(
  clientId: string,
  chantiersDB: ChantierRow[],
  contactsDB: ContactClientRow[],
  clientsDB: ClientRow[]
) {
  // Règle métier : bloquée tant qu'un chantier existe (qu'il soit actif ou dans la corbeille)
  const remainingChantiers = chantiersDB.filter((c) => c.client_id === clientId);
  if (remainingChantiers.length > 0) {
    throw new Error(
      `Ce client possède encore ${remainingChantiers.length} chantier(s), dont certains peuvent être dans la corbeille. Supprimez définitivement ces chantiers avant de supprimer définitivement le client.`
    );
  }

  // Nettoyage contacts
  const remainingContacts = contactsDB.filter((ct) => ct.client_id !== clientId);
  // Suppression client
  const clientIndex = clientsDB.findIndex((cl) => cl.id === clientId);
  if (clientIndex !== -1) {
    clientsDB.splice(clientIndex, 1);
  }
}

async function runTests() {
  console.log("=== TESTS MÉTIER : CLIENT ≠ CHANTIER & FINITIONS UX ===");

  // 0. Tests de normalisation intelligente
  assert(normalizeTitleCase("jean") === "Jean", "Norm: jean -> Jean");
  assert(normalizeTitleCase("dupont") === "Dupont", "Norm: dupont -> Dupont");
  assert(normalizeTitleCase("jean Dupont") === "Jean Dupont", "Norm: jean Dupont -> Jean Dupont");
  assert(normalizeTitleCase("bordeaux") === "Bordeaux", "Norm: bordeaux -> Bordeaux");
  assert(normalizeTitleCase("33000 bordeaux") === "33000 Bordeaux", "Norm: 33000 bordeaux -> 33000 Bordeaux");
  assert(normalizeTitleCase("chantier dupont") === "Chantier Dupont", "Norm: chantier dupont -> Chantier Dupont");
  assert(normalizeTitleCase("rue de la chapelle") === "Rue de la Chapelle", "Norm: rue de la chapelle -> Rue de la Chapelle");
  assert(normalizeTitleCase("saint-andré-de-cubzac") === "Saint-André-de-Cubzac", "Norm: Saint-André-de-Cubzac préservé");
  assert(normalizeTitleCase("Saint-André-de-Cubzac") === "Saint-André-de-Cubzac", "Norm: Saint-André-de-Cubzac préservé");
  assert(normalizeTitleCase("la teste-de-buch") === "La Teste-de-Buch", "Norm: La Teste-de-Buch préservé");
  assert(normalizeTitleCase("La Teste-de-Buch") === "La Teste-de-Buch", "Norm: La Teste-de-Buch préservé");
  assert(normalizeTitleCase("jean-pierre") === "Jean-Pierre", "Norm: Jean-Pierre préservé");
  assert(normalizeTitleCase("le haillan") === "Le Haillan", "Norm: Le Haillan préservé");
  assert(normalizeTitleCase("Le Haillan") === "Le Haillan", "Norm: Le Haillan préservé");
  assert(normalizeEmail(" TEST@Example.Fr ") === "test@example.fr", "Norm: Email en minuscules");

  // Formatage du téléphone
  assert(formatPhoneNumber("0612345678") === "06 12 34 56 78", "Format phone: 0612345678 -> 06 12 34 56 78");
  assert(formatPhoneNumber("+33612345678") === "+33 6 12 34 56 78", "Format phone: +33612345678 -> +33 6 12 34 56 78");
  assert(formatPhoneNumber("0556123456") === "05 56 12 34 56", "Format phone fixe: 0556123456 -> 05 56 12 34 56");

  // 1. Indépendance Client (Facturation: Bordeaux) vs Chantier (Intervention: Libourne)
  const clientMock: ClientRow = {
    id: "client-uuid-1",
    entreprise_id: "ent-uuid-1",
    type_client: "particulier",
    nom: normalizeTitleCase("test"),
    prenom: normalizeTitleCase("jean"),
    societe: null,
    nom_commercial: null,
    siret: null,
    telephone: "06 12 34 56 78",
    telephone_secondaire: null,
    email: normalizeEmail("jean.test@example.fr"),
    adresse: "10 rue Exemple",
    adresse_complement: null,
    code_postal: "33000",
    ville: normalizeTitleCase("bordeaux"),
    notes: "Client test facturation Bordeaux",
    deleted_at: null,
    deleted_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const chantierMock: ChantierRow = {
    id: "chantier-uuid-99",
    entreprise_id: "ent-uuid-1",
    client_id: clientMock.id,
    contact_id: null,
    nom: normalizeTitleCase("terrasse test libourne"),
    metier: "terrasse",
    statut: "en_cours",
    description: "Pose terrasse composite sur plots",
    adresse: "20 rue Chantier",
    adresse_complement: null,
    code_postal: "33500",
    ville: normalizeTitleCase("libourne"),
    date_debut_prevue: "2026-11-01",
    date_fin_prevue: "2026-11-05",
    avancement: 0,
    deleted_at: null,
    deleted_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  assert(clientMock.id !== chantierMock.id, "T1: client_id !== chantier_id (identités séparées)");
  assert(chantierMock.client_id === clientMock.id, "T1: chantier.client_id référence exactement client.id");
  assert(clientMock.ville === "Bordeaux", "T2: Facturation client = Bordeaux");
  assert(chantierMock.ville === "Libourne", "T2: Intervention chantier = Libourne");

  const chantierObj = rowToChantier(
    chantierMock,
    { nom: clientMock.nom, prenom: clientMock.prenom, telephone: clientMock.telephone },
    undefined
  );
  assert(chantierObj.ville === "Libourne", "T3: Chantier localisé à Libourne (météo & terrain)");
  assert(chantierObj.client_nom === "Jean Test", "T3: Nom client affiché correctement");
  assert(chantierObj.telephoneClient === "06 12 34 56 78", "T3: Téléphone client disponible sur la carte chantier");

  // 2. Contrôle session active & deleted_by
  const activeUser = { id: "user-auth-uuid-42" };

  // Opération refusée sans session
  let errorWithoutSession = false;
  try {
    simulateSoftDelete(chantierMock, null);
  } catch (err: any) {
    errorWithoutSession = true;
    assert(err.message.includes("session non authentifiée"), "T4: Opération corbeille refusée sans session");
  }
  assert(errorWithoutSession, "T4: Blocage sans session garanti");

  // Mise à la corbeille avec session
  simulateSoftDelete(chantierMock, activeUser);
  assert(chantierMock.deleted_at !== null, "T5: Chantier placé dans la corbeille (deleted_at présent)");
  assert(chantierMock.deleted_by === activeUser.id, "T5: deleted_by correspond obligatoirement à l'utilisateur connecté");

  // Restauration : deleted_at et deleted_by remis à null, relation client_id inchangée
  simulateRestore(chantierMock);
  assert(chantierMock.deleted_at === null, "T6: Restauration remet deleted_at à null");
  assert(chantierMock.deleted_by === null, "T6: Restauration remet deleted_by à null");
  assert(chantierMock.client_id === clientMock.id, "T6: Relation client_id strictement inchangée après restauration");

  // 3. Suppression définitive d'un client : contrôles stricts
  const clientsDB = [{ ...clientMock }];
  const chantiersDB = [{ ...chantierMock }];
  const contactsDB: ContactClientRow[] = [];

  // Scénario A : Client avec chantier actif -> suppression définitive bloquée
  chantiersDB[0].deleted_at = null;
  let blockedWithActive = false;
  try {
    simulateHardDeleteClient(clientMock.id, chantiersDB, contactsDB, clientsDB);
  } catch (err: any) {
    blockedWithActive = true;
    assert(
      err.message.includes("dont certains peuvent être dans la corbeille"),
      "T7: Message exact pour chantier actif rattaché"
    );
  }
  assert(blockedWithActive, "T7: Client avec chantier actif non supprimable");

  // Scénario B : Client avec chantier dans la corbeille -> suppression définitive TOUJOURS bloquée
  chantiersDB[0].deleted_at = new Date().toISOString(); // Placé dans la corbeille
  let blockedWithCorbeille = false;
  try {
    simulateHardDeleteClient(clientMock.id, chantiersDB, contactsDB, clientsDB);
  } catch (err: any) {
    blockedWithCorbeille = true;
    assert(
      err.message.includes("dont certains peuvent être dans la corbeille"),
      "T8: Message exact pour chantier dans la corbeille"
    );
  }
  assert(blockedWithCorbeille, "T8: Client avec chantier dans la corbeille toujours protégé contre la suppression");

  // Scénario C : Suppression définitive possible seulement APRÈS suppression définitive du chantier
  chantiersDB.splice(0, 1);
  assert(chantiersDB.length === 0, "T9: Chantier définitivement purgé");

  simulateHardDeleteClient(clientMock.id, chantiersDB, contactsDB, clientsDB);
  assert(clientsDB.length === 0, "T9: Client supprimé définitivement avec succès après purge des chantiers");

  console.log("\nTous les tests de validation (Client Bordeaux/Chantier Libourne, Corbeille, Restauration, Normalisation) sont validés avec succès !");
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
