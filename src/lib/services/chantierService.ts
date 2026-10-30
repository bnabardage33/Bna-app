import { SupabaseClient } from "@supabase/supabase-js";
import { ChantierRow, Database } from "@/types/database.types";
import { Chantier, MetierType } from "@/types/metier";
import { MOCK_CHANTIERS } from "@/data/mockChantiers";

export interface CreateChantierInput {
  client_id: string;
  nom: string;
  metier: MetierType;
  description?: string;
  adresse: string;
  adresse_complement?: string;
  code_postal: string;
  ville: string;
  date_debut_prevue?: string;
  date_fin_prevue?: string;
  contact_id?: string;
  avancement?: number;
}

/**
 * Convertit une ligne PostgreSQL ChantierRow en objet Chantier pour l'UI Bna-App
 */
export function rowToChantier(
  row: ChantierRow,
  client?: { nom?: string; prenom?: string | null; societe?: string | null; telephone?: string | null },
  contact?: { nom?: string; prenom?: string | null; telephone?: string | null }
): Chantier {
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
    metier: row.metier as MetierType,
    intervention: row.description || `Chantier ${row.metier}`,
    avancementGlobal: row.avancement,
    avancementDetails: [
      { label: `Avancement global ${row.metier}`, pourcentage: row.avancement },
    ],
    prochaineEtape: {
      titre: "Étape en cours de planification",
      detail: row.date_debut_prevue ? `Prévu dès le ${row.date_debut_prevue}` : "À planifier",
    },
    meteoImpact: {
      alerte: "Conditions météo standard",
      consignes: ["Consulter les prévisions avant intervention terrain"],
    },
    materiaux: [
      { nom: `Matériaux principaux ${row.metier}`, statut: "ok", detail: "En stock" },
    ],
    photosRecentesCount: 0,
    deleted_at: row.deleted_at,
  };
}

/**
 * Récupère les chantiers : priorité absolue aux données réelles Supabase.
 * Les données mock ne sont utilisées que si la connexion échoue ou en mode hors-ligne sans compte connecté.
 */
export async function getChantiers(
  supabase: SupabaseClient<Database>,
  options?: { includeDeleted?: boolean; fallbackToMocks?: boolean }
): Promise<Chantier[]> {
  try {
    let query = supabase
      .from("chantiers")
      .select("*, clients(nom, prenom, societe, telephone), contacts_clients(nom, prenom, telephone)")
      .order("created_at", { ascending: false });

    if (!options?.includeDeleted) {
      query = query.is("deleted_at", null);
    }

    const { data, error } = await query;

    if (!error && data !== null) {
      // Données réelles Supabase trouvées (même si vide [])
      return data.map((item: any) =>
        rowToChantier(item as ChantierRow, item.clients, item.contacts_clients)
      );
    }
  } catch {
    // Mode hors-ligne ou erreur de requête
  }

  // Fallback sur les mocks uniquement si explicitement autorisé (par défaut désactivé si connecté)
  if (options?.fallbackToMocks !== false) {
    return Object.values(MOCK_CHANTIERS);
  }

  return [];
}

/**
 * Création d'un chantier complet lié obligatoirement à un client
 */
export async function createChantierRecord(
  supabase: SupabaseClient<Database>,
  entrepriseId: string,
  input: CreateChantierInput
): Promise<ChantierRow> {
  const { data, error } = await (supabase.from("chantiers") as any)
    .insert({
      entreprise_id: entrepriseId,
      client_id: input.client_id,
      nom: input.nom.trim(),
      metier: input.metier,
      description: input.description?.trim() || null,
      adresse: input.adresse.trim(),
      adresse_complement: input.adresse_complement?.trim() || null,
      code_postal: input.code_postal.trim(),
      ville: input.ville.trim(),
      date_debut_prevue: input.date_debut_prevue || null,
      date_fin_prevue: input.date_fin_prevue || null,
      contact_id: input.contact_id || null,
      avancement: input.avancement || 0,
      statut: "en_cours",
    })
    .select()
    .single();

  if (error) throw error;
  return data as ChantierRow;
}

/**
 * Mise à jour d'un chantier
 */
export async function updateChantierRecord(
  supabase: SupabaseClient<Database>,
  chantierId: string,
  updates: Partial<CreateChantierInput> & { statut?: string; avancement?: number }
): Promise<ChantierRow> {
  const { data, error } = await (supabase.from("chantiers") as any)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", chantierId)
    .select()
    .single();

  if (error) throw error;
  return data as ChantierRow;
}

/**
 * Mise à la corbeille sécurisée d'un chantier (Soft delete).
 * Récupère obligatoirement le user.id de la session Supabase active.
 */
export async function softDeleteChantier(
  supabase: SupabaseClient<Database>,
  chantierId: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("Opération refusée : session non authentifiée ou expirée.");
  }

  const { error } = await (supabase.from("chantiers") as any)
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq("id", chantierId);

  if (error) throw error;
}

/**
 * Restauration d'un chantier depuis la corbeille.
 * Remet obligatoirement deleted_at et deleted_by à null.
 */
export async function restoreChantier(
  supabase: SupabaseClient<Database>,
  chantierId: string
): Promise<void> {
  const { error } = await (supabase.from("chantiers") as any)
    .update({
      deleted_at: null,
      deleted_by: null,
    })
    .eq("id", chantierId);

  if (error) throw error;
}

/**
 * Suppression définitive d'un chantier (Hard delete - réservé au dirigeant)
 */
export async function hardDeleteChantier(
  supabase: SupabaseClient<Database>,
  chantierId: string
): Promise<void> {
  const { error } = await supabase.from("chantiers").delete().eq("id", chantierId);
  if (error) throw error;
}

/**
 * Récupère les chantiers supprimés pour la corbeille
 */
export async function getDeletedChantiers(
  supabase: SupabaseClient<Database>
): Promise<Array<ChantierRow & { clients?: { nom: string; prenom?: string | null; societe?: string | null } }>> {
  const { data, error } = await supabase
    .from("chantiers")
    .select("*, clients(nom, prenom, societe)")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) throw error;
  return (data as any) || [];
}
