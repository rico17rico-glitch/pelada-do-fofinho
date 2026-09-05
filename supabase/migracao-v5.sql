-- =====================================================================
-- Migração v5 — foto do jogador. Rode ANTES de publicar o código novo.
-- Cole no SQL Editor do Supabase e clique em RUN. Nada é apagado.
-- =====================================================================

-- Endereço da foto de cada jogador.
alter table players add column if not exists foto_url text;

-- Pasta pública para as fotos. Só o servidor grava; qualquer um lê.
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;
