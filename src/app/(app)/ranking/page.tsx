import Link from "next/link";
import { lerJogadores } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import { ovr, Player } from "@/lib/domain";
import { Avatar, Ovr, PosTag } from "@/components/ui";

export const dynamic = "force-dynamic";

/* Pontos ganhos na vida: não caem quando o jogador gasta na loja. */
const ganhos = (p: Player) => p.stats.moedasTotais ?? p.moedas;

/* Ordenações do ranking. O desempate é sempre o mesmo: overall, depois nome. */
const ORDENS = {
  pontos: {
    rotulo: "Pontos ganhos",
    titulo: "Quem mais fez pontos na vida da pelada — gastar na loja não derruba a posição.",
    valor: ganhos,
    resumo: (p: Player) => `${ganhos(p)} ${ganhos(p) === 1 ? "ponto ganho" : "pontos ganhos"}`,
  },
  overall: {
    rotulo: "Overall",
    titulo: "Overall de 0 a 100, média dos quatro critérios.",
    valor: (p: Player) => ovr(p),
    resumo: (p: Player) => `Overall ${ovr(p)}`,
  },
  gols: {
    rotulo: "Gols",
    titulo: "Artilharia: quem mais balançou a rede.",
    valor: (p: Player) => p.stats.gols,
    resumo: (p: Player) => `${p.stats.gols} ${p.stats.gols === 1 ? "gol" : "gols"} · ${p.stats.assist} assist.`,
  },
  titulos: {
    rotulo: "Vitórias e títulos",
    titulo: "Rodadas vencidas com o time campeão e vitórias em confrontos.",
    valor: (p: Player) => p.stats.titulos * 1000 + p.stats.v,
    resumo: (p: Player) =>
      `${p.stats.titulos} ${p.stats.titulos === 1 ? "título" : "títulos"} · ${p.stats.v} ${p.stats.v === 1 ? "vitória" : "vitórias"}`,
  },
} as const;

type Ordem = keyof typeof ORDENS;
const CHAVES = Object.keys(ORDENS) as Ordem[];

function ordenar(lista: Player[], ordem: Ordem) {
  const f = ORDENS[ordem].valor;
  return lista
    .slice()
    .sort((a, b) => f(b) - f(a) || ovr(b) - ovr(a) || a.nome.localeCompare(b.nome));
}

export default async function PaginaRanking({
  searchParams,
}: { searchParams: { [k: string]: string | undefined } }) {
  const admin = ehAdmin(lerSessao());
  const soMensalistas = searchParams?.mensalistas === "1";
  const ordem: Ordem = CHAVES.includes(searchParams?.ord as Ordem) ? (searchParams!.ord as Ordem) : "pontos";
  const q = (o: Ordem) => `/ranking?ord=${o}${soMensalistas ? "&mensalistas=1" : ""}`;
  const todos = (await lerJogadores()).filter((p) => p.ativo !== false);
  const lista = ordenar(soMensalistas ? todos.filter((p) => p.tipo !== "avulso") : todos, ordem);

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

  /* No celular a coluna do critério escolhido nunca some. */
  const mostrar = (col: string) =>
    ({
      pontos: ["ganhos"],
      overall: ["gols"],
      gols: ["gols"],
      titulos: ["v", "tit"],
    } as Record<Ordem, string[]>)[ordem].includes(col) ? "" : "opt";

  const podio = lista.slice(0, 3);
  const rotulos = ["1º LUGAR", "2º LUGAR", "3º LUGAR"];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ranking geral</h1>
          <p>{ORDENS[ordem].titulo}</p>
        </div>
        <div className="grow" />
        <Link
          className="btn sm"
          href={soMensalistas ? `/ranking?ord=${ordem}` : `/ranking?ord=${ordem}&mensalistas=1`}
        >
          {soMensalistas ? "Mostrar todos" : "Só mensalistas"}
        </Link>
      </div>

      <div className="row" style={{ marginBottom: 14, gap: 7 }}>
        <span className="eyebrow">Ordenar por</span>
        {CHAVES.map((k) => (
          <Link key={k} className="chip" href={q(k)} aria-pressed={ordem === k}>
            {ORDENS[k].rotulo}
          </Link>
        ))}
      </div>

      <div className="podium">
        {podio.map((p, i) => (
          <Link key={p.id} href={`/jogador/${p.id}`} className={"pod p" + (i + 1)}>
            <Avatar nome={p.nome} url={p.foto_url} tam={46} borda />
            <span className="rk">{rotulos[i]}</span>
            <span className="nm">{p.nome}</span>
            <span className="mt">{ORDENS[ordem].resumo(p)}</span>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="tablewrap">
          <table className="tb-compacta">
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th>
                <th className="l">Jogador</th>
                <th className="l opt">Pos</th>
                <th>Ovr</th>
                <th className="opt">Rod</th>
                <th className={mostrar("v")}>V</th>
                <th className={mostrar("gols")}>Gols</th>
                <th className="opt">Ass</th>
                <th className={mostrar("tit")}>Tít</th>
                <th className={mostrar("ganhos")}>Ganhos</th>
                <th>Carteira</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p, i) => (
                <tr key={p.id}>
                  <td className="l" style={{ color: "var(--text-3)" }}>{i + 1}</td>
                  <td className="l">
                    <Link className="chip com-foto" href={`/jogador/${p.id}`}>
                      <Avatar nome={p.nome} url={p.foto_url} tam={24} />
                      {p.nome}
                      {p.tipo === "avulso" ? <span className="cnum">avulso</span> : null}
                    </Link>
                  </td>
                  <td className="l opt"><PosTag pos={p.pos} /></td>
                  <td><Ovr v={ovr(p)} /></td>
                  <td className="opt">{p.stats.rodadas}</td>
                  <td className={mostrar("v")}>{p.stats.v}</td>
                  <td className={mostrar("gols")}>{p.stats.gols}</td>
                  <td className="opt">{p.stats.assist}</td>
                  <td className={mostrar("tit")}>{p.stats.titulos}</td>
                  <td className={"coins " + mostrar("ganhos")}>{ganhos(p)}</td>
                  <td className="coins">{p.moedas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="note" style={{ marginTop: 10 }}>
        Rod = rodadas disputadas · V = vitórias em confrontos · Tít = rodadas vencidas com o time campeão ·
        Ganhos = pontos feitos na vida · Carteira = o que sobrou para gastar na loja.
      </p>
    </>
  );
}
