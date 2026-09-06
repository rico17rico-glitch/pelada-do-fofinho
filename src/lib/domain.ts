/* =====================================================================
   Regras da Pelada do Fofinho.
   Nenhuma função aqui toca no banco nem no navegador — é só a regra pura,
   o que torna tudo fácil de conferir e de mudar num lugar só.
   ===================================================================== */

export type Pos = "GOLEIRO" | "FIXO" | "ALA" | "PIVO";

export const POSITIONS: Pos[] = ["GOLEIRO", "FIXO", "ALA", "PIVO"];
export const POS_LABEL: Record<Pos, string> = { GOLEIRO: "GOL", FIXO: "FIX", ALA: "ALA", PIVO: "PIV" };
export const POS_FULL: Record<Pos, string> = { GOLEIRO: "Goleiro", FIXO: "Fixo", ALA: "Ala", PIVO: "Pivô" };

/** Formação de futsal: um time é sempre goleiro, fixo, dois alas e pivô. */
export const FORMATION: Pos[] = ["GOLEIRO", "FIXO", "ALA", "ALA", "PIVO"];

export const ATTRS = [
  { k: "fin", nome: "Finalização" },
  { k: "vis", nome: "Visão de jogo" },
  { k: "def", nome: "Defesa" },
  { k: "int", nome: "Intensidade" },
] as const;

export type AttrKey = (typeof ATTRS)[number]["k"];

export const BASES = [60, 65, 70, 75, 80];

export const TEAM_STYLES = [
  { cls: "c-gold", nome: "Time Ouro", hex: "#F6A821" },
  { cls: "c-navy", nome: "Time Marinho", hex: "#0A3163" },
  { cls: "c-orange", nome: "Time Laranja", hex: "#D9631F" },
  { cls: "c-green", nome: "Time Verde", hex: "#1F8A4C" },
];

export type Faixa = { ate: number; preco: number };

export type Config = {
  pontos_vitoria: number;
  pontos_gol: number;
  pontos_assist: number;
  faixas: Faixa[];
  admin_pin: string;
  qtd_times: number;
  regra_partida: string;
  nome_pelada: string;
  duracao_min: number;
  gols_limite: number;
};

/** Texto curto da regra, montado a partir dos números. */
export function textoRegra(cfg: Pick<Config, "duracao_min" | "gols_limite">): string {
  const min = `${cfg.duracao_min} ${cfg.duracao_min === 1 ? "minuto" : "minutos"}`;
  if (!cfg.gols_limite) return min;
  return `${min} ou ${cfg.gols_limite} ${cfg.gols_limite === 1 ? "gol" : "gols"}`;
}

export type Stats = {
  rodadas: number; jogos: number; v: number; e: number; d: number;
  gols: number; assist: number; titulos: number; moedasTotais: number;
};

export type Player = {
  id: string;
  nome: string;
  pos: Pos;
  alt: Pos[];
  tipo: "mensalista" | "avulso";
  ativo: boolean;
  /** Organizador manda na rodada igual ao mestre: cria, sorteia, apita e fecha. */
  organizador?: boolean;
  /** Foto de rosto, quadrada, guardada no Supabase. */
  foto_url?: string | null;
  pin: string;
  atr_fin: number; atr_vis: number; atr_def: number; atr_int: number;
  moedas: number;
  stats: Stats;
  historico: { txt: string; custo: number; em: string }[];
};

export type Slot = { pos: Pos; playerId: string | null };
export type Team = {
  id: string; nome: string; cls: string; hex: string; slots: Slot[];
  /** Todo time tem um capitão; o mestre escolhe depois do sorteio. */
  capitao?: string | null;
};

/** Um lance da partida. `playerId` nulo é gol sem autor anotado. */
export type Evento = {
  id: string;
  t: "gol" | "assist";
  teamId: string;
  playerId: string | null;
  seg: number;
};

export type StatusPartida = "pendente" | "andamento" | "encerrada";

export type Match = {
  a: string;
  b: string;
  /** Placar de rodadas antigas, antes dos lances por partida. */
  ga?: number;
  gb?: number;
  eventos?: Evento[];
  status?: StatusPartida;
  duracaoSeg?: number;
  /** Segundos já corridos nas partes anteriores do cronômetro. */
  acumuladoSeg?: number;
  rodando?: boolean;
  /** Momento em que o cronômetro voltou a correr (ISO). */
  iniciadoEm?: string | null;
};
export type Premio = {
  moedas: number; rodadas: number; jogos: number;
  v: number; e: number; d: number; gols: number; assist: number; titulos: number;
};

