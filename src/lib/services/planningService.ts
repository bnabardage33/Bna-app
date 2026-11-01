/**
 * BNA-APP — Service Planning Général & Jalons V1
 *
 * Consolide tous les éléments planifiés du dashboard :
 * - Chantiers en cours et à venir (périodes, avancement, étapes)
 * - Rendez-vous clients & réunions de chantier (nature, heure, lieu)
 * - Commandes passées & livraisons fournisseurs attendues
 *
 * Génère le diagramme Gantt Mermaid.js officiel pour l'affichage temps réel.
 */

import type { Chantier } from "@/types/metier";
import type { CommandeAvecFournisseur } from "./commandesFournisseursService";
import type { RendezVous } from "./rendezVousService";

export type PlanningItemType = "chantier" | "rdv" | "commande" | "livraison";

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
  badgeColorClass: string;
  nature?: string;   // Description détaillée / encadré nature du rdv
  fournisseurNom?: string;
  avancement?: number;
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

/**
 * Construit la liste unifiée des éléments du planning à partir des chantiers, commandes et RDVs.
 */
export function buildUnifiedPlanning(
  chantiers: Chantier[],
  commandes: CommandeAvecFournisseur[],
  rdvs: RendezVous[]
): UnifiedPlanningItem[] {
  const items: UnifiedPlanningItem[] = [];

  // 1. Chantiers
  for (const c of chantiers) {
    if (c.deleted_at) continue;

    // Dates prévues ou déduites
    let debut = normalizeDate(c.date_debut_prevue);
    let fin = c.date_fin_prevue ? normalizeDate(c.date_fin_prevue) : addDays(debut, 14);

    if (debut > fin) {
      fin = addDays(debut, 7);
    }

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
      badgeColorClass:
        c.avancementGlobal >= 100
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-blue-50 text-blue-800 border-blue-200",
      avancement: c.avancementGlobal,
      nature: c.prochaineEtape ? `Étape : ${c.prochaineEtape.titre}. ${c.prochaineEtape.detail || ""}` : undefined,
    });
  }

  // 2. Rendez-vous (RDVs)
  for (const r of rdvs) {
    const d = normalizeDate(r.date);
    const heureLabel = r.heure_fin ? `${r.heure_debut} - ${r.heure_fin}` : r.heure_debut;

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
      badgeColorClass:
        r.statut === "confirme"
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : r.statut === "effectue"
          ? "bg-slate-100 text-slate-700 border-slate-300"
          : "bg-amber-50 text-amber-800 border-amber-200",
      nature: r.nature,
    });
  }

  // 3. Commandes & Livraisons
  for (const cmd of commandes) {
    const fNom = cmd.fournisseur?.nom || "Fournisseur";
    const dateCmd = normalizeDate(cmd.created_at);

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
      badgeColorClass: "bg-purple-50 text-purple-800 border-purple-200",
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
        badgeColorClass: "bg-orange-50 text-bna-copper border-orange-200",
        fournisseurNom: fNom,
        nature: `Réception sur chantier des matériaux commandés chez ${fNom} (${cmd.date_livraison_souhaitee})`,
      });
    }
  }

  // Tri chronologique
  return items.sort((a, b) => {
    const cmpDate = a.dateDebut.localeCompare(b.dateDebut);
    if (cmpDate !== 0) return cmpDate;
    return a.titre.localeCompare(b.titre);
  });
}

/**
 * Génère le code source de diagramme Gantt Mermaid.js à partir des éléments du planning.
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

  // Section 2 : Rendez-vous & Jalons
  if (rdvs.length > 0) {
    lines.push("  section RDV & Visites");
    rdvs.slice(0, 6).forEach((r, idx) => {
      const heurePart = r.heure ? ` [${r.heure.split("-")[0].trim()}]` : "";
      const label = sanitizeMermaidText(`${r.titre}${heurePart}`);
      const critModifier = r.statut === "confirme" ? ":crit, " : ":";
      lines.push(`  ${label} ${critModifier}rdv_${idx}, ${r.dateDebut}, 1d`);
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
