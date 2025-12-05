# Audit final – Backoffice Chefito

_Date de l’audit :_ <!-- à compléter -->  
_Auteur :_ Cosine / Genie (audit automatisé basé sur le code du repo)

---

## 1. Résumé exécutif

**Score global qualité code : _8.0 / 10_**

Le backoffice Chefito est globalement **bien structuré, typé, sécurisé et cohérent** :

- Il est conçu comme un **outil interne** dont l’objectif principal est de **préparer et enrichir les recettes pour un système RAG** (et, indirectement, pour le site public).
- En pratique, il est prévu pour être **utilisé par un admin unique** (ou un très petit nombre d’admins), même si le modèle `user_profiles.role` permettrait d’introduire un rôle `editor` ultérieurement.

- Architecture claire : séparation `app` (admin recettes enrichies) / `pages` (legacy), `lib`, `hooks`, `components`.
- **TypeScript strict** (aucun `tsc` error), Zod utilisé sur tous les formulaires critiques.
- **ESLint (next/core-web-vitals)** : 0 erreurs/avertissements.
- **CI GitHub Actions** : lint + typecheck + build + audit + CodeQL dans un workflow unique.
- Sécurité des opérations sensibles (fusion de recettes) significativement durcie :
  - Auth Supabase + contrôle `user_profiles.role = 'admin'` avant toute fusion.
  - Service role strictement côté serveur.

Les principaux **points d’attention avant production** :

1. **RLS / policies Supabase** : le code suppose une RLS stricte, mais le repo ne peut pas vérifier la configuration du projet Supabase.  
   → À valider impérativement dans Supabase avant mise en prod.
2. **Tests automatisés** : quasiment **aucun test** (unitaires ou E2E) → risque de régression élevé sur les flux critiques (recettes, fusion, import CSV).
3. **Prettier** : le formatage n’est pas encore uniformisé sur tout le repo (format:check désactivé en CI pour ne pas casser l’existant), même si Husky+lints-staged garantissent la propreté des nouveaux commits.

---

## 2. Scores par dimension

| Dimension                         | Score (/10) | Commentaire synthétique                                                                 |
|----------------------------------|-------------|-----------------------------------------------------------------------------------------|
| Conventions & structure          | 9           | Nommage cohérent, structure lisible, composants bien découpés                          |
| TypeScript                       | 8.5         | Typage strict, quelques `any` localisés (intégrations / parsing)                       |
| React (hooks, composants)        | 8.5         | Règles hooks respectées, usage propre de React Query, UI claire                        |
| Performance & data fetching      | 8           | Pagination serveur, React Query, index SQL dédiés                                      |
| Sécurité (code + Supabase)       | 8.5         | Modèle supabaseClient/supabaseAdmin sain, fusion protégée, bons réflexes env/secrets   |
| UX/UI admin                      | 8           | States de chargement, erreurs lisibles, actions critiques confirmées                   |
| Tests & qualité continue         | 5           | CI solide sur lint/TS/build/audit, mais absence de tests fonctionnels & E2E            |

---

## 3. Audit détaillé par axe

### A) Conventions & bonnes pratiques

**Constats positifs**

- **Nommage**
  - Composants React : `PascalCase` (`AdminShell`, `RecipeStepsEditor`, etc.).
  - Hooks : `useXxx` (`useAuth`, `usePermissions`, `useIntegrations`).
  - Fonctions / variables : `camelCase`.
  - Fichiers de pages App Router : `page.tsx` sous des segments kebab-case (`editorial-calendar`, `knowledge`, etc.).
- **Structure des dossiers**
  - `src/app/admin/*` : nouvelles vues admin (App Router), bien segmentées par domaine (recipes, audio, knowledge, editorial-calendar…).
  - `src/pages/*` : backoffice historique, bien isolé.
  - `src/lib/*` : logique métier/utilitaires (`dashboard`, `search`, `seo`, `supabaseClient`, `supabaseAdmin`, etc.).
  - `src/components/admin/*` : composants réutilisables pour l’admin (ingrédients, steps, concepts).
  - `sql/*` : scripts SQL documentés.
- **Imports**
  - Ordre globalement cohérent : React/Next, libs, `@/lib`, `@/components`.
  - Pas d’imports circulaires évidents.
