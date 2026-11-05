import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { creerFactureDepuisDevis } from "./devisFinanceService.ts";
import type { DevisItem, FactureItem } from "./devisFinanceService.ts";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type TestLine = { id: string; designation: string; qte: number; pu_ht: number; unite: string; tva_pct: 20 };
type StoredInvoice = {
  id: string;
  type: "ACOMPTE" | "SITUATION" | "SOLDE";
  statut: "EMISE" | "BROUILLON" | "ANNULEE";
  lines: { devis_ligne_id: string; quantite: string }[];
};

const devisFixture = (lignes: TestLine[]): DevisItem => ({
  id: "devis-1", numero: "DEVIS-1", client_id: "client-1", entreprise_id: "entreprise-1",
  chantier_nom: "Chantier", client_nom: "Client", ville: "Paris", metier: "cloture", objet: "Travaux",
  statut: "signe", date_creation: "2026-01-01", date_validite: "2026-02-01", tva_pct: 20,
  acompte_pct: 30, retenue_garantie_pct: 0, lignes: lignes.map((line) => ({ ...line, pu_revient: 0, type_cout: "matiere" })),
});

function factureRow(invoice: StoredInvoice) {
  return {
    id: invoice.id, numero: invoice.id, entreprise_id: "entreprise-1", client_id: "client-1", devis_id: "devis-1",
    chantier_id: null, statut: invoice.statut, type: invoice.type, date_emission: "2026-01-01", date_echeance: "2099-01-01",
    contract_ref: null, objet: "Facture test", avancement_pct: null, retenue_garantie_pct: 0,
    total_ht: 0, total_tva: 0, total_ttc: 0, montant_retenue_ttc: 0,
  };
}

function createFinanceMock(initial: StoredInvoice[] = []) {
  const invoices = [...initial];
  let invoiceSequence = 0;
  const payloads: Record<string, unknown>[][] = [];
  const supabase = {
    from(table: string) {
      const query = {
        select() { return query; },
        order: async () => ({ data: invoices.map(factureRow), error: null }),
        in: async (_column: string, ids: string[]) => ({
          data: table === "facture_lignes"
            ? invoices.filter((invoice) => ids.includes(invoice.id)).flatMap((invoice) => invoice.lines.map((line) => ({
              id: `${invoice.id}-${line.devis_ligne_id}`, facture_id: invoice.id, devis_ligne_id: line.devis_ligne_id,
              quantite: line.quantite, taux_tva: 20,
            })))
            : [],
          error: null,
        }),
      };
      return query;
    },
    async rpc(_name: string, args: { p_payload: Record<string, unknown> }) {
      payloads.push(args.p_payload.lignes as Record<string, unknown>[]);
      const id = `issued-${++invoiceSequence}`;
      invoices.push({
        id, type: args.p_payload.type as StoredInvoice["type"], statut: "EMISE",
        lines: (args.p_payload.lignes as { devis_ligne_id: string; quantite: string }[]).map((line) => ({
          devis_ligne_id: line.devis_ligne_id, quantite: line.quantite,
        })),
      });
      return { data: id, error: null };
    },
  } as unknown as SupabaseClient<Database>;
  return { supabase, payloads };
}

function quantities(payload: Record<string, unknown>[]) {
  return Object.fromEntries(payload.map((line) => [line.devis_ligne_id, line.quantite]));
}

