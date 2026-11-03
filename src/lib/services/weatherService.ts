/**
 * BNA-APP — Service Météo Open-Meteo V1
 * Données Live, Prévisions 7 jours & Tranches Matin / Après-midi
 */

export interface GeoCity {
  id: number;
  name: string;
  postcode?: string;
  admin2?: string; // Département (ex: Gironde)
  country?: string;
  latitude: number;
  longitude: number;
}

export const GENERAC_DEFAULT: GeoCity = {
  id: 3016370,
  name: "Générac",
  postcode: "33920",
  admin2: "Gironde",
  country: "France",
  latitude: 45.17977,
  longitude: -0.54733,
};

export interface LiveWeatherData {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  precipitation: number;
  wind_speed_10m: number;
  relative_humidity_2m: number;
  weather_code: number;
}

export interface DaySlotData {
  tempAvg: number;
  tempMin: number;
  tempMax: number;
  precipitationSum: number;
  windSpeedAvg: number;
  windGustMax: number;
  weatherCode: number;
  hasRain: boolean;
}

export interface DailyForecastDay {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Aujourd'hui", "Lundi 2 nov.", etc.
  weather_code: number;
  temperature_2m_max: number;
  temperature_2m_min: number;
  precipitation_sum: number;
  precipitation_probability_max: number;
  wind_gusts_10m_max: number;
  matin: DaySlotData;
  apresMidi: DaySlotData;
  hourly: {
    hour: number;
    timeLabel: string;
    temperature_2m: number;
    precipitation: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  }[];
}

export interface WeatherData {
  city: GeoCity;
  current: LiveWeatherData;
  daily: DailyForecastDay[];
  fetchedAt: string;
  isStale?: boolean;
}

/**
 * Interprétation des codes WMO standard Open-Meteo
 */
export function getWmoInfo(code: number): {
  label: string;
  iconName: "Sun" | "CloudSun" | "Cloud" | "CloudFog" | "CloudDrizzle" | "CloudRain" | "CloudSnow" | "CloudLightning";
  colorClass: string;
  bgClass: string;
} {
  switch (code) {
    case 0:
      return { label: "Ensoleillé", iconName: "Sun", colorClass: "text-amber-500", bgClass: "bg-amber-50" };
    case 1:
      return { label: "Peu nuageux", iconName: "Sun", colorClass: "text-amber-500", bgClass: "bg-amber-50" };
    case 2:
      return { label: "Partiellement voilé", iconName: "CloudSun", colorClass: "text-amber-600", bgClass: "bg-amber-50" };
    case 3:
      return { label: "Couvert", iconName: "Cloud", colorClass: "text-neutral-500", bgClass: "bg-neutral-100" };
    case 45:
    case 48:
      return { label: "Brouillard", iconName: "CloudFog", colorClass: "text-slate-500", bgClass: "bg-slate-100" };
    case 51:
    case 53:
    case 55:
      return { label: "Bruine", iconName: "CloudDrizzle", colorClass: "text-blue-500", bgClass: "bg-blue-50" };
    case 56:
    case 57:
      return { label: "Bruine verglaçante", iconName: "CloudDrizzle", colorClass: "text-cyan-600", bgClass: "bg-cyan-50" };
    case 61:
      return { label: "Pluie faible", iconName: "CloudRain", colorClass: "text-blue-600", bgClass: "bg-blue-50" };
    case 63:
      return { label: "Pluie modérée", iconName: "CloudRain", colorClass: "text-blue-700", bgClass: "bg-blue-50" };
    case 65:
      return { label: "Forte pluie", iconName: "CloudRain", colorClass: "text-blue-800", bgClass: "bg-blue-100" };
    case 66:
    case 67:
      return { label: "Pluie verglaçante", iconName: "CloudRain", colorClass: "text-cyan-700", bgClass: "bg-cyan-50" };
    case 71:
    case 73:
    case 75:
    case 77:
      return { label: "Neige", iconName: "CloudSnow", colorClass: "text-indigo-600", bgClass: "bg-indigo-50" };
    case 80:
    case 81:
    case 82:
      return { label: "Averses de pluie", iconName: "CloudRain", colorClass: "text-blue-600", bgClass: "bg-blue-50" };
    case 85:
    case 86:
      return { label: "Averses de neige", iconName: "CloudSnow", colorClass: "text-indigo-600", bgClass: "bg-indigo-50" };
    case 95:
      return { label: "Orage", iconName: "CloudLightning", colorClass: "text-purple-600", bgClass: "bg-purple-50" };
    case 96:
    case 99:
      return { label: "Orage avec grêle", iconName: "CloudLightning", colorClass: "text-purple-700", bgClass: "bg-purple-100" };
    default:
      return { label: "Nuageux", iconName: "Cloud", colorClass: "text-neutral-500", bgClass: "bg-neutral-100" };
  }
}

