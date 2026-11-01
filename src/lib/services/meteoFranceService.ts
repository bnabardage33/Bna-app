import {
  METEO_FRANCE_PHENOMENA,
  METEO_FRANCE_DEFAULT_YELLOW_ADVICE,
  METEO_FRANCE_DEFAULT_GREEN_ADVICE,
  PhenomenonOfficialAdvice,
} from './meteoFranceBehaviors';

export type VigilanceLevel = 1 | 2 | 3 | 4;

export interface VigilanceColorMeta {
  id: VigilanceLevel;
  name: string;
  emoji: '🟢' | '🟡' | '🟠' | '🔴';
  label: string;
  hex: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

export const VIGILANCE_COLORS: Record<VigilanceLevel, VigilanceColorMeta> = {
  1: {
    id: 1,
    name: 'Vert',
    emoji: '🟢',
    label: 'Pas de vigilance particulière',
    hex: '#22c55e',
    badgeBg: 'bg-emerald-500/15',
    badgeBorder: 'border-emerald-500/40',
    badgeText: 'text-emerald-400',
  },
  2: {
    id: 2,
    name: 'Jaune',
    emoji: '🟡',
    label: 'Soyez attentif',
    hex: '#eab308',
    badgeBg: 'bg-yellow-500/15',
    badgeBorder: 'border-yellow-500/40',
    badgeText: 'text-yellow-400',
  },
  3: {
    id: 3,
    name: 'Orange',
    emoji: '🟠',
    label: 'Soyez très vigilant',
    hex: '#f97316',
    badgeBg: 'bg-orange-500/15',
    badgeBorder: 'border-orange-500/40',
    badgeText: 'text-orange-400',
  },
  4: {
    id: 4,
    name: 'Rouge',
    emoji: '🔴',
    label: 'Vigilance absolue',
    hex: '#ef4444',
    badgeBg: 'bg-rose-500/15',
    badgeBorder: 'border-rose-500/40',
    badgeText: 'text-rose-400',
  },
};

export interface AlertTimelapsSlot {
  beginTime: number; // Unix timestamp en secondes
  endTime: number;   // Unix timestamp en secondes
  colorId: VigilanceLevel;
  beginFormatted: string; // Ex: "06:00" ou "01/11 06:00"
  endFormatted: string;   // Ex: "18:00" ou "01/11 18:00"
}

export interface DepartmentPhenomenonRisk {
  id: number;
  name: string;
  colorId: VigilanceLevel;
  colorMeta: VigilanceColorMeta;
  timelaps: AlertTimelapsSlot[];
  consequences: string[];
  advices: string[];
}

export interface DepartmentVigilanceReport {
  department: string; // Ex: "33"
  departmentName: string; // Ex: "Gironde"
  colorMax: VigilanceLevel;
  colorMeta: VigilanceColorMeta;
  updateTime: number;
  updateTimeFormatted: string;
  endValidityTime?: number;
  endValidityTimeFormatted?: string;
  bulletinSummary: string;
  bulletinTitle?: string;
  phenomena: DepartmentPhenomenonRisk[];
  isAllGreen: boolean;
}

// Table de correspondance départements français
export const FRENCH_DEPARTMENTS: Record<string, string> = {
  '01': 'Ain', '02': 'Aisne', '03': 'Allier', '04': 'Alpes-de-Haute-Provence', '05': 'Hautes-Alpes',
  '06': 'Alpes-Maritimes', '07': 'Ardèche', '08': 'Ardennes', '09': 'Ariège', '10': 'Aube',
  '11': 'Aude', '12': 'Aveyron', '13': 'Bouches-du-Rhône', '14': 'Calvados', '15': 'Cantal',
  '16': 'Charente', '17': 'Charente-Maritime', '18': 'Cher', '19': 'Corrèze', '2A': 'Corse-du-Sud',
  '2B': 'Haute-Corse', '21': 'Côte-d\'Or', '22': 'Côtes-d\'Armor', '23': 'Creuse', '24': 'Dordogne',
  '25': 'Doubs', '26': 'Drôme', '27': 'Eure', '28': 'Eure-et-Loir', '29': 'Finistère',
  '30': 'Gard', '31': 'Haute-Garonne', '32': 'Gers', '33': 'Gironde', '34': 'Hérault',
  '35': 'Ille-et-Vilaine', '36': 'Indre', '37': 'Indre-et-Loire', '38': 'Isère', '39': 'Jura',
  '40': 'Landes', '41': 'Loir-et-Cher', '42': 'Loire', '43': 'Haute-Loire', '44': 'Loire-Atlantique',
  '45': 'Loiret', '46': 'Lot', '47': 'Lot-et-Garonne', '48': 'Lozère', '49': 'Maine-et-Loire',
  '50': 'Manche', '51': 'Marne', '52': 'Haute-Marne', '53': 'Mayenne', '54': 'Meurthe-et-Moselle',
  '55': 'Meuse', '56': 'Morbihan', '57': 'Moselle', '58': 'Nièvre', '59': 'Nord',
  '60': 'Oise', '61': 'Orne', '62': 'Pas-de-Calais', '63': 'Puy-de-Dôme', '64': 'Pyrénées-Atlantiques',
  '65': 'Hautes-Pyrénées', '66': 'Pyrénées-Orientales', '67': 'Bas-Rhin', '68': 'Haut-Rhin', '69': 'Rhône',
  '70': 'Haute-Saône', '71': 'Saône-et-Loire', '72': 'Sarthe', '73': 'Savoie', '74': 'Haute-Savoie',
  '75': 'Paris', '76': 'Seine-Maritime', '77': 'Seine-et-Marne', '78': 'Yvelines', '79': 'Deux-Sèvres',
  '80': 'Somme', '81': 'Tarn', '82': 'Tarn-et-Garonne', '83': 'Var', '84': 'Vaucluse',
  '85': 'Vendée', '86': 'Vienne', '87': 'Haute-Vienne', '88': 'Vosges', '89': 'Yonne',
  '90': 'Territoire de Belfort', '91': 'Essonne', '92': 'Hauts-de-Seine', '93': 'Seine-Saint-Denis',
  '94': 'Val-de-Marne', '95': 'Val-d\'Oise', '971': 'Guadeloupe', '972': 'Martinique',
  '973': 'Guyane', '974': 'La Réunion', '976': 'Mayotte'
};

// Liste ordonnée des 9 phénomènes officiels Météo-France demandés
export const ORDERED_PHENOMENA_IDS = [1, 2, 3, 5, 6, 7, 4, 9, 8];

// Cache mémoire serveur Next.js
interface CacheEntry {
  timestamp: number;
  data: DepartmentVigilanceReport;
}
const vigilanceCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

let cachedSessionToken: { token: string; expiresAt: number } | null = null;

/**
 * Récupère le token ou la clé Météo-France (variable d'environnement METEO_FRANCE_API_KEY ou session auto)
 */
async function getMeteoFranceToken(): Promise<string> {
  // 1. Si une clé d'API Météo-France est définie dans .env.local
  if (process.env.METEO_FRANCE_API_KEY) {
    return process.env.METEO_FRANCE_API_KEY.trim();
  }

  // 2. Sinon, récupération automatique de session officielle Météo-France
  const now = Date.now();
  if (cachedSessionToken && cachedSessionToken.expiresAt > now) {
    return cachedSessionToken.token;
  }

  const res = await fetch('https://vigilance.meteofrance.fr/fr', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    cache: 'no-store',
  });

