-- Enrichissement de la table knowledge_base pour un RAG plus riche.
-- À exécuter dans le SQL editor de Supabase.

alter table public.knowledge_base
  add column if not exists short_definition text,
  add column if not exists long_explanation text,
  add column if not exists synonyms text[];