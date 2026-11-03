"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Camera,
  Image as ImageIcon,
  Upload,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Plus,
  Eye,
  Trash2,
  MapPin,
  Tag,
  Maximize2,
  Calendar,
  ChevronDown,
} from "lucide-react";
import type { Chantier } from "@/types/metier";

export type PhotoType = "constat" | "pointage";

export interface PhotoChantier {
  id: string;
  chantierId: string;
  type: PhotoType;
  titre: string;
  description?: string;
  localisation?: string;
  date: string; // YYYY-MM-DD
  heure: string; // HH:mm
  url: string; // Data URL base64 ou URL d'image
  thumbnailGradient?: string;
  isCustom?: boolean;
}

interface PhotoConstatModalProps {
  isOpen: boolean;
  onClose: () => void;
  chantier: Chantier;
  chantiers?: Chantier[];
  onSelectChantier?: (id: string) => void;
  onPhotoAdded?: () => void;
}

// ---------------------------------------------------------------------------
// Photos initiales réalistes selon le métier du chantier
// ---------------------------------------------------------------------------
function getSeedPhotosForChantier(chantier: Chantier): PhotoChantier[] {
  const isFacade = chantier.metier === "facade";
  const isTerrasse = chantier.metier === "terrasse";

  if (isTerrasse) {
    return [
      {
        id: `seed-${chantier.id}-1`,
        chantierId: chantier.id,
        type: "pointage",
        titre: "Structure lambourdes & plots réglables",
        description: "Contrôle d'entraxe (400 mm) et calage de niveau validés sur l'ensemble de la plateforme.",
        localisation: "Zone centrale",
        date: "2026-11-02",
        heure: "10:45",
        url: "",
        thumbnailGradient: "from-amber-700 via-orange-800 to-amber-950",
      },
      {
        id: `seed-${chantier.id}-2`,
        chantierId: chantier.id,
        type: "constat",
        titre: "Évacuation eaux pluviales à proximité",
        description: "Regard d'évacuation à contourner avec trappe de visite amovible pour accès technique.",
        localisation: "Angle Sud-Ouest",
        date: "2026-11-02",
        heure: "09:15",
        url: "",
        thumbnailGradient: "from-neutral-700 via-neutral-800 to-neutral-900",
      },
      {
        id: `seed-${chantier.id}-3`,
        chantierId: chantier.id,
        type: "pointage",
        titre: "Pose des premières rangées de lames Cumaru",
        description: "Alignement au cordeau et respect du jeu de dilatation de 5 mm entre abouts de lames.",
        localisation: "Bordure façade",
        date: "2026-11-01",
        heure: "16:20",
        url: "",
        thumbnailGradient: "from-orange-800 via-amber-900 to-amber-950",
      },
    ];
  }

  if (isFacade) {
    return [
      {
        id: `seed-${chantier.id}-1`,
        chantierId: chantier.id,
        type: "pointage",
        titre: "Pose du pare-pluie & liteaux de ventilation",
        description: "Recouvrement 10 cm conforme DTU 41.2, agrafage et collage des adhésifs d'étanchéité.",
        localisation: "Pignon Ouest",
        date: "2026-11-02",
        heure: "11:10",
        url: "",
        thumbnailGradient: "from-slate-700 via-blue-900 to-slate-900",
      },
      {
        id: `seed-${chantier.id}-2`,
        chantierId: chantier.id,
        type: "constat",
        titre: "Déport d'appui de fenêtre maçonné",
        description: "Bavette aluminium pliée requise pour assurer la goutte d'eau sous le rejingot.",
        localisation: "Baie vitrée RDC",
        date: "2026-11-02",
        heure: "08:40",
        url: "",
        thumbnailGradient: "from-zinc-700 via-neutral-800 to-zinc-900",
      },
      {
        id: `seed-${chantier.id}-3`,
        chantierId: chantier.id,
        type: "pointage",
        titre: "Équerres de fixation ossature bois Isolco",
        description: "Rupteurs thermiques sous équerres posés et chevillage béton validé au couple.",
        localisation: "Façade principale",
        date: "2026-11-01",
        heure: "15:30",
        url: "",
        thumbnailGradient: "from-blue-900 via-slate-800 to-neutral-900",
      },
    ];
  }

  // Clôture ou générique
  return [
    {
      id: `seed-${chantier.id}-1`,
      chantierId: chantier.id,
      type: "pointage",
      titre: "Scellement chimique des poteaux",
      description: "Vérification verticalité et alignement laser sur muret béton.",
      localisation: "Limite séparative",
      date: "2026-11-02",
      heure: "10:30",
      url: "",
      thumbnailGradient: "from-emerald-800 via-teal-900 to-slate-900",
    },
    {
      id: `seed-${chantier.id}-2`,
      chantierId: chantier.id,
      type: "constat",
      titre: "Pente de terrain et dénivelé",
      description: "Pose en redan nécessaire pour rattraper les 18 cm de pente sur la travée 4.",
      localisation: "Zone haute",
      date: "2026-11-01",
      heure: "14:15",
      url: "",
      thumbnailGradient: "from-amber-800 via-stone-800 to-neutral-900",
    },
  ];
}

