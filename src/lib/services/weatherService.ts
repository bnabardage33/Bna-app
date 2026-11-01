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

/**
 * Récupère les données météo complètes pour une ville donnée
 */
export async function fetchWeatherData(city: GeoCity): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max&timezone=Europe%2FParis`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Erreur Open-Meteo (${res.status})`);
  }

  const raw = await res.json();

  // 1. Current data
  const current: LiveWeatherData = {
    time: raw.current.time,
    temperature_2m: Math.round(raw.current.temperature_2m * 10) / 10,
    apparent_temperature: Math.round(raw.current.apparent_temperature * 10) / 10,
    precipitation: Math.round((raw.current.precipitation ?? 0) * 10) / 10,
    wind_speed_10m: Math.round((raw.current.wind_speed_10m ?? 0) * 10) / 10,
    relative_humidity_2m: Math.round(raw.current.relative_humidity_2m ?? 0),
    weather_code: raw.current.weather_code ?? 0,
  };

  // 2. Traitement des jours
  const dates: string[] = raw.daily.time || [];
  const daily: DailyForecastDay[] = dates.map((dateStr, dIdx) => {
    const d = new Date(dateStr);
    const isToday = dIdx === 0;
    const isTomorrow = dIdx === 1;

    let dayLabel = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    if (isToday) dayLabel = "Aujourd'hui";
    else if (isTomorrow) dayLabel = "Demain";

    // Extraire les heures du jour
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

          // Tranche Matin (06:00 -> 12:00)
          if (hour >= 6 && hour < 12) {
            slotMatinRaw.push({ temp, precip, wind, gust, code });
          }
          // Tranche Après-midi (12:00 -> 19:00)
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
