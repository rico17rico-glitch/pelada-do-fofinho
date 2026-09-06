-- =====================================================================
-- Pelada do Fofinho — v6: pagamentos da diária por rodada
-- Cole no SQL Editor do Supabase e clique em RUN.
-- Pode rodar de novo sem medo: nada é apagado.
-- =====================================================================

-- Quanto cada avulso paga por dia. Editável na própria tela da rodada.
alter table config add column if not exists valor_avulso numeric(12,2) not null default 12;

-- Quem já acertou a diária, rodada a rodada.
-- Formato: { "<playerId>": { "valor": 12, "lancamentoId": "<uuid ou null>", "em": "<iso>" } }
-- A chave existir já significa pago. Mensalista não entra aqui: está pago
-- pela mensalidade e não gera lançamento no caixa.
alter table rounds add column if not exists pagamentos jsonb not null default '{}'::jsonb;
