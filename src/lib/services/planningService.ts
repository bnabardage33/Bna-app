/**
 * BNA-APP — Service Planning Général & Jalons V1 & V2
 *
 * Consolide tous les éléments planifiés du dashboard & du cockpit chantier :
 * - Chantiers en cours et à venir (périodes, avancement, étapes)
 * - Rendez-vous clients & réunions de chantier (nature, heure, lieu)
 * - Commandes passées & livraisons fournisseurs attendues
 *
 * Distingue précisément chaque nature avec une palette de couleurs dédiée :
 * - Technique & Contrôle DTU : Orange Cuivre BNA (#EA580C)
 * - Réception & PV Client : Vert Émeraude (#059669)
 * - Point Client & Devis : Bleu Cobalt (#2563EB)
 * - Commandes & Livraisons : Violet Améthyste (#7C3AED)
 * - Chantier & Pose Terrain : Ardoise (#475569)
 * - Administratif & Formalités : Indigo (#4F46E5)
 * - Autre / Jalon standard : Gris neutre (#737373)
 */

import type { Chantier } from "@/types/metier";
import type { CommandeAvecFournisseur } from "./commandesFournisseursService";
import type { RendezVous } from "./rendezVousService";

export type PlanningItemType = "chantier" | "rdv" | "commande" | "livraison";

export type NatureKey =
  | "technique"
  | "reception"
  | "client"
  | "livraison"
  | "travaux"
  | "administratif"
  | "autre";

export interface NatureConfig {
  key: NatureKey;
  label: string;
  badgeClass: string;
  dotColor: string;
  borderClass: string;
  tagMermaid: string;
}

export const NATURES_CONFIG: Record<NatureKey, NatureConfig> = {
  technique: {
    key: "technique",
    label: "Technique & DTU",
    badgeClass: "bg-orange-50 text-orange-800 border-orange-300",
    dotColor: "#EA580C",
    borderClass: "border-orange-400",
    tagMermaid: ":crit, ",
  },
  reception: {
    key: "reception",
    label: "Réception & PV",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300",
    dotColor: "#059669",
    borderClass: "border-emerald-400",
    tagMermaid: ":active, ",
  },
  client: {
    key: "client",
    label: "Point Client & Devis",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-300",
    dotColor: "#2563EB",
    borderClass: "border-blue-400",
    tagMermaid: ":active, ",
  },
  livraison: {
    key: "livraison",
    label: "Commande & Livraison",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-300",
    dotColor: "#7C3AED",
    borderClass: "border-purple-400",
    tagMermaid: ":milestone, ",
  },
  travaux: {
    key: "travaux",
    label: "Chantier & Pose",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
    dotColor: "#475569",
    borderClass: "border-slate-400",
    tagMermaid: ":",
  },
  administratif: {
    key: "administratif",
    label: "Administratif & Formalités",
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-300",
    dotColor: "#4F46E5",
    borderClass: "border-indigo-400",
    tagMermaid: ":",
  },
  autre: {
    key: "autre",
    label: "Jalon Général",
    badgeClass: "bg-neutral-100 text-neutral-800 border-neutral-300",
    dotColor: "#737373",
    borderClass: "border-neutral-300",
    tagMermaid: ":",
  },
};

export interface UnifiedPlanningItem {
  id: string;
  type: PlanningItemType;
  titre: string;
  sousTitre?: string;
  dateDebut: string; // YYYY-MM-DD
  dateFin?: string;  // YYYY-MM-DD
  heure?: string;    // "09:30" ou "09:30 - 11:00"
  chantierId?: string;
  chantierNom?: string;
  statut: string;    // "en_cours", "planifie", "confirme", "commande", "livre", etc.
  statutLabel: string;
  natureKey: NatureKey;
  dotColor: string;
  badgeColorClass: string;
  nature?: string;   // Description détaillée / encadré nature du rdv
  fournisseurNom?: string;
  avancement?: number;
}

/**
 * Détermine automatiquement la catégorie de nature d'un événement selon son texte ou son type.
 */
