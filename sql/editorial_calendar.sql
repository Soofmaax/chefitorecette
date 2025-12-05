-- Création de la table editorial_calendar pour le calendrier éditorial
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

-- Mise à jour automatique du champ updated_at
create or replace function public.set_editorial_calendar_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_editorial_calendar_updated_at on public.editorial_calendar;

create trigger trg_editorial_calendar_updated_at
before update on public.editorial_calendar
for each row execute function public.set_editorial_calendar_updated_at();

-- Index utiles pour les filtres
create index if not exists editorial_calendar_target_month_idx
  on public.editorial_calendar (target_month);

create index if not exists editorial_calendar_status_idx
  on public.editorial_calendar (status);

create index if not exists editorial_calendar_priority_idx
  on public.editorial_calendar (priority desc);

-- Sécurité : activer le RLS
alter table public.editorial_calendar enable row level security;

-- Lecture : admins et éditeurs uniquement
drop policy if exists editorial_calendar_select on public.editorial_calendar;

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
drop policy if exists editorial_calendar_modify on public.editorial_calendar;

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