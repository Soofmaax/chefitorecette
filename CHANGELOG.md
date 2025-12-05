# Changelog

Ce fichier liste les changements notables apportés au backoffice Chefito.

## 0.4.0 – Imports CSV complets & documentation alignée

### Imports CSV catalogues (full backoffice sans script local)

- **Ingrédients**  
  - Nouvelle page `/admin/ingredients/import` :
    - Upload d’un CSV (séparateur `,` ou `;`).
    - Mapping automatique + manuel des colonnes (`canonical_name`, `display_name`, `category`, `scientific_name`, `audio_key`).
    - Prévisualisation des lignes, distinction lignes valides / invalides.
    - Upsert Supabase sur `ingredients_catalog.canonical_name` (INSERT ou UPDATE sans doublon).
- **Ustensiles**  
  - Nouvelle page `/admin/utensils/import` :
    - CSV minimal `key` + `label`.
    - Mapping et prévisualisation comme pour les ingrédients.
    - Upsert Supabase sur `utensils_catalog.key`.
- **Knowledge base (concepts scientifiques)**  
  - Nouvelle page `/admin/knowledge/import` :
    - CSV mappé vers `concept_key`, `title`, `category`, `work_status`, `difficulty_level`, `usage_priority`, `short_definition`, `long_explanation`, `synonyms`.
    - Support des valeurs de difficulté en texte (`beginner`, `intermediate`, `advanced` / FR) ou numériques (1–3).
    - Upsert Supabase sur `knowledge_base.concept_key`.

Ces trois imports permettent de gérer l’ensemble des référentiels (ingrédients, ustensiles, concepts) **exclusivement via l’admin**, sans script Node local.

### Alignement base de données

- `knowledge_base` enrichie avec les colonnes :
  - `short_definition` (résumé),
  - `long_explanation` (explication détaillée),
  - `synonyms` (`text[]`).
- Script SQL dédié : `sql/knowledge_base_enrich.sql`.

### Documentation mise à jour

- `readme.md` :
  - Sections complètes pour :
    - 3.3 Alertes de similarité & gestion des doublons,
    - 3.4 Bibliothèque d’ingrédients (incluant import CSV),
    - 3.5 Knowledge base (imports CSV + mapping),
    - 3.6 Concepts scientifiques liés à une recette,
    - 3.7 Gestion audio,
    - 3.8 Calendrier éditorial & import CSV,
    - 3.9 SEO avancé & JSON-LD Recipe.
  - Sections ajoutées :
    - 4. Partie historique : back-office HTML minimal,
    - 5. Résumé opérationnel (workflow complet admin),
    - 6. Architecture – vue d’ensemble,
    - 7. Guide de prise en main en 5 minutes,
    - 8. Installation & exécution locale,
    - 9. Configuration Supabase & environnement,
    - 10. Déploiement (avec lien vers `PRODUCTION_CHECKLIST.md`).
- `AUDIT_FINAL.md`, `PRODUCTION_CHECKLIST.md`, `SECURITY.md`, `TODO.md`, `QUICK_WINS.md` :
  - Relisent tous le même modèle :
    - backoffice = outil interne pour enrichir les recettes et préparer le RAG,
    - catalogues gérés via les pages d’import CSV,
    - RLS & policies Supabase comme référence de sécurité.

## 0.3.0 – Alignement audit, UX RAG et ustensiles

### Ajouts et changements principaux

- **Backoffice centré RAG / usage interne**
  - Le backoffice est explicitement positionné comme **outil interne pour préparer les données RAG** (et le front), avec en pratique **un admin unique**.
  - La documentation (`readme.md`, `AUDIT_FINAL.md`) a été mise à jour pour refléter ce rôle.

