import type { DailyForecastDay, WeatherData } from './weatherService';
import type { DepartmentVigilanceReport } from './meteoFranceService';
import type { MetierType, Chantier } from '@/types/metier';

export type PoseStatus = 'favorable' | 'vigilance' | 'interruption';
export type FamilleBardageMeteo = 'hpl' | 'bois';

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
export function computeDailyTimeSlots(
  todayForecast: DailyForecastDay,
  metier: MetierType = 'terrasse',
  familleBardage: FamilleBardageMeteo = 'hpl'
): TimeSlotWindow[] {
  if (!todayForecast?.hourly || todayForecast.hourly.length === 0) {
    return [];
  }

  // Filtrer les heures ouvrées du chantier (07h à 19h)
  const workHours = todayForecast.hourly.filter((h) => h.hour >= 7 && h.hour <= 18);

  const slots: TimeSlotWindow[] = [];
  let currentGroup: typeof workHours = [];
  let currentStatus: PoseStatus | null = null;

  function evaluateHourStatus(h: (typeof workHours)[0], idx: number): PoseStatus {
    if (metier === 'facade') {
      if (familleBardage === 'bois') {
        // Bardage Bois (DTU 41.2) :
        // - Interdiction pluie battante (>= 1.0 mm) : humidifie rainures/languettes et dos des lames
        // - Interdiction vent violent >= 50 km/h (R408) ou gel <= 0°C
        if (h.precipitation >= 1.0 || h.wind_gusts_10m >= 50 || h.temperature_2m <= 0) {
          return 'interruption';
        }
        // Vigilance sous averse (> 0.1 mm), plein soleil été (>= 30°C : risque de tuilage des paquets déballés) ou vent >= 35 km/h
        if (h.precipitation > 0.1 || h.wind_gusts_10m >= 35 || h.temperature_2m >= 30 || h.temperature_2m < 4) {
          return 'vigilance';
        }
        return 'favorable';
      }

      // Bardage HPL / DTU 41.2 & 45.4 :
      // - Interdiction grand froid < 5°C (fissuration au perçage + perte adhérence EPDM/colles)
      // - Interdiction forte chaleur >= 35°C (dilatation maximale HPL -> cisaillement au retrait hivernal)
      // - Interdiction pluie soutenue >= 1.0 mm ou vent >= 50 km/h (R408)
      if (
        h.precipitation >= 1.0 ||
        h.wind_gusts_10m >= 50 ||
        h.temperature_2m < 5 ||
        h.temperature_2m >= 35
      ) {
        return 'interruption';
      }
      // Vérification de la règle des 5 heures suivantes >= 10°C (prescriptions type Polyrey / pose collée)
      const next5Hours = todayForecast.hourly.slice(idx, idx + 6);
      const dropsBelow10In5h = next5Hours.some((nh) => nh.temperature_2m < 10);

      if (
        h.precipitation > 0.1 ||
        h.wind_gusts_10m >= 35 ||
        h.temperature_2m < 10 ||
        dropsBelow10In5h ||
        h.temperature_2m >= 30
      ) {
        return 'vigilance';
      }
      return 'favorable';
    }

    if (h.precipitation >= 1.5 || h.wind_gusts_10m >= 55 || h.temperature_2m <= 1) {
      return 'interruption';
    }
    if (h.precipitation > 0.2 || h.wind_gusts_10m >= 38 || h.temperature_2m < 5 || h.temperature_2m >= 30) {
      return 'vigilance';
    }
    return 'favorable';
  }

  for (let i = 0; i < workHours.length; i++) {
    const h = workHours[i];
    const status = evaluateHourStatus(h, i);
    if (currentStatus === null) {
      currentStatus = status;
      currentGroup = [h];
    } else if (status === currentStatus) {
      currentGroup.push(h);
    } else {
      // Clôturer le créneau précédent
      slots.push(buildSlot(currentGroup, currentStatus, metier, familleBardage));
      currentStatus = status;
      currentGroup = [h];
    }
  }

  if (currentGroup.length > 0 && currentStatus !== null) {
    slots.push(buildSlot(currentGroup, currentStatus, metier, familleBardage));
  }

  return slots;
}

