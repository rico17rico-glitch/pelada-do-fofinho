"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, lerConfig, lerJogador, lerJogadores, lerRodada } from "./db";
import { ehAdmin, gravarSessao, lerSessao, limparSessao } from "./session";
import {
  ATTRS, AttrKey, Evento, Pagamento, Player, Pos, POSITIONS, Round, STATS_ZERO, calcularPremiacao,
  decorridoSeg, formatarData, gerarPin, idCurto, ovr, permissoesDaRodada, precoUpgrade,
  sortearTimes, textoRegra, TipoLancamento, timesSemCapitao, trocarNaEscalacao,
} from "./domain";

type Resposta = { ok: boolean; erro?: string; msg?: string; pin?: string };

const OK: Resposta = { ok: true };
const erro = (e: string): Resposta => ({ ok: false, erro: e });

function atualizarTudo() {
  revalidatePath("/", "layout");
}

async function exigirAdmin(): Promise<Resposta | null> {
  const s = lerSessao();
  if (!ehAdmin(s)) return erro("Só o mestre da pelada pode fazer isso.");
  return null;
}

/** Quem está usando o site agora: o mestre ou um jogador logado. */
async function ator(): Promise<{ admin: boolean; jogador: Player | null }> {
  const s = lerSessao();
  if (!s) return { admin: false, jogador: null };
  if (s.tipo === "admin") return { admin: true, jogador: null };
  return { admin: false, jogador: await lerJogador(s.playerId) };
}

/** Mestre ou organizador: manda em tudo dentro das rodadas. */
async function exigirOrganizador(): Promise<Resposta | null> {
  const a = await ator();
  if (a.admin || a.jogador?.organizador) return null;
  return erro("Só o mestre ou um organizador pode fazer isso.");
}

/** Mestre, organizador ou capitão de um dos times: pode apitar as partidas. */
async function exigirComando(r: Round): Promise<Resposta | null> {
  const a = await ator();
  if (permissoesDaRodada(r, a).gerirPartidas) return null;
  return erro("Só o mestre, um organizador ou o capitão de um time pode mexer na partida.");
}

/* =====================================================================
   Entrar e sair
   ===================================================================== */
export async function entrarComoJogador(playerId: string, pin: string): Promise<Resposta> {
  if (!playerId) return erro("Escolha seu nome na lista.");
  const { data } = await db().from("players").select("id,nome,pin,ativo").eq("id", playerId).maybeSingle();
  if (!data) return erro("Jogador não encontrado.");
  if (data.ativo === false) return erro("Esse jogador está inativo. Fale com o mestre da pelada.");
  if (!data.pin || data.pin !== String(pin || "").trim()) return erro("PIN incorreto.");
  gravarSessao({ tipo: "jogador", playerId: data.id });
  return { ok: true, msg: `E aí, ${data.nome}!` };
}

export async function entrarComoAdmin(pin: string): Promise<Resposta> {
  const cfg = await lerConfig();
  if (String(pin || "").trim() !== String(cfg.admin_pin)) return erro("PIN do mestre incorreto.");
  gravarSessao({ tipo: "admin" });
  return { ok: true, msg: "Bem-vindo, mestre da pelada." };
}

export async function sair(): Promise<void> {
  limparSessao();
  redirect("/");
}

/* =====================================================================
   Jogadores
   ===================================================================== */
export type FormJogador = {
  id?: string;
  nome: string;
  pos: Pos;
  alt: Pos[];
  tipo: "mensalista" | "avulso";
  base?: number;
  atr?: Record<AttrKey, number>;
  moedas?: number;
  pin?: string;
  ativo?: boolean;
  organizador?: boolean;
};

