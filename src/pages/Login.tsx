import { useState } from "react";
import {
  hashPin,
  loadProfile,
  saveProfile,
  startSession,
  verifyPin,
  type AuthProfile,
} from "../auth";
import { useActions } from "../store/store";

type Mode = "create" | "pin";

export default function Login({ onLogin }: { onLogin: (p: AuthProfile) => void }) {
  const profile = loadProfile();
  const actions = useActions();
  const [mode] = useState<Mode>(profile ? "pin" : "create");
  const [name, setName] = useState(profile?.name ?? "");
  const [objective, setObjective] = useState(String(profile?.objective ?? 15));
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinLogin, setPinLogin] = useState("");
  const [error, setError] = useState("");

  function enter(p: AuthProfile) {
    startSession();
    actions.setProfile({ name: p.name, objective: p.objective });
    actions.setObjective(p.objective);
    onLogin(p);
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const obj = Number(objective.replace(",", "."));
    if (!name.trim()) {
      setError("Indique ton prénom ou ton nom.");
      return;
    }
    if (!Number.isFinite(obj) || obj < 0 || obj > 20) {
      setError("L'objectif doit être un nombre entre 0 et 20.");
      return;
    }
    let pinHash: string | undefined;
    if (pinEnabled && pin) {
      if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
        setError("Le PIN doit contenir 4 à 6 chiffres.");
        return;
      }
      if (pin !== pin2) {
        setError("Les deux codes PIN ne correspondent pas.");
        return;
      }
      pinHash = hashPin(pin);
    }
    const p: AuthProfile = { name: name.trim(), objective: obj, pinHash };
    saveProfile(p);
    enter(p);
  }

  function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!profile?.pinHash) return;
    if (!verifyPin(pinLogin, profile.pinHash)) {
      setError("Code PIN incorrect.");
      return;
    }
    enter(profile);
  }

  function enterWithoutPin() {
    if (!profile) return;
    if (profile.pinHash) {
      setError("Ce profil est protégé par un PIN.");
      return;
    }
    enter(profile);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ABL-GOAL</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            « Chaque cours compte. Chaque note te fait progresser. »
          </p>
        </div>

        <div className="card">
          {mode === "create" ? (
            <>
              <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">
                Créer ton profil
              </h2>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Définis ton <strong>objectif de moyenne</strong> — libre entre 0 et 20, pas limité à 15.
              </p>
              <form onSubmit={submitCreate} className="space-y-4">
                <div>
                  <label className="label" htmlFor="login-name">
                    Prénom / nom
                  </label>
                  <input
                    id="login-name"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex. Awa"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label" htmlFor="login-obj">
                    Objectif de moyenne générale (/20)
                  </label>
                  <input
                    id="login-obj"
                    className="input"
                    inputMode="decimal"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="15"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Exemple : 12 pour une licence, 15 pour une mention, 18 pour une grande mention.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={pinEnabled}
                    onChange={(e) => setPinEnabled(e.target.checked)}
                  />
                  Ajouter un code PIN (optionnel)
                </label>

                {pinEnabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor="login-pin">
                        PIN (4–6 chiffres)
                      </label>
                      <input
                        id="login-pin"
                        className="input"
                        inputMode="numeric"
                        maxLength={6}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                        placeholder="1234"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="login-pin2">
                        Confirmer
                      </label>
                      <input
                        id="login-pin2"
                        className="input"
                        inputMode="numeric"
                        maxLength={6}
                        value={pin2}
                        onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
                        placeholder="1234"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                    {error}
                  </p>
                )}

                <button type="submit" className="btn-primary w-full">
                  Commencer
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">
                Bonjour {profile?.name}
              </h2>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Objectif : <strong>{profile?.objective}/20</strong>
              </p>

              {profile?.pinHash ? (
                <form onSubmit={submitPin} className="space-y-4">
                  <div>
                    <label className="label" htmlFor="pin-input">
                      Code PIN
                    </label>
                    <input
                      id="pin-input"
                      className="input text-center text-xl tracking-[0.4em]"
                      inputMode="numeric"
                      maxLength={6}
                      value={pinLogin}
                      onChange={(e) => setPinLogin(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••"
                      autoFocus
                    />
                  </div>
                  {error && (
                    <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                      {error}
                    </p>
                  )}
                  <button type="submit" className="btn-primary w-full" disabled={pinLogin.length < 4}>
                    Se connecter
                  </button>
                </form>
              ) : (
                <button className="btn-primary w-full" onClick={enterWithoutPin}>
                  Entrer
                </button>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Données enregistrées uniquement dans ce navigateur.
        </p>
      </div>
    </div>
  );
}
