"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Config, Player, formatarData, formatarRelogio, ovr } from "@/lib/domain";
import {
  Copa as TipoCopa, CopaJogo, CopaTime, ROTULO_STATUS,
  campeaoDaCopa, classificacao, draftTerminou, eliminados, estatisticasDaCopa,
  faseDeGruposCompleta, forcaDoTime, golsDoLado, jogadoresDisponiveis, precisaDePenaltis,
  semifinaisResolvidas, tempoDoJogo, timeDaVez, vencedorDoJogo,
} from "@/lib/copa";
import {
  abrirDraft, alternarParticipante, desfazerEscolha, encerrarCopa, encerrarJogo,
  escolherNoDraft, gerarJogoFinal, iniciarFaseDeGrupos, iniciarJogo, pausarJogo,
  reabrirJogo, registrarLanceCopa, registrarPenaltis, removerLanceCopa, renomearTimeCopa,
  sortearMataMata, zerarJogo,
} from "@/lib/actions-copa";
import { Avatar, Confirmar, Modal, Swatch, Toast, useToast } from "@/components/ui";
import Chaveamento from "./Chaveamento";

export default function Copa({
  copa, jogadores, cfg, meuId, organizador, podeApitar, agoraServidor,
}: {
  copa: TipoCopa; jogadores: Player[]; cfg: Config; meuId: string | null;
  organizador: boolean; podeApitar: boolean; agoraServidor: string;
}) {
  const router = useRouter();
  const { msg, avisar } = useToast();
  const [pendente, setPendente] = useState(false);
  const [capitaes, setCapitaes] = useState<string[]>([]);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [nomeNovo, setNomeNovo] = useState("");
  const [confirmando, setConfirmando] = useState<null | "encerrar">(null);
  const [jogoAberto, setJogoAberto] = useState<string | null>(null);

  const porId = (id: string | null) => jogadores.find((p) => p.id === id) || null;
  const nomeDe = (id: string | null) => porId(id)?.nome || "—";
  const times = copa.times || [];
  const jogos = copa.jogos || [];
  const timePorId = (id: string) => times.find((t) => t.id === id) || null;

  /* relógio alinhado com o servidor, igual à rodada */
  const [offset] = useState(() => Date.now() - Date.parse(agoraServidor));
  const [, setTick] = useState(0);
  const algumRodando = jogos.some((j) => j.rodando);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!algumRodando) return;
    const id = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(id);
  }, [algumRodando, router]);
  const agora = Date.now() - offset;

  async function rodar(fn: () => Promise<{ ok: boolean; erro?: string; msg?: string }>, sucesso?: string) {
    setPendente(true);
    try {
      const r = await fn();
      if (!r.ok) { avisar(r.erro || "Não deu certo."); return false; }
      router.refresh();
      if (sucesso || r.msg) avisar(sucesso || r.msg!);
      return true;
    } finally { setPendente(false); }
  }

  const tab = classificacao(copa);
  const fora = eliminados(copa);
  const stats = estatisticasDaCopa(copa);
  const campeaoId = copa.campeao || campeaoDaCopa(copa);
  const timeCampeao = campeaoId ? timePorId(campeaoId) : null;

  const artilheiros = Object.entries(stats)
    .map(([id, s]) => ({ id, nome: nomeDe(id), ...s }))
    .filter((x) => x.gols || x.assist)
    .sort((a, b) => b.gols - a.gols || b.assist - a.assist || a.nome.localeCompare(b.nome))
    .slice(0, 12);

  const grupo = jogos.filter((j) => j.fase === "grupo");
  const semis = jogos.filter((j) => j.fase === "semi");
  const final = jogos.find((j) => j.fase === "final") || null;
  const rodadasGrupo = Array.from(new Set(grupo.map((j) => j.rodada))).sort((a, b) => a - b);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            {copa.edicao ? `${copa.edicao}ª edição` : "Edição"}
            {copa.data ? ` · ${formatarData(copa.data)}` : ""}
          </span>
          <h1>{copa.nome}</h1>
        </div>
        <div className="grow" />
        <span className={"pill " + (copa.status === "encerrada" ? "ok" : "warn")}>
          {ROTULO_STATUS[copa.status]}
        </span>
        <Link className="btn sm ghost" href="/copa">Voltar</Link>
      </div>

      <div className="stack">
        {/* ---------------- campeão ---------------- */}
        {timeCampeao ? (
          <div className="faixa-campeao">
            <span className="eyebrow">Campeão da {copa.edicao ? `${copa.edicao}ª edição` : "edição"}</span>
            <strong>{timeCampeao.nome}</strong>
            <div className="row" style={{ justifyContent: "center", gap: 6 }}>
              {timeCampeao.jogadores.map((id) => (
                <Link key={id} className="chip com-foto" href={`/jogador/${id}`}>
                  <Avatar nome={nomeDe(id)} url={porId(id)?.foto_url} tam={26} />
                  {nomeDe(id)}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* ---------------- rascunho: elenco e capitães ---------------- */}
        {copa.status === "rascunho" ? (
          <>
            <div className="card pad stack">
              <div className="sect-title">
                Quem vai disputar
                <span className="pill mute">{(copa.elenco || []).length} inscritos</span>
              </div>
              <div className="row">
                {jogadores
                  .filter((p) => p.ativo !== false)
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map((p) => (
                    <button
                      key={p.id}
                      className="chip"
                      aria-pressed={(copa.elenco || []).includes(p.id)}
                      disabled={!organizador || pendente}
                      onClick={() => rodar(() => alternarParticipante(copa.id, p.id))}
                    >
                      {p.nome}
                      <span className="cnum">{ovr(p)}</span>
                    </button>
                  ))}
              </div>
            </div>

            {organizador ? (
              <div className="card pad stack">
                <div className="sect-title">
                  Capitães
                  <span className="pill mute">{capitaes.length} de 5</span>
                </div>
                <p className="note">
                  Escolha na ordem em que eles vão escolher no draft. Cada capitão vira um time e já entra
                  no próprio elenco. A escolha é em serpentina: quem pega por último numa volta abre a próxima.
                </p>
                <div className="row">
                  {(copa.elenco || []).map((id) => {
                    const i = capitaes.indexOf(id);
                    return (
                      <button
                        key={id}
                        className="chip"
                        aria-pressed={i >= 0}
                        disabled={pendente}
                        onClick={() =>
                          setCapitaes(i >= 0 ? capitaes.filter((x) => x !== id) : [...capitaes, id])
                        }
                      >
                        {i >= 0 ? <span className="cap">{i + 1}</span> : null}
                        {nomeDe(id)}
                      </button>
                    );
                  })}
                </div>
                {!(copa.elenco || []).length ? (
                  <p className="note">Marque primeiro quem vai disputar, ali em cima.</p>
                ) : null}
                <div className="row">
                  <button
                    className="btn primary"
                    disabled={pendente || capitaes.length < 2}
                    onClick={() => rodar(() => abrirDraft(copa.id, capitaes), "Draft aberto! Boa escolha.")}
                  >
                    Abrir o draft
                  </button>
                  <span className="note">Depois disso o elenco fecha.</span>
                </div>
              </div>
            ) : (
              <div className="card empty">
                <h3>Edição sendo montada</h3>
                <p>O mestre ainda está definindo quem joga e quem são os capitães.</p>
              </div>
            )}
          </>
        ) : null}

        {/* ---------------- times ---------------- */}
        {times.length ? (
          <div className="stack">
            <div className="row">
              <div className="sect-title grow">Times</div>
              {organizador && copa.status === "draft" && draftTerminou(copa) ? (
                <button
                  className="btn primary" disabled={pendente}
                  onClick={() => rodar(() => iniciarFaseDeGrupos(copa.id), "Tabela gerada! Todos contra todos.")}
                >
                  Gerar fase de grupos
                </button>
              ) : null}
            </div>

            <div className="copa-times">
              {times.map((tm) => {
                const eliminado = fora.includes(tm.id);
                const campeao = campeaoId === tm.id;
                return (
                  <div className={"copa-time" + (eliminado ? " fora" : "") + (campeao ? " campeao" : "")} key={tm.id}>
                    <div className={"team-head " + tm.cls}>
                      {renomeando === tm.id ? (
                        <input
                          value={nomeNovo} autoFocus maxLength={40}
                          onChange={(e) => setNomeNovo(e.target.value)}
                          onBlur={() => setRenomeando(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              rodar(() => renomearTimeCopa(copa.id, tm.id, nomeNovo), "Nome salvo.");
                              setRenomeando(null);
                            }
                            if (e.key === "Escape") setRenomeando(null);
                          }}
                          style={{ padding: "3px 7px", fontFamily: "var(--f-data)", fontWeight: 700 }}
                        />
                      ) : (
                        <b>{tm.nome}</b>
                      )}
                      <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                        <span className="avg">FORÇA {forcaDoTime(tm, jogadores)}</span>
                        {organizador && renomeando !== tm.id ? (
                          <button className="btn-icone" title="Mudar o nome" onClick={() => { setNomeNovo(tm.nome); setRenomeando(tm.id); }}>✎</button>
                        ) : null}
                      </span>
                    </div>
                    <ul className="copa-elenco">
                      {tm.jogadores.map((id) => (
                        <li key={id}>
                          <Avatar nome={nomeDe(id)} url={porId(id)?.foto_url} tam={22} />
                          {tm.capitao === id ? <span className="cap">C</span> : null}
                          {nomeDe(id)}
                          <span className="grow" />
                          <span className="note">{ovr(porId(id))}</span>
                        </li>
                      ))}
                    </ul>
                    {eliminado ? <div className="selo-fora">Eliminado</div> : null}
                    {campeao ? <div className="selo-campeao">Campeão</div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ---------------- draft ---------------- */}
        {copa.status === "draft" ? (
          <DraftPainel
            {...{ copa, jogadores, meuId, organizador, pendente, rodar, nomeDe, porId, timePorId }}
          />
        ) : null}

        {/* ---------------- classificação ---------------- */}
        {grupo.length ? (
          <div className="card pad stack">
            <div className="row">
              <div className="sect-title grow">Fase de grupos</div>
              {organizador && faseDeGruposCompleta(copa) && !semis.length ? (
                <button
                  className="btn primary" disabled={pendente}
                  onClick={() => rodar(() => sortearMataMata(copa.id), "Mata-mata montado. O último caiu.")}
                >
                  Fechar grupos e montar o mata-mata
                </button>
              ) : null}
            </div>
            <div className="tablewrap">
              <table style={{ minWidth: 460 }}>
                <thead>
                  <tr><th style={{ width: 30 }}>#</th><th className="l">Time</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>PTS</th></tr>
                </thead>
                <tbody>
                  {tab.map((l, i) => (
                    <tr key={l.id} className={i === tab.length - 1 && tab.length >= 5 ? "zona-queda" : ""}>
                      <td className="l" style={{ color: "var(--text-3)" }}>{i + 1}</td>
                      <td className="l"><Swatch hex={timePorId(l.id)?.hex || "#888"} />{l.nome}</td>
                      <td>{l.j}</td><td>{l.v}</td><td>{l.e}</td><td>{l.d}</td>
                      <td>{l.gp}</td><td>{l.gc}</td><td>{l.gp - l.gc}</td>
                      <td><b>{l.pts}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tab.length >= 5 ? (
              <p className="note">O último colocado está fora. Os quatro primeiros fazem 1º×4º e 2º×3º.</p>
            ) : null}
          </div>
        ) : null}

        {/* ---------------- jogos da fase de grupos ---------------- */}
        {grupo.length ? (
          <div className="card pad stack">
            <div className="sect-title">Jogos</div>
            {rodadasGrupo.map((r) => (
              <div className="stack" style={{ gap: 8 }} key={r}>
                <span className="eyebrow">{r}ª rodada</span>
                {grupo.filter((j) => j.rodada === r).map((j) => (
                  <JogoCopa key={j.id} {...{ j, copa, jogadores, cfg, podeApitar, pendente, agora, rodar, timePorId, nomeDe, jogoAberto, setJogoAberto }} />
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {/* ---------------- mata-mata ---------------- */}
        {semis.length ? (
          <div className="card pad stack">
            <div className="row">
              <div className="sect-title grow">Mata-mata</div>
              {organizador && semifinaisResolvidas(copa) && !final ? (
                <button className="btn primary" disabled={pendente} onClick={() => rodar(() => gerarJogoFinal(copa.id), "Final montada!")}>
                  Montar a final
                </button>
              ) : null}
              {organizador && campeaoDaCopa(copa) && copa.status !== "encerrada" ? (
                <button className="btn primary" disabled={pendente} onClick={() => setConfirmando("encerrar")}>
                  Encerrar a copa
                </button>
              ) : null}
            </div>

            <Chaveamento
              semis={semis}
              final={final}
              times={times}
              eliminadoNoGrupo={
                faseDeGruposCompleta(copa) && tab.length >= 5
                  ? timePorId(tab[tab.length - 1].id)
                  : null
              }
            />

            <span className="eyebrow">Semifinais</span>
            {semis.map((j) => (
              <JogoCopa key={j.id} {...{ j, copa, jogadores, cfg, podeApitar, pendente, agora, rodar, timePorId, nomeDe, jogoAberto, setJogoAberto }} />
            ))}

            {final ? (
              <>
                <span className="eyebrow" style={{ marginTop: 6 }}>Final</span>
                <JogoCopa {...{ j: final, copa, jogadores, cfg, podeApitar, pendente, agora, rodar, timePorId, nomeDe, jogoAberto, setJogoAberto }} />
              </>
            ) : (
              <p className="note">A final aparece quando as duas semifinais tiverem vencedor.</p>
            )}
          </div>
        ) : null}

        {/* ---------------- artilharia ---------------- */}
        {artilheiros.length ? (
          <div className="card pad stack">
            <div className="sect-title">Artilharia da edição</div>
            <div className="tablewrap">
              <table style={{ minWidth: 400 }}>
                <thead><tr><th style={{ width: 30 }}>#</th><th className="l">Jogador</th><th className="l">Time</th><th>Gols</th><th>Assist.</th></tr></thead>
                <tbody>
                  {artilheiros.map((a, i) => {
                    const tm = times.find((t) => t.jogadores.includes(a.id));
                    return (
                      <tr key={a.id}>
                        <td className="l" style={{ color: "var(--text-3)" }}>{i + 1}</td>
                        <td className="l"><Link className="chip" href={`/jogador/${a.id}`}>{a.nome}</Link></td>
                        <td className="l">{tm ? <><Swatch hex={tm.hex} /><span className="note">{tm.nome}</span></> : null}</td>
                        <td>{a.gols}</td>
                        <td>{a.assist}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="note">Números da Copa. Não entram no ranking nem na carteira da pelada.</p>
          </div>
        ) : null}
      </div>

      {confirmando === "encerrar" ? (
        <Confirmar
          titulo="Encerrar a copa?"
          texto="O time vencedor da final vira campeão e entra na galeria de títulos. Depois disso os jogos ficam travados."
          labelOk="Encerrar e coroar"
          onOk={() => { setConfirmando(null); rodar(() => encerrarCopa(copa.id), "Campeão coroado!"); }}
          onCancelar={() => setConfirmando(null)}
        />
      ) : null}

      <Toast msg={msg} />
    </>
  );
}

/* =====================================================================
   Draft
   ===================================================================== */
function DraftPainel({ copa, jogadores, meuId, organizador, pendente, rodar, nomeDe, porId, timePorId }: any) {
  const vez = timeDaVez(copa);
  const timeVez = vez ? timePorId(vez) : null;
  const disponiveis = jogadoresDisponiveis(copa)
    .map((id: string) => porId(id))
    .filter(Boolean)
    .sort((a: Player, b: Player) => ovr(b) - ovr(a) || a.nome.localeCompare(b.nome));

  const minhaVez = !!timeVez && !!meuId && timeVez.capitao === meuId;
  const podeEscolher = organizador || minhaVez;

  return (
    <div className="card pad stack">
      <div className="row">
        <div className="sect-title grow">Draft</div>
        {organizador && (copa.draft?.passo || 0) > 0 ? (
          <button className="btn sm ghost" disabled={pendente} onClick={() => rodar(() => desfazerEscolha(copa.id), "Escolha desfeita.")}>
            Desfazer última escolha
          </button>
        ) : null}
      </div>

      {vez ? (
        <div className={"vez-do-draft " + (minhaVez ? "minha" : "")}>
          <span className="eyebrow">Vez de escolher</span>
          <strong>{timeVez?.nome}</strong>
          <span className="note">
            capitão {nomeDe(timeVez?.capitao)} · faltam {disponiveis.length}{" "}
            {disponiveis.length === 1 ? "jogador" : "jogadores"}
          </span>
        </div>
      ) : (
        <div className="aviso">Draft completo. Gere a fase de grupos ali em cima.</div>
      )}

      {disponiveis.length ? (
        <>
          <span className="eyebrow">Ainda na mesa</span>
          <div className="row">
            {disponiveis.map((p: Player) => (
              <button
                key={p.id}
                className="chip"
                disabled={!podeEscolher || pendente}
                onClick={() => rodar(() => escolherNoDraft(copa.id, p.id), `${p.nome} para o ${timeVez?.nome}.`)}
              >
                {p.nome}
                <span className="cnum">{ovr(p)}</span>
              </button>
            ))}
          </div>
          {!podeEscolher ? (
            <p className="note">Espere a sua vez — só o capitão da vez (ou o mestre) escolhe agora.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* =====================================================================
   Um jogo da Copa
   ===================================================================== */
function JogoCopa({
  j, copa, jogadores, cfg, podeApitar, pendente, agora, rodar, timePorId, nomeDe, jogoAberto, setJogoAberto,
}: any) {
  const jogo: CopaJogo = j;
  const A: CopaTime | null = timePorId(jogo.a);
  const B: CopaTime | null = timePorId(jogo.b);
  const ga = golsDoLado(jogo, "a"), gb = golsDoLado(jogo, "b");
  const aberto = jogoAberto === jogo.id;
  const duracao = jogo.duracaoSeg || (cfg.duracao_min || 7) * 60;
  const restante = duracao - tempoDoJogo(jogo, agora);
  const acabou = restante <= 0;
  const bateuGols = !!cfg.gols_limite && Math.max(ga, gb) >= cfg.gols_limite && jogo.fase === "grupo";
  const vencedor = vencedorDoJogo(jogo);
  const pendentePenaltis = precisaDePenaltis(jogo) && !vencedor;
  const [penA, setPenA] = useState("");
  const [penB, setPenB] = useState("");

  const rotulo = jogo.status === "andamento" ? (jogo.rodando ? "Ao vivo" : "Pausado")
    : jogo.status === "pendente" ? "A começar" : "Encerrado";
  const classe = jogo.status === "andamento" ? (jogo.rodando ? "bad" : "warn")
    : jogo.status === "pendente" ? "mute" : pendentePenaltis ? "warn" : "ok";

  return (
    <div className={"partida" + (jogo.status === "andamento" ? " viva" : "")}>
      <button className="partida-cab" onClick={() => setJogoAberto(aberto ? null : jogo.id)}>
        <span className={"mteam" + (vencedor === jogo.a ? " win" : "")} style={{ flex: 1, textAlign: "right" }}>
          <Swatch hex={A?.hex || "#888"} />{A?.nome || "?"}
        </span>
        <span className="placar-mini">{ga}</span>
        <span style={{ color: "var(--text-3)" }}>×</span>
        <span className="placar-mini">{gb}</span>
        <span className={"mteam" + (vencedor === jogo.b ? " win" : "")} style={{ flex: 1 }}>
          <Swatch hex={B?.hex || "#888"} />{B?.nome || "?"}
        </span>
        {jogo.penA != null && jogo.penB != null ? (
          <span className="pill mute">pên {jogo.penA}×{jogo.penB}</span>
        ) : null}
        <span className={"pill " + classe}>
          {jogo.status === "andamento" && jogo.rodando ? <span className="ponto-vivo" /> : null}
          {pendentePenaltis ? "Pênaltis" : rotulo}
        </span>
        <span className="note" aria-hidden="true">{aberto ? "▾" : "▸"}</span>
      </button>

      {aberto ? (
        <div className="partida-painel">
          <div className="placar-linha">
            <div className="lado"><span className="lado-nome">{A?.nome}</span><span className="lado-gols">{ga}</span></div>
            <div className="relogio-bloco">
              <div className={"relogio" + (acabou ? " estourado" : jogo.rodando ? " correndo" : "")}>
                {formatarRelogio(Math.max(0, restante))}
              </div>
              <span className="note">de {formatarRelogio(duracao)}</span>
            </div>
            <div className="lado"><span className="lado-nome">{B?.nome}</span><span className="lado-gols">{gb}</span></div>
          </div>

          {(acabou || bateuGols) && jogo.status === "andamento" ? (
            <div className="aviso">{acabou ? "Tempo esgotado." : `Limite de ${cfg.gols_limite} gols atingido.`} Encerre quando a jogada terminar.</div>
          ) : null}

          {pendentePenaltis ? (
            <div className="aviso">
              Empate no tempo normal. Lance o placar dos pênaltis para definir quem passa.
            </div>
          ) : null}

          {podeApitar && copa.status !== "encerrada" ? (
            <div className="row" style={{ justifyContent: "center" }}>
              {jogo.status === "pendente" ? (
                <button className="btn primary" disabled={pendente} onClick={() => rodar(() => iniciarJogo(copa.id, jogo.id), "Bola rolando!")}>Iniciar</button>
              ) : null}
              {jogo.status === "andamento" && jogo.rodando ? (
                <button className="btn dark" disabled={pendente} onClick={() => rodar(() => pausarJogo(copa.id, jogo.id))}>Pausar</button>
              ) : null}
              {jogo.status === "andamento" && !jogo.rodando ? (
                <>
                  <button className="btn primary" disabled={pendente} onClick={() => rodar(() => iniciarJogo(copa.id, jogo.id))}>Retomar</button>
                  <button className="btn ghost" disabled={pendente} onClick={() => rodar(() => zerarJogo(copa.id, jogo.id), "Cronômetro zerado.")}>Zerar tempo</button>
                </>
              ) : null}
              {jogo.status === "andamento" ? (
                <button className="btn" disabled={pendente} onClick={() => rodar(() => encerrarJogo(copa.id, jogo.id), "Jogo encerrado.")}>Encerrar</button>
              ) : null}
              {jogo.status === "encerrada" ? (
                <button className="btn sm ghost" disabled={pendente} onClick={() => rodar(() => reabrirJogo(copa.id, jogo.id))}>Reabrir</button>
              ) : null}
            </div>
          ) : null}

          {jogo.fase !== "grupo" && podeApitar && copa.status !== "encerrada" ? (
            <div className="row" style={{ justifyContent: "center", gap: 8 }}>
              <span className="eyebrow">Pênaltis</span>
              <input
                inputMode="numeric" style={{ width: 62, textAlign: "center" }}
                placeholder={String(jogo.penA ?? "")} value={penA}
                onChange={(e) => setPenA(e.target.value.replace(/\D/g, "").slice(0, 2))}
              />
              <span className="note">×</span>
              <input
                inputMode="numeric" style={{ width: 62, textAlign: "center" }}
                placeholder={String(jogo.penB ?? "")} value={penB}
                onChange={(e) => setPenB(e.target.value.replace(/\D/g, "").slice(0, 2))}
              />
              <button
                className="btn sm" disabled={pendente || penA === "" || penB === ""}
                onClick={() => rodar(() => registrarPenaltis(copa.id, jogo.id, Number(penA), Number(penB)), "Pênaltis registrados.")}
              >
                Salvar
              </button>
            </div>
          ) : null}

          <div className="lances">
            {[A, B].map((tm) => tm ? (
              <div className="lances-time" key={tm.id}>
                <div className={"lances-head " + tm.cls}>{tm.nome}</div>
                {tm.jogadores.map((id: string) => {
                  const gols = (jogo.eventos || []).filter((e) => e.t === "gol" && e.playerId === id).length;
                  const assists = (jogo.eventos || []).filter((e) => e.t === "assist" && e.playerId === id).length;
                  return (
                    <div className="lance-linha" key={id}>
                      <span className="lance-nome">
                        {tm.capitao === id ? <span className="cap">C</span> : null}
                        {nomeDe(id)}
                      </span>
                      <button
                        className={"marca" + (gols ? " tem" : "")}
                        disabled={!podeApitar || pendente || copa.status === "encerrada"}
                        onClick={() => rodar(() => registrarLanceCopa(copa.id, jogo.id, { t: "gol", teamId: tm.id, playerId: id }))}
                      >G<b>{gols}</b></button>
                      <button
                        className={"marca" + (assists ? " tem" : "")}
                        disabled={!podeApitar || pendente || copa.status === "encerrada"}
                        onClick={() => rodar(() => registrarLanceCopa(copa.id, jogo.id, { t: "assist", teamId: tm.id, playerId: id }))}
                      >A<b>{assists}</b></button>
                    </div>
                  );
                })}
                {podeApitar && copa.status !== "encerrada" ? (
                  <button
                    className="btn sm ghost block" disabled={pendente}
                    onClick={() => rodar(() => registrarLanceCopa(copa.id, jogo.id, { t: "gol", teamId: tm.id, playerId: null }))}
                  >
                    + Gol sem autor
                  </button>
                ) : null}
              </div>
            ) : null)}
          </div>

          {(jogo.eventos || []).length ? (
            <div className="linha-tempo">
              <span className="eyebrow">Lances</span>
              {(jogo.eventos || []).slice().reverse().map((e) => (
                <div className="lance-item" key={e.id}>
                  <span className="lance-min">{formatarRelogio(e.seg)}</span>
                  <span className={"lance-tipo " + e.t}>{e.t === "gol" ? "GOL" : "ASS"}</span>
                  <span className="grow">
                    {e.playerId ? nomeDe(e.playerId) : "sem autor"}
                    <span className="note"> · {timePorId(e.teamId)?.nome}</span>
                  </span>
                  {podeApitar && copa.status !== "encerrada" ? (
                    <button className="btn-icone" title="Desfazer" disabled={pendente} onClick={() => rodar(() => removerLanceCopa(copa.id, jogo.id, e.id))}>×</button>
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
