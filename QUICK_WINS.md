# Quick Wins – Backoffice Chefito

Objectif : 10 améliorations rapides **(≤ 1h chacune)** avec un impact significatif sur UX, performances ou sécurité.

---

## 1. Factoriser la logique de “recette complète”

- **Description**  
  Extraire `getRecipeMissingFields` et la logique associée (liste / edit) dans un module unique, par ex. `src/lib/recipesQuality.ts`.
- **Effort estimé** : 30–45 min  
- **Impact** : élevé (maintenabilité, cohérence métier)
- **Détails** :
  - Exporter une fonction `getRecipeMissingFields(recipe)` avec un type partagé.
  - L’utiliser dans :
    - `src/app/admin/recipes/page.tsx`
    - `src/app/admin/recipes/[id]/edit/page.tsx`
  - Mettre à jour la doc/README pour pointer vers ce module.

---

## 2. Plus de bruit CORS sur le dashboard RAG

- **Description**  
  Simplifier le dashboard pour ne plus dépendre des Edge Functions `redis-wrapper`, `s3-vectors-wrapper`, `vault-wrapper` tant qu'elles ne sont pas configurées dans Supabase.
- **Effort estimé** : 15–20 min  
- **Impact** : moyen/élevé (console propre, onboarding plus simple)
- **Détails** :
  - Modifier `src/lib/dashboard.ts` pour ne plus appeler `supabase.functions.invoke` sur ces wrappers.
  - Garder uniquement les stats qui dépendent des tables (`recipes`, `posts`, `user_profiles`).
  - Mettre à jour la doc pour préciser que les intégrations Redis/S3/Vault sont optionnelles et non requises pour utiliser l'admin.

---

## 3. StaleTime pour les données quasi-statiques (React Query)

- **Description**  
  Éviter les requêtes répétées pour les données stables (catégories, cuisines, knowledge base, audio library).
- **Effort estimé** : 20–30 min  
- **Impact** : moyen (performance, confort d’utilisation)
- **Détails** :
  - Ajouter `staleTime: 5 * 60 * 1000` ou `10 * 60 * 1000` dans :
    - `useQuery` sur `fetchCategories`, `fetchCuisines`,
    - `/admin/knowledge`, `/admin/audio`.
  - Optionnel : `cacheTime` plus long pour ces listes.

---

## 4. Bouton “Réinitialiser les filtres” sur `/admin/recipes`

- **Description**  
  Ajouter un bouton unique pour remettre tous les filtres (`statusFilter`, `difficultyFilter`, `categoryFilter`, `cuisineFilter`, `ragFilter`, `search`, `slugOrId`) à leurs valeurs par défaut.
- **Effort estimé** : 20–30 min  
- **Impact** : élevé (UX quotidienne pour les éditeurs)
- **Détails** :
  - Ajouter une fonction `resetFilters()` qui remet les `useState` aux valeurs initiales.
  - Bouton dans la barre de filtres avec un label type “Réinitialiser les filtres”.

---

## 5. Bouton “Réinitialiser les filtres” sur `/admin/editorial-calendar`

- **Description**  
  Même principe que pour les recettes : remettre `statusFilter`, `categoryFilter`, `difficultyFilter`, `monthFilter`, `priorityFilter`, `search`.
- **Effort estimé** : 20–30 min  
- **Impact** : moyen/élevé (productivité sur le calendrier)
- **Détails** :
  - Ajouter `resetFilters()` qui remet tous les filtres à `"all"` et vide la barre de recherche.
  - Bouton à côté des filtres existants.

---

## 6. Auto-remplissage de `difficulty_detailed` dans la page de création de recette

- **Description**  
  La page d’édition (`[id]/edit`) pré-remplit déjà `difficulty_detailed` à partir de `difficulty` via des templates. Répliquer ce comportement sur `/admin/recipes/create`.
- **Effort estimé** : 20–30 min  
- **Impact** : moyen (cohérence UX, gain de temps pour les éditeurs)
- **Détails** :
  - Reprendre `difficultyTemplates` utilisé dans l’edit ou l’extraire dans un module (`lib/recipesDifficulty.ts`).
  - Ajouter un `watch("difficulty")` + `useEffect` similaire dans la page create.

---

## 7. Liens de navigation croisés (recette ↔ calendrier éditorial)

- **Description**  
  Simplifier la navigation entre le calendrier et une recette liée.
- **Effort estimé** : 30–45 min  
- **Impact** : moyen/élevé (fluidité de travail)
- **Détails** :
  - Sur `/admin/recipes/[id]/edit` :
    - Si la recette a un `editorial_calendar` associé (requête légère ou champ dédié), afficher un lien “Voir dans le calendrier éditorial”.
  - Sur `/admin/editorial-calendar` :
    - Le lien “Voir recette” existe déjà, s’assurer qu’il est bien mis en avant.

---

## 8. Gestion des erreurs réseau génériques (toast global)

- **Description**  
  Ajouter un composant simple de type “toast” pour afficher les erreurs génériques (ex: erreur réseau sur React Query).
- **Effort estimé** : 45–60 min  
- **Impact** : élevé (visibilité des erreurs et support)
- **Détails** :
  - Créer un composant `Toast` ou utiliser un simple `portal` minimal.
  - Exposer un hook simple (`useToast`) pour afficher un message.
  - L’utiliser au moins dans :
    - `/admin/alerts` (fusion / statut alerte),
    - `/admin/recipes/[id]/edit` (échec de sauvegarde),
    - `/admin/editorial-calendar/import` (échec d’insert Supabase).

---

## 9. Ajout d’un “mode debug” visuel pour les infos RAG

- **Description**  
  Sur la page `/admin/recipes/[id]/edit`, afficher (en petit) les counts RAG (`ingredientsCount`, `stepsCount`, `conceptsCount`) à côté de la checklist.
- **Effort estimé** : 20–30 min  
- **Impact** : moyen (lisibilité pour data/ML)
- **Détails** :
  - La checklist RAG existe déjà, mais on peut ajouter par ex. `3/5`, `4/6` etc.
  - Utile pour diagnostiquer rapidement la complétude RAG d’une recette.

---

## 10. Documentation “Déploiement” rapide dans le README

- **Description**  
  Ajouter une section courte “Déploiement” dans `readme.md` qui résume les étapes et renvoie à `PRODUCTION_CHECKLIST.md`.
- **Effort estimé** : 15–20 min  
- **Impact** : moyen (onboarding & clarté)
- **Détails** :
  - Ajouter un paragraphe avec :
    - `npm run build` / `npm run start`,
    - lien vers `PRODUCTION_CHECKLIST.md`,
    - rappel de la configuration Supabase minimale (`.env.example`).

---

## Ordre recommandé d’implémentation

1. Factoriser la logique de “recette complète” (Quick Win 1).  
2. Auto-remplissage `difficulty_detailed` dans la page create (Quick Win 6).  
3. Boutons “Réinitialiser les filtres” (Quick Wins 4 & 5).  
4. Typer les stats Redis/S3/Vault (Quick Win 2).  
5. StaleTime React Query sur données stables (Quick Win 3).  
6. Liens de navigation croisés recette ↔ calendrier (Quick Win 7).  
7. Toast d’erreur global minimal (Quick Win 8).  
8. Améliorations RAG debug (Quick Win 9).  
9. Section “Déploiement” dans le README (Quick Win 10).

Ces actions sont peu coûteuses et renforcent immédiatement la **cohérence métier**, la **productivité éditoriale** et la **prévisibilité** du système en vue d’une mise en production.