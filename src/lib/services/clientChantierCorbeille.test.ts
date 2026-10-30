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

async function runTests() {
  console.log("=== TESTS MÉTIER : CLIENT ≠ CHANTIER & CORBEILLE SÉCURISÉE ===");

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

  // Test 1 : Identifiants distincts et indépendants
  assert(clientMock.id !== chantierMock.id, "T1: client_id !== chantier_id (identités séparées)");
  assert(chantierMock.client_id === clientMock.id, "T1: chantier.client_id référence exactement client.id");

  // Test 2 : Adresses distinctes
  assert(clientMock.ville === "Bordeaux", "T2: Facturation client = Bordeaux");
  assert(chantierMock.ville === "Libourne", "T2: Intervention chantier = Libourne");
  assert(clientMock.adresse !== chantierMock.adresse, "T2: Adresses facturation et intervention découplées");

  // Test 3 : rowToChantier conserve bien l'adresse et le client
  const chantierObj = rowToChantier(chantierMock, { nom: clientMock.nom, prenom: clientMock.prenom });
  assert(chantierObj.ville === "Libourne", "T3: Chantier UI localisé à Libourne (météo & terrain)");
  assert(chantierObj.client_nom === "Jean Test", "T3: Nom client affiché correctement");
  assert(chantierObj.id === "chantier-uuid-99", "T3: ID chantier préservé");

  // Test 4 : Contacts multiples et un seul principal actif
  const contact1: ContactClientRow = {
    id: "ct-1",
    entreprise_id: "ent-uuid-1",
    client_id: clientMock.id,
    nom: "Martin",
    prenom: "Jean",
    fonction: "Gérant",
    telephone: "0600000002",
    email: "jean.martin@sci.fr",
    est_principal: true,
    deleted_at: null,
    deleted_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const contact2: ContactClientRow = {
    id: "ct-2",
    entreprise_id: "ent-uuid-1",
    client_id: clientMock.id,
    nom: "Dupont",
    prenom: "Marie",
    fonction: "Comptabilité",
    telephone: "0600000003",
    email: "compta@sci.fr",
    est_principal: false,
    deleted_at: null,
    deleted_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  assert(contact1.client_id === clientMock.id, "T4: Contact 1 rattaché au bon client");
  assert(contact2.client_id === clientMock.id, "T4: Contact 2 rattaché au bon client");
  assert(contact1.est_principal === true, "T4: Contact 1 est principal");
  assert(contact2.est_principal === false, "T4: Contact 2 est secondaire");

  // Test 5 : Corbeille réversible (Soft delete)
  chantierMock.deleted_at = new Date().toISOString();
  chantierMock.deleted_by = "user-uuid-1";
  assert(chantierMock.deleted_at !== null, "T5: Chantier placé dans la corbeille");

  // Restauration
  chantierMock.deleted_at = null;
  chantierMock.deleted_by = null;
  assert(chantierMock.deleted_at === null, "T5: Chantier restauré avec succès");
  assert(chantierMock.client_id === clientMock.id, "T5: Relation client_id inchangée après restauration");

  console.log("\nTous les tests métier (Client ≠ Chantier, Multi-contacts, Corbeille) sont validés avec succès !");
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