export function categorizeNature(
  text?: string | null,
  defaultType?: PlanningItemType,
  explicitKey?: string | null
): NatureKey {
  if (explicitKey && explicitKey in NATURES_CONFIG) {
    return explicitKey as NatureKey;
  }

  if (defaultType === "commande" || defaultType === "livraison") {
    return "livraison";
  }

  if (defaultType === "chantier") {
    return "travaux";
  }

  if (!text) return "autre";
  const s = text.toLowerCase();

  // 1. Réception & PV
  if (
    s.includes("recept") ||
    s.includes("pv") ||
    s.includes("reserve") ||
    s.includes("livraison fin") ||
    s.includes("parfait achevement")
  ) {
    return "reception";
  }

  // 2. Technique, DTU, humidité, ossature, réglage plots
  if (
    s.includes("tech") ||
    s.includes("dtu") ||
    s.includes("humid") ||
    s.includes("lambourde") ||
    s.includes("plot") ||
    s.includes("visite") ||
    s.includes("controle") ||
    s.includes("contrôle") ||
    s.includes("equerre") ||
    s.includes("équerre") ||
    s.includes("pare-pluie") ||
    s.includes("chevron") ||
    s.includes("liteau") ||
    s.includes("dilatation") ||
    s.includes("ventilation")
  ) {
    return "technique";
  }

  // 3. Point client, réunion, teinte, devis
  if (
    s.includes("client") ||
    s.includes("reunion") ||
    s.includes("réunion") ||
    s.includes("choix") ||
    s.includes("teinte") ||
    s.includes("devis") ||
    s.includes("point d'etape") ||
    s.includes("point d'étape")
  ) {
    return "client";
  }

  // 4. Commande, approvisionnement, fournisseur
  if (
    s.includes("livrais") ||
    s.includes("materiau") ||
    s.includes("matériau") ||
    s.includes("fournisseur") ||
    s.includes("colis")
  ) {
    return "livraison";
  }

  // 5. Chantier, travaux, démarrage, pose
  if (
    s.includes("travaux") ||
    s.includes("pose") ||
    s.includes("ossature") ||
    s.includes("demarrage") ||
    s.includes("démarrage") ||
    s.includes("platelage")
  ) {
    return "travaux";
  }

  // 6. Administratif
  if (s.includes("admin") || s.includes("factur") || s.includes("assurance")) {
    return "administratif";
  }

  return "technique";
}

function sanitizeMermaidText(str: string): string {
  if (!str) return "Tache";
  return str
    .replace(/[:#;,"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 36);
}

function normalizeDate(d?: string | null): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  const trimmed = d.trim();
  // Formats DD/MM/YYYY -> YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
    const [day, month, year] = trimmed.split(/[/ ]/);
    return `${year}-${month}-${day}`;
  }
  // Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const PLANNING_DISMISSED_KEY = "bna_planning_dismissed_v1";
let memoryDismissedPlanningIds: string[] = [];

/**
 * Récupère les identifiants d'éléments de planning masqués ou supprimés.
 */
export function getDismissedPlanningIds(): string[] {
  if (typeof window === "undefined") return memoryDismissedPlanningIds;
  try {
    const raw = localStorage.getItem(PLANNING_DISMISSED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignorer
  }
  return [];
}

/**
 * Enregistre un élément du planning comme masqué/supprimé dans le stockage persistant.
 */
export function dismissPlanningItem(id: string): void {
  if (typeof window === "undefined") {
    if (!memoryDismissedPlanningIds.includes(id)) {
      memoryDismissedPlanningIds.push(id);
    }
    return;
  }
  try {
    const current = getDismissedPlanningIds();
    if (!current.includes(id)) {
      localStorage.setItem(PLANNING_DISMISSED_KEY, JSON.stringify([...current, id]));
    }
  } catch {
    // ignorer
  }
}

/**
 * Réinitialise la liste des éléments masqués (utile pour les tests ou restauration).
 */
export function resetDismissedPlanning(): void {
  memoryDismissedPlanningIds = [];
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(PLANNING_DISMISSED_KEY);
    } catch {
      // ignorer
    }
  }
}

/**
 * Construit la liste unifiée des éléments du planning général à partir des chantiers, commandes et RDVs.
 * Filtre automatiquement les éléments supprimés / masqués.
 */
