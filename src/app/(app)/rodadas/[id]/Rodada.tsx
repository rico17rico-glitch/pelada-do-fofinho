"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Config, Evento, Match, POS_LABEL, Permissoes, Player, Round, Team,
  decorridoSeg, formatarRelogio, formatarData, ovr, placar, proximoConfronto, statsDaRodada,
  tabelaRodada, timesSemCapitao,
} from "@/lib/domain";
import {
  adicionarConfronto, alternarPresenca, definirCapitao, encerrarPartida, finalizarRodada,
  iniciarPartida, limparTimes, pausarPartida, reabrirPartida, reabrirRodada, registrarLance,
  removerConfronto, removerLance, renomearTime, salvarJogador, sortear, trocarJogadores,
  zerarCronometro,
} from "@/lib/actions";
import { Confirmar, Modal, Quadra, SLOT_XY, Swatch, Toast, useToast } from "@/components/ui";

export default function Rodada({
  rodada, jogadores, cfg, perm, agoraServidor,
}: {
  rodada: Round; jogadores: Player[]; cfg: Config; perm: Permissoes; agoraServidor: string;
}) {
  const router = useRouter();
  const { msg, avisar } = useToast();

  const [pendente, setPendente] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [qtdTimes, setQtdTimes] = useState(rodada.teams?.length || cfg.qtd_times || 3);
  const [campeaoManual, setCampeaoManual] = useState<string>(rodada.campeao || "");
  const [confirmando, setConfirmando] = useState<null | "reabrir" | "limpar">(null);
  const [novoAvulso, setNovoAvulso] = useState(false);
  const [nomeAvulso, setNomeAvulso] = useState("");
  const [baseAvulso, setBaseAvulso] = useState(65);
  const [timeA, setTimeA] = useState("");
  const [timeB, setTimeB] = useState("");
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [nomeNovo, setNomeNovo] = useState("");

  const aberta = rodada.status !== "finalizada";
  /* Mestre e organizadores mexem em tudo; capitão só apita as partidas. */
  const podeEditar = perm.gerirRodada && aberta;
  const podeApitar = perm.gerirPartidas && aberta;
  const times = rodada.teams || [];
  const partidas = rodada.matches || [];
  const porId = (id: string | null) => jogadores.find((p) => p.id === id) || null;
  const tabela = tabelaRodada(rodada);
  const semCapitao = timesSemCapitao(rodada);
  const totais = statsDaRodada(rodada);
  /* Quem vence continua: o app já sugere o próximo confronto. */
  const sugestao = aberta ? proximoConfronto(rodada) : null;
  const nomeTime = (id: string) => times.find((t) => t.id === id)?.nome || "?";

  /* ---- relógio: o servidor manda a hora dele para o navegador se alinhar ---- */
  const [offset] = useState(() => Date.now() - Date.parse(agoraServidor));
  const [, setTick] = useState(0);
  const algumaRodando = partidas.some((m) => m.rodando);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);
  /* com o cronômetro correndo, busca o estado do servidor de tempos em tempos
     para que outro aparelho veja o play/pausa de quem está apitando */
  useEffect(() => {
    if (!algumaRodando) return;
    const id = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(id);
  }, [algumaRodando, router]);
  const agora = Date.now() - offset;

  const emAndamento = partidas.findIndex((m) => m.status === "andamento");
  const [abertaIdx, setAbertaIdx] = useState<number | null>(emAndamento >= 0 ? emAndamento : null);

  async function rodar(fn: () => Promise<{ ok: boolean; erro?: string; msg?: string }>, sucesso?: string) {
    setPendente(true);
    try {
      const r = await fn();
      if (!r.ok) { avisar(r.erro || "Não deu certo."); return false; }
      router.refresh();
      if (sucesso || r.msg) avisar(sucesso || r.msg!);
      return true;
    } finally {
      setPendente(false);
    }
  }

  function clicarSlot(chave: string) {
    if (!podeEditar) return;
    if (!sel) return setSel(chave);
    if (sel === chave) return setSel(null);
    const de = sel;
    setSel(null);
    rodar(() => trocarJogadores(rodada.id, de, chave));
  }

  function criarAvulso() {
    const nome = nomeAvulso.trim();
    if (!nome) return avisar("Coloque o nome do avulso.");
    setPendente(true);
    salvarJogador({ nome, pos: "ALA", alt: [], tipo: "avulso", base: baseAvulso })
      .then((r) => {
        if (!r.ok) return avisar(r.erro || "Não deu para cadastrar.");
        setNovoAvulso(false);
        setNomeAvulso("");
        router.refresh();
        avisar(`${nome} entrou na lista. PIN ${r.pin} — anote e passe para ele.`);
      })
      .finally(() => setPendente(false));
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{formatarData(rodada.data)}</span>
          <h1>{rodada.nome || "Rodada"}</h1>
        </div>
        <div className="grow" />
        <span className={"pill " + (aberta ? "warn" : "ok")}>{aberta ? "Aberta" : "Fechada"}</span>
        <Link className="btn sm ghost" href="/rodadas">Voltar</Link>
      </div>

      <div className="stack">
        {/* ---------------- presença ---------------- */}
        {aberta ? (
          <div className="card pad stack">
            <div className="sect-title">
              Quem veio hoje <span className="pill mute">{(rodada.present || []).length} confirmados</span>
            </div>
            <div className="row">
              {jogadores
                .filter((p) => p.ativo !== false)
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map((p) => (
                  <button
                    key={p.id}
                    className="chip"
                    aria-pressed={(rodada.present || []).includes(p.id)}
                    disabled={!podeEditar || pendente}
                    onClick={() => rodar(() => alternarPresenca(rodada.id, p.id))}
                  >
                    {p.nome}
                    <span className="cnum">{ovr(p)}</span>
                  </button>
                ))}
            </div>
            {podeEditar ? (
              <div className="row">
                <button className="btn sm" onClick={() => setNovoAvulso(true)}>+ Jogador avulso</button>
                <span className="note">Avulso entra no sorteio, pontua e também recebe PIN para entrar.</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ---------------- times ---------------- */}
        {!times.length ? (
          <div className="card empty">
            <h3>Times ainda não sorteados</h3>
            <p>Marque os presentes e sorteie. O sorteio respeita as posições do futsal e equilibra a força dos times.</p>
            {podeEditar ? (
              <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
                <label className="field" style={{ textAlign: "left" }}>
                  <span>Times</span>
                  <select value={qtdTimes} onChange={(e) => setQtdTimes(Number(e.target.value))}>
                    {[2, 3, 4].map((n) => <option key={n} value={n}>{n} times</option>)}
                  </select>
                </label>
                <button
                  className="btn primary" style={{ alignSelf: "flex-end" }} disabled={pendente}
                  onClick={() => rodar(() => sortear(rodada.id, qtdTimes), "Times sorteados! Agora escolha os capitães.")}
                >
                  Sortear times
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="stack">
            <div className="row">
              <div className="sect-title grow">Times da rodada</div>
              {podeEditar ? (
                <>
                  <button
                    className="btn sm" disabled={pendente}
                    onClick={() => rodar(() => sortear(rodada.id, qtdTimes), "Times sorteados de novo.")}
                  >
                    Sortear de novo
                  </button>
                  <button className="btn sm ghost danger" onClick={() => setConfirmando("limpar")}>Limpar</button>
                </>
              ) : null}
            </div>

            {podeEditar && semCapitao.length ? (
              <div className="aviso">
                {semCapitao.length === 1
                  ? `${semCapitao[0].nome} está sem capitão.`
                  : `${semCapitao.length} times estão sem capitão.`}{" "}
                Escolha um em cada time abaixo — a rodada só fecha com todos definidos.
              </div>
            ) : null}

            {podeEditar ? (
              <p className="note">Toque em um jogador e depois em outro para trocá-los de lugar — inclusive com quem está no banco.</p>
            ) : null}

            <div className="teams">
              {times.map((tm) => {
                const escalados = tm.slots.filter((s) => s.playerId);
                const soma = tm.slots.reduce((s, x) => s + ovr(porId(x.playerId)), 0);
                return (
                  <div className="team" key={tm.id}>
                    <div className={"team-head " + tm.cls}>
                      {renomeando === tm.id ? (
                        <input
                          value={nomeNovo}
                          autoFocus
                          maxLength={40}
                          onChange={(e) => setNomeNovo(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              rodar(() => renomearTime(rodada.id, tm.id, nomeNovo), "Nome do time salvo.");
                              setRenomeando(null);
                            }
                            if (e.key === "Escape") setRenomeando(null);
                          }}
                          onBlur={() => setRenomeando(null)}
                          style={{ padding: "3px 7px", fontFamily: "var(--f-data)", fontWeight: 700 }}
                        />
                      ) : (
                        <b>{tm.nome}</b>
                      )}
                      <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                        <span className="avg">MÉDIA {Math.round(soma / (escalados.length || 1))}</span>
                        {podeEditar && renomeando !== tm.id ? (
                          <button
                            className="btn-icone"
                            title="Mudar o nome do time"
                            onClick={() => { setNomeNovo(tm.nome); setRenomeando(tm.id); }}
                          >
                            ✎
                          </button>
                        ) : null}
                      </span>
                    </div>

                    <div className="court">
                      <Quadra />
                      {tm.slots.map((s, i) => {
                        const p = porId(s.playerId);
                        const [x, y] = SLOT_XY[i] || [50, 50];
                        const chave = tm.id + ":" + i;
                        const ehCapitao = !!p && tm.capitao === p.id;
                        return (
                          <div
                            key={chave}
                            className={"slot" + (p ? "" : " free") + (sel === chave ? " sel" : "")}
                            style={{ left: x + "%", top: y + "%" }}
                          >
                            <button className="slotinner" disabled={!podeEditar} onClick={() => clicarSlot(chave)}>
                              <span className="p">{POS_LABEL[s.pos]}</span>
                              <span className="n">
                                {ehCapitao ? <span className="cap">C</span> : null}
                                {p ? p.nome : "vazio"}
                              </span>
                              {p ? <span className="o">{ovr(p)}</span> : null}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="capitania">
                      <span className="eyebrow">Capitão</span>
                      <div className="row" style={{ gap: 5 }}>
                        {escalados.map((s) => {
                          const p = porId(s.playerId)!;
                          return (
                            <button
                              key={p.id}
                              className="chip sm"
                              aria-pressed={tm.capitao === p.id}
                              disabled={!podeEditar || pendente}
                              onClick={() =>
                                rodar(
                                  () => definirCapitao(rodada.id, tm.id, tm.capitao === p.id ? null : p.id),
                                  tm.capitao === p.id ? "Braçadeira removida." : `${p.nome} é o capitão.`
                                )
                              }
                            >
                              {p.nome}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {(rodada.reservas || []).length ? (
              <div className="card">
                <div className="bench">
                  <span className="eyebrow" style={{ alignSelf: "center", marginRight: 4 }}>Banco</span>
                  {rodada.reservas.map((id) => {
                    const p = porId(id);
                    if (!p) return null;
                    const chave = "R:" + id;
                    return (
                      <button
                        key={id}
                        className={"chip" + (sel === chave ? " sel" : "")}
                        disabled={!podeEditar}
                        onClick={() => clicarSlot(chave)}
                      >
                        {p.nome}
                        <span className="cnum">{ovr(p)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ---------------- confrontos ---------------- */}
        {times.length ? (
          <div className="card pad stack">
            <div className="sect-title">
              Confrontos
              <span className="note" style={{ fontFamily: "var(--f-body)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                {cfg.regra_partida}
              </span>
            </div>

            {partidas.length ? (
              <div className="stack" style={{ gap: 10 }}>
                {partidas.map((m, i) => (
                  <Partida
                    key={i}
                    m={m}
                    indice={i}
                    aberto={abertaIdx === i}
                    onAbrir={() => setAbertaIdx(abertaIdx === i ? null : i)}
                    {...{ rodada, times, cfg, pendente, agora, porId, rodar, avisar, setAbertaIdx }}
                    podeEditar={podeApitar}
                  />
                ))}
              </div>
            ) : (
              <p className="note">Nenhum confronto lançado ainda.</p>
            )}

            {podeApitar ? (
              <>
                {sugestao ? (
                  <div className="proximo">
                    <div className="proximo-txt">
                      <span className="eyebrow">Próximo confronto</span>
                      <strong>
                        <Swatch hex={times.find((t) => t.id === sugestao.a)?.hex || "#888"} />
                        {nomeTime(sugestao.a)} <span className="x">×</span>{" "}
                        <Swatch hex={times.find((t) => t.id === sugestao.b)?.hex || "#888"} />
                        {nomeTime(sugestao.b)}
                      </strong>
                      <span className="note">{sugestao.motivo}</span>
                    </div>
                    <button
                      className="btn primary"
                      disabled={pendente}
                      onClick={() =>
                        rodar(() => adicionarConfronto(rodada.id, sugestao.a, sugestao.b))
                          .then((ok) => { if (ok) setAbertaIdx(partidas.length); })
                      }
                    >
                      Começar
                    </button>
                  </div>
                ) : null}

                <div className="row">
                  <span className="note">Montar na mão:</span>
                  <select style={{ width: "auto" }} value={timeA || sugestao?.a || times[0]?.id || ""} onChange={(e) => setTimeA(e.target.value)}>
                    {times.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <span className="note">×</span>
                  <select style={{ width: "auto" }} value={timeB || sugestao?.b || times[1]?.id || ""} onChange={(e) => setTimeB(e.target.value)}>
                    {times.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <button
                    className="btn sm"
                    disabled={pendente}
                    onClick={() =>
                      rodar(() => adicionarConfronto(
                        rodada.id,
                        timeA || sugestao?.a || times[0]?.id,
                        timeB || sugestao?.b || times[1]?.id,
                      )).then((ok) => { if (ok) setAbertaIdx(partidas.length); })
                    }
                  >
                    Adicionar confronto
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {/* ---------------- somatório da rodada ---------------- */}
        {times.length ? (
          <div className="card pad stack">
            <div className="sect-title">Gols e assistências do dia</div>
            <div className="tablewrap">
              <table style={{ minWidth: 480 }}>
                <thead>
                  <tr>
                    <th className="l">Jogador</th>
                    <th className="l">Time</th>
                    <th>Gols</th>
                    <th>Assist.</th>
                    <th>Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {times.flatMap((tm) =>
                    tm.slots.filter((s) => s.playerId).map((s) => {
                      const p = porId(s.playerId);
                      if (!p) return null;
                      const st = totais[p.id] || { g: 0, a: 0 };
                      const previsto =
                        st.g * cfg.pontos_gol + st.a * cfg.pontos_assist +
                        (rodada.campeao === tm.id ? cfg.pontos_vitoria : 0);
                      const ganho = aberta ? previsto : (rodada.premios || {})[p.id]?.moedas ?? 0;
                      return (
                        <tr key={p.id}>
                          <td className="l">
                            {tm.capitao === p.id ? <span className="cap">C</span> : null}
                            {p.nome}
                          </td>
                          <td className="l"><Swatch hex={tm.hex} /><span className="note">{tm.nome}</span></td>
                          <td>{st.g}</td>
                          <td>{st.a}</td>
                          <td className="coins">{ganho}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <p className="note">Os números vêm dos lances marcados em cada partida.</p>
          </div>
        ) : null}

        {/* ---------------- classificação ---------------- */}
        {tabela.length ? (
          <div className="card pad stack">
            <div className="sect-title">Classificação da rodada</div>
            <div className="tablewrap">
              <table style={{ minWidth: 420 }}>
                <thead>
                  <tr><th className="l">Time</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th></tr>
                </thead>
                <tbody>
                  {tabela.map((t, i) => (
                    <tr key={t.id}>
                      <td className="l">
                        <Swatch hex={times.find((x) => x.id === t.id)?.hex || "#888"} />
                        {t.nome}
                        {rodada.campeao === t.id ? (
                          <span className="pill ok" style={{ marginLeft: 6 }}>Campeão</span>
                        ) : i === 0 && !rodada.campeao && t.j > 0 ? (
                          <span className="pill warn" style={{ marginLeft: 6 }}>Líder</span>
                        ) : null}
                      </td>
                      <td>{t.j}</td><td>{t.v}</td><td>{t.e}</td><td>{t.d}</td><td>{t.gp}</td><td>{t.gc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {perm.gerirRodada ? (
              aberta ? (
                <div className="row">
                  <label className="field" style={{ minWidth: 180 }}>
                    <span>Campeão</span>
                    <select value={campeaoManual} onChange={(e) => setCampeaoManual(e.target.value)}>
                      <option value="">Automático (mais vitórias)</option>
                      {times.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                  </label>
                  <button
                    className="btn primary"
                    style={{ alignSelf: "flex-end" }}
                    disabled={pendente}
                    onClick={() =>
                      rodar(() => finalizarRodada(rodada.id, campeaoManual || null), "Rodada fechada. Pontos distribuídos!")
                    }
                  >
                    Fechar rodada e distribuir pontos
                  </button>
                </div>
              ) : (
                <div className="row">
                  <span className="pill ok">Pontos distribuídos</span>
                  <button className="btn sm ghost danger" onClick={() => setConfirmando("reabrir")}>Reabrir rodada</button>
                </div>
              )
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ---------------- modais ---------------- */}
      {novoAvulso ? (
        <Modal
          titulo="Jogador avulso"
          onFechar={() => setNovoAvulso(false)}
          rodape={
            <>
              <button className="btn ghost" onClick={() => setNovoAvulso(false)}>Cancelar</button>
              <button className="btn primary" onClick={criarAvulso} disabled={pendente}>Cadastrar</button>
            </>
          }
        >
          <label className="field">
            <span>Nome</span>
            <input value={nomeAvulso} onChange={(e) => setNomeAvulso(e.target.value)} autoFocus />
          </label>
          <div className="field">
            <span>Nota base</span>
            <div className="row">
              {[60, 65, 70, 75, 80].map((b) => (
                <button key={b} type="button" className="chip" aria-pressed={baseAvulso === b} onClick={() => setBaseAvulso(b)}>
                  {b}
                </button>
              ))}
            </div>
          </div>
          <p className="note">Ele entra no elenco como avulso: joga, marca gol, pontua e recebe um PIN de 4 dígitos para acompanhar os próprios números. O PIN aparece aqui assim que você cadastrar.</p>
        </Modal>
      ) : null}

      {confirmando === "reabrir" ? (
        <Confirmar
          titulo="Reabrir a rodada?"
          texto="Os pontos distribuídos voltam para o caixa e as estatísticas desta rodada são descontadas de cada jogador. Dá para fechar de novo depois de corrigir."
          labelOk="Reabrir e estornar"
          onOk={() => { setConfirmando(null); rodar(() => reabrirRodada(rodada.id), "Rodada reaberta. Pontos estornados."); }}
          onCancelar={() => setConfirmando(null)}
        />
      ) : null}

      {confirmando === "limpar" ? (
        <Confirmar
          titulo="Limpar os times?"
          texto="Os times, os capitães, os confrontos e os lances desta rodada são apagados. A lista de presença continua como está."
          labelOk="Limpar tudo"
          onOk={() => { setConfirmando(null); rodar(() => limparTimes(rodada.id), "Times limpos."); }}
          onCancelar={() => setConfirmando(null)}
        />
      ) : null}

      <Toast msg={msg} />
    </>
  );
}

/* =====================================================================
   Uma partida: cabeçalho sempre visível, painel ao vivo quando aberto
   ===================================================================== */
function Partida({
  m, indice, aberto, onAbrir, rodada, times, cfg, podeEditar, pendente, agora, porId, rodar, setAbertaIdx,
}: {
  m: Match; indice: number; aberto: boolean; onAbrir: () => void;
  rodada: Round; times: Team[]; cfg: Config; podeEditar: boolean; pendente: boolean;
  agora: number; porId: (id: string | null) => Player | null;
  rodar: (fn: () => Promise<any>, sucesso?: string) => Promise<boolean>;
  avisar: (s: string) => void;
  setAbertaIdx: (n: number | null) => void;
}) {
  const A = times.find((t) => t.id === m.a);
  const B = times.find((t) => t.id === m.b);
  const ga = placar(m, "a");
  const gb = placar(m, "b");
  const status = m.status || "encerrada";
  const duracao = m.duracaoSeg || (cfg.duracao_min || 7) * 60;
  const decorrido = decorridoSeg(m, agora);
  const restante = duracao - decorrido;
  const acabouTempo = restante <= 0;
  const bateuGols = !!cfg.gols_limite && Math.max(ga, gb) >= cfg.gols_limite;

  const rotulo =
    status === "andamento" ? (m.rodando ? "Ao vivo" : "Pausada")
      : status === "pendente" ? "A começar"
      : "Encerrada";
  const classePill = status === "andamento" ? (m.rodando ? "bad" : "warn") : status === "pendente" ? "mute" : "ok";

  return (
    <div className={"partida" + (status === "andamento" ? " viva" : "")}>
      <button className="partida-cab" onClick={onAbrir}>
        <span className={"mteam" + (ga > gb ? " win" : "")} style={{ flex: 1, textAlign: "right" }}>
          <Swatch hex={A?.hex || "#888"} />{A?.nome || "?"}
        </span>
        <span className="placar-mini">{ga}</span>
        <span style={{ color: "var(--text-3)" }}>×</span>
        <span className="placar-mini">{gb}</span>
        <span className={"mteam" + (gb > ga ? " win" : "")} style={{ flex: 1 }}>
          <Swatch hex={B?.hex || "#888"} />{B?.nome || "?"}
        </span>
        <span className={"pill " + classePill}>
          {status === "andamento" && m.rodando ? <span className="ponto-vivo" /> : null}
          {rotulo}
        </span>
        <span className="note" aria-hidden="true">{aberto ? "▾" : "▸"}</span>
      </button>

      {aberto ? (
        <div className="partida-painel">
          {/* relógio e placar */}
          <div className="placar-linha">
            <div className="lado">
              <span className="lado-nome">{A?.nome}</span>
              <span className="lado-gols">{ga}</span>
            </div>
            <div className="relogio-bloco">
              <div className={"relogio" + (acabouTempo ? " estourado" : m.rodando ? " correndo" : "")}>
                {formatarRelogio(Math.max(0, restante))}
              </div>
              <span className="note">de {formatarRelogio(duracao)}</span>
            </div>
            <div className="lado">
              <span className="lado-nome">{B?.nome}</span>
              <span className="lado-gols">{gb}</span>
            </div>
          </div>

          {(acabouTempo || bateuGols) && status === "andamento" ? (
            <div className="aviso">
              {acabouTempo && bateuGols
                ? "Tempo esgotado e limite de gols atingido."
                : acabouTempo
                ? "Tempo esgotado."
                : `Limite de ${cfg.gols_limite} gols atingido.`}{" "}
              Encerre quando a jogada terminar.
            </div>
          ) : null}

          {podeEditar ? (
            <div className="row" style={{ justifyContent: "center" }}>
              {status === "pendente" ? (
                <button
                  className="btn primary" disabled={pendente}
                  onClick={() => { rodar(() => iniciarPartida(rodada.id, indice), "Bola rolando!"); setAbertaIdx(indice); }}
                >
                  Iniciar partida
                </button>
              ) : null}

              {status === "andamento" && m.rodando ? (
                <button className="btn dark" disabled={pendente} onClick={() => rodar(() => pausarPartida(rodada.id, indice))}>
                  Pausar
                </button>
              ) : null}

              {status === "andamento" && !m.rodando ? (
                <>
                  <button className="btn primary" disabled={pendente} onClick={() => rodar(() => iniciarPartida(rodada.id, indice))}>
                    Retomar
                  </button>
                  <button className="btn ghost" disabled={pendente} onClick={() => rodar(() => zerarCronometro(rodada.id, indice), "Cronômetro zerado.")}>
                    Zerar tempo
                  </button>
                </>
              ) : null}

              {status === "andamento" ? (
                <button className="btn" disabled={pendente} onClick={() => rodar(() => encerrarPartida(rodada.id, indice), "Partida encerrada.")}>
                  Encerrar
                </button>
              ) : null}

              {status === "encerrada" ? (
                <button className="btn sm ghost" disabled={pendente} onClick={() => rodar(() => reabrirPartida(rodada.id, indice))}>
                  Reabrir partida
                </button>
              ) : null}

              <div className="grow" />
              <button
                className="btn sm ghost danger" disabled={pendente}
                onClick={() => rodar(() => removerConfronto(rodada.id, indice), "Confronto removido.")}
              >
                Remover confronto
              </button>
            </div>
          ) : null}

          {/* lances por jogador */}
          <div className="lances">
            {[A, B].map((tm) =>
              tm ? (
                <div className="lances-time" key={tm.id}>
                  <div className={"lances-head " + tm.cls}>{tm.nome}</div>
                  {tm.slots.filter((s) => s.playerId).map((s) => {
                    const p = porId(s.playerId)!;
                    const gols = (m.eventos || []).filter((e) => e.t === "gol" && e.playerId === p.id).length;
                    const assists = (m.eventos || []).filter((e) => e.t === "assist" && e.playerId === p.id).length;
                    return (
                      <div className="lance-linha" key={p.id}>
                        <span className="lance-nome">
                          {tm.capitao === p.id ? <span className="cap">C</span> : null}
                          {p.nome}
                        </span>
                        <button
                          className={"marca" + (gols ? " tem" : "")}
                          disabled={!podeEditar || pendente}
                          title="Marcar gol"
                          onClick={() => rodar(() => registrarLance(rodada.id, indice, { t: "gol", teamId: tm.id, playerId: p.id }))}
                        >
                          G<b>{gols}</b>
                        </button>
                        <button
                          className={"marca" + (assists ? " tem" : "")}
                          disabled={!podeEditar || pendente}
                          title="Marcar assistência"
                          onClick={() => rodar(() => registrarLance(rodada.id, indice, { t: "assist", teamId: tm.id, playerId: p.id }))}
                        >
                          A<b>{assists}</b>
                        </button>
                      </div>
                    );
                  })}
                  {podeEditar ? (
                    <button
                      className="btn sm ghost block"
                      disabled={pendente}
                      onClick={() => rodar(() => registrarLance(rodada.id, indice, { t: "gol", teamId: tm.id, playerId: null }))}
                    >
                      + Gol sem autor
                    </button>
                  ) : null}
                </div>
              ) : null
            )}
          </div>

          {/* lances registrados */}
          {(m.eventos || []).length ? (
            <div className="linha-tempo">
              <span className="eyebrow">Lances</span>
              {(m.eventos || []).slice().reverse().map((e) => (
                <div className="lance-item" key={e.id}>
                  <span className="lance-min">{formatarRelogio(e.seg)}</span>
                  <span className={"lance-tipo " + e.t}>{e.t === "gol" ? "GOL" : "ASS"}</span>
                  <span className="grow">
                    {e.playerId ? porId(e.playerId)?.nome || "—" : "sem autor"}
                    <span className="note"> · {times.find((t) => t.id === e.teamId)?.nome}</span>
                  </span>
                  {podeEditar ? (
                    <button
                      className="btn-icone" title="Desfazer este lance" disabled={pendente}
                      onClick={() => rodar(() => removerLance(rodada.id, indice, e.id))}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
