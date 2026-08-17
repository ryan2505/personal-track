"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getSupabase, isAuthConfigured, signOut as doSignOut, toAuthUser, type AuthUser } from "./client";

interface AuthValue {
  /** `false` = pas de projet Supabase : l'application tourne en mode local sans connexion. */
  enabled: boolean;
  ready: boolean;
  user: AuthUser | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const enabled = isAuthConfigured();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabase();
    if (supabase === null) return;

    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const current = data.session?.user ?? null;
      setUser(
        current === null
          ? null
          : toAuthUser(current.id, current.email, current.user_metadata),
      );
      setReady(true);
    });

    // Couvre la déconnexion, l'expiration de session et le rafraîchissement de
    // jeton sans que chaque écran ait à s'en préoccuper.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = session?.user ?? null;
      setUser(
        current === null
          ? null
          : toAuthUser(current.id, current.email, current.user_metadata),
      );
      setReady(true);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [enabled]);

  const signOut = useCallback(async () => {
    await doSignOut();
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ enabled, ready, user, signOut }),
    [enabled, ready, user, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return value;
}
