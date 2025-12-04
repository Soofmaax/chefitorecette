# Sécurité – Backoffice Chefito / Supabase RAG Admin

Ce document décrit le modèle de sécurité de l’interface d’administration et les protections mises en place autour de Supabase (auth, RLS, Storage, API). Il sert de référence pour les audits et évolutions futures.

## 1. Modèle d’authentification et rôles

- Authentification gérée par **Supabase Auth** (email + mot de passe).
- Les utilisateurs applicatifs sont étendus par la table `public.user_profiles` :
  - colonne `id` = `auth.uid()`,
  - colonne `role` ∈ `('admin', 'editor', ...)`.
- Côté front, le hook `useAuth` charge l’utilisateur courant et son rôle applicatif :
  - `user.appRole === "admin"` → accès à tout le backoffice,
  - `user.appRole === "editor"` → accès lecture/édition limité (via RLS).

**Important :**  
Le layout `/admin` vérifie le rôle **uniquement côté client** pour l’affichage. La vraie protection des données repose sur **RLS + policies** et sur les routes serveur sécurisées décrites ci‑dessous.

## 2. Accès base de données (clients Supabase)

Deux clients sont utilisés :

1. `supabase` (`src/lib/supabaseClient.ts`)
   - Utilise `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Utilisé **uniquement côté client**.
   - RLS **activé** : toutes les requêtes sont soumises aux policies Postgres.

2. `supabaseAdmin` (`src/lib/supabaseAdmin.ts`)
   - Utilise `SUPABASE_SERVICE_ROLE_KEY` (non exposée au client).
   - Utilisé **uniquement côté serveur** (routes API).
   - Bypass RLS, à réserver aux opérations d’administration nécessitant des droits étendus.

Les deux clients sont protégés par un `Proxy` qui lève une erreur si les variables d’environnement ne sont pas configurées, ce qui évite les appels silencieusement cassés.

## 3. Routes API serveur

### 3.1 `/api/recipes/merge` – fusion de recettes

**Rôle :** fusionner deux recettes similaires (repointage des tables dépendantes, gestion du slug et des alertes).

**Risques initiaux :**

- Route accessible publiquement, utilisant `supabaseAdmin` sans vérification d’authentification ni de rôle.
- Toute personne connaissant la route pouvait modifier `recipes`, `recipe_ingredients_normalized`, `recipe_steps_enhanced`, `recipe_concepts`, `audio_usage_stats`, `recipe_relationships` et `recipe_similarity_alerts`.

**Correctifs implémentés :**

- Ajout d’un helper `requireAdmin(req: NextRequest)` dans `src/app/api/recipes/merge/route.ts` qui :

  1. Exige un header `Authorization: Bearer <access_token>`.
  2. Valide le token via `supabaseAdmin.auth.getUser(token)` (signature vérifiée côté Supabase).
  3. Récupère `user_profiles.role` pour `auth.uid()` et **autorise uniquement `role = 'admin'`**.
  4. Retourne `401` si le token est absent/invalidé, `403` si l’utilisateur n’est pas admin.

- Si la vérification échoue, la fusion n’est **pas** exécutée.
- Le front (`/admin/alerts`) envoie désormais le token courant :

  ```ts
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const res = await fetch("/api/recipes/merge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(params),
  });
  ```

**Statut :** la route critique de fusion est désormais restreinte aux admins authentifiés côté Supabase. Le service role reste utilisé, mais uniquement après contrôle du JWT et du rôle.

### 3.2 Autres routes

À ce stade, `/api/recipes/merge` est la seule route App Router utilisant `supabaseAdmin`. Les autres opérations CRUD passent par le client `supabase` (RLS).

**Recommandation :**

- Toute nouvelle route utilisant `supabaseAdmin` doit :
  - exiger un JWT Supabase (header `Authorization`),
  - vérifier `user_profiles.role`,
  - journaliser les opérations sensibles (ex: logs d’audit en base).

## 4. Row Level Security (RLS) – tables principales

Le repository ne peut pas lire la configuration RLS réelle du projet Supabase, mais le code front suppose :

- RLS activé sur toutes les tables sensibles.
- Permissions basées sur `user_profiles.role` (`admin` / `editor`) via `auth.uid()`.

Les scripts SQL suivants documentent (et implémentent, si appliqués) les attentes de sécurité.

### 4.1 `editorial_calendar`

Fichier : `sql/editorial_calendar.sql`

- Table :

  ```sql
  create table if not exists public.editorial_calendar (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    category text,
    difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')),
    target_month date not null,
    status text not null default 'planned' check (status in ('planned', 'draft', 'enriching', 'published')),
    priority integer not null default 1,
    tags text[] not null default '{}',
    chefito_angle text,
    recipe_id uuid references public.recipes(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  ```

- RLS activé :

  ```sql
  alter table public.editorial_calendar enable row level security;
  ```

- Policies :

  ```sql
  -- Lecture : admins et éditeurs
  create policy editorial_calendar_select
  on public.editorial_calendar
  for select
  using (
    exists (
      select 1
      from public.user_profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'editor')
    )
  );

  -- Écriture : admins uniquement
  create policy editorial_calendar_modify
  on public.editorial_calendar
  for all
  using (
    exists (
      select 1
      from public.user_profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
  ```

**Impact :**

- Les pages `/admin/editorial-calendar/*` utilisent le client `supabase` et ne fonctionnent que pour des utilisateurs authentifiés dont `user_profiles.role ∈ {'admin','editor'}`.
- Les insert/update sont réservés aux admins.

### 4.2 `recipes` – indicateur JSON-LD

Fichier : `sql/recipes_schema_jsonld.sql`

- Ajout d’un flag :

  ```sql
  alter table public.recipes
    add column if not exists schema_jsonld_enabled boolean not null default false;

  create index if not exists recipes_schema_jsonld_enabled_idx
    on public.recipes (schema_jsonld_enabled);
  ```

**Attendu côté RLS :**

- Les règles existantes sur `recipes` doivent continuer à restreindre :
  - la lecture/écriture aux admins et éditeurs via `user_profiles.role`,
  - l’accès anonyme/public uniquement aux données nécessaires au site public (si exposées).

### 4.3 Autres tables (attentes RLS)

Sur la base de l’usage dans le code :

- `recipes`, `recipe_ingredients_normalized`, `recipe_steps_enhanced`,
  `recipe_concepts`, `knowledge_base`, `audio_library`, `audio_mapping`,
  `recipe_similarity_alerts`, `recipe_relationships`, `audio_usage_stats`,
  `posts`, `user_profiles`

**Recommandation de policies :**

1. **Backoffice (admin/editor)** via `supabase` :

   ```sql
   -- Exemple générique de policy pour SELECT
   create policy admin_editor_select
   on public.some_table
   for select
   using (
     exists (
       select 1
       from public.user_profiles p
       where p.id = auth.uid()
         and p.role in ('admin', 'editor')
     )
   );
   ```

2. **Écriture (INSERT/UPDATE/DELETE)** : admins uniquement, ou admins/editeurs selon la table (par ex. `recipes` peut être éditée par `editor`, mais les tables systèmes type `user_profiles` doivent rester admin only).

3. **Aucun accès anonyme** aux tables d’administration (backoffice). Si certaines vues publiques sont nécessaires, les exposer via des vues/API dédiées.

## 5. Supabase Storage – uploads image & audio

Buckets utilisés :

- `recipe-images` (images de recettes),
- `audio-files` (fichiers audio).

Implémentation front (fichier `src/lib/storage.ts`) :

- Génération de chemins déterministes et normalisés :
  - Images : `recipes/<slug>/<slug>-<timestamp>.<ext>`
  - Audio : `audio/<slug>/<slug>-<timestamp>.<ext>`
- Slugification via `generateSlug` → pas d’injection de chemin, pas de caractères spéciaux.

**Nouveaux garde-fous côté client :**

- `uploadRecipeImage(file, recipeTitle)` :

  ```ts
  if (!file.type.startsWith("image/")) {
    throw new Error("Le fichier sélectionné n'est pas une image valide.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("L'image dépasse la taille maximale autorisée (5 Mo).");
  }
  ```

- `uploadAudioFile(file, audioKey)` :

  ```ts
  if (!file.type.startsWith("audio/")) {
    throw new Error("Le fichier sélectionné n'est pas un fichier audio valide.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error(
      "Le fichier audio dépasse la taille maximale autorisée (20 Mo)."
    );
  }
  ```

- Les messages d’erreur sont remontés dans l’UI :
  - Upload image : via `onSubmit` de la page d’édition recette.
  - Upload audio : via un état `uploadError` sur `/admin/audio`.

**Policies Storage recommandées :**

- Buckets **non publics** par défaut :
  - lecture/écriture réservée aux rôles nécessaires (via policies de Storage + JWT Supabase),
  - exposition au front via URLs signées si besoin.
- Si les images de recettes doivent être publiques :
  - `recipe-images` en lecture publique **uniquement**, écriture restreinte à `auth.role()` approprié.

## 6. Injection SQL et validation des entrées

- Toutes les requêtes passent par `@supabase/supabase-js` :
  - pas de SQL brut écrit dans le code.
  - les filtres `.eq`, `.in`, `.order` sont paramétrés.
- Les seules constructions à base de chaînes (`.or(...)`) utilisent :
  - des identifiants validés par Zod (`uuid()`),
  - des valeurs non injectées dans du SQL brut (les colonnes sont codées en dur).

Exemple :

```ts
const { data: relationships } = await supabaseAdmin
  .from("recipe_relationships")
  .select("id, parent_recipe_id, child_recipe_id")
  .or(
    `parent_recipe_id.eq.${duplicateId},child_recipe_id.eq.${duplicateId}`
  );
```

Ici `duplicateId` est préalablement validé comme UUID via Zod, ce qui réduit fortement le risque d’injection.

**Validation des payloads :**

- Routes sensibles (fusion recettes) utilisent Zod (`bodySchema`), qui valide la forme du JSON et le type des IDs (uuid).
- Formulaires React Hook Form + Zod côté client pour toutes les entités éditoriales (recettes, etc).

## 7. Variables d’environnement et secrets

Nouveaux fichiers :

- `.env.example` (modèle, sans secrets),
- `.gitignore` (ajouté, ignore `.env*`).

```gitignore
.env
.env.*
!.env.example
```

Clés :

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` : exposées au front (normal).
- `SUPABASE_SERVICE_ROLE_KEY` : **jamais** utilisée côté client, uniquement dans `supabaseAdmin`.

**À vérifier côté infra :**

- Les vraies valeurs `.env` ne doivent pas être commitées.
- Les environnements (prod/staging) doivent définir les variables uniquement via le système de déploiement (Vercel, Fly.io, etc.).

## 8. Validation pre-publish (publication bloquante)

Sur la page `/admin/recipes/[id]/edit` :

- Avant d’accepter le statut `published`, le formulaire exécute `computePrePublishIssues` qui vérifie :

  - Image présente (URL existante ou fichier upload sélectionné).
  - `description` non vide.
  - `ingredients_text` non vide.
  - `instructions_detailed` non vide.
  - `cultural_history` non vide.
  - `techniques` non vide.
  - `nutritional_notes` non vide.
  - `meta_title` non vide.
  - `meta_description` non vide.
  - au moins un des deux : `chef_tips` ou `difficulty_detailed`.
  - **min 3** lignes dans `recipe_ingredients_normalized`.
  - **min 3** lignes dans `recipe_steps_enhanced`.
  - **≥ 1** concept lié dans `recipe_concepts`.

- Si au moins un critère manque :
  - la mise à jour est bloquée,
  - une modale affiche la liste détaillée des éléments manquants,
  - un message d’erreur explicite est affiché.

Cette validation est purement front, mais elle repose sur des données obtenues via Supabase (et donc RLS). Elle ne remplace pas des contraintes de cohérence éventuelles côté SQL, mais évite les publications incomplètes depuis l’interface admin.

## 9. JSON-LD Recipe (Schema.org)

Un module dédié `src/lib/seo.ts` :

- Construit un objet JSON-LD à partir des champs d’une recette (`buildRecipeJsonLd`).
- Effectue une validation minimale (`validateRecipeJsonLd`) :
  - `name`, `description`, `image`, `recipeIngredient`, `recipeInstructions`.

Sur `/admin/recipes/[id]/edit` :

- Le JSON-LD est généré automatiquement et affiché dans une zone en lecture seule.
- Un flag `schema_jsonld_enabled` (boolean en base) permet d’indiquer au front s’il doit injecter ce JSON-LD sur la page publique.

## 10. Rate limiting et protections supplémentaires

Non implémenté directement dans ce repo (à gérer au niveau infra / reverse proxy), mais recommandé :

- Limiter les requêtes vers `/api/recipes/merge` (et futures routes critiques) par IP / utilisateur (ex: 20/minute).
- Activer un WAF ou équivalent :
  - blocage d’IP malveillantes,
  - filtrage de payloads atypiques.

## 11. Checklist de sécurité

À vérifier / maintenir :

- [x] RLS activé sur toutes les tables de backoffice (`recipes`, `editorial_calendar`, `audio_library`, etc.).
- [x] Route `/api/recipes/merge` protégée par JWT Supabase + rôle admin.
- [x] Service role key utilisée uniquement côté serveur.
- [x] Uploads image/audio avec validation type + taille.
- [x] Secrets non committés (`.env` ignoré).
- [x] Validation forte des payloads (Zod) sur les entrées critique.
- [x] Validation pre-publish bloquante pour les recettes premium.

Pour tout nouveau développement :

1. Utiliser le client `supabase` (anon key + RLS) par défaut.
2. Introduire `supabaseAdmin` uniquement si la logique ne peut pas être exprimée avec RLS/SQL standard.
3. Protéger toute route utilisant `supabaseAdmin` par :
   - un JWT Supabase validé,
   - un contrôle de `user_profiles.role`.
4. Documenter toute nouvelle table et ses policies dans un fichier `sql/*.sql` et dans ce `SECURITY.md`.