/**
 * Recherche de coordonnées précises par adresse de chantier
 * Utilise api-adresse.data.gouv.fr puis Open-Meteo en repli
 */
const chantierGeoCache = new Map<string, GeoCity>();

export async function getCityFromChantier(chantier: {
  id?: string;
  nom?: string;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
}): Promise<GeoCity> {
  const ville = (chantier.ville || "").trim();
  const cp = (chantier.code_postal || "").trim();
  const adresse = (chantier.adresse || "").trim();

  // Si aucune info de localisation n'est fournie, repli sur Générac par défaut
  if (!ville && !cp && !adresse) {
    return GENERAC_DEFAULT;
  }

  const cacheKey = `${adresse}|${cp}|${ville}`.toLowerCase();
  if (chantierGeoCache.has(cacheKey)) {
    return chantierGeoCache.get(cacheKey)!;
  }

  // 1. Tenter avec l'API officielle adresse gouvernementale française
  const queryGov = [adresse, cp, ville].filter(Boolean).join(" ");
  try {
    const govUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(
      queryGov
    )}&limit=1`;
    const resGov = await fetch(govUrl, {
      headers: { "User-Agent": "BnaApp/1.0" },
    });
    if (resGov.ok) {
      const dataGov = await resGov.json();
      if (dataGov.features && dataGov.features.length > 0) {
        const feat = dataGov.features[0];
        const [lon, lat] = feat.geometry.coordinates;
        const props = feat.properties;
        const city: GeoCity = {
          id: Math.round(lat * 10000 + lon * 10000),
          name: props.city || props.name || ville || "Chantier",
          postcode: props.postcode || cp || undefined,
          admin2: props.context ? props.context.split(",")[1]?.trim() : undefined,
          country: "France",
          latitude: lat,
          longitude: lon,
        };
        chantierGeoCache.set(cacheKey, city);
        return city;
      }
    }
  } catch (err) {
    console.warn("api-adresse.data.gouv.fr error, fallback to open-meteo:", err);
  }

  // 2. Repli sur l'API Open-Meteo Geocoding
  const queryOm = [ville, cp].filter(Boolean).join(" ");
  try {
    const omResults = await searchCities(queryOm);
    if (omResults.length > 0) {
      const match = omResults[0];
      chantierGeoCache.set(cacheKey, match);
      return match;
    }
  } catch (err) {
    console.warn("Open-Meteo geocoding error:", err);
  }

  // 3. Fallback avec les coordonnées de Générac mais le nom du chantier
  const fallbackCity: GeoCity = {
    ...GENERAC_DEFAULT,
    name: ville || chantier.nom || "Chantier",
    postcode: cp || GENERAC_DEFAULT.postcode,
  };
  return fallbackCity;
}

/**
 * Conseils opérationnels détaillés pour les corps d'état Terrasse & Bardage
 */
export interface MetierOperationalAdvice {
  level: "ok" | "attention" | "alerte";
  title: string;
  terrasse: string;
  bardage: string;
  outillage: string;
  bachage: boolean;
}

export function getMetierOperationalAdvice(
  precipMm: number,
  windGustKmH: number,
  tempC: number
): MetierOperationalAdvice {
  // Cas 1 : Fortes intempéries ou rafales dangereuses ou gel
  if (precipMm >= 2.5 || windGustKmH >= 55 || tempC <= 1) {
    return {
      level: "alerte",
      title: "Interruption extérieure fortement conseillée",
      terrasse:
        tempC <= 1
          ? "Risque de gel : interdiction de coller ou visser sur bois gelé (fissuration)."
          : "Pluie soutenue : risque de dérapage sur lambourdes mouillées et dilatation rapide.",
      bardage:
        windGustKmH >= 55
          ? `Rafales à ${Math.round(windGustKmH)} km/h : manipulation de lames et travail en hauteur dangereux.`
          : "Interdire la pose de pare-pluie exposé à l'eau.",
      outillage: "Électroportatif sous abri obligatoire. Débrancher les chargeurs extérieurs.",
      bachage: true,
    };
  }

  // Cas 2 : Averses éparses ou vent modéré
  if (precipMm > 0.3 || windGustKmH >= 35 || tempC < 6) {
    return {
      level: "attention",
      title: "Vigilance chantier & précaution bâchage",
      terrasse:
        precipMm > 0.3
          ? "Humidité présente : essuyer avant traçage. Vérifier le jeu de dilatation (4 à 5 mm)."
          : "Conditions acceptables, contrôler l'humidité des lambourdes avant vissage.",
      bardage:
        windGustKmH >= 35
          ? `Vent moyen (${Math.round(windGustKmH)} km/h) : sécuriser la fixation des panneaux légers.`
          : "Pose possible, anticiper la protection contre les infiltrations.",
      outillage: "Protéger la table de sciage extérieure et les batteries du froid ou de l'humidité.",
      bachage: precipMm > 0.3,
    };
  }

  // Cas 3 : Conditions optimales
  return {
    level: "ok",
    title: "Conditions favorables pour le chantier",
    terrasse: "Temps sec optimal pour la pose de structure, calage des plots et fixation des lames.",
    bardage: "Absence de vent fort : pose de pare-pluie, tasseaux et bardage en toute sécurité.",
    outillage: "Découpes extérieures sans contrainte météorologique.",
    bachage: false,
  };
}

/**
 * Diagnostic terrain BNA pour les travaux extérieurs
 */
export function getChantierDiagnosis(precipMm: number, windGustKmH: number, tempC: number): {
  status: "ok" | "vigilance" | "alerte";
  label: string;
  detail: string;
} {
  if (precipMm >= 3.0 || windGustKmH >= 65 || tempC <= 0) {
    return {
      status: "alerte",
      label: "Interruption extérieure probable",
      detail:
        precipMm >= 3.0
          ? `Fortes pluies (${precipMm.toFixed(1)} mm) : bâchage requis`
          : windGustKmH >= 65
          ? `Rafales dangereuses (${Math.round(windGustKmH)} km/h) : arrêt levage`
          : "Gel / verglas : risque de glissade",
    };
  }

  if (precipMm > 0.4 || windGustKmH >= 45 || tempC < 3) {
    return {
      status: "vigilance",
      label: "Vigilance chantier",
      detail:
        precipMm > 0.4
          ? `Averses éparses (${precipMm.toFixed(1)} mm) : prévoir bâches`
          : `Vent soutenu (${Math.round(windGustKmH)} km/h) : caler les panneaux`,
    };
  }

  return {
    status: "ok",
    label: "Conditions optimales",
    detail: "Temps sec : pose extérieure et fixation favorables",
  };
}

/**
 * Recherche de villes via l'API Geocoding d'Open-Meteo
 */
export async function searchCities(query: string): Promise<GeoCity[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      cleanQuery
    )}&count=8&language=fr&format=json`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Erreur de recherche météo");
    const data = await res.json();

    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((r: any) => ({
      id: r.id,
      name: r.name,
      postcode: r.postcodes && r.postcodes.length > 0 ? r.postcodes[0] : undefined,
      admin2: r.admin2 || r.admin1,
      country: r.country || "France",
      latitude: r.latitude,
      longitude: r.longitude,
    }));
  } catch (err) {
    console.error("searchCities error:", err);
    return [];
  }
}

