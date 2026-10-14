import { Suspense, type ComponentType } from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AppProvider, __resetState } from "./store/store";
import { createInitialState, createDemoState } from "./store/initialState";
import { saveProfile, startSession, clearProfile } from "./auth";

import Dashboard from "./pages/Dashboard";
import Maquette from "./pages/Maquette";
import Notes from "./pages/Notes";
import Moyennes from "./pages/Moyennes";
import Progression from "./pages/Progression";
import Revision from "./pages/Revision";
import Cours from "./pages/Cours";
import Objectifs from "./pages/Objectifs";
import Bilan from "./pages/Bilan";
import Parametres from "./pages/Parametres";

const PAGES: [string, ComponentType][] = [
  ["/", Dashboard],
  ["/maquette", Maquette],
  ["/notes", Notes],
  ["/moyennes", Moyennes],
  ["/progression", Progression],
  ["/revision", Revision],
  ["/cours", Cours],
  ["/objectifs", Objectifs],
  ["/bilan", Bilan],
  ["/parametres", Parametres],
];

function renderPage(Page: ComponentType) {
  return renderToString(
    <MemoryRouter>
      <AppProvider>
        <Suspense fallback={<span>loading</span>}>
          <Page />
        </Suspense>
      </AppProvider>
    </MemoryRouter>
  );
}

describe("Rendu de toutes les pages (aucune erreur d'exécution)", () => {
  beforeEach(() => {
    clearProfile();
    saveProfile({ name: "Test", objective: 15 });
    startSession();
  });

  for (const [route, Page] of PAGES) {
    it(`rend ${route}`, () => {
      const html = renderPage(Page);
      expect(html.length).toBeGreaterThan(500);
      expect(html).not.toMatch(/is not a function|Cannot read prop/);
    });
  }

  it("l'application racine s'affiche (nom, slogan, navigation)", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/"]}>
        <AppProvider>
          <App />
        </AppProvider>
      </MemoryRouter>
    );
    expect(html).toContain("ABL-GOAL");
    expect(html).toContain("Chaque cours compte");
    expect(html).toContain("Tableau de bord");
  });

  it("l'écran de connexion s'affiche sans profil", () => {
    clearProfile();
    const html = renderToString(
      <MemoryRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </MemoryRouter>
    );
    expect(html).toContain("Créer ton profil");
    expect(html).toContain("pas limité à 15");
  });

  it("signale des données insuffisantes sans aucune note", () => {
    __resetState(createInitialState(false));
    expect(renderPage(Moyennes)).toMatch(/Données insuffisantes|Aucune moyenne calculable/i);
    expect(renderPage(Dashboard)).toMatch(/Aucune note enregistrée/i);
    expect(renderPage(Progression)).toMatch(/Pas encore de courbe/i);
  });

  it("génère des alertes à partir des données de démonstration", () => {
    __resetState(createDemoState());
    const html = renderPage(Progression)
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/&#x27;|&apos;/g, "'");
    expect(html).toMatch(/Niveau (vert|orange|rouge)/i);
    expect(html).toMatch(/Plan d'action/);
    expect(html).toMatch(/Évaluations responsables/);
  });
});
