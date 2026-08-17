import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase pour l'authentification.
 *
 * L'application doit rester utilisable sans projet Supabase : dans ce cas
 * `getSupabase()` renvoie `null` et l'application tourne en mode local, sans
 * connexion. C'est ce qui évite de casser une installation existante le jour où
 * on ajoute l'auth.
 */

let cached: SupabaseClient | null = null;

export function isAuthConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url !== undefined && url !== "" && key !== undefined && key !== "";
}

export function getSupabase(): SupabaseClient | null {
  if (!isAuthConfigured()) return null;
  if (cached !== null) return cached;

  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  );
  return cached;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

/** Messages d'erreur lisibles. Sans ça, l'écran affiche du jargon d'API. */
export function humanizeAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "Identifiant ou mot de passe incorrect.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Ce compte n'a pas encore été confirmé.";
  }
  if (normalized.includes("password should be at least")) {
    return "Le mot de passe est trop court.";
  }
  if (normalized.includes("same as the old password") || normalized.includes("should be different")) {
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Trop de tentatives. Réessaie dans quelques minutes.";
  }
  return message;
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const supabase = getSupabase();
  if (supabase === null) throw new Error("Authentification non configurée.");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error !== null) throw new Error(humanizeAuthError(error.message));
  if (data.user === null) throw new Error("Connexion impossible.");

  return toAuthUser(data.user.id, data.user.email, data.user.user_metadata);
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

/**
 * Changement de mot de passe.
 *
 * On revérifie l'ancien mot de passe avant de changer : Supabase ne l'exige pas,
 * mais une session laissée ouverte sur un appareil partagé permettrait sinon à
 * n'importe qui de verrouiller le compte de son propriétaire.
 */
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const supabase = getSupabase();
  if (supabase === null) throw new Error("Authentification non configurée.");

  const { error: checkError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (checkError !== null) {
    throw new Error("Mot de passe actuel incorrect.");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error !== null) throw new Error(humanizeAuthError(error.message));
}

/** Marque l'onboarding comme terminé côté serveur, pour le retrouver sur un autre appareil. */
export async function markOnboardingComplete(): Promise<void> {
  const supabase = getSupabase();
  if (supabase === null) return;

  const { data } = await supabase.auth.getUser();
  if (data.user === null) return;

  await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", data.user.id);
}

export function toAuthUser(
  id: string,
  email: string | undefined,
  metadata: Record<string, unknown> | undefined,
): AuthUser {
  const raw = metadata?.display_name;
  const fallback = (email ?? "").split("@")[0] ?? "";
  return {
    id,
    email: email ?? "",
    displayName: typeof raw === "string" && raw !== "" ? raw : fallback,
  };
}

/** Validation minimale, alignée sur le réglage par défaut de Supabase. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Au moins 8 caractères.";
  if (password.trim() === "") return "Mot de passe invalide.";
  return null;
}
