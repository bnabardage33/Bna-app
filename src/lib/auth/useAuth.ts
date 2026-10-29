"use client";

import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { EntrepriseRow, ProfilRow } from "@/types/database.types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profil, setProfil] = useState<ProfilRow | null>(null);
  const [entreprise, setEntreprise] = useState<EntrepriseRow | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Charger le profil
          const { data: profilData } = await supabase
            .from("profils")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profilData) {
            setProfil(profilData as ProfilRow);

            // Charger l'entreprise
            const { data: entData } = await supabase
              .from("entreprises")
              .select("*")
              .eq("id", (profilData as ProfilRow).entreprise_id)
              .maybeSingle();

            if (entData) {
              setEntreprise(entData as EntrepriseRow);
            }
          }
        }
      } catch (err) {
        console.warn("Auth initialization note:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session?.user) {
          setProfil(null);
          setEntreprise(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.error) throw res.error;
    return res.data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfil(null);
    setEntreprise(null);
  };

  return {
    user,
    session,
    profil,
    entreprise,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };
}