function quantiteMicro(value: unknown): bigint {
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

test("les RPC valident séparément les formes invalides de lignes avant toute longueur/itération", async () => {
  const migration = await readFile(new URL("../../../supabase/migrations/20261105101502_socle_financier_phase1.sql", import.meta.url), "utf8");
  const functions = ["creer_devis_financier", "emettre_facture_financiere", "emettre_avoir_financier"];
  for (const functionName of functions) {
    const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`);
    assert.notEqual(start, -1, `${functionName} présente dans la migration`);
    const end = migration.indexOf("$$;", start);
    const body = migration.slice(start, end);
    const guards = [
      "IF p_payload IS NULL THEN RAISE EXCEPTION 'PAYLOAD_SQL_NULL'",
      "IF NOT (p_payload ? 'lignes') THEN RAISE EXCEPTION 'LIGNES_ABSENTES'",
      "IF p_payload->'lignes' = 'null'::jsonb THEN RAISE EXCEPTION 'LIGNES_NULL'",
      "IF jsonb_typeof(p_payload->'lignes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'LIGNES_FORMAT_INVALIDE'",
      "IF jsonb_array_length(p_payload->'lignes') = 0 THEN RAISE EXCEPTION",
    ];
    const positions = guards.map((guard) => {
      const position = body.indexOf(guard);
      assert.notEqual(position, -1, `${functionName}: garde présente: ${guard}`);
      return position;
    });
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b), `${functionName}: gardes ordonnées avant l'usage du tableau`);
    assert.ok(body.indexOf("jsonb_array_elements(p_payload->'lignes')") > positions[4], `${functionName}: tableau valide parcouru après les gardes`);
  }
});

test("un acompte de 30 % puis une situation à 65 % facture 35 % supplémentaires par ligne", async () => {
  const { supabase, payloads } = createFinanceMock();
  const devis = devisFixture([
    { id: "ligne-a", designation: "Matériaux", qte: 10, pu_ht: 400, unite: "u", tva_pct: 20 },
    { id: "ligne-b", designation: "Pose", qte: 20, pu_ht: 300, unite: "h", tva_pct: 20 },
  ]);
  await creerFactureDepuisDevis(supabase, devis, "acompte");
  await creerFactureDepuisDevis(supabase, devis, "situation", 65);
  assert.deepEqual(quantities(payloads[0]), { "ligne-a": "3", "ligne-b": "6" });
  assert.deepEqual(quantities(payloads[1]), { "ligne-a": "3.5", "ligne-b": "7" });
  assert.equal(Number(payloads[0][0].prix_unitaire_ht) * Number(payloads[0][0].quantite) + Number(payloads[0][1].prix_unitaire_ht) * Number(payloads[0][1].quantite), 3000);
  assert.equal(Number(payloads[1][0].prix_unitaire_ht) * Number(payloads[1][0].quantite) + Number(payloads[1][1].prix_unitaire_ht) * Number(payloads[1][1].quantite), 3500);
});

test("deux situations successives à 65 % puis 80 % ne facturent que l'incrément de 15 %", async () => {
  const { supabase, payloads } = createFinanceMock();
  const devis = devisFixture([{ id: "ligne-a", designation: "Ouvrage", qte: 10, pu_ht: 100, unite: "u", tva_pct: 20 }]);
  await creerFactureDepuisDevis(supabase, devis, "acompte");
  await creerFactureDepuisDevis(supabase, devis, "situation", 65);
  await creerFactureDepuisDevis(supabase, devis, "situation", 80);
  assert.deepEqual(quantities(payloads[2]), { "ligne-a": "1.5" });
  assert.equal(quantiteMicro(payloads[0][0].quantite) + quantiteMicro(payloads[1][0].quantite) + quantiteMicro(payloads[2][0].quantite), 8_000_000n);
});

test("le solde retranche acompte et situations et garde le calcul ligne par ligne", async () => {
  const { supabase, payloads } = createFinanceMock();
  const devis = devisFixture([
    { id: "petite", designation: "Petit ouvrage", qte: 3, pu_ht: 125.5, unite: "u", tva_pct: 20 },
    { id: "grande", designation: "Grand ouvrage", qte: 8, pu_ht: 700, unite: "m", tva_pct: 20 },
  ]);
  await creerFactureDepuisDevis(supabase, devis, "acompte");
  await creerFactureDepuisDevis(supabase, devis, "situation", 65);
  await creerFactureDepuisDevis(supabase, devis, "solde");
  assert.deepEqual(quantities(payloads[2]), { petite: "1.05", grande: "2.8" });
  assert.equal(quantiteMicro(payloads[0][0].quantite) + quantiteMicro(payloads[1][0].quantite) + quantiteMicro(payloads[2][0].quantite), 3_000_000n);
  assert.equal(quantiteMicro(payloads[0][1].quantite) + quantiteMicro(payloads[1][1].quantite) + quantiteMicro(payloads[2][1].quantite), 8_000_000n);
});

test("les situations ignorent les brouillons et annulations, omettent les lignes déjà soldées et refusent plus de 100 %", async () => {
  const { supabase, payloads } = createFinanceMock([
    { id: "draft", type: "ACOMPTE", statut: "BROUILLON", lines: [{ devis_ligne_id: "ouverte", quantite: "2" }] },
    { id: "cancelled", type: "SITUATION", statut: "ANNULEE", lines: [{ devis_ligne_id: "ouverte", quantite: "2" }] },
    { id: "paid", type: "ACOMPTE", statut: "EMISE", lines: [{ devis_ligne_id: "terminee", quantite: "5" }] },
  ]);
  const devis = devisFixture([
    { id: "ouverte", designation: "À facturer", qte: 10, pu_ht: 50, unite: "u", tva_pct: 20 },
    { id: "terminee", designation: "Déjà facturée", qte: 5, pu_ht: 80, unite: "u", tva_pct: 20 },
  ]);
  await creerFactureDepuisDevis(supabase, devis, "situation", 65);
  assert.deepEqual(quantities(payloads[0]), { ouverte: "6.5" });
  await assert.rejects(() => creerFactureDepuisDevis(supabase, devis, "situation", 101), /entre 0 et 100/);
  assert.equal(payloads.length, 1, "aucun RPC n'est appelé pour un avancement invalide");
});
