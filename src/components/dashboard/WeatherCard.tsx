"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MapPin,
  Search,
  CloudRain,
  Wind,
  Droplets,
  Calendar,
  ChevronRight,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  GENERAC_DEFAULT,
  fetchWeatherData,
  searchCities,
  getWmoInfo,
  getChantierDiagnosis,
  type GeoCity,
  type WeatherData,
} from "@/lib/services/weatherService";
import { WeatherIcon } from "../weather/WeatherIcon";
import { WeatherForecastModal } from "../weather/WeatherForecastModal";
import VigilanceModal from "../weather/VigilanceModal";
import {
  DepartmentVigilanceReport,
  extractDepartmentCode,
  VIGILANCE_COLORS,
} from "@/lib/services/meteoFranceService";

export const WeatherCard: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState<GeoCity>(GENERAC_DEFAULT);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Recherche de ville
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<GeoCity[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Modal prévisions
  const [isForecastModalOpen, setIsForecastModalOpen] = useState<boolean>(false);

  // Vigilance Météo-France
  const [vigilanceData, setVigilanceData] = useState<DepartmentVigilanceReport | null>(null);
  const [vigilanceLoading, setVigilanceLoading] = useState<boolean>(false);
  const [isVigilanceModalOpen, setIsVigilanceModalOpen] = useState<boolean>(false);

  // Charger la ville mémorisée dans le navigateur ou Générac par défaut
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bna_selected_city");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.latitude && parsed.longitude) {
          setSelectedCity(parsed);
          return;
        }
      }
    } catch {
      // Ignorer erreur localStorage
    }
    setSelectedCity(GENERAC_DEFAULT);
  }, []);

  // Charger les données météo
  const loadWeather = useCallback(async (city: GeoCity) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeatherData(city);
      setWeatherData(data);
    } catch (err: any) {
      console.error("Erreur chargement météo :", err);
      setError("Impossible de charger la météo en direct.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les données de vigilance Météo-France
  const loadVigilance = useCallback(async (city: GeoCity) => {
    setVigilanceLoading(true);
    try {
      const deptCode = extractDepartmentCode(city.postcode, city.admin2 || city.name);
      const res = await fetch(`/api/weather/vigilance?dept=${deptCode}&postcode=${city.postcode || ''}&name=${encodeURIComponent(city.name || '')}`);
      if (res.ok) {
        const data: DepartmentVigilanceReport = await res.json();
        setVigilanceData(data);
      }
    } catch (err) {
      console.warn("Erreur chargement vigilance :", err);
    } finally {
      setVigilanceLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeather(selectedCity);
    loadVigilance(selectedCity);
  }, [selectedCity, loadWeather, loadVigilance]);

  // Recherche de villes avec debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        const results = await searchCities(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectCity = (city: GeoCity) => {
    setSelectedCity(city);
    try {
      localStorage.setItem("bna_selected_city", JSON.stringify(city));
    } catch {
      // localStorage non dispo
    }
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const current = weatherData?.current;
  const wmo = current ? getWmoInfo(current.weather_code) : getWmoInfo(0);
  const diagnosis = current
    ? getChantierDiagnosis(current.precipitation, current.wind_speed_10m, current.temperature_2m)
    : null;

  return (
    <>
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs space-y-3 transition-shadow hover:shadow-sm">
        {/* En-tête : Badge météo + Pastille Vigilance Live 🟢🟡🟠🔴 + Sélecteur de ville */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold tracking-wider text-bna-muted uppercase">
              MÉTÉO
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-bna-copper bg-orange-50 border border-orange-200/60 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>

            {/* Pastille Live Vigilance Météo-France 🟢🟡🟠🔴 */}
            <button
              type="button"
              onClick={() => setIsVigilanceModalOpen(true)}
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border shadow-2xs transition-all active:scale-95 ${
                vigilanceData?.colorMeta
                  ? `${vigilanceData.colorMeta.badgeBg} ${vigilanceData.colorMeta.badgeBorder} ${vigilanceData.colorMeta.badgeText}`
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
              title="Consulter le bulletin officiel de vigilance Météo-France"
            >
              <span className="text-xs">
                {vigilanceData?.colorMeta ? vigilanceData.colorMeta.emoji : "🟢"}
              </span>
              <span className="text-[10px] font-extrabold uppercase">
                {vigilanceData?.colorMeta ? vigilanceData.colorMeta.name : "Vert"}
              </span>
            </button>
          </div>

          {/* Bouton changement de ville */}
          <button
            type="button"
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] font-bold text-bna-anthracite hover:text-bna-copper bg-bna-offwhite hover:bg-neutral-100 border border-bna-border px-2.5 py-1 rounded-xl transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-bna-copper shrink-0" />
            <span className="max-w-[130px] truncate">
              {selectedCity.name} {selectedCity.postcode ? `(${selectedCity.postcode})` : ""}
            </span>
            <Search className="w-3 h-3 text-bna-muted ml-0.5" />
          </button>
        </div>

        {/* Barre de recherche intégrée si ouverte */}
        {isSearchOpen && (
          <div className="relative pt-1 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 bg-bna-offwhite border border-bna-border rounded-xl px-3 py-2 text-xs">
              <Search className="w-3.5 h-3.5 text-bna-muted shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une ville (ex: Générac 33920, Bordeaux...)"
                className="w-full bg-transparent text-bna-anthracite placeholder-bna-muted focus:outline-none text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }}
                className="text-bna-muted hover:text-bna-anthracite"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Suggestions de villes */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-bna-border rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto divide-y divide-bna-border/50">
                {searchResults.map((city) => (
                  <button
                    key={`${city.id}-${city.latitude}`}
                    type="button"
                    onClick={() => handleSelectCity(city)}
                    className="w-full text-left px-3 py-2 hover:bg-amber-50/60 transition-colors flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-bna-anthracite">
                      {city.name} {city.postcode ? `(${city.postcode})` : ""}
                    </span>
                    <span className="text-[10px] text-bna-muted">
                      {city.admin2 || city.country}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bloc Données Live */}
        {loading ? (
          <div className="py-6 text-center text-xs text-bna-muted animate-pulse flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-bna-copper" />
            <span>Actualisation météo pour {selectedCity.name}...</span>
          </div>
        ) : error ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => loadWeather(selectedCity)}
              className="font-bold underline text-xs"
            >
              Réessayer
            </button>
          </div>
        ) : current ? (
          <div className="space-y-3">
            {/* Ligne Température & Logo Météo */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display font-black text-3xl text-bna-anthracite">
                    {Math.round(current.temperature_2m)}°C
                  </span>
                  <span className="text-xs font-semibold text-bna-muted">
                    Ressenti {Math.round(current.apparent_temperature)}°C
                  </span>
                </div>
                <p className="text-xs font-medium text-bna-muted mt-0.5 flex items-center gap-1">
                  <span>{wmo.label}</span>
                  <span>·</span>
                  <span>{selectedCity.name}</span>
                </p>
              </div>

              {/* Logo / Icône Météo BNA */}
              <div
                className={`w-13 h-13 rounded-2xl ${wmo.bgClass} border border-bna-border/80 flex items-center justify-center shadow-xs`}
              >
                <WeatherIcon iconName={wmo.iconName} className={`w-7 h-7 ${wmo.colorClass}`} />
              </div>
            </div>

            {/* Diagnostic Chantier */}
            {diagnosis && (
              <div
                className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-2 font-medium ${
                  diagnosis.status === "alerte"
                    ? "bg-red-50 text-red-800 border-red-200"
                    : diagnosis.status === "vigilance"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}
              >
                {diagnosis.status === "ok" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">
                  <b>{diagnosis.label}</b> : {diagnosis.detail}
                </span>
              </div>
            )}

            {/* Grille des 3 métriques Live spécifiques demandées */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-bna-border/50 text-center">
              {/* 1. Pluie temps réel */}
              <div className="bg-bna-offwhite p-2 rounded-xl border border-bna-border/60">
                <div className="flex items-center justify-center gap-1 text-[10px] text-bna-muted font-bold uppercase mb-0.5">
                  <CloudRain className="w-3 h-3 text-blue-600" />
                  <span>Pluie</span>
                </div>
                <span className="text-xs font-extrabold text-bna-anthracite block">
                  {current.precipitation} mm
                </span>
                <span className="text-[9px] text-bna-muted block">En temps réel</span>
              </div>

              {/* 2. Vent actuel */}
              <div className="bg-bna-offwhite p-2 rounded-xl border border-bna-border/60">
                <div className="flex items-center justify-center gap-1 text-[10px] text-bna-muted font-bold uppercase mb-0.5">
                  <Wind className="w-3 h-3 text-bna-copper" />
                  <span>Vent</span>
                </div>
                <span className="text-xs font-extrabold text-bna-anthracite block">
                  {Math.round(current.wind_speed_10m)} km/h
                </span>
                <span className="text-[9px] text-bna-muted block">À 10 m du sol</span>
              </div>

              {/* 3. Humidité */}
              <div className="bg-bna-offwhite p-2 rounded-xl border border-bna-border/60">
                <div className="flex items-center justify-center gap-1 text-[10px] text-bna-muted font-bold uppercase mb-0.5">
                  <Droplets className="w-3 h-3 text-cyan-600" />
                  <span>Humidité</span>
                </div>
                <span className="text-xs font-extrabold text-bna-anthracite block">
                  {current.relative_humidity_2m} %
                </span>
                <span className="text-[9px] text-bna-muted block">Taux dans l'air</span>
              </div>
            </div>

            {/* Bouton Prévisions 7 jours & Tranches Matin/Après-midi */}
            <button
              type="button"
              onClick={() => setIsForecastModalOpen(true)}
              className="w-full mt-2 py-2.5 px-3 bg-amber-50/80 hover:bg-amber-100/90 text-amber-900 border border-amber-200/70 rounded-xl text-xs font-bold transition-all flex items-center justify-between group active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-bna-copper" />
                <span>Prévisions 7 jours & créneaux Matin / Après-midi</span>
              </div>
              <ChevronRight className="w-4 h-4 text-bna-copper transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* Bouton Vigilance Officielle Météo-France (9 phénomènes & chronologie) */}
            <button
              type="button"
              onClick={() => setIsVigilanceModalOpen(true)}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between border active:scale-[0.99] shadow-2xs ${
                vigilanceData?.colorMax && vigilanceData.colorMax > 1
                  ? `${vigilanceData.colorMeta.badgeBg} ${vigilanceData.colorMeta.badgeBorder} ${vigilanceData.colorMeta.badgeText}`
                  : "bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-950 border-emerald-200/80"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">
                  {vigilanceData?.colorMeta ? vigilanceData.colorMeta.emoji : "🟢"}
                </span>
                <span className="font-bold">
                  Vigilance Météo-France · {vigilanceData ? `${vigilanceData.departmentName} (${vigilanceData.department})` : selectedCity.name}
                </span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-[11px] text-slate-600">
                <span>{vigilanceData?.colorMeta ? vigilanceData.colorMeta.name : "Vert"}</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>
          </div>
        ) : null}
      </section>

      {/* Modal complet des prévisions */}
      <WeatherForecastModal
        isOpen={isForecastModalOpen}
        onClose={() => setIsForecastModalOpen(false)}
        weatherData={weatherData}
        onSelectCity={handleSelectCity}
        searchResults={searchResults}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSearching={isSearching}
      />

      {/* Modal officiel Vigilance Météo-France */}
      <VigilanceModal
        isOpen={isVigilanceModalOpen}
        onClose={() => setIsVigilanceModalOpen(false)}
        vigilanceData={vigilanceData}
        isLoading={vigilanceLoading}
      />
    </>
  );
};
