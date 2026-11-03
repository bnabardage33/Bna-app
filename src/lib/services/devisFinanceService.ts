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
import type { BesoinMateriauRow } from "@/types/database.types";

export type TauxTvaBtp = 20 | 10 | 5.5 | 0;
export type CoutType = "matiere" | "main_oeuvre";
export type StatutDevis = "brouillon" | "envoye" | "signe" | "refuse";
export type StatutFacture = "brouillon" | "emise" | "payee" | "en_retard" | "annulee";
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
  tva_pct: TauxTvaBtp;
  retenue_garantie_pct: number;
  avancement_pct?: number;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  montant_retenue_ttc: number;
  net_a_payer_ttc: number;
  objet: string;
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

const STORAGE_DEVIS_KEY = "bna_devis_items_v1";
const STORAGE_FACTURES_KEY = "bna_factures_items_v1";

/**
 * Arrondi monétaire déterministe au centime le plus proche (half-up)
 */
export function arrondirCentimes(montant: number): number {
  if (!Number.isFinite(montant)) return 0;
  return Math.round((montant + Number.EPSILON) * 100) / 100;
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
  if (taux === undefined || taux === null || Number.isNaN(taux)) return 0;
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
  let total_ht = 0;
  let total_tva = 0;
  let cout_matiere_ht = 0;
  let cout_main_oeuvre_ht = 0;

  for (const l of lignes) {
    if (l.a_chiffrer) continue;
    const qte = Math.max(0, Number(l.qte) || 0);
    const puHt = Math.max(0, Number(l.pu_ht) || 0);
    const puRevient = Math.max(0, Number(l.pu_revient) || 0);
    const tvaLigne = l.tva_pct !== undefined ? l.tva_pct : tvaDefautPct;

    const montantHt = arrondirCentimes(qte * puHt);
    const montantTva = arrondirCentimes((montantHt * tvaLigne) / 100);
    const coutHt = arrondirCentimes(qte * puRevient);

    total_ht = arrondirCentimes(total_ht + montantHt);
    total_tva = arrondirCentimes(total_tva + montantTva);

    if (l.type_cout === "main_oeuvre") {
      cout_main_oeuvre_ht = arrondirCentimes(cout_main_oeuvre_ht + coutHt);
    } else {
      cout_matiere_ht = arrondirCentimes(cout_matiere_ht + coutHt);
    }
  }

  const total_ttc = arrondirCentimes(total_ht + total_tva);
  const cout_total_ht = arrondirCentimes(cout_matiere_ht + cout_main_oeuvre_ht);
  const marge_ht = arrondirCentimes(total_ht - cout_total_ht);
  const marge_pct = total_ht > 0 ? arrondirCentimes((marge_ht / total_ht) * 100) : 0;
  const acompte_ttc = arrondirCentimes((total_ttc * Math.max(0, Math.min(100, acomptePct))) / 100);

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
  const montant_ht = arrondirCentimes(Math.max(0, montantBaseHt));
  const montant_tva = arrondirCentimes((montant_ht * tvaPct) / 100);
  const montant_ttc = arrondirCentimes(montant_ht + montant_tva);
  const montant_retenue_ttc = arrondirCentimes((montant_ttc * retenue) / 100);
  const net_a_payer_ttc = arrondirCentimes(Math.max(0, montant_ttc - montant_retenue_ttc));

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
const INITIAL_DEVIS: DevisItem[] = [
  {
    id: "dev-martin-01",
    numero: "DEV-2026-0042",
    chantier_id: "martin",
    chantier_nom: "Terrasse Martin",
    client_nom: "M. & Mme Martin",
    ville: "Mérignac",
    metier: "terrasse",
    objet: "Création terrasse bois exotique Cumaru 42 m² sur plots réglables (DTU 51.4)",
    statut: "signe",
    date_creation: "2026-10-12",
    date_validite: "2026-11-12",
    tva_pct: 10,
    acompte_pct: 30,
    retenue_garantie_pct: 5,
    lignes: [
      {
        id: "l1",
        designation: "Fourniture Lames Cumaru KD 21x145 mm + Lambourdes Exotiques + Bande EPDM",
        description: "Incluant 8% de perte de calepinage et double lambourdage aux aboutages",
        qte: 42,
        unite: "m²",
        pu_ht: 115,
        pu_revient: 74,
        type_cout: "matiere",
      },
      {
        id: "l2",
        designation: "Plots réglables 50/80 mm & Visserie Inox A4 5x50 mm",
        description: "218 plots + 3 boîtes de 500 vis Inox A4",
        qte: 1,
        unite: "forfait",
        pu_ht: 890,
        pu_revient: 520,
        type_cout: "matiere",
      },
      {
        id: "l3",
        designation: "Main d'œuvre pose structure, réglage planéité et vissage platelage (NF DTU 51.4)",
        description: "Pose avec gabarit d'écartement 5 mm et bandeau périphérique",
        qte: 42,
        unite: "m²",
        pu_ht: 75,
        pu_revient: 40,
        type_cout: "main_oeuvre",
      },
    ],
  },
  {
    id: "dev-dupont-02",
    numero: "DEV-2026-0045",
    chantier_id: "dupont",
    chantier_nom: "Bardage Dupont",
    client_nom: "SCI Dupont",
    ville: "Pessac",
    metier: "facade",
    objet: "Habillage façade en bardage HPL Polyrey & ossature bois ventilée 58 m² (DTU 41.2 / 45.4)",
    statut: "signe",
    date_creation: "2026-10-18",
    date_validite: "2026-11-18",
    tva_pct: 10,
    acompte_pct: 30,
    retenue_garantie_pct: 5,
    lignes: [
      {
        id: "l4",
        designation: "Panneaux HPL Compact Polyrey Façade 8 mm + Pare-pluie HPV + Grilles anti-rongeurs",
        description: "Inclus bande EPDM sur montants et rivets laqués point fixe / coulissant",
        qte: 58,
        unite: "m²",
        pu_ht: 128,
        pu_revient: 82,
        type_cout: "matiere",
      },
      {
        id: "l5",
        designation: "Main d'œuvre pose ossature secondaire, lame d'air 20 mm et panneaux HPL",
        description: "Échafaudage de pied inclus",
        qte: 58,
        unite: "m²",
        pu_ht: 88,
        pu_revient: 48,
        type_cout: "main_oeuvre",
      },
    ],
  },
  {
    id: "dev-bernard-03",
    numero: "DEV-2026-0048",
    chantier_id: "bernard",
    chantier_nom: "Clôture Bernard",
    client_nom: "M. Bernard",
    ville: "Talence",
    metier: "cloture",
    objet: "Pose clôture composite occultante 30 ml avec scellement béton (NF P98-405)",
    statut: "signe",
    date_creation: "2026-10-22",
    date_validite: "2026-11-22",
    tva_pct: 20,
    acompte_pct: 30,
    retenue_garantie_pct: 0,
    lignes: [
      {
        id: "l6",
        designation: "Fourniture poteaux aluminium anthracite, lames composites et béton de scellement",
        qte: 30,
        unite: "ml",
        pu_ht: 86,
        pu_revient: 54,
        type_cout: "matiere",
      },
      {
        id: "l7",
        designation: "Pose, carottage/fouilles 50x50 cm et réglage au cordeau laser",
        qte: 30,
        unite: "ml",
        pu_ht: 62,
        pu_revient: 34,
        type_cout: "main_oeuvre",
      },
    ],
  },
  {
    id: "dev-prospect-04",
    numero: "DEV-2026-0051",
    chantier_nom: "Terrasse & Pergola Lemoine",
    client_nom: "Mme Lemoine",
    ville: "Arcachon",
    metier: "terrasse",
    objet: "Création contour piscine en Pin Classe 4 Marron 35 m² (DTU 51.4)",
    statut: "envoye",
    date_creation: "2026-10-30",
    date_validite: "2026-11-30",
    tva_pct: 20,
    acompte_pct: 30,
    retenue_garantie_pct: 0,
    lignes: [
      {
        id: "l8",
        designation: "Fourniture Pin Classe 4 raboté 27x145 mm + Lambourdes Classe 4 + Visserie A4 (piscine sel)",
        qte: 35,
        unite: "m²",
        pu_ht: 52,
        pu_revient: 31,
        type_cout: "matiere",
      },
      {
        id: "l9",
        designation: "Main d'œuvre pose sur plots et découpes margelles piscine",
        qte: 35,
        unite: "m²",
        pu_ht: 68,
        pu_revient: 38,
        type_cout: "main_oeuvre",
      },
    ],
  },
];

const INITIAL_FACTURES: FactureItem[] = [
  {
    id: "fac-martin-ac",
    numero: "FAC-2026-0081",
    devis_id: "dev-martin-01",
    devis_numero: "DEV-2026-0042",
    chantier_id: "martin",
    chantier_nom: "Terrasse Martin",
    client_nom: "M. & Mme Martin",
    type: "acompte",
    statut: "payee",
    date_emission: "2026-10-15",
    date_echeance: "2026-10-25",
    tva_pct: 10,
    retenue_garantie_pct: 0,
    montant_ht: 2661,
    montant_tva: 266.1,
    montant_ttc: 2927.1,
    montant_retenue_ttc: 0,
    net_a_payer_ttc: 2927.1,
    objet: "Facture d'acompte 30% à la commande — Terrasse Martin",
  },
  {
    id: "fac-martin-sit1",
    numero: "FAC-2026-0088",
    devis_id: "dev-martin-01",
    devis_numero: "DEV-2026-0042",
    chantier_id: "martin",
    chantier_nom: "Terrasse Martin",
    client_nom: "M. & Mme Martin",
    type: "situation",
    statut: "emise",
    avancement_pct: 65,
    date_emission: "2026-11-01",
    date_echeance: "2026-11-15",
    tva_pct: 10,
    retenue_garantie_pct: 5,
    montant_ht: 3104.5,
    montant_tva: 310.45,
    montant_ttc: 3414.95,
    montant_retenue_ttc: 170.75,
    net_a_payer_ttc: 3244.2,
    objet: "Situation d'avancement n°1 (65% cumulé, déduction acompte 30%) — Terrasse Martin",
  },
  {
    id: "fac-dupont-ac",
    numero: "FAC-2026-0084",
    devis_id: "dev-dupont-02",
    devis_numero: "DEV-2026-0045",
    chantier_id: "dupont",
    chantier_nom: "Bardage Dupont",
    client_nom: "SCI Dupont",
    type: "acompte",
    statut: "payee",
    date_emission: "2026-10-20",
    date_echeance: "2026-10-30",
    tva_pct: 10,
    retenue_garantie_pct: 0,
    montant_ht: 3758.4,
    montant_tva: 375.84,
    montant_ttc: 4134.24,
    montant_retenue_ttc: 0,
    net_a_payer_ttc: 4134.24,
    objet: "Facture d'acompte 30% démarrage chantier — Bardage Dupont",
  },
  {
    id: "fac-bernard-ac",
    numero: "FAC-2026-0086",
    devis_id: "dev-bernard-03",
    devis_numero: "DEV-2026-0048",
    chantier_id: "bernard",
    chantier_nom: "Clôture Bernard",
    client_nom: "M. Bernard",
    type: "acompte",
    statut: "en_retard",
    date_emission: "2026-10-22",
    date_echeance: "2026-10-31",
    tva_pct: 20,
    retenue_garantie_pct: 0,
    montant_ht: 1332,
    montant_tva: 266.4,
    montant_ttc: 1598.4,
    montant_retenue_ttc: 0,
    net_a_payer_ttc: 1598.4,
    objet: "Facture d'acompte 30% approvisionnement clôture — Clôture Bernard",
  },
];

/**
 * Lecture / Écriture des Devis
 */
export function getDevisList(): DevisItem[] {
  if (typeof window === "undefined") return INITIAL_DEVIS;
  try {
    const raw = localStorage.getItem(STORAGE_DEVIS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_DEVIS_KEY, JSON.stringify(INITIAL_DEVIS));
      return INITIAL_DEVIS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_DEVIS;
  } catch {
    return INITIAL_DEVIS;
  }
}

export function saveDevisList(list: DevisItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_DEVIS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function creerNouveauDevis(
  input: Omit<DevisItem, "id" | "numero" | "date_creation" | "date_validite">
): DevisItem {
  const list = getDevisList();
  const nextNum = 42 + list.length + 10;
  const now = new Date();
  const validite = new Date(now);
  validite.setDate(validite.getDate() + 30);

  const newDevis: DevisItem = {
    ...input,
    id: `dev-${Date.now()}`,
    numero: `DEV-${now.getFullYear()}-00${nextNum}`,
    date_creation: now.toISOString().slice(0, 10),
    date_validite: validite.toISOString().slice(0, 10),
  };

  const updated = [newDevis, ...list];
  saveDevisList(updated);
  return newDevis;
}

export function updateStatutDevis(id: string, statut: StatutDevis): DevisItem[] {
  const list = getDevisList();
  const updated = list.map((d) => (d.id === id ? { ...d, statut } : d));
  saveDevisList(updated);
  return updated;
}

export function supprimerDevis(id: string): DevisItem[] {
  const list = getDevisList();
  const updated = list.filter((d) => d.id !== id);
  saveDevisList(updated);
  return updated;
}

/**
 * Lecture / Écriture des Factures
 */
export function getFacturesList(): FactureItem[] {
  if (typeof window === "undefined") return INITIAL_FACTURES;
  try {
    const raw = localStorage.getItem(STORAGE_FACTURES_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_FACTURES_KEY, JSON.stringify(INITIAL_FACTURES));
      return INITIAL_FACTURES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_FACTURES;
  } catch {
    return INITIAL_FACTURES;
  }
}

export function saveFacturesList(list: FactureItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_FACTURES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/**
 * Génère automatiquement une facture (Acompte, Situation d'avancement ou Solde) à partir d'un Devis
 */
export function creerFactureDepuisDevis(
  devis: DevisItem,
  type: TypeFacture,
  avancementPct: number = 50
): FactureItem {
  const factures = getFacturesList();
  const calcDevis = calculerDevis(devis.lignes, devis.tva_pct, devis.acompte_pct);

  let ratio = 1;
  let retenueApplicable = devis.retenue_garantie_pct;
  let objet = "";

  if (type === "acompte") {
    ratio = devis.acompte_pct / 100;
    retenueApplicable = 0; // Pas de retenue de garantie sur l'acompte initial
    objet = `Facture d'acompte (${devis.acompte_pct}%) — ${devis.chantier_nom}`;
  } else if (type === "situation") {
    const pctClamp = Math.max(10, Math.min(95, avancementPct));
    ratio = pctClamp / 100;
    objet = `Facture de situation d'avancement (${pctClamp}%) — ${devis.chantier_nom}`;
  } else {
    // Calcul du solde restant à facturer sur ce devis
    const dejaFactureHt = factures
      .filter((f) => f.devis_id === devis.id && f.statut !== "annulee")
      .reduce((acc, f) => acc + f.montant_ht, 0);
    const resteHt = Math.max(0, calcDevis.total_ht - dejaFactureHt);
    ratio = calcDevis.total_ht > 0 ? resteHt / calcDevis.total_ht : 0.3;
    if (ratio <= 0) ratio = 0.35;
    objet = `Facture de solde de fin de travaux — ${devis.chantier_nom}`;
  }

  const montantBaseHt = arrondirCentimes(calcDevis.total_ht * ratio);
  const montants = calculerMontantsFacture(montantBaseHt, devis.tva_pct, retenueApplicable);

  const now = new Date();
  const echeance = new Date(now);
  echeance.setDate(echeance.getDate() + 15);
  const nextNum = 80 + factures.length + 10;

  const newFacture: FactureItem = {
    id: `fac-${Date.now()}`,
    numero: `FAC-${now.getFullYear()}-00${nextNum}`,
    devis_id: devis.id,
    devis_numero: devis.numero,
    chantier_id: devis.chantier_id,
    chantier_nom: devis.chantier_nom,
    client_nom: devis.client_nom,
    type,
    statut: "emise",
    avancement_pct: type === "situation" ? avancementPct : undefined,
    date_emission: now.toISOString().slice(0, 10),
    date_echeance: echeance.toISOString().slice(0, 10),
    tva_pct: devis.tva_pct,
    retenue_garantie_pct: retenueApplicable,
    ...montants,
    objet,
  };

  const updated = [newFacture, ...factures];
  saveFacturesList(updated);
  return newFacture;
}

export function updateStatutFacture(id: string, statut: StatutFacture): FactureItem[] {
  const list = getFacturesList();
  const updated = list.map((f) => (f.id === id ? { ...f, statut } : f));
  saveFacturesList(updated);
  return updated;
}

export function supprimerFacture(id: string): FactureItem[] {
  const list = getFacturesList();
  const updated = list.filter((f) => f.id !== id);
  saveFacturesList(updated);
  return updated;
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
