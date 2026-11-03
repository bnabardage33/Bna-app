/**
 * BNA-APP — Service Procès-Verbaux (PV) de Réception de Travaux, Levée des Réserves,
 * Libération de Retenue de Garantie (Loi n° 71-584) & Interventions SAV / Garantie Décennale.
 *
 * Rapatrié et adapté depuis bna-dashboard (PVReceptionPDF.tsx, RapportSAVPDF.tsx, RetenueGarantieChantier.tsx).
 * Conforme à l'Article 1792-6 du Code Civil et à la norme NF P 03-001.
 */

import type { MetierType } from "@/types/metier";

export type StatutPV = "sans_reserve" | "avec_reserves" | "reserves_levees" | "refuse";

export interface ReserveItem {
  id: string;
  designation: string;
  localisation: string;
  date_limite: string;
  levee: boolean;
  date_levee?: string;
}

export interface ChecklistRepli {
  nettoyage: boolean;
  dechets_evacues: boolean;
  echafaudage_demonte: boolean;
  fiches_techniques_remises: boolean;
}

export interface PvReceptionItem {
  id: string;
  numero: string;
  chantier_id: string;
  chantier_nom: string;
  client_nom: string;
  ville: string;
  metier: MetierType;
  date_reception: string;
  statut: StatutPV;
  type_travaux: string;
  materiaux_utilises: string;
  reserves: ReserveItem[];
  checklist_repli: ChecklistRepli;
  observations: string;
  montant_retenue_ttc: number;
  retenue_garantie_liberee: boolean;
  date_liberation_retenue?: string;
  signe_client: boolean;
  signe_entreprise: boolean;
}

export type StatutTicketSav = "ouvert" | "planifie" | "cloture";
export type TypeGarantieLegale =
  | "gpa_1_an"
  | "biennale_2_ans"
  | "decennale_10_ans"
  | "hors_garantie";

export interface TicketSavItem {
  id: string;
  numero: string;
  chantier_id: string;
  chantier_nom: string;
  client_nom: string;
  ville: string;
  metier: MetierType;
  statut: StatutTicketSav;
  type_garantie: TypeGarantieLegale;
  type_sinistre: string;
  localisation: string;
  diagnostic_dtu: string;
  respect_dtu: boolean;
  travaux_reprise: string;
  date_signalement: string;
  date_intervention: string;
  intervenant: string;
}

export interface SynthesePvSav {
  total_pv: number;
  pv_avec_reserves_actives: number;
  nb_reserves_non_levees: number;
  montant_retenues_liberables_ttc: number;
  tickets_sav_ouverts: number;
}

const STORAGE_PV_KEY = "bna_pv_receptions_v1";
const STORAGE_SAV_KEY = "bna_tickets_sav_v1";

export const LABELS_STATUT_PV: Record<
  StatutPV,
  { label: string; badgeClass: string; desc: string }
> = {
  sans_reserve: {
    label: "Réception Sans Réserve",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    desc: "Travaux déclarés conformes aux règles de l'art (NF DTU 51.4 / 41.2 / 45.4) et acceptés sans réserve. Point de départ immédiat des garanties légales (GPA 1 an, Biennale 2 ans, Décennale 10 ans).",
  },
  avec_reserves: {
    label: "Réception Avec Réserves",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    desc: "Réception prononcée avec engagement de BNA de lever les réserves listées avant la date limite convenue (Art. 1792-6 Code Civil).",
  },
  reserves_levees: {
    label: "Réserves Intégralement Levées",
    badgeClass: "bg-sky-100 text-sky-800 border-sky-200",
    desc: "Toutes les réserves consignées ont été reprises et validées contradictoirement. La retenue de garantie de 5% est libérable.",
  },
  refuse: {
    label: "Refus de Réception",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
    desc: "Réception différée en l'attente de l'achèvement des postes signalés.",
  },
};

export const LABELS_GARANTIE_SAV: Record<TypeGarantieLegale, string> = {
  gpa_1_an: "Garantie de Parfait Achèvement (GPA — 1 an)",
  biennale_2_ans: "Garantie Biennale (2 ans)",
  decennale_10_ans: "Garantie Décennale (10 ans — Art. 1792)",
  hors_garantie: "Intervention Hors Garantie (Facturable)",
};

