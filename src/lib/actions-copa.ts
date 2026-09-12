"use server";

import { revalidatePath } from "next/cache";
import { db, lerConfig, lerJogador, lerJogadores, lerCopa, lerCopas } from "./db";
import { ehAdmin, lerSessao } from "./session";
import { Evento, Player, decorridoSeg, idCurto } from "./domain";
import {
  CORES_COPA, Copa, CopaJogo, campeaoDaCopa, draftTerminou, gerarFaseDeGrupos,
  gerarFinal, gerarSemifinais, jogadoresDisponiveis, semifinaisResolvidas,
  temProximoTempo, tempoAtual, timeDaVez,
} from "./copa";

type Resposta = { ok: boolean; erro?: string; msg?: string; id?: string };
const erro = (e: string): Resposta => ({ ok: false, erro: e });

function atualizarTudo() {
  revalidatePath("/", "layout");
}

async function ator(): Promise<{ admin: boolean; jogador: Player | null }> {
  const s = lerSessao();
  if (!s) return { admin: false, jogador: null };
  if (s.tipo === "admin") return { admin: true, jogador: null };
  return { admin: false, jogador: await lerJogador(s.playerId) };
}

/** Mestre ou organizador: monta e conduz a Copa. */
async function exigirOrganizador(): Promise<Resposta | null> {
  const a = await ator();
  if (a.admin || a.jogador?.organizador) return null;
  return erro("Só o mestre ou um organizador mexe na Copa.");
}

/** O acima, ou um capitão de time da Copa: pode apitar os jogos. */
async function exigirComandoCopa(copa: Copa): Promise<Resposta | null> {
  const a = await ator();
  if (a.admin || a.jogador?.organizador) return null;
  const eu = a.jogador?.id;
  if (eu && (copa.times || []).some((t) => t.capitao === eu)) return null;
  return erro("Só o mestre, um organizador ou um capitão pode mexer no jogo.");
}

async function salvar(id: string, patch: Partial<Copa>): Promise<Resposta> {
  const { error } = await db().from("copas").update(patch).eq("id", id);
  if (error) return erro(error.message);
  atualizarTudo();
  return { ok: true };
}

/** Duração de cada tempo e quantos tempos os jogos da Copa têm. */
async function regraDaCopa(): Promise<{ duracaoSeg: number; tempos: number }> {
  const cfg = await lerConfig();
  return {
    duracaoSeg: Math.max(30, (cfg.copa_duracao_min || 6) * 60),
    tempos: Math.max(1, Math.min(4, cfg.copa_tempos || 2)),
  };
}

/* =====================================================================
   Criar e apagar edições
   ===================================================================== */
export async function criarCopa(nome: string, edicao: number | null, data: string | null): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const limpo = (nome || "").trim();
  if (!limpo) return erro("Dê um nome para a edição.");

  const { data: nova, error } = await db()
    .from("copas")
    .insert({
      nome: limpo,
      edicao: edicao || null,
      data: data || null,
      status: "rascunho",
      qtd_times: 5,
    })
    .select("id")
    .single();
  if (error) return erro(error.message);
  atualizarTudo();
  return { ok: true, id: nova.id };
}

/** Edição antiga, registrada só pelo time campeão. */
export async function registrarEdicaoAntiga(
  nome: string, edicao: number | null, nomesCampeoes: string[]
): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const limpo = (nome || "").trim();
  if (!limpo) return erro("Dê um nome para a edição.");

  const elenco = await lerJogadores();
  const campeoes = nomesCampeoes
    .map((n) => (n || "").trim())
    .filter(Boolean)
    .map((n) => {
      const achado = elenco.find((p) => p.nome.trim().toLowerCase() === n.toLowerCase());
      return { nome: achado ? achado.nome : n, playerId: achado ? achado.id : null };
    });
  if (!campeoes.length) return erro("Coloque pelo menos um campeão.");

  const { error } = await db().from("copas").insert({
    nome: limpo, edicao: edicao || null, status: "encerrada", campeoes,
  });
  if (error) return erro(error.message);
  atualizarTudo();
  return { ok: true, msg: "Edição registrada na galeria." };
}

export async function excluirCopa(id: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const { error } = await db().from("copas").delete().eq("id", id);
  if (error) return erro(error.message);
  atualizarTudo();
  return { ok: true, msg: "Edição apagada." };
}

/* =====================================================================
   Elenco e capitães
   ===================================================================== */
export async function alternarParticipante(copaId: string, playerId: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const c = await lerCopa(copaId);
  if (!c) return erro("Edição não encontrada.");
  if (c.status !== "rascunho") return erro("O elenco já foi fechado nesta edição.");

  const atual = c.elenco || [];
  const novo = atual.includes(playerId) ? atual.filter((x) => x !== playerId) : [...atual, playerId];
  return salvar(copaId, { elenco: novo });
}