- **Découpage composants**
  - Éditeurs spécifiques extraits (`RecipeIngredientsEditor`, `RecipeStepsEditor`, `RecipeConceptsEditor`, `StepEditor`).
  - Pages admin restent longues mais lisibles, avec logique métier localisée.
- **Commentaires**
  - Peu de bruit, commentaires pertinents (notamment en sécurité et stockage).

**Points perfectibles**

- **Duplication de logique de qualité éditoriale (corrigée)**  
  - La logique de complétude (`getRecipeMissingFields`) était initialement dupliquée entre la liste et l’éditeur de recettes.  
  - ✅ Elle a été **factorisée dans `src/lib/recipesQuality.ts`** et réutilisée par :
    - `src/app/admin/recipes/page.tsx`
    - `src/app/admin/recipes/[id]/edit/page.tsx`
  - Le module expose également `computePrePublishIssues`, utilisé pour le blocage pre‑publish.
- **TODOs**
  - Centralisés dans `TODO.md`, ce qui est bien.
  - Pas de `// TODO` dispersés dans le code → bonne discipline.

---

### B) TypeScript

**Points forts**

- `tsconfig.json` correctement configuré (strict enough pour ce projet).
- `recipeSchema`, `articleSchema`, `signInSchema` typés via Zod + `z.infer`.
- Interfaces explicites pour la plupart des données métier :
  - `AdminRecipe`, `EditorialCalendarRow`, `KnowledgeConcept`, `AudioLibraryRow`, `AudioMappingRow`, etc.
- **Aucune erreur TypeScript** en CI (`tsc --noEmit`).

**`any` repérés (non critiques)**

- `src/lib/dashboard.ts` : usage de `any` pour les stats d’intégrations (Redis, S3, Vault).
  - Contexte : réponses JSON de fonctions Supabase invocables, structure flexible.
- `src/lib/search.ts`, `src/lib/integrations.ts` : cast `as any` pour des payloads externes.
- `supabaseClient` / `supabaseAdmin` : `as any` dans le `Proxy` de garde pour lever une erreur explicite si non configurés.
- Quelques handlers d’erreurs (`onError: (err: any) => ...`) dans :
  - `/admin/knowledge`, `/admin/audio`, import CSV, etc.

**Analyse / recommandations**

- Les usages de `any` sont **localisés et motivés** (interfaces externes, erreurs génériques).
- ✅ Aucun `any` “structurel” sur les modèles métiers (recettes, concepts, etc.).
- ✅ Recommandation (nice-to-have) : typage léger des réponses Redis/S3/Vault dans `dashboard.ts` pour éviter `any` (interfaces `RedisStats`, `S3Stats`, `VaultStats`).

---

### C) React Best Practices

**Hooks & règles**

- `next lint` (core-web-vitals) passe sans warning :
  - Règles hooks respectées (`useQuery`, `useMutation`, `useEffect`, `useMemo`).
- Avertissements `react-hooks/exhaustive-deps` précédemment présents ont été corrigés (notamment dans `editorial-calendar/page.tsx` en encapsulant `items` dans un `useMemo`).

**useEffect / useMemo**

- Autoremplissage SEO et champs dérivés géré proprement :
  - `watch` + `useEffect` pour `meta_title`, `meta_description`, `canonical_url`, `og_image_url`, `difficulty_detailed`.
- `useMemo` utilisé pour :
  - filtrer / transformer les listes (recipes + RAG, calendrier éditorial),
  - limiter les recalculs sur des agrégats (counts, filteredItems, sortedAlerts).

**Listes / keys**

- Toutes les `map` importantes (recettes, concepts, ingrédients, steps, calendrier) utilisent des `key` stables (`id` ou `concept_key`).
- Pas de `index` brut utilisé comme key dans les listes critiques.

**State management**

- State local (via `useState`) bien cantonné à chaque page.
- React Query utilisé comme **source de vérité pour les données** (backend), avec invalidation (`invalidateQueries`) après mutations.
- `zustand` est présent comme dépendance, mais peu visible dans l’admin App Router → pas de sur-utilisation non contrôlée.

---

### D) Performance

**Data fetching**

- `React Query` partout en admin :
  - Gestion automatique des states `loading`, `error`, `success`.
  - `keepPreviousData` utilisé sur les listes paginées pour éviter les flickers (`recipes`, `editorial-calendar`…).
