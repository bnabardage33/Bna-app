"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  HardHat,
  CalendarCheck2,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  ExternalLink,
  X,
  Layers,
  MapPin,
  Building2,
  Percent,
} from "lucide-react";
import {
  NATURES_CONFIG,
  type UnifiedPlanningItem,
} from "@/lib/services/planningService";

export type ViewMode = "semaine" | "mois";

export interface BnaPlanningViewProps {
  items: UnifiedPlanningItem[];
  onSelectItem?: (item: UnifiedPlanningItem) => void;
  onSelectChantier?: (chantierId: string) => void;
  className?: string;
  defaultViewMode?: ViewMode;
}

// ---------------------------------------------------------------------------
// Helpers Dates stricts (sans dépendance externe, fuseau horaire sécurisé)
// ---------------------------------------------------------------------------

function parseYMD(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split("/").map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = (d.getDay() + 6) % 7; // 0 = Lundi, 6 = Dimanche
  d.setDate(d.getDate() - dayOfWeek);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(startOfWeek: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    days.push(d);
  }
  return days;
}

function getMonthDays(currentDate: Date): Date[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const days: Date[] = [];
  for (let i = 1; i <= totalDays; i++) {
    days.push(new Date(year, month, i));
  }
  return days;
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const JOURS_LETTRES = ["L", "M", "M", "J", "V", "S", "D"];
const MOIS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

// ---------------------------------------------------------------------------
// Composant Principal BnaPlanningView
// ---------------------------------------------------------------------------

export const BnaPlanningView: React.FC<BnaPlanningViewProps> = ({
  items,
  onSelectItem,
  onSelectChantier,
  className = "",
  defaultViewMode = "semaine",
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [activeItem, setActiveItem] = useState<UnifiedPlanningItem | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date(), []);

  // Calcul des jours visibles
  const visibleDays = useMemo(() => {
    if (viewMode === "semaine") {
      const startOfWeek = getStartOfWeek(currentDate);
      return getWeekDays(startOfWeek);
    }
    return getMonthDays(currentDate);
  }, [viewMode, currentDate]);

  const rangeStart = visibleDays[0];
  const rangeEnd = visibleDays[visibleDays.length - 1];
  const totalDays = visibleDays.length;

  // Défilement automatique vers aujourd'hui si visible
  const scrollToToday = () => {
    if (!containerRef.current) return;
    const el = containerRef.current.querySelector("[data-today='true']");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  useEffect(() => {
    // Petit délai pour laisser le layout se peindre
    const timer = setTimeout(() => {
      scrollToToday();
    }, 150);
    return () => clearTimeout(timer);
  }, [viewMode, currentDate]);

  // Navigation dans le temps
  const handlePrevious = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "semaine") {
        next.setDate(next.getDate() - 7);
      } else {
        next.setMonth(next.getMonth() - 1);
      }
      return next;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "semaine") {
        next.setDate(next.getDate() + 7);
      } else {
        next.setMonth(next.getMonth() + 1);
      }
      return next;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Libellé de la période actuelle
  const periodLabel = useMemo(() => {
    if (viewMode === "semaine") {
      const weekNum = getISOWeekNumber(rangeStart);
      const startD = rangeStart.getDate();
      const endD = rangeEnd.getDate();
      const monthStart = MOIS_FR[rangeStart.getMonth()].slice(0, 4);
      const monthEnd = MOIS_FR[rangeEnd.getMonth()].slice(0, 4);
      const monthStr =
        rangeStart.getMonth() === rangeEnd.getMonth()
          ? `${monthStart}. ${rangeEnd.getFullYear()}`
          : `${monthStart}. - ${monthEnd}. ${rangeEnd.getFullYear()}`;
      return `Semaine ${weekNum} • ${startD} au ${endD} ${monthStr}`;
    }
    return `${MOIS_FR[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [viewMode, rangeStart, rangeEnd, currentDate]);

  // Catégorisation des éléments dans la plage active
  const { chantiersList, rdvsByDay, livraisonsByDay, counts } = useMemo(() => {
    const msPerDay = 86400000;
    const rStartMs = rangeStart.getTime();
    const rEndDayMs = new Date(
      rangeEnd.getFullYear(),
      rangeEnd.getMonth(),
      rangeEnd.getDate()
    ).getTime();
    const rEndMs = rEndDayMs + msPerDay - 1;

    const chantiers: {
      item: UnifiedPlanningItem;
      startIdx: number;
      endIdx: number;
      continuesBefore: boolean;
      continuesAfter: boolean;
    }[] = [];

    const rdvsMap = new Map<number, UnifiedPlanningItem[]>();
    const livraisonsMap = new Map<number, UnifiedPlanningItem[]>();

    let cCount = 0;
    let rCount = 0;
    let lCount = 0;

    for (const it of items) {
      const dStart = parseYMD(it.dateDebut);
      if (!dStart) continue;
      const dEnd = it.dateFin ? parseYMD(it.dateFin) || dStart : dStart;

      const itemStartMs = dStart.getTime();
      const itemEndMs = dEnd.getTime();

      // Vérifie si l'élément chevauche la plage
      if (itemEndMs < rStartMs || itemStartMs > rEndMs) {
        continue;
      }

      if (it.type === "chantier") {
        cCount++;
        const clampedStartMs = Math.max(rStartMs, itemStartMs);
        const clampedEndMs = Math.min(rEndDayMs, itemEndMs);

        const startIdx = Math.max(
          0,
          Math.min(
            totalDays - 1,
            Math.round((clampedStartMs - rStartMs) / msPerDay)
          )
        );
        const endIdx = Math.max(
          startIdx,
          Math.min(
            totalDays - 1,
            Math.round((clampedEndMs - rStartMs) / msPerDay)
          )
        );

        chantiers.push({
          item: it,
          startIdx,
          endIdx,
          continuesBefore: itemStartMs < rStartMs,
          continuesAfter: itemEndMs > rEndDayMs,
        });
      } else if (it.type === "rdv") {
        rCount++;
        const dayIdx = Math.round((itemStartMs - rStartMs) / msPerDay);
        if (dayIdx >= 0 && dayIdx < totalDays) {
          const arr = rdvsMap.get(dayIdx) || [];
          arr.push(it);
          rdvsMap.set(dayIdx, arr);
        }
      } else {
        // commande ou livraison
        lCount++;
        const dayIdx = Math.round((itemStartMs - rStartMs) / msPerDay);
        if (dayIdx >= 0 && dayIdx < totalDays) {
          const arr = livraisonsMap.get(dayIdx) || [];
          arr.push(it);
          livraisonsMap.set(dayIdx, arr);
        }
      }
    }

    return {
      chantiersList: chantiers,
      rdvsByDay: rdvsMap,
      livraisonsByDay: livraisonsMap,
      counts: { chantiers: cCount, rdvs: rCount, livraisons: lCount },
    };
  }, [items, rangeStart, rangeEnd, totalDays]);

  // Largeur min par colonne selon le mode de vue
  const colMinWidth = viewMode === "semaine" ? "min-w-[84px] sm:min-w-[104px]" : "min-w-[34px] sm:min-w-[38px]";
  const isMonth = viewMode === "mois";

  const handleCardClick = (item: UnifiedPlanningItem) => {
    setActiveItem(item);
    if (onSelectItem) {
      onSelectItem(item);
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* ------------------------------------------------------------------- */}
      {/* 1. BARRE DE CONTRÔLES SUPÉRIEURE : VUE, NAVIGATION & STATS        */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-neutral-900 text-white rounded-2xl p-2.5 sm:p-3 border border-neutral-800 shadow-sm">
        {/* Sélecteur Semaine / Mois */}
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <div className="inline-flex p-0.5 rounded-xl bg-neutral-800 border border-neutral-700/60 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("semaine")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === "semaine"
                  ? "bg-[#D97732] text-white shadow-xs"
                  : "text-neutral-300 hover:text-white"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Semaine</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("mois")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === "mois"
                  ? "bg-[#D97732] text-white shadow-xs"
                  : "text-neutral-300 hover:text-white"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Mois</span>
            </button>
          </div>

          {/* Bouton Aujourd'hui */}
          <button
            type="button"
            onClick={handleToday}
            className="px-2.5 py-1.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-xl transition-all active:scale-95"
            title="Revenir à aujourd'hui"
          >
            Aujourd&apos;hui
          </button>
        </div>

        {/* Navigation Mois / Semaine (< Titre >) */}
        <div className="flex items-center justify-between sm:justify-end gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevious}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-all active:scale-95"
              aria-label="Période précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs sm:text-sm font-bold px-2 tracking-wide text-neutral-100 min-w-[170px] sm:min-w-[200px] text-center">
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-all active:scale-95"
              aria-label="Période suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 2. RÉSUMÉ COMPACT DES VOLUMES SUR LA PÉRIODE VISIBLE              */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-center gap-2 overflow-x-auto text-[11px] px-1 text-bna-muted">
        <span className="font-semibold text-neutral-500 uppercase tracking-wider text-[10px]">
          Sur cette vue :
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-900 font-bold">
          <HardHat className="w-3 h-3 text-[#D97732]" />
          <span>{counts.chantiers} chantiers</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-900 font-bold">
          <CalendarCheck2 className="w-3 h-3 text-blue-600" />
          <span>{counts.rdvs} RDV</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-900 font-bold">
          <Package className="w-3 h-3 text-purple-600" />
          <span>{counts.livraisons} livraisons</span>
        </span>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. GRILLE TEMPORELLE GANTT TACTILE & ERGONOMIQUE MOBILE          */}
      {/* ------------------------------------------------------------------- */}
      <div
        ref={containerRef}
        className="border border-bna-border bg-white rounded-2xl overflow-x-auto snap-x scrollbar-thin relative shadow-xs"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="min-w-max">
          {/* --------------------------------------------------------------- */}
          {/* LIGNE D'EN-TÊTE : DATES & JOURS DE LA SEMAINE / DU MOIS          */}
          {/* --------------------------------------------------------------- */}
          <div className="flex border-b border-bna-border/80 sticky top-0 bg-white/95 backdrop-blur-xs z-30">
            {/* Colonne sticky gauche : Libellé catégorie */}
            <div className="w-28 sm:w-36 shrink-0 sticky left-0 z-40 bg-white border-r border-bna-border/80 px-2.5 py-2 flex items-center justify-between text-[11px] font-bold text-neutral-500 uppercase tracking-wider shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
              <span>Lignes</span>
              <Layers className="w-3.5 h-3.5 text-neutral-400" />
            </div>

            {/* Colonnes des jours */}
            <div
              className="grid flex-1"
              style={{
                gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))`,
              }}
            >
              {visibleDays.map((d, idx) => {
                const isCurrentToday = isSameDay(d, today);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const dayIndexInWeek = (d.getDay() + 6) % 7;

                return (
                  <div
                    key={idx}
                    data-today={isCurrentToday ? "true" : undefined}
                    className={`flex flex-col items-center justify-center py-2 px-1 border-r border-bna-border/40 text-center transition-colors ${colMinWidth} ${
                      isWeekend ? "bg-neutral-50/70" : "bg-white"
                    } ${isCurrentToday ? "bg-orange-50/50" : ""}`}
                  >
                    <span
                      className={`text-[10px] uppercase font-bold tracking-tight ${
                        isCurrentToday ? "text-[#D97732]" : "text-neutral-400"
                      }`}
                    >
                      {isMonth
                        ? JOURS_LETTRES[dayIndexInWeek]
                        : JOURS_COURTS[dayIndexInWeek]}
                    </span>
                    <span
                      className={`text-xs font-extrabold mt-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        isCurrentToday
                          ? "bg-[#D97732] text-white shadow-xs scale-105"
                          : isWeekend
                          ? "text-neutral-500"
                          : "text-bna-anthracite"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* SWIMLANE 1 : CHANTIERS (BARRES PLEINES AVEC AVANCEMENT)          */}
          {/* --------------------------------------------------------------- */}
          <div className="flex border-b border-bna-border/70 group/row hover:bg-neutral-50/30 transition-colors">
            {/* Cellule sticky gauche */}
            <div className="w-28 sm:w-36 shrink-0 sticky left-0 z-20 bg-white/95 group-hover/row:bg-neutral-50/95 backdrop-blur-xs border-r border-bna-border/80 px-2.5 py-3 flex flex-col justify-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-lg bg-orange-100 text-[#D97732]">
                  <HardHat className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-bna-anthracite leading-tight">
                  Chantiers
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 font-medium mt-1">
                {counts.chantiers} actif(s)
              </span>
            </div>

            {/* Contenu de la Timeline Chantiers */}
            <div className="flex-1 relative py-2.5 px-0 min-h-[64px] flex flex-col justify-center">
              {/* Lignes verticales d'arrière-plan */}
              <div
                className="absolute inset-0 grid pointer-events-none"
                style={{
                  gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))`,
                }}
              >
                {visibleDays.map((d, i) => (
                  <div
                    key={i}
                    className={`border-r border-bna-border/30 h-full ${
                      isSameDay(d, today) ? "bg-orange-50/20" : ""
                    }`}
                  />
                ))}
              </div>

              {chantiersList.length === 0 ? (
                <div className="relative z-10 px-4 py-2 text-center text-xs text-neutral-400 italic">
                  Aucun chantier planifié sur cette période
                </div>
              ) : (
                <div
                  className="relative z-10 grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))`,
                  }}
                >
                  {chantiersList.map((ch, idx) => {
                    const avancementPct = ch.item.avancement ?? 0;
                    return (
                      <div
                        key={ch.item.id}
                        onClick={() => handleCardClick(ch.item)}
                        style={{
                          gridColumnStart: ch.startIdx + 1,
                          gridColumnEnd: ch.endIdx + 2,
                          gridRowStart: idx + 1,
                        }}
                        className="h-8 sm:h-9 bg-neutral-900 border border-neutral-700 rounded-xl relative overflow-hidden cursor-pointer hover:border-[#D97732] hover:shadow-md transition-all active:scale-[0.99] group/bar mx-1"
                        title={`${ch.item.titre} (${avancementPct}%)`}
                      >
                        {/* Remplissage de l'avancement BNA Copper */}
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#D97732] to-[#EA580C] opacity-90 group-hover/bar:opacity-100 transition-all"
                          style={{ width: `${avancementPct}%` }}
                        />

                        {/* Contenu de la barre : Libellé + Badge % */}
                        <div className="relative z-10 h-full flex items-center justify-between px-2 gap-1.5 text-white text-xs select-none">
                          <div className="flex items-center gap-1 min-w-0">
                            {ch.continuesBefore && (
                              <span className="text-[10px] text-orange-200 font-bold shrink-0">
                                ‹
                              </span>
                            )}
                            <span className="font-bold truncate text-[11px] sm:text-xs">
                              {ch.item.titre}
                            </span>
                            {ch.continuesAfter && (
                              <span className="text-[10px] text-orange-200 font-bold shrink-0">
                                ›
                              </span>
                            )}
                          </div>

                          <span className="shrink-0 text-[10px] font-extrabold bg-black/40 px-1.5 py-0.5 rounded-md border border-white/10 backdrop-blur-xs">
                            {avancementPct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* SWIMLANE 2 : RDV & VISITES (CARTES / PASTILLES HORODATÉES)       */}
          {/* --------------------------------------------------------------- */}
          <div className="flex border-b border-bna-border/70 group/row hover:bg-neutral-50/30 transition-colors">
            {/* Cellule sticky gauche */}
            <div className="w-28 sm:w-36 shrink-0 sticky left-0 z-20 bg-white/95 group-hover/row:bg-neutral-50/95 backdrop-blur-xs border-r border-bna-border/80 px-2.5 py-3 flex flex-col justify-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-lg bg-blue-100 text-blue-700">
                  <CalendarCheck2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-bna-anthracite leading-tight">
                  RDV &amp; Visites
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 font-medium mt-1">
                {counts.rdvs} planifié(s)
              </span>
            </div>

            {/* Contenu de la Timeline RDVs */}
            <div
              className="flex-1 grid py-2 min-h-[64px]"
              style={{
                gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))`,
              }}
            >
              {visibleDays.map((d, colIdx) => {
                const rdvs = rdvsByDay.get(colIdx) || [];
                const isCurrentToday = isSameDay(d, today);

                return (
                  <div
                    key={colIdx}
                    className={`border-r border-bna-border/30 px-1 flex flex-col gap-1.5 ${
                      isCurrentToday ? "bg-orange-50/20" : ""
                    }`}
                  >
                    {rdvs.map((r) => {
                      const natureCfg = NATURES_CONFIG[r.natureKey];

                      if (isMonth) {
                        // Vue Mois : Pastille compacte cliquable
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => handleCardClick(r)}
                            className="w-full h-7 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-900 flex items-center justify-center transition-all active:scale-95 shadow-2xs group/dot"
                            title={`${r.titre} (${r.heure || "Horaires à définir"})`}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: r.dotColor }}
                            />
                          </button>
                        );
                      }

                      // Vue Semaine : Carte détaillée tactile
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleCardClick(r)}
                          className="w-full text-left p-1.5 rounded-xl border border-bna-border/80 bg-white hover:border-[#D97732] hover:shadow-xs transition-all active:scale-95 group/rdv shadow-2xs"
                        >
                          <div className="flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: r.dotColor }}
                            />
                            {r.heure ? (
                              <span className="text-[10px] font-bold text-[#D97732] truncate">
                                {r.heure}
                              </span>
                            ) : (
                              <span className="text-[9px] text-neutral-400">RDV</span>
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-bna-anthracite truncate mt-0.5 group-hover/rdv:text-[#D97732]">
                            {r.titre}
                          </p>
                          <span
                            className={`text-[8px] font-bold px-1 py-0.2 rounded-md border mt-0.5 inline-block truncate max-w-full ${r.badgeColorClass}`}
                          >
                            {natureCfg?.label || r.natureKey}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* SWIMLANE 3 : COMMANDES & LIVRAISONS                             */}
          {/* --------------------------------------------------------------- */}
          <div className="flex group/row hover:bg-neutral-50/30 transition-colors">
            {/* Cellule sticky gauche */}
            <div className="w-28 sm:w-36 shrink-0 sticky left-0 z-20 bg-white/95 group-hover/row:bg-neutral-50/95 backdrop-blur-xs border-r border-bna-border/80 px-2.5 py-3 flex flex-col justify-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-lg bg-purple-100 text-purple-700">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-bna-anthracite leading-tight">
                  Livraisons
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 font-medium mt-1">
                {counts.livraisons} attendue(s)
              </span>
            </div>

            {/* Contenu de la Timeline Livraisons */}
            <div
              className="flex-1 grid py-2 min-h-[64px]"
              style={{
                gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))`,
              }}
            >
              {visibleDays.map((d, colIdx) => {
                const livraisons = livraisonsByDay.get(colIdx) || [];
                const isCurrentToday = isSameDay(d, today);

                return (
                  <div
                    key={colIdx}
                    className={`border-r border-bna-border/30 px-1 flex flex-col gap-1.5 ${
                      isCurrentToday ? "bg-orange-50/20" : ""
                    }`}
                  >
                    {livraisons.map((l) => {
                      if (isMonth) {
                        // Vue Mois : Pastille violette compacte
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => handleCardClick(l)}
                            className="w-full h-7 rounded-lg border border-purple-300 bg-purple-50/90 hover:bg-purple-100 text-purple-800 flex items-center justify-center transition-all active:scale-95 shadow-2xs"
                            title={`${l.titre} (${l.fournisseurNom || "Fournisseur"})`}
                          >
                            <Package className="w-3.5 h-3.5" />
                          </button>
                        );
                      }

                      // Vue Semaine : Carte livraison
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => handleCardClick(l)}
                          className="w-full text-left p-1.5 rounded-xl border border-purple-200 bg-purple-50/80 hover:bg-purple-100/90 hover:border-purple-300 transition-all active:scale-95 group/liv shadow-2xs"
                        >
                          <div className="flex items-center gap-1 text-purple-700">
                            <Package className="w-3 h-3 shrink-0" />
                            <span className="text-[9px] font-bold uppercase tracking-tight truncate">
                              {l.statutLabel || "Colis"}
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-purple-950 truncate mt-0.5">
                            {l.fournisseurNom || l.titre}
                          </p>
                          {l.chantierNom && (
                            <p className="text-[9px] text-purple-600 truncate mt-0.5">
                              {l.chantierNom}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 4. MODAL DE DÉTAIL D'UN ÉLÉMENT (INTERACTIF AU CLIC)               */}
      {/* ------------------------------------------------------------------- */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-bna-border rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4">
            {/* Header modal */}
            <div className="flex items-start justify-between gap-3 border-b border-bna-border/80 pb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: activeItem.dotColor }}
                />
                <div>
                  <h3 className="text-sm font-bold text-bna-anthracite leading-tight">
                    {activeItem.titre}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 inline-block ${activeItem.badgeColorClass}`}
                  >
                    {NATURES_CONFIG[activeItem.natureKey]?.label || activeItem.natureKey}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-bna-anthracite hover:bg-neutral-100 transition-colors"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Infos clés */}
            <div className="space-y-2.5 text-xs">
              {activeItem.sousTitre && (
                <div className="flex items-start gap-2 text-neutral-600">
                  <Building2 className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <span>{activeItem.sousTitre}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-neutral-600">
                <Clock className="w-4 h-4 text-[#D97732] shrink-0" />
                <span>
                  Date : <b>{activeItem.dateDebut}</b>
                  {activeItem.dateFin && activeItem.dateFin !== activeItem.dateDebut && (
                    <> au <b>{activeItem.dateFin}</b></>
                  )}
                  {activeItem.heure && <> • à <b>{activeItem.heure}</b></>}
                </span>
              </div>

              {activeItem.avancement !== undefined && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-neutral-700 font-semibold">
                    <span>Avancement du chantier</span>
                    <span className="font-bold text-[#D97732]">{activeItem.avancement}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden border border-neutral-200">
                    <div
                      className="h-full bg-gradient-to-r from-[#D97732] to-[#EA580C]"
                      style={{ width: `${activeItem.avancement}%` }}
                    />
                  </div>
                </div>
              )}

              {activeItem.nature && (
                <div className="p-2.5 rounded-xl bg-bna-offwhite border border-bna-border text-neutral-700">
                  <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                    Détails &amp; Consignes
                  </p>
                  <p className="text-xs leading-relaxed">{activeItem.nature}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-bna-border/80">
              {activeItem.chantierId && onSelectChantier && (
                <button
                  type="button"
                  onClick={() => {
                    const cid = activeItem.chantierId;
                    setActiveItem(null);
                    if (cid) onSelectChantier(cid);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#D97732] hover:bg-[#c26526] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ouvrir le chantier</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-bna-anthracite text-xs font-semibold transition-all active:scale-95"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