/** Fecha o elenco, define os capitães e abre o draft. */
export async function abrirDraft(copaId: string, capitaes: string[]): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const c = await lerCopa(copaId);
  if (!c) return erro("Edição não encontrada.");
  if (c.status !== "rascunho") return erro("O draft desta edição já foi aberto.");

  const limpos = Array.from(new Set(capitaes.filter(Boolean)));
  if (limpos.length < 2) return erro("Escolha pelo menos 2 capitães.");
  if (limpos.length > CORES_COPA.length) return erro(`No máximo ${CORES_COPA.length} times.`);
  const foraDoElenco = limpos.filter((id) => !(c.elenco || []).includes(id));
  if (foraDoElenco.length) return erro("Todo capitão precisa estar na lista de quem vai disputar.");
  if ((c.elenco || []).length < limpos.length * 2) {
    return erro("Poucos jogadores para esse tanto de time.");
  }

  const jogadores = await lerJogadores();
  const times = limpos.map((capId, i) => {
    const p = jogadores.find((x) => x.id === capId);
    const cor = CORES_COPA[i];
    return {
      id: "C" + (i + 1),
      nome: p ? `Time ${p.nome}` : cor.nome,
      cls: cor.cls,
      hex: cor.hex,
      capitao: capId,
      jogadores: [capId],
    };
  });

  return salvar(copaId, {
    status: "draft",
    qtd_times: times.length,
    times,
    draft: { ordem: times.map((t) => t.id), passo: 0 },
    jogos: [],
    campeao: null,
  });
}

export async function renomearTimeCopa(copaId: string, timeId: string, nome: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const c = await lerCopa(copaId);
  if (!c) return erro("Edição não encontrada.");
  const limpo = (nome || "").trim().slice(0, 40);
  if (!limpo) return erro("O time precisa de um nome.");
  const times = (c.times || []).map((t) => (t.id === timeId ? { ...t, nome: limpo } : t));
  return salvar(copaId, { times });
}

/* =====================================================================
   Draft
   ===================================================================== */
/* ---------------------------------------------------------------------
   Substituir jogador num time de uma edição que já começou.
   Acontece: o cara desiste na véspera e outro entra no lugar.
   Os gols já marcados continuam de quem marcou — o placar dos jogos
   disputados não pode mudar por causa de uma troca de elenco.
   --------------------------------------------------------------------- */
export async function substituirNaCopa(
  copaId: string, timeId: string, saiId: string, entraId: string
): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  if (saiId === entraId) return erro("Escolha um jogador diferente.");

  const c = await lerCopa(copaId);
  if (!c) return erro("Edição não encontrada.");
  if (c.status === "encerrada") return erro("Esta edição já foi encerrada.");

  const time = (c.times || []).find((t) => t.id === timeId);
  if (!time) return erro("Time não encontrado.");
  if (!time.jogadores.includes(saiId)) return erro("Esse jogador não está nesse time.");

  const jaNaCopa = (c.times || []).some((t) => t.jogadores.includes(entraId));
  if (jaNaCopa) return erro("Quem entra já está em um time desta edição.");

  const entra = await lerJogador(entraId);
  if (!entra) return erro("Jogador não encontrado.");
  if (entra.ativo === false) return erro("Esse jogador está inativo no elenco da pelada.");
  const sai = await lerJogador(saiId);

  /* troca na mesma posição da lista, para o time não embaralhar */
  const times = (c.times || []).map((t) =>
    t.id !== timeId
      ? t
      : {
          ...t,
          jogadores: t.jogadores.map((id) => (id === saiId ? entraId : id)),
          /* quem entra herda a braçadeira se o que saiu era o capitão */
          capitao: t.capitao === saiId ? entraId : t.capitao,
        }
  );

  const elenco = Array.from(
    new Set([...(c.elenco || []).filter((id) => id !== saiId), entraId])
  );

  const { error } = await db().from("copas").update({ times, elenco }).eq("id", copaId);
  if (error) return erro(error.message);
  atualizarTudo();

  const virouCapitao = time.capitao === saiId;
  return {
    ok: true,
    msg: `${entra.nome} entrou no lugar de ${sai?.nome || "quem saiu"}${virouCapitao ? " e ficou com a braçadeira." : "."}`,
  };
}