function buildSlot(
  group: DailyForecastDay['hourly'],
  status: PoseStatus,
  metier: MetierType = 'terrasse',
  familleBardage: FamilleBardageMeteo = 'hpl'
): TimeSlotWindow {
  const startH = group[0].hour;
  const endH = group[group.length - 1].hour + 1;
  const precipTotal = Math.round(group.reduce((acc, h) => acc + h.precipitation, 0) * 10) / 10;
  const gustMax = Math.round(Math.max(...group.map((h) => h.wind_gusts_10m)));
  const tempAvg = Math.round((group.reduce((acc, h) => acc + h.temperature_2m, 0) / group.length) * 10) / 10;

  let activite = 'Pose extérieure continue';
  let consigne = 'Conditions de travail optimales.';

  if (status === 'interruption') {
    activite = 'Interruption extérieure / Repli sous abri';
    if (metier === 'facade') {
      if (familleBardage === 'bois') {
        consigne =
          precipTotal >= 1.0
            ? `Pluie battante (${precipTotal} mm) : arrêt pose bardage bois (gonflement des rainures/languettes et dos des lames, ossature < 19% et isolant au sec).`
            : gustMax >= 50
            ? `Rafales dangereuses (${gustMax} km/h) : arrêt manipulation des lames et travail sur échafaudage (R408).`
            : `Gel (${tempAvg}°C) : arrêt clouage/vissage sur bois gelé cassant.`;
      } else {
        consigne =
          tempAvg < 5
            ? `Grand froid (${tempAvg}°C < 5°C) : arrêt pose HPL (panneau cassant au perçage, perte d'adhérence EPDM/colles).`
            : tempAvg >= 35
            ? `Forte chaleur (${tempAvg}°C >= 35°C) : arrêt pose HPL en plein soleil (extension maximale, risque de cisaillement hivernal).`
            : precipTotal >= 1.0
            ? `Pluie (${precipTotal} mm) : interdiction de pose sur ossature humide (humidité bois < 19% DTU 41.2/45.4) et bâchage de l'isolant.`
            : `Rafales dangereuses (${gustMax} km/h) : arrêt manipulation des panneaux et travail sur échafaudage (R408).`;
      }
    } else {
      consigne =
        precipTotal >= 1.5
          ? `Pluie battante (${precipTotal} mm) : bâchage impératif et arrêt outillage non abrité.`
          : gustMax >= 55
          ? `Rafales dangereuses (${gustMax} km/h) : arrêt levage et travail en hauteur.`
          : 'Gel du support : arrêt vissage et collage.';
    }
  } else if (status === 'vigilance') {
    activite = 'Vigilance & Précautions de pose';
    if (metier === 'facade') {
      if (familleBardage === 'bois') {
        consigne =
          precipTotal > 0
            ? `Averses (${precipTotal} mm) : protéger les usinages (rainures/languettes) et vérifier lames entre 13 % et 18 % à l'humidimètre.`
            : tempAvg >= 30
            ? `Plein soleil (${tempAvg}°C >= 30°C) : ne pas laisser les paquets de lames déballés au soleil (risque de tuilage et emboîtement difficile).`
            : `Vent sensible (${gustMax} km/h) : fixer immédiatement chaque lame de bardage bois.`;
      } else {
        consigne =
          precipTotal > 0
            ? `Humidité / averses (${precipTotal} mm) : poser le pare-pluie à l'avancement, vérifier bois < 19 % et prévoir bâchage soir.`
            : tempAvg < 10
            ? `Température fraîche (${tempAvg}°C < 10°C) : pose collée ou prescription Polyrey (≥ 10°C durant 5h) interdite ; vérifier bande EPDM.`
            : tempAvg >= 30
            ? `Chaleur (${tempAvg}°C >= 30°C) : dilatation HPL élevée, contrôler les points coulissants et joints de dilatation.`
            : `Vent sensible (${gustMax} km/h) : maintenir les panneaux HPL contre la prise au vent.`;
      }
    } else {
      consigne =
        precipTotal > 0
          ? `Averses (${precipTotal} mm) : garder les bâches à portée immédiate.`
          : gustMax >= 38
          ? `Vent sensible (${gustMax} km/h) : maintenir les lames et panneaux légers.`
          : tempAvg >= 30
          ? 'Forte chaleur : majorer les jeux de dilatation de 1 à 2 mm.'
          : 'Basse température : vérifier l’adhérence des bandes de protection.';
    }
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
  vigilance: DepartmentVigilanceReport | null,
  familleBardage: FamilleBardageMeteo = 'hpl'
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
  if (metier === 'facade') {
    if (familleBardage === 'bois') {
      if (vigilanceLevel >= 3 || precip >= 1.0 || gust >= 50 || temp <= 0) {
        globalStatus = 'interruption';
      } else if (
        vigilanceLevel === 2 ||
        precip > 0.1 ||
        gust >= 35 ||
        temp >= 30 ||
        temp < 4 ||
        humidity > 85
      ) {
        globalStatus = 'vigilance';
      }
    } else {
      if (
        vigilanceLevel >= 3 ||
        precip >= 1.0 ||
        gust >= 50 ||
        temp < 5 ||
        temp >= 35
      ) {
        globalStatus = 'interruption';
      } else if (
        vigilanceLevel === 2 ||
        precip > 0.1 ||
        gust >= 35 ||
        temp < 10 ||
        temp >= 30 ||
        humidity > 85
      ) {
        globalStatus = 'vigilance';
      }
    }
  } else {
    if (vigilanceLevel >= 3 || precip >= 2.5 || gust >= 58 || temp <= 1) {
      globalStatus = 'interruption';
    } else if (vigilanceLevel === 2 || precip > 0.2 || gust >= 38 || temp < 5 || temp >= 30 || humidity > 85) {
      globalStatus = 'vigilance';
    }
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

  const creneaux = today ? computeDailyTimeSlots(today, metier, familleBardage) : [];

  // Détection de l'heure charnière (ex: passage au rouge, averse ou bâchage de fin de journée)
  let horaireCharniere: { heure: string; action: string } | undefined = undefined;
  const slotPluie = creneaux.find((s) => s.status !== 'favorable' && s.precipMm > 0.1);
  if (slotPluie) {
    const minutePrepa = slotPluie.startHour > 0 ? `${(slotPluie.startHour - 1).toString().padStart(2, '0')}h30` : '12h00';
    horaireCharniere = {
      heure: minutePrepa,
      action:
        metier === 'facade'
          ? familleBardage === 'bois'
            ? `Mettre les colis de lames bois à l'abri (sur tasseaux, ventilé sans bâche hermétique) et protéger l'isolant avant les averses de ${slotPluie.startFormatted}`
            : `Pose immédiate du pare-pluie sur l'isolant et bâchage obligatoire des façades non bardées avant les averses de ${slotPluie.startFormatted}`
          : `Bâchage obligatoire de la structure avant les averses de ${slotPluie.startFormatted}`,
    };
  } else if (metier === 'facade' && (humidity > 80 || (today?.precipitation_sum ?? 0) > 0.2)) {
    horaireCharniere = {
      heure: '17h30',
      action:
        familleBardage === 'bois'
          ? 'Fin de journée : protéger les façades isolées non bardées et stocker les lames bois à plat sur tasseaux sous abri ventilé (jamais sous bâche plastique hermétique).'
          : 'Bâchage obligatoire en fin de journée des façades isolées non encore protégées par le bardage HPL (risque d’averse / humidité nocturne).',
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
    if (familleBardage === 'bois') {
      // Règles Expert Bardage Bois (DTU 41.2)
      jeuDilatation =
        'Taux d’humidité des lames : strictement entre 13 % et 18 % (idéal 15-16 %, test obligatoire à l’humidimètre à pointes avant pose) · Lame d’air ventilée ≥ 20 mm';

      // 1. Contrôle humidimètre des lames (13% - 18%)
      recommandations.push(
        'Règle d’or humidimètre à pointes (13 % à 18 %) : si bois > 19 %, fort retrait au séchage (ouverture des emboîtements languette/rainure, fentes aux clous/vis, voilement) ; si bois < 12 % (stockage chauffé), gonflement en automne faisant gondoler ou éclater le bardage.'
      );

      // 2. Pluie battante & support humide
      if (precip > 0.2 || humidity > 85) {
        pointsCritiques.push(
          'Interdiction de poser sous pluie battante : la pluie humidifie instantanément les usinages (rainures et languettes) et le dos des lames non protégés, provoquant un gonflement anormal pendant la pose.'
        );
        pointsCritiques.push(
          'Interdiction de poser sur support / isolant trempé (DTU 41.2) : l’ossature bois support doit être < 19 % d’humidité et la laine isolante parfaitement sèche.'
        );
      }

      // 3. Plein soleil en été (> 30°C)
      if (temp >= 30) {
        pointsCritiques.push(
          `Plein soleil (${Math.round(temp)}°C ≥ 30°C) : interdiction de stocker les paquets de lames déballés en plein soleil avant la pose (séchage trop rapide sur une face provoquant le « tuilage » des lames, les rendant impossibles à emboîter proprement).`
        );
      }

      // 4. Acclimatation obligatoire 72h & lame d'air ventilée 20 mm
      recommandations.push(
        'Acclimatation obligatoire ≥ 72h sur chantier : stocker les lames à plat sur tasseaux décollés du sol, à l’abri de la pluie et du soleil direct, dans un endroit ventilé (jamais sous bâche plastique hermétique qui crée un effet de serre).'
      );
      recommandations.push(
        'Lame d’air ventilée continue ≥ 20 mm (DTU 41.2) : maintenir les entrées et sorties d’air hautes et basses avec grilles anti-rongeurs pour assurer le séchage rapide du bois après averse.'
      );

      if (gust >= 50) {
        pointsCritiques.push(`Prise au vent extrême (${Math.round(gust)} km/h) : manipulation des clins interdite en hauteur et arrêt travail sur échafaudage (R408).`);
      } else if (gust >= 35) {
        pointsCritiques.push(`Vent soutenu (${Math.round(gust)} km/h) : fixer immédiatement chaque lame posée.`);
      }
    } else {
      // Règles Expert Bardage HPL / Composite (DTU 41.2, DTU 45.4, prescriptions fabricants type Polyrey / Trespa)

      // 1. Grand froid ou gel (< 5°C interdiction, 5°C à 10°C vigilance contractuelle)
      if (temp < 5) {
        jeuDilatation = 'Pose HPL interdite (< 5°C) — Panneau rétracté et cassant au perçage';
        pointsCritiques.push(
          `Interdiction de pose par grand froid (${Math.round(temp)}°C < 5°C) : le stratifié compact HPL devient cassant ; le perçage (points fixes et points dilatants) et l’usinage risquent de fissurer ou d’écailler le panneau.`
        );
        pointsCritiques.push(
          'Fixation & étanchéité (< 5°C) : les joints d’étanchéité, bandes EPDM et colles structurelles (pose collée invisible) ne catalysent pas correctement et perdent leur adhérence.'
        );
      } else if (temp < 10) {
        jeuDilatation = '8 à 10 mm en bout de plaque + centrage strict des points dilatants (pose par temps frais < 10°C)';
        pointsCritiques.push(
          `Seuil contractuel 10°C (${Math.round(temp)}°C) : certains fabricants (ex. Polyrey) et systèmes collés imposent une température minimale absolue de 10°C pendant la pose et les 5 heures qui suivent.`
        );
        recommandations.push(
          'Vérifier la bonne adhérence des bandes EPDM sur chevrons secs avant mise en place des panneaux.'
        );
      }

      // 2. Forte chaleur (> 30°C à 35°C : dilatation maximale du HPL)
      if (temp >= 35) {
        jeuDilatation = 'Pose HPL au soleil interdite (≥ 35°C) — Extension thermique maximale';
        pointsCritiques.push(
          `Interdiction de pose par forte chaleur (${Math.round(temp)}°C ≥ 35°C) : le panneau HPL est à son extension maximale ; lors du retrait hivernal, les tensions provoqueront le cisaillement des fixations ou le bombement des panneaux.`
        );
      } else if (temp >= 30) {
        jeuDilatation = 'Vigilance dilatation HPL (≥ 30°C) : contrôler les jeux en bout de plaque et l’alésage des points coulissants';
        pointsCritiques.push(
          `Forte chaleur (${Math.round(temp)}°C ≥ 30°C) : éviter la pose en plein soleil direct ; le HPL fortement dilaté se rétractera en hiver (risque de cisaillement des vis/rivets si les points dilatants ne coulissent pas librement).`
        );
      } else if (temp >= 10) {
        jeuDilatation = 'Jeu nominal DTU 41.2 / 45.4 : 8 à 10 mm entre panneaux (points fixes + points dilatants)';
      }

      // 3. Pluie battante, humidité du support (< 19%), acclimatation 3 jours, pare-pluie & bâchage
      if (precip > 0.2 || humidity > 85) {
        pointsCritiques.push(
          'Support & ossature humides (DTU 41.2 / DTU 45.4) : interdiction formelle de poser du HPL tant que la maçonnerie ou l’ossature bois secondaire n’est pas sèche (taux d’humidité du bois obligatoirement < 19 % pour éviter pourrissement et moisissures derrière le panneau étanche).'
        );
        pointsCritiques.push(
          'Risque de tuilage (déformation) : ne jamais poser sous pluie continue ; les panneaux HPL doivent être stockés à plat au sec et acclimatés sur le chantier au moins 3 jours (72h) avant la pose.'
        );
        pointsCritiques.push(
          'Pare-pluie & bâchage : appliquer le film pare-pluie au fur et à mesure de l’avancement pour mettre la laine isolante hors d’eau, et bâcher impérativement chaque soir les façades isolées non encore bardées.'
        );
      } else {
        recommandations.push(
          'Contrôler à l’humidimètre que l’ossature bois est < 19 % d’humidité (DTU 41.2 / 45.4) et que les panneaux HPL sont acclimatés sur site depuis au moins 3 jours à plat.'
        );
        recommandations.push(
          'Poser le film pare-pluie à l’avancement sur l’isolant et prévoir le bâchage en fin de journée des zones isolées non encore recouvertes.'
        );
      }

      // 4. Vent & sécurité échafaudage R408
      if (gust >= 50) {
        pointsCritiques.push(`Prise au vent extrême (${Math.round(gust)} km/h) : manipulation des panneaux HPL et clins interdite en hauteur.`);
        pointsCritiques.push('Sécurité échafaudage : arrêt du travail sur plateformes conformément à la recommandation CNAMTS R408.');
      } else if (gust >= 35) {
        pointsCritiques.push(`Vent soutenu (${Math.round(gust)} km/h) : fixer immédiatement chaque panneau posé, éviter tout pré-positionnement non bridé.`);
      }
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
  vigilance: DepartmentVigilanceReport | null,
  familleBardage: FamilleBardageMeteo = 'hpl'
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
  if (chantier.metier === 'facade') {
    if (familleBardage === 'bois') {
      if (precipMm >= 1.0) {
        motif = `Pluie battante (${precipMm} mm) : interdiction de pose du bardage bois (gonflement des usinages rainures/languettes et du dos des lames, obligation de maintenir les lames entre 13 % et 18 % d'humidité et l'ossature support < 19 % selon NF DTU 41.2).`;
      } else if ((current?.temperature_2m ?? tempMax) >= 30 || tempMax >= 32) {
        motif = `Ensoleillement et forte chaleur (${tempMax}°C ≥ 30°C) : risque de tuilage rapide des lames de bardage bois et retrait excessif compromettant l'emboîtement des rainures et languettes (NF DTU 41.2).`;
      } else if (gustKmH >= 50) {
        motif = `Rafales de vent violentes (${Math.round(gustKmH)} km/h) : prise au vent critique des lames en hauteur et sécurité échafaudage (Recommandation R408).`;
      } else if (vigilance && vigilance.colorMax >= 3) {
        motif = `Alerte officielle Météo-France Vigilance ${vigilanceName.toUpperCase()} : arrêt des activités extérieures préconisé par les autorités.`;
      }
    } else {
      if (precipMm >= 1.0) {
        motif = `Pluie et humidité du support (${precipMm} mm) : interdiction formelle de pose du bardage HPL sur ossature humide (humidité du bois devant être < 19 % selon DTU 41.2 / DTU 45.4), risque de tuilage des panneaux et mise hors d'eau obligatoire de l'isolant.`;
      } else if ((current?.temperature_2m ?? tempMin) < 5 || tempMin < 5) {
        motif = `Grand froid / gel (${tempMin}°C < 5°C) : stratifié compact HPL cassant au perçage/usinage et absence de catalyse / adhérence des bandes EPDM et colles structurelles (seuil minimal de 5°C à 10°C durant 5h selon prescriptions fabricants).`;
      } else if ((current?.temperature_2m ?? tempMax) >= 30 || tempMax >= 32) {
        motif = `Forte chaleur (${tempMax}°C ≥ 30-35°C) : dilatation thermique maximale des panneaux HPL entraînant un risque de cisaillement des fixations ou de bombement lors du retrait hivernal.`;
      } else if (gustKmH >= 50) {
        motif = `Rafales de vent violentes (${Math.round(gustKmH)} km/h) : prise au vent critique des panneaux en hauteur et sécurité échafaudage (Recommandation R408).`;
      } else if (vigilance && vigilance.colorMax >= 3) {
        motif = `Alerte officielle Météo-France Vigilance ${vigilanceName.toUpperCase()} : arrêt des activités extérieures préconisé par les autorités.`;
      }
    }
  } else if (precipMm >= 2.0) {
    motif = `Fortes précipitations continues (${precipMm} mm) : impossibilité de garantir l'étanchéité et la stabilité du bois (DTU 51.4 / DTU 41.2).`;
  } else if (gustKmH >= 55) {
    motif = `Rafales de vent violentes (${Math.round(gustKmH)} km/h) : mise en danger du personnel en hauteur et risque de chute de matériaux (Recommandation R408).`;
  } else if (vigilance && vigilance.colorMax >= 3) {
    motif = `Alerte officielle Météo-France Vigilance ${vigilanceName.toUpperCase()} : arrêt des activités extérieures préconisé par les autorités.`;
  }

  const reglementations =
    chantier.metier === 'facade'
      ? familleBardage === 'bois'
        ? [
            'Code du Travail — Art. L5424-8 : Arrêt pour intempéries justifié par l’inaptitude technique du travail ou le danger pour la sécurité des salariés.',
            'Norme NF DTU 41.2 (Bardages rapportés en bois) : Taux d’humidité des lames de bardage strictement compris entre 13 % et 18 % à la pose (risque de retrait et déboîtement des languettes si > 19 %, ou de gonflement/éclatement si < 12 %), ossature bois support < 19 % et isolant sec.',
            'Prescriptions d’acclimatation & ventilation NF DTU 41.2 : Stockage obligatoire ≥ 72h sur chantier à plat sur tasseaux sous abri ventilé (hors pluie, plein soleil > 30°C et bâche hermétique) et maintien d’une lame d’air ventilée continue ≥ 20 mm avec grilles anti-rongeurs hautes et basses.',
            'Recommandation CNAMTS R408 : Sécurité des travaux sur échafaudages et manipulation des clins par vent soutenu.',
          ]
        : [
            'Code du Travail — Art. L5424-8 : Arrêt pour intempéries justifié par l’inaptitude technique du travail ou le danger pour la sécurité des salariés.',
            'Normes NF DTU 41.2 & DTU 45.4 : Interdiction formelle de pose sur ossature bois présentant un taux d’humidité ≥ 19 %, obligation de mise hors d’eau de l’isolant (pare-pluie à l’avancement et bâchage journalier) et acclimatation des panneaux HPL 72h au sec.',
            'Prescriptions Techniques Fabricants HPL (Polyrey / Trespa / Avis Techniques CSTB) : Interdiction de pose en dessous de 5°C (10°C durant 5h pour systèmes spécifiques/collés — risque de fissuration au perçage et non-adhérence EPDM/colles) et au-dessus de 30°C–35°C en plein soleil (dilatation maximale et risque de cisaillement des fixations au retrait hivernal).',
            'Recommandation CNAMTS R408 : Sécurité des travaux sur échafaudages et manipulation de panneaux par vent soutenu.',
          ]
      : [
          'Code du Travail — Art. L5424-8 : Arrêt pour intempéries justifié par l’inaptitude du travail ou le danger pour la sécurité des salariés.',
          'Norme NF DTU 51.4 (P65-210) : Interdiction de pose et fixation sur structure détrempée ou bois soumis à variation dimensionnelle anormale.',
          'Recommandation CNAMTS R408 : Sécurité des travaux de montage et démontage d’échafaudages par vent violent.',
        ];

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
    reglementationsBtp: reglementations,
    consequenceChantier:
      'Suspension légitime des opérations de pose extérieure pour la journée afin de préserver la garantie décennale de l’ouvrage et la sécurité des compagnons.',
  };
}
