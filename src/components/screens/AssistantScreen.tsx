"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Trash2,
  CalendarCheck2,
  HardHat,
  Calculator,
  CheckCircle2,
  CloudRain,
  Package,
  ArrowUpRight,
  Bot,
  User,
  ShieldCheck,
  FileText,
  Zap,
} from "lucide-react";
import type { Chantier } from "@/types/metier";
import { createClient } from "@/lib/supabase/client";
import {
  getRendezVous,
  creerRendezVous,
  type RendezVous,
} from "@/lib/services/rendezVousService";
import {
  getAllCommandes,
  type CommandeAvecFournisseur,
} from "@/lib/services/commandesFournisseursService";
import { updateChantierRecord, isUuid } from "@/lib/services/chantierService";
import {
  generateLocalAssistantResponse,
  getChantierMeteoInfo,
  type AssistantMessage,
  type AssistantAction,
  type AssistantContext,
} from "@/lib/services/bnaAssistantService";
import {
  getDevisList,
  getFacturesList,
  creerNouveauDevis,
  type DevisItem,
  type FactureItem,
} from "@/lib/services/devisFinanceService";

interface AssistantScreenProps {
  userName?: string;
  userRole?: string;
  chantiers: Chantier[];
  activeChantierId?: string;
  onSelectChantier?: (id: string) => void;
  onOpenCockpit?: (id: string) => void;
  onOpenCalepinage?: () => void;
  onOpenDevis?: () => void;
  onChantierUpdated?: () => void;
}

const CHAT_STORAGE_KEY = "bna_assistant_chat_v1";

const QUICK_PROMPTS = [
  {
    label: "📋 Briefing du jour",
    prompt: "Fais-moi la synthèse des chantiers actifs, du planning et des alertes météo du jour.",
  },
  {
    label: "💶 Trésorerie & Marges",
    prompt: "Quel est mon bilan financier : chiffre d'affaires signé, marge brute, reste à facturer et factures en retard ?",
  },
  {
    label: "📅 Planifier RDV demain 9h30",
    prompt: "Planifie un RDV demain à 09h30 pour contrôle réglage lambourdes et plots.",
  },
  {
    label: "🌧️ Météo & Pose DTU",
    prompt: "Vérifie la météo sur mes chantiers : est-ce qu'on peut poser demain selon les règles DTU ?",
  },
  {
    label: "📐 Règles DTU 51.4 & 41.2",
    prompt: "Rappelle-moi les règles DTU 51.4 (terrasse) et DTU 41.2 (bardage bois) sur l'entraxe et la ventilation.",
  },
  {
    label: "💰 Créer Devis Terrasse 40 m²",
    prompt: "Crée un devis pour Terrasse Martin de 40 m².",
  },
  {
    label: "📦 État des commandes",
    prompt: "Quel est l'état de mes commandes fournisseurs et des prochaines livraisons ?",
  },
];

