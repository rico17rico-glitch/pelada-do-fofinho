"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, lerConfig, lerJogadores, lerRodada } from "./db";
import { ehAdmin, gravarSessao, lerSessao, limparSessao } from "./session";
import {
  ATTRS, AttrKey, Player, Pos, Round, STATS_ZERO, calcularPremiacao, gerarPin,
  ovr, precoUpgrade, sortearTimes, trocarNaEscalacao,
} from "./domain";

type Resposta = { ok: boolean; erro?: string; msg?: string };

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
};

export async function salvarJogador(form: FormJogador): Promise<Resposta> {
  const negado = await exigirAdmin();
  if (negado) return negado;

  const nome = (form.nome || "").trim();
  if (!nome) return erro("Coloque o nome do jogador.");
  const alt = (form.alt || []).filter((x) => x !== form.pos);

  if (form.id) {
    const patch: Record<string, unknown> = {
      nome, pos: form.pos, alt, tipo: form.tipo,
      ativo: form.ativo !== false,
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
    const { error } = await db().from("players").insert({
      nome, pos: form.pos, alt, tipo: form.tipo, ativo: true,
      pin: form.tipo === "avulso" ? "" : gerarPin(),
      atr_fin: base, atr_vis: base, atr_def: base, atr_int: base,
      moedas: 0, stats: STATS_ZERO, historico: [],
    });
    if (error) return erro(error.message);
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
  const negado = await exigirAdmin();
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
  const negado = await exigirAdmin();
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
  const negado = await exigirAdmin();
  if (negado) return negado;
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");
  const present = r.present || [];
  const novo = present.includes(playerId) ? present.filter((x) => x !== playerId) : [...present, playerId];
  return patchRodada(roundId, { present: novo });
}

export async function sortear(roundId: string, nTimes: number): Promise<Resposta> {
  const negado = await exigirAdmin();
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
  const negado = await exigirAdmin();
  if (negado) return negado;
  return patchRodada(roundId, { teams: [], reservas: [], matches: [], stats: {}, campeao: null, premios: {} });
}

export async function trocarJogadores(roundId: string, k1: string, k2: string): Promise<Resposta> {
  const negado = await exigirAdmin();
  if (negado) return negado;
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");
  const atualizada = trocarNaEscalacao(r, k1, k2);
  return patchRodada(roundId, { teams: atualizada.teams, reservas: atualizada.reservas });
}

export async function adicionarConfronto(roundId: string, a: string, b: string): Promise<Resposta> {
  const negado = await exigirAdmin();
  if (negado) return negado;
  if (a === b) return erro("Escolha dois times diferentes.");
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");
  return patchRodada(roundId, { matches: [...(r.matches || []), { a, b, ga: 0, gb: 0 }] });
}

export async function removerConfronto(roundId: string, indice: number): Promise<Resposta> {
  const negado = await exigirAdmin();
  if (negado) return negado;
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");
  const matches = (r.matches || []).slice();
  matches.splice(indice, 1);
  return patchRodada(roundId, { matches });
}

export async function ajustarPlacar(roundId: string, indice: number, lado: "ga" | "gb", delta: number): Promise<Resposta> {
  const negado = await exigirAdmin();
  if (negado) return negado;
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");
  const matches = (r.matches || []).map((m, i) => (i === indice ? { ...m, [lado]: Math.max(0, m[lado] + delta) } : m));
  return patchRodada(roundId, { matches });
}

export async function ajustarEstatistica(roundId: string, playerId: string, campo: "g" | "a", delta: number): Promise<Resposta> {
  const negado = await exigirAdmin();
  if (negado) return negado;
  const r = await lerRodada(roundId);
  if (!r || r.status === "finalizada") return erro("Rodada fechada.");
  const stats = { ...(r.stats || {}) };
  const atual = stats[playerId] || { g: 0, a: 0 };
  stats[playerId] = { ...atual, [campo]: Math.max(0, atual[campo] + delta) };
  return patchRodada(roundId, { stats });
}

/* Fecha a rodada e credita os pontos. Guarda o que cada um ganhou,
   para que reabrir devolva exatamente a mesma coisa. */
export async function finalizarRodada(roundId: string, campeaoManual: string | null): Promise<Resposta> {
  const negado = await exigirAdmin();
  if (negado) return negado;
  const r = await lerRodada(roundId);
  if (!r) return erro("Rodada não encontrada.");
  if (r.status === "finalizada") return erro("Essa rodada já foi fechada.");
  if (!(r.matches || []).length) return erro("Lance pelo menos um confronto antes de fechar.");

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
  const negado = await exigirAdmin();
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
  const patch = {
    pontos_vitoria: n(form.pontos_vitoria, cfg.pontos_vitoria),
    pontos_gol: n(form.pontos_gol, cfg.pontos_gol),
    pontos_assist: n(form.pontos_assist, cfg.pontos_assist),
    faixas: (cfg.faixas || []).map((f, i) => ({ ate: f.ate, preco: n(form["faixa" + i], f.preco) })),
    qtd_times: n(form.qtd_times, cfg.qtd_times) || 3,
    regra_partida: String(form.regra_partida || cfg.regra_partida),
    nome_pelada: String(form.nome_pelada || cfg.nome_pelada),
    admin_pin: String(form.admin_pin || cfg.admin_pin).trim() || cfg.admin_pin,
  };
  const { error } = await db().from("config").update(patch).eq("id", 1);
  if (error) return erro(error.message);
  atualizarTudo();
  return { ok: true, msg: "Ajustes salvos." };
}
