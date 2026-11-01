/**
 * BNA-APP — Service Commandes Fournisseurs V1
 *
 * Gestion des commandes d'approvisionnement :
 * - Snapshot immuable des besoins actifs du chantier
 * - Numérotation métier atomique CMD-YYYY-XXXX
 * - Mémorisation de la version source (ex: V3)
 * - Cycle de statut V1 : brouillon -> envoyée -> commandée -> annulée
 * - RLS multi-tenant étanche
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FournisseurRow,
  CommandeFournisseurRow,
  LigneCommandeFournisseurRow,
  StatutCommandeFournisseur,
} from "@/types/database.types";

export type {
  FournisseurRow,
  CommandeFournisseurRow,
  LigneCommandeFournisseurRow,
  StatutCommandeFournisseur,
};

export interface CommandeAvecFournisseur extends CommandeFournisseurRow {
  fournisseur: FournisseurRow;
  lignes?: LigneCommandeFournisseurRow[];
  nb_lignes?: number;
}

export interface LigneCommandeInput {
  besoin_source_id?: string | null;
  designation: string;
  categorie: string;
  unite: string;
  quantite: number;
}

export interface CreerCommandeFournisseurParams {
  chantier_id: string;
  fournisseur_id: string;
  version_source_id?: string | null;
  lignes: LigneCommandeInput[];
  commentaire?: string | null;
  reference_fournisseur?: string | null;
}

/**
 * Liste les fournisseurs enregistrés de l'entreprise.
 */
export async function getFournisseurs(
  supabase: SupabaseClient
): Promise<FournisseurRow[]> {
  const { data, error } = await supabase
    .from("fournisseurs")
    .select("*")
    .order("nom", { ascending: true });

  if (error) {
    throw new Error(`Erreur lors du chargement des fournisseurs : ${error.message}`);
  }
  return data || [];
}

/**
 * Crée un nouveau fournisseur pour l'entreprise courante.
 */
export async function creerFournisseur(
  supabase: SupabaseClient,
  payload: {
    nom: string;
    telephone?: string | null;
    email?: string | null;
    notes?: string | null;
  }
): Promise<FournisseurRow> {
  const nomClean = payload.nom.trim();
  if (!nomClean) {
    throw new Error("Le nom du fournisseur est obligatoire.");
  }

  // 1. Récupérer l'entreprise de l'utilisateur
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profils")
    .select("entreprise_id")
    .eq("id", user?.id || "")
    .maybeSingle();

  const entrepriseId = profile?.entreprise_id;
  if (!entrepriseId) {
    throw new Error("Entreprise introuvable pour l'utilisateur connecté.");
  }

  const { data, error } = await supabase
    .from("fournisseurs")
    .insert({
      entreprise_id: entrepriseId,
      nom: nomClean,
      telephone: payload.telephone ? payload.telephone.trim() : null,
      email: payload.email ? payload.email.trim().toLowerCase() : null,
      notes: payload.notes ? payload.notes.trim() : null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`Un fournisseur nommé "${nomClean}" existe déjà.`);
    }
    throw new Error(`Erreur lors de la création du fournisseur : ${error.message}`);
  }
  return data;
}

/**
 * Récupère toutes les commandes fournisseurs d'un chantier.
 */