export function buildUnifiedPlanning(
  chantiers: Chantier[],
  commandes: CommandeAvecFournisseur[],
  rdvs: RendezVous[],
  dismissedIds?: string[]
): UnifiedPlanningItem[] {
  const items: UnifiedPlanningItem[] = [];

  // 1. Chantiers
  for (const c of chantiers) {
    if (c.deleted_at) continue;

    let debut = normalizeDate(c.date_debut_prevue);
    let fin = c.date_fin_prevue ? normalizeDate(c.date_fin_prevue) : addDays(debut, 14);

    if (debut > fin) {
      fin = addDays(debut, 7);
    }

    const natureKey = "travaux";
    const cfg = NATURES_CONFIG[natureKey];

    items.push({
      id: `ch-${c.id}`,
      type: "chantier",
      titre: c.nom,
      sousTitre: `${c.ville} · ${c.intervention || "Travaux en cours"}`,
      dateDebut: debut,
      dateFin: fin,
      chantierId: c.id,
      chantierNom: c.nom,
      statut: c.avancementGlobal >= 100 ? "termine" : "en_cours",
      statutLabel: c.avancementGlobal >= 100 ? "Terminé (100%)" : `En cours (${c.avancementGlobal}%)`,
      natureKey,
      dotColor: cfg.dotColor,
      badgeColorClass: cfg.badgeClass,
      avancement: c.avancementGlobal,
      nature: c.prochaineEtape ? `Étape : ${c.prochaineEtape.titre}. ${c.prochaineEtape.detail || ""}` : undefined,
    });
  }

  // 2. Rendez-vous (RDVs)
  for (const r of rdvs) {
    const d = normalizeDate(r.date);
    const heureLabel = r.heure_fin ? `${r.heure_debut} - ${r.heure_fin}` : r.heure_debut;
    const natureKey = categorizeNature(r.nature || r.titre, "rdv", r.nature_type);
    const cfg = NATURES_CONFIG[natureKey];

    items.push({
      id: `rdv-${r.id}`,
      type: "rdv",
      titre: r.titre,
      sousTitre: r.chantier_nom ? `Chantier : ${r.chantier_nom}` : (r.lieu ? `Lieu : ${r.lieu}` : "Rendez-vous client"),
      dateDebut: d,
      dateFin: d,
      heure: heureLabel,
      chantierId: r.chantier_id || undefined,
      chantierNom: r.chantier_nom || undefined,
      statut: r.statut,
      statutLabel: r.statut === "confirme" ? "Confirmé" : r.statut === "effectue" ? "Effectué" : "Planifié",
      natureKey,
      dotColor: cfg.dotColor,
      badgeColorClass: cfg.badgeClass,
      nature: r.nature,
    });
  }

  // 3. Commandes & Livraisons
  for (const cmd of commandes) {
    const fNom = cmd.fournisseur?.nom || "Fournisseur";
    const dateCmd = normalizeDate(cmd.created_at);
    const cfgLiv = NATURES_CONFIG["livraison"];

    // Date de commande
    items.push({
      id: `cmd-${cmd.id}`,
      type: "commande",
      titre: `Commande ${cmd.numero_commande}`,
      sousTitre: `${fNom} · Statut : ${cmd.statut}`,
      dateDebut: dateCmd,
      dateFin: dateCmd,
      chantierId: cmd.chantier_id,
      statut: cmd.statut,
      statutLabel: `Commande ${cmd.statut}`,
      natureKey: "livraison",
      dotColor: cfgLiv.dotColor,
      badgeColorClass: cfgLiv.badgeClass,
      fournisseurNom: fNom,
      nature: cmd.commentaire || `Commande de matériaux auprès de ${fNom}`,
    });

    // Livraison souhaitée / prévue si renseignée
    if (cmd.date_livraison_souhaitee) {
      const dateLiv = normalizeDate(cmd.date_livraison_souhaitee);
      items.push({
        id: `liv-${cmd.id}`,
        type: "livraison",
        titre: `Livraison ${cmd.numero_commande}`,
        sousTitre: `${fNom} (${cmd.date_livraison_souhaitee})`,
        dateDebut: dateLiv,
        dateFin: dateLiv,
        chantierId: cmd.chantier_id,
        statut: "livraison_prevue",
        statutLabel: "Réception attendue",
        natureKey: "livraison",
        dotColor: cfgLiv.dotColor,
        badgeColorClass: cfgLiv.badgeClass,
        fournisseurNom: fNom,
        nature: `Réception sur chantier des matériaux commandés chez ${fNom} (${cmd.date_livraison_souhaitee})`,
      });
    }
  }

  // Filtrer les éléments supprimés ou masqués
  const dismissed =
    dismissedIds !== undefined
      ? dismissedIds
      : typeof window !== "undefined"
      ? getDismissedPlanningIds()
      : memoryDismissedPlanningIds;

  const dismissedSet = new Set(dismissed);
  const activeItems =
    dismissed.length > 0
      ? items.filter((item) => !dismissedSet.has(item.id))
      : items;

  // Tri chronologique
  return activeItems.sort((a, b) => {
    const cmpDate = a.dateDebut.localeCompare(b.dateDebut);
    if (cmpDate !== 0) return cmpDate;
    return a.titre.localeCompare(b.titre);
  });
}

