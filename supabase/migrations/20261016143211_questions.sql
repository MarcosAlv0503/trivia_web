-- Categorías, preguntas y sus traducciones.
-- El cliente no puede leer ninguna de estas tablas: las preguntas se sirven (sin marcar la correcta)
-- y se validan solo a través de las RPC del juego.

create table public.categories (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  color text not null check (color ~ '^#[0-9A-F]{6}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.category_translations (
  category_id text not null references public.categories (id) on delete cascade,
  locale text not null check (locale in ('es', 'en')),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 40),
  primary key (category_id, locale)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  -- Identificador estable en el origen (p. ej. el pipeline de IA): permite reimportar sin duplicar.
  external_id text not null unique check (char_length(external_id) between 1 and 100),
  category_id text not null references public.categories (id),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  source text not null check (source in ('ai', 'manual', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index questions_playable_idx on public.questions (difficulty) where status = 'approved';

create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

create table public.question_translations (
  question_id uuid not null references public.questions (id) on delete cascade,
  locale text not null check (locale in ('es', 'en')),
  prompt text not null check (prompt = btrim(prompt) and char_length(prompt) between 1 and 300),
  -- La PRIMERA respuesta es la correcta; el orden se baraja en servidor al servir la pregunta.
  answers text[] not null check (
    array_ndims(answers) = 1
    and cardinality(answers) between 2 and 6
    and array_position(answers, null) is null
  ),
  primary key (question_id, locale)
);

alter table public.categories enable row level security;
alter table public.category_translations enable row level security;
alter table public.questions enable row level security;
alter table public.question_translations enable row level security;

-- Sin políticas ni permisos para anon/authenticated: solo las funciones del juego (security definer) y
-- la importación (service_role) acceden a estas tablas.
revoke all on public.categories, public.category_translations, public.questions,
  public.question_translations from anon, authenticated;

-- Categorías iniciales (datos de referencia necesarios también en producción). Colores aprobados en la Fase 1.
insert into public.categories (id, color, sort_order) values
  ('geography', '#2ECC8F', 1),
  ('history', '#D9964A', 2),
  ('science', '#2EC4E6', 3),
  ('art-literature', '#9B7BFF', 4),
  ('entertainment', '#FF7A45', 5),
  ('sports', '#F5C431', 6),
  ('technology', '#5C7CFA', 7);

insert into public.category_translations (category_id, locale, name) values
  ('geography', 'es', 'Geografía'),
  ('geography', 'en', 'Geography'),
  ('history', 'es', 'Historia'),
  ('history', 'en', 'History'),
  ('science', 'es', 'Ciencia y Naturaleza'),
  ('science', 'en', 'Science & Nature'),
  ('art-literature', 'es', 'Arte y Literatura'),
  ('art-literature', 'en', 'Art & Literature'),
  ('entertainment', 'es', 'Entretenimiento'),
  ('entertainment', 'en', 'Entertainment'),
  ('sports', 'es', 'Deportes'),
  ('sports', 'en', 'Sports'),
  ('technology', 'es', 'Tecnología'),
  ('technology', 'en', 'Technology');

-- Importación masiva (alta o actualización por `externalId`). Solo para service_role (scripts/import-questions.mts).
-- Formato de cada elemento:
--   { "externalId", "category", "difficulty", "status"?, "source",
--     "translations": { "<locale>": { "prompt", "correct", "wrong": [...] } } }
-- Las traducciones de cada pregunta se sustituyen por completo. Un error en cualquier pregunta anula el lote.
create function public.import_questions(items jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  tr record;
  qid uuid;
  answers text[];
  total integer := 0;
begin
  if jsonb_typeof(items) is distinct from 'array' then
    raise exception 'se esperaba un array de preguntas';
  end if;

  for item in select value from jsonb_array_elements(items) loop
    begin
      if jsonb_typeof(item -> 'translations') is distinct from 'object'
         or item -> 'translations' = '{}'::jsonb then
        raise exception 'faltan las traducciones';
      end if;

      insert into public.questions (external_id, category_id, difficulty, status, source)
      values (
        item ->> 'externalId',
        item ->> 'category',
        item ->> 'difficulty',
        coalesce(item ->> 'status', 'draft'),
        item ->> 'source'
      )
      on conflict (external_id) do update
        set category_id = excluded.category_id,
            difficulty = excluded.difficulty,
            status = excluded.status,
            source = excluded.source
      returning id into qid;

      delete from public.question_translations where question_id = qid;

      for tr in select key as locale, value from jsonb_each(item -> 'translations') loop
        if jsonb_typeof(tr.value -> 'wrong') is distinct from 'array' then
          raise exception '[%] "wrong" debe ser un array', tr.locale;
        end if;
        answers := array[btrim(tr.value ->> 'correct')]
          || array(select btrim(a) from jsonb_array_elements_text(tr.value -> 'wrong') as a);
        if exists (select 1 from unnest(answers) as a where a is null or a = '' or char_length(a) > 120) then
          raise exception '[%] respuestas vacías o de más de 120 caracteres', tr.locale;
        end if;
        if (select count(distinct lower(a)) from unnest(answers) as a) <> cardinality(answers) then
          raise exception '[%] respuestas repetidas', tr.locale;
        end if;

        insert into public.question_translations (question_id, locale, prompt, answers)
        values (qid, tr.locale, btrim(tr.value ->> 'prompt'), answers);
      end loop;
    exception when others then
      raise exception 'pregunta %: %', coalesce(item ->> 'externalId', '(sin externalId)'), sqlerrm;
    end;
    total := total + 1;
  end loop;

  return total;
end;
$$;

revoke execute on function public.import_questions(jsonb) from public, anon, authenticated;
grant execute on function public.import_questions(jsonb) to service_role;
