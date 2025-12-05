# Backoffice Chefito – Admin recettes enrichies

![CI](https://github.com/Soofmaax/chefitorecette/actions/workflows/ci.yml/badge.svg)
![Status](https://img.shields.io/badge/status-private-informational)
![Framework](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)
![Runtime](https://img.shields.io/badge/Node-20.x-339933?logo=node.js)
![Language](https://img.shields.io/badge/TypeScript-5.x-3178C?logo=typescript)

Ce projet combine :

- Un backoffice historique minimal (pages router) pour certaines opérations.
- Un nouvel **espace admin recettes enrichies en App Router** sous `/admin/*` optimisé pour l’enrichissement de recettes.

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
- Lien vers la fiche d’édition enrichie :
Ces règles alignent le statut `published` sur la définition d’une recette complète (au sens Chefito).
- D’**exploiter les embeddings** comme couche technique optionnelle (RAG/recherche) sans qu’ils bloquent la qualité éditoriale.
- ✅ `complète` = tous les critères éditoriaux/SEO remplis.
- En haut, regarder le panneau “Qualité éditoriale & actions rapides” :
- Regarder à nouveau ce panneau :
- Si tous les critères sont remplis, la recette passe en “recette complète”.
- Recettes publiées mais encore “à enrichir” peuvent être complétées a posteriori.
- La qualité éditoriale reste indépendante de l’IA (uniquement éditorial/SEO).
Après cette configuration, le backoffice est prêt à être utilisé comme **outil interne de gestion de contenu enrichi et de structuration RAG**.
