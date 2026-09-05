-- =====================================================================
-- Migração v4 — Copa Fofo. Rode ANTES de publicar o código novo.
-- Cole no SQL Editor do Supabase e clique em RUN. Nada é apagado.
-- =====================================================================

create table if not exists copas (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  edicao    int,
  data      date,
  status    text not null default 'rascunho',   -- rascunho|draft|grupos|mata_mata|encerrada
  qtd_times int  not null default 5,
  elenco    jsonb not null default '[]'::jsonb, -- ids de quem disputa
  times     jsonb not null default '[]'::jsonb,
  draft     jsonb not null default '{"ordem":[],"passo":0}'::jsonb,
  jogos     jsonb not null default '[]'::jsonb,
  campeao   text,
  campeoes  jsonb not null default '[]'::jsonb, -- [{nome, playerId}] congelado no fim
  criado_em timestamptz not null default now()
);

create index if not exists copas_edicao_idx on copas (edicao desc nulls last);
alter table copas enable row level security;

-- As duas edições que já aconteceram, com o time campeão de cada uma.
insert into copas (nome, edicao, status, campeoes)
select 'Copa Fofo — 1ª edição', 1, 'encerrada',
  '[{"nome":"Carioca","playerId":null},{"nome":"Daniel","playerId":null},
    {"nome":"Marcão","playerId":null},{"nome":"Dog","playerId":null},
    {"nome":"Nathan","playerId":null}]'::jsonb
where not exists (select 1 from copas where edicao = 1);

insert into copas (nome, edicao, status, campeoes)
select 'Copa Fofo — 2ª edição', 2, 'encerrada',
  '[{"nome":"Bordallo","playerId":null},{"nome":"Marley","playerId":null},
    {"nome":"Hugo","playerId":null},{"nome":"Thales","playerId":null},
    {"nome":"Borel","playerId":null}]'::jsonb
where not exists (select 1 from copas where edicao = 2);
