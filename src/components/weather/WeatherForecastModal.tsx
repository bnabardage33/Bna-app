"use client";

import React, { useState } from "react";
import {
  X,
  Search,
  MapPin,
  Calendar,
  Clock,
  Wind,
  Droplets,
  Umbrella,
  Thermometer,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Sun,
  Sunrise,
  Sunset,
  CloudRain,
  Compass,
} from "lucide-react";
import type { WeatherData, GeoCity, DailyForecastDay } from "@/lib/services/weatherService";
import { getWmoInfo, getChantierDiagnosis } from "@/lib/services/weatherService";
import { WeatherIcon } from "./WeatherIcon";

interface WeatherForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  weatherData: WeatherData | null;
  onSelectCity: (city: GeoCity) => void;
  searchResults: GeoCity[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isSearching: boolean;
}

export const WeatherForecastModal: React.FC<WeatherForecastModalProps> = ({
  isOpen,
  onClose,
  weatherData,
  onSelectCity,
  searchResults,
  searchQuery,
  onSearchChange,
  isSearching,
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const [forecastView, setForecastView] = useState<"slots" | "hourly" | "week">("slots");

  if (!isOpen || !weatherData) return null;

  const currentCity = weatherData.city;
  const days = weatherData.daily;
  const currentDay: DailyForecastDay = days[selectedDayIndex] || days[0];

  const wmoInfo = getWmoInfo(currentDay.weather_code);
  const diagMatin = getChantierDiagnosis(
    currentDay.matin.precipitationSum,
    currentDay.matin.windGustMax,
    currentDay.matin.tempAvg
  );
  const diagAprem = getChantierDiagnosis(
    currentDay.apresMidi.precipitationSum,
    currentDay.apresMidi.windGustMax,
    currentDay.apresMidi.tempAvg
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-2 sm:pt-6 pb-20 sm:pb-8 px-3 sm:px-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-mobile bg-white rounded-2xl max-h-full flex flex-col overflow-hidden shadow-2xl border border-bna-border animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header avec barre de recherche intégrée */}
        <div className="shrink-0 p-4 pb-3 border-b border-bna-border/60 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60">
                <Calendar className="w-5 h-5 text-bna-copper" />
              </div>
              <div>
                <span className="font-display font-bold text-base text-bna-anthracite block leading-tight">
                  Prévisions Météo BNA
                </span>
                <span className="text-[11px] text-bna-muted flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-bna-copper" />
                  <span className="font-semibold text-bna-anthracite">
                    {currentCity.name} {currentCity.postcode ? `(${currentCity.postcode})` : ""}
                  </span>
                  {currentCity.admin2 && <span>· {currentCity.admin2}</span>}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-neutral-100 text-bna-muted transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Barre de recherche de ville */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-bna-offwhite border border-bna-border rounded-xl px-3 py-2 text-xs">
              <Search className="w-4 h-4 text-bna-muted shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                placeholder="Changer de ville (ex: Générac, Bordeaux, Blaye...)"
                className="w-full bg-transparent text-bna-anthracite placeholder-bna-muted focus:outline-none text-xs"
              />
              {isSearching && (
                <span className="text-[10px] text-bna-muted animate-pulse">...</span>
              )}
            </div>

            {/* Dropdown résultats de recherche */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-bna-border rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-bna-border/50">
                {searchResults.map((city) => (
                  <button
                    key={`${city.id}-${city.latitude}`}
                    type="button"
                    onClick={() => {
                      onSelectCity(city);
                      setShowSearchDropdown(false);
                      onSearchChange("");
                    }}
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

          {/* Sélecteur de vue : Tranches Horaires / Heure par Heure / Semaine */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 rounded-xl text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setForecastView("slots")}
              className={`py-1.5 rounded-lg transition-all ${
                forecastView === "slots"
                  ? "bg-white text-bna-copper shadow-xs"
                  : "text-bna-muted hover:text-bna-anthracite"
              }`}
            >
              Matin / Aprem
            </button>
            <button
              type="button"
              onClick={() => setForecastView("hourly")}
              className={`py-1.5 rounded-lg transition-all ${
                forecastView === "hourly"
                  ? "bg-white text-bna-copper shadow-xs"
                  : "text-bna-muted hover:text-bna-anthracite"
              }`}
            >
              Heure par Heure
            </button>
            <button
              type="button"
              onClick={() => setForecastView("week")}
              className={`py-1.5 rounded-lg transition-all ${
                forecastView === "week"
                  ? "bg-white text-bna-copper shadow-xs"
                  : "text-bna-muted hover:text-bna-anthracite"
              }`}
            >
              7 Jours
            </button>
          </div>
        </div>

        {/* Corps déroulant */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Sélecteur de jour scrollable (7 jours) */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {days.map((day, idx) => {
              const isSelected = idx === selectedDayIndex;
              const dayWmo = getWmoInfo(day.weather_code);
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`shrink-0 px-3 py-2 rounded-xl text-center border transition-all ${
                    isSelected
                      ? "bg-bna-copper text-white border-bna-copper shadow-xs"
                      : "bg-bna-offwhite text-bna-anthracite border-bna-border hover:bg-neutral-100"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase block tracking-wider">
                    {day.dayLabel.split(" ")[0]}
                  </span>
                  <div className="my-1 flex justify-center">
                    <WeatherIcon
                      iconName={dayWmo.iconName}
                      className={`w-4 h-4 ${isSelected ? "text-white" : dayWmo.colorClass}`}
                    />
                  </div>
                  <span className="text-xs font-extrabold block">
                    {Math.round(day.temperature_2m_max)}°
                  </span>
                  <span
                    className={`text-[9px] block ${
                      isSelected ? "text-white/80" : "text-bna-muted"
                    }`}
                  >
                    {Math.round(day.temperature_2m_min)}°
                  </span>
                </button>
              );
            })}
          </div>

          {/* Synthèse du jour sélectionné */}
          <div className="p-3.5 bg-bna-offwhite rounded-2xl border border-bna-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-bna-muted block">
                  JOUR SÉLECTIONNÉ
                </span>
                <span className="text-base font-extrabold text-bna-anthracite capitalize block">
                  {currentDay.dayLabel} ({currentDay.date})
                </span>
                <span className="text-xs text-bna-muted font-medium">
                  {wmoInfo.label}
                </span>
              </div>

              <div
                className={`w-12 h-12 rounded-2xl ${wmoInfo.bgClass} flex items-center justify-center border border-bna-border shadow-xs`}
              >
                <WeatherIcon iconName={wmoInfo.iconName} className={`w-7 h-7 ${wmoInfo.colorClass}`} />
              </div>
            </div>

            {/* 4 Indicateurs Clés de la Journée */}
            <div className="grid grid-cols-4 gap-2 pt-1 border-t border-bna-border/50 text-center">
              <div className="bg-white p-2 rounded-xl border border-bna-border/60">
                <span className="text-[9px] text-bna-muted uppercase block font-bold">Max / Min</span>
                <span className="text-xs font-black text-bna-anthracite">
                  {currentDay.temperature_2m_max}° / {currentDay.temperature_2m_min}°
                </span>
              </div>

              <div className="bg-white p-2 rounded-xl border border-bna-border/60">
                <span className="text-[9px] text-bna-muted uppercase block font-bold">Pluie 24h</span>
                <span className="text-xs font-black text-blue-700">
                  {currentDay.precipitation_sum} mm
                </span>
              </div>

              <div className="bg-white p-2 rounded-xl border border-bna-border/60">
                <span className="text-[9px] text-bna-muted uppercase block font-bold">Risque</span>
                <span className="text-xs font-black text-amber-700">
                  {currentDay.precipitation_probability_max} %
                </span>
              </div>

              <div className="bg-white p-2 rounded-xl border border-bna-border/60">
                <span className="text-[9px] text-bna-muted uppercase block font-bold">Rafales</span>
                <span className="text-xs font-black text-purple-700">
                  {Math.round(currentDay.wind_gusts_10m_max)} km/h
                </span>
              </div>
            </div>
          </div>

          {/* VUE 1 : TRANCHES HORAIRES MATIN / APRÈS-MIDI */}
          {forecastView === "slots" && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
                  TRANCHES HORAIRES CHANTIER
                </b>
                <span className="text-[10px] text-bna-muted font-medium">
                  Spécifique pose extérieure
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* TRANCHE MATIN (06h - 12h) */}
                <div className="p-3.5 bg-white rounded-2xl border border-bna-border shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                        <Sunrise className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-extrabold text-bna-anthracite block">
                          MATIN
                        </span>
                        <span className="text-[10px] text-bna-muted">06h00 – 12h00</span>
                      </div>
                    </div>

                    <span className="text-sm font-black text-bna-anthracite">
                      {currentDay.matin.tempAvg}°C
                    </span>
                  </div>

                  {/* Diagnostic BNA Matin */}
                  <div
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] flex items-center gap-1.5 font-semibold ${
                      diagMatin.status === "alerte"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : diagMatin.status === "vigilance"
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    }`}
                  >
                    {diagMatin.status === "ok" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{diagMatin.label}</span>
                  </div>

                  {/* Détails Matin */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1 text-center text-[10px]">
                    <div className="bg-bna-offwhite p-1.5 rounded-lg">
                      <span className="text-bna-muted block">Pluie</span>
                      <b className="text-blue-700 font-extrabold">
                        {currentDay.matin.precipitationSum} mm
                      </b>
                    </div>
                    <div className="bg-bna-offwhite p-1.5 rounded-lg">
                      <span className="text-bna-muted block">Vent</span>
                      <b className="text-bna-anthracite font-extrabold">
                        {Math.round(currentDay.matin.windSpeedAvg)} km/h
                      </b>
                    </div>
                    <div className="bg-bna-offwhite p-1.5 rounded-lg">
                      <span className="text-bna-muted block">Rafales</span>
                      <b className="text-purple-700 font-extrabold">
                        {Math.round(currentDay.matin.windGustMax)} km/h
                      </b>
                    </div>
                  </div>
                </div>

                {/* TRANCHE APRÈS-MIDI (12h - 19h) */}
                <div className="p-3.5 bg-white rounded-2xl border border-bna-border shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-200">
                        <Sunset className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-extrabold text-bna-anthracite block">
                          APRÈS-MIDI
                        </span>
                        <span className="text-[10px] text-bna-muted">12h00 – 19h00</span>
                      </div>
                    </div>

                    <span className="text-sm font-black text-bna-anthracite">
                      {currentDay.apresMidi.tempAvg}°C
                    </span>
                  </div>

                  {/* Diagnostic BNA Après-midi */}
                  <div
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] flex items-center gap-1.5 font-semibold ${
                      diagAprem.status === "alerte"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : diagAprem.status === "vigilance"
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    }`}
                  >
                    {diagAprem.status === "ok" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{diagAprem.label}</span>
                  </div>

                  {/* Détails Après-midi */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1 text-center text-[10px]">
                    <div className="bg-bna-offwhite p-1.5 rounded-lg">
                      <span className="text-bna-muted block">Pluie</span>
                      <b className="text-blue-700 font-extrabold">
                        {currentDay.apresMidi.precipitationSum} mm
                      </b>
                    </div>
                    <div className="bg-bna-offwhite p-1.5 rounded-lg">
                      <span className="text-bna-muted block">Vent</span>
                      <b className="text-bna-anthracite font-extrabold">
                        {Math.round(currentDay.apresMidi.windSpeedAvg)} km/h
                      </b>
                    </div>
                    <div className="bg-bna-offwhite p-1.5 rounded-lg">
                      <span className="text-bna-muted block">Rafales</span>
                      <b className="text-purple-700 font-extrabold">
                        {Math.round(currentDay.apresMidi.windGustMax)} km/h
                      </b>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* VUE 2 : HEURE PAR HEURE (24 HEURES DÉTAILLÉES) */}
          {forecastView === "hourly" && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
                  DÉTAIL HEURE PAR HEURE (24H)
                </b>
                <span className="text-[10px] text-bna-muted font-medium">Défilement continu</span>
              </div>

              <div className="bg-white rounded-2xl border border-bna-border divide-y divide-bna-border/40 max-h-80 overflow-y-auto">
                {currentDay.hourly.map((h) => {
                  const hWmo = getWmoInfo(h.weather_code);
                  return (
                    <div
                      key={h.timeLabel}
                      className="p-2.5 px-3 flex items-center justify-between text-xs hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-[70px]">
                        <span className="font-extrabold text-bna-anthracite">{h.timeLabel}</span>
                        <WeatherIcon iconName={hWmo.iconName} className={`w-4 h-4 ${hWmo.colorClass}`} />
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div className="w-14">
                          <span className="font-black text-bna-anthracite">{h.temperature_2m}°C</span>
                        </div>

                        <div className="w-16">
                          {h.precipitation > 0 ? (
                            <span className="text-blue-700 font-bold flex items-center justify-end gap-1">
                              <Droplets className="w-3 h-3" />
                              {h.precipitation} mm
                            </span>
                          ) : (
                            <span className="text-neutral-400 font-medium text-[11px]">0 mm</span>
                          )}
                        </div>

                        <div className="w-20 text-[11px] text-bna-muted font-medium">
                          <span>{Math.round(h.wind_speed_10m)} km/h</span>
                          {h.wind_gusts_10m > 30 && (
                            <span className="text-purple-700 font-bold block text-[10px]">
                              Raf. {Math.round(h.wind_gusts_10m)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* VUE 3 : RÉSUMÉ DE LA SEMAINE (7 JOURS) */}
          {forecastView === "week" && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
                  RÉSUMÉ QUOTIDIEN SUR 7 JOURS
                </b>
                <span className="text-[10px] text-bna-muted font-medium">Semaine complète</span>
              </div>

              <div className="bg-white rounded-2xl border border-bna-border divide-y divide-bna-border/40 overflow-hidden">
                {days.map((day, idx) => {
                  const dWmo = getWmoInfo(day.weather_code);
                  const isToday = idx === 0;
                  return (
                    <div
                      key={day.date}
                      onClick={() => {
                        setSelectedDayIndex(idx);
                        setForecastView("slots");
                      }}
                      className={`p-3 flex items-center justify-between text-xs cursor-pointer hover:bg-neutral-50 transition-colors ${
                        isToday ? "bg-amber-50/40" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-[110px]">
                        <WeatherIcon iconName={dWmo.iconName} className={`w-4 h-4 ${dWmo.colorClass}`} />
                        <div>
                          <span className="font-extrabold text-bna-anthracite block capitalize">
                            {day.dayLabel}
                          </span>
                          <span className="text-[10px] text-bna-muted">{dWmo.label}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <div className="w-16">
                          <span className="font-black text-bna-anthracite block">
                            {day.temperature_2m_max}°
                          </span>
                          <span className="text-[10px] text-bna-muted block">
                            {day.temperature_2m_min}° min
                          </span>
                        </div>

                        <div className="w-14">
                          <span className="font-bold text-blue-700 block">
                            {day.precipitation_sum} mm
                          </span>
                          <span className="text-[10px] text-neutral-500 block">
                            {day.precipitation_probability_max}% p.
                          </span>
                        </div>

                        <ChevronRight className="w-4 h-4 text-neutral-300" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3.5 border-t border-bna-border/60 bg-white flex items-center justify-between text-xs">
          <span className="text-[10px] text-bna-muted">
            Source Open-Meteo · Actualisé en direct
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-bna-copper hover:bg-bna-copper-hover text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
