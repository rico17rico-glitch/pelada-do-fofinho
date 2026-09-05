import Link from "next/link";
import { lerCopas } from "@/lib/db";
import { galeriaDeTitulos } from "@/lib/copa";

export const dynamic = "force-dynamic";

export default async function PaginaTitulos() {
  const copas = await lerCopas();
  const comCampeao = copas.filter((c) => (c.campeoes || []).length);
  const galeria = galeriaDeTitulos(copas);
  const maior = galeria[0]?.titulos || 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Galeria de títulos</h1>
          <p>Quem já levantou a taça da Copa Fofo.</p>
        </div>
      </div>

      {!comCampeao.length ? (
        <div className="card empty">
          <h3>Nenhum campeão ainda</h3>
          <p>Assim que uma edição for encerrada, o time campeão aparece aqui.</p>
        </div>
      ) : (
        <div className="stack">
          <div className="taca-grid">
            {comCampeao.map((c) => (
              <div className="taca" key={c.id}>
                <div className="taca-topo">
                  <span className="taca-ed">{c.edicao ? `${c.edicao}ª edição` : "Edição"}</span>
                  <span className="taca-nome">{c.nome}</span>
                </div>
                <ul className="taca-lista">
                  {c.campeoes.map((x, i) => (
                    <li key={i}>
                      {x.playerId ? <Link href={`/jogador/${x.playerId}`}>{x.nome}</Link> : x.nome}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="mes-cab"><span className="mes-nome">Quem tem mais taça</span></div>
            <div className="tablewrap">
              <table style={{ minWidth: 420 }}>
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>#</th>
                    <th className="l">Jogador</th>
                    <th>Títulos</th>
                    <th className="l">Edições</th>
                  </tr>
                </thead>
                <tbody>
                  {galeria.map((l, i) => (
                    <tr key={(l.playerId || l.nome) + i}>
                      <td className="l" style={{ color: "var(--text-3)" }}>{i + 1}</td>
                      <td className="l">
                        {l.playerId ? <Link className="chip" href={`/jogador/${l.playerId}`}>{l.nome}</Link> : l.nome}
                      </td>
                      <td>
                        <span className={"taca-cont" + (l.titulos === maior ? " topo" : "")}>{l.titulos}</span>
                      </td>
                      <td className="l note">{l.edicoes.sort((a, b) => a - b).map((e) => `${e}ª`).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