- **Pagination côté serveur**
  - `/admin/recipes` : page de 50 recettes, `select` avec `count: "exact"` + `range(from, to)`.
  - `/admin/editorial-calendar` : limit 250.
  - Dashboard : queries agrégées (count) plutôt que gros fetchs.

**SQL & index**

- Fichier `sql/indexes_recipes.sql` pour indexer les colonnes les plus filtrées (status, difficulty, category, cuisine, slug, created_at).
- Tout le code DB passe par `supabase-js` (pas de SQL string concat).

**Code splitting**

- App Router → splitting par route automatiquement (chaque page admin est un chunk).
- Pas d’usage massif de `dynamic()` mais l’admin n’est pas orienté grand public → acceptable pour un outil interne.

**Améliorations possibles**

- Définir un `staleTime` non nul pour les données quasi-statiques :
  - listes de catégories / cuisines, knowledge base, audio library.
- Ajouter un léger debounce sur les champs de recherche plein texte si nécessaire (actuellement acceptable).

---

### E) Sécurité (re-check)

**Points forts**

- **Clients Supabase séparés** :
  - `supabase` (anon key, côté client, RLS).
  - `supabaseAdmin` (service role, côté serveur uniquement, sans persistance de session).
- **Route critique `/api/recipes/merge`** :
  - Zod sur le body (uuid).
  - Validation du JWT via `supabaseAdmin.auth.getUser(token)`.
  - Vérification `user_profiles.role === 'admin'`.
  - Réponse 401/403 claire.
- **Uploads sécurisés :**
  - validation MIME + taille (`image/*` ≤ 5 Mo, `audio/*` ≤ 20 Mo).
  - chemins de stockage normalisés via `generateSlug`.
- **Secrets & env :**
  - `.env.example` documenté, `.env` ignoré par Git.
  - Service role jamais utilisé côté client.
- **Pre-publish blocking** :
- empêche la publication d’une recette incomplète (critères éditoriaux/SEO + contraintes RAG minimales).

**Points de vigilance**

- **RLS Supabase**
  - Le repo documente des policies attendues (`SECURITY.md`, `sql/editorial_calendar.sql`), mais ne peut pas vérifier que **toutes** les tables en prod sont bien configurées.
  - ⛔ **Critique avant prod** : revoir toutes les policies RLS dans Supabase (recipes, ingredients, steps, concepts, audio, alerts, editorial_calendar, user_profiles…).
- **CSRF**
  - Les API sensibles (merge) reposent sur un header `Authorization: Bearer <access_token>` fourni par le client JS, ce qui protège déjà bien contre CSRF (un site externe ne peut pas lire le token Supabase).
  - Pas de mécanisme CSRF additionnel (token anti-CSRF), mais acceptable ici compte tenu du modèle d’auth (token explicite).
- **XSS**
  - Les contenus riches (Tiptap, champs texte) sont stockés puis réaffichés.
  - Côté admin, c’est supposé être du contenu “trusted editors”; sur le front public il faudra s’assurer d’un rendu sécurisé (`dangerouslySetInnerHTML` avec sanitize si besoin).

---

### F) UX / UI Admin

**Points positifs**

- **Loading states** présents partout :
  - `LoadingSpinner` en dashboard, listes, import CSV, knowledge, audio, recettes, alerts.
- **Errors user-friendly**
  - Messages textuels (rouge) pour les erreurs de chargement et d’action.
  - Détails affichés pour les erreurs d’import CSV ou de mutation.
- **Success feedback**
  - Messages de succès après création/mise à jour/suppression (knowledge, recettes, import CSV).
- **Actions destructives**
  - `window.confirm` sur suppression de recette et suppression de concept.
  - Fusion de recettes limitée au rôle admin.
- **Navigation**
  - Sidebar admin (`AdminSidebar`) claire, sections par domaine.
  - Boutons de retour aux listes, liens cohérents sur les titres d’éléments.
- **Responsive**
  - Layout basé sur Tailwind, classes `md:*` bien utilisées.
  - Tableaux scrollables, colonnes adaptatives.
- **Prévisualisation front depuis l’admin**
  - Une page dédiée `/admin/recipes/[id]/preview` permet désormais d’ouvrir un iframe vers `/recipes/[id]` pour vérifier rapidement le rendu public de la recette, directement depuis l’admin.

**Améliorations possibles**

