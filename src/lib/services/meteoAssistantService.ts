import { DailyForecastDay, WeatherData } from './weatherService';
import { DepartmentVigilanceReport } from './meteoFranceService';
import { MetierType, Chantier } from '@/types/metier';

export type PoseStatus = 'favorable' | 'vigilance' | 'interruption';

export interface TimeSlotWindow {
  startHour: number;
  endHour: number;
  startFormatted: string; // "08h00"
  endFormatted: string;   // "13h00"
  status: PoseStatus;
  activiteConseillee: string;
  consigne: string;
  precipMm: number;
  gustMaxKmH: number;
  tempMoy: number;
}

export interface MetierExpertRules {
  metier: MetierType;
  globalStatus: PoseStatus;
  statusBadge: {
    label: string;
    bgClass: string;
    borderClass: string;
    textClass: string;
  };
  dilatationJeuConseille?: string; // Ex: "6 mm impératif (bois sec / forte chaleur)"
  recommandationsPose: string[];
  pointsCritiques: string[];
  horaireCharniere?: {
    heure: string; // Ex: "13h30"
    action: string; // Ex: "Bâchage obligatoire avant les averses de 14h"
  };
  creneaux: TimeSlotWindow[];
}

export interface AttestationIntemperie {
  id: string;
  referenceDoc: string; // Ex: "BNA-INTEMP-20261101-01"
  dateEmission: string;
  chantierNom: string;
  chantierVille: string;
  chantierAdresse?: string;
  clientNom?: string;
  metier: MetierType;
  motifPrincipal: string;
  niveauVigilanceMeteoFrance: string;
  bulletinOfficielText: string;
  relevesMesures: {
    precipitationsCumulees: string;
    rafalesMaximales: string;
    temperatureMinMax: string;
  };
  reglementationsBtp: string[];
  consequenceChantier: string;
}

/**
 * Analyse heure par heure entre 07h et 19h pour dégager les fenêtres d'action
 */
export function computeDailyTimeSlots(todayForecast: DailyForecastDay): TimeSlotWindow[] {
  if (!todayForecast?.hourly || todayForecast.hourly.length === 0) {
    return [];
  }

  // Filtrer les heures ouvrées du chantier (07h à 19h)
  const workHours = todayForecast.hourly.filter((h) => h.hour >= 7 && h.hour <= 18);

  const slots: TimeSlotWindow[] = [];
  let currentGroup: typeof workHours = [];
  let currentStatus: PoseStatus | null = null;

  function evaluateHourStatus(h: (typeof workHours)[0]): PoseStatus {
    if (h.precipitation >= 1.5 || h.wind_gusts_10m >= 55 || h.temperature_2m <= 1) {
      return 'interruption';
    }
    if (h.precipitation > 0.2 || h.wind_gusts_10m >= 38 || h.temperature_2m < 5 || h.temperature_2m >= 30) {
      return 'vigilance';
    }
    return 'favorable';
  }

  for (const h of workHours) {
    const status = evaluateHourStatus(h);
    if (currentStatus === null) {
      currentStatus = status;
      currentGroup = [h];
    } else if (status === currentStatus) {
      currentGroup.push(h);
    } else {
      // Clôturer le créneau précédent
      slots.push(buildSlot(currentGroup, currentStatus));
      currentStatus = status;
      currentGroup = [h];
    }
  }

  if (currentGroup.length > 0 && currentStatus !== null) {
    slots.push(buildSlot(currentGroup, currentStatus));
  }

  return slots;
}

function buildSlot(group: DailyForecastDay['hourly'], status: PoseStatus): TimeSlotWindow {
  const startH = group[0].hour;
  const endH = group[group.length - 1].hour + 1;
  const precipTotal = Math.round(group.reduce((acc, h) => acc + h.precipitation, 0) * 10) / 10;
  const gustMax = Math.round(Math.max(...group.map((h) => h.wind_gusts_10m)));
  const tempAvg = Math.round((group.reduce((acc, h) => acc + h.temperature_2m, 0) / group.length) * 10) / 10;

  let activite = 'Pose extérieure continue';
  let consigne = 'Conditions de travail optimales.';

  if (status === 'interruption') {
    activite = 'Interruption extérieure / Repli sous abri';
    consigne =
      precipTotal >= 1.5
        ? `Pluie battante (${precipTotal} mm) : bâchage impératif et arrêt outillage non abrité.`
        : gustMax >= 55
        ? `Rafales dangereuses (${gustMax} km/h) : arrêt levage et travail en hauteur.`
        : 'Gel du support : arrêt vissage et collage.';
  } else if (status === 'vigilance') {
    activite = 'Vigilance & Précautions de pose';
    consigne =
      precipTotal > 0
        ? `Averses (${precipTotal} mm) : garder les bâches à portée immédiate.`
        : gustMax >= 38
        ? `Vent sensible (${gustMax} km/h) : maintenir les lames et panneaux légers.`
        : tempAvg >= 30
        ? 'Forte chaleur : majorer les jeux de dilatation de 1 à 2 mm.'
        : 'Basse température : vérifier l’adhérence des bandes de protection.';
  }

  return {
    startHour: startH,
    endHour: endH,
    startFormatted: `${startH.toString().padStart(2, '0')}h00`,
    endFormatted: `${endH.toString().padStart(2, '0')}h00`,
    status,
    activiteConseillee: activite,
    consigne,
    precipMm: precipTotal,
    gustMaxKmH: gustMax,
    tempMoy: tempAvg,
  };
}

