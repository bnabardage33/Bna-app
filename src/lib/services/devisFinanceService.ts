/**
 * BNA-APP — Service Devis, Factures, Situations d'Avancement & Rentabilité Chantier
 * Rapatrié et adapté depuis bna-dashboard (devisCalcul.ts, financeCalculs.ts, retenueCalculs.ts)
 *
 * Invariants financiers :
 * - Calcul au centime près (arrondi half-up déterministe).
 * - Multi-TVA supportée (10% rénovation > 2 ans, 20% neuf/clôture, 5.5% ITE, 0% autoliquidation).
 * - Retenue de Garantie BTP conforme à la Loi n° 71-584 (plafond légal 5,00 %).
 * - Séparation Matière / Main-d'œuvre pour le calcul de la marge brute réelle.
 * - Passerelle directe depuis les versions de Calepinage (Terrasse, Bardage, Clôture).
 */

import type { MetierType } from "@/types/metier";
import type { AvoirFinanceRow, AvoirLigneFinanceRow, BesoinMateriauRow, CreditNoteInvoiceRow, Database, DevisFinanceRow, DevisLigneFinanceRow, FactureFinanceRow, FactureLigneFinanceRow } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TauxTvaBtp = 20 | 10 | 5.5 | 0;
export type CoutType = "matiere" | "main_oeuvre";
export type StatutDevis = "brouillon" | "envoye" | "signe" | "refuse" | "annule";
export type StatutFacture = "brouillon" | "emise" | "partiellement_payee" | "payee" | "en_retard" | "annulee";
export type TypeFacture = "acompte" | "situation" | "solde";

export interface LigneChiffrage {
  id: string;
  designation: string;
  description?: string;
  qte: number;
  unite: string;
  pu_ht: number;
  pu_revient: number;
  type_cout: CoutType;
  tva_pct?: TauxTvaBtp;
  a_chiffrer?: boolean;
}

export interface CalculDevisResult {
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  cout_matiere_ht: number;
  cout_main_oeuvre_ht: number;
  cout_total_ht: number;
  marge_ht: number;
  marge_pct: number;
  acompte_ttc: number;
  alerte_marge_faible: boolean;
}

export interface DevisItem {
  id: string;
  numero: string;
  client_id: string;
  entreprise_id: string;
  chantier_id?: string;
  chantier_nom: string;
  client_nom: string;
  ville: string;
  metier: MetierType;
  objet: string;
  statut: StatutDevis;
  date_creation: string;
  date_validite: string;
  tva_pct: TauxTvaBtp;
  acompte_pct: number;
  retenue_garantie_pct: number;
  lignes: LigneChiffrage[];
  notes?: string;
  calepinage_version_numero?: number;
}

export interface FactureItem {
  id: string;
  numero: string;
  devis_id?: string;
  devis_numero?: string;
  chantier_id?: string;
  chantier_nom: string;
  client_nom: string;
  type: TypeFacture;
  statut: StatutFacture;
  date_emission: string;
  date_echeance: string;
  contract_ref?: string;
  tva_pct: TauxTvaBtp;
  retenue_garantie_pct: number;
  avancement_pct?: number;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  montant_retenue_ttc: number;
  net_a_payer_ttc: number;
  objet: string;
  lignes: FactureLigneFinanceRow[];
}

export interface AvoirItem extends AvoirFinanceRow {
  lignes: AvoirLigneFinanceRow[];
  factures_rattachees: CreditNoteInvoiceRow[];
}

export interface BilanFinancierGlobal {
  ca_signe_ht: number;
  ca_signe_ttc: number;
  pipeline_en_attente_ht: number;
  ca_facture_ht: number;
  encaisse_ttc: number;
  en_attente_encaissement_ttc: number;
  en_retard_ttc: number;
  nb_factures_retard: number;
  reste_a_facturer_ht: number;
  retenues_garantie_cumulees_ttc: number;
  marge_globale_signee_ht: number;
  taux_marge_moyen_pct: number;
}

/**
 * Arrondi monétaire déterministe au centime le plus proche (half-up)
 */
