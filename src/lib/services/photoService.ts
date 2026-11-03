import { SupabaseClient } from "@supabase/supabase-js";
import { Database, PhotoChantierRow } from "@/types/database.types";
import { isUuid } from "./chantierService";

export type PhotoType = "constat" | "pointage";

export interface PhotoChantier {
  id: string;
  chantierId: string;
  type: PhotoType;
  titre: string;
  description?: string;
  localisation?: string;
  storagePath?: string;
  url: string;
  date: string; // YYYY-MM-DD
  heure: string; // HH:mm
  thumbnailGradient?: string;
  isCustom?: boolean;
  createdBy?: string;
}

export interface UploadPhotoParams {
  chantierId: string;
  file?: File | Blob;
  dataUrl?: string;
  type: PhotoType;
  titre: string;
  description?: string;
  localisation?: string;
}

const STORAGE_BUCKET = "photos-chantiers";

/**
 * Convertit une ligne Supabase en interface PhotoChantier
 */
export function rowToPhoto(row: PhotoChantierRow): PhotoChantier {
  return {
    id: row.id,
    chantierId: row.chantier_id,
    type: row.type,
    titre: row.titre,
    description: row.description || undefined,
    localisation: row.localisation || undefined,
    storagePath: row.storage_path,
    url: row.url,
    date: row.date,
    heure: row.heure,
    createdBy: row.created_by || undefined,
    isCustom: true,
  };
}

/**
 * Récupère les photos d'un chantier :
 * - Priorité absolue à Supabase si l'id est un UUID
 * - Fallback / fusion avec les photos du cache local
 */
export async function getPhotosByChantier(
  supabase: SupabaseClient,
  chantierId: string
): Promise<PhotoChantier[]> {
  const localPhotos = getLocalPhotos(chantierId);

  if (!isUuid(chantierId)) {
    return localPhotos;
  }

  try {
    const { data, error } = await (supabase.from("photos_chantiers") as any)
      .select("*")
      .eq("chantier_id", chantierId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[photoService] Erreur Supabase getPhotos, fallback local :", error.message);
      return localPhotos;
    }

    if (data && data.length > 0) {
      const cloudPhotos = (data as PhotoChantierRow[]).map(rowToPhoto);
      // Fusionne les éventuelles photos locales non encore synchronisées
      const cloudIds = new Set(cloudPhotos.map((p) => p.id));
      const unsyncedLocal = localPhotos.filter((p) => !cloudIds.has(p.id) && p.isCustom);
      return [...cloudPhotos, ...unsyncedLocal];
    }

    return localPhotos;
  } catch (err) {
    console.warn("[photoService] Exception getPhotos :", err);
    return localPhotos;
  }
}

/**
 * Envoie une photo dans le Storage Supabase et enregistre ses métadonnées dans la table photos_chantiers.
 * En cas de mode hors-ligne ou de chantier mock, sauvegarde dans le localStorage.
 */
export async function uploadPhotoChantier(
  supabase: SupabaseClient,
  params: UploadPhotoParams
): Promise<PhotoChantier> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;
  const heureStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const cleanTitre = params.titre.trim() || (params.type === "constat" ? "Constat terrain" : "Pointage avancement");

  // Mode Supabase connecté si UUID
  if (isUuid(params.chantierId)) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (user) {
        // Récupère l'entreprise_id rattachée au chantier
        const { data: chantierRow } = await (supabase.from("chantiers") as any)
          .select("entreprise_id")
          .eq("id", params.chantierId)
          .maybeSingle();

        const entrepriseId = (chantierRow as { entreprise_id?: string } | null)?.entreprise_id;

        if (entrepriseId && params.file) {
          const fileExt = params.file instanceof File && params.file.name.includes(".")
            ? params.file.name.split(".").pop()?.toLowerCase() || "jpg"
            : "jpg";

          const photoId = crypto.randomUUID();
          const filePath = `${entrepriseId}/${params.chantierId}/${photoId}.${fileExt}`;

          // Upload binaire vers Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, params.file, {
              contentType: params.file.type || "image/jpeg",
              upsert: false,
            });

          if (uploadError) {
            console.error("[photoService] Erreur upload bucket :", uploadError.message);
          } else {
            // URL publique depuis le bucket
            const { data: urlData } = supabase.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(filePath);

            const publicUrl = urlData.publicUrl;

            // Insertion dans la table photos_chantiers
            const { data: insertedRow, error: insertError } = await (supabase
              .from("photos_chantiers") as any)
              .insert({
                id: photoId,
                entreprise_id: entrepriseId,
                chantier_id: params.chantierId,
                type: params.type,
                titre: cleanTitre,
                description: params.description?.trim() || null,
                localisation: params.localisation?.trim() || null,
                storage_path: filePath,
                url: publicUrl,
                date: dateStr,
                heure: heureStr,
                created_by: user.id,
              })
              .select()
              .single();

            if (!insertError && insertedRow) {
              const photo = rowToPhoto(insertedRow as PhotoChantierRow);
              // Mise en cache locale également
              saveLocalPhoto(params.chantierId, photo);
              return photo;
            } else if (insertError) {
              console.error("[photoService] Erreur insert table :", insertError.message);
            }
          }
        }
      }
    } catch (cloudErr) {
      console.warn("[photoService] Exception upload Supabase, bascule locale :", cloudErr);
    }
  }

  // Fallback local (mock ou hors-ligne)
  const localPhoto: PhotoChantier = {
    id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    chantierId: params.chantierId,
    type: params.type,
    titre: cleanTitre,
    description: params.description?.trim() || undefined,
    localisation: params.localisation?.trim() || undefined,
    date: dateStr,
    heure: heureStr,
    url: params.dataUrl || "",
    isCustom: true,
  };

  saveLocalPhoto(params.chantierId, localPhoto);
  return localPhoto;
}

/**
 * Supprime une photo de Supabase (bucket + table) et du cache local
 */
export async function deletePhotoChantier(
  supabase: SupabaseClient,
  photo: PhotoChantier
): Promise<void> {
  // Suppression locale
  removeLocalPhoto(photo.chantierId, photo.id);

  if (isUuid(photo.chantierId) && photo.storagePath) {
    try {
      // Suppression du fichier dans le Storage
      await supabase.storage.from(STORAGE_BUCKET).remove([photo.storagePath]);

      // Suppression de la ligne en base
      await (supabase.from("photos_chantiers") as any).delete().eq("id", photo.id);
    } catch (err) {
      console.error("[photoService] Erreur suppression cloud :", err);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers Cache Local (localStorage)
// ---------------------------------------------------------------------------

function getStorageKey(chantierId: string): string {
  return `bna_photos_chantier_${chantierId}`;
}

export function getLocalPhotos(chantierId: string): PhotoChantier[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(chantierId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore error
  }
  return [];
}

export function saveLocalPhotosList(chantierId: string, photos: PhotoChantier[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(chantierId), JSON.stringify(photos));
  } catch {
    // Quota exceeded possible
  }
}

function saveLocalPhoto(chantierId: string, photo: PhotoChantier): void {
  const existing = getLocalPhotos(chantierId);
  const updated = [photo, ...existing.filter((p) => p.id !== photo.id)];
  saveLocalPhotosList(chantierId, updated);
}

function removeLocalPhoto(chantierId: string, photoId: string): void {
  const existing = getLocalPhotos(chantierId);
  const updated = existing.filter((p) => p.id !== photoId);
  saveLocalPhotosList(chantierId, updated);
}
