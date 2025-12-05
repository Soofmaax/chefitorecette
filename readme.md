# Backoffice Chefito – Admin recettes enrichies

![CI](https://github.com/Soofmaax/chefitorecette/actions/workflows/ci.yml/badge.svg)
![Status](https://img.shields.io/badge/status-private-informational)
![Framework](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)
![Runtime](https://img.shields.io/badge/Node-20.x-339933?logo=node.js)
![Language](https://img.shields.io/badge/TypeScript-5.x-3178C?logo=typescript)

Ce projet combine :

- Un backoffice historique minimal (pages router) pour certaines opérations.
- Un nouvel **espace admin recettes enrichies en App Router** sous `/admin/*` optimisé pour l’enrichissement de recettes.

Le backoffice est conçu comme un **outil interne** dont la vocation principale est de **préparer et structurer les recettes pour un système RAG** (et pour le site public).  
En pratique, il est pensé pour être utilisé par **un admin unique** ou un très petit nombre d’administrateurs.

---

## Sommaire

- [1. Stack & architecture](#1-stack--architecture)
- [2. Définition d’une recette “complète Chefito”](#2-définition-dune-recette-complète-chefito)
- [3. Fonctionnalités de l’admin recettes](#3-fonctionnalités-de-ladmin-recettes)
  - [3.2. Gestion des recettes – Mode enrichi](#32-gestion-des-recettes--mode-enrichi)
  - [3.3. Alertes de similarité & gestion des doublons](#33-alertes-de-similarité--gestion-des-doublons)
  - [3.4. Bibliothèque d’ingrédients](#34-bibliothèque-dingrédients)
  - [3.5. Knowledge base (concepts scientifiques)](#35-knowledge-base-concepts-scientifiques)
  - [3.6. Concepts scientifiques liés à une recette](#36-concepts-scientifiques-liés-à-une-recette)
  - [3.7. Gestion audio](#37-gestion-audio)
  - [3.8. Calendrier éditorial & import CSV](#38-calendrier-éditorial--import-csv)
  - [3.9. SEO avancé & JSON-LD Recipe](#39-seo-avancé--json-ld-recipe)
- [4. Partie historique : back-office HTML minimal](#4-partie-historique--back-office-html-minimal)
- [5. Résumé opérationnel](#5-résumé-opérationnel)
- [6. Architecture – vue d’ensemble](#6-architecture--vue-densemble)
- [7. Guide de prise en main en 5 minutes (par rôle)](#7-guide-de-prise-en-main-en-5-minutes-par-rôle)
- [8. Installation & exécution locale](#8-installation--exécution-locale)
- [9. Configuration Supabase & environnement](#9-configuration-supabase--environnement)
- [10. Déploiement](#10-déploiement)

---

## 1. Stack & architecture

### 1.1. Technologies

- **Framework** : Next.js 15 (App Router + Pages Router)
  - Backoffice historique en **pages router** (`src/pages`)
  - Admin recettes enrichies en **App Router** (`src/app/admin`)
- **Langage** : TypeScript 5.x
- **Auth & données** : Supabase
  - Auth utilisateurs (email/mot de passe, Supabase Auth)
  - RLS (Row Level Security) activé côté base, usage d’un client `supabase` (clé publique) et d’un client `supabaseAdmin` (service role) côté serveur
  - Fonctions SQL / Edge : génération d’**embeddings**, recherche sémantique, etc.
  - Tables métiers principales :  
    - Recettes & structure RAG :  
      `recipes`, `ingredients_catalog`, `recipe_ingredients_normalized`,  
      `recipe_steps_enhanced`, `recipe_concepts`, `knowledge_base`,  
      `recipe_similarity_alerts`, `recipe_relationships`
    - Audio :  
      `audio_library`, `audio_mapping`, `audio_usage_stats`
    - Contenus éditoriaux & calendrier :  
      `editorial_calendar`, `posts` (si présent)
- **Stockage & fichiers**
  - Supabase Storage (buckets) :
    - `recipe-images` pour les images de recettes
    - `audio-files` pour les fichiers audio
- **Embeddings & RAG**
  - Génération d’embeddings (recettes & articles) via Supabase Edge Functions
  - Stockage d’un vecteur local (`recipes.embedding`) et d’une clé de vecteur S3 (`s3_vector_key`) pour intégration ultérieure sur de gros volumes
  - Statut d’embedding : `embedding_status` (prêt pour le suivi)
- **UI & formulaires**
  - Tailwind CSS, thème sombre
  - React Hook Form + Zod (validation forte alignée sur le schéma SQL)
  - React Query (`@tanstack/react-query`) pour les données (page recettes, RAG, calendrier éditorial, etc.)
  - Tiptap (`@tiptap/react`) pour le texte riche des étapes
- **Qualité & CI**
  - ESLint, Prettier, TypeScript strict
  - GitHub Actions (`.github/workflows/ci.yml`) :
    - Lint + typecheck
    - Build Next.js
    - `npm audit --audit-level=high`
    - CodeQL (analyse sécurité)
  - Husky + lint-staged pour empêcher les commits non conformes

### 1.2. Authentification & rôles

- Auth Supabase gérée via un `AuthProvider` React (`src/hooks/useAuth.tsx`).
- Layout global `_app.tsx` (pages router) + layout `app/layout.tsx` (App Router).
- L’accès à `/admin/*` est réservé aux utilisateurs authentifiés avec un rôle `admin` (via la table `user_profiles` / `profiles`).
- Pages d’auth principales :
  - `/auth/sign-in` : connexion email + mot de passe (Supabase Auth).
  - `/auth/reset-password-request` : demande d’email de réinitialisation du mot de passe.
  - `/auth/reset-password` : définition d’un nouveau mot de passe à partir du lien Supabase.

---

## 2. Définition d’une recette “complète Chefito”

On considère qu’une recette est **complète** (au sens Chefito) lorsqu’elle respecte l’ensemble des critères éditoriaux et SEO suivants (implémentés dans le code comme une fonction `getRecipeMissingFields(recipe)`), même si le mot “premium” n’est plus utilisé dans l’interface) :

1. **Publication**
   - `status = 'published'`

2. **Contenu de base**
   - `description` non vide
   - `image_url` non vide
   - `ingredients_text` non vide
   - `instructions_detailed` non vide

3. **Enrichissement éditorial**
   - `cultural_history` non vide
   - `techniques` non vide
   - `nutritional_notes` non vide

4. **SEO**
   - `meta_title` non vide
   - `meta_description` non vide

5. **Détails Chefito**
   - Au moins un des deux champs est non vide :
     - `chef_tips`
     - `difficulty_detailed`

> Remarque : la présence d’un **embedding RAG** n’est **pas** un critère de recette “complète”.  
> C’est une information technique complémentaire (affichée dans l’UI) qui peut être mise à jour à la demande, mais la complétude reste un jugement éditorial / SEO.

Si **au moins un** de ces critères manque, la recette est considérée comme **“à enrichir”**.  
L’UI liste les critères manquants sous forme de badges (ex. _“Image”_, _“Notes nutritionnelles”_, _“Titre SEO”_).

Cette logique est utilisée :

- Dans la **liste des recettes** (`/admin/recipes`) pour afficher les badges ✅/⚠️.
- Dans la **page d’édition** (`/admin/recipes/[id]/edit`) dans un panneau de “Qualité éditoriale”.

---

## 3. Fonctionnalités de l’admin recettes

### 3.2. Gestion des recettes – Mode enrichi

Le backoffice admin est pensé pour que **tous les champs nécessaires au RAG et au front** soient pilotables depuis l’interface, sans passer par SQL.

#### 3.2.1. Liste des recettes `/admin/recipes`

Affichage (via `src/app/admin/recipes/page.tsx`) :

- Données principales (`AdminRecipe`) issues de `recipes` :
  - Identité & base : `title`, `slug`, `status`, `description`, `image_url`
  - Typage : `category` (type de plat structuré), `cuisine`, `difficulty`
  - Temps (en minutes) : `prep_time_min`, `cook_time_min`, `rest_time_min`, `servings`
  - Contenu éditorial : `ingredients_text`, `instructions_detailed`, `chef_tips`, `cultural_history`, `techniques`, `difficulty_detailed`, `nutritional_notes`
  - Conservation & service :  
    - Structuré : `storage_modes` (modes de conservation : réfrigérateur, congélateur, ambiante, sous vide, boîte hermétique, au choix), `serving_temperatures` (températures de service : chaud, tiède, ambiante, froid, au choix)  
    - Libre : `storage_instructions`, `storage_duration_days`
  - Régimes : `dietary_labels` (régimes / contraintes alimentaires structurées)
  - Ustensiles / “technos” de cuisine : via `utensils_catalog` + `recipe_utensils` (four, airfryer, Thermomix, Cookeo, robot pâtissier, mixeur, etc.)
  - SEO : `meta_title`, `meta_description`, `canonical_url`, `og_image_url`
  - Technique : `embedding` (optionnel, indicateur technique)

L’interface met aussi en avant, pour chaque recette :

- Un badge de **qualité éditoriale** (complète / à enrichir) basé sur `getRecipeMissingFields`.
- Des badges **RAG structure** (ingrédients normalisés, étapes enrichies, concepts scientifiques).
- Des badges **“techno”** :
  - 🌡 `conservation / service` si au moins une info de conservation/serving est renseignée.
  - 🔧 `ustensiles` si des entrées existent dans `recipe_utensils`.

Fonctionnalités :

- **Filtres** :
  - `status` : `draft`, `scheduled`, `published`, ou “tous”
  - `difficulty` : `beginner`, `intermediate`, `advanced`, ou “toutes”
  - `category`, `cuisine` : listes des valeurs distinctes trouvées dans la base
  - **Filtre RAG** (structure de données) :
    - `RAG complet` : ingrédients normalisés, étapes enrichies, concepts liés et SEO (titre + meta description) présents.
    - `RAG partiel` : certaines dimensions remplies, d’autres non.
    - `RAG absent` : aucune de ces dimensions n’est renseignée.
    - Filtres dimensionnels :
      - `Sans ingrédients normalisés` (aucune entrée dans `recipe_ingredients_normalized`),
      - `Sans étapes enrichies` (aucune entrée dans `recipe_steps_enhanced`),
      - `Sans concepts scientifiques` (aucune entrée dans `recipe_concepts`).
- **Recherche** :
  - Recherche plein texte :
    - Sur `title`, `slug`, `category`, `cuisine`, `ingredients_text`, `instructions_detailed`
  - Recherche ciblée :
    - Champ dédié pour saisir un **ID** ou un **slug exact** et accéder directement à une recette précise.
- **Pagination côté base** :
  - Pages de 50 recettes (configurable),
  - Tri par `created_at` (les plus récentes en premier),
  - Affichage du nombre total de recettes correspondant aux filtres.
- **Qualité éditoriale** :
  - Badge **✅ “complète”** si tous les critères éditoriaux/SEO sont remplis.
  - Badge **⚠️ “à enrichir”** sinon.
  - Badge rouge indiquant le nombre de champs manquants : `X champ(s) manquant(s)` (critères de complétude).
- **Colonne RAG** :
  - Badge **“RAG complet / partiel / absent”** calculé côté front à partir de :
    - la présence d’ingrédients normalisés,
    - d’étapes enrichies,
    - de concepts scientifiques liés,
    - et de champs SEO (`meta_title`, `meta_description`).
  - Sert à piloter la complétude de la structure de données pour le futur RAG, indépendamment du statut publié.
- **Filtres supplémentaires “techno”** :
  - Filtre *Conservation / service* : recettes avec ou sans informations de conservation/service (modes, températures, durée, consignes).
  - Filtre *Ustensiles* : recettes avec ou sans ustensiles renseignés (via `recipe_utensils`).

Actions depuis la liste :

- Lien vers la **fiche d’édition enrichie** : `/admin/recipes/{id}/edit`.
- Bouton **“Recalculer embedding”** pour relancer la génération de l’embedding RAG pour une recette donnée.
- Accès indirect à la prévisualisation : depuis la fiche d’édition, un bouton **“Prévisualiser la page publique”** ouvre `/admin/recipes/{id}/preview` avec un iframe embarquant `/recipes/{id}` (rendu front).

Le catalogue d’ustensiles utilisé pour les badges et les filtres (icône 🔧) se gère via la page `/admin/utensils`.

### 3.3. Alertes de similarité & gestion des doublons

Le système peut détecter automatiquement des recettes proches (doublons potentiels ou variantes) et les présenter dans une interface dédiée.

- Page : `/admin/alerts`  
  - Liste les entrées de `recipe_similarity_alerts` (recette A, recette B, score de similarité, statut, résolution).
  - Permet de filtrer / trier les alertes selon leur statut.
- Actions principales :
  - **Marquer comme variantes** : crée une relation dans `recipe_relationships` pour indiquer que deux recettes sont des variantes d’un même socle.
  - **Fusionner** :  
    - Opère une fusion contrôlée entre deux recettes (transfert des ingrédients normalisés, étapes enrichies, concepts, statistiques audio…).  
    - Repointage de `recipe_ingredients_normalized`, `recipe_steps_enhanced`, `recipe_concepts`, `audio_usage_stats`, `recipe_relationships`, `recipe_similarity_alerts` vers la recette canonique.  
    - Mise en `draft` de la recette fusionnée, avec un slug suffixé (ex. `-fusionnee`).
- Sécurité :
  - La fusion passe par `/api/recipes/merge`, route protégée par un JWT Supabase + rôle `admin` (voir `SECURITY.md`).

### 3.4. Bibliothèque d’ingrédients

La bibliothèque d’ingrédients sert à normaliser les ingrédients des recettes (quantités structurées, lien avec l’audio, futur calcul nutritionnel, etc.).

- Page de gestion : `/admin/ingredients`  
  - Créer / modifier un ingrédient unitaire (nom canonique, nom affiché, catégorie, nom scientifique, clé audio).  
  - Le champ `canonical_name` est la clé technique stable utilisée dans tout le système.
- Import / mise à jour en masse : `/admin/ingredients/import`  
  - Permet d’uploader un fichier CSV (séparateur `,` ou `;`) contenant au minimum :
    - `canonical_name` : identifiant unique (ex. `pomme_de_terre`, `huile_olive`)  
    - `display_name` : nom affiché (ex. `Pommes de terre`, `Huile d’olive`)  
    - `category` : catégorie libre (matière grasse, légume, fruit…)  
    - optionnel : `scientific_name`, `audio_key`
  - L’outil propose un **mapping automatique des colonnes** du CSV vers les champs, que tu peux ajuster manuellement.
  - L’import utilise un **upsert** côté Supabase :

    ```ts
    supabase
      .from("ingredients_catalog")
      .upsert(payload, { onConflict: "canonical_name" });
    ```

    - si `canonical_name` n’existe pas encore → **INSERT**  
    - si `canonical_name` existe déjà → **UPDATE** de la ligne existante  
    - aucun doublon ne peut être créé tant que `canonical_name` reste unique.

**Workflow recommandé** :

1. Maintenir un fichier maître des ingrédients (Google Sheets ou Excel).  
2. Exporter en CSV dès que tu ajoutes ou modifies des entrées.  
3. Aller sur `/admin/ingredients/import`, uploader le CSV, vérifier le mapping et la prévisualisation, puis lancer l’import.

### 3.5. Knowledge base (concepts scientifiques)

La **base de connaissances** décrit les grands concepts scientifiques utilisés pour expliquer les recettes (Maillard, émulsions, fermentation, gluten, etc.).

- Page de gestion : `/admin/knowledge`  
  - Créer et éditer chaque concept :  
    - `concept_key` (clé stable, ex. `reaction_maillard`)  
    - `title` (titre lisible)  
    - `category` (chimie, physique, organisation…)  
    - `work_status` (not_started, researching, draft, ready, published)  
    - `difficulty_level` (1–3)  
    - `usage_priority` (score d’importance, entier)  
    - `short_definition`, `long_explanation`, `synonyms`
- Import / mise à jour en masse : `/admin/knowledge/import`  
  - CSV attendu (séparateur `,` ou `;`) avec colonnes mappables vers :
    - `concept_key` (obligatoire)  
    - `title` (obligatoire)  
    - `category` (optionnel)  
    - `work_status` (optionnel, valeurs : `not_started`, `researching`, `draft`, `ready`, `published` ou leurs équivalents FR)  
    - `difficulty_level` (optionnel, nombre 1–3 ou `beginner` / `intermediate` / `advanced`)  
    - `usage_priority` (optionnel, entier)  
    - `short_definition`, `long_explanation` (optionnels)  
    - `synonyms` (optionnel, liste séparée par des virgules)
  - L’outil d’import affiche :
    - un **mapping de colonnes** (auto + modifiable),
    - une **prévisualisation** des 20 premières lignes (OK / erreurs),
    - le nombre de lignes valides / invalides.
  - L’import effectue un **upsert** sur `concept_key` :

    ```ts
    supabase
      .from("knowledge_base")
      .upsert(payload, { onConflict: "concept_key" });
    ```

    - concept nouveau → création  
    - concept existant (même `concept_key`) → mise à jour  
    - pas de doublons si `concept_key` reste unique.

### 3.6. Concepts scientifiques liés à une recette

Chaque recette peut être liée à un ou plusieurs concepts de la base de connaissances pour enrichir les explications et le futur RAG.

- Liaison via la table `recipe_concepts` (relation n‑n entre `recipes` et `knowledge_base`).  
- UI : dans `/admin/recipes/[id]/edit`, onglet ou section “Concepts scientifiques” :
  - recherche d’un concept par titre ou `concept_key`,
  - ajout / suppression de liens,
  - affichage de la difficulté & priorité du concept.
- Impact :
  - les concepts liés apparaissent dans la checklist RAG et dans la qualité éditoriale,
  - ils seront utilisés plus tard pour le RAG / FAQ / contenu pédagogique autour des recettes.

### 3.7. Gestion audio

Le backoffice permet d’associer des contenus audio aux recettes (explications, tips, introductions).

- Tables :
  - `audio_library` : fichiers audio stockés (chemin, durée, titre).  
  - `audio_mapping` : mapping entre `audio_key` et un fichier de `audio_library`.  
  - `audio_usage_stats` : enregistre l’utilisation d’un audio par recette.
- Page : `/admin/audio`  
  - Upload de nouveaux fichiers audio (validés côté client : type `audio/*`, taille ≤ 20 Mo).  
  - Association d’un `audio_key` à une entrée de `audio_library`.  
  - Visualisation des usages (nombre de recettes qui consomment un audio).
- Recettes :
  - certaines entités (`ingredients`, `concepts`, sections de recettes) peuvent référencer un `audio_key` pour lire l’explication vocale.

### 3.8. Calendrier éditorial & import CSV

Le calendrier éditorial sert à planifier les recettes (ou contenus) sur l’année : titre, catégorie, difficulté, mois cible, priorité, tags, angle Chefito.

- Page de consultation : `/admin/editorial-calendar`  
  - Vue des lignes du calendrier stockées dans `editorial_calendar`.  
  - Filtres par mois, statut, priorité, difficulté, catégorie.
  - Vue tableau + vue Kanban (colonnes Planned → Draft → Enriching → Published).
- Lien avec les recettes :
  - Depuis une ligne éditoriale, on peut créer une recette liée (champ `recipe_id`) ou ouvrir la recette existante.
  - La vue recettes rappelle éventuellement la ligne éditoriale associée.
- Import CSV : `/admin/editorial-calendar/import`  
  - Upload d’un fichier CSV (séparateur auto-détecté `,` ou `;`) avec colonnes mappables vers :
    - `title` : titre éditorial  
    - `category` : catégorie libre  
    - `difficulty` : `beginner`, `intermediate`, `advanced` (ou équivalent FR)  
    - `target_month` : mois au format `YYYY-MM`, `YYYY-MM-DD` ou `DD/MM/YYYY` (converti en `YYYY-MM-01`)  
    - `status` : `planned`, `draft`, `enriching`, `published` (ou équivalents FR)  
    - `priority` : entier (1 = faible, 5 = très prioritaire)  
    - `tags` : liste séparée par des virgules (stockée en `text[]`)  
    - `chefito_angle` : angle pédagogique / business
  - L’import actuel ajoute les lignes valides via un **INSERT** simple dans `editorial_calendar` (pas d’upsert).  
    - Éviter de réimporter plusieurs fois exactement le même fichier sans nettoyage préalable si tu veux éviter les doublons.

#### Workflow CSV global recommandé

Pour structurer l’ensemble du système Chefito **sans script local**, tu peux :

1. **Préparer les CSV dans un seul classeur** (Google Sheets / Excel) avec plusieurs onglets :
   - `editorial_calendar` : calendrier éditorial annuel,
   - `knowledge_base` : concepts scientifiques,
   - `ingredients_catalog` : ingrédients canoniques,
   - `utensils_catalog` : ustensiles / matériel.
2. Exporter chaque onglet en CSV au moment opportun.
3. Utiliser les pages d’import suivantes, directement dans le backoffice :
   - `/admin/editorial-calendar/import` → remplit `editorial_calendar` (INSERT).  
   - `/admin/knowledge/import` → alimente / met à jour `knowledge_base` (UPsert sur `concept_key`).  
   - `/admin/ingredients/import` → alimente / met à jour `ingredients_catalog` (UPsert sur `canonical_name`).  
   - `/admin/utensils/import` → alimente / met à jour `utensils_catalog` (UPsert sur `key`).
4. Revenir ensuite sur :
   - `/admin/recipes` et `/admin/recipes/[id]/edit` pour enrichir les recettes en s’appuyant sur ces catalogues (concepts, ingrédients, ustensiles),
   - `/admin/knowledge` / `/admin/ingredients` / `/admin/utensils` pour les ajustements fins unitaires.

### 3.9. SEO avancé & JSON-LD Recipe

Pour chaque recette, l’admin permet de piloter finement les champs SEO et de générer un JSON-LD conforme à Schema.org.

- Champs SEO dans `recipes` :
  - `meta_title`, `meta_description`, `canonical_url`, `og_image_url`.
- Module `src/lib/seo.ts` :
  - `buildRecipeJsonLd(recipe)` : construit un objet `@type: "Recipe"` à partir des données structurées.
  - `validateRecipeJsonLd(jsonLd)` : vérifie la présence des champs minimum (nom, description, image, ingrédients, instructions…).
- UI :
  - Sur `/admin/recipes/[id]/edit`, section “SEO avancé – JSON-LD Recipe” :
    - affiche le JSON-LD généré (lecture seule),
    - liste les éventuels warnings de validation,
    - expose un flag `schema_jsonld_enabled` pour indiquer au front public qu’il doit injecter ce JSON-LD.

---

## 4. Partie historique : back-office HTML minimal

En plus du nouvel espace admin sous `src/app/admin`, le projet contient un **backoffice historique** dans `src/pages/*` :

- Quelques pages HTML simples pour des opérations anciennes ou de debug.
- Ces pages ne sont pas destinées à évoluer significativement.
- Toute nouvelle fonctionnalité d’admin doit être ajoutée dans l’App Router (`src/app/admin/*`).

---

## 5. Résumé opérationnel

En pratique, l’usage attendu du backoffice Chefito est le suivant :

1. **Préparer les catalogues**  
   - Importer / maintenir :
     - la base de connaissances (`/admin/knowledge` + import CSV),
     - le catalogue d’ingrédients (`/admin/ingredients` + import CSV),
     - le catalogue d’ustensiles (`/admin/utensils` + import CSV).
2. **Planifier dans le calendrier éditorial**  
   - Utiliser `/admin/editorial-calendar` pour planifier les recettes de l’année (titre, mois, priorité, angle).
3. **Créer les recettes**  
   - Créer une recette depuis le calendrier ou directement via `/admin/recipes/create`.
4. **Enrichir les recettes**  
   - Remplir les champs éditoriaux, normaliser les ingrédients, enrichir les étapes, lier les concepts, associer les audios.
5. **Contrôler la qualité**  
   - Utiliser les badges de complétude et la validation pre‑publish pour s’assurer qu’une recette est “complète Chefito”.
6. **Publier & prévisualiser**  
   - Passer en `published`, puis vérifier le rendu via `/admin/recipes/[id]/preview`.

---

## 6. Architecture – vue d’ensemble

- **Front admin** : Next.js 15 (App Router) sous `/admin/*`.
- **Auth & données** : Supabase (PostgreSQL + Auth + Storage).
- **Clients DB** :
  - `supabase` : côté client, RLS activé, lecture/écriture standard.
  - `supabaseAdmin` : côté serveur uniquement, réservé aux opérations d’admin (fusion, tâches batch).
- **Données métier** :
  - `recipes` et tables associées (ingrédients normalisés, étapes enrichies, concepts liés).
  - `knowledge_base` pour les concepts.
  - `ingredients_catalog`, `utensils_catalog` pour les référentiels.
  - `editorial_calendar` pour le planning.
  - `audio_library`, `audio_mapping`, `audio_usage_stats` pour l’audio.
- **Docs complémentaires** :
  - `SECURITY.md` : modèle de sécurité complet.
  - `PRODUCTION_CHECKLIST.md` : checklist pré‑prod détaillée.
  - `AUDIT_FINAL.md` : audit qualité / sécurité du code.

---

## 7. Guide de prise en main en 5 minutes (par rôle)

### 7.1. Admin (usage actuel)

1. **Connexion**  
   - Aller sur `/auth/sign-in`, se connecter avec un compte dont `user_profiles.role = 'admin'`.
2. **Vérifier les catalogues**  
   - `~/admin/knowledge` : concepts principaux OK ?  
   - `~/admin/ingredients` : ingrédients socle importés ?  
   - `~/admin/utensils` : ustensiles socle importés ?
3. **Planifier quelques recettes**  
   - Sur `/admin/editorial-calendar`, créer quelques lignes (mois, priorité, angle).
4. **Créer une recette à partir d’une ligne éditoriale**  
   - Depuis le calendrier, cliquer sur “Créer la recette” → remplir les champs de base.
5. **Enrichir la recette**  
   - Onglet ingrédients normalisés : saisir les quantités structurées.  
   - Onglet étapes enrichies : rédiger des steps pédagogiques.  
   - Onglet concepts : lier 1–3 concepts de la knowledge base.  
   - Onglet SEO : vérifier le titre/meta et le JSON-LD.
6. **Publier**  
   - Cliquer sur “Publier”, corriger les points bloquants signalés par la modale si besoin.  
   - Prévisualiser via `/admin/recipes/[id]/preview`.

---

## 8. Installation & exécution locale

1. **Prérequis**  
   - Node.js 20.x  
   - npm ou pnpm

2. **Cloner le repo et installer les dépendances**

   ```bash
   git clone <url-du-repo>
   cd chefitorecette
   npm install
   ```

3. **Configuration locale**

   - Copier le fichier d’exemple :

     ```bash
     cp .env.example .env.local
     ```

   - Remplir dans `.env.local` :
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `NEXT_PUBLIC_SITE_URL`

4. **Lancer le dev server**

   ```bash
   npm run dev
   ```

   - L’admin est accessible sur `http://localhost:3000/admin` après connexion.

---

## 9. Configuration Supabase & environnement

- Voir `PRODUCTION_CHECKLIST.md` pour la checklist complète.
- Points clés :

  - **RLS** activé sur toutes les tables utilisées par l’admin.
  - `user_profiles` avec une colonne `role` (`admin`, `editor`, …).
  - Scripts SQL à exécuter au minimum :
    - `sql/editorial_calendar.sql`
    - `sql/indexes_recipes.sql`
    - `sql/knowledge_base_enrich.sql`
    - `sql/recipes_schema_jsonld.sql`

- Variables d’environnement obligatoires :

  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement)
  - `NEXT_PUBLIC_SITE_URL`

---

## 10. Déploiement

Pour un déploiement sur Vercel (ou plateforme équivalente) :

1. **Préparer l’environnement**  
   - Créer un projet, définir les variables d’environnement décrites ci‑dessus.  
   - Configurer Supabase (RLS, policies) selon `SECURITY.md` et `PRODUCTION_CHECKLIST.md`.

2. **Brancher le repo**  
   - Relier le dépôt GitHub à Vercel.  
   - S’assurer que la CI GitHub Actions est verte sur la branche de déploiement.

3. **Build & déploiement**  
   - Vercel exécutera automatiquement :
     - `npm install`
     - `npm run build`
   - L’app sera servie via `npm start` géré par Vercel.

4. **Tests post-déploiement**  
   - Suivre la section “Tests manuels” de `PRODUCTION_CHECKLIST.md` :
     - auth + reset password,
     - création/édition/publication de recette,
     - import CSV (editorial, knowledge, ingredients, utensils),
     - fusion de recettes,
     - upload image/audio.

En cas de doute ou d’évolution majeure, se référer à `AUDIT_FINAL.md` pour une vue d’ensemble des risques et bonnes pratiques.