/**
 * Calcul d'une tranche horaire (Matin ou Après-midi)
 */
function computeSlot(hours: {
  temp: number;
  precip: number;
  wind: number;
  gust: number;
  code: number;
}[]): DaySlotData {
  if (hours.length === 0) {
    return {
      tempAvg: 0,
      tempMin: 0,
      tempMax: 0,
      precipitationSum: 0,
      windSpeedAvg: 0,
      windGustMax: 0,
      weatherCode: 0,
      hasRain: false,
    };
  }

  const temps = hours.map((h) => h.temp);
  const tempMin = Math.min(...temps);
  const tempMax = Math.max(...temps);
  const tempAvg = Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10;
  const precipitationSum = Math.round(hours.reduce((a, b) => a + b.precip, 0) * 10) / 10;
  const windSpeedAvg = Math.round((hours.reduce((a, b) => a + b.wind, 0) / hours.length) * 10) / 10;
  const windGustMax = Math.round(Math.max(...hours.map((h) => h.gust)) * 10) / 10;

  // Code météo le plus sévère
  const maxCode = Math.max(...hours.map((h) => h.code));

  return {
    tempAvg,
    tempMin,
    tempMax,
    precipitationSum,
    windSpeedAvg,
    windGustMax,
    weatherCode: maxCode,
    hasRain: precipitationSum > 0.1,
  };
}