export async function salvarJogador(form: FormJogador): Promise<Resposta> {
  /* O mestre faz tudo. O organizador só cadastra avulso, para completar o time. */
  const a = await ator();
  const soAvulsoNovo = !form.id && form.tipo === "avulso";
  if (!a.admin && !(a.jogador?.organizador && soAvulsoNovo)) {
    return erro(
      a.jogador?.organizador
        ? "Organizador só cadastra jogador avulso. Fale com o mestre para mexer no elenco."
        : "Só o mestre da pelada pode fazer isso."
    );
  }

  const nome = (form.nome || "").trim();
  if (!nome) return erro("Coloque o nome do jogador.");
  const alt = (form.alt || []).filter((x) => x !== form.pos);

  if (form.id) {
    const patch: Record<string, unknown> = {
      nome, pos: form.pos, alt, tipo: form.tipo,
      ativo: form.ativo !== false,
      organizador: !!form.organizador,
      pin: (form.pin || "").trim(),
      moedas: Math.max(0, Number(form.moedas) || 0),
    };
    for (const a of ATTRS) {
      const v = Number(form.atr?.[a.k]);
      patch["atr_" + a.k] = Math.max(1, Math.min(99, isNaN(v) ? 65 : v));
    }
    const { error } = await db().from("players").update(patch).eq("id", form.id);
    if (error) return erro(error.message);
  } else {
    const base = Math.max(1, Math.min(99, Number(form.base) || 65));
    /* Todo jogador entra com PIN — avulso também acompanha os próprios números. */
    const pin = gerarPin();
    const { error } = await db().from("players").insert({
      nome, pos: form.pos, alt, tipo: form.tipo, ativo: true,
      pin,
      atr_fin: base, atr_vis: base, atr_def: base, atr_int: base,
      moedas: 0, stats: STATS_ZERO, historico: [],
    });
    if (error) return erro(error.message);
    atualizarTudo();
    return { ok: true, msg: `${nome} cadastrado. PIN ${pin}.`, pin };
  }
  atualizarTudo();
  return OK;
}

export async function excluirJogador(id: string): Promise<Resposta> {
  const negado = await exigirAdmin();
  if (negado) return negado;
  const { error } = await db().from("players").delete().eq("id", id);
  if (error) return erro(error.message);
  atualizarTudo();
  return OK;
}

export async function criarElencoExemplo(): Promise<Resposta> {
  const negado = await exigirAdmin();
  if (negado) return negado;
  const exemplo: [string, Pos, number][] = [
    ["Fofinho", "PIVO", 75], ["Gordo", "GOLEIRO", 70], ["Serginho", "ALA", 80],
    ["Tiaguinho", "FIXO", 70], ["Betão", "ALA", 65], ["Careca", "GOLEIRO", 65],
    ["Juninho", "ALA", 75], ["Marcão", "FIXO", 75], ["Rafa", "PIVO", 70],
    ["Léo", "ALA", 60], ["Pedrão", "FIXO", 65], ["Índio", "ALA", 70],
    ["Duda", "PIVO", 65], ["Ceará", "GOLEIRO", 60], ["Vitinho", "ALA", 80],
  ];
  const existentes = (await lerJogadores()).map((p) => p.nome.toLowerCase());
  const novos = exemplo
    .filter(([nome]) => !existentes.includes(nome.toLowerCase()))
    .map(([nome, pos, base]) => ({
      nome, pos, alt: [], tipo: "mensalista", ativo: true, pin: gerarPin(),
      atr_fin: base, atr_vis: base, atr_def: base, atr_int: base,
      moedas: 0, stats: STATS_ZERO, historico: [],
    }));
  if (novos.length) {
    const { error } = await db().from("players").insert(novos);
    if (error) return erro(error.message);
  }
  atualizarTudo();
  return { ok: true, msg: `${novos.length} jogadores de exemplo criados.` };
}

/* =====================================================================
   Loja
   ===================================================================== */