export async function escolherNoDraft(copaId: string, playerId: string): Promise<Resposta> {
  const c = await lerCopa(copaId);
  if (!c) return erro("Edição não encontrada.");
  if (c.status !== "draft") return erro("O draft desta edição não está aberto.");

  const vez = timeDaVez(c);
  if (!vez) return erro("O draft já acabou.");

  /* Quem escolhe: mestre, organizador ou o capitão da vez. */
  const a = await ator();
  const time = (c.times || []).find((t) => t.id === vez);
  const podeEscolher = a.admin || a.jogador?.organizador || (a.jogador && time?.capitao === a.jogador.id);
  if (!podeEscolher) return erro("Agora é a vez de outro capitão escolher.");

  if (!jogadoresDisponiveis(c).includes(playerId)) return erro("Esse jogador já foi escolhido.");

  const times = (c.times || []).map((t) =>
    t.id === vez ? { ...t, jogadores: [...t.jogadores, playerId] } : t
  );
  return salvar(copaId, { times, draft: { ...c.draft, passo: (c.draft?.passo || 0) + 1 } });
}

export async function desfazerEscolha(copaId: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const c = await lerCopa(copaId);
  if (!c || c.status !== "draft") return erro("O draft não está aberto.");
  const passo = (c.draft?.passo || 0) - 1;
  if (passo < 0) return erro("Não há escolha para desfazer.");

  /* volta um passo e tira o último jogador daquele time */
  const anterior = { ...c, draft: { ...c.draft, passo } };
  const vez = timeDaVez(anterior) || (c.times || [])[0]?.id;
  const times = (c.times || []).map((t) => {
    if (t.id !== vez || t.jogadores.length <= 1) return t;
    return { ...t, jogadores: t.jogadores.slice(0, -1) };
  });
  return salvar(copaId, { times, draft: { ...c.draft, passo } });
}

export async function iniciarFaseDeGrupos(copaId: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const c = await lerCopa(copaId);
  if (!c) return erro("Edição não encontrada.");
  if (c.status !== "draft") return erro("Abra o draft antes.");
  if (!draftTerminou(c)) return erro("Ainda tem gente para escolher no draft.");

  const regra = await regraDaCopa();
  const jogos = gerarFaseDeGrupos((c.times || []).map((t) => t.id), regra.duracaoSeg, regra.tempos);
  return salvar(copaId, { status: "grupos", jogos });
}

/* =====================================================================
   Jogos
   ===================================================================== */
async function comJogo(
  copaId: string,
  jogoId: string,
  fn: (j: CopaJogo, c: Copa) => CopaJogo | { erro: string }
): Promise<Resposta> {
  const c = await lerCopa(copaId);
  if (!c) return erro("Edição não encontrada.");
  if (c.status === "encerrada") return erro("Esta edição já foi encerrada.");
  const negado = await exigirComandoCopa(c);
  if (negado) return negado;

  const jogos = (c.jogos || []).slice();
  const i = jogos.findIndex((j) => j.id === jogoId);
  if (i < 0) return erro("Jogo não encontrado.");
  const saida = fn({ ...jogos[i] }, c);
  if ("erro" in saida) return erro(saida.erro as string);
  jogos[i] = saida;
  return salvar(copaId, { jogos });
}

export async function iniciarJogo(copaId: string, jogoId: string): Promise<Resposta> {
  /* Jogo que ainda não começou pega a regra vigente da Copa. Sem isso, uma fase
     gerada antes de a regra mudar ficaria presa no tempo antigo para sempre. */
  const regra = await regraDaCopa();
  return comJogo(copaId, jogoId, (j) => {
    const novo = j.status === "pendente"
      ? { ...j, duracaoSeg: regra.duracaoSeg, tempos: regra.tempos, tempo: 1, jogadoSeg: 0, acumuladoSeg: 0 }
      : j;
    return { ...novo, status: "andamento" as const, rodando: true, iniciadoEm: new Date().toISOString() };
  });
}

export async function pausarJogo(copaId: string, jogoId: string): Promise<Resposta> {
  return comJogo(copaId, jogoId, (j) => ({
    ...j, rodando: false, acumuladoSeg: tempo(j), iniciadoEm: null,
  }));
}

export async function zerarJogo(copaId: string, jogoId: string): Promise<Resposta> {
  return comJogo(copaId, jogoId, (j) => ({ ...j, rodando: false, acumuladoSeg: 0, iniciadoEm: null }));
}

/** Fecha o tempo corrente e deixa o próximo pronto para começar. */
export async function virarTempo(copaId: string, jogoId: string): Promise<Resposta> {
  const c = await lerCopa(copaId);
  const j = (c?.jogos || []).find((x) => x.id === jogoId);
  if (!j) return erro("Jogo não encontrado.");
  if (!temProximoTempo(j)) return erro("Esse jogo já está no último tempo.");

  const proximo = tempoAtual(j) + 1;
  const resp = await comJogo(copaId, jogoId, (x) => ({
    ...x,
    tempo: proximo,
    /* o que já rolou fica guardado para o relógio total e para os lances */
    jogadoSeg: (x.jogadoSeg || 0) + Math.round(tempo(x)),
    acumuladoSeg: 0,
    rodando: false,
    iniciadoEm: null,
    status: "andamento" as const,
  }));
  return resp.ok ? { ok: true, msg: `Fim do ${tempoAtual(j)}º tempo.` } : resp;
}

