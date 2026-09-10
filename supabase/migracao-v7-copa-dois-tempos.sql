-- =====================================================================
-- Pelada do Fofinho — v7: Copa Fofo com regra própria de tempo
-- Cole no SQL Editor do Supabase e clique em RUN.
-- Pode rodar de novo sem medo: nada é apagado.
-- =====================================================================

-- A Copa joga 2 tempos de 6 minutos; a pelada segue com 7 minutos ou 2 gols.
-- Editável em Ajustes.
alter table config add column if not exists copa_tempos      int not null default 2;
alter table config add column if not exists copa_duracao_min int not null default 6;

-- Os jogos já criados continuam como estavam (tempo único), porque o código
-- trata `tempos` ausente como 1. Edições novas — e fases geradas a partir de
-- agora — já nascem com dois tempos.
