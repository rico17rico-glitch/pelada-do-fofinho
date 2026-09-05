import Link from "next/link";
import { lerConfig, lerJogador, lerJogadores } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import { ovr } from "@/lib/domain";
import Loja from "./Loja";

export const dynamic = "force-dynamic";

export default async function PaginaLoja({
  searchParams,
}: { searchParams: { [k: string]: string | undefined } }) {
  const sessao = lerSessao();
  const admin = ehAdmin(sessao);
  const cfg = await lerConfig();

  const alvoId = admin ? searchParams?.j : sessao && sessao.tipo === "jogador" ? sessao.playerId : undefined;
  const alvo = alvoId ? await lerJogador(alvoId) : null;

  if (admin && !alvo) {
    const todos = (await lerJogadores())
      .filter((p) => p.ativo !== false)
      .sort((a, b) => ovr(b) - ovr(a) || a.nome.localeCompare(b.nome));
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Loja</h1>
            <p>Escolha o jogador para gastar os pontos dele.</p>
          </div>
        </div>
        <div className="card pad">
          <div className="row">
            {todos.map((p) => (
              <Link key={p.id} className="chip" href={`/loja?j=${p.id}`}>
                {p.nome}
                <span className="cnum">{p.moedas}</span>
              </Link>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (!alvo) {
    return (
      <div className="card empty">
        <h3>Jogador não encontrado</h3>
        <p>Volte ao ranking e tente de novo.</p>
      </div>
    );
  }

  return <Loja jogador={alvo} cfg={cfg} admin={admin} />;
}
