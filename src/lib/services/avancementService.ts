import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { MetierType, AvancementDetail, MateriauSuivi, Chantier } from '@/types/metier';
import { updateChantierRecord, isUuid } from './chantierService';
import { getBesoinsByChantier } from './calepinageService';
import { getCommandesByChantier } from './commandesFournisseursService';

export interface ChantierAvancementState {
  avancementGlobal: number;
  avancementDetails: AvancementDetail[];
  prochaineEtape: {
    titre: string;
    detail: string;
  };
  blocage?: {
    titre: string;
    detail: string;
  };
  materiaux: MateriauSuivi[];
}

/**
 * Sous-lots par défaut selon le corps d'état métier BNA
 */
export function getDefaultAvancementDetails(metier: MetierType): AvancementDetail[] {
  switch (metier) {
    case 'terrasse':
      return [
        { label: 'Préparation sol & Géotextile', pourcentage: 0 },
        { label: 'Implantation & Réglage plots', pourcentage: 0 },
        { label: 'Structure lambourdes & Bandes bitumineuses', pourcentage: 0 },
        { label: 'Platelage lames & Fixations inox', pourcentage: 0 },
        { label: 'Bandeaux de rive & Réception', pourcentage: 0 },
      ];
    case 'facade':
      return [
        { label: 'Contrôle support & Dépose', pourcentage: 0 },
        { label: 'Pare-pluie & Adhésif étanchéité', pourcentage: 0 },
        { label: 'Ossature secondaire & Grilles anti-rongeurs', pourcentage: 0 },
        { label: 'Pose clins / panneaux de bardage', pourcentage: 0 },
        { label: 'Profilés angles, linteaux & Finitions', pourcentage: 0 },
      ];
    case 'cloture':
      return [
        { label: 'Implantation & Trous fondations', pourcentage: 0 },
        { label: 'Scellement poteaux / Platines', pourcentage: 0 },
        { label: 'Emboîtement travées & Lames', pourcentage: 0 },
        { label: 'Chapeaux, serrurerie & Finitions', pourcentage: 0 },
      ];
    default:
      return [
        { label: 'Préparation & Structure', pourcentage: 0 },
        { label: 'Pose revêtement', pourcentage: 0 },
        { label: 'Finitions', pourcentage: 0 },
      ];
  }
}

/**
 * Prochaine étape suggérée selon l'avancement et le métier
 */
export function getSuggestedNextStep(
  metier: MetierType,
  details: AvancementDetail[]
): { titre: string; detail: string } {
  // Trouver le premier sous-lot qui n'est pas à 100%
  const currentStep = details.find((d) => d.pourcentage < 100);

  if (!currentStep) {
    return {
      titre: 'Chantier terminé — Réception client',
      detail: 'Signature du PV de réception et nettoyage complet du site.',
    };
  }

  if (metier === 'terrasse') {
    if (currentStep.label.includes('sol')) {
      return {
        titre: 'Nivellement et pose du géotextile',
        detail: 'Décaissement et calage des premiers repères de niveau laser.',
      };
    }
    if (currentStep.label.includes('plots')) {
      return {
        titre: 'Répartition et réglage des plots',
        detail: 'Calage des hauteurs et contrôle de la pente d’évacuation (1% min).',
      };
    }
    if (currentStep.label.includes('lambourdes')) {
      return {
        titre: 'Pose de l’ossature lambourdes et bandes de protection',
        detail: 'Respect des entraxes DTU 51.4 et pose de la bande bitumineuse.',
      };
    }
    if (currentStep.label.includes('Platelage')) {
      return {
        titre: 'Pose et vissage du platelage',
        detail: 'Contrôle du jeu de dilatation latéral (4-5 mm) et lignage des vis.',
      };
    }
    return {
      titre: 'Pose des bandeaux de finition et trappes d’accès',
      detail: 'Recoupes de rive soignées et ajustement des trappes techniques.',
    };
  }

  if (metier === 'facade') {
    if (currentStep.label.includes('Pare-pluie')) {
      return {
        titre: 'Pose du pare-pluie respirant et pontage',
        detail: 'Recouvrement de 10 à 15 cm avec adhésif spécial extérieur.',
      };
    }
    if (currentStep.label.includes('Ossature')) {
      return {
        titre: 'Tasseautage et grilles anti-rongeurs',
        detail: 'Création de la lame d’air ventilée de 20 mm haute et basse.',
      };
    }
    return {
      titre: 'Pose des clins de bardage',
      detail: 'Fixation des lames selon DTU 41.2 avec pointes annelées inox.',
    };
  }

  return {
    titre: currentStep.label,
    detail: 'En cours de réalisation sur le terrain.',
  };
}

/**
 * Calcul de la moyenne de l'avancement global
 */
export function calculateGlobalAvancement(details: AvancementDetail[]): number {
  if (!details || details.length === 0) return 0;
  const sum = details.reduce((acc, curr) => acc + (curr.pourcentage || 0), 0);
  return Math.round(sum / details.length);
}

const STORAGE_PREFIX = 'bna_avancement_';

/**
 * Charge l'avancement complet d'un chantier (localStorage + Supabase)
 */
