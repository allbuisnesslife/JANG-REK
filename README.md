# ABL-GOAL

**« Chaque cours compte. Chaque note te fait progresser. »**

Assistant web personnel de réussite en **Licence 2 Géomatique** (Sénégal) : saisie des notes,
moyennes pondérées en temps réel, graphiques de progression, alertes de baisse, organisation
quotidienne de la révision (2 h 15/jour) et bilan hebdomadaire.

Application **100 % fonctionnelle** : formulaires, calculs, graphiques, filtres, sauvegardes et
exports agissent réellement sur tes données — aucune interface factice.

---

## 1. Installation

Prérequis : **Node.js ≥ 18** et **npm ≥ 9**.

```bash
npm install
npm run dev        # serveur de développement → http://localhost:5173
```

Autres commandes :

| Commande            | Rôle                                        |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Lancer le site en local                      |
| `npm run build`     | Vérifier les types TypeScript + build `dist/` |
| `npm run preview`   | Prévisualiser le build de production         |
| `npm run typecheck` | Vérification des types seule                 |
| `npm test`          | Tests unitaires (Vitest)                     |

## 2. Déploiement

Le site est une application **statique** (aucun backend obligatoire).

```bash
npm run build      # génère dist/
```

Puis dépose le dossier `dist/` sur :

