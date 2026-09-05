/* =====================================================================
   Copa Fofo — módulo à parte da pelada.
   5 times, todos contra todos, o último cai, e o mata-mata sai da
   classificação: 1º x 4º e 2º x 3º, depois a final.
   Nada daqui mexe no ranking nem na carteira da pelada.
   ===================================================================== */

import { Evento, Player, StatusPartida, decorridoSeg, idCurto, ovr } from "./domain";

export type CopaFase = "grupo" | "semi" | "final";

export type CopaTime = {
  id: string;
  nome: string;
  cls: string;
  hex: string;
  capitao: string | null;
  jogadores: string[];
};

export type CopaJogo = {
  id: string;
  fase: CopaFase;
  rodada: number;
  a: string;
  b: string;
  eventos: Evento[];
  status: StatusPartida;
  duracaoSeg: number;
  acumuladoSeg: number;
  rodando: boolean;
  iniciadoEm: string | null;
  /** Só no mata-mata, quando empata no tempo normal. */
  penA?: number | null;
  penB?: number | null;
};

export type CopaStatus = "rascunho" | "draft" | "grupos" | "mata_mata" | "encerrada";

export type CopaCampeao = { nome: string; playerId: string | null };

export type Copa = {
  id: string;
  nome: string;
  edicao: number | null;
  data: string;
  status: CopaStatus;
  qtd_times: number;
  /** Quem vai disputar esta edição. */
  elenco: string[];
  times: CopaTime[];
  draft: { ordem: string[]; passo: number };
  jogos: CopaJogo[];
  campeao: string | null;
  /** Congelado no fim; nas edições antigas é preenchido na mão. */
  campeoes: CopaCampeao[];
  criado_em?: string;
};

export const CORES_COPA = [
  { cls: "c-gold", nome: "Time 1", hex: "#F6A821" },
  { cls: "c-navy", nome: "Time 2", hex: "#0A3163" },
  { cls: "c-orange", nome: "Time 3", hex: "#D9631F" },
  { cls: "c-green", nome: "Time 4", hex: "#1F8A4C" },
  { cls: "c-purple", nome: "Time 5", hex: "#7B3F9E" },
  { cls: "c-red", nome: "Time 6", hex: "#B23A2F" },
];

export const ROTULO_STATUS: Record<CopaStatus, string> = {
  rascunho: "Montando",
  draft: "Escolhendo times",
  grupos: "Fase de grupos",
  mata_mata: "Mata-mata",
  encerrada: "Encerrada",
};

/* ---------------------------------------------------------------------
   Draft: os capitães escolhem em ordem de serpentina (1→5, 5→1, 1→5…),
   que é o formato justo — quem escolhe por último numa volta abre a
   próxima.
   --------------------------------------------------------------------- */
export function jogadoresEscolhidos(copa: Copa): string[] {
  return copa.times.flatMap((t) => t.jogadores);
}

export function jogadoresDisponiveis(copa: Copa): string[] {
  const usados = new Set(jogadoresEscolhidos(copa));
  return (copa.elenco || []).filter((id) => !usados.has(id));
}

/** De quem é a vez no draft, ou null quando acabou. */
export function timeDaVez(copa: Copa): string | null {
  const n = copa.times.length;
  if (!n || !jogadoresDisponiveis(copa).length) return null;
  const k = copa.draft?.passo || 0;
  const volta = Math.floor(k / n);
  const pos = volta % 2 === 0 ? k % n : n - 1 - (k % n);
  const ordem = copa.draft?.ordem?.length ? copa.draft.ordem : copa.times.map((t) => t.id);
  return ordem[pos] || null;
}

export function draftTerminou(copa: Copa): boolean {
  return copa.times.length > 0 && jogadoresDisponiveis(copa).length === 0;
}

/* ---------------------------------------------------------------------
   Fase de grupos: todos contra todos pelo método do círculo, para
   ninguém jogar duas vezes seguidas quando dá para evitar.
   --------------------------------------------------------------------- */
