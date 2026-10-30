import { SupabaseClient } from "@supabase/supabase-js";
import { ClientRow, ContactClientRow, Database, TypeClient } from "@/types/database.types";

export interface CreateClientInput {
  type_client: TypeClient;
  nom: string;
  prenom?: string | null;
  societe?: string | null;
  nom_commercial?: string | null;
  siret?: string | null;
  email?: string | null;
  telephone: string;
  telephone_secondaire?: string | null;
  adresse: string;
  adresse_complement?: string | null;
  code_postal: string;
  ville: string;
  notes?: string | null;
}

export interface CreateContactInput {
  nom: string;
  prenom?: string | null;
  fonction?: string | null;
  telephone?: string | null;
  email?: string | null;
  est_principal?: boolean;
}

/**
 * Récupère les clients actifs (ou tous si includeDeleted = true)
 */
export async function getClients(
  supabase: SupabaseClient<Database>,
  options?: { includeDeleted?: boolean }
): Promise<ClientRow[]> {
  let query = supabase.from("clients").select("*").order("nom", { ascending: true });

  if (!options?.includeDeleted) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as ClientRow[]) || [];
}

/**
 * Récupère un client par son id
 */
export async function getClientById(
  supabase: SupabaseClient<Database>,
  clientId: string
): Promise<ClientRow | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (error) return null;
  return data as ClientRow;
}

/**
 * Création d'un client dans Supabase
 */
export async function createClientRecord(
  supabase: SupabaseClient<Database>,
  entrepriseId: string,
  input: CreateClientInput
): Promise<ClientRow> {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      entreprise_id: entrepriseId,
      type_client: input.type_client,
      nom: input.nom.trim(),
      prenom: input.prenom?.trim() || null,
      societe: input.societe?.trim() || null,
      nom_commercial: input.nom_commercial?.trim() || null,
      siret: input.siret?.trim() || null,
      email: input.email?.trim() || null,
      telephone: input.telephone.trim(),
      telephone_secondaire: input.telephone_secondaire?.trim() || null,
      adresse: input.adresse.trim(),
      adresse_complement: input.adresse_complement?.trim() || null,
      code_postal: input.code_postal.trim(),
      ville: input.ville.trim(),
      notes: input.notes?.trim() || null,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as ClientRow;
}

/**
 * Mise à jour d'un client
 */
export async function updateClientRecord(
  supabase: SupabaseClient<Database>,
  clientId: string,
  updates: Partial<CreateClientInput>
): Promise<ClientRow> {
  const { data, error } = await (supabase.from("clients") as any)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .select()
    .single();

  if (error) throw error;
  return data as ClientRow;
}

/**
 * Mise à la corbeille sécurisée d'un client.
 * Bloque la suppression si le client possède des chantiers actifs (deleted_at IS NULL).
 * Récupère obligatoirement le user.id de la session Supabase active.
 */
export async function softDeleteClient(
  supabase: SupabaseClient<Database>,
  clientId: string
): Promise<void> {
  // 0. Vérification de la session active (interdit tout ID libre ou non authentifié)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("Opération refusée : session non authentifiée ou expirée.");
  }

  // 1. Vérifier les chantiers actifs
  const { count, error: countError } = await supabase
    .from("chantiers")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .is("deleted_at", null);

  if (countError) throw countError;

  if (count && count > 0) {
    throw new Error(
      `Ce client possède encore ${count} chantier(s) actif(s). Placez d'abord ces chantiers dans la corbeille ou archivez-les.`
    );
  }

  // 2. Soft delete avec deleted_by strict
  const { error } = await (supabase.from("clients") as any)
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq("id", clientId);

  if (error) throw error;
}

/**
 * Restauration d'un client depuis la corbeille.
 * Remet obligatoirement deleted_at et deleted_by à null.
 */
export async function restoreClient(
  supabase: SupabaseClient<Database>,
  clientId: string
): Promise<void> {
  const { error } = await (supabase.from("clients") as any)
    .update({
      deleted_at: null,
      deleted_by: null,
    })
    .eq("id", clientId);

  if (error) throw error;
}

/**
 * Suppression définitive d'un client (Hard delete - réservé au dirigeant).
 * Bloquée tant qu'un chantier lié existe encore (qu'il soit actif ou dans la corbeille).
 */
