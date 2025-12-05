# Quick Wins – Backoffice Chefito

Objectif : 10 améliorations rapides **(≤ 1h chacune)** avec un impact significatif sur UX, performances ou sécurité.

---

## 1. Factoriser la logique de “recette complète” ✅ **(implémenté)**

- **Description**  
  Extraire `getRecipeMissingFields` et la logique associée (liste / edit) dans un module unique, par ex. `src/lib/recipesQuality.ts`.
- **Statut** : réalisé  
  - Nouveau module `src/lib/recipesQuality.ts` avec :
    - `getRecipeMissingFields(recipe)` pour la complétude éditoriale/SEO.
    - `computePrePublishIssues(values, options)` pour la validation pre‑publish.
  - Utilisé dans :
    - `src/app/admin/recipes/page.tsx`
    - `src/app/admin/recipes/[id]/edit/page.tsx`
  - Doc mise à jour (`readme.md`, `AUDIT_FINAL.md`).

- **Impact** : élevé (maintenabilité, cohérence métier)

---

## 2. Plus de bruit CORS sur le dashboard RAG ✅ **(implémenté)**

- **Description**  
  Simplifier le dashboard pour ne plus dépendre des Edge Functions `redis-wrapper`, `s3-vectors-wrapper`, `vault-wrapper` tant qu'elles ne sont pas configurées dans Supabase.
- **Statut** : réalisé  
  - `src/lib/dashboard.ts` ne fait plus appel à des fonctions Edge Redis/S3/Vault.
  - Les pages dashboard s’appuient uniquement sur les tables (`recipes`, `posts`, `user_profiles`) et affichent des panneaux descriptifs pour les intégrations.
  - Doc mise à jour (`CHANGELOG.md`, `readme.md`, `AUDIT_FINAL.md`) pour préciser que ces intégrations sont optionnelles.

- **Impact** : moyen/élevé (console propre, onboarding plus simple)

---

## 3. StaleTime pour les données quasi-statiques (React Query) ✅ **(implémenté)**

- **Description**  
  Éviter les requêtes répétées pour les données stables (catégories, cuisines, knowledge base, audio library).
- **Statut** : réalisé  
  - `staleTime: 10 * 60 * 1000` ajouté sur :
    - les listes de catégories et de cuisines utilisées sur `/admin/recipes`,
    - la base de connaissances (`/admin/knowledge`),
    - la bibliothèque audio et les mappings (`/admin/audio`).

- **Impact** : moyen (performance, confort d’utilisation)

---

## 4. Bouton “Réinitialiser les filtres” sur `/admin/recipes` ✅ **(implémenté)**

- **Description**  
  Ajouter un bouton unique pour remettre tous les filtres (`statusFilter`, `difficultyFilter`, `categoryFilter`, `cuisineFilter`, `ragFilter`, `search`, `slugOrId`) à leurs valeurs par défaut.
- **Statut** : réalisé  
  - Fonction `resetFilters()` ajoutée dans `src/app/admin/recipes/page.tsx` pour remettre tous les filtres à leur valeur initiale.
  - Bouton “Réinitialiser les filtres” ajouté dans la barre de filtres de la page `/admin/recipes`.

- **Impact** : élevé (UX quotidienne pour les éditeurs)

---

## 5. Bouton “Réinitialiser les filtres” sur `/admin/editorial-calendar` ✅ **(implémenté)**

- **Description**  
  Même principe que pour les recettes : remettre `statusFilter`, `categoryFilter`, `difficultyFilter`, `monthFilter`, `priorityFilter`, `search`.
- **Statut** : réalisé  
  - Fonction `resetFilters()` ajoutée dans `src/app/admin/editorial-calendar/page.tsx` pour remettre tous les filtres à `"all"` et vider la recherche.
  - Bouton “Réinitialiser les filtres” ajouté à côté de la barre de recherche sur `/admin/editorial-calendar`.

- **Impact** : moyen/élevé (productivité sur le calendrier)

---

## 6. Auto-remplissage de `difficulty_detailed` dans la page de création de recette ✅ **(implémenté)**

- **Description**  
  La page d’édition (`[id]/edit`) pré-remplit déjà `difficulty_detailed` à partir de `difficulty` via des templates. Répliquer ce comportement sur `/admin/recipes/create`.
- **Statut** : réalisé  
  - Nouveau module `src/lib/recipesDifficulty.ts` exportant `difficultyTemplates`.
  - Le module est utilisé :
    - dans `/admin/recipes/[id]/edit` (pour l’édition),
    - dans `/admin/recipes/create` (pour la création).
  - La page de création pré-remplit automatiquement `difficulty_detailed` en fonction de la difficulté choisie.

- **Impact** : moyen (cohérence UX, gain de temps pour les éditeurs)

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