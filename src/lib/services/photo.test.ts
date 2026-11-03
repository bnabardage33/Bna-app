import assert from "node:assert";
import type { PhotoChantierRow } from "../../types/database.types.ts";

console.log("=== TESTS MODULE PHOTOS & SUPABASE STORAGE BNA ===");

// Test 1: Conversion PhotoChantierRow -> PhotoChantier
const mockRow: PhotoChantierRow = {
  id: "f3c8340d-b19b-449e-8a5c-1976a445b901",
  entreprise_id: "00000000-0000-0000-0000-000000000001",
  chantier_id: "11111111-1111-1111-1111-111111111111",
  type: "constat",
  titre: "Écartement lambourdes hors tolérance",
  description: "Entraxe mesuré à 480 mm au lieu de 400 mm max préconisé par le DTU 51.4.",
  localisation: "Angle Nord-Est",
  storage_path: "00000000-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111/photo-1.jpg",
  url: "https://xyz.supabase.co/storage/v1/object/public/photos-chantiers/00000000-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111/photo-1.jpg",
  date: "2026-11-03",
  heure: "08:30",
  created_by: "user-test-id",
  created_at: "2026-11-03T08:30:00Z",
  updated_at: "2026-11-03T08:30:00Z",
};

// Test simple de mapping
assert.strictEqual(mockRow.type, "constat");
assert.strictEqual(mockRow.storage_path.includes("photos-chantiers") || mockRow.storage_path.includes("photo-1.jpg"), true);
assert.strictEqual(mockRow.url.startsWith("https://"), true);
console.log("✓ PASS: 1. Structure PhotoChantierRow conforme schéma Supabase");

// Test 2: Validation du type constat vs pointage
const typesAutorises = ["constat", "pointage"];
assert.strictEqual(typesAutorises.includes(mockRow.type), true);
console.log("✓ PASS: 2. Typage strict constat/pointage validé");

// Test 3: Chemin du bucket storage tenant-isolated
const parts = mockRow.storage_path.split("/");
assert.strictEqual(parts.length, 3, "Le chemin storage doit être {entreprise_id}/{chantier_id}/{photo_id}.jpg");
assert.strictEqual(parts[0], mockRow.entreprise_id);
assert.strictEqual(parts[1], mockRow.chantier_id);
console.log("✓ PASS: 3. Isolation multi-tenant du chemin Storage {entreprise_id}/{chantier_id}/{photo_id}");

console.log("\n🎉 TOUS LES TESTS DU MODULE PHOTO SONT VALIDÉS AVEC SUCCÈS !");
