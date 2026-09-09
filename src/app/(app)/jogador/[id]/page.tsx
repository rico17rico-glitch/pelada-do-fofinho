import Link from "next/link";
import { notFound } from "next/navigation";
import { lerCopas, lerJogador, lerRodadas } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import { formatarData, STATS_ZERO } from "@/lib/domain";
import { campanhaNaCopa } from "@/lib/copa";
import { CardJogador, Swatch } from "@/components/ui";
import TrocarPin from "./TrocarPin";
import TrocarFoto from "./TrocarFoto";
import TrocarPosicao from "./TrocarPosicao";

export const dynamic = "force-dynamic";

export default async function PaginaJogador({ params }: { params: { id: string } }) {
  const p = await lerJogador(params.id);
  if (!p) notFound();

  const sessao = lerSessao();
  const souEu = !!sessao && sessao.tipo === "jogador" && sessao.playerId === p.id;
  const admin = ehAdmin(sessao);
  const eu = !admin && sessao && sessao.tipo === "jogador" ? await lerJogador(sessao.playerId) : null;
  const podeTrocarFoto = souEu || admin || !!eu?.organizador;

  const s = { ...STATS_ZERO, ...(p.stats || {}) };
  const media = s.jogos ? (s.gols / s.jogos).toFixed(2).replace(".", ",") : "0,00";
  const aproveitamento = s.jogos ? Math.round(((s.v * 3 + s.e) / (s.jogos * 3)) * 100) : 0;

  const rodadas = (await lerRodadas())
    .filter((r) => r.status === "finalizada" && (r.premios || {})[p.id])
    .slice(0, 10);

  /* Copa Fofo entra como história à parte: não conta ponto nem overall. */
  const copa = campanhaNaCopa(await lerCopas(), { id: p.id, nome: p.nome });

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Perfil</span>
          <h1>{p.nome}</h1>
        </div>
        <div className="grow" />
        {podeTrocarFoto ? <TrocarFoto playerId={p.id} temFoto={!!p.foto_url} /> : null}
        {souEu || admin ? (
          <TrocarPosicao playerId={p.id} pos={p.pos} alt={p.alt || []} />
        ) : null}
        {souEu ? <TrocarPin /> : null}
        <Link className="btn sm ghost" href="/ranking">Voltar ao ranking</Link>
      </div>

      <div className="perfil-grid">
        <div><CardJogador p={p} /></div>

        <div className="stack">
          <div className="statgrid">
            <div><b>{s.rodadas}</b><span>Rodadas</span></div>
            <div><b>{s.jogos}</b><span>Jogos</span></div>
            <div><b>{s.v}</b><span>Vitórias</span></div>
            <div><b>{s.gols}</b><span>Gols</span></div>
            <div><b>{s.assist}</b><span>Assist.</span></div>
            <div><b>{s.titulos}</b><span>Títulos</span></div>
          </div>

          <div className="card pad">
            <div className="sect-title" style={{ marginBottom: 10 }}>Números</div>
            <div className="legend">
              <span>Média de gols por jogo: <b>{media}</b></span>
              <span>Aproveitamento: <b>{aproveitamento}%</b></span>
              <span>Pontos ganhos na vida: <b className="coins">{s.moedasTotais}</b></span>
            </div>
          </div>

          {rodadas.length ? (
            <div className="card pad">
              <div className="sect-title" style={{ marginBottom: 8 }}>Últimas rodadas</div>
              <div className="tablewrap">
                <table style={{ minWidth: 380 }}>
                  <thead>
                    <tr>
                      <th className="l">Data</th>
                      <th>Gols</th>
                      <th>Assist.</th>
                      <th>Pontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rodadas.map((r) => {
                      const a = r.premios[p.id];
                      return (
                        <tr key={r.id}>
                          <td className="l">
                            {formatarData(r.data)}
                            {a.titulos ? <span className="pill ok" style={{ marginLeft: 6 }}>campeão</span> : null}
                          </td>
                          <td>{a.gols}</td>
                          <td>{a.assist}</td>
                          <td className="coins">+{a.moedas}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}


          {copa.disputadas ? (
            <div className="card pad">
              <div className="row" style={{ alignItems: "center", marginBottom: 10 }}>
                <div className="sect-title grow">Copa Fofo</div>
                {copa.titulos ? (
                  <span className="pill ok">
                    {copa.titulos} {copa.titulos === 1 ? "título" : "títulos"}
                  </span>
                ) : null}
              </div>

              <div className="statgrid" style={{ marginBottom: 12 }}>
                <div><b>{copa.disputadas}</b><span>Edições</span></div>
                <div><b>{copa.jogos}</b><span>Jogos</span></div>
                <div><b>{copa.gols}</b><span>Gols</span></div>
                <div><b>{copa.assist}</b><span>Assist.</span></div>
              </div>

              <div className="stack" style={{ gap: 8 }}>
                {copa.edicoes.map((e) => (
                  <div key={e.copaId} className={"copa-linha" + (e.campeao ? " campea" : "")}>
                    <span className="copa-ed">{e.edicao ? `${e.edicao}ª` : "—"}</span>
                    <div className="copa-meio">
                      <span className="copa-hist-nome">
                        {e.hex ? <Swatch hex={e.hex} /> : null}
                        {e.time || e.nome}
                      </span>
                      <span className="note">
                        {e.soRegistro
                          ? "edição antiga, sem números registrados"
                          : `${e.jogos} ${e.jogos === 1 ? "jogo" : "jogos"} · ${e.gols} ${e.gols === 1 ? "gol" : "gols"} · ${e.assist} assist.`}
                      </span>
                    </div>
                    <span className={"pill " + (e.campeao ? "ok" : e.resultado === "Em andamento" ? "warn" : "mute")}>
                      {e.campeao ? "🏆 Campeão" : e.resultado}
                    </span>
                  </div>
                ))}
              </div>

              <p className="note" style={{ marginTop: 10 }}>
                Números da Copa. Não entram no ranking nem na carteira da pelada.
              </p>
            </div>
          ) : null}

          {(p.historico || []).length ? (
            <div className="card pad">
              <div className="sect-title" style={{ marginBottom: 8 }}>Compras na loja</div>
              {p.historico.slice(-8).reverse().map((h, i) => (
                <div
                  key={i}
                  className="row"
                  style={{ justifyContent: "space-between", borderBottom: "1px solid var(--line)", padding: "7px 0" }}
                >
                  <span>{h.txt}</span>
                  <span className="coins">−{h.custo}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