export function loadChantierAvancement(
  chantierId: string,
  metier: MetierType,
  currentGlobal: number,
  fallbackChantier?: Partial<Chantier>
): ChantierAvancementState {
  const defaultDetails = getDefaultAvancementDetails(metier);

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${chantierId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.avancementDetails)) {
        return {
          avancementGlobal: parsed.avancementGlobal ?? currentGlobal,
          avancementDetails: parsed.avancementDetails,
          prochaineEtape: parsed.prochaineEtape ||
            fallbackChantier?.prochaineEtape ||
            getSuggestedNextStep(metier, parsed.avancementDetails),
          blocage: parsed.blocage || fallbackChantier?.blocage,
          materiaux: parsed.materiaux || fallbackChantier?.materiaux || [],
        };
      }
    }
  } catch (err) {
    console.warn('Erreur lecture localStorage avancement:', err);
  }

  // Si des sous-lots existent déjà dans fallbackChantier
  if (fallbackChantier?.avancementDetails && fallbackChantier.avancementDetails.length > 0) {
    return {
      avancementGlobal: currentGlobal,
      avancementDetails: fallbackChantier.avancementDetails,
      prochaineEtape: fallbackChantier.prochaineEtape || getSuggestedNextStep(metier, fallbackChantier.avancementDetails),
      blocage: fallbackChantier.blocage,
      materiaux: fallbackChantier.materiaux || [],
    };
  }

  // Initialisation par défaut basée sur l'avancement global
  const stepCount = defaultDetails.length;
  let remainingPct = currentGlobal * stepCount;
  const initialDetails = defaultDetails.map((step) => {
    const allocated = Math.min(100, Math.max(0, remainingPct));
    remainingPct -= allocated;
    return { ...step, pourcentage: allocated };
  });

  return {
    avancementGlobal: currentGlobal,
    avancementDetails: initialDetails,
    prochaineEtape: fallbackChantier?.prochaineEtape || getSuggestedNextStep(metier, initialDetails),
    blocage: fallbackChantier?.blocage,
    materiaux: fallbackChantier?.materiaux || [
      { nom: `Matériaux principaux ${metier}`, statut: 'ok', detail: 'En stock sur chantier' },
    ],
  };
}

/**
 * Sauvegarde l'avancement d'un chantier (localStorage + Supabase)
 */
export async function saveChantierAvancement(
  supabase: SupabaseClient<Database>,
  chantierId: string,
  state: ChantierAvancementState
): Promise<void> {
  const globalPct = calculateGlobalAvancement(state.avancementDetails);
  const updatedState = { ...state, avancementGlobal: globalPct };

  // 1. Sauvegarde locale immédiate
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${chantierId}`, JSON.stringify(updatedState));
  } catch (err) {
    console.warn('Erreur écriture localStorage avancement:', err);
  }

  // 2. Synchronisation Supabase si UUID valide
  if (isUuid(chantierId)) {
    try {
      await updateChantierRecord(supabase, chantierId, {
        avancement: globalPct,
      });
    } catch (dbErr) {
      console.warn('Erreur synchronisation Supabase avancement:', dbErr);
    }
  }
}

/**
 * Synchronise les cartes de matériaux à surveiller à partir des commandes et besoins réels du chantier
 */
export async function fetchChantierLiveMateriaux(
  supabase: SupabaseClient<Database>,
  chantierId: string,
  metier: MetierType
): Promise<MateriauSuivi[]> {
  if (!isUuid(chantierId)) {
    return [
      { nom: `Vis Inox A4 ${metier === 'terrasse' ? '5x50' : 'd\'ossature'}`, statut: 'vigilance', detail: 'Stock juste (reste 1 boîte)' },
      { nom: metier === 'terrasse' ? 'Lames de terrasse' : 'Clins de bardage', statut: 'ok', detail: 'Stock complet sur site' },
    ];
  }

  try {
    const [commandes, besoinsRes] = await Promise.all([
      getCommandesByChantier(supabase, chantierId),
      getBesoinsByChantier(supabase, chantierId),
    ]);

    const result: MateriauSuivi[] = [];

    // Commandes réelles
    if (commandes && commandes.length > 0) {
      for (const cmd of commandes.slice(0, 3)) {
        const isEnvoyee = cmd.statut === 'envoyee';
        const fNom = cmd.fournisseur?.nom || 'Fournisseur';
        const numCmd = cmd.numero_commande || 'CMD';
        const dateLiv = cmd.date_livraison_souhaitee
          ? ` · Liv. souhaitée : ${cmd.date_livraison_souhaitee}`
          : '';
        result.push({
          nom: `${fNom} (${numCmd})`,
          statut: isEnvoyee ? 'ok' : 'vigilance',
          detail: isEnvoyee ? `Commande envoyée${dateLiv}` : 'Brouillon à valider',
        });
      }
    }

    // Besoins à commander en attente
    if (besoinsRes.totalACommander > 0) {
      result.push({
        nom: 'Besoins matériaux en attente',
        statut: 'vigilance',
        detail: `${besoinsRes.totalACommander} ligne(s) restant à commander`,
      });
    }

    if (result.length === 0) {
      result.push({
        nom: `Matériaux de pose ${metier}`,
        statut: 'ok',
        detail: 'Approvisionnements conformes',
      });
    }

    return result;
  } catch (err) {
    console.warn('fetchChantierLiveMateriaux error:', err);
    return [
      { nom: `Matériaux de pose ${metier}`, statut: 'ok', detail: 'Approvisionnements conformes' },
    ];
  }
}