export async function getCommandesByChantier(
  supabase: SupabaseClient,
  chantierId: string
): Promise<CommandeAvecFournisseur[]> {
  const { data, error } = await supabase
    .from("commandes_fournisseurs")
    .select(`
      *,
      fournisseur:fournisseurs(*)
    `)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erreur lors du chargement des commandes : ${error.message}`);
  }

  return (data || []) as unknown as CommandeAvecFournisseur[];
}

/**
 * Récupère le détail d'une commande avec son fournisseur et ses lignes figées.
 */
export async function getCommandeDetail(
  supabase: SupabaseClient,
  commandeId: string
): Promise<CommandeAvecFournisseur | null> {
  const { data: commande, error: cmdErr } = await supabase
    .from("commandes_fournisseurs")
    .select(`
      *,
      fournisseur:fournisseurs(*)
    `)
    .eq("id", commandeId)
    .maybeSingle();

  if (cmdErr || !commande) {
    if (cmdErr) throw new Error(`Erreur chargement commande : ${cmdErr.message}`);
    return null;
  }

  const { data: lignes, error: ligErr } = await supabase
    .from("lignes_commande_fournisseur")
    .select("*")
    .eq("commande_id", commandeId)
    .order("created_at", { ascending: true });

  if (ligErr) {
    throw new Error(`Erreur chargement lignes : ${ligErr.message}`);
  }

  return {
    ...(commande as unknown as CommandeAvecFournisseur),
    lignes: lignes || [],
  };
}

/**
 * Crée une commande fournisseur avec snapshot des lignes et numéro atomique CMD-YYYY-XXXX.
 */
export async function creerCommandeFournisseur(
  supabase: SupabaseClient,
  params: CreerCommandeFournisseurParams
): Promise<{ commande: CommandeFournisseurRow; lignes: LigneCommandeFournisseurRow[] }> {
  if (!params.chantier_id) throw new Error("Chantier obligatoire.");
  if (!params.fournisseur_id) throw new Error("Fournisseur obligatoire.");
  if (!params.lignes || params.lignes.length === 0) {
    throw new Error("La commande doit comporter au moins une ligne.");
  }

  // Validation des lignes
  for (const l of params.lignes) {
    if (!l.designation || !l.designation.trim()) {
      throw new Error("Désignation obligatoire pour chaque ligne.");
    }
    if (typeof l.quantite !== "number" || Number.isNaN(l.quantite) || l.quantite < 0) {
      throw new Error(`Quantité invalide pour la ligne "${l.designation}".`);
    }
  }

  const { data, error } = await supabase.rpc("creer_commande_fournisseur", {
    p_chantier_id: params.chantier_id,
    p_fournisseur_id: params.fournisseur_id,
    p_version_source_id: params.version_source_id || null,
    p_lignes: params.lignes,
    p_commentaire: params.commentaire?.trim() || null,
    p_reference_fournisseur: params.reference_fournisseur?.trim() || null,
  });

  if (error) {
    throw new Error(`Erreur lors de la création de la commande : ${error.message}`);
  }

  return data as { commande: CommandeFournisseurRow; lignes: LigneCommandeFournisseurRow[] };
}

/**
 * Met à jour les lignes d'une commande (uniquement autorisée si statut = 'brouillon').
 */
export async function updateLignesCommande(
  supabase: SupabaseClient,
  commandeId: string,
  lignes: { id: string; quantite: number }[]
): Promise<void> {
  // Vérification préalable du statut
  const { data: cmd, error: checkErr } = await supabase
    .from("commandes_fournisseurs")
    .select("statut")
    .eq("id", commandeId)
    .single();

  if (checkErr || !cmd) {
    throw new Error("Commande introuvable.");
  }

  if (cmd.statut !== "brouillon") {
    throw new Error("Seule une commande au statut « brouillon » peut être modifiée.");
  }

  for (const item of lignes) {
    if (item.quantite < 0) {
      throw new Error("Une quantité ne peut pas être négative.");
    }
    const { error } = await supabase
      .from("lignes_commande_fournisseur")
      .update({ quantite: item.quantite })
      .eq("id", item.id)
      .eq("commande_id", commandeId);

    if (error) {
      throw new Error(`Erreur modification ligne : ${error.message}`);
    }
  }
}

/**
 * Fait évoluer le statut d'une commande fournisseur.
 * Transitions permises :
 * - brouillon -> envoyee
 * - brouillon / envoyee -> commandee
 * - brouillon / envoyee -> annulee
 */
export async function changerStatutCommande(
  supabase: SupabaseClient,
  commandeId: string,
  nouveauStatut: StatutCommandeFournisseur
): Promise<void> {
  const statutsValides: StatutCommandeFournisseur[] = [
    "brouillon",
    "envoyee",
    "commandee",
    "annulee",
  ];
  if (!statutsValides.includes(nouveauStatut)) {
    throw new Error(`Statut invalide : "${nouveauStatut}".`);
  }

  const { error } = await supabase
    .from("commandes_fournisseurs")
    .update({ statut: nouveauStatut, updated_at: new Date().toISOString() })
    .eq("id", commandeId);

  if (error) {
    throw new Error(`Erreur changement de statut : ${error.message}`);
  }
}
