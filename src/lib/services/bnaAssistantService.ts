/**
 * BNA-APP — Service Assistant IA Central (Copilote Métier Gaël)
 *
 * Responsabilités :
 * 1. Agréger en temps réel le contexte opérationnel (Chantiers, Planning, RDVs, Commandes, Météo).
 * 2. Fournir la base de connaissances réglementaire DTU (DTU 51.4, DTU 41.2, DTU 45.4, P98-405).
 * 3. Détecter les intentions d'action (Tool Calling : Créer RDV, Maj Avancement, Ouvrir Calepinage, Chiffrage).
 * 4. Générer des réponses expertes structurées et des Cartes d'Action (Action Cards) soumises à validation.
 */

import type { Chantier } from "@/types/metier";
import type { RendezVous } from "./rendezVousService";
import type { CommandeAvecFournisseur } from "./commandesFournisseursService";
import {
  calculerBilanFinancierGlobal,
  fmtEuro,
  type DevisItem,
  type FactureItem,
} from "./devisFinanceService.ts";
import {
  getPvReceptions,
  getTicketsSav,
  calculerSynthesePvSav,
  LABELS_STATUT_PV,
  LABELS_GARANTIE_SAV,
  type PvReceptionItem,
  type TicketSavItem,
} from "./pvSavService.ts";

export type AssistantActionType =
  | "create_rdv"
  | "update_avancement"
  | "open_calepinage"
  | "open_cockpit"
  | "open_planning"
  | "create_devis"
  | "open_devis";

export interface AssistantAction {
  id: string;
  type: AssistantActionType;
  title: string;
  description: string;
  executed?: boolean;
  payload: {
    chantierId?: string;
    chantierNom?: string;
    // Pour create_rdv
    rdvTitre?: string;
    rdvDate?: string;
    rdvHeureDebut?: string;
    rdvHeureFin?: string;
    rdvNature?: string;
    rdvLieu?: string;
    // Pour update_avancement
    nouvelAvancement?: number;
    // Pour open_calepinage / create_devis
    metier?: "terrasse" | "facade" | "cloture";
    devisQuantite?: number;
    devisUnite?: string;
    devisPuFournitureHt?: number;
    devisPuPoseHt?: number;
    devisObjet?: string;
  };
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  actions?: AssistantAction[];
  tags?: string[];
}

export interface AssistantContext {
  userName: string;
  userRole: string;
  currentDateIso: string;
  activeChantierId?: string;
  chantiers: Chantier[];
  rdvs: RendezVous[];
  commandes: CommandeAvecFournisseur[];
  devis?: DevisItem[];
  factures?: FactureItem[];
}

/**
 * Base de connaissances certifiée DTU BNA
 */
export const DTU_KNOWLEDGE_BASE = {
  terrasse_51_4: {
    code: "NF DTU 51.4",
    titre: "Platelages extérieurs en bois et matériaux composites",
    regles: [
      "Entraxe lambourdes : 40 cm à 50 cm max selon l'épaisseur et l'essence des lames (40 cm recommandé en usage intensif ou composite).",
      "Aboutage des lames : obligation d'un double appui (2 lambourdes accolées ou plots dédiés) ou éclissage pour respecter les 20 mm de distance minimale entre la vis et l'extrémité de la lame.",
      "Jeu inter-lames (écartement) : 5 mm minimum à la pose (bois humide 18%) jusqu'à 8 mm pour bois sec.",
      "Jeu de dilatation périphérique : 10 à 15 mm minimum contre tout mur ou obstacle maçonné.",
      "Ventilation sous platelage : hauteur libre minimale de 50 mm sous les lambourdes pour la circulation d'air, avec pente du sol de 1% à 1,5% pour l'évacuation des eaux.",
      "Fixations : 2 vis inox A2 (ou A4 en bord de mer / piscine au sel) par croisement lame/lambourde, enfoncées sans fissurer le bois.",
      "Protection bitumineuse : bande EPDM obligatoire sur le dessus des lambourdes bois pour éviter le piégeage d'eau aux jonctions.",
    ],
  },
  bardage_41_2: {
    code: "NF DTU 41.2",
    titre: "Revêtements extérieurs en bois (Bardage bois)",
    regles: [
      "Lame d'air ventilée : épaisseur minimale obligatoire de 20 mm derrière le bardage sur toute la hauteur.",
      "Grilles anti-rongeurs : obligatoires en pied et en tête de bardage (ouverture d'entrée d'air min. 50 cm²/ml).",
      "Garde au sol : 20 cm minimum au-dessus du sol fini (réduit à 15 cm au-dessus d'une zone revêtue drainante ou terrasse).",
      "Taux d'humidité du bois à la pose : compris strictement entre 13% et 18% (acclimatation sur site 72h recommandée).",
      "Pare-pluie : membrane HPV (Haute Perméabilité à la Vapeur d'eau, Sd <= 0,18 m) posée tendue avec recouvrement de 10 cm entre lés.",
      "Entraxe chevrons / tasseaux : 40 cm à 65 cm maximum selon l'épaisseur du clin (18 mm minimum en pose courante).",
      "Conditions météo interdites : pas de pose sous pluie battante (> 2 mm/h), vent > 50 km/h ou gel (< 2°C).",
    ],
  },
  bardage_hpl_45_4: {
    code: "NF DTU 45.4 / Avis Technique HPL (Polyrey / Trespa)",
    titre: "Bardage rapporté en panneaux stratifiés HPL compacts",
    regles: [
      "Jeu de dilatation entre panneaux : 8 mm à 10 mm obligatoire sur tout le pourtour de chaque panneau.",
      "Principe Point Fixe / Points Coulissants : chaque panneau doit avoir 1 point fixe central (perçage égal au diamètre de la vis/rivet) et des points coulissants (perçage surdimensionné de 8 à 10 mm) pour absorber la dilatation hygrothermique.",
      "Distance au bord des perçages : entre 20 mm et 80 mm du bord du panneau.",
      "Bande EPDM noire : obligatoire sur tous les montants d'ossature au droit des joints verticaux et sous les panneaux.",
    ],
  },
  cloture_p98: {
    code: "Norme NF P98-405 / Eurocode 1",
    titre: "Clôtures rigides, panneaux soudés et occultations",
    regles: [
      "Scellement des poteaux : profondeur de béton de 50 cm à 60 cm minimum (30x30x50 cm ou 40x40x60 cm en cas d'occultation brise-vue pour résister à la prise au vent).",
      "Entraxe poteaux : adapté à la largeur nominale du panneau (généralement 2,50 m d'entraxe).",
      "Platine sur muret : autorisée jusqu'à 1,50 m de hauteur hors occultation ; au-delà ou avec lames occultantes, le carottage ou scellement dans le chaînage est fortement recommandé.",
    ],
  },
};

