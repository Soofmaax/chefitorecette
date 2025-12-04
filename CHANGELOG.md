# Changelog

Ce fichier liste les changements notables apportés au backoffice Chefito.

## 0.2.0 – Calendrier éditorial, JSON-LD et durcissement sécurité

### Ajouts majeurs

- **Calendrier éditorial complet** (`editorial_calendar`) :
  - Nouvelle table `public.editorial_calendar` (voir `sql/editorial_calendar.sql`).
  - Vue admin `/admin/editorial-calendar` avec :
    - Vue tableau (filtres par statut, catégorie, difficulté, mois cible, priorité).
    - Vue Kanban (colonnes Planned → Draft → Enriching → Published).
    - Statistiques `X/Y publiées` et pourcentage de complétion.
    - Actions “Créer la recette” / “Voir la recette” (liaison avec `recipes` via `recipe_id`).
  - RLS documenté : lecture pour `admin`/`editor`, écriture pour `admin` uniquement.

- **Import CSV éditorial** :
  - Nouvelle page `/admin/editorial-calendar/import`.
  - Upload CSV (séparateur `,` ou `;` autodétecté).
  - Mapping automatique des colonnes (`title`, `category`, `difficulty`, `target_month`, `status`, `priority`, `tags`, `chefito_angle`) avec UI pour corriger.
  - Prévisualisation des 10 premières lignes + détection d’erreurs par ligne.
  - Import des lignes valides vers `editorial_calendar`, les lignes invalides sont ignorées avec message d’avertissement.

- **Création de recette depuis le calendrier éditorial** :
  - Nouvelle page `/admin/recipes/create` :
    - Préremplit les champs à partir d’une entrée `editorial_calendar` (`editorialId` en query).
    - Crée une recette en statut `draft`.
    - Met à jour la ligne éditoriale : `recipe_id` + `status = 'draft'`.
  - Ajout d’un item “Calendrier éditorial” dans la sidebar admin.

- **SEO avancé & JSON-LD Recipe** :
  - Nouveau module `src/lib/seo.ts` :
    - `buildRecipeJsonLd` : génère un objet Schema.org `Recipe` à partir d’une recette.
    - `validateRecipeJsonLd` : validation minimale (champs essentiels présents).
  - Ajout d’un champ `schema_jsonld_enabled` dans `recipes` (SQL : `sql/recipes_schema_jsonld.sql`) et dans le schéma de formulaire (`RecipeFormValues`).
  - Dans `/admin/recipes/[id]/edit` :
    - Nouvelle section “SEO avancé – Schema.org Recipe (JSON-LD)” :
      - Affichage du JSON-LD généré (lecture seule).
      - Liste des avertissements de validation.
      - Case à cocher “Inclure le JSON-LD sur la page recette” (flag pour le front).

- **Validation pre-publish bloquante** :
  - Sur `/admin/recipes/[id]/edit`, avant d’accepter `status = 'published'` :
    - Vérifie la présence des champs premium éditoriaux & SEO, ainsi que :
      - ≥ 3 ingrédients normalisés,
      - ≥ 3 étapes enrichies,
      - ≥ 1 concept scientifique lié.
    - En cas de manques :
      - la mise à jour est bloquée,
      - une modale liste précisément les éléments à compléter,
      - un message d’erreur est affiché sous le formulaire.

### Sécurité

- **Protection de la route de fusion** `/api/recipes/merge` :
  - Ajout d’un helper `requireAdmin` qui :
    - Exige un header `Authorization: Bearer <access_token>` (JWT Supabase).
    - Valide le token via `supabaseAdmin.auth.getUser(token)`.
    - Vérifie que `user_profiles.role = 'admin'`.
  - Si l’utilisateur n’est pas authentifié ou pas admin, la fusion est refusée (`401`/`403`).

- **Client front `/admin/alerts`** :
  - Le front récupère désormais le `access_token` Supabase courant et l’envoie dans le header `Authorization` lors de l’appel à `/api/recipes/merge`.

- **Hardening des uploads** (`src/lib/storage.ts`) :
  - `uploadRecipeImage` :
    - vérifie que le fichier est bien une image (`file.type.startsWith("image/")`),
    - limite la taille à **5 Mo**, sinon lève une erreur explicite.
  - `uploadAudioFile` :
    - vérifie que le fichier est bien un audio (`file.type.startsWith("audio/")`),
    - limite la taille à **20 Mo**.
  - Sur `/admin/audio`, les erreurs d’upload sont affichées dans l’UI (`uploadError`).

- **Gestion des secrets & environnement** :
  - Ajout d’un `.env.example` documenté (URL + clés Supabase, site public).
  - Ajout d’un `.gitignore` qui ignore `.env*` (tout en gardant `.env.example`).

- **Documentation sécurité** :
  - Nouveau fichier `SECURITY.md` détaillant :
    - le modèle Auth & rôles,
    - l’usage des clients `supabase` / `supabaseAdmin`,
    - les attentes RLS par table (incluant `editorial_calendar`),
    - les policies Storage recommandées,
    - la protection des routes critiques,
    - la validation pre-publish.

## 0.1.0 – Version initiale (rappel)

- Admin premium Next.js 15 pour les recettes :
  - Liste des recettes avec filtres, recherche et pagination.
  - Édition complète d’une recette (texte, SEO, image, statut).
  - Ingrédients normalisés (`recipe_ingredients_normalized`).
  - Étapes enrichies (`recipe_steps_enhanced`).
  - Concepts scientifiques (`knowledge_base` + `recipe_concepts`).
  - Alertes de similarité et fusion de recettes.
  - Gestion audio (`audio_library`, `audio_mapping`).
  - Dashboard analytics basique (`/admin/dashboard`).