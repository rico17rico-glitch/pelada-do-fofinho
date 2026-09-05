-- =====================================================================
-- Pelada do Fofinho — estrutura do banco
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em RUN.
-- Pode rodar de novo sem medo: nada é apagado.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Configuração da pelada (uma linha só)
-- ---------------------------------------------------------------------
create table if not exists config (
  id              int primary key default 1,
  pontos_vitoria  int  not null default 50,
  pontos_gol      int  not null default 5,
  pontos_assist   int  not null default 2,
  faixas          jsonb not null default
    '[{"ate":69,"preco":60},{"ate":79,"preco":120},{"ate":89,"preco":250},{"ate":99,"preco":500}]'::jsonb,
  admin_pin       text not null default '1234',
  qtd_times       int  not null default 3,
  regra_partida   text not null default '7 minutos ou 2 gols',
  nome_pelada     text not null default 'Pelada do Fofinho',
  constraint config_linha_unica check (id = 1)
);

insert into config (id) values (1) on conflict (id) do nothing;

-- Duração da partida e limite de gols (usados pelo cronômetro).
alter table config add column if not exists duracao_min int not null default 7;
alter table config add column if not exists gols_limite int not null default 2;

-- ---------------------------------------------------------------------
-- Jogadores
-- ---------------------------------------------------------------------
create table if not exists players (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  pos        text not null default 'ALA',        -- GOLEIRO | FIXO | ALA | PIVO
  alt        jsonb not null default '[]'::jsonb, -- outras posições que joga
  tipo       text not null default 'mensalista', -- mensalista | avulso
  ativo      boolean not null default true,
  pin        text not null default '',           -- 4 dígitos; vazio para avulso
  atr_fin    int not null default 65,
  atr_vis    int not null default 65,
  atr_def    int not null default 65,
  atr_int    int not null default 65,
  moedas     int not null default 0,
  stats      jsonb not null default
    '{"rodadas":0,"jogos":0,"v":0,"e":0,"d":0,"gols":0,"assist":0,"titulos":0,"moedasTotais":0}'::jsonb,
  historico  jsonb not null default '[]'::jsonb,
  criado_em  timestamptz not null default now()
);

create index if not exists players_nome_idx on players (lower(nome));

-- ---------------------------------------------------------------------
-- Rodadas
-- ---------------------------------------------------------------------
create table if not exists rounds (
  id        uuid primary key default gen_random_uuid(),
  data      date not null default current_date,
  nome      text,
  status    text not null default 'aberta',      -- aberta | finalizada
  present   jsonb not null default '[]'::jsonb,  -- ids dos confirmados
  teams     jsonb not null default '[]'::jsonb,  -- [{id,nome,cls,hex,slots:[{pos,playerId}]}]
  reservas  jsonb not null default '[]'::jsonb,
  matches   jsonb not null default '[]'::jsonb,  -- [{a,b,ga,gb}]
  stats     jsonb not null default '{}'::jsonb,  -- {playerId:{g,a}}
  campeao   text,
  premios   jsonb not null default '{}'::jsonb,  -- o que cada um ganhou (permite estornar)
  criado_em timestamptz not null default now()
);

create index if not exists rounds_data_idx on rounds (data desc);

-- Papel de organizador: manda nas rodadas igual ao mestre.
alter table players add column if not exists organizador boolean not null default false;

-- ---------------------------------------------------------------------
-- Caixa da pelada — lançamentos digitados na mão
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Segurança
-- O site inteiro conversa com o banco pelo servidor, usando a chave
-- service_role. Ninguém acessa estas tabelas direto do navegador, então
-- ligamos o RLS sem nenhuma política: acesso público = zero.
-- ---------------------------------------------------------------------
alter table config  enable row level security;
alter table players enable row level security;
alter table rounds  enable row level security;
alter table caixa   enable row level security;