/**
 * Tarifs indicatifs BNA pour pré-chiffrage rapide par l'Assistant
 */
export const BNA_TARIFS_INDICATIFS = {
  terrasse: {
    pin_classe_4: { fourniture_ht_m2: 45, pose_ht_m2: 65, total_ht_m2: 110, label: "Terrasse Pin Classe 4" },
    douglas_meleze: { fourniture_ht_m2: 65, pose_ht_m2: 70, total_ht_m2: 135, label: "Terrasse Douglas / Mélèze" },
    exotique_cumaru_ipe: { fourniture_ht_m2: 115, pose_ht_m2: 80, total_ht_m2: 195, label: "Terrasse Bois Exotique (Cumaru / Ipé)" },
    composite_pro: { fourniture_ht_m2: 95, pose_ht_m2: 75, total_ht_m2: 170, label: "Terrasse Composite Haute Densité" },
  },
  bardage: {
    douglas_clin: { fourniture_ht_m2: 55, pose_ht_m2: 75, total_ht_m2: 130, label: "Bardage Bois Douglas / Épicéa" },
    red_cedar_meleze: { fourniture_ht_m2: 95, pose_ht_m2: 85, total_ht_m2: 180, label: "Bardage Red Cedar / Mélèze" },
    hpl_polyrey_trespa: { fourniture_ht_m2: 125, pose_ht_m2: 95, total_ht_m2: 220, label: "Bardage HPL Compact (Polyrey / Trespa)" },
  },
  cloture: {
    rigide_standard: { fourniture_ht_ml: 45, pose_ht_ml: 50, total_ht_ml: 95, label: "Clôture Rigide Scellée" },
    rigide_soubassement_occultant: { fourniture_ht_ml: 85, pose_ht_ml: 65, total_ht_ml: 150, label: "Clôture Rigide + Soubassement Béton + Occultation" },
  },
};

/**
 * Analyse l'impact météo d'un chantier pour en déduire le statut de pose DTU
 */
export function getChantierMeteoInfo(c: Chantier): {
  statutPose: "favorable" | "attention" | "deconseille";
  alerte: string;
  consignes: string[];
} {
  const alerte = c.meteoImpact?.alerte || "Conditions stables";
  const consignes = c.meteoImpact?.consignes || [];
  const lower = alerte.toLowerCase();

  let statutPose: "favorable" | "attention" | "deconseille" = "favorable";
  if (
    lower.includes("interruption") ||
    lower.includes("fort") ||
    lower.includes("orage") ||
    lower.includes("gel") ||
    lower.includes("arrêt")
  ) {
    statutPose = "deconseille";
  } else if (
    lower.includes("pluie") ||
    lower.includes("averse") ||
    lower.includes("vent") ||
    lower.includes("vigilance")
  ) {
    statutPose = "attention";
  }

  return { statutPose, alerte, consignes };
}

/**
 * Construit le résumé textuel du contexte opérationnel pour le System Prompt d'un LLM
 */
export function buildSystemPromptContext(ctx: AssistantContext): string {
  const chantiersText =
    ctx.chantiers.length === 0
      ? "Aucun chantier actif."
      : ctx.chantiers
          .map((c) => {
            const m = getChantierMeteoInfo(c);
            return `- [${c.id}] ${c.nom} (${c.ville}, métier: ${c.metier}) : avancement ${c.avancementGlobal}%, étape actuelle: "${c.intervention}", météo: ${m.alerte} (statut pose: ${m.statutPose})`;
          })
          .join("\n");

  const rdvsText =
    ctx.rdvs.length === 0
      ? "Aucun rendez-vous planifié."
      : ctx.rdvs
          .map(
            (r) =>
              `- [${r.date} à ${r.heure_debut}] ${r.titre} (${r.chantier_nom || r.lieu || "Général"}) — Statut: ${r.statut}. Nature: ${r.nature}`
          )
          .join("\n");

  const commandesText =
    ctx.commandes.length === 0
      ? "Aucune commande fournisseur en cours."
      : ctx.commandes
          .map(
            (cmd) =>
              `- ${cmd.numero_commande} chez ${cmd.fournisseur?.nom || "Fournisseur"} (Chantier: ${cmd.chantier_id}) — Statut: ${cmd.statut}, Livraison souhaitée: ${cmd.date_livraison_souhaitee || "Non précisée"}`
          )
          .join("\n");

  const bilan = calculerBilanFinancierGlobal(ctx.devis || [], ctx.factures || []);
  const financeText = `CA Signé HT: ${fmtEuro(bilan.ca_signe_ht)} | Pipeline en attente: ${fmtEuro(bilan.pipeline_en_attente_ht)} | Encaissé TTC: ${fmtEuro(bilan.encaisse_ttc)} | Reste à facturer HT: ${fmtEuro(bilan.reste_a_facturer_ht)} | Marge brute moyenne: ${bilan.taux_marge_moyen_pct}% (${fmtEuro(bilan.marge_globale_signee_ht)}) | Factures en retard: ${bilan.nb_factures_retard} (${fmtEuro(bilan.en_retard_ttc)})`;

  return `Tu es l'Assistant IA Central de BNA (Bardage & Aménagement Extérieur en Gironde).
Tu t'adresses directement à ${ctx.userName} (${ctx.userRole} de BNA).
Date du jour : ${ctx.currentDateIso}.

CHANTIERS ACTIFS (${ctx.chantiers.length}) :
${chantiersText}

RENDEZ-VOUS PLANIFIÉS (${ctx.rdvs.length}) :
${rdvsText}

COMMANDES FOURNISSEURS (${ctx.commandes.length}) :
${commandesText}

TRÉSORERIE, DEVIS & FACTURES :
${financeText}

RÈGLES MÉTIERS :
- Sois concis, précis, professionnel et orienté terrain.
- Appuie toujours tes conseils techniques sur les normes NF DTU 51.4 (Terrasse), NF DTU 41.2 (Bardage bois), NF DTU 45.4 (Bardage HPL) et NF P98-405 (Clôture).
- Si Gaël demande de planifier un RDV, modifier un avancement ou créer un devis, confirme les détails clairement.`;
}

