import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Maquette = lazy(() => import("./pages/Maquette"));
const Notes = lazy(() => import("./pages/Notes"));
const Moyennes = lazy(() => import("./pages/Moyennes"));
const Progression = lazy(() => import("./pages/Progression"));
const Revision = lazy(() => import("./pages/Revision"));
const Cours = lazy(() => import("./pages/Cours"));
const Objectifs = lazy(() => import("./pages/Objectifs"));
const Bilan = lazy(() => import("./pages/Bilan"));
const Parametres = lazy(() => import("./pages/Parametres"));

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3" role="status">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      <p className="text-sm text-slate-500 dark:text-slate-400">Chargement…</p>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/maquette" element={<Maquette />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/moyennes" element={<Moyennes />} />
          <Route path="/progression" element={<Progression />} />
          <Route path="/revision" element={<Revision />} />
          <Route path="/cours" element={<Cours />} />
          <Route path="/objectifs" element={<Objectifs />} />
          <Route path="/bilan" element={<Bilan />} />
          <Route path="/parametres" element={<Parametres />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