export const AssistantScreen: React.FC<AssistantScreenProps> = ({
  userName = "Gaël",
  userRole = "Gérant",
  chantiers,
  activeChantierId,
  onSelectChantier,
  onOpenCockpit,
  onOpenCalepinage,
  onOpenDevis,
  onChantierUpdated,
}) => {
  const supabase = createClient();
  const [rdvs, setRdvs] = useState<RendezVous[]>([]);
  const [commandes, setCommandes] = useState<CommandeAvecFournisseur[]>([]);
  const [devis, setDevis] = useState<DevisItem[]>([]);
  const [factures, setFactures] = useState<FactureItem[]>([]);
  const [selectedContextChantierId, setSelectedContextChantierId] = useState<string>(
    activeChantierId || "tous"
  );

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Chargement du contexte complet (RDVs + Commandes fournisseurs + Devis & Factures)
  const loadOperationalContext = async () => {
    try {
      setDevis(getDevisList());
      setFactures(getFacturesList());
      const [loadedRdvs, loadedCmds] = await Promise.all([
        getRendezVous(supabase),
        getAllCommandes(supabase),
      ]);
      setRdvs(loadedRdvs);
      setCommandes(loadedCmds);
    } catch {
      // Fallback silencieux
    }
  };

  useEffect(() => {
    loadOperationalContext();
  }, []);

  // Chargement de l'historique local ou message d'accueil initial
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // ignorer
    }

    const welcomeMsg: AssistantMessage = {
      id: "msg-welcome",
      role: "assistant",
      content: [
        `Bonjour **${userName}**. Je suis votre **Assistant IA Central BNA**, connecté en direct à vos chantiers, votre planning général et vos moteurs DTU.`,
        "",
        `Vous pouvez me solliciter par écrit ou à la voix (bouton micro) pour :`,
        `• **Piloter vos chantiers** : synthèse d'avancement, alertes retards et météo DTU`,
        `• **Agir sur le planning** : *"Planifie un RDV demain à 14h sur Bardage Dupont"*`,
        `• **Chiffrer & Vérifier** : pré-chiffrage rapide HT au m² ou vérification des normes DTU 51.4 / 41.2 / 45.4`,
      ].join("\n"),
      timestamp: new Date().toISOString(),
      tags: ["Copilote BNA Actif", `Session ${userRole}`],
    };
    setMessages([welcomeMsg]);
  }, [userName, userRole]);

  // Sauvegarde automatique de l'historique
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-30)));
      } catch {
        // ignorer
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildContextObject = (): AssistantContext => ({
    userName,
    userRole,
    currentDateIso: new Date().toISOString().slice(0, 10),
    activeChantierId:
      selectedContextChantierId !== "tous" ? selectedContextChantierId : activeChantierId,
    chantiers,
    rdvs,
    commandes,
    devis,
    factures,
  });

  // Envoi d'un message à l'Assistant IA
  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = (textOverride ?? input).trim();
    if (!textToSend || isSending) return;

    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textOverride) setInput("");
    setIsSending(true);

    const ctx = buildContextObject();

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          context: ctx,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: AssistantMessage = {
          id: `ast-${Date.now()}`,
          role: "assistant",
          content: data.content,
          timestamp: new Date().toISOString(),
          actions: data.actions,
          tags: data.tags,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        // Fallback direct sur le moteur local BNA
        const fallback = generateLocalAssistantResponse(textToSend, ctx);
        setMessages((prev) => [
          ...prev,
          {
            id: `ast-${Date.now()}`,
            role: "assistant",
            content: fallback.content,
            timestamp: new Date().toISOString(),
            actions: fallback.actions,
            tags: fallback.tags,
          },
        ]);
      }
    } catch {
      const fallback = generateLocalAssistantResponse(textToSend, ctx);
      setMessages((prev) => [
        ...prev,
        {
          id: `ast-${Date.now()}`,
          role: "assistant",
          content: fallback.content,
          timestamp: new Date().toISOString(),
          actions: fallback.actions,
          tags: fallback.tags,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // Exécution d'une carte d'action validée par Gaël
  const handleExecuteAction = async (messageId: string, action: AssistantAction) => {
    if (action.executed || executingActionId) return;
    setExecutingActionId(action.id);

    try {
      if (action.type === "create_rdv") {
        await creerRendezVous(supabase, {
          chantier_id: action.payload.chantierId || null,
          chantier_nom: action.payload.chantierNom || null,
          titre: action.payload.rdvTitre || "Rendez-vous chantier",
          nature: action.payload.rdvNature || "Point technique sur site",
          date: action.payload.rdvDate || new Date().toISOString().slice(0, 10),
          heure_debut: action.payload.rdvHeureDebut || "09:30",
          lieu: action.payload.rdvLieu || "Gironde",
          statut: "confirme",
        });
        await loadOperationalContext();
      } else if (action.type === "update_avancement") {
        const cId = action.payload.chantierId;
        const pct = action.payload.nouvelAvancement ?? 50;
        if (cId && isUuid(cId)) {
          await updateChantierRecord(supabase, cId, { avancement: pct });
        }
        onChantierUpdated?.();
      } else if (action.type === "open_calepinage") {
        if (action.payload.chantierId && onSelectChantier) {
          onSelectChantier(action.payload.chantierId);
        }
        onOpenCalepinage?.();
      } else if (action.type === "open_cockpit") {
        if (action.payload.chantierId && onOpenCockpit) {
          onOpenCockpit(action.payload.chantierId);
        }
      } else if (action.type === "open_devis") {
        onOpenDevis?.();
      } else if (action.type === "create_devis") {
        const qte = action.payload.devisQuantite || 35;
        const unite = action.payload.devisUnite || "m²";
        const puFourniture = action.payload.devisPuFournitureHt || 95;
        const puPose = action.payload.devisPuPoseHt || 72;
        const metier = action.payload.metier || "terrasse";

        creerNouveauDevis({
          chantier_id: action.payload.chantierId,
          chantier_nom: action.payload.chantierNom || "Projet BNA",
          client_nom: action.payload.chantierNom
            ? `Client ${action.payload.chantierNom}`
            : "Nouveau Client BNA",
          ville: "Gironde",
          metier,
          objet: action.payload.devisObjet || `Devis ${metier.toUpperCase()} BNA`,
          statut: "envoye",
          tva_pct: 10,
          acompte_pct: 30,
          retenue_garantie_pct: 5,
          lignes: [
            {
              id: `lig-ia-mat-${Date.now()}`,
              designation: `Fourniture ${metier.toUpperCase()} & accessoires DTU`,
              qte,
              unite,
              pu_ht: puFourniture,
              pu_revient: Math.round(puFourniture * 0.62),
              type_cout: "matiere",
            },
            {
              id: `lig-ia-mo-${Date.now() + 1}`,
              designation: `Main d'œuvre pose complète (${metier.toUpperCase()})`,
              qte,
              unite,
              pu_ht: puPose,
              pu_revient: Math.round(puPose * 0.54),
              type_cout: "main_oeuvre",
            },
          ],
        });
        await loadOperationalContext();
      }

      // Marquer l'action comme exécutée dans le fil de discussion
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId || !m.actions) return m;
          return {
            ...m,
            actions: m.actions.map((a) =>
              a.id === action.id ? { ...a, executed: true } : a
            ),
          };
        })
      );
    } catch (err) {
      console.error("Erreur exécution action IA :", err);
    } finally {
      setExecutingActionId(null);
    }
  };

  // Dictée vocale terrain (Web Speech API fr-FR)
  const toggleVoiceInput = () => {
    if (typeof window === "undefined") return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("La dictée vocale n'est pas supportée par ce navigateur.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleResetChat = () => {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    const freshMsg: AssistantMessage = {
      id: `msg-reset-${Date.now()}`,
      role: "assistant",
      content: `Conversation réinitialisée. Je suis prêt pour vos instructions, **${userName}**.`,
      timestamp: new Date().toISOString(),
      tags: ["Nouvelle Session"],
    };
    setMessages([freshMsg]);
  };

  // Rendu formaté léger du Markdown (gras, listes, titres)
  const renderFormattedText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      if (line.startsWith("### ")) {
        return (
          <h4 key={idx} className="font-display font-bold text-sm text-bna-anthracite mt-2 mb-1">
            {line.replace("### ", "")}
          </h4>
        );
      }

      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }

      // Transformation des **gras** et *italiques*
      const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
      return (
        <p key={idx} className="leading-relaxed">
          {parts.map((part, pIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={pIdx} className="font-bold text-bna-anthracite">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            if (part.startsWith("*") && part.endsWith("*")) {
              return (
                <em key={pIdx} className="italic text-slate-600">
                  {part.slice(1, -1)}
                </em>
              );
            }
            return <span key={pIdx}>{part}</span>;
          })}
        </p>
      );
    });
  };

  const countAlertesMeteo = chantiers.filter((c) => {
    const m = getChantierMeteoInfo(c);
    return m.statutPose === "deconseille" || m.statutPose === "attention";
  }).length;

  return (
    <div className="py-2 md:py-4 flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] max-h-[860px] animate-in fade-in duration-150">
      {/* EN-TÊTE COCKPIT IA & CONTEXTE TEMPS RÉEL */}
      <div className="bg-white border border-bna-border rounded-2xl p-3.5 sm:p-4 shadow-xs mb-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-bna-copper text-white flex items-center justify-center shadow-copper shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-base sm:text-lg text-bna-anthracite leading-tight">
                  BNA Assistant IA
                </h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Connecté
                </span>
              </div>
              <p className="text-[11px] text-bna-muted">
                Copilote Métier DTU · Pilotage Chantiers, Planning &amp; Pré-Chiffrage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sélecteur de contexte chantier */}
            <select
              value={selectedContextChantierId}
              onChange={(e) => {
                setSelectedContextChantierId(e.target.value);
                if (e.target.value !== "tous" && onSelectChantier) {
                  onSelectChantier(e.target.value);
                }
              }}
              aria-label="Contexte chantier"
              className="text-xs font-semibold bg-bna-offwhite border border-bna-border rounded-xl px-2.5 py-1.5 text-bna-anthracite focus:outline-hidden focus:border-bna-copper"
            >
              <option value="tous">Tous les chantiers ({chantiers.length})</option>
              {chantiers.map((c) => (
                <option key={c.id} value={c.id}>
                  Chantier : {c.nom} ({c.ville})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleResetChat}
              title="Effacer la conversation"
              className="p-2 text-bna-muted hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bandeau de télémétrie en direct */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-2.5 border-t border-bna-border/60 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-700 bg-bna-offwhite px-2.5 py-1.5 rounded-xl">
            <HardHat className="w-3.5 h-3.5 text-bna-copper shrink-0" />
            <span>
              <b>{chantiers.length}</b> chantiers actifs
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700 bg-bna-offwhite px-2.5 py-1.5 rounded-xl">
            <CalendarCheck2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              <b>{rdvs.length}</b> RDVs planifiés
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700 bg-bna-offwhite px-2.5 py-1.5 rounded-xl">
            <Package className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>
              <b>{commandes.length}</b> commandes
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700 bg-bna-offwhite px-2.5 py-1.5 rounded-xl">
            <CloudRain className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              <b>{countAlertesMeteo}</b> vigilance(s) météo
            </span>
          </div>
        </div>
      </div>

      {/* BARRE DE SUGGESTIONS RAPIDES (QUICK PROMPTS) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 shrink-0 no-scrollbar">
        {QUICK_PROMPTS.map((qp, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isSending}
            onClick={() => handleSendMessage(qp.prompt)}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-orange-50 border border-bna-border hover:border-bna-copper/50 text-[11px] font-semibold text-bna-anthracite whitespace-nowrap transition-all active:scale-95 shadow-2xs shrink-0 cursor-pointer"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* ZONE DE CONVERSATION SCROLLABLE */}
      <div className="flex-1 overflow-y-auto bg-white border border-bna-border rounded-2xl p-3.5 sm:p-4 space-y-4 shadow-xs">
        {messages.map((msg) => {
          const isUser = msg.role === "user";

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                isUser ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  isUser
                    ? "bg-neutral-900 text-white"
                    : "bg-orange-50 border border-orange-200 text-bna-copper"
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Bulle de message */}
              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3.5 text-xs space-y-2 ${
                  isUser
                    ? "bg-neutral-900 text-white rounded-tr-xs"
                    : "bg-bna-offwhite border border-bna-border/80 text-slate-800 rounded-tl-xs"
                }`}
              >
                {/* Badges de catégories si présents */}
                {!isUser && msg.tags && msg.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pb-1">
                    {msg.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-bna-copper border border-orange-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Contenu textuel */}
                <div className={isUser ? "text-white leading-relaxed" : "space-y-1"}>
                  {isUser ? msg.content : renderFormattedText(msg.content)}
                </div>

                {/* CARTES D'ACTIONS INTERACTIVES (TOOL CALLING) */}
                {!isUser && msg.actions && msg.actions.length > 0 && (
                  <div className="pt-2 space-y-2">
                    {msg.actions.map((act) => (
                      <div
                        key={act.id}
                        className="p-3 bg-white border border-bna-border rounded-xl shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Zap className="w-4 h-4 text-bna-copper shrink-0" />
                            <span className="font-bold text-xs text-bna-anthracite">
                              {act.title}
                            </span>
                          </div>
                          {act.executed && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Exécuté
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-bna-muted">{act.description}</p>

                        {!act.executed ? (
                          <button
                            type="button"
                            disabled={executingActionId === act.id}
                            onClick={() => handleExecuteAction(msg.id, act)}
                            className="w-full py-2 px-3 bg-bna-copper hover:bg-bna-copper-hover text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-98 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {executingActionId === act.id
                                ? "Exécution en cours..."
                                : "Confirmer et exécuter cette action"}
                            </span>
                          </button>
                        ) : (
                          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Action validée et synchronisée avec le Dashboard BNA.</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-bna-copper flex items-center justify-center">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-bna-offwhite border border-bna-border text-xs text-bna-muted font-medium">
              Analyse du contexte BNA en cours...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* BARRE DE SAISIE CLAVIER + MICRO DICTÉE VOCALE */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="mt-3 flex items-center gap-2 bg-white border border-bna-border rounded-2xl p-2 shadow-sm shrink-0"
      >
        <button
          type="button"
          onClick={toggleVoiceInput}
          title={isListening ? "Arrêter la dictée vocale" : "Dicter à la voix (Terrain)"}
          className={`p-2.5 rounded-xl transition-all shrink-0 cursor-pointer ${
            isListening
              ? "bg-rose-600 text-white animate-pulse shadow-sm"
              : "bg-bna-offwhite text-bna-muted hover:text-bna-anthracite"
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isListening
              ? "Parlez maintenant, je vous écoute..."
              : "Posez une question DTU, planifiez un RDV, demandez un chiffrage..."
          }
          className="flex-1 text-xs font-medium text-bna-anthracite placeholder:text-bna-muted bg-transparent px-2 py-1.5 focus:outline-hidden"
        />

        <button
          type="submit"
          disabled={!input.trim() || isSending}
          className="px-4 py-2.5 rounded-xl bg-bna-copper hover:bg-bna-copper-hover disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Envoyer</span>
        </button>
      </form>
    </div>
  );
};