/**
 * Recherche un chantier mentionné dans le message de l'utilisateur
 */
export function findMentionedChantier(
  message: string,
  chantiers: Chantier[],
  activeChantierId?: string
): Chantier | undefined {
  const lower = message.toLowerCase();
  for (const c of chantiers) {
    const nomWords = c.nom.toLowerCase().split(/\s+/);
    if (
      lower.includes(c.nom.toLowerCase()) ||
      lower.includes(c.ville.toLowerCase()) ||
      lower.includes(c.id.toLowerCase()) ||
      nomWords.some((w) => w.length > 3 && lower.includes(w))
    ) {
      return c;
    }
  }
  if (activeChantierId) {
    return chantiers.find((c) => c.id === activeChantierId);
  }
  return chantiers[0];
}

/**
 * Extrait une date (YYYY-MM-DD) depuis une expression naturelle ("demain", "aujourd'hui", "05/11/2026", etc.)
 */
export function parseNaturalDate(text: string, baseDateIso?: string): string {
  const base = baseDateIso ? new Date(baseDateIso) : new Date();
  if (isNaN(base.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const lower = text.toLowerCase();

  // Format explicite DD/MM/YYYY
  const frMatch = lower.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (frMatch) {
    const day = frMatch[1].padStart(2, "0");
    const month = frMatch[2].padStart(2, "0");
    const year = frMatch[3] || String(base.getFullYear());
    return `${year}-${month}-${day}`;
  }

  // Format explicite YYYY-MM-DD
  const isoMatch = lower.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  if (lower.includes("après-demain") || lower.includes("apres-demain")) {
    const d = new Date(base);
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  }

  if (lower.includes("demain")) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  const joursSemaine = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  for (let i = 0; i < joursSemaine.length; i++) {
    if (lower.includes(joursSemaine[i])) {
      const d = new Date(base);
      const currentDay = d.getDay();
      let diff = (i - currentDay + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    }
  }

  // Par défaut : demain
  const tomorrow = new Date(base);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

/**
 * Extrait une heure ("09:30", "14:00") depuis une expression naturelle ("14h", "9h30", "10:15")
 */
export function parseNaturalTime(text: string): string {
  const match = text.match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/i);
  if (match) {
    const hh = Math.min(23, Math.max(0, Number(match[1]))).toString().padStart(2, "0");
    const mm = match[2] ? match[2].padStart(2, "0") : "00";
    return `${hh}:${mm}`;
  }
  return "09:00";
}

/**
 * Détecte les actions proposées à partir de la requête de Gaël
 */
export function detectAssistantActions(
  message: string,
  ctx: AssistantContext
): AssistantAction[] {
  const lower = message.toLowerCase();
  const actions: AssistantAction[] = [];
  const targetChantier = findMentionedChantier(message, ctx.chantiers, ctx.activeChantierId);

  // 1. Intention : Planifier / Créer un RDV
  if (
    lower.includes("planifie") ||
    lower.includes("programme") ||
    lower.includes("ajoute un rdv") ||
    lower.includes("ajouter un rdv") ||
    lower.includes("créer un rdv") ||
    lower.includes("creer un rdv") ||
    lower.includes("nouveau rdv") ||
    lower.includes("rendez-vous") ||
    lower.includes("visite technique")
  ) {
    const rdvDate = parseNaturalDate(message, ctx.currentDateIso);
    const rdvHeure = parseNaturalTime(message);

    let rdvTitre = "Visite technique & point d'étape";
    let rdvNature = "Contrôle d'avancement sur site, vérification des règles DTU et point avec le client.";

    if (lower.includes("réception") || lower.includes("reception") || lower.includes("pv")) {
      rdvTitre = "Réception de chantier & signature PV";
      rdvNature = "Tour complet de l'ouvrage avec le client, contrôle des finitions et signature du procès-verbal de réception.";
    } else if (lower.includes("lambourde") || lower.includes("plot")) {
      rdvTitre = "Contrôle réglage plots & lambourdes (DTU 51.4)";
      rdvNature = "Vérification de la planéité, de l'entraxe des lambourdes, des doubles appuis d'aboutage et de la pose des bandes EPDM.";
    } else if (lower.includes("pare-pluie") || lower.includes("bardage") || lower.includes("ossature")) {
      rdvTitre = "Point technique ossature & pare-pluie (DTU 41.2)";
      rdvNature = "Contrôle de la lame d'air ventilée (20 mm), de la grille anti-rongeurs et de l'humidité du bois (13-18%).";
    } else if (lower.includes("livraison")) {
      rdvTitre = "Réception livraison matériaux sur chantier";
      rdvNature = "Contrôle quantitatif et qualitatif des matériaux livrés sur site.";
    }

    actions.push({
      id: `act-rdv-${Date.now()}`,
      type: "create_rdv",
      title: `Planifier : ${rdvTitre}`,
      description: `${targetChantier ? `Chantier ${targetChantier.nom} (${targetChantier.ville})` : "Rendez-vous général"} · Le ${rdvDate} à ${rdvHeure}`,
      payload: {
        chantierId: targetChantier?.id,
        chantierNom: targetChantier?.nom,
        rdvTitre,
        rdvDate,
        rdvHeureDebut: rdvHeure,
        rdvNature,
        rdvLieu: targetChantier?.ville || "Gironde",
      },
    });
  }

  // 2. Intention : Mettre à jour l'avancement d'un chantier
  const pctMatch = lower.match(/(\d{1,3})\s*%/);
  if (
    pctMatch &&
    targetChantier &&
    (lower.includes("avancement") ||
      lower.includes("passe") ||
      lower.includes("mettre") ||
      lower.includes("monte") ||
      lower.includes("actualise") ||
      lower.includes("termine"))
  ) {
    const pct = Math.min(100, Math.max(0, Number(pctMatch[1])));
    actions.push({
      id: `act-av-${Date.now()}`,
      type: "update_avancement",
      title: `Actualiser l'avancement à ${pct}%`,
      description: `Passer le chantier "${targetChantier.nom}" de ${targetChantier.avancementGlobal}% à ${pct}%`,
      payload: {
        chantierId: targetChantier.id,
        chantierNom: targetChantier.nom,
        nouvelAvancement: pct,
      },
    });
  }

  // 3. Intention : Ouvrir un calepinage
  if (
    lower.includes("calepinage") ||
    lower.includes("quantitatif") ||
    lower.includes("calculer les lames") ||
    lower.includes("calculer le bardage")
  ) {
    const metier: "terrasse" | "facade" | "cloture" = lower.includes("bardage") || lower.includes("façade") || lower.includes("facade")
      ? "facade"
      : lower.includes("clôture") || lower.includes("cloture")
      ? "cloture"
      : "terrasse";

    actions.push({
      id: `act-cal-${Date.now()}`,
      type: "open_calepinage",
      title: `Ouvrir le moteur de Calepinage (${metier.toUpperCase()})`,
      description: targetChantier
        ? `Lancer le dimensionnement DTU pour ${targetChantier.nom}`
        : "Accéder au calculateur géométrique et plans 2D/3D",
      payload: {
        chantierId: targetChantier?.id,
        chantierNom: targetChantier?.nom,
        metier,
      },
    });
  }

  // 4. Intention : Créer automatiquement un Devis BNA chiffré
  if (
    (lower.includes("crée un devis") ||
      lower.includes("cree un devis") ||
      lower.includes("créer un devis") ||
      lower.includes("creer un devis") ||
      lower.includes("génère un devis") ||
      lower.includes("genere un devis") ||
      lower.includes("nouveau devis")) &&
    !lower.includes("combien")
  ) {
    const surfaceMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|ml)/i);
    const qte = surfaceMatch ? parseFloat(surfaceMatch[1].replace(",", ".")) : 35;
    const isBardage = lower.includes("bardage") || lower.includes("façade") || lower.includes("hpl");
    const isCloture = lower.includes("clôture") || lower.includes("cloture");
    const metier: "terrasse" | "facade" | "cloture" = isBardage
      ? "facade"
      : isCloture
      ? "cloture"
      : "terrasse";
    const unite = isCloture ? "ml" : "m²";
    const puFourniture = isBardage ? 115 : isCloture ? 75 : 95;
    const puPose = isBardage ? 85 : isCloture ? 55 : 72;

    actions.push({
      id: `act-dev-${Date.now()}`,
      type: "create_devis",
      title: `Créer Devis ${metier.toUpperCase()} (${qte} ${unite})`,
      description: `${
        targetChantier ? `Chantier ${targetChantier.nom}` : "Nouveau client"
      } · Total estimé : ${fmtEuro(qte * (puFourniture + puPose))} HT`,
      payload: {
        chantierId: targetChantier?.id,
        chantierNom: targetChantier?.nom || "Projet BNA",
        metier,
        devisQuantite: qte,
        devisUnite: unite,
        devisPuFournitureHt: puFourniture,
        devisPuPoseHt: puPose,
        devisObjet: `Travaux ${metier.toUpperCase()} (${qte} ${unite}) conforme DTU`,
      },
    });
  }

  return actions;
}

/**
 * Moteur de réponse expert BNA (déterministe, rapide, fonctionnel avec ou sans clé API LLM externe)
 */
export function generateLocalAssistantResponse(
  message: string,
  ctx: AssistantContext
): { content: string; actions: AssistantAction[]; tags: string[] } {
  const lower = message.toLowerCase();
  const actions = detectAssistantActions(message, ctx);
  const tags: string[] = [];

  // CAS 1 : Briefing général / Synthèse des chantiers et alertes du jour
  if (
    lower.includes("synthèse") ||
    lower.includes("synthese") ||
    lower.includes("bilan") ||
    lower.includes("point du jour") ||
    lower.includes("briefing") ||
    lower.includes("état des chantiers") ||
    lower.includes("etat des chantiers") ||
    lower.includes("bonjour")
  ) {
    tags.push("Briefing Opérationnel", "Pilotage Gaël");
    const nbChantiers = ctx.chantiers.length;
    const moyAvancement =
      nbChantiers > 0
        ? Math.round(ctx.chantiers.reduce((acc, c) => acc + c.avancementGlobal, 0) / nbChantiers)
        : 0;
    const chantiersAlerte = ctx.chantiers.filter((c) => {
      const m = getChantierMeteoInfo(c);
      return m.statutPose === "deconseille" || m.statutPose === "attention" || Boolean(c.blocage);
    });

    const lines: string[] = [
      `Bonjour ${ctx.userName}, voici votre point de pilotage BNA en direct :`,
      "",
      `📊 **Chantiers actifs (${nbChantiers})** — Avancement moyen : **${moyAvancement}%**`,
    ];

    for (const c of ctx.chantiers) {
      const m = getChantierMeteoInfo(c);
      const statutIcon =
        m.statutPose === "favorable"
          ? "🟢"
          : m.statutPose === "attention"
          ? "🟠"
          : "🔴";
      lines.push(
        `• **${c.nom}** (${c.ville}) : **${c.avancementGlobal}%** — *${c.intervention}* ${statutIcon} Météo : ${m.alerte}`
      );
    }

    lines.push("");
    lines.push(`📅 **Planning & Rendez-vous** : **${ctx.rdvs.length}** RDV(s) enregistré(s)`);
    if (ctx.rdvs.length > 0) {
      ctx.rdvs.slice(0, 3).forEach((r) => {
        lines.push(`• **${r.date} à ${r.heure_debut}** : ${r.titre} (${r.chantier_nom || r.lieu || "BNA"})`);
      });
    }

    lines.push("");
    lines.push(`📦 **Approvisionnements** : **${ctx.commandes.length}** commande(s) fournisseur(s) suivie(s)`);
    if (chantiersAlerte.length > 0) {
      lines.push("");
      lines.push(
        `⚠️ **Points de vigilance** : ${chantiersAlerte
          .map((c) => `${c.nom} (${c.meteoImpact?.alerte || c.blocage?.titre || "vigilance"})`)
          .join(", ")}.`
      );
    }

    return { content: lines.join("\n"), actions, tags };
  }

  // CAS 2 : Questions réglementaires DTU (Terrasse 51.4, Bardage 41.2 / HPL 45.4, Clôture)
  if (
    lower.includes("dtu") ||
    lower.includes("norme") ||
    lower.includes("entraxe") ||
    lower.includes("lame d'air") ||
    lower.includes("aboutage") ||
    lower.includes("epdm") ||
    lower.includes("dilatation") ||
    lower.includes("humidité") ||
    lower.includes("humidite")
  ) {
    tags.push("Expertise DTU", "Conformité Technique");
    const blocks: string[] = [];

    if (lower.includes("bardage") || lower.includes("41.2") || lower.includes("lame d'air") || lower.includes("pare-pluie")) {
      blocks.push(`### 🪵 ${DTU_KNOWLEDGE_BASE.bardage_41_2.code} — ${DTU_KNOWLEDGE_BASE.bardage_41_2.titre}`);
      DTU_KNOWLEDGE_BASE.bardage_41_2.regles.forEach((r) => blocks.push(`• ${r}`));
    }

    if (lower.includes("hpl") || lower.includes("polyrey") || lower.includes("trespa") || lower.includes("45.4") || lower.includes("point fixe")) {
      if (blocks.length > 0) blocks.push("");
      blocks.push(`### 🏢 ${DTU_KNOWLEDGE_BASE.bardage_hpl_45_4.code} — ${DTU_KNOWLEDGE_BASE.bardage_hpl_45_4.titre}`);
      DTU_KNOWLEDGE_BASE.bardage_hpl_45_4.regles.forEach((r) => blocks.push(`• ${r}`));
    }

    if (lower.includes("clôture") || lower.includes("cloture") || lower.includes("poteau") || lower.includes("scellement")) {
      if (blocks.length > 0) blocks.push("");
      blocks.push(`### 🛡️ ${DTU_KNOWLEDGE_BASE.cloture_p98.code} — ${DTU_KNOWLEDGE_BASE.cloture_p98.titre}`);
      DTU_KNOWLEDGE_BASE.cloture_p98.regles.forEach((r) => blocks.push(`• ${r}`));
    }

    // Par défaut ou si terrasse mentionnée : DTU 51.4 + résumé bardage
    if (blocks.length === 0 || lower.includes("terrasse") || lower.includes("51.4") || lower.includes("lambourde") || lower.includes("plot")) {
      if (blocks.length > 0) blocks.push("");
      blocks.push(`### 📐 ${DTU_KNOWLEDGE_BASE.terrasse_51_4.code} — ${DTU_KNOWLEDGE_BASE.terrasse_51_4.titre}`);
      DTU_KNOWLEDGE_BASE.terrasse_51_4.regles.forEach((r) => blocks.push(`• ${r}`));

      if (!lower.includes("terrasse") && !lower.includes("51.4") && blocks.length <= 9) {
        blocks.push("");
        blocks.push(`### 🪵 ${DTU_KNOWLEDGE_BASE.bardage_41_2.code} — ${DTU_KNOWLEDGE_BASE.bardage_41_2.titre}`);
        DTU_KNOWLEDGE_BASE.bardage_41_2.regles.slice(0, 4).forEach((r) => blocks.push(`• ${r}`));
      }
    }

    return {
      content: blocks.join("\n"),
      actions,
      tags,
    };
  }

  // CAS 3 : Météo & Faisabilité de pose sur les chantiers
  if (
    lower.includes("météo") ||
    lower.includes("meteo") ||
    lower.includes("pluie") ||
    /\bvent\b/i.test(lower) ||
    lower.includes("intempérie") ||
    lower.includes("intemperie") ||
    lower.includes("poser demain") ||
    lower.includes("conditions de pose")
  ) {
    tags.push("Météo Chantier", "Sécurité Pose DTU");
    const lines: string[] = [
      `🌦️ **Analyse Météo & Conformité de Pose sur vos chantiers :**`,
      "",
    ];

    for (const c of ctx.chantiers) {
      const m = getChantierMeteoInfo(c);
      const badge =
        m.statutPose === "favorable"
          ? "✅ **POSE FAVORABLE**"
          : m.statutPose === "attention"
          ? "⚠️ **VIGILANCE POSE**"
          : "🛑 **POSE DÉCONSEILLÉE**";

      lines.push(`**${c.nom} (${c.ville})** — ${badge}`);
      lines.push(`• Diagnostic météo : *${m.alerte}*`);
      if (m.consignes && m.consignes.length > 0) {
        lines.push(`• Consignes DTU : ${m.consignes.join(" · ")}`);
      }
      lines.push("");
    }

    return { content: lines.join("\n").trim(), actions, tags };
  }

  // CAS 3.5 : Trésorerie, Chiffre d'affaires, Factures, Relances & Marges
  if (
    lower.includes("trésorerie") ||
    lower.includes("tresorerie") ||
    lower.includes("chiffre d'affaires") ||
    lower.includes("facture") ||
    lower.includes("marge") ||
    lower.includes("rentabilité") ||
    lower.includes("rentabilite") ||
    lower.includes("relance") ||
    lower.includes("impayé") ||
    lower.includes("impaye") ||
    lower.includes("retenue de garantie") ||
    lower.includes("reste à facturer")
  ) {
    tags.push("Pilotage Financier", "Trésorerie & Marges");
    const bilan = calculerBilanFinancierGlobal(ctx.devis || [], ctx.factures || []);
    const facturesRetard = (ctx.factures || []).filter((f) => f.statut === "en_retard");

    const lines: string[] = [
      `💶 **Bilan Financier & Trésorerie BNA en direct :**`,
      "",
      `• **Chiffre d'Affaires Signé HT** : **${fmtEuro(bilan.ca_signe_ht)}** (${fmtEuro(bilan.ca_signe_ttc)} TTC)`,
      `• **Pipeline Devis en attente** : **${fmtEuro(bilan.pipeline_en_attente_ht)} HT**`,
      `• **Marge Brute Signée** : **${fmtEuro(bilan.marge_globale_signee_ht)} HT** (Taux moyen : **${bilan.taux_marge_moyen_pct}%**)`,
      "",
      `🏦 **Facturation & Encaissements :**`,
      `• **Déjà encaissé TTC** : **${fmtEuro(bilan.encaisse_ttc)}**`,
      `• **En attente d'encaissement TTC** : **${fmtEuro(bilan.en_attente_encaissement_ttc)}**`,
      `• **Reste à facturer sur chantiers signés** : **${fmtEuro(bilan.reste_a_facturer_ht)} HT**`,
      `• **Retenues de garantie 5% (Loi 71-584)** : **${fmtEuro(bilan.retenues_garantie_cumulees_ttc)} TTC**`,
    ];

    if (facturesRetard.length > 0) {
      lines.push("");
      lines.push(`⚠️ **Factures en retard à relancer (${facturesRetard.length}) :**`);
      facturesRetard.forEach((f) => {
        lines.push(
          `• **${f.numero}** — ${f.client_nom} (${f.chantier_nom}) : **${fmtEuro(f.net_a_payer_ttc)} TTC** (Échéance dépassée : ${f.date_echeance})`
        );
      });
    }

    return {
      content: lines.join("\n"),
      actions: [
        ...actions,
        {
          id: `act-open-devis-${Date.now()}`,
          type: "open_devis",
          title: "Ouvrir l'espace Devis, Factures & Marges",
          description: "Consulter les devis, émettre une situation d'avancement ou relancer une facture",
          payload: {},
        },
      ],
      tags,
    };
  }

  // CAS 3.6 : PV de Réception, Réserves à lever & Interventions SAV / Garantie Décennale
  if (
    lower.includes("pv") ||
    lower.includes("réception") ||
    lower.includes("reception") ||
    lower.includes("réserve") ||
    lower.includes("reserve") ||
    lower.includes("sav") ||
    lower.includes("décennale") ||
    lower.includes("decennale") ||
    lower.includes("garantie") ||
    lower.includes("sinistre")
  ) {
    tags.push("PV de Réception", "SAV & Garantie Décennale");
    const pvs = getPvReceptions();
    const savs = getTicketsSav();
    const synthese = calculerSynthesePvSav(pvs, savs);

    const lines: string[] = [
      `🛡️ **État des PV de Réception, Réserves & Interventions SAV BNA :**`,
      "",
      `• **Procès-Verbaux enregistrés** : **${synthese.total_pv}** (${synthese.nb_reserves_non_levees} réserve(s) restant à lever)`,
    ];

    for (const pv of pvs) {
      const nonLevees = pv.reserves.filter((r) => !r.levee);
      lines.push(
        `  ↳ **${pv.numero}** — **${pv.chantier_nom}** (${pv.client_nom}) : *${LABELS_STATUT_PV[pv.statut].label}*`
      );
      if (nonLevees.length > 0) {
        nonLevees.forEach((r) => {
          lines.push(`     ⚠️ Réserve à lever avant le ${r.date_limite} : *"${r.designation}"* (${r.localisation})`);
        });
      }
    }

    lines.push("");
    lines.push(`🔧 **Tickets SAV & Garantie Décennale / GPA (${synthese.tickets_sav_ouverts} actif(s)) :**`);
    for (const sav of savs) {
      lines.push(
        `  ↳ **${sav.numero}** — **${sav.chantier_nom}** : *${sav.type_sinistre}* (${LABELS_GARANTIE_SAV[sav.type_garantie]}) — Intervention prévue le **${sav.date_intervention}**`
      );
      lines.push(`     Diagnostic DTU : *${sav.diagnostic_dtu}*`);
    }

    return {
      content: lines.join("\n"),
      actions: [
        ...actions,
        {
          id: `act-open-pvsav-${Date.now()}`,
          type: "open_devis",
          title: "Ouvrir l'onglet PV de Réception & SAV",
          description: "Pointer la levée des réserves, libérer la retenue 5% ou éditer un rapport SAV",
          payload: {},
        },
      ],
      tags,
    };
  }

  // CAS 4 : Simulation de Chiffrage / Devis rapide
  if (
    !actions.some((a) => a.type === "create_devis") &&
    (lower.includes("chiffrage") ||
      lower.includes("devis") ||
      lower.includes("prix") ||
      lower.includes("tarif") ||
      lower.includes("combien") ||
      lower.includes("estimer") ||
      lower.includes("estimation"))
  ) {
    tags.push("Pré-Chiffrage HT", "Étude & Devis");
    const surfaceMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|ml)/i);
    const quantite = surfaceMatch ? parseFloat(surfaceMatch[1].replace(",", ".")) : 35;

    const isBardage = lower.includes("bardage") || lower.includes("façade") || lower.includes("hpl");
    const isCloture = lower.includes("clôture") || lower.includes("cloture") || lower.includes("grillage");

    const lines: string[] = [];

    if (isCloture) {
      const std = BNA_TARIFS_INDICATIFS.cloture.rigide_standard;
      const occ = BNA_TARIFS_INDICATIFS.cloture.rigide_soubassement_occultant;
      lines.push(`💰 **Estimation Budgétaire Clôture pour ${quantite} ml :**`);
      lines.push("");
      lines.push(
        `1. **${std.label}** : **${(quantite * std.total_ht_ml).toLocaleString("fr-FR")} € HT** (${std.total_ht_ml} € HT/ml dont ${std.fourniture_ht_ml} € fourniture + ${std.pose_ht_ml} € pose)`
      );
      lines.push(
        `2. **${occ.label}** : **${(quantite * occ.total_ht_ml).toLocaleString("fr-FR")} € HT** (${occ.total_ht_ml} € HT/ml dont ${occ.fourniture_ht_ml} € fourniture + ${occ.pose_ht_ml} € pose)`
      );
    } else if (isBardage) {
      const douglas = BNA_TARIFS_INDICATIFS.bardage.douglas_clin;
      const meleze = BNA_TARIFS_INDICATIFS.bardage.red_cedar_meleze;
      const hpl = BNA_TARIFS_INDICATIFS.bardage.hpl_polyrey_trespa;
      lines.push(`💰 **Estimation Budgétaire Bardage (DTU 41.2 / 45.4) pour ${quantite} m² :**`);
      lines.push("");
      lines.push(
        `1. **${douglas.label}** : **${(quantite * douglas.total_ht_m2).toLocaleString("fr-FR")} € HT** (${douglas.total_ht_m2} € HT/m²)`
      );
      lines.push(
        `2. **${meleze.label}** : **${(quantite * meleze.total_ht_m2).toLocaleString("fr-FR")} € HT** (${meleze.total_ht_m2} € HT/m²)`
      );
      lines.push(
        `3. **${hpl.label}** : **${(quantite * hpl.total_ht_m2).toLocaleString("fr-FR")} € HT** (${hpl.total_ht_m2} € HT/m²)`
      );
    } else {
      const pin = BNA_TARIFS_INDICATIFS.terrasse.pin_classe_4;
      const douglas = BNA_TARIFS_INDICATIFS.terrasse.douglas_meleze;
      const cumaru = BNA_TARIFS_INDICATIFS.terrasse.exotique_cumaru_ipe;
      const comp = BNA_TARIFS_INDICATIFS.terrasse.composite_pro;
      lines.push(`💰 **Estimation Budgétaire Terrasse (DTU 51.4) pour ${quantite} m² :**`);
      lines.push("");
      lines.push(
        `1. **${pin.label}** : **${(quantite * pin.total_ht_m2).toLocaleString("fr-FR")} € HT** (${pin.total_ht_m2} € HT/m² — Fourniture ${pin.fourniture_ht_m2} € + Pose ${pin.pose_ht_m2} €)`
      );
      lines.push(
        `2. **${douglas.label}** : **${(quantite * douglas.total_ht_m2).toLocaleString("fr-FR")} € HT** (${douglas.total_ht_m2} € HT/m²)`
      );
      lines.push(
        `3. **${comp.label}** : **${(quantite * comp.total_ht_m2).toLocaleString("fr-FR")} € HT** (${comp.total_ht_m2} € HT/m²)`
      );
      lines.push(
        `4. **${cumaru.label}** : **${(quantite * cumaru.total_ht_m2).toLocaleString("fr-FR")} € HT** (${cumaru.total_ht_m2} € HT/m² — Fourniture ${cumaru.fourniture_ht_m2} € + Pose ${cumaru.pose_ht_m2} €)`
      );
    }

    lines.push("");
    lines.push(
      `💡 *Astuce : Lancez le moteur de Calepinage BNA pour obtenir la liste exacte au plot et à la boîte de vis près.*`
    );

    return { content: lines.join("\n"), actions, tags };
  }

  // CAS 5 : Commandes fournisseurs & Livraisons
  if (
    lower.includes("commande") ||
    lower.includes("fournisseur") ||
    lower.includes("livraison") ||
    lower.includes("point p") ||
    lower.includes("chausson") ||
    lower.includes("matériaux") ||
    lower.includes("materiaux")
  ) {
    tags.push("Approvisionnements", "Commandes Fournisseurs");
    const lines: string[] = [
      `📦 **État des Commandes Fournisseurs & Livraisons BNA :**`,
      "",
    ];

    if (ctx.commandes.length === 0) {
      lines.push("Aucune commande fournisseur enregistrée pour le moment.");
    } else {
      for (const cmd of ctx.commandes) {
        lines.push(
          `• **${cmd.numero_commande}** — **${cmd.fournisseur?.nom || "Fournisseur"}** (Statut : **${cmd.statut.toUpperCase()}**)`
        );
        if (cmd.date_livraison_souhaitee) {
          lines.push(`  ↳ Livraison prévue : **${cmd.date_livraison_souhaitee}**`);
        }
        if (cmd.commentaire) {
          lines.push(`  ↳ Détail : *${cmd.commentaire}*`);
        }
      }
    }

    return { content: lines.join("\n"), actions, tags };
  }

  // CAS 6 : Si une action a été détectée (Création de RDV, Maj avancement, Calepinage)
  if (actions.length > 0) {
    tags.push("Action Préparée", "Validation Requise");
    const first = actions[0];
    if (first.type === "create_rdv") {
      return {
        content: `J'ai préparé le rendez-vous **"${first.payload.rdvTitre}"** pour le **${first.payload.rdvDate} à ${first.payload.rdvHeureDebut}** (${first.payload.chantierNom || "Général"}).\n\nCliquez sur le bouton de confirmation ci-dessous pour l'inscrire immédiatement au Planning Général BNA :`,
        actions,
        tags,
      };
    }
    if (first.type === "update_avancement") {
      return {
        content: `J'ai préparé la mise à jour d'avancement du chantier **${first.payload.chantierNom}** à **${first.payload.nouvelAvancement}%**.\n\nValidez la carte ci-dessous pour appliquer le changement :`,
        actions,
        tags,
      };
    }
    if (first.type === "open_calepinage") {
      return {
        content: `Voici l'accès direct au calculateur de calepinage pour dimensionner votre ouvrage selon les règles DTU :`,
        actions,
        tags,
      };
    }
    if (first.type === "create_devis") {
      const qte = first.payload.devisQuantite || 35;
      const unite = first.payload.devisUnite || "m²";
      const totalHt =
        qte * ((first.payload.devisPuFournitureHt || 95) + (first.payload.devisPuPoseHt || 72));
      return {
        content: `J'ai préparé le devis **${first.payload.devisObjet}** pour **${first.payload.chantierNom}** (**${fmtEuro(totalHt)} HT** incluant fourniture et main d'œuvre de pose).\n\nCliquez ci-dessous pour créer et enregistrer ce devis dans votre espace Devis & Factures :`,
        actions,
        tags,
      };
    }
  }

  // CAS 7 : Question sur un chantier spécifique
  const mentioned = findMentionedChantier(message, ctx.chantiers);
  if (mentioned && (lower.includes(mentioned.nom.toLowerCase()) || lower.includes(mentioned.ville.toLowerCase()))) {
    tags.push(`Chantier ${mentioned.nom}`, mentioned.ville);
    const m = getChantierMeteoInfo(mentioned);
    return {
      content: [
        `🏗️ **Fiche Synthèse — ${mentioned.nom} (${mentioned.ville})**`,
        "",
        `• **Métier** : ${mentioned.metier.toUpperCase()} | **Avancement** : **${mentioned.avancementGlobal}%**`,
        `• **Intervention en cours** : ${mentioned.intervention}`,
        mentioned.prochaineEtape
          ? `• **Prochaine étape** : ${mentioned.prochaineEtape.titre} (${mentioned.prochaineEtape.detail || ""})`
          : "",
        `• **Météo locale** : ${m.alerte}`,
        `• **Matériaux** : ${mentioned.materiaux.map((mat) => `${mat.nom} [${mat.statut.toUpperCase()}]`).join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n"),
      actions: [
        {
          id: `act-cockpit-${mentioned.id}`,
          type: "open_cockpit",
          title: `Ouvrir le Cockpit de ${mentioned.nom}`,
          description: `Accéder aux étapes, quantitatifs, photos et commandes de ${mentioned.nom}`,
          payload: {
            chantierId: mentioned.id,
            chantierNom: mentioned.nom,
          },
        },
      ],
      tags,
    };
  }

  // Réponse par défaut guidée avec résumé du contexte
  tags.push("Copilote BNA");
  return {
    content: [
      `Je suis à votre disposition, ${ctx.userName}. Vous pilotez actuellement **${ctx.chantiers.length} chantiers actifs**, **${ctx.rdvs.length} rendez-vous** et **${ctx.commandes.length} commandes fournisseurs**.`,
      "",
      `Voici ce que vous pouvez me demander en langage naturel (au clavier ou à la voix) :`,
      `• **Planifier un RDV** : *"Planifie un RDV demain à 9h30 sur Terrasse Martin pour contrôle lambourdes"*`,
      `• **Suivre la météo DTU** : *"Est-ce qu'on peut poser le bardage demain avec la météo ?"*`,
      `• **Estimer un chiffrage** : *"Chiffrage rapide pour une terrasse de 40 m² en Cumaru"*`,
      `• **Vérifier une norme DTU** : *"Quelles sont les règles DTU 51.4 pour l'aboutage et l'entraxe ?"*`,
      `• **Piloter l'avancement** : *"Passe l'avancement de Terrasse Martin à 85%"*`,
    ].join("\n"),
    actions,
    tags,
  };
}