/**
 * Construit la liste unifiée spécifiquement restreinte aux éléments d'un seul chantier (Cockpit V2).
 */
export function buildChantierPlanningItems(
  chantier: Chantier,
  commandes: CommandeAvecFournisseur[],
  rdvs: RendezVous[]
): UnifiedPlanningItem[] {
  const all = buildUnifiedPlanning([chantier], commandes, rdvs);
  return all.filter((item) => {
    if (item.type === "chantier") return item.chantierId === chantier.id;
    return item.chantierId === chantier.id;
  });
}

/**
 * Génère le code source de diagramme Gantt Mermaid.js pour le planning général (V1).
 */
export function generateMermaidGantt(items: UnifiedPlanningItem[]): string {
  const chantiers = items.filter((i) => i.type === "chantier");
  const rdvs = items.filter((i) => i.type === "rdv");
  const livraisons = items.filter((i) => i.type === "livraison" || i.type === "commande");

  const lines: string[] = [
    "gantt",
    "  dateFormat YYYY-MM-DD",
    "  axisFormat %d/%m",
    "  title Planning Général BNA",
  ];

  // Section 1 : Chantiers en cours
  if (chantiers.length > 0) {
    lines.push("  section Chantiers");
    chantiers.slice(0, 6).forEach((c, idx) => {
      const label = sanitizeMermaidText(`${c.titre} (${c.avancement ?? 0}%)`);
      const activeModifier = c.statut === "en_cours" ? ":active, " : ":";
      lines.push(`  ${label} ${activeModifier}ch_${idx}, ${c.dateDebut}, ${c.dateFin || addDays(c.dateDebut, 10)}`);
    });
  }

  // Section 2 : Rendez-vous & Jalons avec balises de nature
  if (rdvs.length > 0) {
    lines.push("  section RDV & Visites");
    rdvs.slice(0, 6).forEach((r, idx) => {
      const heurePart = r.heure ? ` [${r.heure.split("-")[0].trim()}]` : "";
      const label = sanitizeMermaidText(`${r.titre}${heurePart}`);
      const tag = NATURES_CONFIG[r.natureKey]?.tagMermaid || ":";
      lines.push(`  ${label} ${tag}rdv_${idx}, ${r.dateDebut}, 1d`);
    });
  }

  // Section 3 : Commandes & Livraisons
  if (livraisons.length > 0) {
    lines.push("  section Commandes & Livraisons");
    livraisons.slice(0, 6).forEach((cmd, idx) => {
      const label = sanitizeMermaidText(cmd.titre);
      lines.push(`  ${label} :milestone, cmd_${idx}, ${cmd.dateDebut}, 0d`);
    });
  }

  // Fallback si vide
  if (lines.length <= 4) {
    const today = new Date().toISOString().slice(0, 10);
    lines.push("  section Activités");
    lines.push(`  Démarrage planning :active, task_0, ${today}, ${addDays(today, 5)}`);
  }

  return lines.join("\n");
}

/**
 * Génère le code source de diagramme Gantt Mermaid.js pour un chantier spécifique (Cockpit V2).
 * Met en lumière :
 * - La période globale du chantier (dates de début et de fin)
 * - Les commandes et dates de livraison fournisseurs attendues
 * - Les rendez-vous et points d'étape terrain avec leurs couleurs de nature
 */
