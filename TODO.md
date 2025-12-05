# TODO – Backoffice Chefito

Liste des améliorations et chantiers restant à mener, classés par priorité.  
Le backoffice est un **outil interne** pour préparer/structurer les recettes pour le **RAG**, utilisé en pratique par **un admin unique**.

---

## ✅ Déjà fait (dans ce repo)

- **Factorisation de la qualité éditoriale & pre‑publish**
  - Nouveau module `src/lib/recipesQuality.ts` :
    - `getRecipeMissingFields(recipe)` pour la complétude éditoriale/SEO.
    - `computePrePublishIssues(values, options)` pour le blocage avant passage en `published`.
  - Utilisé dans :
    - `src/app/admin/recipes/page.tsx` (badges “recette complète / à enrichir”),
    - `src/app/admin/recipes/[id]/edit/page.tsx` (validation pre‑publish).
- **Prévisualisation recette dans l’admin**
  - Page `/admin/recipes/[id]/preview` (App Router) :
    - embarque un iframe vers `/recipes/[id]` (pages router),
    - accessible depuis un bouton “Prévisualiser la page publique” sur `/admin/recipes/[id]/edit`.
- **Dashboard RAG simplifié**
  - `src/lib/dashboard.ts` ne dépend plus des Edge Functions Redis/S3/Vault.
  - Les dashboards affichent des panneaux descriptifs plutôt que des métriques non disponibles.
- **Filtres “techno” & ustensiles**
  - `/admin/recipes` :
    - filtres “Conservation / service” et “Ustensiles”,
    - utilisation de `recipe_utensils` pour le badge 🔧 et le filtrage.
  - `/admin/utensils` :
    - page dédiée pour gérer le catalogue `utensils_catalog` + usage par recette (`recipe_utensils`).
- **UX filtres & données quasi-statiques**
  - Bouton “Réinitialiser les filtres” sur `/admin/recipes` et `/admin/editorial-calendar`.
  - `staleTime` configuré sur les listes stables : catégories/cuisines, knowledge base, audio.

Ces éléments sont reflétés dans `readme.md`, `CHANGELOG.md` et `AUDIT_FINAL.md`.

---

## 🔴 Haute priorité

- **RLS – vérification & durcissement global (à faire dans Supabase)**
  - Vérifier dans Supabase que toutes les tables utilisées par l’admin ont bien RLS activé :
    - `recipes`, `recipe_ingredients_normalized`, `recipe_steps_enhanced`,
      `recipe_concepts`, `knowledge_base`, `ingredients_catalog`,
      `audio_library`, `audio_mapping`, `recipe_similarity_alerts`,
      `recipe_relationships`, `audio_usage_stats`, `editorial_calendar`.
  - Appliquer des policies cohérentes avec `SECURITY.md` :
    - lecture `admin` (et éventuellement `editor` si réintroduit),
    - écriture `admin`.

- **Intégration front JSON-LD (hors de ce repo)**
  - Le backoffice génère déjà un JSON-LD complet + le flag `schema_jsonld_enabled` (`src/lib/seo.ts`).
  - À faire côté site public (autre repo) :
    - lire ce flag et injecter le JSON-LD dans `<script type="application/ld+json">`,
    - utiliser `NEXT_PUBLIC_SITE_URL` pour construire les URLs canoniques.

- **Tests E2E / smoke-tests**
  - Ajouter quelques tests de non-régression (Playwright/Cypress) pour :
    - flux création/édition/publication de recette (avec blocage pre‑publish),
    - flux d’import CSV éditorial,
    - route `/api/recipes/merge` (admin vs non admin),
    - upload image/audio.
  - Objectif : vérifier les flux critiques sans viser une couverture complète.

---

## 🟠 Priorité moyenne

- **Améliorer la robustesse de l’import CSV éditorial**
  - Utiliser une lib dédiée (`papaparse` par exemple) pour supporter :
    - guillemets, virgules internes, encodages variés.
  - Proposer une option “Télécharger les lignes en erreur” (CSV des lignes non importées).

- **UX calendrier éditorial**
  - Drag & drop entre colonnes dans la vue Kanban (`status` mis à jour en temps réel).
  - Édition inline de `chefito_angle`, catégorie et tags directement depuis la liste.

- **Toast d’erreur global simple**
  - Ajouter un composant minimal de type “toast” + hook `useToast`.
  - L’utiliser pour les erreurs réseau/mutation fréquentes :
    - `/admin/alerts` (fusion / statut alerte),
    - `/admin/recipes/[id]/edit` (échec de sauvegarde),
    - `/admin/editorial-calendar/import` (échec d’insert).

---

## 🟡 Priorité basse

- **Rate limiting côté infra**
  - Mettre en place un rate limit sur `/api/recipes/merge` et futures routes critiques via :
    - reverse proxy (NGINX, Traefik, Cloudflare, Vercel Edge Middleware…),
    - ou service WAF managé.

- **Journalisation d’audit**
  - Ajouter une table `admin_audit_log` :
    - trace des opérations sensibles (merge recettes, suppressions, changements de statut).
  - Intégrer l’écriture des logs dans les routes API ou via des triggers SQL.

Ce fichier sert de backlog minimal pour les prochaines itérations produit / sécurité.  
À mettre à jour au fur et à mesure des évolutions (en pratique : quand on touche à la sécurité, au RAG ou aux flux critiques).