export async function comprarAtributo(playerId: string, attr: AttrKey): Promise<Resposta> {
  const s = lerSessao();
  const podeGastar = ehAdmin(s) || (s && s.tipo === "jogador" && s.playerId === playerId);
  if (!podeGastar) return erro("Você só pode gastar os seus próprios pontos.");

  const { data } = await db().from("players").select("*").eq("id", playerId).maybeSingle();
  if (!data) return erro("Jogador não encontrado.");
  const p = data as Player;

  const campo = ("atr_" + attr) as "atr_fin";
  const atual = p[campo];
  if (atual >= 99) return erro("Esse critério já está no máximo.");

  const cfg = await lerConfig();
  const preco = precoUpgrade(atual, cfg);
  if (p.moedas < preco) return erro(`Faltam ${preco - p.moedas} pontos.`);

  const nome = ATTRS.find((a) => a.k === attr)!.nome;
  const historico = [
    ...(p.historico || []),
    { txt: `${nome} ${atual} → ${atual + 1}`, custo: preco, em: new Date().toISOString() },
  ].slice(-30);

  const { error } = await db()
    .from("players")
    .update({ [campo]: atual + 1, moedas: p.moedas - preco, historico })
    .eq("id", playerId);
  if (error) return erro(error.message);

  atualizarTudo();
  const novoOvr = ovr({ ...p, [campo]: atual + 1 } as Player);
  return { ok: true, msg: `Comprado! ${nome} agora é ${atual + 1} — overall ${novoOvr}.` };
}

/* =====================================================================
   Rodadas
   ===================================================================== */
export async function criarRodada(data: string, nome: string): Promise<Resposta & { id?: string }> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const jogadores = await lerJogadores();
  const present = jogadores.filter((p) => p.ativo !== false && p.tipo !== "avulso").map((p) => p.id);
  const { data: nova, error } = await db()
    .from("rounds")
    .insert({ data, nome: nome || null, status: "aberta", present })
    .select("id")
    .single();
  if (error) return erro(error.message);
  atualizarTudo();
  return { ok: true, id: nova.id };
}

export async function excluirRodada(id: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const r = await lerRodada(id);
  if (r && r.status === "finalizada") return erro("Reabra a rodada antes de excluir, para os pontos voltarem.");
  const { error } = await db().from("rounds").delete().eq("id", id);
  if (error) return erro(error.message);
  atualizarTudo();
  return OK;
}

async function patchRodada(id: string, patch: Partial<Round>): Promise<Resposta> {
  const { error } = await db().from("rounds").update(patch).eq("id", id);
  if (error) return erro(error.message);
  atualizarTudo();
  return OK;
}

export async function alternarPresenca(roundId: string, playerId: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");
  const present = r.present || [];
  const novo = present.includes(playerId) ? present.filter((x) => x !== playerId) : [...present, playerId];
  return patchRodada(roundId, { present: novo });
}

export async function sortear(roundId: string, nTimes: number): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");

  const todos = await lerJogadores();
  const pool = (r.present || []).map((id) => todos.find((p) => p.id === id)).filter(Boolean) as Player[];
  if (pool.length < nTimes * 3) return erro(`Poucos confirmados para ${nTimes} times.`);

  const { times, reservas } = sortearTimes(pool, nTimes);
  return patchRodada(roundId, {
    teams: times, reservas, matches: [], stats: {}, campeao: null, premios: {},
  });
}

export async function limparTimes(roundId: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  return patchRodada(roundId, { teams: [], reservas: [], matches: [], stats: {}, campeao: null, premios: {} });
}

export async function trocarJogadores(roundId: string, k1: string, k2: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");
  const atualizada = trocarNaEscalacao(r, k1, k2);
  return patchRodada(roundId, { teams: atualizada.teams, reservas: atualizada.reservas });
}

/* ---------------------------------------------------------------------
   Capitão e nome do time
   --------------------------------------------------------------------- */
export async function definirCapitao(roundId: string, teamId: string, playerId: string | null): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");

  const teams = (r.teams || []).map((tm) => {
    if (tm.id !== teamId) return tm;
    if (playerId && !tm.slots.some((s) => s.playerId === playerId)) return tm;
    return { ...tm, capitao: playerId };
  });
  return patchRodada(roundId, { teams });
}

export async function renomearTime(roundId: string, teamId: string, nome: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const limpo = (nome || "").trim().slice(0, 40);
  if (!limpo) return erro("O time precisa de um nome.");
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");
  const teams = (r.teams || []).map((tm) => (tm.id === teamId ? { ...tm, nome: limpo } : tm));
  return patchRodada(roundId, { teams });
}

/* ---------------------------------------------------------------------
   Partidas: cronômetro e lances
   --------------------------------------------------------------------- */