export async function encerrarJogo(copaId: string, jogoId: string): Promise<Resposta> {
  return comJogo(copaId, jogoId, (j) => ({
    ...j, status: "encerrada", rodando: false, acumuladoSeg: tempo(j), iniciadoEm: null,
  }));
}

export async function reabrirJogo(copaId: string, jogoId: string): Promise<Resposta> {
  return comJogo(copaId, jogoId, (j) => ({ ...j, status: "andamento" }));
}

export async function registrarLanceCopa(
  copaId: string, jogoId: string, lance: { t: "gol" | "assist"; teamId: string; playerId: string | null }
): Promise<Resposta> {
  return comJogo(copaId, jogoId, (j) => {
    if (lance.teamId !== j.a && lance.teamId !== j.b) return { erro: "Time fora deste jogo." };
    const evento: Evento = {
      id: idCurto("e_"), t: lance.t, teamId: lance.teamId,
      playerId: lance.playerId, seg: Math.round((j.jogadoSeg || 0) + tempo(j)),
    };
    return { ...j, eventos: [...(j.eventos || []), evento] };
  });
}

export async function removerLanceCopa(copaId: string, jogoId: string, eventoId: string): Promise<Resposta> {
  return comJogo(copaId, jogoId, (j) => ({
    ...j, eventos: (j.eventos || []).filter((e) => e.id !== eventoId),
  }));
}

export async function registrarPenaltis(
  copaId: string, jogoId: string, penA: number, penB: number
): Promise<Resposta> {
  return comJogo(copaId, jogoId, (j) => {
    if (j.fase === "grupo") return { erro: "Pênaltis só valem no mata-mata." };
    const a = Math.max(0, Math.round(Number(penA) || 0));
    const b = Math.max(0, Math.round(Number(penB) || 0));
    if (a === b) return { erro: "Nos pênaltis alguém tem que passar — não pode empatar." };
    return { ...j, penA: a, penB: b };
  });
}

const tempo = (j: CopaJogo) =>
  decorridoSeg({ a: j.a, b: j.b, acumuladoSeg: j.acumuladoSeg, rodando: j.rodando, iniciadoEm: j.iniciadoEm }, Date.now());

/* =====================================================================
   Avanço das fases
   ===================================================================== */
export async function sortearMataMata(copaId: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const c = await lerCopa(copaId);
  if (!c) return erro("Edição não encontrada.");
  if ((c.jogos || []).some((j) => j.fase === "semi")) return erro("O mata-mata já foi sorteado.");

  const grupo = (c.jogos || []).filter((j) => j.fase === "grupo");
  if (!grupo.length) return erro("Gere a fase de grupos antes.");
  if (grupo.some((j) => j.status !== "encerrada")) return erro("Ainda tem jogo da fase de grupos em aberto.");

  const regraSemi = await regraDaCopa();
  const { jogos: semis } = gerarSemifinais(c, regraSemi.duracaoSeg, regraSemi.tempos);
  if (semis.length !== 2) return erro("Não deu para montar as semifinais.");
  return salvar(copaId, { status: "mata_mata", jogos: [...(c.jogos || []), ...semis] });
}

export async function gerarJogoFinal(copaId: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const c = await lerCopa(copaId);
  if (!c) return erro("Edição não encontrada.");
  if ((c.jogos || []).some((j) => j.fase === "final")) return erro("A final já foi criada.");
  if (!semifinaisResolvidas(c)) return erro("Resolva as duas semifinais primeiro — inclusive os pênaltis.");

  const regraFinal = await regraDaCopa();
  const final = gerarFinal(c, regraFinal.duracaoSeg, regraFinal.tempos);
  if (!final) return erro("Não deu para montar a final.");
  return salvar(copaId, { jogos: [...(c.jogos || []), final] });
}

export async function encerrarCopa(copaId: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const c = await lerCopa(copaId);
  if (!c) return erro("Edição não encontrada.");

  const campeao = campeaoDaCopa(c);
  if (!campeao) return erro("A final ainda não tem vencedor definido.");

  const time = (c.times || []).find((t) => t.id === campeao);
  const jogadores = await lerJogadores();
  const campeoes = (time?.jogadores || []).map((id) => {
    const p = jogadores.find((x) => x.id === id);
    return { nome: p ? p.nome : "—", playerId: p ? p.id : null };
  });

  return salvar(copaId, { status: "encerrada", campeao, campeoes });
}

export async function reabrirCopa(copaId: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const c = await lerCopa(copaId);
  if (!c) return erro("Edição não encontrada.");
  if (!(c.jogos || []).length) return erro("Esta edição é só um registro histórico, não tem jogos.");
  return salvar(copaId, { status: "mata_mata", campeao: null, campeoes: [] });
}
