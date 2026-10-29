import { SupabaseClient } from "@supabase/supabase-js";
import { ChantierRow, ClientRow, Database } from "@/types/database.types";
import { Chantier, MetierType } from "@/types/metier";
import { MOCK_CHANTIERS } from "@/data/mockChantiers";

/**
 * Convertit une ligne PostgreSQL ChantierRow en objet Chantier pour l'UI Bna-App
 */
export function rowToChantier(row: ChantierRow): Chantier {
  return {
    id: row.id,
    nom: row.nom,
    ville: row.ville || "Gironde",
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
  };
}

/**
 * Récupère les chantiers : priorité aux données Supabase, avec fallback sur les mocks
 */
export async function getChantiers(supabase: SupabaseClient<Database>): Promise<Chantier[]> {
  try {
    const { data, error } = await supabase
      .from("chantiers")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return (data as ChantierRow[]).map(rowToChantier);
    }
  } catch {
    // Mode hors-ligne ou session non initialisée
  }

  // Fallback propre sur les 3 chantiers métiers existants
  return Object.values(MOCK_CHANTIERS);
}

/**
 * Création d'un client dans Supabase
 */
export async function createClientRecord(
  supabase: SupabaseClient<Database>,
  entrepriseId: string,
  clientData: {
    nom: string;
    prenom?: string;
    type_client: "particulier" | "professionnel";
    email?: string;
    telephone?: string;
    ville?: string;
  }
): Promise<ClientRow> {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      entreprise_id: entrepriseId,
      nom: clientData.nom,
      prenom: clientData.prenom || null,
      type_client: clientData.type_client,
      email: clientData.email || null,
      telephone: clientData.telephone || null,
      ville: clientData.ville || null,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as ClientRow;
}

/**
 * Création d'un chantier générique dans Supabase
 */
export async function createChantierRecord(
  supabase: SupabaseClient<Database>,
  entrepriseId: string,
  chantierData: {
    client_id: string;
    nom: string;
    metier: MetierType;
    ville?: string;
    description?: string;
    avancement?: number;
  }
): Promise<ChantierRow> {
  const { data, error } = await supabase
    .from("chantiers")
    .insert({
      entreprise_id: entrepriseId,
      client_id: chantierData.client_id,
      nom: chantierData.nom,
      metier: chantierData.metier,
      ville: chantierData.ville || null,
      description: chantierData.description || null,
      avancement: chantierData.avancement || 0,
      statut: "en_cours",
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as ChantierRow;
}