export type Round = {
  id: string;
  data: string;
  nome: string | null;
  status: "aberta" | "finalizada";
  present: string[];
  teams: Team[];
  reservas: string[];
  matches: Match[];
  stats: Record<string, { g: number; a: number }>;
  campeao: string | null;
  premios: Record<string, Premio>;
};

/* --------------------------------------------------------------------
   Overall: média simples dos quatro critérios.
   Cada +1 num critério vale +0,25 no overall.
   -------------------------------------------------------------------- */
export function ovr(p: Pick<Player, "atr_fin" | "atr_vis" | "atr_def" | "atr_int"> | null | undefined): number {
  if (!p) return 0;
  return Math.round((p.atr_fin + p.atr_vis + p.atr_def + p.atr_int) / 4);
}

export function attrValue(p: Player, k: AttrKey): number {
  return p[("atr_" + k) as "atr_fin"];
}

export function ovrTier(v: number): string {
  return v >= 88 ? "t90" : v >= 76 ? "t80" : v > 0 ? "t70" : "t0";
}

/** Quanto custa subir +1 num critério, conforme o valor atual dele. */
export function precoUpgrade(valor: number, cfg: Pick<Config, "faixas">): number {
  const f = cfg.faixas && cfg.faixas.length ? cfg.faixas : [{ ate: 99, preco: 100 }];
  for (const b of f) if (valor <= b.ate) return b.preco;
  return f[f.length - 1].preco;
}

/* --------------------------------------------------------------------
   Classificação do dia. O campeão é quem tem MAIS VITÓRIAS;
   empate resolve por pontos (3/1/0), depois saldo, depois gols pró.
   -------------------------------------------------------------------- */
export type LinhaTabela = {
  id: string; nome: string; j: number; v: number; e: number; d: number;
  gp: number; gc: number; pts: number;
};

/** Placar de um lado da partida: conta os gols lançados, ou usa o número antigo. */
export function placar(m: Match, lado: "a" | "b"): number {
  if (m.eventos) {
    const teamId = lado === "a" ? m.a : m.b;
    return m.eventos.filter((e) => e.t === "gol" && e.teamId === teamId).length;
  }
  return (lado === "a" ? m.ga : m.gb) || 0;
}

/** Segundos já jogados, somando o trecho que está correndo agora. */
export function decorridoSeg(m: Match, agoraMs: number): number {
  const base = m.acumuladoSeg || 0;
  if (m.rodando && m.iniciadoEm) {
    return base + Math.max(0, (agoraMs - Date.parse(m.iniciadoEm)) / 1000);
  }
  return base;
}