/**
 * Moteur d'analyse expert métier pour la pose BNA
 */
export function analyzePoseConditions(
  metier: MetierType,
  weather: WeatherData | null,
  vigilance: DepartmentVigilanceReport | null
): MetierExpertRules {
  const current = weather?.current;
  const today = weather?.daily?.[0];

  const precip = current?.precipitation ?? 0;
  const gust = today?.wind_gusts_10m_max ?? current?.wind_speed_10m ?? 0;
  const temp = current?.temperature_2m ?? 18;
  const humidity = current?.relative_humidity_2m ?? 50;

  const vigilanceLevel = vigilance?.colorMax ?? 1;

  // Calcul du statut global
  let globalStatus: PoseStatus = 'favorable';
  if (vigilanceLevel >= 3 || precip >= 2.5 || gust >= 58 || temp <= 1) {
    globalStatus = 'interruption';
  } else if (vigilanceLevel === 2 || precip > 0.2 || gust >= 38 || temp < 5 || temp >= 30 || humidity > 85) {
    globalStatus = 'vigilance';
  }

  const badgeMap = {
    favorable: {
      label: 'Pose Extérieure Autorisée',
      bgClass: 'bg-emerald-500/15',
      borderClass: 'border-emerald-500/40',
      textClass: 'text-emerald-400',
    },
    vigilance: {
      label: 'Vigilance & Bâchage Préventif',
      bgClass: 'bg-amber-500/15',
      borderClass: 'border-amber-500/40',
      textClass: 'text-amber-400',
    },
    interruption: {
      label: 'Interruption Pose Extérieure',
      bgClass: 'bg-rose-500/15',
      borderClass: 'border-rose-500/40',
      textClass: 'text-rose-400',
    },
  };

  const creneaux = today ? computeDailyTimeSlots(today) : [];

  // Détection de l'heure charnière (ex: passage au rouge ou à la pluie)
  let horaireCharniere: { heure: string; action: string } | undefined = undefined;
  const slotPluie = creneaux.find((s) => s.status !== 'favorable' && s.precipMm > 0.2);
  if (slotPluie) {
    const minutePrepa = slotPluie.startHour > 0 ? `${(slotPluie.startHour - 1).toString().padStart(2, '0')}h30` : '12h00';
    horaireCharniere = {
      heure: minutePrepa,
      action: `Bâchage obligatoire de la structure avant les averses de ${slotPluie.startFormatted}`,
    };
  }

  // Recommandations spécifiques par métier
  const recommandations: string[] = [];
  const pointsCritiques: string[] = [];
  let jeuDilatation: string | undefined = undefined;

  if (metier === 'terrasse') {
    // Règle Dilatation DTU 51.4
    if (temp >= 28) {
      jeuDilatation = '6 à 7 mm impératif (Bois surchauffé et rétracté)';
      recommandations.push(
        'Canicule / Soleil direct : Les lames sont au retrait maximal. Si vous posez avec 3 mm, les lames vont se toucher et tuiler au premier orage d’automne.'
      );
      recommandations.push('Pré-perçage obligatoire avec fraisure pour éviter l’éclatement des têtes de vis inox.');
    } else if (humidity > 82 || precip > 0.4) {
      jeuDilatation = '4 mm (Bois déjà gonflé par l’humidité)';
      recommandations.push('Bois saturé en eau : Ne pas serrer les lames, maintenir 4 mm constants pour permettre la ventilation.');
    } else {
      jeuDilatation = '5 mm standard (Jeu nominal de saison)';
      recommandations.push('Conditions hygrométriques idéales : pose nominale des cales de 5 mm.');
    }

    if (precip > 0) {
      pointsCritiques.push('Bande bitumineuse : Interdiction de poser la bande d’étanchéité sur lambourdes détrempées (piège à pourriture).');
      pointsCritiques.push('Glissance : Risque accru de dérapage lors de la marche sur les lambourdes mouillées.');
    } else {
      recommandations.push('Pose de la structure et réglage laser des plots recommandés.');
    }

    if (temp < 4) {
      pointsCritiques.push('Froid / Gel : Bois durci cassant. Vissage direct déconseillé sans pré-perçage (risque de cisaillement des vis inox).');
    }
  } else if (metier === 'facade') {
    // Règle Bardage DTU 41.2 & R408 Sécurité
    if (gust >= 50) {
      pointsCritiques.push(`Prise au vent extrême (${Math.round(gust)} km/h) : Manipulation de clins et plaques interdite en hauteur.`);
      pointsCritiques.push('Sécurité échafaudage : Arrêt du travail sur plateformes conformément aux consignes de sécurité R408.');
    } else if (gust >= 35) {
      pointsCritiques.push(`Vent soutenu (${Math.round(gust)} km/h) : Fixer immédiatement chaque lame posée, éviter le pré-positionnement.`);
    }

    if (precip > 0.5) {
      pointsCritiques.push('Pare-pluie : Interdiction formelle de dérouler le pare-pluie sous pluie battante pour préserver l’isolant sous-jacent.');
    } else {
      recommandations.push('Pose du pare-pluie et tasseautage vertical ventilé (20 mm) favorables.');
    }
  } else {
    // Clôture
    if (precip > 0.5) {
      pointsCritiques.push('Béton de scellement : Protéger les massifs de béton frais de la pluie battante.');
    }
  }

  return {
    metier,
    globalStatus,
    statusBadge: badgeMap[globalStatus],
    dilatationJeuConseille: jeuDilatation,
    recommandationsPose: recommandations,
    pointsCritiques,
    horaireCharniere,
    creneaux,
  };
}

