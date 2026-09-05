"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Config, POS_LABEL, Player, Round, formatarData, ovr, tabelaRodada,
} from "@/lib/domain";
import {
  adicionarConfronto, ajustarEstatistica, ajustarPlacar, alternarPresenca, finalizarRodada,
  limparTimes, reabrirRodada, removerConfronto, salvarJogador, sortear, trocarJogadores,
} from "@/lib/actions";
import { Confirmar, Modal, Quadra, SLOT_XY, Stepper, Swatch, Toast, useToast } from "@/components/ui";

export default function Rodada({
  rodada, jogadores, cfg, admin,
}: { rodada: Round; jogadores: Player[]; cfg: Config; admin: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const { msg, avisar } = useToast();
  const [sel, setSel] = useState<string | null>(null);
  const [qtdTimes, setQtdTimes] = useState(rodada.teams?.length || cfg.qtd_times || 3);
  const [campeaoManual, setCampeaoManual] = useState<string>(rodada.campeao || "");
  const [confirmando, setConfirmando] = useState<null | "reabrir" | "limpar">(null);
  const [novoAvulso, setNovoAvulso] = useState(false);
  const [nomeAvulso, setNomeAvulso] = useState("");
  const [baseAvulso, setBaseAvulso] = useState(65);
  const [timeA, setTimeA] = useState("");
  const [timeB, setTimeB] = useState("");

  const aberta = rodada.status !== "finalizada";
  const podeEditar = admin && aberta;
  const porId = (id: string | null) => jogadores.find((p) => p.id === id) || null;
  const times = rodada.teams || [];
  const tabela = tabelaRodada(rodada);

  /* roda uma ação e recarrega os dados do servidor */
  function rodar(fn: () => Promise<{ ok: boolean; erro?: string; msg?: string }>, sucesso?: string) {
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) return avisar(r.erro || "Não deu certo.");
      router.refresh();
      if (sucesso || r.msg) avisar(sucesso || r.msg!);
    });
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
    iniciar(async () => {
      const r = await salvarJogador({ nome, pos: "ALA", alt: [], tipo: "avulso", base: baseAvulso });
      if (!r.ok) return avisar(r.erro || "Não deu para cadastrar.");
      setNovoAvulso(false);
      setNomeAvulso("");
      router.refresh();
      avisar(`${nome} entrou na lista. Marque-o como presente para incluir no sorteio.`);
    });
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
                .map((p) => {
                  const marcado = (rodada.present || []).includes(p.id);
                  return (
                    <button
                      key={p.id}
                      className="chip"
                      aria-pressed={marcado}
                      disabled={!podeEditar || pendente}
                      onClick={() => rodar(() => alternarPresenca(rodada.id, p.id))}
                    >
                      {p.nome}
                      <span className="cnum">{ovr(p)}</span>
                    </button>
                  );
                })}
            </div>
            {podeEditar ? (
              <div className="row">
                <button className="btn sm" onClick={() => setNovoAvulso(true)}>+ Jogador avulso</button>
                <span className="note">Avulso entra no sorteio e pontua, mas não tem login.</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ---------------- times ---------------- */}
        {!times.length ? (
          <div className="card empty">
            <h3>Times ainda não sorteados</h3>
            <p>
              Marque os presentes e sorteie. O sorteio respeita as posições do futsal e equilibra a
              força dos times.
            </p>
            {podeEditar ? (
              <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
                <label className="field" style={{ textAlign: "left" }}>
                  <span>Times</span>
                  <select value={qtdTimes} onChange={(e) => setQtdTimes(Number(e.target.value))}>
                    {[2, 3, 4].map((n) => <option key={n} value={n}>{n} times</option>)}
                  </select>
                </label>
                <button
                  className="btn primary"
                  style={{ alignSelf: "flex-end" }}
                  disabled={pendente}
                  onClick={() => rodar(() => sortear(rodada.id, qtdTimes), "Times sorteados!")}
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
                    className="btn sm"
                    disabled={pendente}
                    onClick={() => rodar(() => sortear(rodada.id, qtdTimes), "Times sorteados!")}
                  >
                    Sortear de novo
                  </button>
                  <button className="btn sm ghost danger" onClick={() => setConfirmando("limpar")}>
                    Limpar
                  </button>
                </>
              ) : null}
            </div>
            {podeEditar ? (
              <p className="note">
                Toque em um jogador e depois em outro para trocá-los de lugar — inclusive com quem está no banco.
              </p>
            ) : null}

            <div className="teams">
              {times.map((tm) => {
                const soma = tm.slots.reduce((s, x) => s + ovr(porId(x.playerId)), 0);
                const n = tm.slots.filter((x) => x.playerId).length || 1;
                return (
                  <div className="team" key={tm.id}>
                    <div className={"team-head " + tm.cls}>
                      <b>{tm.nome}</b>
                      <span className="avg">MÉDIA {Math.round(soma / n)}</span>
                    </div>
                    <div className="court">
                      <Quadra />
                      {tm.slots.map((s, i) => {
                        const p = porId(s.playerId);
                        const [x, y] = SLOT_XY[i] || [50, 50];
                        const chave = tm.id + ":" + i;
                        return (
                          <div
                            key={chave}
                            className={"slot" + (p ? "" : " free") + (sel === chave ? " sel" : "")}
                            style={{ left: x + "%", top: y + "%" }}
                          >
                            <button
                              className="slotinner"
                              disabled={!podeEditar}
                              onClick={() => clicarSlot(chave)}
                            >
                              <span className="p">{POS_LABEL[s.pos]}</span>
                              <span className="n">{p ? p.nome : "vazio"}</span>
                              {p ? <span className="o">{ovr(p)}</span> : null}
                            </button>
                          </div>
                        );
                      })}
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

            {(rodada.matches || []).length ? (
              <div>
                {rodada.matches.map((m, i) => {
                  const A = times.find((t) => t.id === m.a);
                  const B = times.find((t) => t.id === m.b);
                  return (
                    <div className="matchrow" key={i}>
                      <span className={"mteam" + (m.ga > m.gb ? " win" : "")} style={{ flex: 1, textAlign: "right" }}>
                        <Swatch hex={A?.hex || "#888"} />
                        {A?.nome || "?"}
                      </span>
                      <Stepper
                        valor={m.ga}
                        desabilitado={!podeEditar}
                        onMudar={(d) => rodar(() => ajustarPlacar(rodada.id, i, "ga", d))}
                      />
                      <span style={{ color: "var(--text-3)" }}>×</span>
                      <Stepper
                        valor={m.gb}
                        desabilitado={!podeEditar}
                        onMudar={(d) => rodar(() => ajustarPlacar(rodada.id, i, "gb", d))}
                      />
                      <span className={"mteam" + (m.gb > m.ga ? " win" : "")} style={{ flex: 1 }}>
                        <Swatch hex={B?.hex || "#888"} />
                        {B?.nome || "?"}
                      </span>
                      {podeEditar ? (
                        <button
                          className="btn sm ghost danger"
                          aria-label="Remover confronto"
                          onClick={() => rodar(() => removerConfronto(rodada.id, i))}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="note">Nenhum confronto lançado ainda.</p>
            )}

            {podeEditar ? (
              <div className="row">
                <select
                  style={{ width: "auto" }}
                  value={timeA || times[0]?.id || ""}
                  onChange={(e) => setTimeA(e.target.value)}
                >
                  {times.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
                <span className="note">×</span>
                <select
                  style={{ width: "auto" }}
                  value={timeB || times[1]?.id || ""}
                  onChange={(e) => setTimeB(e.target.value)}
                >
                  {times.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
                <button
                  className="btn sm primary"
                  disabled={pendente}
                  onClick={() =>
                    rodar(() =>
                      adicionarConfronto(
                        rodada.id,
                        timeA || times[0]?.id,
                        timeB || times[1]?.id
                      )
                    )
                  }
                >
                  Adicionar confronto
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ---------------- gols e assistências ---------------- */}
        {times.length ? (
          <div className="card pad stack">
            <div className="sect-title">Gols e assistências</div>
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
                    tm.slots
                      .filter((s) => s.playerId)
                      .map((s) => {
                        const p = porId(s.playerId);
                        if (!p) return null;
                        const st = (rodada.stats || {})[p.id] || { g: 0, a: 0 };
                        const previsto =
                          st.g * cfg.pontos_gol +
                          st.a * cfg.pontos_assist +
                          (rodada.campeao === tm.id ? cfg.pontos_vitoria : 0);
                        const ganho = aberta ? previsto : (rodada.premios || {})[p.id]?.moedas ?? 0;
                        return (
                          <tr key={p.id}>
                            <td className="l">{p.nome}</td>
                            <td className="l">
                              <Swatch hex={tm.hex} />
                              <span className="note">{tm.nome}</span>
                            </td>
                            <td>
                              <Stepper
                                valor={st.g}
                                desabilitado={!podeEditar}
                                onMudar={(d) => rodar(() => ajustarEstatistica(rodada.id, p.id, "g", d))}
                              />
                            </td>
                            <td>
                              <Stepper
                                valor={st.a}
                                desabilitado={!podeEditar}
                                onMudar={(d) => rodar(() => ajustarEstatistica(rodada.id, p.id, "a", d))}
                              />
                            </td>
                            <td className="coins">{ganho}</td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* ---------------- classificação ---------------- */}
        {tabela.length ? (
          <div className="card pad stack">
            <div className="sect-title">Classificação da rodada</div>
            <div className="tablewrap">
              <table style={{ minWidth: 420 }}>
                <thead>
                  <tr>
                    <th className="l">Time</th>
                    <th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th>
                  </tr>
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

            {admin ? (
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
                      rodar(
                        () => finalizarRodada(rodada.id, campeaoManual || null),
                        "Rodada fechada. Pontos distribuídos!"
                      )
                    }
                  >
                    Fechar rodada e distribuir pontos
                  </button>
                </div>
              ) : (
                <div className="row">
                  <span className="pill ok">Pontos distribuídos</span>
                  <button className="btn sm ghost danger" onClick={() => setConfirmando("reabrir")}>
                    Reabrir rodada
                  </button>
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
                <button
                  key={b}
                  type="button"
                  className="chip"
                  aria-pressed={baseAvulso === b}
                  onClick={() => setBaseAvulso(b)}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
          <p className="note">
            Ele entra no elenco como avulso: joga, marca gol e pontua, mas não recebe PIN de login.
          </p>
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
          texto="Os times, os confrontos e os gols lançados nesta rodada são apagados. A lista de presença continua como está."
          labelOk="Limpar tudo"
          onOk={() => { setConfirmando(null); rodar(() => limparTimes(rodada.id), "Times limpos."); }}
          onCancelar={() => setConfirmando(null)}
        />
      ) : null}

      <Toast msg={msg} />
    </>
  );
}