export async function adicionarConfronto(roundId: string, a: string, b: string): Promise<Resposta> {
  if (a === b) return erro("Escolha dois times diferentes.");
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");
  const negado = await exigirComando(r);
  if (negado) return negado;
  const cfg = await lerConfig();
  const nova = {
    a, b,
    eventos: [] as Evento[],
    status: "pendente" as const,
    duracaoSeg: Math.max(30, (cfg.duracao_min || 7) * 60),
    acumuladoSeg: 0,
    rodando: false,
    iniciadoEm: null,
  };
  return patchRodada(roundId, { matches: [...(r.matches || []), nova] });
}

/** Aplica uma mudança numa partida da rodada, sempre com a rodada aberta. */
async function comPartida(
  roundId: string,
  indice: number,
  fn: (m: Round["matches"][number], r: Round) => Round["matches"][number] | { erro: string }
): Promise<Resposta> {
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");
  const negado = await exigirComando(r);
  if (negado) return negado;
  const matches = (r.matches || []).slice();
  const alvo = matches[indice];
  if (!alvo) return erro("Confronto não encontrado.");
  const saida = fn({ ...alvo }, r);
  if ("erro" in saida) return erro(saida.erro as string);
  matches[indice] = saida;
  return patchRodada(roundId, { matches });
}

export async function iniciarPartida(roundId: string, indice: number): Promise<Resposta> {
  return comPartida(roundId, indice, (m) => ({
    ...m,
    status: "andamento",
    rodando: true,
    iniciadoEm: new Date().toISOString(),
    acumuladoSeg: m.acumuladoSeg || 0,
  }));
}

export async function pausarPartida(roundId: string, indice: number): Promise<Resposta> {
  return comPartida(roundId, indice, (m) => ({
    ...m,
    rodando: false,
    acumuladoSeg: decorridoSeg(m, Date.now()),
    iniciadoEm: null,
  }));
}

export async function zerarCronometro(roundId: string, indice: number): Promise<Resposta> {
  return comPartida(roundId, indice, (m) => ({
    ...m,
    rodando: false,
    acumuladoSeg: 0,
    iniciadoEm: null,
  }));
}

export async function encerrarPartida(roundId: string, indice: number): Promise<Resposta> {
  return comPartida(roundId, indice, (m) => ({
    ...m,
    status: "encerrada",
    rodando: false,
    acumuladoSeg: decorridoSeg(m, Date.now()),
    iniciadoEm: null,
  }));
}

export async function reabrirPartida(roundId: string, indice: number): Promise<Resposta> {
  return comPartida(roundId, indice, (m) => ({ ...m, status: "andamento" }));
}

export async function registrarLance(
  roundId: string,
  indice: number,
  lance: { t: "gol" | "assist"; teamId: string; playerId: string | null }
): Promise<Resposta> {
  return comPartida(roundId, indice, (m) => {
    if (lance.teamId !== m.a && lance.teamId !== m.b) return { erro: "Time fora deste confronto." };
    const evento: Evento = {
      id: idCurto("e_"),
      t: lance.t,
      teamId: lance.teamId,
      playerId: lance.playerId,
      seg: Math.round(decorridoSeg(m, Date.now())),
    };
    return { ...m, eventos: [...(m.eventos || []), evento] };
  });
}

export async function removerLance(roundId: string, indice: number, eventoId: string): Promise<Resposta> {
  return comPartida(roundId, indice, (m) => ({
    ...m,
    eventos: (m.eventos || []).filter((e) => e.id !== eventoId),
  }));
}

export async function removerConfronto(roundId: string, indice: number): Promise<Resposta> {
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");
  const negado = await exigirComando(r);
  if (negado) return negado;
  const matches = (r.matches || []).slice();
  matches.splice(indice, 1);
  return patchRodada(roundId, { matches });
}

/* Fecha a rodada e credita os pontos. Guarda o que cada um ganhou,
   para que reabrir devolva exatamente a mesma coisa. */
