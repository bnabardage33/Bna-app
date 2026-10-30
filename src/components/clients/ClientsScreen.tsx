"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Plus,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  HardHat,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { ClientRow } from "@/types/database.types";
import { Chantier } from "@/types/metier";
import { createClient } from "@/lib/supabase/client";
import { getClients } from "@/lib/services/clientService";
import { NewClientModal } from "./NewClientModal";
import { ClientDetailModal } from "./ClientDetailModal";
import { normalizeTitleCase, formatPhoneNumber } from "@/lib/formatters";

interface ClientsScreenProps {
  chantiers: Chantier[];
  onOpenCorbeille: () => void;
  onOpenChantier: (chantierId: string) => void;
}

export const ClientsScreen: React.FC<ClientsScreenProps> = ({
  chantiers,
  onOpenCorbeille,
  onOpenChantier,
}) => {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "particulier" | "professionnel">("all");

  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);

  const supabase = createClient();

  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await getClients(supabase);
      setClients(data);
    } catch (err) {
      console.error("Erreur chargement clients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  // Filtrage combiné recherche et type
  const filteredClients = clients.filter((c) => {
    if (typeFilter !== "all" && c.type_client !== typeFilter) return false;
    if (!search.trim()) return true;

    const term = search.toLowerCase();
    const matchNom = c.nom.toLowerCase().includes(term);
    const matchPrenom = c.prenom?.toLowerCase().includes(term);
    const matchSociete = c.societe?.toLowerCase().includes(term);
    const matchVille = c.ville?.toLowerCase().includes(term);
    const matchTel = c.telephone?.toLowerCase().includes(term);

    return matchNom || matchPrenom || matchSociete || matchVille || matchTel;
  });

  return (
    <div className="py-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-bna-copper" />
          <div>
            <h1 className="font-display font-bold text-2xl">Clients</h1>
            <p className="text-[11px] text-bna-muted">
              {clients.length} client{clients.length > 1 ? "s" : ""} actif{clients.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCorbeille}
            className="p-2 border border-bna-border bg-white hover:bg-neutral-50 text-bna-muted hover:text-bna-anthracite rounded-xl transition-colors"
            title="Ouvrir la corbeille"
            aria-label="Corbeille"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsNewClientOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-bna-copper hover:bg-bna-copper-hover text-white text-xs font-semibold rounded-xl shadow-xs transition-colors active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nouveau</span>
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-bna-muted absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Rechercher par nom, ville, tél..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-bna-border rounded-xl text-xs font-medium focus:outline-hidden focus:border-bna-copper shadow-xs"
        />
      </div>

      {/* Filtres de types */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-100 rounded-xl mb-4 text-xs font-bold">
        <button
          onClick={() => setTypeFilter("all")}
          className={`py-1.5 rounded-lg transition-all ${
            typeFilter === "all"
              ? "bg-white text-bna-copper shadow-xs"
              : "text-bna-muted hover:text-bna-anthracite"
          }`}
        >
          Tous ({clients.length})
        </button>
        <button
          onClick={() => setTypeFilter("particulier")}
          className={`py-1.5 rounded-lg transition-all ${
            typeFilter === "particulier"
              ? "bg-white text-bna-copper shadow-xs"
              : "text-bna-muted hover:text-bna-anthracite"
          }`}
        >
          Particuliers
        </button>
        <button
          onClick={() => setTypeFilter("professionnel")}
          className={`py-1.5 rounded-lg transition-all ${
            typeFilter === "professionnel"
              ? "bg-white text-bna-copper shadow-xs"
              : "text-bna-muted hover:text-bna-anthracite"
          }`}
        >
          Pros
        </button>
      </div>

      {/* Liste des clients */}
      {loading ? (
        <div className="py-8 text-center text-xs text-bna-muted">Chargement des fiches clients...</div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white border border-bna-border rounded-2xl p-6 text-center shadow-xs">
          <p className="text-sm font-semibold text-bna-anthracite">Aucun client trouvé</p>
          <p className="text-xs text-bna-muted mt-1">
            {search ? "Modifiez votre recherche" : "Créez votre première fiche client complète"}
          </p>
          <button
            onClick={() => setIsNewClientOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-bna-copper text-white text-xs font-semibold rounded-xl"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau client</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredClients.map((client) => {
            const clientName =
              client.type_client === "professionnel"
                ? client.societe || client.nom
                : `${client.prenom ? normalizeTitleCase(client.prenom) + " " : ""}${normalizeTitleCase(client.nom)}`;

            // Chantiers rattachés
            const activeChantiersCount = chantiers.filter(
              (c) => c.client_id === client.id && !c.deleted_at
            ).length;

            return (
              <div
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs cursor-pointer hover:border-bna-copper/40 transition-all space-y-2.5"
              >
                {/* Ligne 1 : Nom/Société + Badge Type */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-bna-offwhite text-bna-copper shrink-0">
                      {client.type_client === "professionnel" ? (
                        <Building2 className="w-3.5 h-3.5" />
                      ) : (
                        <User className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <h3 className="font-display font-bold text-sm text-bna-anthracite truncate">
                      {clientName}
                    </h3>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-100 text-bna-muted shrink-0">
                    {client.type_client === "professionnel" ? "Professionnel" : "Particulier"}
                  </span>
                </div>

                {/* Ligne 2 : Adresse de facturation complète */}
                <div className="flex items-start gap-1.5 text-xs text-bna-anthracite pl-0.5">
                  <MapPin className="w-3.5 h-3.5 text-bna-copper shrink-0 mt-0.5" />
                  <div className="min-w-0 leading-tight">
                    <p className="font-medium text-bna-anthracite truncate">
                      {normalizeTitleCase(client.adresse)}
                      {client.adresse_complement ? ` (${client.adresse_complement})` : ""}
                    </p>
                    <p className="text-bna-muted text-[11px] mt-0.5">
                      {client.code_postal} {normalizeTitleCase(client.ville)}
                    </p>
                  </div>
                </div>

                {/* Ligne 3 : Coordonnées (Téléphone & Email si présent) */}
                <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-bna-muted pt-1 border-t border-bna-border/40">
                  <span className="flex items-center gap-1 font-semibold text-bna-anthracite">
                    <Phone className="w-3 h-3 text-bna-copper shrink-0" />
                    <span>{formatPhoneNumber(client.telephone)}</span>
                  </span>

                  {client.email && (
                    <span className="flex items-center gap-1 truncate text-bna-muted max-w-[200px]">
                      <Mail className="w-3 h-3 text-bna-copper shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </span>
                  )}
                </div>

                {/* Ligne 4 : Compteur chantiers + action ouvrir */}
                <div className="flex items-center justify-between pt-1 border-t border-bna-border/40 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-bna-copper">
                    <HardHat className="w-3.5 h-3.5" />
                    <span>
                      {activeChantiersCount} chantier{activeChantiersCount > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-semibold text-bna-muted">
                    <span>Voir fiche</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <NewClientModal
        isOpen={isNewClientOpen}
        onClose={() => setIsNewClientOpen(false)}
        onClientCreated={(newClient) => {
          loadClients();
          setSelectedClient(newClient);
        }}
      />

      <ClientDetailModal
        client={selectedClient}
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        onClientUpdated={loadClients}
        onOpenChantier={onOpenChantier}
        chantiers={chantiers}
      />
    </div>
  );
};