- **Vercel** : framework *Vite*, commande de build `npm run build`, sortie `dist`
- **Netlify** : build `npm run build`, publish directory `dist`
- **GitHub Pages / tout hébergeur statique** : important de configurer le *rewrite* de toutes les
  routes vers `index.html` (l'application utilise React Router).

Pour le développement mobile (connexion modeste) : `npm run dev -- --host` puis ouvre
`http://<ip-de-ton-pc>:5173` sur ton téléphone Android (même Wi-Fi).

---

## 3. Architecture

```
src/
├── types.ts               # Modèle de données (évaluations, séances, documents, alertes…)
├── data/maquette.ts       # Maquette L2 Géomatique (S3 + S4), matières et sous-matières
├── lib/
│   ├── calc.ts            # Normalisation /20, moyennes pondérées, agrégations
│   ├── alerts.ts          # Détection des baisses (vert/orange/rouge)
│   ├── goals.ts           # Notes nécessaires, meilleur maximum atteignable, bilan hebdo
│   ├── csv.ts             # Export CSV
│   ├── format.ts          # Formatage FR (notes, dates, durées)
│   └── id.ts              # Générateurs d'identifiants et de dates
├── store/
│   ├── storage.ts         # Couche de persistance (StorageAdapter → localStorage)
│   ├── initialState.ts    # État par défaut + jeu de démonstration (isDemo)
│   ├── store.tsx          # État global, actions, persistance automatique, toasts
│   └── computed.ts        # Valeurs dérivées mémorisées (moyennes, alertes, projections)
├── components/
│   ├── Layout.tsx         # Sidebar desktop, tiroir mobile, barre basse, thème clair/sombre
│   └── ui.tsx             # Cartes, statistiques, modales, badges, toasts, barres
└── pages/                 # Les 10 pages de l'application
```

**Stack** : React 18 · TypeScript · Vite · Tailwind CSS · Recharts · React Router · Vitest.

### Persistance des données

- Sauvegarde **automatique à chaque modification** dans `localStorage`
  (clé `geo-excellence:data:v1`) : tes notes survivent à un rafraîchissement et à la fermeture
  du navigateur.
- **Export / import JSON** dans *Paramètres* pour changer de téléphone ou de navigateur.
- **Export CSV** des notes (*Mes notes* et *Paramètres*).
- La couche `src/store/storage.ts` expose une interface `StorageAdapter` : il suffit d'écrire un
  adaptateur Supabase pour synchroniser les appareils, sans toucher au reste du code.
- **Données de démonstration** identifiables (`isDemo`, bandeau ambre) : supprimées en un clic,
  et automatiquement purgées à ta première saisie réelle pour ne jamais être mélangées avec tes
  vraies notes.

### Sécurité

- Aucune clé secrète, aucun token, aucune clé de service dans le frontend.
- Aucun mot de passe stocké : l'application fonctionne sans compte.
- Pour la synchronisation : voir le §6 (Supabase + RLS).

---

## 4. Règles de calcul

### Note normalisée

```
note_sur_20 = note_obtenue / note_maximale × 20
```

Toute note dont la note maximale diffère de 20 est convertie automatiquement.

### Moyenne d'une matière

```
Moyenne = Σ(note_sur_20 × coefficient_évaluation) / Σ(coefficient_évaluation)
```

- **UE multi-EC** (ex. GMT 1305) : chaque note est rattachée à un **élément constitutif**
  (Physique TD, Mécanique spatiale, Traitement du signal…). L'UE n'est complète que lorsque
  **chaque EC a au moins une note** ; sinon moyenne provisoire des EC déjà notés + liste des manquants.
  Moyenne UE = moyenne **à poids égaux** des moyennes d'EC.
- **Sans règle officielle renseignée** → *moyenne pondérée provisoire*, clairement signalée.
- **Module sans contrôle continu** (case « Sans CC » dans *Paramètres* ou à la saisie d'une note)
  → `moyenne = note d'examen` (moyenne **officielle**).
- **Avec une règle CC/Examen activée** (Paramètres) et des évaluations étiquetées →
  `moyenne = (moyenne_CC × poids_CC + moyenne_Examen × poids_Examen) / (poids_CC + poids_Examen)`
  et la moyenne devient **officielle**.
- **0 évaluation** → `données insuffisantes` (aucune moyenne affichée).

### Agrégations (UE, semestre, année)

Moyenne pondérée par les **coefficients de matière** (maquette officielle UIDT, confirmée).
Tant qu'un coefficient édité manuellement n'est pas marqué « confirmé » dans *Ma maquette*,
l'agrégation reste **provisoire**. Les **crédits ECTS ne sont jamais utilisés comme
coefficients** de moyenne.

### Moyenne reçue ≠ moyenne finale

- **Moyenne sur les notes reçues** : ce que tu as aujourd'hui.
- **Moyenne finale à viser** : calculée à partir des *évaluations restantes* que tu déclares dans
  *Mes objectifs* :
  `note_restante = (objectif × poids_total − somme_reçue) / poids_restant`
  - `note_restante > 20` → l'objectif est déclaré **impossible** et l'application calcule la
    **meilleure moyenne finale encore accessible** :
    `(somme_reçue + 20 × poids_restant) / poids_total`
  - `note_restante ≤ 0` → objectif **déjà assuré**
  - aucune évaluation restante déclarée → `non déterminable` (aucune hypothèse inventée).

### Alertes de baisse

| Niveau  | Déclencheur                                                        |
| ------- | ------------------------------------------------------------------ |
| 🟢 vert  | stable ou progression ≥ 1 point entre deux périodes                |
| 🟠 orange | baisse ≥ `dropModeratePoints` (1 pt) ou moyenne < 12/20 persistante |
| 🔴 rouge | baisse ≥ `dropAlertPoints` (2 pts) ou difficulté persistante       |

- Comparaison entre **deux périodes de ≥ 2 évaluations**, soit **≥ 4 évaluations** au minimum :
  **aucune alerte n'est déclenchée à partir d'une note isolée.**
- Chaque alerte affiche : matière, moyenne précédente, moyenne actuelle, ampleur, évaluations
  responsables, notions à réviser (issues de tes séances de révision et commentaires réels) et un
  plan d'action calculé à partir de tes données.
- Tous les seuils sont modifiables dans **Paramètres**.

### Tests

```bash
npm test
```

52 tests couvrent : normalisation /20, moyennes pondérées, règles CC/Examen, agrégations,
sécurité contre les fausses alertes, détection des baisses, notes nécessaires, objectifs
impossibles, et le rendu de toutes les pages.

---

## 5. Les 10 pages

1. **Tableau de bord** — moyenne actuelle, objectif, S3/S4, matières maîtrisées / à surveiller /
   prioritaires, dernières notes, prochains examens, temps de révision, 3 actions prioritaires.
2. **Ma maquette** — matières S3 et S4, sous-matières, UE, coefficients et crédits issus de la
   maquette officielle (S3 : 26 coef / 30 ECTS ; S4 : 23 coef / 30 ECTS), modifiables si besoin.
3. **Mes notes** — CRUD complet, validation, filtres (semestre, matière, type, période), export
   CSV, calcul immédiat sans rechargement.
4. **Mes moyennes** — par matière, par UE, par semestre, par année + tableau des notes à viser.
5. **Ma progression** — 5 graphiques (évolution générale, courbes par matière, comparaison des
   moyennes, moyennes vs objectifs, résultats par semestre) + alertes détaillées.
6. **Réviser aujourd'hui** — chronomètre Pomodoro (45 min de cours : 25 + 5 + 15 ; 90 min
   d'exercices : 30 + 40 + 20), formulaire de séance, tâches cochables et déplaçables, suggestion
   de reprise quand aucun cours n'a été dispensé.
7. **Mes cours** — cours, fiches, formules, définitions, PDF (≤ 1,5 Mo), recherche, classement,
   mode révision à réponses masquées, séances liées.
8. **Mes objectifs** — objectif général/semestre/matière, temps hebdomadaire, réussite aux
   exercices, évaluations restantes et projections.
9. **Bilan hebdomadaire** — progression, baisses, chapitres non maîtrisés, temps travaillé,
   exercices réussis/échoués, 3 priorités (navigation par semaine).
10. **Paramètres** — thème, seuils d'alerte, règles CC/Examen par matière, coefficients, export /
    import JSON, CSV, démo, suppression totale.

---

## 6. Migration vers Supabase (optionnel)

Aucune base de données n'est nécessaire pour utiliser le site. Si tu veux synchroniser tes
données entre appareils :

1. Crée un projet sur [supabase.com](https://supabase.com).
2. **Ne place jamais la clé `service_role` dans le frontend** — utilise uniquement la clé *anon*
   publique et les identifiants OAuth/Email fournis par Supabase.
3. Crée les tables :

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  objective numeric default 15,
  created_at timestamptz default now()
);

create table subjects (
  id text not null,
  user_id uuid not null references auth.users on delete cascade,
  code text not null,
  name text not null,
  semester text not null check (semester in ('S3','S4')),
  ue text,
  ue_confirmed boolean default false,
  coefficient numeric default 1,
  coefficient_confirmed boolean default false,
  credits numeric,
  credits_confirmed boolean default false,
  disabled boolean default false,
  primary key (user_id, id)
);

create table evaluations (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  subject_id text not null,
  semester text not null,
  name text not null,
  type text not null,
  score numeric not null,
  max_score numeric not null default 20,
  coefficient numeric not null default 1,
  date date not null,
  comment text,
  rule_group text check (rule_group in ('cc','examen')),
  created_at timestamptz default now()
);

create table revision_sessions (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  subject_id text not null,
  date date not null,
  chapter text, summary text, definitions text, difficulties text,
  exercises_to_do text, exercises_done int default 0,
  exercises_failed int default 0, duration_min int default 0,
  document_id text
);

create table documents (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  title text not null, kind text not null, semester text,
  subject_id text, chapter text, content text,
  created_at timestamptz default now()
);
```

4. Active **RLS** sur chaque table : chaque utilisateur ne lit et ne modifie que ses lignes.

```sql
alter table evaluations enable row level security;

create policy "lecture perso" on evaluations
  for select using (auth.uid() = user_id);
create policy "écriture perso" on evaluations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

(Répéter les deux politiques pour `subjects`, `revision_sessions`, `documents`, `tasks`.)

5. Implémente l'interface `RemoteAdapter` de `src/store/storage.ts` avec
   `@supabase/supabase-js` et le couple `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   (variables d'environnement publiques, jamais de clé secrète).

---

## 7. Données de démonstration

Au premier lancement, un jeu d'exemple (notes, séances, documents, tâches) est chargé pour
démontrer les calculs, les graphiques et les alertes. Il est :

- signalé par un **bandeau ambre** en haut de chaque page,
- **supprimé automatiquement** à ta première vraie saisie,
- supprimable manuellement via le bandeau ou *Paramètres → Tout supprimer*.

---

## 8. Limites assumées

- Les **coefficients et crédits de la maquette** sont ceux de la maquette officielle L2 Géomatique
  fournie (UIDT / UFR SI). Une modification manuelle non re-confirmée est signalée dans *Ma maquette*.
- Sans **évaluation restante déclarée**, la note à obtenir au prochain examen est affichée comme
  *non déterminable* plutôt que d'être estimée.
- Les PDF sont stockés en base64 dans le navigateur : limite ~1,5 Mo.
- Le calcul de moyenne annuelle n'apparaît que lorsque les deux semestres sont évalués.