// Cache météo (15 minutes de fraîcheur par coordonnées)
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;
const memoryWeatherCache = new Map<string, { data: WeatherData; timestamp: number }>();
const inFlightWeatherRequests = new Map<string, Promise<WeatherData>>();

function getWeatherCacheKey(city: GeoCity): string {
  return `${city.latitude.toFixed(3)}_${city.longitude.toFixed(3)}`;
}

function getStoredWeatherCache(key: string): { data: WeatherData; timestamp: number } | null {
  const inMem = memoryWeatherCache.get(key);
  if (inMem) return inMem;

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`bna_weather_cache_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.data && parsed.timestamp) {
          memoryWeatherCache.set(key, parsed);
          return parsed;
        }
      }
    } catch {
      // localStorage indisponible ou plein
    }
  }
  return null;
}

function setStoredWeatherCache(key: string, data: WeatherData): void {
  const item = { data, timestamp: Date.now() };
  memoryWeatherCache.set(key, item);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`bna_weather_cache_${key}`, JSON.stringify(item));
    } catch {
      // Ignorer si localStorage plein
    }
  }
}

/**
 * Exécute une requête avec tentatives multiples (retry) et délai exponentiel
 * pour absorber les surcharges temporaires d'Open-Meteo (503 / 502 / 504 / 429)
 */
async function fetchWithRetry(url: string, maxRetries = 2): Promise<Response> {
  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
        if (attempt < maxRetries) {
          const delay = (attempt + 1) * 800;
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempt++;
          continue;
        }
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = (attempt + 1) * 800;
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Échec de connexion après plusieurs tentatives");
}

function parseOpenMeteoPayload(city: GeoCity, raw: any): WeatherData {
  const current: LiveWeatherData = {
    time: raw.current.time,
    temperature_2m: Math.round(raw.current.temperature_2m * 10) / 10,
    apparent_temperature: Math.round(raw.current.apparent_temperature * 10) / 10,
    precipitation: Math.round((raw.current.precipitation ?? 0) * 10) / 10,
    wind_speed_10m: Math.round((raw.current.wind_speed_10m ?? 0) * 10) / 10,
    relative_humidity_2m: Math.round(raw.current.relative_humidity_2m ?? 0),
    weather_code: raw.current.weather_code ?? 0,
  };

  const dates: string[] = raw.daily.time || [];
  const daily: DailyForecastDay[] = dates.map((dateStr, dIdx) => {
    const d = new Date(dateStr);
    const isToday = dIdx === 0;
    const isTomorrow = dIdx === 1;

    let dayLabel = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    if (isToday) dayLabel = "Aujourd'hui";
    else if (isTomorrow) dayLabel = "Demain";

    const hourlyForDay: DailyForecastDay["hourly"] = [];
    const slotMatinRaw: { temp: number; precip: number; wind: number; gust: number; code: number }[] = [];
    const slotApremRaw: { temp: number; precip: number; wind: number; gust: number; code: number }[] = [];

    if (raw.hourly && raw.hourly.time) {
      for (let hIdx = 0; hIdx < raw.hourly.time.length; hIdx++) {
        const timeVal: string = raw.hourly.time[hIdx];
        if (timeVal.startsWith(dateStr)) {
          const hour = parseInt(timeVal.split("T")[1].split(":")[0], 10);
          const temp = raw.hourly.temperature_2m[hIdx];
          const precip = raw.hourly.precipitation[hIdx] ?? 0;
          const wind = raw.hourly.wind_speed_10m[hIdx] ?? 0;
          const gust = raw.hourly.wind_gusts_10m[hIdx] ?? wind;
          const code = raw.hourly.weather_code[hIdx] ?? 0;

          hourlyForDay.push({
            hour,
            timeLabel: `${String(hour).padStart(2, "0")}h`,
            temperature_2m: Math.round(temp * 10) / 10,
            precipitation: Math.round(precip * 10) / 10,
            wind_speed_10m: Math.round(wind * 10) / 10,
            wind_gusts_10m: Math.round(gust * 10) / 10,
            weather_code: code,
          });

          if (hour >= 6 && hour < 12) {
            slotMatinRaw.push({ temp, precip, wind, gust, code });
          }
          if (hour >= 12 && hour < 19) {
            slotApremRaw.push({ temp, precip, wind, gust, code });
          }
        }
      }
    }

    return {
      date: dateStr,
      dayLabel,
      weather_code: raw.daily.weather_code[dIdx] ?? 0,
      temperature_2m_max: Math.round(raw.daily.temperature_2m_max[dIdx] * 10) / 10,
      temperature_2m_min: Math.round(raw.daily.temperature_2m_min[dIdx] * 10) / 10,
      precipitation_sum: Math.round((raw.daily.precipitation_sum[dIdx] ?? 0) * 10) / 10,
      precipitation_probability_max: Math.round(raw.daily.precipitation_probability_max?.[dIdx] ?? 0),
      wind_gusts_10m_max: Math.round((raw.daily.wind_gusts_10m_max[dIdx] ?? 0) * 10) / 10,
      matin: computeSlot(slotMatinRaw),
      apresMidi: computeSlot(slotApremRaw),
      hourly: hourlyForDay,
    };
  });

  return {
    city,
    current,
    daily,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Récupère les données météo complètes pour une ville donnée.
 * Intègre un cache mémoire + localStorage, déduplication des requêtes simultanées,
 * retry automatique et repli de secours sur le cache en cas de 503 Open-Meteo.
 */
export async function fetchWeatherData(city: GeoCity, forceRefresh = false): Promise<WeatherData> {
  const cacheKey = getWeatherCacheKey(city);
  const now = Date.now();

  // 1. Si pas de rafraîchissement forcé, vérifier la présence d'un cache frais (< 15 min)
  if (!forceRefresh) {
    const cached = getStoredWeatherCache(cacheKey);
    if (cached && now - cached.timestamp < WEATHER_CACHE_TTL_MS) {
      return {
        ...cached.data,
        city,
      };
    }
  }

  // 2. Dédupliquer les requêtes concurrentes en vol
  if (inFlightWeatherRequests.has(cacheKey)) {
    return inFlightWeatherRequests.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max&timezone=Europe%2FParis`;

    try {
      const res = await fetchWithRetry(url, 2);
      if (!res.ok) {
        throw new Error(`Erreur Open-Meteo (${res.status})`);
      }

      const raw = await res.json();
      const weatherData = parseOpenMeteoPayload(city, raw);
      setStoredWeatherCache(cacheKey, weatherData);
      return weatherData;
    } catch (err: any) {
      // 3. Repli de secours : si Open-Meteo est en panne (ex: 503) mais qu'on a déjà des données en cache
      const staleCached = getStoredWeatherCache(cacheKey);
      if (staleCached?.data) {
        console.warn(
          `Open-Meteo indisponible (${err?.message || err}). Utilisation des données en cache sauvegardées.`
        );
        return {
          ...staleCached.data,
          city,
          isStale: true,
        };
      }
      throw err;
    } finally {
      inFlightWeatherRequests.delete(cacheKey);
    }
  })();

  inFlightWeatherRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}
