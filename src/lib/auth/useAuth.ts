"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { EntrepriseRow, ProfilRow } from "@/types/database.types";

export function useAuth() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profil, setProfil] = useState<ProfilRow | null>(null);
  const [entreprise, setEntreprise] = useState<EntrepriseRow | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuthData = useCallback(() => {
    setUser(null);
    setSession(null);
    setProfil(null);
    setEntreprise(null);
  }, []);

  const loadProfile = useCallback(
    async (currentUser: User | null) => {
      if (!currentUser) {
        setProfil(null);
        setEntreprise(null);
        return;
      }

      const { data: profilData, error: profilError } = await supabase
        .from("profils")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profilError) {
        console.error("Erreur chargement profil :", profilError);
        setProfil(null);
        setEntreprise(null);
        return;
      }

      if (!profilData) {
        console.warn("Aucun profil trouvé pour l’utilisateur connecté.");
        setProfil(null);
        setEntreprise(null);
        return;
      }

      const currentProfil = profilData as ProfilRow;
      setProfil(currentProfil);

      const { data: entrepriseData, error: entrepriseError } = await supabase
        .from("entreprises")
        .select("*")
        .eq("id", currentProfil.entreprise_id)
        .maybeSingle();

      if (entrepriseError) {
        console.error("Erreur chargement entreprise :", entrepriseError);
        setEntreprise(null);
        return;
      }

      setEntreprise(
        entrepriseData ? (entrepriseData as EntrepriseRow) : null
      );
    },
    [supabase]
  );

  const applySession = useCallback(
    async (currentSession: Session | null) => {
      setSession(currentSession);

      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);

      await loadProfile(currentUser);
    },
    [loadProfile]
  );

  useEffect(() => {
    let active = true;

    async function initializeAuth() {
      try {
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (active) {
          await applySession(initialSession);
        }
      } catch (error) {
        console.error("Erreur initialisation Auth :", error);

        if (active) {
          clearAuthData();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void applySession(newSession).finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySession, clearAuthData, supabase]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    await applySession(data.session);

    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    clearAuthData();
  };

  return {
    user,
    session,
    profil,
    entreprise,
    loading,
    signIn,
    signOut,
    isAuthenticated: Boolean(user),
  };
}
