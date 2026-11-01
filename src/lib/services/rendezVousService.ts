/**
 * BNA-APP — Service Rendez-vous & Jalons V1
 *
 * Gestion des rendez-vous clients, visites techniques et points d'étape :
 * - Persistance Supabase (table `rendez_vous`)
 * - Fallback / cache immédiat localStorage (`bna_rendez_vous_v1`)
 * - Connexion directe au planning général Mermaid.js
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface RendezVous {
  id: string;
  entreprise_id?: string;
  chantier_id?: string | null;
  chantier_nom?: string | null;
  client_id?: string | null;
  client_nom?: string | null;
  titre: string;
  nature: string;
  nature_type?: string | null;
  date: string; // YYYY-MM-DD
  heure_debut: string; // "09:00"
  heure_fin?: string | null; // "10:30"
  lieu?: string | null;
  statut: "planifie" | "confirme" | "effectue" | "annule";
  created_at: string;
}

export interface CreerRendezVousInput {
  chantier_id?: string | null;
  chantier_nom?: string | null;
  client_id?: string | null;
  client_nom?: string | null;
  titre: string;
  nature: string;
  nature_type?: string | null;
  date: string;
  heure_debut: string;
  heure_fin?: string | null;
  lieu?: string | null;
  statut?: "planifie" | "confirme" | "effectue" | "annule";
}

const STORAGE_KEY = "bna_rendez_vous_v1";

const DEFAULT_RDVS: RendezVous[] = [
  {
    id: "rdv-mock-1",
    chantier_id: "martin",
    chantier_nom: "Terrasse Martin",
    titre: "Visite technique & réglage lambourdes",
    nature: "Contrôle planéité des lambourdes, vérification de l'humidité du bois à l'humidimètre à pointes et calage des plots avant pose des lames Cumaru.",
    date: "2026-11-02",
    heure_debut: "09:30",
    heure_fin: "11:00",
    lieu: "Mérignac",
    statut: "confirme",
    created_at: "2026-10-30T10:00:00Z",
  },
  {
    id: "rdv-mock-2",
    chantier_id: "dupont",
    chantier_nom: "Bardage Dupont",
    titre: "Point d'étape pare-pluie & équerres",
    nature: "Validation de la ventilation haute/basse (lame d'air 20mm), contrôle de l'alignement des chevrons et validation de la teinte des cornières d'angle aluminium avec le client.",
    date: "2026-11-04",
    heure_debut: "14:00",
    heure_fin: "15:30",
    lieu: "Pessac",
    statut: "planifie",
    created_at: "2026-10-31T08:30:00Z",
  },
  {
    id: "rdv-mock-3",
    chantier_id: "martin",
    chantier_nom: "Terrasse Martin",
    titre: "Réception de chantier avec le client",
    nature: "Tour complet de l'ouvrage, signature du PV de réception sans réserve, remise de la fiche d'entretien du bois et conseils de nettoyage haute pression douce.",
    date: "2026-11-09",
    heure_debut: "11:00",
    heure_fin: "12:00",
    lieu: "Mérignac",
    statut: "planifie",
    created_at: "2026-10-31T14:00:00Z",
  },
];

let memoryRdvs: RendezVous[] = [...DEFAULT_RDVS];

function getLocalRdvs(): RendezVous[] {
  if (typeof window === "undefined") return memoryRdvs;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignorer
  }
  return DEFAULT_RDVS;
}

function saveLocalRdvs(list: RendezVous[]) {
  if (typeof window === "undefined") {
    memoryRdvs = [...list];
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignorer
  }
}

/**
 * Récupère tous les rendez-vous (Supabase si connecté, avec fallback localStorage transparent).
 */
export async function getRendezVous(
  supabase?: SupabaseClient | null
): Promise<RendezVous[]> {
  const localList = getLocalRdvs();

  if (!supabase) return localList;

  try {
    const { data, error } = await supabase
      .from("rendez_vous")
      .select("*")
      .order("date", { ascending: true })
      .order("heure_debut", { ascending: true });

    if (error || !data || data.length === 0) {
      return localList;
    }

    const mergedMap = new Map<string, RendezVous>();
    // Charger d'abord les mocks/locaux
    localList.forEach((r) => mergedMap.set(r.id, r));
    // Écraser/compléter avec les données serveur Supabase
    (data as any[]).forEach((row) => {
      mergedMap.set(row.id, {
        id: row.id,
        entreprise_id: row.entreprise_id,
        chantier_id: row.chantier_id,
        client_id: row.client_id,
        titre: row.titre,
        nature: row.nature,
        date: row.date,
        heure_debut: row.heure_debut,
        heure_fin: row.heure_fin,
        lieu: row.lieu,
        statut: row.statut,
        created_at: row.created_at,
      });
    });

    const result = Array.from(mergedMap.values()).sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date);
      if (cmpDate !== 0) return cmpDate;
      return a.heure_debut.localeCompare(b.heure_debut);
    });

    saveLocalRdvs(result);
    return result;
  } catch {
    return localList;
  }
}