export async function hardDeleteClient(
  supabase: SupabaseClient<Database>,
  clientId: string
): Promise<void> {
  // 1. Vérifier si un quelconque chantier lié existe encore (actif OU corbeille)
  const { count, error: countError } = await supabase
    .from("chantiers")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  if (countError) throw countError;

  if (count && count > 0) {
    throw new Error(
      `Ce client possède encore ${count} chantier(s), dont certains peuvent être dans la corbeille. Supprimez définitivement ces chantiers avant de supprimer définitivement le client.`
    );
  }

  // 2. Nettoyage des contacts rattachés
  await (supabase.from("contacts_clients") as any).delete().eq("client_id", clientId);

  // 3. Suppression définitive du client
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw error;
}

/**
 * Récupère les contacts d'un client (actifs par défaut)
 */
export async function getContactsByClient(
  supabase: SupabaseClient<Database>,
  clientId: string,
  options?: { includeDeleted?: boolean }
): Promise<ContactClientRow[]> {
  let query = (supabase.from("contacts_clients") as any)
    .select("*")
    .eq("client_id", clientId)
    .order("est_principal", { ascending: false })
    .order("nom", { ascending: true });

  if (!options?.includeDeleted) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as ContactClientRow[]) || [];
}

/**
 * Création d'un contact rattaché à un client
 */
export async function createContactRecord(
  supabase: SupabaseClient<Database>,
  entrepriseId: string,
  clientId: string,
  input: CreateContactInput
): Promise<ContactClientRow> {
  // Si le nouveau contact est marqué principal, désactiver temporairement les autres contacts principaux actifs
  if (input.est_principal) {
    await (supabase.from("contacts_clients") as any)
      .update({ est_principal: false })
      .eq("client_id", clientId)
      .is("deleted_at", null);
  }

  const { data, error } = await (supabase.from("contacts_clients") as any)
    .insert({
      entreprise_id: entrepriseId,
      client_id: clientId,
      nom: input.nom.trim(),
      prenom: input.prenom?.trim() || null,
      fonction: input.fonction?.trim() || null,
      telephone: input.telephone?.trim() || null,
      email: input.email?.trim() || null,
      est_principal: !!input.est_principal,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ContactClientRow;
}

/**
 * Mise à jour d'un contact
 */
export async function updateContactRecord(
  supabase: SupabaseClient<Database>,
  contactId: string,
  clientId: string,
  updates: Partial<CreateContactInput>
): Promise<ContactClientRow> {
  if (updates.est_principal) {
    await (supabase.from("contacts_clients") as any)
      .update({ est_principal: false })
      .eq("client_id", clientId)
      .is("deleted_at", null);
  }

  const { data, error } = await (supabase.from("contacts_clients") as any)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId)
    .select()
    .single();

  if (error) throw error;
  return data as ContactClientRow;
}

/**
 * Soft delete d'un contact avec vérification de la session active
 */
export async function softDeleteContact(
  supabase: SupabaseClient<Database>,
  contactId: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("Opération refusée : session non authentifiée ou expirée.");
  }

  const { error } = await (supabase.from("contacts_clients") as any)
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq("id", contactId);

  if (error) throw error;
}

/**
 * Restauration d'un contact (deleted_at et deleted_by remis à null)
 */
export async function restoreContact(
  supabase: SupabaseClient<Database>,
  contactId: string
): Promise<void> {
  const { error } = await (supabase.from("contacts_clients") as any)
    .update({
      deleted_at: null,
      deleted_by: null,
    })
    .eq("id", contactId);

  if (error) throw error;
}

/**
 * Suppression définitive d'un contact (Hard delete)
 */
export async function hardDeleteContact(
  supabase: SupabaseClient<Database>,
  contactId: string
): Promise<void> {
  const { error } = await (supabase.from("contacts_clients") as any)
    .delete()
    .eq("id", contactId);
  if (error) throw error;
}

/**
 * Récupère les clients supprimés pour la corbeille
 */
export async function getDeletedClients(
  supabase: SupabaseClient<Database>
): Promise<ClientRow[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) throw error;
  return (data as ClientRow[]) || [];
}

/**
 * Récupère les contacts supprimés pour la corbeille
 */
export async function getDeletedContacts(
  supabase: SupabaseClient<Database>
): Promise<ContactClientRow[]> {
  const { data, error } = await (supabase.from("contacts_clients") as any)
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) throw error;
  return (data as ContactClientRow[]) || [];
}