function decimalToScaledInt(value: number | string, scale: number): bigint {
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Montant non fini");
  let source = String(value).trim();
  const exponentMatch = /^([+-]?\d+(?:\.\d+)?)[eE]([+-]?\d+)$/.exec(source);
  if (exponentMatch) {
    const base = exponentMatch[1];
    const exponent = Number(exponentMatch[2]);
    const negative = base.startsWith("-");
    const unsigned = base.replace(/^[+-]/, "");
    const [whole, fraction = ""] = unsigned.split(".");
    const digits = whole + fraction;
    const point = whole.length + exponent;
    source = `${negative ? "-" : ""}${point <= 0 ? `0.${"0".repeat(-point)}${digits}` : point >= digits.length ? `${digits}${"0".repeat(point - digits.length)}` : `${digits.slice(0, point)}.${digits.slice(point)}`}`;
  }
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(source);
  if (!match) throw new Error(`Nombre décimal invalide: ${source}`);
  const sign = match[1] === "-" ? -1n : 1n;
  const decimals = match[3] ?? "";
  const kept = decimals.slice(0, scale).padEnd(scale, "0");
  const discarded = decimals.slice(scale);
  if (discarded && /[1-9]/.test(discarded)) throw new Error(`Précision supérieure à ${scale} décimales`);
  const factor = 10n ** BigInt(scale);
  return sign * (BigInt(match[2]) * factor + BigInt(kept || "0"));
}

function decimalToRoundedInt(value: number, scale: number): bigint {
  if (!Number.isFinite(value)) throw new Error("Montant non fini");
  let source = String(value);
  const exponentMatch = /^([+-]?\d+(?:\.\d+)?)[eE]([+-]?\d+)$/.exec(source);
  if (exponentMatch) {
    const base = exponentMatch[1];
    const exponent = Number(exponentMatch[2]);
    const negative = base.startsWith("-");
    const unsigned = base.replace(/^[+-]/, "");
    const [whole, fraction = ""] = unsigned.split(".");
    const digits = whole + fraction;
    const point = whole.length + exponent;
    source = `${negative ? "-" : ""}${point <= 0 ? `0.${"0".repeat(-point)}${digits}` : point >= digits.length ? `${digits}${"0".repeat(point - digits.length)}` : `${digits.slice(0, point)}.${digits.slice(point)}`}`;
  }
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(source);
  if (!match) throw new Error("Nombre décimal invalide");
  const sign = match[1] === "-" ? -1n : 1n;
  const fraction = match[3] ?? "";
  const kept = fraction.slice(0, scale).padEnd(scale, "0");
  const dropped = fraction.slice(scale);
  let magnitude = BigInt(match[2]) * 10n ** BigInt(scale) + BigInt(kept || "0");
  if (dropped[0] && dropped[0] >= "5") magnitude += 1n;
  return sign * magnitude;
}

