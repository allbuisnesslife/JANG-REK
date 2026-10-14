/**
 * Authentification locale (aucun serveur).
 *
 * - Profil : nom + objectif (/20) libre — pas limité à 15.
 * - PIN optionnel (4–6 chiffres) pour verrouiller l'accès sur cet appareil.
 * - Session : une fois connecté, l'utilisateur reste connecté jusqu'à « Se déconnecter ».
 * - Persistance : localStorage + indicateur de session dans sessionStorage.
 *
 * Sécurité : le PIN est haché côté client. Ce n'est PAS une sécurité serveur —
 * c'est un verrou local pour empêcher un accès accidentel.
 */

const AUTH_KEY = "abl-goal:auth:v1";
const SESSION_KEY = "abl-goal:session:v1";

export interface AuthProfile {
  name: string;
  /** Objectif de moyenne générale (/20), libre entre 0 et 20. */
  objective: number;
  /** PIN haché (optionnel). */
  pinHash?: string;
}

/** Hachage simple du PIN (dé-obfuscation locale, pas de cryptographie forte). */
export function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) {
    h = ((h << 5) + h + pin.charCodeAt(i)) >>> 0;
  }
  return `h${h.toString(36)}_${pin.length}`;
}

export function verifyPin(pin: string, hash: string): boolean {
  return hashPin(pin) === hash;
}

export function loadProfile(): AuthProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as AuthProfile;
    if (!p || typeof p.name !== "string" || !p.name.trim()) return null;
    const obj = Number(p.objective);
    return {
      name: p.name.trim(),
      objective: Number.isFinite(obj) ? Math.min(20, Math.max(0, obj)) : 15,
      pinHash: typeof p.pinHash === "string" && p.pinHash ? p.pinHash : undefined,
    };
  } catch {
    return null;
  }
}

export function saveProfile(profile: AuthProfile): void {
  try {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({
        name: profile.name.trim(),
        objective: Math.min(20, Math.max(0, Number(profile.objective) || 15)),
        pinHash: profile.pinHash,
      })
    );
  } catch {
    /* quota */
  }
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function isSessionActive(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function startSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function endSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Vrai si un profil existe et qu'aucun PIN n'est requis (connexion directe). */
export function needsLogin(profile: AuthProfile | null): boolean {
  if (!profile) return true; // pas de profil → écran de création
  if (profile.pinHash) return !isSessionActive(); // PIN requis à chaque nouvel onglet
  return false; // pas de PIN → accès direct
}
