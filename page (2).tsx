import Link from "next/link";
import { lerJogadores } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import { ovr, Player } from "@/lib/domain";
import { Ovr, PosTag } from "@/components/ui";

export const dynamic = "force-dynamic";

function ordenar(lista: Player[]) {
  return lista
    .slice()
    .sort((a, b) => ovr(b) - ovr(a) || b.stats.gols - a.stats.gols || a.nome.localeCompare(b.nome));
}

export default async function PaginaRanking({
  searchParams,
}: { searchParams: { [k: string]: string | undefined } }) {
  const admin = ehAdmin(lerSessao());
  const soMensalistas = searchParams?.mensalistas === "1";
  const todos = (await lerJogadores()).filter((p) => p.ativo !== false);
  const lista = ordenar(soMensalistas ? todos.filter((p) => p.tipo !== "avulso") : todos);

  if (!todos.length) {
    return (
      <div className="card empty">
        <h3>Sem elenco ainda</h3>
        <p style={{ maxWidth: "44ch", margin: "0 auto 16px" }}>
          Cadastre a galera com nome, posição e nota base (60 a 80). Todo jogador recebe um PIN
          de 4 dígitos para entrar e acompanhar os próprios números.
        </p>
        {admin ? (
          <Link className="btn primary" href="/elenco">Ir para o elenco</Link>
        ) : (
          <p className="note">O mestre da pelada ainda não montou o elenco.</p>
        )}
      </div>
    );
  }

  const podio = lista.slice(0, 3);
  const rotulos = ["1º LUGAR", "2º LUGAR", "3º LUGAR"];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ranking geral</h1>
          <p>Overall de 0 a 100, média dos quatro critérios. Pontos são a moeda da loja.</p>
        </div>
        <div className="grow" />
        <Link className="btn sm" href={soMensalistas ? "/ranking" : "/ranking?mensalistas=1"}>
          {soMensalistas ? "Mostrar todos" : "Só mensalistas"}
        </Link>
      </div>

      <div className="podium">
        {podio.map((p, i) => (
          <Link key={p.id} href={`/jogador/${p.id}`} className={"pod p" + (i + 1)}>
            <span className="rk">{rotulos[i]}</span>
            <span className="nm">{p.nome}</span>
            <span className="mt">
              Overall {ovr(p)} · {p.stats.gols} gols · {p.stats.titulos} títulos
            </span>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th>
                <th className="l">Jogador</th>
                <th className="l">Pos</th>
                <th>Ovr</th>
                <th>Rod</th>
                <th>V</th>
                <th>Gols</th>
                <th>Ass</th>
                <th>Tít</th>
                <th>Pontos</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p, i) => (
                <tr key={p.id}>
                  <td className="l" style={{ color: "var(--text-3)" }}>{i + 1}</td>
                  <td className="l">
                    <Link className="chip" href={`/jogador/${p.id}`}>
                      {p.nome}
                      {p.tipo === "avulso" ? <span className="cnum">avulso</span> : null}
                    </Link>
                  </td>
                  <td className="l"><PosTag pos={p.pos} /></td>
                  <td><Ovr v={ovr(p)} /></td>
                  <td>{p.stats.rodadas}</td>
                  <td>{p.stats.v}</td>
                  <td>{p.stats.gols}</td>
                  <td>{p.stats.assist}</td>
                  <td>{p.stats.titulos}</td>
                  <td className="coins">{p.moedas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="note" style={{ marginTop: 10 }}>
        Rod = rodadas disputadas · V = vitórias em confrontos · Tít = rodadas vencidas com o time campeão.
      </p>
    </>
  );
}