function decimalDepuisEchelle(value: bigint, scale: number): string {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const factor = 10n ** BigInt(scale);
  const whole = magnitude / factor;
  const fraction = (magnitude % factor).toString().padStart(scale, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function roundHalfUpDiv(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n) return -roundHalfUpDiv(-numerator, denominator);
  return (numerator + denominator / 2n) / denominator;
}

function quantiteDecimal6(value: number): string {
  return decimalDepuisEchelle(decimalToRoundedInt(value, 6), 6);
}

function quantiteCibleMicro(qteMicro: bigint, pourcentage: number): bigint {
  const pourcentageMicro = decimalToRoundedInt(pourcentage, 6);
  return roundHalfUpDiv(qteMicro * pourcentageMicro, 100_000_000n);
}

export function calculerLigneMonetaireExact(
  quantite: number | string,
  prixUnitaireHt: number | string,
  tauxTva: number | string
): { ht_cents: bigint; tva_cents: bigint; ttc_cents: bigint } {
  const qMicro = decimalToScaledInt(quantite, 6);
  const puMicro = decimalToScaledInt(prixUnitaireHt, 6);
  const rateBp = decimalToScaledInt(tauxTva, 2);
  if (qMicro < 0n || puMicro < 0n || rateBp < 0n) throw new Error("Valeur monétaire négative");
  if (![0n, 550n, 1000n, 2000n].includes(rateBp)) throw new Error("Taux non supporté par le moteur");
  const htCents = (qMicro * puMicro + 5_000_000_000n) / 10_000_000_000n;
  const tvaCents = (htCents * rateBp + 5_000n) / 10_000n;
  return { ht_cents: htCents, tva_cents: tvaCents, ttc_cents: htCents + tvaCents };
}

export function montantHtLigneExact(qte: number, prixUnitaireHt: number, tauxTva: number): number {
  return Number(calculerLigneMonetaireExact(qte, prixUnitaireHt, tauxTva).ht_cents) / 100;
}

export function arrondirCentimes(montant: number): number {
  const cents = decimalToRoundedInt(montant, 2);
  return Number(cents) / 100;
}

function montantDepuisCentimes(cents: bigint): number {
  return Number(cents) / 100;
}

/**
 * Formatage monétaire EUR fr-FR
 */
export function fmtEuro(montant?: number | null): string {
  if (montant === null || montant === undefined || Number.isNaN(montant)) {
    return "0,00 €";
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(montant);
}

/**
 * Validation du plafond légal de la retenue de garantie (Loi n° 71-584 : max 5%)
 */
export function validerTauxRetenue(taux: number | undefined | null): number {
  if (taux === undefined || taux === null) return 0;
  if (!Number.isFinite(taux)) throw new Error("Taux de retenue non fini");
  if (taux < 0) return 0;
  if (taux > 5) return 5;
  return arrondirCentimes(taux);
}

/**
 * Calcule l'intégralité des totaux, coûts et marges d'un devis
 */
export function calculerDevis(
  lignes: LigneChiffrage[],
  tvaDefautPct: TauxTvaBtp = 10,
  acomptePct: number = 30
): CalculDevisResult {
  let totalHtCents = 0n;
  let totalTvaCents = 0n;
  let coutMatiereCents = 0n;
  let coutMainOeuvreCents = 0n;

  for (const l of lignes) {
    if (l.a_chiffrer) continue;
    const qte = Number(l.qte);
    const puHt = Number(l.pu_ht);
    const puRevient = Number(l.pu_revient);
    if (![qte, puHt, puRevient].every(Number.isFinite)) throw new Error("Quantité ou prix non fini");
    if (qte < 0 || puHt < 0 || puRevient < 0) throw new Error("Quantité ou prix négatif");
    const tvaLigne = l.tva_pct !== undefined ? l.tva_pct : tvaDefautPct;

    const lineMoney = calculerLigneMonetaireExact(qte, puHt, tvaLigne);
    const coutCents = calculerLigneMonetaireExact(qte, puRevient, 0).ht_cents;
    totalHtCents += lineMoney.ht_cents;
    totalTvaCents += lineMoney.tva_cents;

    if (l.type_cout === "main_oeuvre") {
      coutMainOeuvreCents += coutCents;
    } else {
      coutMatiereCents += coutCents;
    }
  }

  const totalTtcCents = totalHtCents + totalTvaCents;
  const coutTotalCents = coutMatiereCents + coutMainOeuvreCents;
  const margeCents = totalHtCents - coutTotalCents;
  if (!Number.isFinite(acomptePct)) throw new Error("Pourcentage d'acompte non fini");
  const acompteBp = decimalToRoundedInt(Math.max(0, Math.min(100, acomptePct)), 2);
  const acompteCents = roundHalfUpDiv(totalTtcCents * acompteBp, 10_000n);
  const margePercentHundredths = totalHtCents > 0n ? roundHalfUpDiv(margeCents * 10_000n, totalHtCents) : 0n;
  const total_ht = montantDepuisCentimes(totalHtCents);
  const total_tva = montantDepuisCentimes(totalTvaCents);
  const total_ttc = montantDepuisCentimes(totalTtcCents);
  const cout_matiere_ht = montantDepuisCentimes(coutMatiereCents);
  const cout_main_oeuvre_ht = montantDepuisCentimes(coutMainOeuvreCents);
  const cout_total_ht = montantDepuisCentimes(coutTotalCents);
  const marge_ht = montantDepuisCentimes(margeCents);
  const marge_pct = Number(margePercentHundredths) / 100;
  const acompte_ttc = montantDepuisCentimes(acompteCents);

  return {
    total_ht,
    total_tva,
    total_ttc,
    cout_matiere_ht,
    cout_main_oeuvre_ht,
    cout_total_ht,
    marge_ht,
    marge_pct,
    acompte_ttc,
    alerte_marge_faible: total_ht > 0 && marge_pct < 25,
  };
}

/**
 * Calcule une facture (acompte, situation d'avancement ou solde) avec retenue de garantie (Loi 71-584)
 */
export function calculerMontantsFacture(
  montantBaseHt: number,
  tvaPct: TauxTvaBtp = 10,
  retenueGarantiePct: number = 0
): {
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  montant_retenue_ttc: number;
  net_a_payer_ttc: number;
} {
  const retenue = validerTauxRetenue(retenueGarantiePct);
  const baseCents = calculerLigneMonetaireExact(1, Math.max(0, montantBaseHt), tvaPct);
  const montant_ht = montantDepuisCentimes(baseCents.ht_cents);
  const montant_tva = montantDepuisCentimes(baseCents.tva_cents);
  const montant_ttc = montantDepuisCentimes(baseCents.ttc_cents);
  const retenueBp = decimalToScaledInt(retenue, 2);
  const retenueCents = roundHalfUpDiv(baseCents.ttc_cents * retenueBp, 10_000n);
  const montant_retenue_ttc = montantDepuisCentimes(retenueCents);
  const net_a_payer_ttc = montantDepuisCentimes(baseCents.ttc_cents - retenueCents);

  return {
    montant_ht,
    montant_tva,
    montant_ttc,
    montant_retenue_ttc,
    net_a_payer_ttc,
  };
}

/**
 * Convertit les besoins matériaux d'un Calepinage BNA en lignes de devis chiffrées (Fourniture + Pose)
 */
export function importerBesoinsCalepinageEnLignesDevis(
  besoins: BesoinMateriauRow[],
  metier: MetierType = "terrasse"
): LigneChiffrage[] {
  const lignes: LigneChiffrage[] = [];

  // 1. Lignes matériaux issues du quantitatif déterministe
  for (const item of besoins) {
    let puVente = 28;
    let puRevient = 17;
    const lowerLabel = item.designation.toLowerCase();

    if (lowerLabel.includes("lame") || lowerLabel.includes("plaque") || lowerLabel.includes("clin") || lowerLabel.includes("cassette")) {
      puVente = 48;
      puRevient = 31;
    } else if (lowerLabel.includes("lambourde") || lowerLabel.includes("chevron") || lowerLabel.includes("montant") || lowerLabel.includes("poteau")) {
      puVente = 19;
      puRevient = 11.5;
    } else if (lowerLabel.includes("plot")) {
      puVente = 4.9;
      puRevient = 2.8;
    } else if (lowerLabel.includes("vis") || lowerLabel.includes("fixation") || lowerLabel.includes("clip") || lowerLabel.includes("cheville")) {
      puVente = 0.35;
      puRevient = 0.18;
    } else if (lowerLabel.includes("pare-pluie") || lowerLabel.includes("epdm") || lowerLabel.includes("grille")) {
      puVente = 18;
      puRevient = 11;
    }

    lignes.push({
      id: `lig-mat-${item.id}-${Date.now()}`,
      designation: `Fourniture — ${item.designation}`,
      description: `Quantitatif certifié Calepinage BNA (${item.categorie})`,
      qte: Number(item.quantite) || 1,
      unite: item.unite,
      pu_ht: puVente,
      pu_revient: puRevient,
      type_cout: "matiere",
    });
  }

  // 2. Ligne de Main d'œuvre de pose selon le métier
  const qtePrincipale = 35;
  const unitePrincipale = metier === "cloture" ? "ml" : "m²";
  const labelMetier =
    metier === "facade"
      ? "Pose complète Bardage & Ossature (conforme NF DTU 41.2 / 45.4)"
      : metier === "cloture"
      ? "Implantation, scellement poteaux et pose Clôture (NF P98-405)"
      : "Pose structure lambourdes sur plots et platelage Terrasse (NF DTU 51.4)";

  const puPoseVente = metier === "facade" ? 78 : metier === "cloture" ? 55 : 68;
  const puPoseRevient = metier === "facade" ? 42 : metier === "cloture" ? 30 : 38;

  lignes.push({
    id: `lig-mo-${Date.now()}`,
    designation: labelMetier,
    description: `Main d'œuvre qualifiée BNA`,
    qte: qtePrincipale,
    unite: unitePrincipale,
    pu_ht: puPoseVente,
    pu_revient: puPoseRevient,
    type_cout: "main_oeuvre",
  });

  return lignes;
}

/**
 * Données initiales BNA réalistes (connectées aux chantiers Martin, Dupont, Bernard)
 */
function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function localDatePlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function mapDevisRow(row: DevisFinanceRow, lines: DevisLigneFinanceRow[], clientNom: string, chantierNom: string, ville: string): DevisItem {
  const lineItems: LigneChiffrage[] = lines.map((line) => ({
    id: line.id, designation: line.designation, description: line.description ?? undefined,
    qte: Number(line.quantite), unite: line.unite, pu_ht: Number(line.prix_unitaire_ht),
    pu_revient: Number(line.prix_revient_ht), type_cout: line.type_cout,
    tva_pct: Number(line.taux_tva) as TauxTvaBtp,
  }));
  const firstRate = lineItems[0]?.tva_pct ?? 0;
  return {
    id: row.id, numero: row.numero ?? "BROUILLON", entreprise_id: row.entreprise_id, client_id: row.client_id,
    chantier_id: row.chantier_id ?? undefined, chantier_nom: chantierNom, client_nom: clientNom, ville,
    metier: row.metier, objet: row.objet, statut: row.statut.toLowerCase() as StatutDevis,
    date_creation: row.date_creation, date_validite: row.date_validite, tva_pct: firstRate,
    acompte_pct: Number(row.acompte_pct), retenue_garantie_pct: Number(row.retenue_garantie_pct),
    lignes: lineItems, notes: row.notes ?? undefined,
  };
}

export async function getDevisList(supabase: SupabaseClient<Database>): Promise<DevisItem[]> {
  const { data: rows, error } = await supabase.from("devis").select("*").order("date_creation", { ascending: false });
  throwOnError(error);
  if (!rows?.length) return [];
  const ids = rows.map((row) => row.id);
  const clientIds = [...new Set(rows.map((row) => row.client_id))];
  const chantierIds = [...new Set(rows.map((row) => row.chantier_id).filter((id): id is string => !!id))];
  const [lineResult, clientResult, chantierResult] = await Promise.all([
    supabase.from("devis_lignes").select("*").in("devis_id", ids),
    supabase.from("clients").select("id,nom,prenom,societe,ville").in("id", clientIds),
    chantierIds.length ? supabase.from("chantiers").select("id,nom,ville").in("id", chantierIds) : Promise.resolve({ data: [], error: null }),
  ]);
  throwOnError(lineResult.error); throwOnError(clientResult.error); throwOnError(chantierResult.error);
  const clients = new Map((clientResult.data ?? []).map((row) => [row.id, row]));
  const chantiersById = new Map((chantierResult.data ?? []).map((row) => [row.id, row]));
  const lines = lineResult.data ?? [];
  return rows.map((row) => {
    const client = clients.get(row.client_id);
    const chantier = row.chantier_id ? chantiersById.get(row.chantier_id) : undefined;
    const label = client?.societe || [client?.prenom, client?.nom].filter(Boolean).join(" ") || "Client";
    return mapDevisRow(row, lines.filter((line) => line.devis_id === row.id), label, chantier?.nom ?? "", chantier?.ville ?? client?.ville ?? "");
  });
}

export async function creerNouveauDevis(
  supabase: SupabaseClient<Database>,
  input: Omit<DevisItem, "id" | "numero" | "date_creation" | "date_validite" | "entreprise_id">
): Promise<DevisItem> {
  const payload = {
    client_id: input.client_id,
    chantier_id: input.chantier_id ?? null,
    date_validite: localDatePlusDays(30),
    objet: input.objet,
    metier: input.metier,
    acompte_pct: input.acompte_pct,
    retenue_garantie_pct: input.retenue_garantie_pct,
    notes: input.notes ?? null,
    lignes: input.lignes.filter((line) => !line.a_chiffrer).map((line) => ({
      designation: line.designation, description: line.description ?? null, quantite: quantiteDecimal6(line.qte),
      unite: line.unite, prix_unitaire_ht: quantiteDecimal6(line.pu_ht), prix_revient_ht: quantiteDecimal6(line.pu_revient),
      taux_tva: String(line.tva_pct ?? input.tva_pct), type_cout: line.type_cout,
    })),
  };
  const { data: id, error } = await supabase.rpc("creer_devis_financier", { p_payload: payload });
  throwOnError(error);
  const devis = await getDevisList(supabase);
  const created = devis.find((item) => item.id === id);
  if (!created) throw new Error("Devis créé mais introuvable après relecture");
  return created;
}

export async function updateStatutDevis(supabase: SupabaseClient<Database>, id: string, statut: StatutDevis): Promise<DevisItem[]> {
  if (statut !== "signe") throw new Error("Seule la transition ENVOYE → SIGNE est exposée");
  const { error } = await supabase.rpc("marquer_devis_signe", { p_devis_id: id });
  throwOnError(error);
  return getDevisList(supabase);
}

export async function supprimerDevis(supabase: SupabaseClient<Database>, id: string): Promise<DevisItem[]> {
  const { error } = await supabase.rpc("supprimer_devis_brouillon", { p_devis_id: id });
  throwOnError(error);
  return getDevisList(supabase);
}

function mapFactureRow(row: FactureFinanceRow, lines: FactureLigneFinanceRow[], clientNom: string, chantierNom: string, devisNumero?: string): FactureItem {
  const today = localDatePlusDays(0);
  const status: StatutFacture = row.statut === "PAYEE" ? "payee" :
    row.statut === "PARTIELLEMENT_PAYEE" ? "partiellement_payee" :
    row.statut === "ANNULEE" ? "annulee" :
    row.statut === "BROUILLON" ? "brouillon" :
    row.date_echeance && row.date_echeance < today ? "en_retard" : "emise";
  const totalTtc = Number(row.total_ttc);
  const retenue = Number(row.montant_retenue_ttc);
  return {
    id: row.id, numero: row.numero ?? "", devis_id: row.devis_id ?? undefined, devis_numero: devisNumero,
    chantier_id: row.chantier_id ?? undefined, chantier_nom: chantierNom, client_nom: clientNom,
    type: row.type.toLowerCase() as TypeFacture, statut: status, date_emission: row.date_emission ?? "",
    contract_ref: row.contract_ref ?? undefined,
    date_echeance: row.date_echeance ?? "", tva_pct: (Number(lines[0]?.taux_tva ?? 0)) as TauxTvaBtp,
    retenue_garantie_pct: Number(row.retenue_garantie_pct), avancement_pct: row.avancement_pct ?? undefined,
    montant_ht: Number(row.total_ht), montant_tva: Number(row.total_tva), montant_ttc: totalTtc,
    montant_retenue_ttc: retenue, net_a_payer_ttc: arrondirCentimes(totalTtc - retenue), objet: row.objet, lignes: lines,
  };
}

export async function getFacturesList(supabase: SupabaseClient<Database>): Promise<FactureItem[]> {
  const { data: rows, error } = await supabase.from("factures").select("*").order("date_emission", { ascending: false });
  throwOnError(error);
  if (!rows?.length) return [];
  const ids = rows.map((row) => row.id);
  const clientIds = [...new Set(rows.map((row) => row.client_id))];
  const chantierIds = [...new Set(rows.map((row) => row.chantier_id).filter((id): id is string => !!id))];
  const devisIds = [...new Set(rows.map((row) => row.devis_id).filter((id): id is string => !!id))];
  const [lineResult, clientResult, chantierResult, devisResult] = await Promise.all([
    supabase.from("facture_lignes").select("*").in("facture_id", ids),
    supabase.from("clients").select("id,nom,prenom,societe").in("id", clientIds),
    chantierIds.length ? supabase.from("chantiers").select("id,nom").in("id", chantierIds) : Promise.resolve({ data: [], error: null }),
    devisIds.length ? supabase.from("devis").select("id,numero").in("id", devisIds) : Promise.resolve({ data: [], error: null }),
  ]);
  throwOnError(lineResult.error); throwOnError(clientResult.error); throwOnError(chantierResult.error); throwOnError(devisResult.error);
  const clients = new Map((clientResult.data ?? []).map((row) => [row.id, row]));
  const chantiersById = new Map((chantierResult.data ?? []).map((row) => [row.id, row]));
  const devisById = new Map((devisResult.data ?? []).map((row) => [row.id, row.numero ?? undefined]));
  return rows.map((row) => {
    const client = clients.get(row.client_id);
    const chantier = row.chantier_id ? chantiersById.get(row.chantier_id) : undefined;
    const clientNom = client?.societe || [client?.prenom, client?.nom].filter(Boolean).join(" ") || "Client";
    return mapFactureRow(row, (lineResult.data ?? []).filter((line) => line.facture_id === row.id), clientNom, chantier?.nom ?? "", row.devis_id ? devisById.get(row.devis_id) : undefined);
  });
}

export async function creerFactureDepuisDevis(
  supabase: SupabaseClient<Database>, devis: DevisItem, type: TypeFacture, avancementPct = 50, contractRef?: string,
): Promise<FactureItem> {
  const invoices = await getFacturesList(supabase);
  const related = invoices.filter((invoice) => invoice.devis_id === devis.id && invoice.statut !== "annulee" && invoice.statut !== "brouillon");
  if (type === "situation" && (!Number.isFinite(avancementPct) || avancementPct < 0 || avancementPct > 100)) {
    throw new Error("L'avancement cumulé doit être compris entre 0 et 100 %");
  }
  if (type === "acompte" && (!Number.isFinite(devis.acompte_pct) || devis.acompte_pct < 0 || devis.acompte_pct > 100)) {
    throw new Error("Le pourcentage d'acompte doit être compris entre 0 et 100 %");
  }
  const previouslyBilledByLine = new Map<string, bigint>();
  for (const invoice of related) {
    for (const invoiceLine of invoice.lignes) {
      if (!invoiceLine.devis_ligne_id) continue;
      const billedMicro = decimalToScaledInt(invoiceLine.quantite, 6);
      previouslyBilledByLine.set(
        invoiceLine.devis_ligne_id,
        (previouslyBilledByLine.get(invoiceLine.devis_ligne_id) ?? 0n) + billedMicro,
      );
    }
  }
  const applicableRetention = type === "acompte" ? 0 : devis.retenue_garantie_pct;
  const lines = devis.lignes.map((line) => {
    const totalQuantityMicro = decimalToScaledInt(line.qte, 6);
    const previouslyBilledMicro = previouslyBilledByLine.get(line.id) ?? 0n;
    const targetQuantityMicro = type === "solde" ? totalQuantityMicro :
      quantiteCibleMicro(totalQuantityMicro, type === "acompte" ? devis.acompte_pct : avancementPct);
    const quantityMicro = targetQuantityMicro > previouslyBilledMicro
      ? targetQuantityMicro - previouslyBilledMicro
      : 0n;
    return {
      devis_ligne_id: line.id, designation: line.designation, quantite: decimalDepuisEchelle(quantityMicro, 6), unite: line.unite,
      prix_unitaire_ht: quantiteDecimal6(line.pu_ht), taux_tva: String(line.tva_pct ?? devis.tva_pct),
    };
  }).filter((line) => line.quantite !== "0");
  if (!lines.length) throw new Error("Aucun montant restant à facturer pour ce devis");
  const objet = type === "acompte" ? `Facture d'acompte (${devis.acompte_pct}%) — ${devis.chantier_nom}` :
    type === "situation" ? `Situation d'avancement (${avancementPct}% cumulé) — ${devis.chantier_nom}` :
      `Facture de solde — ${devis.chantier_nom}`;
  const { data: id, error } = await supabase.rpc("emettre_facture_financiere", {
    p_payload: {
      client_id: devis.client_id, devis_id: devis.id, chantier_id: devis.chantier_id ?? null,
      type: type.toUpperCase(), objet, avancement_pct: type === "situation" ? avancementPct : null,
      retenue_garantie_pct: applicableRetention, date_echeance: localDatePlusDays(15),
      contract_ref: contractRef?.trim() || null,
      lignes: lines,
    },
  });
  throwOnError(error);
  const created = (await getFacturesList(supabase)).find((item) => item.id === id);
  if (!created) throw new Error("Facture émise mais introuvable après relecture");
  return created;
}

export async function supprimerFacture(_supabase: SupabaseClient<Database>, _id: string): Promise<never> {
  throw new Error("Une facture émise est irrévocable et ne peut pas être supprimée");
}

export interface AvoirLigneInput {
  designation: string;
  quantite: number;
  unite: string;
  prix_unitaire_ht: number;
  taux_tva: TauxTvaBtp;
}

type AvoirInputCommun = { client_id: string; objet: string; lignes: AvoirLigneInput[] };
export type AvoirEmissionInput = AvoirInputCommun & (
  | { scope: "INVOICE"; origin_invoice_id: string }
  | { scope: "GLOBAL"; global_basis: "CONTRACT"; period_start: string; period_end: string; contract_ref: string }
  | { scope: "GLOBAL"; global_basis: "INVOICES"; period_start: string; period_end: string; invoice_ids: string[] }
);

export async function emettreAvoir(supabase: SupabaseClient<Database>, input: AvoirEmissionInput): Promise<string> {
  const lines = input.lignes.map((line) => ({
    designation: line.designation, quantite: quantiteDecimal6(line.quantite), unite: line.unite,
    prix_unitaire_ht: String(line.prix_unitaire_ht), taux_tva: String(line.taux_tva),
  }));
  const payload = {
    ...input,
    lignes: lines,
    ...(input.scope === "GLOBAL" && input.global_basis === "CONTRACT"
      ? { contract_ref: input.contract_ref.trim() }
      : {}),
  };
  const { data, error } = await supabase.rpc("emettre_avoir_financier", { p_payload: payload });
  throwOnError(error);
  if (!data) throw new Error("La RPC n’a pas retourné l’identifiant de l’avoir émis");
  return data;
}

export async function getAvoirsList(supabase: SupabaseClient<Database>): Promise<AvoirItem[]> {
  const { data: rows, error } = await supabase.from("avoirs").select("*").order("date_emission", { ascending: false });
  throwOnError(error);
  if (!rows?.length) return [];
  const ids = rows.map((row) => row.id);
  const [lineResult, linksResult] = await Promise.all([
    supabase.from("avoir_lignes").select("*").in("avoir_id", ids),
    supabase.from("credit_note_invoices").select("*").in("credit_note_id", ids),
  ]);
  throwOnError(lineResult.error); throwOnError(linksResult.error);
  return rows.map((row) => ({
    ...row,
    lignes: (lineResult.data ?? []).filter((line) => line.avoir_id === row.id),
    factures_rattachees: (linksResult.data ?? []).filter((link) => link.credit_note_id === row.id),
  }));
}

export function inspecterDonneesFinancieresLocales(): { devis: string | null; factures: string | null } {
  if (typeof window === "undefined") throw new Error("Inspection disponible uniquement dans le navigateur");
  return {
    devis: window.localStorage.getItem("bna_devis_items_v1"),
    factures: window.localStorage.getItem("bna_factures_items_v1"),
  };
}

export function exporterDonneesFinancieresLocalesJson(): string {
  const existing = inspecterDonneesFinancieresLocales();
  const preserve = (raw: string | null): unknown => {
    if (raw === null) return null;
    try { return JSON.parse(raw) as unknown; } catch { return { raw_non_parse: raw }; }
  };
  return JSON.stringify({
    bna_devis_items_v1: preserve(existing.devis),
    bna_factures_items_v1: preserve(existing.factures),
  }, null, 2);
}

/**
 * Calcule le bilan financier consolidé pour le Dashboard et l'Assistant IA
 */
export function calculerBilanFinancierGlobal(
  devisList: DevisItem[],
  facturesList: FactureItem[]
): BilanFinancierGlobal {
  let ca_signe_ht = 0;
  let ca_signe_ttc = 0;
  let pipeline_en_attente_ht = 0;
  let marge_globale_signee_ht = 0;

  for (const d of devisList) {
    const calc = calculerDevis(d.lignes, d.tva_pct, d.acompte_pct);
    if (d.statut === "signe") {
      ca_signe_ht = arrondirCentimes(ca_signe_ht + calc.total_ht);
      ca_signe_ttc = arrondirCentimes(ca_signe_ttc + calc.total_ttc);
      marge_globale_signee_ht = arrondirCentimes(marge_globale_signee_ht + calc.marge_ht);
    } else if (d.statut === "envoye" || d.statut === "brouillon") {
      pipeline_en_attente_ht = arrondirCentimes(pipeline_en_attente_ht + calc.total_ht);
    }
  }

  let ca_facture_ht = 0;
  let encaisse_ttc = 0;
  let en_attente_encaissement_ttc = 0;
  let en_retard_ttc = 0;
  let nb_factures_retard = 0;
  let retenues_garantie_cumulees_ttc = 0;

  for (const f of facturesList) {
    if (f.statut === "annulee") continue;

    if (f.statut !== "brouillon") {
      ca_facture_ht = arrondirCentimes(ca_facture_ht + f.montant_ht);
      retenues_garantie_cumulees_ttc = arrondirCentimes(
        retenues_garantie_cumulees_ttc + (f.montant_retenue_ttc || 0)
      );
    }

    if (f.statut === "payee") {
      encaisse_ttc = arrondirCentimes(encaisse_ttc + f.net_a_payer_ttc);
    } else if (f.statut === "en_retard") {
      en_retard_ttc = arrondirCentimes(en_retard_ttc + f.net_a_payer_ttc);
      en_attente_encaissement_ttc = arrondirCentimes(
        en_attente_encaissement_ttc + f.net_a_payer_ttc
      );
      nb_factures_retard += 1;
    } else if (f.statut === "emise") {
      en_attente_encaissement_ttc = arrondirCentimes(
        en_attente_encaissement_ttc + f.net_a_payer_ttc
      );
    }
  }

  const reste_a_facturer_ht = arrondirCentimes(Math.max(0, ca_signe_ht - ca_facture_ht));
  const taux_marge_moyen_pct =
    ca_signe_ht > 0 ? arrondirCentimes((marge_globale_signee_ht / ca_signe_ht) * 100) : 0;

  return {
    ca_signe_ht,
    ca_signe_ttc,
    pipeline_en_attente_ht,
    ca_facture_ht,
    encaisse_ttc,
    en_attente_encaissement_ttc,
    en_retard_ttc,
    nb_factures_retard,
    reste_a_facturer_ht,
    retenues_garantie_cumulees_ttc,
    marge_globale_signee_ht,
    taux_marge_moyen_pct,
  };
}