/**
 * Génère une attestation officielle d'intempéries pour le client
 */
export function generateAttestationIntemperie(
  chantier: Chantier,
  weather: WeatherData | null,
  vigilance: DepartmentVigilanceReport | null
): AttestationIntemperie {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const dateCode = now.toISOString().slice(0, 10).replace(/-/g, '');
  const idRef = `BNA-INTEMP-${dateCode}-${chantier.id.slice(0, 4).toUpperCase()}`;

  const current = weather?.current;
  const today = weather?.daily?.[0];

  const precipMm = current?.precipitation ?? today?.precipitation_sum ?? 0;
  const gustKmH = today?.wind_gusts_10m_max ?? current?.wind_speed_10m ?? 0;
  const tempMin = today ? Math.round(today.temperature_2m_min) : 0;
  const tempMax = today ? Math.round(today.temperature_2m_max) : 0;

  const vigilanceName = vigilance?.colorMeta?.name ?? 'Vert';
  const bulletinText =
    vigilance?.bulletinSummary ||
    'Phénomène météorologique défavorable rendant impossible la réalisation des travaux dans les règles de l’art.';

  let motif = 'Conditions météorologiques incompatibles avec les prescriptions techniques de pose.';
  if (precipMm >= 2.0) {
    motif = `Fortes précipitations continues (${precipMm} mm) : impossibilité de garantir l'étanchéité et la stabilité du bois (DTU 51.4 / DTU 41.2).`;
  } else if (gustKmH >= 55) {
    motif = `Rafales de vent violentes (${Math.round(gustKmH)} km/h) : mise en danger du personnel en hauteur et risque de chute de matériaux (Recommandation R408).`;
  } else if (vigilance && vigilance.colorMax >= 3) {
    motif = `Alerte officielle Météo-France Vigilance ${vigilanceName.toUpperCase()} : arrêt des activités extérieures préconisé par les autorités.`;
  }

  return {
    id: idRef,
    referenceDoc: idRef,
    dateEmission: dateStr,
    chantierNom: chantier.nom,
    chantierVille: chantier.ville,
    chantierAdresse: chantier.adresse || undefined,
    clientNom: chantier.client_nom,
    metier: chantier.metier,
    motifPrincipal: motif,
    niveauVigilanceMeteoFrance: `Vigilance ${vigilanceName} (${vigilance?.departmentName || 'Département'})`,
    bulletinOfficielText: bulletinText,
    relevesMesures: {
      precipitationsCumulees: `${precipMm} mm relevés sur la journée`,
      rafalesMaximales: `${Math.round(gustKmH)} km/h en pointe`,
      temperatureMinMax: `${tempMin}°C à ${tempMax}°C`,
    },
    reglementationsBtp: [
      'Code du Travail — Art. L5424-8 : Arrêt pour intempéries justifié par l’inaptitude du travail ou le danger pour la sécurité des salariés.',
      chantier.metier === 'terrasse'
        ? 'Norme NF DTU 51.4 (P65-210) : Interdiction de pose et fixation sur structure détrempée ou bois soumis à variation dimensionnelle anormale.'
        : 'Norme NF DTU 41.2 : Interdiction de pose de revêtements extérieurs et pare-pluie exposés aux infiltrations directes.',
      'Recommandation CNAMTS R408 : Sécurité des travaux de montage et démontage d’échafaudages par vent violent.',
    ],
    consequenceChantier:
      'Suspension légitime des opérations de pose extérieure pour la journée afin de préserver la garantie décennale de l’ouvrage et la sécurité des compagnons.',
  };
}