export async function finalizarRodada(roundId: string, campeaoManual: string | null): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const r = await lerRodada(roundId);
  if (!r) return erro("Rodada não encontrada.");
  if (r.status === "finalizada") return erro("Essa rodada já foi fechada.");
  if (!(r.matches || []).length) return erro("Lance pelo menos um confronto antes de fechar.");

  const semCapitao = timesSemCapitao(r);
  if (semCapitao.length) {
    return erro(
      semCapitao.length === 1
        ? `${semCapitao[0].nome} ainda está sem capitão.`
        : `${semCapitao.length} times ainda estão sem capitão.`
    );
  }

  const cfg = await lerConfig();
  const { campeao, premios } = calcularPremiacao({ ...r, campeao: campeaoManual }, cfg);
  if (!campeao) return erro("Não deu para definir o campeão do dia.");

  const todos = await lerJogadores();
  for (const [pid, a] of Object.entries(premios)) {
    const p = todos.find((x) => x.id === pid);
    if (!p) continue;
    const s = { ...STATS_ZERO, ...(p.stats || {}) };
    const { error } = await db()
      .from("players")
      .update({
        moedas: p.moedas + a.moedas,
        stats: {
          rodadas: s.rodadas + a.rodadas, jogos: s.jogos + a.jogos,
          v: s.v + a.v, e: s.e + a.e, d: s.d + a.d,
          gols: s.gols + a.gols, assist: s.assist + a.assist,
          titulos: s.titulos + a.titulos, moedasTotais: s.moedasTotais + a.moedas,
        },
      })
      .eq("id", pid);
    if (error) return erro(error.message);
  }

  return patchRodada(roundId, { campeao, premios, status: "finalizada" });
}

export async function reabrirRodada(roundId: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const r = await lerRodada(roundId);
  if (!r || r.status !== "finalizada") return erro("Essa rodada não está fechada.");

  const todos = await lerJogadores();
  for (const [pid, a] of Object.entries(r.premios || {})) {
    const p = todos.find((x) => x.id === pid);
    if (!p) continue;
    const s = { ...STATS_ZERO, ...(p.stats || {}) };
    const nz = (n: number) => Math.max(0, n);
    const { error } = await db()
      .from("players")
      .update({
        moedas: nz(p.moedas - a.moedas),
        stats: {
          rodadas: nz(s.rodadas - a.rodadas), jogos: nz(s.jogos - a.jogos),
          v: nz(s.v - a.v), e: nz(s.e - a.e), d: nz(s.d - a.d),
          gols: nz(s.gols - a.gols), assist: nz(s.assist - a.assist),
          titulos: nz(s.titulos - a.titulos), moedasTotais: nz(s.moedasTotais - a.moedas),
        },
      })
      .eq("id", pid);
    if (error) return erro(error.message);
  }

  return patchRodada(roundId, { premios: {}, status: "aberta" });
}

/* =====================================================================
   Ajustes
   ===================================================================== */
export async function salvarConfig(form: Record<string, any>): Promise<Resposta> {
  const negado = await exigirAdmin();
  if (negado) return negado;
  const cfg = await lerConfig();
  const n = (v: any, d: number) => {
    const x = parseInt(String(v), 10);
    return isNaN(x) ? d : Math.max(0, x);
  };
  const duracao_min = Math.max(1, n(form.duracao_min, cfg.duracao_min));
  const gols_limite = n(form.gols_limite, cfg.gols_limite);
  const patch = {
    pontos_vitoria: n(form.pontos_vitoria, cfg.pontos_vitoria),
    pontos_gol: n(form.pontos_gol, cfg.pontos_gol),
    pontos_assist: n(form.pontos_assist, cfg.pontos_assist),
    faixas: (cfg.faixas || []).map((f, i) => ({ ate: f.ate, preco: n(form["faixa" + i], f.preco) })),
    qtd_times: n(form.qtd_times, cfg.qtd_times) || 3,
    duracao_min,
    gols_limite,
    regra_partida: textoRegra({ duracao_min, gols_limite }),
    nome_pelada: String(form.nome_pelada || cfg.nome_pelada),
    admin_pin: String(form.admin_pin || cfg.admin_pin).trim() || cfg.admin_pin,
  };
  const { error } = await db().from("config").update(patch).eq("id", 1);
  if (error) return erro(error.message);
  atualizarTudo();
  return { ok: true, msg: "Ajustes salvos." };
}

/* =====================================================================
   Caixa da pelada
   ===================================================================== */
