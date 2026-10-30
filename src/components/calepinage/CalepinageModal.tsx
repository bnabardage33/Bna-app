"use client";

import React, { useState, useEffect } from "react";
import { X, Calculator, CheckCircle2, History, ChevronDown, AlertCircle } from "lucide-react";
import {
  calculerCalepinageTerrasse,
  CalepinageParams,
  CalepinageResult,
  SensPoseLames,
  TypeFixationCalepinage,
} from "@/lib/calepinage";
import { MetierType, METIERS_CONFIG } from "@/types/metier";
import { isValidDecimalInput, parseDecimal } from "@/lib/decimalInput";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { saveCalepinageTerrasse, getLatestCalepinageTerrasse } from "@/lib/services/calepinageService";
import { getChantiers } from "@/lib/services/chantierService";
import type { Chantier } from "@/types/metier";

interface CalepinageModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMetier?: MetierType;
  chantierId?: string;
  onCalepinageSaved?: () => void;
}

const Section: React.FC<{
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-bna-border rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-bna-offwhite text-xs font-bold text-bna-anthracite"
        aria-expanded={open}
      >
        <span>{title}</span>
        <ChevronDown className={`w-4 h-4 text-bna-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="p-3 space-y-3 bg-white">{children}</div>}
    </div>
  );
};

const labelCls = "text-[11px] font-semibold text-bna-muted uppercase block";
const inputCls =
  "w-full mt-1 px-3 py-2 border border-bna-border rounded-xl text-sm font-semibold text-bna-anthracite focus:outline-hidden focus:border-bna-copper";
const selectCls =
  "w-full mt-1 px-3 py-2 border border-bna-border rounded-xl text-xs font-semibold text-bna-anthracite bg-white focus:outline-hidden focus:border-bna-copper";

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-2 text-xs">
    <span className="text-bna-muted">{label}</span>
    <span className="font-bold text-bna-anthracite text-right">{value}</span>
  </div>
);

function numOrNaN(s: string): number {
  const v = parseDecimal(s);
  return v === null ? NaN : v;
}

function optionalInt(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  return numOrNaN(s);
}

export const CalepinageModal: React.FC<CalepinageModalProps> = ({
  isOpen,
  onClose,
  defaultMetier = "terrasse",
  chantierId: chantierIdProp,
  onCalepinageSaved,
}) => {
  const { entreprise } = useAuth();
  const [selectedMetier, setSelectedMetier] = useState<MetierType>(defaultMetier);

  // Terrasse
  const [longueurInput, setLongueurInput] = useState("6");
  const [largeurInput, setLargeurInput] = useState("4");
  const [sens, setSens] = useState<SensPoseLames>("longueur");

  // Lames
  const [largeurLame, setLargeurLame] = useState(145);
  const [longueurLame, setLongueurLame] = useState(3.0);
  const [jeuInput, setJeuInput] = useState("5");
  const [marge, setMarge] = useState(10);
  const [margeInput, setMargeInput] = useState("10");

  // Structure
  const [entraxeLambInput, setEntraxeLambInput] = useState("40");
  const [lambChoix, setLambChoix] = useState<"3" | "4" | "autre">("3");
  const [lambCustomInput, setLambCustomInput] = useState("");
  const [margeLambInput, setMargeLambInput] = useState("8");
  const [entraxePlotsInput, setEntraxePlotsInput] = useState("50");

  // Fixations
  const [typeFixation, setTypeFixation] = useState<TypeFixationCalepinage>("vis");
  const [margeFixInput, setMargeFixInput] = useState("5");
  const [boiteVisInput, setBoiteVisInput] = useState("");
  const [boiteClipsInput, setBoiteClipsInput] = useState("");
  const [boiteClipsDFInput, setBoiteClipsDFInput] = useState("");
  const [clipsDepartFin, setClipsDepartFin] = useState(false);

  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const supabase = createClient();

  // Sélection du chantier quand le modal est ouvert hors contexte chantier
  const [chantiersTerrasse, setChantiersTerrasse] = useState<Chantier[]>([]);
  const [selectedChantierId, setSelectedChantierId] = useState("");
  const chantierId = chantierIdProp || selectedChantierId || undefined;

  useEffect(() => {
    if (!isOpen || chantierIdProp) return;
    getChantiers(supabase, { fallbackToMocks: false })
      .then((list) => setChantiersTerrasse(list.filter((c) => c.metier === "terrasse")))
      .catch(() => setChantiersTerrasse([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chantierIdProp]);

  useEffect(() => {
    async function loadSavedCalepinage() {
      if (!chantierId) return;
      const saved = await getLatestCalepinageTerrasse(supabase, chantierId);
      if (!saved || !saved.details) {
        setCurrentVersion(0);
        return;
      }
      setCurrentVersion(saved.calepinage.version);
      const p = (saved.details.parametres || null) as Partial<CalepinageParams> | null;
      const d = saved.details;
      setLongueurInput(String(p?.longueur_m ?? d.longueur_m));
      setLargeurInput(String(p?.largeur_m ?? d.largeur_m));
      setLargeurLame(p?.largeur_lame_mm ?? d.largeur_lame_mm);
      setLongueurLame(p?.longueur_lame_m ?? d.longueur_lame_m);
      setMarge(p?.marge_chutes_pct ?? d.marge_chutes_pct);
      setMargeInput(String(p?.marge_chutes_pct ?? d.marge_chutes_pct));
      setTypeFixation((p?.type_fixation ?? d.type_fixation) as TypeFixationCalepinage);
      setSens(((p?.sens_pose_lames ?? d.orientation_lames) === "largeur" ? "largeur" : "longueur") as SensPoseLames);
      setJeuInput(String(p?.espace_inter_lames_mm ?? d.espace_inter_lames_mm));
      setEntraxeLambInput(String(p?.entraxe_lambourdes_cm ?? d.entraxe_lambourdes_cm));
      setEntraxePlotsInput(String(p?.entraxe_plots_cm ?? d.entraxe_plots_cm));
      if (p) {
        const lc = p.longueur_lambourde_commerciale_m;
        if (lc === 3) setLambChoix("3");
        else if (lc === 4) setLambChoix("4");
        else if (lc) {
          setLambChoix("autre");
          setLambCustomInput(String(lc));
        }
        if (p.marge_lambourdes_pct !== undefined) setMargeLambInput(String(p.marge_lambourdes_pct));
        if (p.marge_fixations_pct !== undefined) setMargeFixInput(String(p.marge_fixations_pct));
        setBoiteVisInput(p.taille_boite_vis ? String(p.taille_boite_vis) : "");
        setBoiteClipsInput(p.taille_boite_clips ? String(p.taille_boite_clips) : "");
        setBoiteClipsDFInput(p.taille_boite_clips_depart_fin ? String(p.taille_boite_clips_depart_fin) : "");
        setClipsDepartFin(!!p.utiliser_clips_depart_fin);
      }
    }
    if (isOpen) loadSavedCalepinage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chantierId]);

  if (!isOpen) return null;

  const calcParams: CalepinageParams = {
    longueur_m: numOrNaN(longueurInput),
    largeur_m: numOrNaN(largeurInput),
    sens_pose_lames: sens,
    disposition_joints: "alignes",
    largeur_lame_mm: largeurLame,
    longueur_lame_m: longueurLame,
    espace_inter_lames_mm: numOrNaN(jeuInput),
    marge_chutes_pct: marge,
    entraxe_lambourdes_cm: numOrNaN(entraxeLambInput),
    longueur_lambourde_commerciale_m: lambChoix === "autre" ? numOrNaN(lambCustomInput) : Number(lambChoix),
    marge_lambourdes_pct: numOrNaN(margeLambInput),
    entraxe_plots_cm: numOrNaN(entraxePlotsInput),
    type_fixation: typeFixation,
    marge_fixations_pct: numOrNaN(margeFixInput),
    taille_boite_vis: optionalInt(boiteVisInput),
    taille_boite_clips: optionalInt(boiteClipsInput),
    taille_boite_clips_depart_fin: optionalInt(boiteClipsDFInput),
    utiliser_clips_depart_fin: typeFixation === "clips" ? clipsDepartFin : false,
  };

  let result: CalepinageResult | null = null;
  let calcError: string | null = null;
  try {
    result = calculerCalepinageTerrasse(calcParams);
  } catch (e) {
    calcError = (e as Error).message;
  }

  const handleMargeSlider = (val: number) => {
    setMarge(val);
    setMargeInput(String(val));
  };

  const handleMargeInput = (val: string) => {
    if (isValidDecimalInput(val)) {
      setMargeInput(val);
      const parsed = parseDecimal(val);
      if (parsed !== null && parsed >= 0 && parsed <= 50) setMarge(Math.round(parsed));
    }
  };

  const canSave = !!result && !!chantierId && !!entreprise?.id && !isSaving;

  const handleSave = async () => {
    if (!result || !chantierId || !entreprise?.id) return;
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveError(null);
    try {
      const saved = await saveCalepinageTerrasse(supabase, {
        entrepriseId: entreprise.id,
        chantierId,
        calcParams,
      });
      setCurrentVersion(saved.calepinage.version);
      setSaveSuccessMsg(
        `Quantitatif V${saved.calepinage.version} enregistré — ${saved.besoins.length} besoins matériaux générés.`
      );
      if (onCalepinageSaved) onCalepinageSaved();
      setTimeout(() => {
        setSaveSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (e) {
      setSaveError((e as { message?: string })?.message || "Enregistrement impossible. Aucune version n'a été créée.");
    } finally {
      setIsSaving(false);
    }
  };

  const pos = (arr: number[]) => arr.map((v) => v.toFixed(2).replace(".", ",")).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-mobile bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl border border-bna-border animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-bna-border/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-50 text-bna-copper">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-display font-bold text-base text-bna-anthracite">Quantitatif Terrasse</h3>
                {currentVersion > 0 && (
                  <span className="text-[10px] font-bold text-bna-copper bg-bna-copper-light/60 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <History className="w-2.5 h-2.5" />V{currentVersion}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-bna-muted">Estimation technique indicative</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100 text-bna-muted" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-1 bg-bna-offwhite rounded-xl border border-bna-border mt-3 text-xs font-semibold">
          {(["terrasse", "facade", "cloture"] as MetierType[]).map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMetier(m)}
              className={`py-2 px-1 rounded-lg text-center transition-all ${
                selectedMetier === m
                  ? "bg-white text-bna-anthracite shadow-xs border border-bna-border"
                  : "text-bna-muted hover:text-bna-anthracite"
              }`}
            >
              {METIERS_CONFIG[m].label.split(" / ")[0]}
            </button>
          ))}
        </div>

        {selectedMetier === "terrasse" && (
          <div className="mt-4 space-y-2.5 animate-in fade-in duration-100">
            <Section title="1. Terrasse" defaultOpen>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Longueur (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="ex: 6 ou 6,5"
                    value={longueurInput}
                    onChange={(e) => isValidDecimalInput(e.target.value) && setLongueurInput(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Largeur (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="ex: 4 ou 3,8"
                    value={largeurInput}
                    onChange={(e) => isValidDecimalInput(e.target.value) && setLargeurInput(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Sens des lames</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(["longueur", "largeur"] as SensPoseLames[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSens(s)}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium capitalize ${
                        sens === s
                          ? "bg-orange-50 border-bna-copper text-bna-copper font-bold"
                          : "bg-white border-bna-border text-bna-muted"
                      }`}
                    >
                      Dans la {s}
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="2. Lames">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Lame larg. (mm)</label>
                  <select value={largeurLame} onChange={(e) => setLargeurLame(parseInt(e.target.value))} className={selectCls}>
                    <option value={120}>120 mm</option>
                    <option value={140}>140 mm</option>
                    <option value={145}>145 mm</option>
                    <option value={190}>190 mm</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Lame long. (m)</label>
                  <select value={longueurLame} onChange={(e) => setLongueurLame(parseFloat(e.target.value))} className={selectCls}>
                    <option value={2.4}>2,40 m</option>
                    <option value={3.0}>3,00 m</option>
                    <option value={4.0}>4,00 m</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Jeu entre lames (mm)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={jeuInput}
                  onChange={(e) => isValidDecimalInput(e.target.value) && setJeuInput(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Disposition des joints</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    className="py-2 px-3 rounded-xl border text-xs font-bold bg-orange-50 border-bna-copper text-bna-copper"
                  >
                    Alignés
                  </button>
                  <button
                    type="button"
                    disabled
                    className="py-2 px-3 rounded-xl border text-xs font-medium bg-neutral-50 border-bna-border text-bna-muted cursor-not-allowed"
                  >
                    Quinconce — à venir
                  </button>
                </div>
              </div>
              <div className="p-3 bg-bna-offwhite rounded-xl border border-bna-border">
                <div className="flex justify-between items-center mb-1.5">
                  <label className={labelCls}>Marge de chutes lames</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={margeInput}
                      onChange={(e) => handleMargeInput(e.target.value)}
                      className="w-12 text-center py-0.5 px-1 bg-white border border-bna-border rounded-lg text-xs font-bold text-bna-anthracite focus:outline-hidden focus:border-bna-copper"
                    />
                    <span className="text-xs font-bold text-bna-muted">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="3"
                  max="25"
                  value={marge}
                  onChange={(e) => handleMargeSlider(parseInt(e.target.value))}
                  className="w-full accent-[#D97732] cursor-pointer"
                />
              </div>
            </Section>

            <Section title="3. Structure">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Entraxe lambourdes (cm)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={entraxeLambInput}
                    onChange={(e) => isValidDecimalInput(e.target.value) && setEntraxeLambInput(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Entraxe plots (cm)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={entraxePlotsInput}
                    onChange={(e) => isValidDecimalInput(e.target.value) && setEntraxePlotsInput(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Longueur commerciale lambourdes</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(["3", "4", "autre"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setLambChoix(c)}
                      className={`py-2 px-2 rounded-xl border text-xs font-medium ${
                        lambChoix === c
                          ? "bg-orange-50 border-bna-copper text-bna-copper font-bold"
                          : "bg-white border-bna-border text-bna-muted"
                      }`}
                    >
                      {c === "autre" ? "Autre" : `${c},00 m`}
                    </button>
                  ))}
                </div>
                {lambChoix === "autre" && (
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Longueur en m"
                    value={lambCustomInput}
                    onChange={(e) => isValidDecimalInput(e.target.value) && setLambCustomInput(e.target.value)}
                    className={inputCls}
                  />
                )}
              </div>
              <div>
                <label className={labelCls}>Marge lambourdes (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={margeLambInput}
                  onChange={(e) => isValidDecimalInput(e.target.value) && setMargeLambInput(e.target.value)}
                  className={inputCls}
                />
                <p className="text-[10px] text-bna-muted mt-1">Valeur de départ modifiable, non universelle.</p>
              </div>
            </Section>

            <Section title="4. Fixations">
              <div className="grid grid-cols-2 gap-2">
                {(["vis", "clips"] as TypeFixationCalepinage[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFixation(t)}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium ${
                      typeFixation === t
                        ? "bg-orange-50 border-bna-copper text-bna-copper font-bold"
                        : "bg-white border-bna-border text-bna-muted"
                    }`}
                  >
                    {t === "vis" ? "Vis" : "Clips"}
                  </button>
                ))}
              </div>
              <div>
                <label className={labelCls}>Marge fixations (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={margeFixInput}
                  onChange={(e) => isValidDecimalInput(e.target.value) && setMargeFixInput(e.target.value)}
                  className={inputCls}
                />
              </div>
              {typeFixation === "vis" ? (
                <div>
                  <label className={labelCls}>Vis par boîte (optionnel)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Non renseigné = pas d'arrondi"
                    value={boiteVisInput}
                    onChange={(e) => /^\d*$/.test(e.target.value) && setBoiteVisInput(e.target.value)}
                    className={inputCls}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>Clips par boîte (optionnel)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Non renseigné = pas d'arrondi"
                      value={boiteClipsInput}
                      onChange={(e) => /^\d*$/.test(e.target.value) && setBoiteClipsInput(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-bna-anthracite">
                    <input
                      type="checkbox"
                      checked={clipsDepartFin}
                      onChange={(e) => setClipsDepartFin(e.target.checked)}
                    />
                    Utiliser des clips de départ / fin
                  </label>
                  {clipsDepartFin && (
                    <div>
                      <label className={labelCls}>Clips départ/fin par boîte (optionnel)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Non renseigné = pas d'arrondi"
                        value={boiteClipsDFInput}
                        onChange={(e) => /^\d*$/.test(e.target.value) && setBoiteClipsDFInput(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  )}
                </>
              )}
            </Section>

            <Section title="5. Résultats" defaultOpen>
              {calcError && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                  <span>{calcError}</span>
                </div>
              )}
              {result && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-bna-copper uppercase">Platelage</span>
                    <Row label="Surface" value={`${result.surface_nette_m2} m²`} />
                    <Row label="Rangées" value={result.platelage.nb_rangees} />
                    <Row label="Linéaire brut" value={`${result.platelage.ml_lames_brut} ml`} />
                    <Row label="Linéaire avec marge" value={`${result.platelage.ml_lames_avec_marge} ml`} />
                    <Row label="Lames commandées" value={`${result.platelage.nb_lames_commandees} (${longueurLame} m)`} />
                    <Row label="Aboutages / rangée" value={result.platelage.nb_aboutages_interieurs_par_rangee} />
                    <Row
                      label="Positions des joints (m)"
                      value={result.platelage.positions_aboutages_m.length ? pos(result.platelage.positions_aboutages_m) : "aucun"}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-bna-copper uppercase">Structure</span>
                    <Row label="Lignes de base" value={result.structure.nb_lignes_lambourdes_base} />
                    <Row label="Appuis ajoutés aux aboutages" value={result.structure.nb_appuis_aboutage_ajoutes} />
                    <Row label="Total lignes" value={result.structure.nb_lignes_lambourdes_total} />
                    <Row label="Linéaire lambourdes" value={`${result.structure.ml_lambourdes_avec_marge} ml`} />
                    <Row
                      label={`Barres de ${result.structure.longueur_commerciale_lambourde_m} m`}
                      value={result.structure.nb_barres_lambourdes}
                    />
                    <Row label="Entraxe max réel" value={`${result.structure.entraxe_max_reel_cm} cm`} />
                    <p className="text-[10px] text-bna-muted break-words">
                      Positions (m) : {pos(result.structure.positions_lambourdes_m)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-bna-copper uppercase">Supports</span>
                    <Row label="Plots de base" value={result.supports.plots_lignes_base} />
                    <Row label="Plots d'aboutage" value={result.supports.plots_appuis_aboutage} />
                    <Row label="Total plots" value={result.supports.nb_plots_total} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-bna-copper uppercase">Fixations</span>
                    {result.type_fixation === "vis" ? (
                      <>
                        <Row label="Vis courantes" value={result.fixations.nb_vis_courantes} />
                        <Row label="Vis d'aboutage" value={result.fixations.nb_vis_aboutages} />
                        <Row label="Total brut" value={result.fixations.nb_vis_brut} />
                        <Row label="Avec marge" value={result.fixations.nb_vis_avec_marge} />
                        <Row
                          label="Boîtes"
                          value={result.fixations.nb_boites_vis ?? "conditionnement non renseigné"}
                        />
                        <Row label="Quantité conditionnée" value={result.fixations.nb_vis_conditionnees} />
                      </>
                    ) : (
                      <>
                        <Row label="Clips courants" value={result.fixations.nb_clips_courants} />
                        <Row label="Clips d'aboutage" value={result.fixations.nb_clips_aboutages} />
                        {result.fixations.nb_clips_depart_fin > 0 && (
                          <Row label="Clips départ / fin" value={result.fixations.nb_clips_depart_fin} />
                        )}
                        <Row label="Total (avec marge)" value={result.fixations.nb_clips_total} />
                        <Row
                          label="Boîtes clips"
                          value={result.fixations.nb_boites_clips ?? "conditionnement non renseigné"}
                        />
                        {result.fixations.nb_clips_depart_fin > 0 && (
                          <Row
                            label="Boîtes départ/fin"
                            value={result.fixations.nb_boites_clips_depart_fin ?? "conditionnement non renseigné"}
                          />
                        )}
                        <Row label="Quantité conditionnée" value={result.fixations.nb_clips_conditionnes} />
                      </>
                    )}
                  </div>
                  {result.avertissements.length > 0 && (
                    <ul className="text-[10px] text-bna-muted list-disc pl-4 space-y-0.5">
                      {result.avertissements.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    Quantitatif indicatif à vérifier selon le produit, le support et les prescriptions du fabricant.
                  </p>
                </div>
              )}
            </Section>
          </div>
        )}

        {selectedMetier === "facade" && (
          <div className="mt-4 p-4 bg-bna-offwhite rounded-2xl border border-bna-border text-center space-y-2 animate-in fade-in duration-100">
            <span className="text-xs font-bold text-bna-anthracite block">Moteur Métier Façade / Bardage</span>
            <p className="text-[11px] text-bna-muted leading-relaxed">
              Parcours dédié : Dimensions façade, déduction ouvertures, orientation de pose, ossature bois/métal, profils de départ et fixations.
            </p>
            <span className="inline-block text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
              Module à venir
            </span>
          </div>
        )}

        {selectedMetier === "cloture" && (
          <div className="mt-4 p-4 bg-bna-offwhite rounded-2xl border border-bna-border text-center space-y-2 animate-in fade-in duration-100">
            <span className="text-xs font-bold text-bna-anthracite block">Moteur Métier Clôture</span>
            <p className="text-[11px] text-bna-muted leading-relaxed">
              Parcours dédié : Linéaire total, entraxe poteaux, calcul des travées, platines/scellements, lames d&apos;occultation et chapeaux.
            </p>
            <span className="inline-block text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              Module à venir
            </span>
          </div>
        )}

        {selectedMetier === "terrasse" && !chantierIdProp && (
          <div className="mt-3">
            <label className={labelCls}>Chantier terrasse (pour enregistrer)</label>
            <select
              value={selectedChantierId}
              onChange={(e) => setSelectedChantierId(e.target.value)}
              className={selectCls}
            >
              <option value="">— Choisir un chantier —</option>
              {chantiersTerrasse.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
        )}

        {saveSuccessMsg && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
        {saveError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{saveError}</span>
          </div>
        )}

        {selectedMetier === "terrasse" && (
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full mt-4 min-h-[44px] text-white font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] ${
              !canSave ? "bg-neutral-300 cursor-not-allowed" : "bg-bna-copper hover:bg-bna-copper-hover shadow-copper"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isSaving
                ? `Enregistrement V${currentVersion + 1}...`
                : `Valider ce quantitatif (créer V${currentVersion + 1} & besoins)`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
