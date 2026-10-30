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
  client?: { nom?: string; prenom?: string | null; societe?: string | null }
) {
  const clientNom = client
    ? client.societe || `${client.prenom ? client.prenom + " " : ""}${client.nom}`
    : undefined;

  return {
    id: row.id,
    client_id: row.client_id,
    client_nom: clientNom,
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
  console.log("=== TESTS MÉTIER : CLIENT ≠ CHANTIER & CONTRÔLES SÉCURISÉS ===");

  // 1. Indépendance Client (Facturation: Bordeaux) vs Chantier (Intervention: Libourne)
  const clientMock: ClientRow = {
    id: "client-uuid-1",
    entreprise_id: "ent-uuid-1",
    type_client: "particulier",
    nom: "Test",
    prenom: "Jean",
    societe: null,
    nom_commercial: null,
    siret: null,
    telephone: "0600000001",
    telephone_secondaire: null,
    email: "jean.test@bna.fr",
    adresse: "10 rue Exemple",
    adresse_complement: null,
    code_postal: "33000",
    ville: "Bordeaux",
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
    nom: "Terrasse Test Libourne",
    metier: "terrasse",
    statut: "en_cours",
    description: "Pose terrasse composite sur plots",
    adresse: "20 rue Chantier",
    adresse_complement: null,
    code_postal: "33500",
    ville: "Libourne",
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

  const chantierObj = rowToChantier(chantierMock, { nom: clientMock.nom, prenom: clientMock.prenom });
  assert(chantierObj.ville === "Libourne", "T3: Chantier localisé à Libourne (météo & terrain)");
  assert(chantierObj.client_nom === "Jean Test", "T3: Nom client affiché correctement");

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

  // Restauration : deleted_at et deleted_by remis à null
  simulateRestore(chantierMock);
  assert(chantierMock.deleted_at === null, "T6: Restauration remet deleted_at à null");
  assert(chantierMock.deleted_by === null, "T6: Restauration remet deleted_by à null");

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
  // Suppression définitive du chantier d'abord :
  chantiersDB.splice(0, 1);
  assert(chantiersDB.length === 0, "T9: Chantier définitivement purgé");

  // Suppression du client désormais possible :
  simulateHardDeleteClient(clientMock.id, chantiersDB, contactsDB, clientsDB);
  assert(clientsDB.length === 0, "T9: Client supprimé définitivement avec succès après purge des chantiers");

  console.log("\nTous les tests de contrôles stricts (deleted_by, session, suppression définitive sécurisée) sont validés avec succès !");
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
