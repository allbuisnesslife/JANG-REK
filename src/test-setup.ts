/**
 * Polyfill localStorage/sessionStorage pour l'environnement de test Node.
 * Les tests utilisent environment: "node" — ces APIs n'existent pas nativement.
 */

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
}

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}

if (typeof globalThis.sessionStorage === "undefined") {
  Object.defineProperty(globalThis, "sessionStorage", {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}
