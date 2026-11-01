'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  HardHat,
  ShieldAlert,
  Umbrella,
  Clock,
} from 'lucide-react';
import {
  GENERAC_DEFAULT,
  fetchWeatherData,
  searchCities,
  getWmoInfo,
  getCityFromChantier,
  getMetierOperationalAdvice,
  type GeoCity,
  type WeatherData,
} from '@/lib/services/weatherService';
import { WeatherIcon } from './WeatherIcon';
import { WeatherForecastModal } from './WeatherForecastModal';
import VigilanceModal from './VigilanceModal';
import {
  DepartmentVigilanceReport,
  extractDepartmentCode,
  VIGILANCE_COLORS,
} from '@/lib/services/meteoFranceService';
import type { Chantier } from '@/types/metier';

interface ChantierWeatherCardProps {
  chantier?: Chantier | null;
  allChantiers?: Chantier[];
  onSelectChantier?: (id: string) => void;
  compact?: boolean;
}

export const ChantierWeatherCard: React.FC<ChantierWeatherCardProps> = ({
  chantier,
  allChantiers = [],
  onSelectChantier,
  compact = false,
}) => {
  const [selectedCity, setSelectedCity] = useState<GeoCity>(GENERAC_DEFAULT);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Vigilance Météo-France
  const [vigilanceData, setVigilanceData] = useState<DepartmentVigilanceReport | null>(null);
  const [vigilanceLoading, setVigilanceLoading] = useState<boolean>(false);
  const [isVigilanceModalOpen, setIsVigilanceModalOpen] = useState<boolean>(false);

  // Recherche de ville / changement de localisation
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GeoCity[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Modal prévisions semaine
  const [isForecastModalOpen, setIsForecastModalOpen] = useState<boolean>(false);

  // Tranche sélectionnée pour le jour J (matin ou après-midi)
  const [activeSlot, setActiveSlot] = useState<'matin' | 'aprem'>('matin');

  // 1. CALAGE AUTOMATIQUE PAR RAPPORT À L'ADRESSE DU CHANTIER
  useEffect(() => {
    let isCancelled = false;

    async function resolveChantierCity() {
      if (chantier) {
        try {
          const resolved = await getCityFromChantier({
            id: chantier.id,
            nom: chantier.nom,
            adresse: chantier.adresse,
            code_postal: chantier.code_postal,
            ville: chantier.ville,
          });
          if (!isCancelled) {
            setSelectedCity(resolved);
          }
          return;
        } catch (e) {
          console.warn('Erreur résolution adresse chantier:', e);
        }
      }

      // Repli localStorage ou Générac par défaut
      try {
        const saved = localStorage.getItem('bna_selected_city');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.latitude && parsed?.longitude && !isCancelled) {
            setSelectedCity(parsed);
            return;
          }
        }
      } catch {
        // ignorer
      }

      if (!isCancelled) {
        setSelectedCity(GENERAC_DEFAULT);
      }
    }

    resolveChantierCity();

    return () => {
      isCancelled = true;
    };
  }, [chantier]);

  // 2. CHARGEMENT MÉTÉO (OPEN-METEO)
  const loadWeather = useCallback(async (city: GeoCity) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeatherData(city);
      setWeatherData(data);
    } catch (err: any) {
      console.error('Erreur chargement météo :', err);
      setError('Impossible de charger la météo en direct.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. CHARGEMENT VIGILANCE OFFICIELLE MÉTÉO-FRANCE
  const loadVigilance = useCallback(async (city: GeoCity) => {
    setVigilanceLoading(true);
    try {
      const deptCode = extractDepartmentCode(city.postcode, city.admin2 || city.name);
      const res = await fetch(
        `/api/weather/vigilance?dept=${deptCode}&postcode=${city.postcode || ''}&name=${encodeURIComponent(
          city.name || ''
        )}`
      );
      if (res.ok) {
        const data: DepartmentVigilanceReport = await res.json();
        setVigilanceData(data);
      }
    } catch (err) {
      console.warn('Erreur chargement vigilance :', err);
    } finally {
      setVigilanceLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeather(selectedCity);
    loadVigilance(selectedCity);
  }, [selectedCity, loadWeather, loadVigilance]);

  // Recherche de villes avec debouncing
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
      localStorage.setItem('bna_selected_city', JSON.stringify(city));
    } catch {
      // localStorage non dispo
    }
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const current = weatherData?.current;
  const todayForecast = weatherData?.daily?.[0];
  const wmo = current ? getWmoInfo(current.weather_code) : getWmoInfo(0);

  // Diagnostic métier BNA
  const metierAdvice = current
    ? getMetierOperationalAdvice(
        current.precipitation,
        todayForecast?.wind_gusts_10m_max || current.wind_speed_10m,
        current.temperature_2m
      )
    : null;

  return (
    <>
      <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs space-y-3 transition-shadow hover:shadow-sm">
        {/* EN-TÊTE CHANTIER AUTOMATIQUE & VIGILANCE */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {chantier ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-900 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
                <HardHat className="w-3 h-3 text-bna-copper shrink-0" />
                <span className="truncate max-w-[140px]">{chantier.nom}</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold tracking-wider text-bna-muted uppercase">
                MÉTÉO CHANTIER
              </span>
            )}

            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-bna-copper bg-orange-50 border border-orange-200/60 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>

            {/* Pastille Vigilance Météo-France 🟢🟡🟠🔴 */}
            <button
              type="button"
              onClick={() => setIsVigilanceModalOpen(true)}
              className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border shadow-2xs transition-all active:scale-95 ${
                vigilanceData?.colorMeta
                  ? `${vigilanceData.colorMeta.badgeBg} ${vigilanceData.colorMeta.badgeBorder} ${vigilanceData.colorMeta.badgeText}`
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
              title="Consulter la vigilance officielle Météo-France du chantier"
            >
              <span>{vigilanceData?.colorMeta ? vigilanceData.colorMeta.emoji : '🟢'}</span>
              <span className="uppercase">
                {vigilanceData?.colorMeta ? vigilanceData.colorMeta.name : 'Vert'}
              </span>
            </button>
          </div>

          {/* Bouton Localisation Chantier / Changement rapide */}
          <button
            type="button"
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] font-bold text-bna-anthracite hover:text-bna-copper bg-bna-offwhite hover:bg-neutral-100 border border-bna-border px-2.5 py-1 rounded-xl transition-colors shrink-0"
            title="Modifier la localisation ou choisir un autre chantier"
          >
            <MapPin className="w-3.5 h-3.5 text-bna-copper shrink-0" />
            <span className="max-w-[110px] sm:max-w-[140px] truncate">
              {selectedCity.name} {selectedCity.postcode ? `(${selectedCity.postcode})` : ''}
            </span>
            <Search className="w-3 h-3 text-bna-muted ml-0.5" />
          </button>
        </div>

        {/* Barre de recherche ou sélecteur rapide de chantiers */}
        {isSearchOpen && (
          <div className="relative pt-1 space-y-2 animate-in fade-in duration-150">
            {/* Si d'autres chantiers existent, proposer un basculement immédiat */}
            {allChantiers.length > 0 && (
              <div className="p-2 bg-amber-50/70 border border-amber-200/60 rounded-xl space-y-1">
                <p className="text-[10px] font-bold uppercase text-amber-900 tracking-wider">
                  Changer de chantier actif :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allChantiers.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={async () => {
                        if (onSelectChantier) onSelectChantier(ch.id);
                        const c = await getCityFromChantier(ch);
                        handleSelectCity(c);
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                        chantier?.id === ch.id
                          ? 'bg-amber-200/70 text-amber-950 border-amber-400 font-bold'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-bna-copper'
                      }`}
                    >
                      {ch.nom} ({ch.ville || 'Gironde'})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 bg-bna-offwhite border border-bna-border rounded-xl px-3 py-2 text-xs">
              <Search className="w-3.5 h-3.5 text-bna-muted shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ou chercher une ville (ex: Générac 33920, Mérignac, Bordeaux...)"
                className="w-full bg-transparent text-bna-anthracite placeholder-bna-muted focus:outline-none text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                className="text-bna-muted hover:text-bna-anthracite"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Suggestions de recherche */}
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
                      {city.name} {city.postcode ? `(${city.postcode})` : ''}
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

        {/* DONNÉES DU JOUR CHANTIER */}
        {loading ? (
          <div className="py-6 text-center text-xs text-bna-muted animate-pulse flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-bna-copper" />
            <span>Chargement météo chantier pour {selectedCity.name}...</span>
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
            {/* Ligne Température Live + WMO + Adresse chantier */}
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
                  <span className="font-semibold text-bna-anthracite">{wmo.label}</span>
                  <span>·</span>
                  <span>
                    {chantier?.adresse ? `${chantier.adresse}, ` : ''}
                    {selectedCity.name}
                  </span>
                </p>
              </div>

              {/* Icône WMO BNA */}
              <div
                className={`w-13 h-13 rounded-2xl ${wmo.bgClass} border border-bna-border/80 flex items-center justify-center shadow-xs`}
              >
                <WeatherIcon iconName={wmo.iconName} className={`w-7 h-7 ${wmo.colorClass}`} />
              </div>
            </div>

            {/* DIAGNOSTIC OPÉRATIONNEL MÉTIER BNA DU JOUR */}
            {metierAdvice && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                  metierAdvice.level === 'alerte'
                    ? 'bg-rose-50 text-rose-950 border-rose-200'
                    : metierAdvice.level === 'attention'
                    ? 'bg-amber-50 text-amber-950 border-amber-200'
                    : 'bg-emerald-50 text-emerald-950 border-emerald-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold">
                    {metierAdvice.level === 'alerte' ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : metierAdvice.level === 'attention' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span>{metierAdvice.title}</span>
                  </div>

                  {metierAdvice.bachage && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200/60 text-rose-800 border border-rose-300">
                      <Umbrella className="w-3 h-3" />
                      Bâchage requis
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] pt-1 text-slate-700">
                  <p>
                    <b className="text-slate-900">Terrasse :</b> {metierAdvice.terrasse}
                  </p>
                  <p>
                    <b className="text-slate-900">Bardage & Sciage :</b> {metierAdvice.bardage}
                  </p>
                </div>
              </div>
            )}

            {/* TRANCHES HORAIRES DU JOUR (MATIN & APRÈS-MIDI) */}
            {todayForecast && (
              <div className="bg-bna-offwhite p-2.5 rounded-xl border border-bna-border/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-bna-muted flex items-center gap-1">
                    <Clock className="w-3 h-3 text-bna-copper" />
                    Créneaux du jour sur chantier
                  </span>
                  <div className="flex items-center gap-1 p-0.5 bg-neutral-200/60 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setActiveSlot('matin')}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        activeSlot === 'matin'
                          ? 'bg-white text-bna-copper shadow-2xs'
                          : 'text-slate-600 hover:text-bna-anthracite'
                      }`}
                    >
                      Matin (06h-12h)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSlot('aprem')}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        activeSlot === 'aprem'
                          ? 'bg-white text-bna-copper shadow-2xs'
                          : 'text-slate-600 hover:text-bna-anthracite'
                      }`}
                    >
                      Après-midi (12h-19h)
                    </button>
                  </div>
                </div>

                {/* Détail du créneau actif */}
                {(() => {
                  const slot =
                    activeSlot === 'matin' ? todayForecast.matin : todayForecast.apresMidi;
                  return (
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-white p-1.5 rounded-lg border border-bna-border/50">
                        <span className="text-[9px] text-bna-muted block uppercase font-bold">
                          Temp. Moy.
                        </span>
                        <span className="font-extrabold text-bna-anthracite">
                          {Math.round(slot.tempAvg)}°C
                        </span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-bna-border/50">
                        <span className="text-[9px] text-bna-muted block uppercase font-bold">
                          Cumul Pluie
                        </span>
                        <span
                          className={`font-extrabold ${
                            slot.precipitationSum > 0.5 ? 'text-blue-700' : 'text-bna-anthracite'
                          }`}
                        >
                          {slot.precipitationSum} mm
                        </span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-bna-border/50">
                        <span className="text-[9px] text-bna-muted block uppercase font-bold">
                          Rafales Max
                        </span>
                        <span
                          className={`font-extrabold ${
                            slot.windGustMax >= 45 ? 'text-amber-700' : 'text-bna-anthracite'
                          }`}
                        >
                          {Math.round(slot.windGustMax)} km/h
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* GRILLE DES 3 MÉTRIQUES TEMPS RÉEL */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-bna-border/50 text-center">
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

              <div className="bg-bna-offwhite p-2 rounded-xl border border-bna-border/60">
                <div className="flex items-center justify-center gap-1 text-[10px] text-bna-muted font-bold uppercase mb-0.5">
                  <Wind className="w-3 h-3 text-bna-copper" />
                  <span>Vent</span>
                </div>
                <span className="text-xs font-extrabold text-bna-anthracite block">
                  {Math.round(current.wind_speed_10m)} km/h
                </span>
                <span className="text-[9px] text-bna-muted block">À 10 m</span>
              </div>

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

            {/* BOUTON PRÉVISIONS SEMAINE (7 JOURS) */}
            <button
              type="button"
              onClick={() => setIsForecastModalOpen(true)}
              className="w-full py-2.5 px-3 bg-amber-50/80 hover:bg-amber-100/90 text-amber-900 border border-amber-200/70 rounded-xl text-xs font-bold transition-all flex items-center justify-between group active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-bna-copper" />
                <span>Prévisions de la semaine (7 jours & créneaux)</span>
              </div>
              <ChevronRight className="w-4 h-4 text-bna-copper transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* BOUTON VIGILANCE OFFICIELLE MÉTÉO-FRANCE */}
            <button
              type="button"
              onClick={() => setIsVigilanceModalOpen(true)}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between border active:scale-[0.99] shadow-2xs ${
                vigilanceData?.colorMax && vigilanceData.colorMax > 1
                  ? `${vigilanceData.colorMeta.badgeBg} ${vigilanceData.colorMeta.badgeBorder} ${vigilanceData.colorMeta.badgeText}`
                  : 'bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-950 border-emerald-200/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">
                  {vigilanceData?.colorMeta ? vigilanceData.colorMeta.emoji : '🟢'}
                </span>
                <span className="font-bold">
                  Vigilance Météo-France ·{' '}
                  {vigilanceData
                    ? `${vigilanceData.departmentName} (${vigilanceData.department})`
                    : selectedCity.name}
                </span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-[11px] text-slate-600">
                <span>{vigilanceData?.colorMeta ? vigilanceData.colorMeta.name : 'Vert'}</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>
          </div>
        ) : null}
      </section>

      {/* MODAL PRÉVISIONS SEMAINE */}
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

      {/* MODAL VIGILANCE MÉTÉO-FRANCE */}
      <VigilanceModal
        isOpen={isVigilanceModalOpen}
        onClose={() => setIsVigilanceModalOpen(false)}
        vigilanceData={vigilanceData}
        isLoading={vigilanceLoading}
      />
    </>
  );
};