export function gerarFaseDeGrupos(timeIds: string[], duracaoSeg: number): CopaJogo[] {
  const ids = timeIds.slice();
  const impar = ids.length % 2 === 1;
  if (impar) ids.push("__folga__");

  const n = ids.length;
  const rodadas = n - 1;
  const metade = n / 2;
  const fila = ids.slice(1);
  const jogos: CopaJogo[] = [];

  for (let r = 0; r < rodadas; r++) {
    const volta = [ids[0], ...fila];
    for (let i = 0; i < metade; i++) {
      const a = volta[i];
      const b = volta[n - 1 - i];
      if (a === "__folga__" || b === "__folga__") continue;
      /* alterna o mando para o quadro não ficar sempre com o mesmo à esquerda */
      const [x, y] = r % 2 === 0 ? [a, b] : [b, a];
      jogos.push(novoJogo("grupo", r + 1, x, y, duracaoSeg));
    }
    fila.unshift(fila.pop() as string);
  }
  return jogos;
}

export function novoJogo(fase: CopaFase, rodada: number, a: string, b: string, duracaoSeg: number): CopaJogo {
  return {
    id: idCurto("j_"),
    fase, rodada, a, b,
    eventos: [],
    status: "pendente",
    duracaoSeg,
    acumuladoSeg: 0,
    rodando: false,
    iniciadoEm: null,
    penA: null,
    penB: null,
  };
}

/* ---------------------------------------------------------------------
   Placar e classificação
   --------------------------------------------------------------------- */
export function golsDoLado(j: CopaJogo, lado: "a" | "b"): number {
  const teamId = lado === "a" ? j.a : j.b;
  return (j.eventos || []).filter((e) => e.t === "gol" && e.teamId === teamId).length;
}

export type LinhaCopa = {
  id: string; nome: string; j: number; v: number; e: number; d: number;
  gp: number; gc: number; pts: number;
};

export function classificacao(copa: Copa): LinhaCopa[] {
  const t: Record<string, LinhaCopa> = {};
  (copa.times || []).forEach((tm) => {
    t[tm.id] = { id: tm.id, nome: tm.nome, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 };
  });
  (copa.jogos || [])
    .filter((j) => j.fase === "grupo" && j.status === "encerrada")
    .forEach((j) => {
      const A = t[j.a], B = t[j.b];
      if (!A || !B) return;
      const ga = golsDoLado(j, "a"), gb = golsDoLado(j, "b");
      A.j++; B.j++;
      A.gp += ga; A.gc += gb; B.gp += gb; B.gc += ga;
      if (ga > gb) { A.v++; B.d++; A.pts += 3; }
      else if (gb > ga) { B.v++; A.d++; B.pts += 3; }
      else { A.e++; B.e++; A.pts++; B.pts++; }
    });
  return Object.values(t).sort(
    (x, y) => y.pts - x.pts || y.v - x.v || (y.gp - y.gc) - (x.gp - x.gc) || y.gp - x.gp || x.nome.localeCompare(y.nome)
  );
}

export function faseDeGruposCompleta(copa: Copa): boolean {
  const grupo = (copa.jogos || []).filter((j) => j.fase === "grupo");
  return grupo.length > 0 && grupo.every((j) => j.status === "encerrada");
}

/** Quem venceu um jogo de mata-mata: gols e, empatando, os pênaltis. */
export function vencedorDoJogo(j: CopaJogo): string | null {
  if (j.status !== "encerrada") return null;
  const ga = golsDoLado(j, "a"), gb = golsDoLado(j, "b");
  if (ga > gb) return j.a;
  if (gb > ga) return j.b;
  const pa = j.penA ?? null, pb = j.penB ?? null;
  if (pa === null || pb === null || pa === pb) return null;
  return pa > pb ? j.a : j.b;
}

export function precisaDePenaltis(j: CopaJogo): boolean {
  if (j.fase === "grupo" || j.status !== "encerrada") return false;
  return golsDoLado(j, "a") === golsDoLado(j, "b");
}

/* ---------------------------------------------------------------------
   Mata-mata: 1º x 4º e 2º x 3º; o 5º está eliminado.
   --------------------------------------------------------------------- */
export function gerarSemifinais(copa: Copa, duracaoSeg: number): { jogos: CopaJogo[]; eliminado: string | null } {
  const tab = classificacao(copa);
  if (tab.length < 4) return { jogos: [], eliminado: null };
  const eliminado = tab.length >= 5 ? tab[tab.length - 1].id : null;
  return {
    jogos: [
      novoJogo("semi", 1, tab[0].id, tab[3].id, duracaoSeg),
      novoJogo("semi", 1, tab[1].id, tab[2].id, duracaoSeg),
    ],
    eliminado,
  };
}