- **Factorisation de la qualité éditoriale & pre-publish**
  - Nouveau module partagé `src/lib/recipesQuality.ts` :
    - `getRecipeMissingFields(recipe)` : logique unique de complétude éditoriale/SEO.
    - `computePrePublishIssues(values, options)` : liste les problèmes bloquants avant publication (statut `published`).
  - Utilisé par :
    - la liste `/admin/recipes` (`src/app/admin/recipes/page.tsx`) pour les badges de complétude,
    - la page d’édition `/admin/recipes/[id]/edit` pour le blocage pre‑publish.
  - L’audit (`AUDIT_FINAL.md`) a été mis à jour pour noter que la duplication a été corrigée.

- **Prévisualisation recette côté admin**
  - Nouvelle page `/admin/recipes/[id]/preview` (App Router) :
    - Affiche un **iframe** vers la page publique `/recipes/[id]` (pages router).
    - Permet de vérifier visuellement le rendu front sans quitter l’admin.
  - Ajout d’un bouton “Prévisualiser la page publique” sur `/admin/recipes/[id]/edit`.

- **Admin du catalogue d’ustensiles**
  - Nouvelle page `/admin/utensils` :
    - Liste les entrées de `utensils_catalog` (clé + label).
    - Calcule un `usage_count` par ustensile à partir de `recipe_utensils`.
    - Permet de créer / éditer / (sous conditions) supprimer un ustensile.
    - Empêche la suppression si l’ustensile est utilisé par au moins une recette.
  - Entrée “Ustensiles” ajoutée dans la sidebar admin.

- **Filtres “techno” sur les recettes**
  - Sur `/admin/recipes`, ajout de deux filtres supplémentaires :
    - **Conservation / service** :
      - `Conservation (toutes)` / `Avec conservation/service` / `Sans conservation/service`.
      - Basé sur `serving_temperatures`, `storage_modes`, `storage_duration_days`, `storage_instructions`.
    - **Ustensiles** :
      - `Ustensiles (tous)` / `Avec ustensiles` / `Sans ustensiles`.
      - Basé sur la présence d’entrées dans `recipe_utensils` (via une map `utensilsPresence`).
  - Ces filtres complètent les badges 🌡 / 🔧 déjà affichés et facilitent le pilotage de l’enrichissement RAG.

- **Dashboard RAG simplifié**
  - Les dépendances aux anciennes fonctions Edge (Redis/S3/Vault) ont été retirées du dashboard pour éviter le bruit CORS et les erreurs lorsque ces services ne sont pas configurés.
  - Le module `src/lib/dashboard.ts` ne repose plus que sur les tables (`recipes`, `posts`, `user_profiles`), et les pages dashboard affichent désormais des panneaux descriptifs pour les intégrations Redis/S3/Vault (sans métriques chiffrées).

- **Documentation**
  - `readme.md` :
    - Clarifie que le backoffice est un outil interne pour enrichir les recettes et structurer les données pour le RAG.
    - Documente les nouveaux filtres “techno”, la prévisualisation admin et la page `/admin/utensils`.
  - `AUDIT_FINAL.md` :
    - Marque la factorisation de `getRecipeMissingFields` comme réalisée.
    - Ajoute une mention explicite sur l’usage “un seul admin” dans la pratique.
  - `SECURITY.md` :
    - Rappelle que la validation pre‑publish se base sur `computePrePublishIssues` défini dans `src/lib/recipesQuality.ts`.

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
    - Vérifie la présence des champs éditoriaux & SEO indispensables, ainsi que :
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

- Admin Next.js 15 pour les recettes enrichies :
  - Liste des recettes avec filtres, recherche et pagination.
  - Édition complète d’une recette (texte, SEO, image, statut).
  - Ingrédients normalisés (`recipe_ingredients_normalized`).
  - Étapes enrichies (`recipe_steps_enhanced`).
  - Concepts scientifiques (`knowledge_base` + `recipe_concepts`).
  - Alertes de similarité et fusion de recettes.
  - Gestion audio (`audio_library`, `audio_mapping`).
  - Dashboard analytics basique (`/admin/dashboard`).