export const PhotoConstatModal: React.FC<PhotoConstatModalProps> = ({
  isOpen,
  onClose,
  chantier,
  chantiers,
  onSelectChantier,
  onPhotoAdded,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // État du chantier actuellement sélectionné dans le modal
  const [activeChantierId, setActiveChantierId] = useState<string>(chantier.id);

  // Synchronise lorsque la prop chantier change
  useEffect(() => {
    if (chantier?.id) {
      setActiveChantierId(chantier.id);
    }
  }, [chantier?.id]);

  const currentChantier = useMemo(() => {
    if (chantiers && chantiers.length > 0) {
      return chantiers.find((c) => c.id === activeChantierId) || chantier;
    }
    return chantier;
  }, [chantiers, activeChantierId, chantier]);

  // État des photos (chargé depuis localStorage ou seed pour currentChantier)
  const storageKey = `bna_photos_chantier_${currentChantier.id}`;
  const [photos, setPhotos] = useState<PhotoChantier[]>([]);
  const [filterType, setFilterType] = useState<"tous" | PhotoType>("tous");

  // Nouvelle photo en cours de saisie / qualification
  const [pendingImage, setPendingImage] = useState<{
    url: string;
    type: PhotoType;
    titre: string;
    description: string;
    localisation: string;
  } | null>(null);

  // Visionneuse Lightbox plein écran
  const [activePhoto, setActivePhoto] = useState<PhotoChantier | null>(null);

  // Chargement des photos
  useEffect(() => {
    if (!isOpen) return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as PhotoChantier[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPhotos(parsed);
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Données initiales
    const seed = getSeedPhotosForChantier(currentChantier);
    setPhotos(seed);
  }, [isOpen, currentChantier, storageKey]);

  // Sauvegarde dans localStorage lors d'un ajout
  const savePhotos = (updated: PhotoChantier[]) => {
    setPhotos(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // Ignore quota storage
    }
  };

  // Traitement d'un fichier sélectionné (appareil photo ou galerie)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, defaultType: PhotoType = "constat") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setPendingImage({
          url: dataUrl,
          type: defaultType,
          titre: "",
          description: "",
          localisation: "",
        });
      }
    };
    reader.readAsDataURL(file);

    // Reset de l'input pour permettre de reprendre la même photo si besoin
    e.target.value = "";
  };

  // Enregistrement de la photo qualifiée
  const handleSavePendingPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingImage) return;

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;

    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const heureStr = `${hh}:${mm}`;

    const newPhoto: PhotoChantier = {
      id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      chantierId: currentChantier.id,
      type: pendingImage.type,
      titre: pendingImage.titre.trim() || (pendingImage.type === "constat" ? "Constat terrain" : "Pointage avancement"),
      description: pendingImage.description.trim() || undefined,
      localisation: pendingImage.localisation.trim() || undefined,
      date: dateStr,
      heure: heureStr,
      url: pendingImage.url,
      isCustom: true,
    };

    const updated = [newPhoto, ...photos];
    savePhotos(updated);
    setPendingImage(null);
    if (onPhotoAdded) {
      onPhotoAdded();
    }
  };

  // Suppression d'une photo personnalisée
  const handleDeletePhoto = (photoId: string) => {
    if (confirm("Supprimer ce cliché de la galerie du chantier ?")) {
      const updated = photos.filter((p) => p.id !== photoId);
      savePhotos(updated);
      if (activePhoto?.id === photoId) {
        setActivePhoto(null);
      }
    }
  };

  // Filtrage des photos
  const filteredPhotos = useMemo(() => {
    if (filterType === "tous") return photos;
    return photos.filter((p) => p.type === filterType);
  }, [photos, filterType]);

  const countConstats = photos.filter((p) => p.type === "constat").length;
  const countPointages = photos.filter((p) => p.type === "pointage").length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-bna-border rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* ----------------------------------------------------------------- */}
        {/* 1. EN-TÊTE DU MODAL                                               */}
        {/* ----------------------------------------------------------------- */}
        <div className="p-4 border-b border-bna-border/80 flex items-start justify-between gap-3 bg-neutral-900 text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#D97732]/20 border border-[#D97732]/40 flex items-center justify-center text-[#D97732] shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold leading-tight truncate">
                Photos : Constat ou Pointage
              </h2>
              {chantiers && chantiers.length > 1 ? (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold shrink-0">
                    Chantier :
                  </span>
                  <div className="relative inline-block max-w-[210px] sm:max-w-[270px]">
                    <select
                      value={currentChantier.id}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setActiveChantierId(newId);
                        if (onSelectChantier) {
                          onSelectChantier(newId);
                        }
                      }}
                      className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-lg pl-2 pr-6 py-1 border border-neutral-700 focus:outline-hidden focus:ring-1 focus:ring-[#D97732] appearance-none cursor-pointer truncate shadow-xs"
                    >
                      {chantiers.map((c) => (
                        <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                          {c.nom} ({c.ville})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-neutral-400 mt-0.5 truncate">
                  {currentChantier.nom} · {currentChantier.ville}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inputs fichiers cachés pour déclenchement photo ou import */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileChange(e, "constat")}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileChange(e, "pointage")}
        />

        {/* ----------------------------------------------------------------- */}
        {/* 2. ZONE PRINCIPALE SCROLLABLE                                    */}
        {/* ----------------------------------------------------------------- */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Panneau d'action : Déclencheurs de capture photo pro */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="p-3 rounded-2xl bg-[#D97732] hover:bg-[#c26526] text-white flex flex-col items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.98] group"
            >
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Camera className="w-5 h-5" />
              </div>
              <span className="font-bold text-xs">Prendre une photo</span>
              <span className="text-[10px] text-white/80">Appareil direct</span>
            </button>

            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="p-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 border border-bna-border text-bna-anthracite flex flex-col items-center justify-center gap-1.5 transition-all active:scale-[0.98] group"
            >
              <div className="w-9 h-9 rounded-xl bg-white border border-bna-border flex items-center justify-center text-neutral-700 group-hover:scale-105 transition-transform">
                <Upload className="w-4 h-4" />
              </div>
              <span className="font-bold text-xs">Importer cliché</span>
              <span className="text-[10px] text-bna-muted">Depuis la galerie</span>
            </button>
          </div>

          {/* Formulaire de qualification de la nouvelle photo capturée */}
          {pendingImage && (
            <form
              onSubmit={handleSavePendingPhoto}
              className="p-3.5 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between pb-2 border-b border-orange-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-orange-950">
                  <Plus className="w-4 h-4 text-[#D97732]" />
                  <span>Qualifier le nouveau cliché</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-800"
                >
                  Annuler
                </button>
              </div>

              {/* Aperçu de l'image */}
              <div className="relative aspect-video max-h-40 rounded-xl overflow-hidden border border-orange-300 bg-neutral-900 flex items-center justify-center">
                <img
                  src={pendingImage.url}
                  alt="Aperçu capture"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Sélecteur de type : Constat vs Pointage */}
              <div>
                <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                  Type d&apos;enregistrement :
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPendingImage((prev) => (prev ? { ...prev, type: "constat" } : null))
                    }
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      pendingImage.type === "constat"
                        ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                        : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Constat / Aléa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPendingImage((prev) => (prev ? { ...prev, type: "pointage" } : null))
                    }
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      pendingImage.type === "pointage"
                        ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                        : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Pointage / Étape</span>
                  </button>
                </div>
              </div>

              {/* Sélecteur de Chantier cible si multi-chantiers */}
              {chantiers && chantiers.length > 1 && (
                <div>
                  <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                    Rattacher au chantier :
                  </label>
                  <div className="relative">
                    <select
                      value={currentChantier.id}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setActiveChantierId(newId);
                        if (onSelectChantier) {
                          onSelectChantier(newId);
                        }
                      }}
                      className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#D97732] appearance-none pr-8 cursor-pointer"
                    >
                      {chantiers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom} ({c.ville})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Titre & Localisation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                    Objet ou Intitulé *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      pendingImage.type === "constat"
                        ? "Ex: Réserve support, défaut d'équerre..."
                        : "Ex: Fin de pose lambourdes..."
                    }
                    value={pendingImage.titre}
                    onChange={(e) =>
                      setPendingImage((prev) => (prev ? { ...prev, titre: e.target.value } : null))
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#D97732]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                    Localisation sur site
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Façade Nord, Rive droite, Angle..."
                    value={pendingImage.localisation}
                    onChange={(e) =>
                      setPendingImage((prev) => (prev ? { ...prev, localisation: e.target.value } : null))
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#D97732]"
                  />
                </div>
              </div>

              {/* Description / Consigne */}
              <div>
                <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                  Remarque / Consigne terrain (optionnel)
                </label>
                <textarea
                  rows={2}
                  placeholder="Détail de la mesure, consigne pour le lendemain ou point DTU..."
                  value={pendingImage.description}
                  onChange={(e) =>
                    setPendingImage((prev) => (prev ? { ...prev, description: e.target.value } : null))
                  }
                  className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#D97732]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#D97732] hover:bg-[#c26526] text-white shadow-xs transition-all active:scale-95"
                >
                  Enregistrer dans la galerie
                </button>
              </div>
            </form>
          )}

          {/* --------------------------------------------------------------- */}
          {/* 3. GALERIE DES PHOTOS RÉCENTES DU CHANTIER                      */}
          {/* --------------------------------------------------------------- */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-bna-muted" />
                <span className="text-xs font-bold uppercase tracking-wider text-bna-muted">
                  Galerie du chantier ({photos.length})
                </span>
              </div>

              {/* Filtres Constat / Pointage */}
              <div className="inline-flex p-0.5 rounded-xl bg-neutral-100 border border-neutral-200 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFilterType("tous")}
                  className={`px-2 py-1 rounded-lg font-bold transition-all ${
                    filterType === "tous"
                      ? "bg-white text-bna-anthracite shadow-2xs"
                      : "text-neutral-500 hover:text-bna-anthracite"
                  }`}
                >
                  Tous ({photos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("constat")}
                  className={`px-2 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                    filterType === "constat"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "text-neutral-500 hover:text-amber-700"
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Constats ({countConstats})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("pointage")}
                  className={`px-2 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                    filterType === "pointage"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "text-neutral-500 hover:text-emerald-700"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Pointages ({countPointages})</span>
                </button>
              </div>
            </div>

            {/* Grille des clichés */}
            {filteredPhotos.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400 bg-neutral-50 rounded-2xl border border-dashed border-bna-border space-y-2">
                <Camera className="w-6 h-6 mx-auto text-neutral-300" />
                <p>Aucune photo enregistrée dans cette catégorie.</p>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-white border border-neutral-300 text-bna-anthracite font-bold text-xs inline-flex items-center gap-1 shadow-2xs"
                >
                  <Camera className="w-3.5 h-3.5 text-[#D97732]" />
                  <span>Prendre un cliché</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filteredPhotos.map((photo) => {
                  const isConstat = photo.type === "constat";
                  const badgeClass = isConstat
                    ? "bg-amber-500/90 text-white"
                    : "bg-emerald-600/90 text-white";

                  return (
                    <div
                      key={photo.id}
                      onClick={() => setActivePhoto(photo)}
                      className="group relative bg-white border border-bna-border hover:border-[#D97732] rounded-2xl overflow-hidden shadow-xs cursor-pointer transition-all active:scale-[0.98] flex flex-col"
                    >
                      {/* Vignette Photo */}
                      <div className="aspect-4/3 relative w-full overflow-hidden bg-neutral-900 flex items-center justify-center">
                        {photo.url ? (
                          <img
                            src={photo.url}
                            alt={photo.titre}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div
                            className={`w-full h-full bg-gradient-to-br ${
                              photo.thumbnailGradient || "from-neutral-800 to-neutral-950"
                            } flex flex-col items-center justify-center text-neutral-300 p-2 text-center`}
                          >
                            <Camera className="w-6 h-6 mb-1 text-white/70" />
                            <span className="text-[10px] text-white/80 font-medium line-clamp-1">
                              {photo.titre}
                            </span>
                          </div>
                        )}

                        {/* Badge Type (Constat vs Pointage) */}
                        <span
                          className={`absolute top-2 left-2 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur-xs shadow-2xs ${badgeClass}`}
                        >
                          {isConstat ? "Constat" : "Pointage"}
                        </span>

                        {/* Horodatage discret */}
                        <span className="absolute bottom-2 right-2 text-[9px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-xs">
                          <Clock className="w-2.5 h-2.5 text-orange-300" />
                          <span>{photo.heure}</span>
                        </span>
                      </div>

                      {/* Métadonnées & Légende */}
                      <div className="p-2.5 flex flex-col justify-between flex-1 space-y-1">
                        <div>
                          <p className="font-bold text-xs text-bna-anthracite line-clamp-1 group-hover:text-[#D97732] transition-colors">
                            {photo.titre}
                          </p>
                          {photo.localisation && (
                            <p className="text-[10px] text-neutral-500 line-clamp-1 flex items-center gap-0.5 mt-0.5">
                              <MapPin className="w-2.5 h-2.5 text-[#D97732] shrink-0" />
                              <span>{photo.localisation}</span>
                            </p>
                          )}
                        </div>

                        <span className="text-[9px] text-neutral-400 block pt-1 border-t border-neutral-100">
                          {photo.date}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* 4. PIED DE PAGE DU MODAL                                          */}
        {/* ----------------------------------------------------------------- */}
        <div className="p-3 bg-neutral-50 border-t border-bna-border/80 flex items-center justify-between text-xs text-bna-muted">
          <span>{photos.length} cliché(s) rattaché(s) au chantier</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-100 text-bna-anthracite font-bold text-xs transition-all active:scale-95"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 5. VISIONNEUSE PLEIN ÉCRAN / LIGHTBOX AU CLIC SUR UN CLICHÉ        */}
      {/* ------------------------------------------------------------------- */}
      {activePhoto && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header Lightbox */}
            <div className="p-3.5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    activePhoto.type === "constat" ? "bg-amber-600" : "bg-emerald-600"
                  }`}
                >
                  {activePhoto.type}
                </span>
                <span className="text-xs font-semibold text-neutral-300">
                  {activePhoto.date} à {activePhoto.heure}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setActivePhoto(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vue Image Agrandie */}
            <div className="bg-black flex items-center justify-center min-h-[220px] max-h-[380px] overflow-hidden relative">
              {activePhoto.url ? (
                <img
                  src={activePhoto.url}
                  alt={activePhoto.titre}
                  className="w-full h-full max-h-[380px] object-contain"
                />
              ) : (
                <div
                  className={`w-full h-64 bg-gradient-to-br ${
                    activePhoto.thumbnailGradient || "from-neutral-800 to-neutral-950"
                  } flex flex-col items-center justify-center text-white p-4 text-center`}
                >
                  <Camera className="w-12 h-12 mb-2 text-[#D97732]" />
                  <p className="font-bold text-sm">{activePhoto.titre}</p>
                  <p className="text-xs text-neutral-300 mt-1">Cliché horodaté du terrain</p>
                </div>
              )}
            </div>

            {/* Informations détaillées */}
            <div className="p-4 space-y-2.5 text-xs overflow-y-auto">
              <div>
                <h3 className="font-bold text-sm text-bna-anthracite">
                  {activePhoto.titre}
                </h3>
                {activePhoto.localisation && (
                  <p className="text-neutral-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-[#D97732]" />
                    <span>Emplacement : {activePhoto.localisation}</span>
                  </p>
                )}
              </div>

              {activePhoto.description && (
                <div className="p-3 rounded-xl bg-bna-offwhite border border-bna-border text-neutral-700">
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-0.5">
                    Consigne / Constat
                  </p>
                  <p className="leading-relaxed">{activePhoto.description}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-bna-border/80">
                {activePhoto.isCustom ? (
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(activePhoto.id)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer ce cliché</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-neutral-400">
                    Cliché d&apos;archive chantier
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setActivePhoto(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-900 text-white font-bold text-xs"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