export function formatarRelogio(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Gols e assistências da rodada, somando os lances de todas as partidas. */
export function statsDaRodada(round: Pick<Round, "matches" | "stats">): Record<string, { g: number; a: number }> {
  const out: Record<string, { g: number; a: number }> = {};
  let temLances = false;
  (round.matches || []).forEach((m) => {
    (m.eventos || []).forEach((e) => {
      temLances = true;
      if (!e.playerId) return;
      out[e.playerId] = out[e.playerId] || { g: 0, a: 0 };
      if (e.t === "gol") out[e.playerId].g++;
      else out[e.playerId].a++;
    });
  });
  /* Rodadas antigas guardavam os números soltos, fora das partidas. */
  return temLances ? out : (round.stats || {});
}

/* --------------------------------------------------------------------
   Quem vence continua.
   O vencedor fica na quadra e enfrenta quem está descansando há mais tempo.
   No empate sai quem já estava na quadra (jogou também o confronto anterior)
   e o desafiante fica. Só olha para confrontos já encerrados.
   -------------------------------------------------------------------- */
export type Sugestao = { a: string; b: string; fica: string; motivo: string };

/** Quem venceu a partida, ou null se empatou / ainda não acabou. */
export function vencedorDaPartida(m: Match): string | null {
  if (m.status && m.status !== "encerrada") return null;
  const ga = placar(m, "a"), gb = placar(m, "b");
  if (ga === gb) return null;
  return ga > gb ? m.a : m.b;
}

export function proximoConfronto(round: Pick<Round, "teams" | "matches">): Sugestao | null {
  const times = (round.teams || []).map((t) => t.id);
  if (times.length < 2) return null;

  const jogos = (round.matches || []).filter((m) => (m.status || "encerrada") === "encerrada");
  if (!jogos.length) return { a: times[0], b: times[1], fica: times[0], motivo: "Primeiro confronto do dia." };

  /* Nenhum confronto pode ser sugerido enquanto um jogo estiver em aberto. */
  const emAberto = (round.matches || []).some((m) => m.status && m.status !== "encerrada");
  if (emAberto) return null;

  const ultimo = jogos[jogos.length - 1];
  const anterior = jogos.length > 1 ? jogos[jogos.length - 2] : null;
  if (times.length < 3) return null;

  const venceu = vencedorDaPartida(ultimo);
  let fica: string;
  let motivo: string;

  if (venceu) {
    fica = venceu;
    motivo = "Venceu o último confronto e continua na quadra.";
  } else {
    /* Empate: sai quem estava na quadra há mais tempo. */
    const veterano =
      anterior && (anterior.a === ultimo.a || anterior.b === ultimo.a) ? ultimo.a
      : anterior && (anterior.a === ultimo.b || anterior.b === ultimo.b) ? ultimo.b
      : ultimo.a;
    fica = veterano === ultimo.a ? ultimo.b : ultimo.a;
    motivo = "Empate: sai quem estava na quadra há mais tempo.";
  }

  /* Entra quem está parado há mais tempo: menos jogos, depois quem jogou por último. */
  const jogosDe = (id: string) => jogos.filter((m) => m.a === id || m.b === id).length;
  const ultimaVez = (id: string) => {
    for (let i = jogos.length - 1; i >= 0; i--) if (jogos[i].a === id || jogos[i].b === id) return i;
    return -1;
  };
  const candidatos = times.filter((id) => id !== fica && id !== ultimo.a && id !== ultimo.b);
  const fila = (candidatos.length ? candidatos : times.filter((id) => id !== fica))
    .slice()
    .sort((x, y) => jogosDe(x) - jogosDe(y) || ultimaVez(x) - ultimaVez(y));

  const entra = fila[0];
  if (!entra) return null;
  return { a: fica, b: entra, fica, motivo };
}

export function tabelaRodada(round: Pick<Round, "teams" | "matches">): LinhaTabela[] {
  const t: Record<string, LinhaTabela> = {};
  (round.teams || []).forEach((tm) => {
    t[tm.id] = { id: tm.id, nome: tm.nome, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 };
  });
  (round.matches || []).forEach((m) => {
    const A = t[m.a], B = t[m.b];
    if (!A || !B) return;
    const ga = placar(m, "a"), gb = placar(m, "b");
    A.j++; B.j++;
    A.gp += ga; A.gc += gb; B.gp += gb; B.gc += ga;
    if (ga > gb) { A.v++; B.d++; A.pts += 3; }
    else if (gb > ga) { B.v++; A.d++; B.pts += 3; }
    else { A.e++; B.e++; A.pts++; B.pts++; }
  });
  return Object.values(t).sort(
    (x, y) => y.v - x.v || y.pts - x.pts || (y.gp - y.gc) - (x.gp - x.gc) || y.gp - x.gp || x.nome.localeCompare(y.nome)
  );
}

/* --------------------------------------------------------------------
   Premiação: 50 pontos para todos do time campeão do dia,
   5 por gol e 2 por assistência (somando todos os confrontos).
   -------------------------------------------------------------------- */
export function calcularPremiacao(round: Round, cfg: Config): { campeao: string | null; premios: Record<string, Premio> } {
  const tab = tabelaRodada(round);
  const porTime: Record<string, LinhaTabela> = Object.fromEntries(tab.map((r) => [r.id, r]));
  const campeao = round.campeao || (tab[0] ? tab[0].id : null);
  const premios: Record<string, Premio> = {};
  const stats = statsDaRodada(round);

  (round.teams || []).forEach((tm) => {
    const r = porTime[tm.id] || { j: 0, v: 0, e: 0, d: 0 } as LinhaTabela;
    const venceu = tm.id === campeao;
    (tm.slots || []).forEach((s) => {
      if (!s.playerId) return;
      const st = stats[s.playerId] || { g: 0, a: 0 };
      premios[s.playerId] = {
        moedas: (venceu ? cfg.pontos_vitoria : 0) + st.g * cfg.pontos_gol + st.a * cfg.pontos_assist,
        rodadas: 1, jogos: r.j, v: r.v, e: r.e, d: r.d,
        gols: st.g, assist: st.a, titulos: venceu ? 1 : 0,
      };
    });
  });

  return { campeao, premios };
}

/* --------------------------------------------------------------------
   Sorteio dos times.
   1) Distribui posição por posição, começando pelas mais escassas.
   2) Em cada rodada de distribuição, o time mais fraco escolhe primeiro.
   3) Depois troca jogadores de mesma posição entre times enquanto
      isso diminuir a diferença de força.
   -------------------------------------------------------------------- */
const byId = (arr: Player[], id: string | null) => arr.find((p) => p.id === id) || null;

export function sortearTimes(pool: Player[], nTimes: number): { times: Team[]; reservas: string[] } {
  const times: Team[] = [];
  for (let i = 0; i < nTimes; i++) {
    const st = TEAM_STYLES[i % TEAM_STYLES.length];
    times.push({
      id: "T" + (i + 1),
      nome: st.nome, cls: st.cls, hex: st.hex,
      capitao: null,
      slots: FORMATION.map((p) => ({ pos: p, playerId: null })),
    });
  }

  let resto = pool.slice().sort(() => Math.random() - 0.5);
  const total = (tm: Team) => tm.slots.reduce((s, x) => s + (x.playerId ? ovr(byId(pool, x.playerId)) : 0), 0);

  const escolher = (pos: Pos): Player | null => {
    let grupo = resto.filter((p) => p.pos === pos);
    if (!grupo.length) grupo = resto.filter((p) => (p.alt || []).includes(pos));
    if (!grupo.length) grupo = resto.filter((p) => (pos === "GOLEIRO" ? true : p.pos !== "GOLEIRO"));
    if (!grupo.length) grupo = resto;
    grupo = grupo.slice().sort((a, b) => ovr(b) - ovr(a));
    return grupo[0] || null;
  };

  (["GOLEIRO", "FIXO", "PIVO", "ALA", "ALA"] as Pos[]).forEach((pos) => {
    const fila = times.slice().sort((a, b) => total(a) - total(b));
    fila.forEach((tm) => {
      const idx = tm.slots.findIndex((s) => s.pos === pos && !s.playerId);
      if (idx < 0) return;
      const c = escolher(pos);
      if (!c) return;
      resto = resto.filter((p) => p.id !== c.id);
      tm.slots[idx].playerId = c.id;
    });
  });

  equilibrar(times, pool);
  return { times, reservas: resto.map((p) => p.id) };
}

export function equilibrar(times: Team[], pool: Player[]): void {
  if (times.length < 2) return;
  const soma = (tm: Team) => tm.slots.reduce((s, x) => s + (x.playerId ? ovr(byId(pool, x.playerId)) : 0), 0);
  const spread = () => { const v = times.map(soma); return Math.max(...v) - Math.min(...v); };
  let melhor = spread();

  for (let it = 0; it < 3000 && melhor > 0; it++) {
    const a = Math.floor(Math.random() * times.length);
    const b = Math.floor(Math.random() * times.length);
    if (a === b) continue;
    const si = Math.floor(Math.random() * FORMATION.length);
    const pos = times[a].slots[si].pos;
    const cands = times[b].slots.map((s, i) => ({ s, i })).filter((o) => o.s.pos === pos);
    if (!cands.length) continue;
    const sj = cands[Math.floor(Math.random() * cands.length)].i;

    const tmp = times[a].slots[si].playerId;
    times[a].slots[si].playerId = times[b].slots[sj].playerId;
    times[b].slots[sj].playerId = tmp;

    const novo = spread();
    if (novo < melhor) melhor = novo;
    else {
      const t2 = times[a].slots[si].playerId;
      times[a].slots[si].playerId = times[b].slots[sj].playerId;
      times[b].slots[sj].playerId = t2;
    }
  }
}

/** Troca dois jogadores de lugar — entre slots ou com alguém do banco. */
export function trocarNaEscalacao(round: Round, k1: string, k2: string): Round {
  const get = (k: string) => {
    if (k.startsWith("R:")) return { tipo: "banco" as const, id: k.slice(2) };
    const [tid, i] = k.split(":");
    const tm = round.teams.find((x) => x.id === tid);
    return { tipo: "slot" as const, slot: tm ? tm.slots[parseInt(i, 10)] : null };
  };
  const A = get(k1), B = get(k2);

  if (A.tipo === "slot" && B.tipo === "slot") {
    if (!A.slot || !B.slot) return round;
    const tmp = A.slot.playerId;
    A.slot.playerId = B.slot.playerId;
    B.slot.playerId = tmp;
  } else if (A.tipo === "slot" || B.tipo === "slot") {
    const s = (A.tipo === "slot" ? A : (B as any)).slot;
    const bancoId = (A.tipo === "banco" ? A : (B as any)).id;
    if (!s) return round;
    const saindo = s.playerId;
    s.playerId = bancoId;
    round.reservas = (round.reservas || []).filter((x) => x !== bancoId);
    if (saindo) round.reservas.push(saindo);
  }
  /* Capitão que saiu do time perde a braçadeira. */
  round.teams.forEach((tm) => {
    if (tm.capitao && !tm.slots.some((s) => s.playerId === tm.capitao)) tm.capitao = null;
  });
  return round;
}

/** Times que ainda estão sem capitão. */
export function timesSemCapitao(round: Pick<Round, "teams">): Team[] {
  return (round.teams || []).filter((tm) => !tm.capitao);
}

/* =====================================================================
   Quem pode o quê numa rodada
   - mestre e organizadores: tudo
   - capitão: apita as partidas (cronômetro, gols, assistências, confrontos)
   ===================================================================== */
export type Permissoes = {
  admin: boolean;
  /** Criar rodada, mexer em presença, times, capitães e fechar a rodada. */
  gerirRodada: boolean;
  /** Comandar cronômetro, lances e confrontos. */
  gerirPartidas: boolean;
};

export function ehCapitaoNaRodada(round: Pick<Round, "teams">, playerId: string | null): boolean {
  if (!playerId) return false;
  return (round.teams || []).some((tm) => tm.capitao === playerId);
}

export function permissoesDaRodada(
  round: Pick<Round, "teams">,
  ator: { admin: boolean; jogador: Player | null }
): Permissoes {
  const organizador = !!ator.jogador?.organizador;
  const gerirRodada = ator.admin || organizador;
  return {
    admin: ator.admin,
    gerirRodada,
    gerirPartidas: gerirRodada || ehCapitaoNaRodada(round, ator.jogador?.id || null),
  };
}

export function idCurto(prefixo: string): string {
  return prefixo + Math.random().toString(36).slice(2, 9);
}

/* =====================================================================
   Caixa da pelada — valores lançados na mão
   ===================================================================== */
export type TipoLancamento = "entrada" | "saida";

export type Lancamento = {
  id: string;
  data: string;
  descricao: string;
  tipo: TipoLancamento;
  valor: number;
  categoria: string | null;
  criado_por: string | null;
  criado_em?: string;
};

export const CATEGORIAS_CAIXA = [
  "Mensalidade",
  "Diária de avulso",
  "Aluguel da quadra",
  "Material",
  "Bola",
  "Colete",
  "Água e gelo",
  "Churrasco",
  "Outros",
];

export type ResumoCaixa = { saldo: number; entradas: number; saidas: number };

export function resumoCaixa(lancamentos: Lancamento[]): ResumoCaixa {
  let entradas = 0, saidas = 0;
  for (const l of lancamentos) {
    const v = Number(l.valor) || 0;
    if (l.tipo === "entrada") entradas += v;
    else saidas += v;
  }
  /* arredonda para centavos: somar float acumula sujeira na 15ª casa */
  const cent = (v: number) => Math.round(v * 100) / 100;
  return { saldo: cent(entradas - saidas), entradas: cent(entradas), saidas: cent(saidas) };
}

export function formatarBRL(v: number): string {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "2026-09" → "setembro de 2026", para agrupar o extrato por mês. */
export function rotuloMes(iso: string): string {
  const [ano, mes] = iso.split("-");
  const nomes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${nomes[Number(mes) - 1] || ""} de ${ano}`;
}

/* Estatísticas zeradas, usadas ao criar jogador e ao estornar rodada. */
export const STATS_ZERO: Stats = {
  rodadas: 0, jogos: 0, v: 0, e: 0, d: 0, gols: 0, assist: 0, titulos: 0, moedasTotais: 0,
};

export function formatarData(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function hojeISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Iniciais para quando o jogador ainda não tem foto. */
export function iniciais(nome: string): string {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function gerarPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