const INITIAL_PV_LIST: PvReceptionItem[] = [
  {
    id: "pv-martin-01",
    numero: "PV-2026-0014",
    chantier_id: "martin",
    chantier_nom: "Terrasse Martin",
    client_nom: "M. & Mme Martin",
    ville: "Mérignac",
    metier: "terrasse",
    date_reception: "2026-11-03",
    statut: "avec_reserves",
    type_travaux: "Création terrasse bois exotique Cumaru 42 m² sur plots réglables (NF DTU 51.4)",
    materiaux_utilises: "Lames Cumaru KD 21x145 mm, Lambourdes exotiques, Bande EPDM, Vis Inox A4",
    reserves: [
      {
        id: "res-1",
        designation: "Ajustement coupe d'onglet sur le bandeau de finition angle Sud-Ouest",
        localisation: "Bandeau périphérique Sud-Ouest",
        date_limite: "2026-11-10",
        levee: false,
      },
      {
        id: "res-2",
        designation: "Ponçage léger d'une gerce superficielle sur lame de rive n°4",
        localisation: "Rive côté jardin",
        date_limite: "2026-11-10",
        levee: true,
        date_levee: "2026-11-03",
      },
    ],
    checklist_repli: {
      nettoyage: true,
      dechets_evacues: true,
      echafaudage_demonte: true,
      fiches_techniques_remises: true,
    },
    observations:
      "Planéité et écartement inter-lames (5 mm) contrôlés conformes au NF DTU 51.4. Remise du guide d'entretien annuel (lavage eau douce / savon noir, proscrire karcher haute pression).",
    montant_retenue_ttc: 170.75,
    retenue_garantie_liberee: false,
    signe_client: true,
    signe_entreprise: true,
  },
  {
    id: "pv-bernard-02",
    numero: "PV-2026-0015",
    chantier_id: "bernard",
    chantier_nom: "Clôture Bernard",
    client_nom: "M. Bernard",
    ville: "Talence",
    metier: "cloture",
    date_reception: "2026-11-02",
    statut: "sans_reserve",
    type_travaux: "Pose clôture composite occultante 30 ml avec scellement béton (NF P98-405)",
    materiaux_utilises: "Poteaux aluminium anthracite, lames composites, chapeaux alu",
    reserves: [],
    checklist_repli: {
      nettoyage: true,
      dechets_evacues: true,
      echafaudage_demonte: true,
      fiches_techniques_remises: true,
    },
    observations:
      "Alignement au laser et aplomb des poteaux vérifiés. Jeux de dilatation des lames composites respectés.",
    montant_retenue_ttc: 0,
    retenue_garantie_liberee: true,
    date_liberation_retenue: "2026-11-02",
    signe_client: true,
    signe_entreprise: true,
  },
];

const INITIAL_SAV_LIST: TicketSavItem[] = [
  {
    id: "sav-dupont-01",
    numero: "SAV-2026-0008",
    chantier_id: "dupont",
    chantier_nom: "Bardage Dupont",
    client_nom: "SCI Dupont",
    ville: "Pessac",
    metier: "facade",
    statut: "planifie",
    type_garantie: "gpa_1_an",
    type_sinistre: "Vibration d'une bavette aluminium d'appui de fenêtre par vent fort",
    localisation: "Façade Ouest — Fenêtre R+1 gauche",
    diagnostic_dtu:
      "Constat conforme NF DTU 41.2 / 45.4 : lame d'air de 20 mm et grille anti-rongeurs intactes. Simple ajout d'un plot de mastic polyuréthane souple et de 2 rivets laqués complémentaires sous la bavette.",
    respect_dtu: true,
    travaux_reprise:
      "Fixation complémentaire de la bavette aluminium par 2 rivets tête laquée + cordon mastic PU classe F25.",
    date_signalement: "2026-11-01",
    date_intervention: "2026-11-06",
    intervenant: "Gaël (Gérant BNA)",
  },
];

/**
 * Lecture / Écriture des PV de Réception
 */
export function getPvReceptions(): PvReceptionItem[] {
  if (typeof window === "undefined") return INITIAL_PV_LIST;
  try {
    const raw = localStorage.getItem(STORAGE_PV_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_PV_KEY, JSON.stringify(INITIAL_PV_LIST));
      return INITIAL_PV_LIST;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_PV_LIST;
  } catch {
    return INITIAL_PV_LIST;
  }
}

