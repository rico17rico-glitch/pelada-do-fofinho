import Link from "next/link";
import { notFound } from "next/navigation";
import { lerJogador, lerRodadas } from "@/lib/db";
import { formatarData, STATS_ZERO } from "@/lib/domain";
import { CardJogador } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PaginaJogador({ params }: { params: { id: string } }) {
  const p = await lerJogador(params.id);
  if (!p) notFound();

  const s = { ...STATS_ZERO, ...(p.stats || {}) };
  const media = s.jogos ? (s.gols / s.jogos).toFixed(2).replace(".", ",") : "0,00";
  const aproveitamento = s.jogos ? Math.round(((s.v * 3 + s.e) / (s.jogos * 3)) * 100) : 0;

  const rodadas = (await lerRodadas())
    .filter((r) => r.status === "finalizada" && (r.premios || {})[p.id])
    .slice(0, 10);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Perfil</span>
          <h1>{p.nome}</h1>
        </div>
        <div className="grow" />
        <Link className="btn sm ghost" href="/ranking">Voltar ao ranking</Link>
      </div>

      <div
        className="grid2"
        style={{ gridTemplateColumns: "minmax(260px,340px) 1fr", alignItems: "start" }}
      >
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