export function generateChantierMermaidGantt(
  chantier: Chantier,
  commandes: CommandeAvecFournisseur[],
  rdvs: RendezVous[]
): string {
  const debut = normalizeDate(chantier.date_debut_prevue);
  let fin = chantier.date_fin_prevue ? normalizeDate(chantier.date_fin_prevue) : addDays(debut, 14);
  if (debut > fin) fin = addDays(debut, 7);

  const lines: string[] = [
    "gantt",
    "  dateFormat YYYY-MM-DD",
    "  axisFormat %d/%m",
    `  title Planning Chantier — ${sanitizeMermaidText(chantier.nom)}`,
  ];

  // 1. Période & Travaux Chantier
  lines.push("  section Travaux Chantier");
  const chantierLabel = sanitizeMermaidText(`${chantier.nom} (${chantier.avancementGlobal}%)`);
  lines.push(`  ${chantierLabel} :active, ch_travaux, ${debut}, ${fin}`);

  if (chantier.prochaineEtape?.titre) {
    const etapeLabel = sanitizeMermaidText(`Étape : ${chantier.prochaineEtape.titre}`);
    lines.push(`  ${etapeLabel} :active, ch_etape, ${debut}, ${addDays(debut, 4)}`);
  }

  // 2. Commandes & Livraisons Fournisseurs
  const chantierCmds = commandes.filter((c) => c.chantier_id === chantier.id);
  if (chantierCmds.length > 0) {
    lines.push("  section Livraisons & Matériaux");
    chantierCmds.forEach((cmd, idx) => {
      const fNom = cmd.fournisseur?.nom || "Fournisseur";
      if (cmd.date_livraison_souhaitee) {
        const dLiv = normalizeDate(cmd.date_livraison_souhaitee);
        const labelLiv = sanitizeMermaidText(`Livraison ${fNom}`);
        lines.push(`  ${labelLiv} :milestone, ch_liv_${idx}, ${dLiv}, 0d`);
      } else {
        const dCmd = normalizeDate(cmd.created_at);
        const labelCmd = sanitizeMermaidText(`Cmd ${cmd.numero_commande}`);
        lines.push(`  ${labelCmd} :milestone, ch_cmd_${idx}, ${dCmd}, 0d`);
      }
    });
  }

  // 3. Rendez-vous & Jalons Terrain
  const chantierRdvs = rdvs.filter((r) => r.chantier_id === chantier.id);
  if (chantierRdvs.length > 0) {
    lines.push("  section RDV & Jalons Terrain");
    chantierRdvs.forEach((r, idx) => {
      const d = normalizeDate(r.date);
      const heurePart = r.heure_debut ? ` [${r.heure_debut}]` : "";
      const label = sanitizeMermaidText(`${r.titre}${heurePart}`);
      const natureKey = categorizeNature(r.nature || r.titre, "rdv", r.nature_type);
      const tag = NATURES_CONFIG[natureKey]?.tagMermaid || ":";
      lines.push(`  ${label} ${tag}ch_rdv_${idx}, ${d}, 1d`);
    });
  }

  return lines.join("\n");
}

/**
 * Met à jour les dates prévues d'un chantier (début et fin).
 * Persiste localement et synchronise Supabase si connecté.
 */
export async function updateChantierDates(
  supabase: any,
  chantierId: string,
  dateDebutPrevue?: string | null,
  dateFinPrevue?: string | null
): Promise<void> {
  // 1. Persistance locale dans localStorage si disponible
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("bna_chantiers_dates_overrides") || "{}";
      const overrides = JSON.parse(stored);
      overrides[chantierId] = {
        date_debut_prevue: dateDebutPrevue,
        date_fin_prevue: dateFinPrevue,
      };
      localStorage.setItem("bna_chantiers_dates_overrides", JSON.stringify(overrides));
    } catch {
      // ignorer
    }
  }

  // 2. Persistance Supabase si id UUID
  if (supabase && typeof chantierId === "string" && chantierId.length === 36) {
    try {
      await supabase
        .from("chantiers")
        .update({
          date_debut_prevue: dateDebutPrevue || null,
          date_fin_prevue: dateFinPrevue || null,
        })
        .eq("id", chantierId);
    } catch (err) {
      console.warn("Erreur mise à jour dates chantier Supabase :", err);
    }
  }
}