export type FormLancamento = {
  id?: string;
  data: string;
  descricao: string;
  tipo: TipoLancamento;
  valor: number;
  categoria?: string | null;
};

export async function salvarLancamento(form: FormLancamento): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;

  const descricao = (form.descricao || "").trim();
  if (!descricao) return erro("Escreva do que se trata o lançamento.");

  const valor = Math.round((Number(form.valor) || 0) * 100) / 100;
  if (valor <= 0) return erro("O valor precisa ser maior que zero.");
  if (form.tipo !== "entrada" && form.tipo !== "saida") return erro("Escolha entrada ou saída.");

  const a = await ator();
  const corpo = {
    data: form.data || new Date().toISOString().slice(0, 10),
    descricao,
    tipo: form.tipo,
    valor,
    categoria: (form.categoria || "").trim() || null,
  };

  if (form.id) {
    const { error } = await db().from("caixa").update(corpo).eq("id", form.id);
    if (error) return erro(error.message);
  } else {
    const { error } = await db()
      .from("caixa")
      .insert({ ...corpo, criado_por: a.admin ? "Mestre da pelada" : a.jogador?.nome || null });
    if (error) return erro(error.message);
  }
  atualizarTudo();
  return { ok: true, msg: form.id ? "Lançamento atualizado." : "Lançamento registrado." };
}

/* =====================================================================
   Pagamento da diária, marcado dentro da rodada.
   Marcar um avulso lança a entrada no caixa; desmarcar estorna.
   Mensalista não passa por aqui: já está pago pela mensalidade.
   ===================================================================== */
export async function marcarPagamento(
  roundId: string,
  playerId: string,
  pago: boolean
): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;

  const r = await lerRodada(roundId);
  if (!r) return erro("Rodada não encontrada.");
  if (!(r.present || []).includes(playerId)) return erro("Esse jogador não veio nessa rodada.");

  const jogador = await lerJogador(playerId);
  if (!jogador) return erro("Jogador não encontrado.");
  if (jogador.tipo !== "avulso") {
    return erro("Mensalista já está pago pela mensalidade — não precisa marcar.");
  }

  const pagamentos: Record<string, Pagamento> = { ...(r.pagamentos || {}) };
  const atual = pagamentos[playerId];

  /* Desmarcar: apaga o lançamento que este pagamento criou. */
  if (!pago) {
    if (!atual) return OK;
    if (atual.lancamentoId) {
      const { error } = await db().from("caixa").delete().eq("id", atual.lancamentoId);
      if (error) return erro(error.message);
    }
    delete pagamentos[playerId];
    const resp = await patchRodada(roundId, { pagamentos } as Partial<Round>);
    return resp.ok ? { ok: true, msg: `Pagamento do ${jogador.nome} desfeito.` } : resp;
  }

  if (atual) return OK; // já estava pago

  const cfg = await lerConfig();
  const valor = Math.round((Number(cfg.valor_avulso) || 0) * 100) / 100;
  if (valor <= 0) return erro("Defina o valor da diária antes de marcar pagamento.");

  const a = await ator();
  const { data, error } = await db()
    .from("caixa")
    .insert({
      data: (r.data || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      descricao: `Diária de ${jogador.nome} · pelada de ${formatarData(r.data)}`,
      tipo: "entrada",
      valor,
      categoria: "Diária de avulso",
      criado_por: a.admin ? "Mestre da pelada" : a.jogador?.nome || null,
    })
    .select("id")
    .maybeSingle();
  if (error) return erro(error.message);

  pagamentos[playerId] = {
    valor,
    lancamentoId: (data as { id?: string } | null)?.id || null,
    em: new Date().toISOString(),
  };
  const resp = await patchRodada(roundId, { pagamentos } as Partial<Round>);
  return resp.ok
    ? { ok: true, msg: `${jogador.nome} pagou — entrou no caixa.` }
    : resp;
}

/** Valor da diária do avulso, editado na própria tela da rodada. */
export async function salvarValorAvulso(valor: number): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const v = Math.round((Number(valor) || 0) * 100) / 100;
  if (v <= 0) return erro("O valor precisa ser maior que zero.");
  const { error } = await db().from("config").update({ valor_avulso: v }).eq("id", 1);
  if (error) return erro(error.message);
  atualizarTudo();
  return { ok: true, msg: "Valor da diária atualizado." };
}