export function semifinaisResolvidas(copa: Copa): boolean {
  const semis = (copa.jogos || []).filter((j) => j.fase === "semi");
  return semis.length === 2 && semis.every((j) => !!vencedorDoJogo(j));
}

export function gerarFinal(copa: Copa, duracaoSeg: number): CopaJogo | null {
  const semis = (copa.jogos || []).filter((j) => j.fase === "semi");
  if (semis.length !== 2) return null;
  const a = vencedorDoJogo(semis[0]);
  const b = vencedorDoJogo(semis[1]);
  if (!a || !b) return null;
  return novoJogo("final", 1, a, b, duracaoSeg);
}

export function campeaoDaCopa(copa: Copa): string | null {
  const final = (copa.jogos || []).find((j) => j.fase === "final");
  return final ? vencedorDoJogo(final) : null;
}

/** Quem está eliminado: o último do grupo e quem perdeu a semi. */
export function eliminados(copa: Copa): string[] {
  const fora: string[] = [];
  if (faseDeGruposCompleta(copa) && (copa.jogos || []).some((j) => j.fase !== "grupo")) {
    const tab = classificacao(copa);
    if (tab.length >= 5) fora.push(tab[tab.length - 1].id);
  }
  (copa.jogos || []).filter((j) => j.fase === "semi").forEach((j) => {
    const v = vencedorDoJogo(j);
    if (v) fora.push(v === j.a ? j.b : j.a);
  });
  return fora;
}

/* ---------------------------------------------------------------------
   Números da Copa (separados da pelada)
   --------------------------------------------------------------------- */
export type EstatCopa = { gols: number; assist: number };

export function estatisticasDaCopa(copa: Copa): Record<string, EstatCopa> {
  const out: Record<string, EstatCopa> = {};
  (copa.jogos || []).forEach((j) => {
    (j.eventos || []).forEach((e) => {
      if (!e.playerId) return;
      out[e.playerId] = out[e.playerId] || { gols: 0, assist: 0 };
      if (e.t === "gol") out[e.playerId].gols++;
      else out[e.playerId].assist++;
    });
  });
  return out;
}

export function timeDoJogador(copa: Copa, playerId: string): CopaTime | null {
  return (copa.times || []).find((t) => t.jogadores.includes(playerId)) || null;
}

export function forcaDoTime(tm: CopaTime, jogadores: Player[]): number {
  if (!tm.jogadores.length) return 0;
  const soma = tm.jogadores.reduce((s, id) => s + ovr(jogadores.find((p) => p.id === id) || null), 0);
  return Math.round(soma / tm.jogadores.length);
}

/* ---------------------------------------------------------------------
   Galeria de títulos
   --------------------------------------------------------------------- */
export type LinhaTitulos = { nome: string; playerId: string | null; titulos: number; edicoes: number[] };

/** Conta títulos por jogador, casando por id quando existe e por nome quando não. */
export function galeriaDeTitulos(copas: Copa[]): LinhaTitulos[] {
  const mapa = new Map<string, LinhaTitulos>();
  copas
    .filter((c) => (c.campeoes || []).length)
    .forEach((c) => {
      c.campeoes.forEach((campeao) => {
        const chave = campeao.playerId || campeao.nome.trim().toLowerCase();
        const linha = mapa.get(chave) || {
          nome: campeao.nome, playerId: campeao.playerId, titulos: 0, edicoes: [],
        };
        linha.titulos++;
        if (c.edicao) linha.edicoes.push(c.edicao);
        if (!linha.playerId && campeao.playerId) linha.playerId = campeao.playerId;
        mapa.set(chave, linha);
      });
    });
  return Array.from(mapa.values()).sort(
    (a, b) => b.titulos - a.titulos || a.nome.localeCompare(b.nome)
  );
}

export function tempoDoJogo(j: CopaJogo, agoraMs: number): number {
  return decorridoSeg(
    { a: j.a, b: j.b, acumuladoSeg: j.acumuladoSeg, rodando: j.rodando, iniciadoEm: j.iniciadoEm },
    agoraMs
  );
}