- Ajouter des **notifications non-blockantes** (toasts) pour les succès/erreurs fréquentes, au lieu de simples paragraphes (améliore la visibilité).

---

### G) Tests & Qualité

**État actuel**

- Pas de tests unitaires / d’intégration présents dans ce repo (`__tests__`, Jest, Vitest…).  
  → La qualité est aujourd’hui assurée principalement par :
  - TypeScript strict,
  - ESLint,
  - CI complète (lint, typecheck, build, npm audit, CodeQL).
- En pratique, le backoffice est utilisé par **un admin unique** pour préparer les données RAG, ce qui réduit un peu le risque d’erreurs massives, mais ne remplace pas des tests automatisés.

**Recommandations prioritaires**

1. **E2E smoke tests (Playwright/Cypress)** sur :
   - Connexion + accès `/admin`.
   - Création + édition + publication d’une recette (incluant pre-publish blocking).
   - Import CSV éditorial (cas succès + erreurs).
   - Fusion de recettes (admin vs non-admin).
2. **Tests unitaires ciblés** :
   - `getRecipeMissingFields`, `computePrePublishIssues`,
   - `buildRecipeJsonLd` + `validateRecipeJsonLd`,
   - helpers d’import CSV (`parseCsv`, `buildImportRows`).

---

## 4. Fixes critiques à faire MAINTENANT

1. **Vérification RLS complète dans Supabase**
   - S’assurer que toutes les tables sensibles ont RLS activé.
   - Appliquer des policies correspondant à `SECURITY.md` :
     - lecture : rôle `admin` + `editor`,
     - écriture : `admin` (et éventuellement `editor` sur `recipes`).
2. **Revue finale des env vars en prod**
   - Vérifier que `SUPABASE_SERVICE_ROLE_KEY` est uniquement injectée côté serveur (ex: Vercel project env) et jamais côté client.
   - Vérifier que les env de prod/staging utilisent bien des bases séparées.
3. **Tests manuels complets des flux critiques**
   - Recette create/edit/publish (avec validation pre-publish).
   - Import CSV éditorial.
   - Fusion de recettes (bon rôle / mauvais rôle).
   - Upload image/audio.
4. **Monitoring & logs**
   - Brancher un outil type **Sentry** ou équivalent pour les erreurs runtime.
   - S’assurer que les logs de fusion (au moins consoles) sont visibles en environnement de prod.

---

## 5. Améliorations “nice-to-have” (priorisées)

### Haute priorité (après les fixes critiques)

1. **Intégration front JSON-LD**
   - Consommer `schema_jsonld_enabled` et `buildRecipeJsonLd` sur le site public.
   - Injecter `<script type="application/ld+json">` par recette.
2. **Tests E2E de base**
   - 3–5 scénarios de bout en bout suffisent pour commencer.
3. **Refactor logique de qualité éditoriale**
- Extraire `getRecipeMissingFields` et `computePrePublishIssues` dans un module partagé pour garantir l’alignement.

### Priorité moyenne

4. **Robustifier l’import CSV éditorial**
   - Utiliser une lib de parsing (Papaparse) pour mieux gérer les cas tordus (guillemets, virgules).
   - Proposer un export des lignes en erreur.
5. **UX calendrier éditorial**
   - Drag & drop en vue Kanban pour changer le statut.
   - Edition inline de `chefito_angle` / tags.

### Priorité basse

6. **Audit trail**
   - Table `admin_audit_log` pour tracer fusions, suppressions, changements de statuts.
7. **Rate limiting infra**
   - Limiter `/api/recipes/merge` et futures routes d’admin via le reverse proxy / WAF.
8. **Typage des intégrations**
   - Si les intégrations Redis/S3/Vault sont réactivées à l'avenir, ajouter des types légers pour leurs stats dans `dashboard.ts`. Dans la version actuelle, le dashboard ne dépend plus de ces fonctions.

---

## 6. Conclusion

Le backoffice Chefito est **globalement prêt pour un déploiement en production**, à condition de :

- valider le **setup Supabase (RLS, env vars)** dans l’environnement cible ;
- exécuter une **batterie de tests manuels** sur les principaux flux ;
- mettre en place au moins un **monitoring d’erreurs** minimal (Sentry ou équivalent).

Les améliorations restantes concernent davantage la **robustesse long terme** (tests, audit trail, UX avancée) que la correction de bugs bloquants.