export function savePvReceptions(list: PvReceptionItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PV_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function creerPvReception(
  input: Omit<PvReceptionItem, "id" | "numero">
): PvReceptionItem {
  const list = getPvReceptions();
  const nextNum = 14 + list.length + 1;
  const nowYear = new Date().getFullYear();

  const newPv: PvReceptionItem = {
    ...input,
    id: `pv-${Date.now()}`,
    numero: `PV-${nowYear}-00${nextNum}`,
  };

  const updated = [newPv, ...list];
  savePvReceptions(updated);
  return newPv;
}

/**
 * Bascule l'état levé / non levé d'une réserve sur un PV et met à jour automatiquement
 * le statut du PV en `reserves_levees` si toutes les réserves sont levées.
 */
export function toggleReservePv(pvId: string, reserveId: string): PvReceptionItem[] {
  const list = getPvReceptions();
  const today = new Date().toISOString().slice(0, 10);

  const updated = list.map((pv) => {
    if (pv.id !== pvId) return pv;
    const newReserves = pv.reserves.map((r) =>
      r.id === reserveId
        ? {
            ...r,
            levee: !r.levee,
            date_levee: !r.levee ? today : undefined,
          }
        : r
    );
    const allLevees = newReserves.length > 0 && newReserves.every((r) => r.levee);
    const newStatut: StatutPV =
      newReserves.length === 0
        ? "sans_reserve"
        : allLevees
        ? "reserves_levees"
        : "avec_reserves";

    return {
      ...pv,
      reserves: newReserves,
      statut: newStatut,
    };
  });

  savePvReceptions(updated);
  return updated;
}

export function ajouterReservePv(
  pvId: string,
  designation: string,
  localisation: string,
  dateLimite: string
): PvReceptionItem[] {
  const list = getPvReceptions();
  const updated = list.map((pv) => {
    if (pv.id !== pvId) return pv;
    const newRes: ReserveItem = {
      id: `res-${Date.now()}`,
      designation,
      localisation,
      date_limite: dateLimite,
      levee: false,
    };
    return {
      ...pv,
      statut: "avec_reserves" as StatutPV,
      reserves: [...pv.reserves, newRes],
    };
  });
  savePvReceptions(updated);
  return updated;
}

export function libererRetenueGarantiePv(pvId: string): PvReceptionItem[] {
  const list = getPvReceptions();
  const today = new Date().toISOString().slice(0, 10);
  const updated = list.map((pv) =>
    pv.id === pvId
      ? {
          ...pv,
          retenue_garantie_liberee: true,
          date_liberation_retenue: today,
        }
      : pv
  );
  savePvReceptions(updated);
  return updated;
}

export function supprimerPvReception(pvId: string): PvReceptionItem[] {
  const list = getPvReceptions();
  const updated = list.filter((p) => p.id !== pvId);
  savePvReceptions(updated);
  return updated;
}

/**
 * Lecture / Écriture des Tickets SAV
 */
export function getTicketsSav(): TicketSavItem[] {
  if (typeof window === "undefined") return INITIAL_SAV_LIST;
  try {
    const raw = localStorage.getItem(STORAGE_SAV_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_SAV_KEY, JSON.stringify(INITIAL_SAV_LIST));
      return INITIAL_SAV_LIST;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SAV_LIST;
  } catch {
    return INITIAL_SAV_LIST;
  }
}

export function saveTicketsSav(list: TicketSavItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_SAV_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function creerTicketSav(
  input: Omit<TicketSavItem, "id" | "numero">
): TicketSavItem {
  const list = getTicketsSav();
  const nextNum = 8 + list.length + 1;
  const nowYear = new Date().getFullYear();

  const newTicket: TicketSavItem = {
    ...input,
    id: `sav-${Date.now()}`,
    numero: `SAV-${nowYear}-00${nextNum}`,
  };

  const updated = [newTicket, ...list];
  saveTicketsSav(updated);
  return newTicket;
}

export function updateStatutTicketSav(
  id: string,
  statut: StatutTicketSav
): TicketSavItem[] {
  const list = getTicketsSav();
  const updated = list.map((t) => (t.id === id ? { ...t, statut } : t));
  saveTicketsSav(updated);
  return updated;
}

export function supprimerTicketSav(id: string): TicketSavItem[] {
  const list = getTicketsSav();
  const updated = list.filter((t) => t.id !== id);
  saveTicketsSav(updated);
  return updated;
}

/**
 * Synthèse globale PV & SAV pour le Dashboard et l'Assistant IA
 */
export function calculerSynthesePvSav(
  pvs: PvReceptionItem[],
  tickets: TicketSavItem[]
): SynthesePvSav {
  let pv_avec_reserves_actives = 0;
  let nb_reserves_non_levees = 0;
  let montant_retenues_liberables_ttc = 0;

  for (const pv of pvs) {
    const nonLevees = pv.reserves.filter((r) => !r.levee).length;
    if (nonLevees > 0) {
      pv_avec_reserves_actives += 1;
      nb_reserves_non_levees += nonLevees;
    }
    if (
      !pv.retenue_garantie_liberee &&
      pv.montant_retenue_ttc > 0 &&
      (pv.statut === "sans_reserve" || pv.statut === "reserves_levees" || nonLevees === 0)
    ) {
      montant_retenues_liberables_ttc += pv.montant_retenue_ttc;
    }
  }

  const tickets_sav_ouverts = tickets.filter((t) => t.statut !== "cloture").length;

  return {
    total_pv: pvs.length,
    pv_avec_reserves_actives,
    nb_reserves_non_levees,
    montant_retenues_liberables_ttc: Math.round(montant_retenues_liberables_ttc * 100) / 100,
    tickets_sav_ouverts,
  };
}