/**
 * Récupère les rendez-vous spécifiquement associés à un chantier.
 */
export async function getRendezVousByChantier(
  supabase: SupabaseClient | null | undefined,
  chantierId: string
): Promise<RendezVous[]> {
  const all = await getRendezVous(supabase);
  return all.filter((r) => r.chantier_id === chantierId);
}

/**
 * Crée un nouveau rendez-vous et le sauvegarde immédiatement.
 */
export async function creerRendezVous(
  supabase: SupabaseClient | null | undefined,
  input: CreerRendezVousInput
): Promise<RendezVous> {
  const newRdv: RendezVous = {
    id: `rdv-${Date.now()}`,
    chantier_id: input.chantier_id || null,
    chantier_nom: input.chantier_nom || null,
    client_id: input.client_id || null,
    client_nom: input.client_nom || null,
    titre: input.titre.trim() || "Rendez-vous",
    nature: input.nature.trim() || "Point technique de chantier",
    nature_type: input.nature_type || null,
    date: input.date || new Date().toISOString().slice(0, 10),
    heure_debut: input.heure_debut || "09:00",
    heure_fin: input.heure_fin || null,
    lieu: input.lieu?.trim() || null,
    statut: input.statut || "planifie",
    created_at: new Date().toISOString(),
  };

  // 1. Sauvegarde locale synchrone
  const current = getLocalRdvs();
  const updated = [newRdv, ...current];
  saveLocalRdvs(updated);

  // 2. Sauvegarde Supabase si session active
  if (supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profils")
          .select("entreprise_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.entreprise_id) {
          const { data: dbData } = await supabase
            .from("rendez_vous")
            .insert({
              entreprise_id: profile.entreprise_id,
              chantier_id: input.chantier_id && input.chantier_id.length === 36 ? input.chantier_id : null,
              client_id: input.client_id && input.client_id.length === 36 ? input.client_id : null,
              titre: newRdv.titre,
              nature: newRdv.nature,
              date: newRdv.date,
              heure_debut: newRdv.heure_debut,
              heure_fin: newRdv.heure_fin,
              lieu: newRdv.lieu,
              statut: newRdv.statut,
            })
            .select()
            .single();

          if (dbData) {
            newRdv.id = dbData.id;
            newRdv.entreprise_id = dbData.entreprise_id;
            // Remplacer dans local
            saveLocalRdvs([newRdv, ...current]);
          }
        }
      }
    } catch {
      // Tolérance offline / fallback local
    }
  }

  return newRdv;
}

/**
 * Supprime un rendez-vous.
 */
export async function supprimerRendezVous(
  supabase: SupabaseClient | null | undefined,
  id: string
): Promise<void> {
  const current = getLocalRdvs();
  const filtered = current.filter((r) => r.id !== id);
  saveLocalRdvs(filtered);

  if (supabase) {
    try {
      await supabase.from("rendez_vous").delete().eq("id", id);
    } catch {
      // ignorer
    }
  }
}

/**
 * Modifie un rendez-vous (statut, heure, nature...).
 */
export async function updateRendezVous(
  supabase: SupabaseClient | null | undefined,
  id: string,
  patch: Partial<RendezVous>
): Promise<RendezVous | null> {
  const current = getLocalRdvs();
  let updatedRdv: RendezVous | null = null;

  const nextList = current.map((r) => {
    if (r.id === id) {
      updatedRdv = { ...r, ...patch };
      return updatedRdv;
    }
    return r;
  });

  saveLocalRdvs(nextList);

  if (supabase && updatedRdv) {
    try {
      await supabase
        .from("rendez_vous")
        .update({
          titre: (updatedRdv as RendezVous).titre,
          nature: (updatedRdv as RendezVous).nature,
          date: (updatedRdv as RendezVous).date,
          heure_debut: (updatedRdv as RendezVous).heure_debut,
          heure_fin: (updatedRdv as RendezVous).heure_fin,
          statut: (updatedRdv as RendezVous).statut,
          lieu: (updatedRdv as RendezVous).lieu,
        })
        .eq("id", id);
    } catch {
      // ignorer
    }
  }

  return updatedRdv;
}