export async function excluirLancamento(id: string): Promise<Resposta> {
  const negado = await exigirOrganizador();
  if (negado) return negado;
  const { error } = await db().from("caixa").delete().eq("id", id);
  if (error) return erro(error.message);
  atualizarTudo();
  return { ok: true, msg: "Lançamento apagado." };
}

/* =====================================================================
   Posição: o jogador mexe na própria; o mestre mexe na de qualquer um
   ===================================================================== */
export async function salvarPosicao(
  playerId: string,
  pos: Pos,
  alt: Pos[]
): Promise<Resposta> {
  const a = await ator();
  if (!a.admin && a.jogador?.id !== playerId) {
    return erro("Cada um muda só a própria posição.");
  }
  if (!POSITIONS.includes(pos)) return erro("Posição inválida.");

  /* a alternativa não repete a principal e não aceita valor inventado */
  const limpas = Array.from(new Set(alt)).filter((x) => POSITIONS.includes(x) && x !== pos);

  const { error } = await db().from("players").update({ pos, alt: limpas }).eq("id", playerId);
  if (error) return erro(error.message);
  atualizarTudo();
  return { ok: true, msg: "Posição atualizada." };
}

/* =====================================================================
   O jogador troca o próprio PIN
   ===================================================================== */
export async function trocarMeuPin(pinAtual: string, novoPin: string): Promise<Resposta> {
  const s = lerSessao();
  if (!s || s.tipo !== "jogador") {
    return erro("Entre com o seu nome e PIN para trocar o PIN.");
  }

  const novo = String(novoPin || "").trim();
  if (!/^\d{4}$/.test(novo)) return erro("O novo PIN precisa ter 4 números.");

  const eu = await lerJogador(s.playerId);
  if (!eu) return erro("Jogador não encontrado.");
  if ((eu.pin || "").trim() !== String(pinAtual || "").trim()) return erro("O PIN atual está errado.");
  if (novo === (eu.pin || "").trim()) return erro("O novo PIN é igual ao atual.");

  const { error } = await db().from("players").update({ pin: novo }).eq("id", eu.id);
  if (error) return erro(error.message);

  atualizarTudo();
  return { ok: true, msg: "PIN trocado. Use o novo da próxima vez que entrar." };
}

/* =====================================================================
   Foto do jogador
   ===================================================================== */
export async function salvarFoto(playerId: string, imagemBase64: string): Promise<Resposta & { url?: string }> {
  const a = await ator();
  const meu = a.jogador?.id === playerId;
  if (!a.admin && !a.jogador?.organizador && !meu) {
    return erro("Você só pode trocar a sua própria foto.");
  }

  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(imagemBase64 || "");
  if (!m) return erro("Formato de imagem não reconhecido. Use JPG, PNG ou WEBP.");

  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > 1_500_000) return erro("Imagem muito pesada. Tente uma menor.");

  /* nome novo a cada envio para o navegador não servir a foto antiga do cache */
  const caminho = `${playerId}/${Date.now()}.jpg`;
  const up = await db().storage.from("fotos").upload(caminho, bytes, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (up.error) return erro("Não consegui guardar a foto: " + up.error.message);

  const { data } = db().storage.from("fotos").getPublicUrl(caminho);
  const url = data.publicUrl;

  const { error } = await db().from("players").update({ foto_url: url }).eq("id", playerId);
  if (error) return erro(error.message);

  atualizarTudo();
  return { ok: true, msg: "Foto atualizada.", url };
}

export async function removerFoto(playerId: string): Promise<Resposta> {
  const a = await ator();
  const meu = a.jogador?.id === playerId;
  if (!a.admin && !a.jogador?.organizador && !meu) {
    return erro("Você só pode tirar a sua própria foto.");
  }
  const { error } = await db().from("players").update({ foto_url: null }).eq("id", playerId);
  if (error) return erro(error.message);
  atualizarTudo();
  return { ok: true, msg: "Foto removida." };
}
