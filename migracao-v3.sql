-- =====================================================================
-- Migração v3 — rode ANTES de publicar a nova versão do site.
-- Cole no SQL Editor do Supabase e clique em RUN. Nada é apagado.
-- =====================================================================

-- 1. Papel de organizador: manda nas rodadas igual ao mestre.
alter table players add column if not exists organizador boolean not null default false;

-- 2. Caixa da pelada.
create table if not exists caixa (
  id         uuid primary key default gen_random_uuid(),
  data       date not null default current_date,
  descricao  text not null,
  tipo       text not null default 'saida',   -- entrada | saida
  valor      numeric(12,2) not null default 0,
  categoria  text,
  criado_por text,
  criado_em  timestamptz not null default now()
);
create index if not exists caixa_data_idx on caixa (data desc);
alter table caixa enable row level security;

-- 3. Avulsos antigos ficaram sem PIN. Gera um de 4 dígitos para cada um
--    (o PIN aparece na aba Elenco, na coluna PIN).
update players
   set pin = (1000 + floor(random() * 9000))::int::text
 where coalesce(pin, '') = '';
