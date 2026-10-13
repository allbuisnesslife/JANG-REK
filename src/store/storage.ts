import type { AppData } from "../types";

/**
 * Couche de persistance.
 *
 * Aujourd'hui : localStorage (prototype autonome, aucune clé côté client).
 * Demain : brancher Supabase (PostgreSQL + RLS) en implémentant `StorageAdapter`.
 * Aucune clé secrète ou clé de service ne doit jamais être écrite ici.
 */
/** Clé historique conservée pour ne pas perdre les données existantes de l'utilisateur. */
export const STORAGE_KEY = "geo-excellence:data:v1";

export interface StorageAdapter {
  load(): AppData | null;
  save(data: AppData): boolean;
  clear(): void;
}

export class LocalStorageAdapter implements StorageAdapter {
  load(): AppData | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AppData;
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.subjects)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  save(data: AppData): boolean {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false; // quota dépassé (souvent des PDF trop lourds)
    }
  }

  clear(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** Adaptateur placeholder pour une future synchronisation Supabase multi-appareils. */
export interface RemoteAdapter {
  push(data: AppData): Promise<void>;
  pull(): Promise<AppData | null>;
}

let adapter: StorageAdapter =
  typeof window !== "undefined" ? new LocalStorageAdapter() : memoryAdapter();

function memoryAdapter(): StorageAdapter {
  let mem: AppData | null = null;
  return {
    load: () => mem,
    save: (d) => {
      mem = d;
      return true;
    },
    clear: () => {
      mem = null;
    },
  };
}

export function getAdapter(): StorageAdapter {
  return adapter;
}

export function setAdapter(next: StorageAdapter) {
  adapter = next;
}