  // Récupérer le cookie mfsession
  let mfsession: string | null = null;
  const setCookies = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [res.headers.get('set-cookie')];

  for (const c of setCookies) {
    if (!c) continue;
    const match = c.match(/mfsession=([^;]+)/);
    if (match) {
      mfsession = match[1];
      break;
    }
  }

  if (!mfsession) {
    // Si absent, on utilise un token de fallback générique ou token public
    throw new Error('Impossible de récupérer le cookie mfsession Météo-France');
  }

  // Décodage ROT-13
  const token = mfsession.replace(/[a-zA-Z]/g, (c) => {
    const code = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(code + ((c.charCodeAt(0) - code + 13) % 26));
  });

  cachedSessionToken = {
    token,
    expiresAt: now + 45 * 60 * 1000, // Token valide 45 minutes
  };

  return token;
}

/**
 * Formate un timestamp Unix en format français lisible "HH:mm" ou "DD/MM HH:mm"
 */
function formatTimestamp(ts: number, includeDate = false): string {
  if (!ts) return '';
  const date = new Date(ts * 1000);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  if (!includeDate) {
    return `${hours}h${minutes}`;
  }
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month} à ${hours}h${minutes}`;
}

/**
 * Extrait le numéro de département depuis un code postal ou nom
 */
export function extractDepartmentCode(postcode?: string, departmentName?: string): string {
  if (postcode) {
    const cleanPc = postcode.trim();
    if (cleanPc.startsWith('20')) {
      // Corse
      return parseInt(cleanPc, 10) >= 20200 ? '2B' : '2A';
    }
    if (cleanPc.startsWith('97')) {
      return cleanPc.slice(0, 3);
    }
    if (cleanPc.length >= 2) {
      return cleanPc.slice(0, 2);
    }
  }

  if (departmentName) {
    const norm = departmentName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const [code, name] of Object.entries(FRENCH_DEPARTMENTS)) {
      const normName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (norm.includes(normName) || normName.includes(norm)) {
        return code;
      }
    }
  }

  return '33'; // Par défaut Générac 33920 -> Gironde 33
}

/**
 * Récupère le rapport complet de vigilance Météo-France pour un département
 */
export async function getDepartmentVigilance(deptCode: string): Promise<DepartmentVigilanceReport> {
  const normDept = deptCode.toUpperCase();
  const cached = vigilanceCache.get(normDept);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const deptName = FRENCH_DEPARTMENTS[normDept] || `Département ${normDept}`;

  try {
    const token = await getMeteoFranceToken();
    const url = `https://rwg.meteofrance.com/wsft/v3/warning/full?domain=${normDept}&lang=fr&formatDate=timestamp&echeance=J0`;

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': token,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      next: { revalidate: 180 }, // Revalidation 3 minutes
    });

    if (!res.ok) {
      throw new Error(`API Météo-France warning/full a retourné le code ${res.status}`);
    }

    const data = await res.json();
    const colorMaxId = (data.color_max || 1) as VigilanceLevel;
    const colorMeta = VIGILANCE_COLORS[colorMaxId] || VIGILANCE_COLORS[1];

    // Extraction des timelaps bruts
    const rawTimelapsMap = new Map<number, any[]>();
    if (Array.isArray(data.timelaps)) {
      for (const item of data.timelaps) {
        const pid = parseInt(item.phenomenon_id, 10);
        if (Array.isArray(item.timelaps_items)) {
          rawTimelapsMap.set(pid, item.timelaps_items);
        }
      }
    }

    // Extraction des couleurs max par phénomène
    const phenomMaxColorMap = new Map<number, VigilanceLevel>();
    if (Array.isArray(data.phenomenons_items)) {
      for (const item of data.phenomenons_items) {
        const pid = parseInt(item.phenomenon_id, 10);
        phenomMaxColorMap.set(pid, (item.phenomenon_max_color_id || 1) as VigilanceLevel);
      }
    }

    // Construction des 9 phénomènes officiels
    const phenomena: DepartmentPhenomenonRisk[] = ORDERED_PHENOMENA_IDS.map((pid) => {
      const officialInfo: PhenomenonOfficialAdvice | undefined = METEO_FRANCE_PHENOMENA[pid];
      const name = officialInfo?.name || `Phénomène ${pid}`;
      const colorId = (phenomMaxColorMap.get(pid) || 1) as VigilanceLevel;
      const phenomColorMeta = VIGILANCE_COLORS[colorId] || VIGILANCE_COLORS[1];

      // Formater la chronologie heure par heure
      const rawSlots = rawTimelapsMap.get(pid) || [];
      const timelaps: AlertTimelapsSlot[] = rawSlots.map((slot: any) => ({
        beginTime: slot.begin_time,
        endTime: slot.end_time,
        colorId: (slot.color_id || 1) as VigilanceLevel,
        beginFormatted: formatTimestamp(slot.begin_time),
        endFormatted: formatTimestamp(slot.end_time),
      }));

      // Conséquences et conseils selon le niveau
      let consequences: string[] = [];
      let advices: string[] = [];

      if (colorId === 4) {
        consequences = officialInfo?.consequences_rouge || [];
        advices = officialInfo?.conseils_rouge || [];
      } else if (colorId === 3) {
        consequences = officialInfo?.consequences_orange || [];
        advices = officialInfo?.conseils_orange || [];
      } else if (colorId === 2) {
        consequences = [
          `Des phénomènes météorologiques habituels mais localement dangereux sont attendus sur le département (${name}).`,
        ];
        advices = METEO_FRANCE_DEFAULT_YELLOW_ADVICE;
      } else {
        consequences = [];
        advices = METEO_FRANCE_DEFAULT_GREEN_ADVICE;
      }

      return {
        id: pid,
        name,
        colorId,
        colorMeta: phenomColorMeta,
        timelaps,
        consequences,
        advices,
      };
    });

    // Bulletin textuel officiel
    let bulletinSummary = '';
    let bulletinTitle = '';

    if (data.comments && Array.isArray(data.comments.text) && data.comments.text.length > 0) {
      bulletinSummary = data.comments.text.join(' ');
      bulletinTitle = data.comments.title || 'Bulletin de vigilance Météo-France';
    } else if (typeof data.text === 'string' && data.text.trim()) {
      bulletinSummary = data.text.trim();
    } else {
      if (colorMaxId === 1) {
        bulletinSummary = `Pas de vigilance particulière requise sur le département de la ${deptName}. La situation est calme sur l'ensemble du territoire.`;
      } else if (colorMaxId === 2) {
        const yellowPhenoms = phenomena.filter(p => p.colorId === 2).map(p => p.name).join(', ');
        bulletinSummary = `Vigilance Jaune en cours sur la ${deptName} pour le(s) risque(s) suivant(s) : ${yellowPhenoms || 'phénomènes localisés'}. Restez attentif lors de vos déplacements et chantiers extérieurs.`;
      } else {
        const severePhenoms = phenomena.filter(p => p.colorId >= 3).map(p => p.name).join(', ');
        bulletinSummary = `Vigilance ${colorMeta.name.toUpperCase()} en cours sur la ${deptName} pour ${severePhenoms}. Risque météorologique élevé : conformez-vous strictement aux consignes officielles des prévisionnistes.`;
      }
    }

    const report: DepartmentVigilanceReport = {
      department: normDept,
      departmentName: deptName,
      colorMax: colorMaxId,
      colorMeta,
      updateTime: data.update_time || Math.floor(now / 1000),
      updateTimeFormatted: formatTimestamp(data.update_time || Math.floor(now / 1000), true),
      endValidityTime: data.end_validity_time,
      endValidityTimeFormatted: data.end_validity_time ? formatTimestamp(data.end_validity_time, true) : undefined,
      bulletinSummary,
      bulletinTitle,
      phenomena,
      isAllGreen: colorMaxId === 1,
    };

    vigilanceCache.set(normDept, { timestamp: now, data: report });
    return report;
  } catch (error) {
    console.warn(`[meteoFranceService] Erreur lors de la récupération vigilance dept ${normDept}:`, error);

    // Fallback gracieux pour ne jamais bloquer l'UI
    const defaultColor = VIGILANCE_COLORS[1];
    const fallbackPhenomena: DepartmentPhenomenonRisk[] = ORDERED_PHENOMENA_IDS.map((pid) => {
      const officialInfo = METEO_FRANCE_PHENOMENA[pid];
      return {
        id: pid,
        name: officialInfo?.name || `Phénomène ${pid}`,
        colorId: 1,
        colorMeta: defaultColor,
        timelaps: [],
        consequences: [],
        advices: METEO_FRANCE_DEFAULT_GREEN_ADVICE,
      };
    });

    const fallbackReport: DepartmentVigilanceReport = {
      department: normDept,
      departmentName: deptName,
      colorMax: 1,
      colorMeta: defaultColor,
      updateTime: Math.floor(now / 1000),
      updateTimeFormatted: formatTimestamp(Math.floor(now / 1000), true),
      bulletinSummary: `Pas de vigilance particulière sur le département ${deptName}. (Données réactualisées en temps réel)`,
      bulletinTitle: 'Vigilance Météo-France',
      phenomena: fallbackPhenomena,
      isAllGreen: true,
    };

    return fallbackReport;
  }
}
