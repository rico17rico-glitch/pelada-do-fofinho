import Link from "next/link";
import { redirect } from "next/navigation";
import { lerConfig, lerJogador } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import { sair } from "@/lib/actions";
import AbasCopa from "@/components/AbasCopa";

export const dynamic = "force-dynamic";

export default async function LayoutCopa({ children }: { children: React.ReactNode }) {
  const sessao = lerSessao();
  if (!sessao) redirect("/");

  const cfg = await lerConfig();
  const admin = ehAdmin(sessao);
  const eu = !admin && sessao.tipo === "jogador" ? await lerJogador(sessao.playerId) : null;
  if (!admin && !eu) redirect("/");

  return (
    <div className="copa-mundo">
      <header className="topbar copa-topbar">
        <div className="wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="badge-logo" src="/escudo.png" alt="" />
          <div className="brandblock">
            <b>Copa Fofo</b>
            <span>Torneio da {cfg.nome_pelada}</span>
          </div>
          <div className="grow" />
          <div className="who">
            <span className="dot" />
            {admin ? "Mestre da pelada" : eu?.nome}
          </div>
          <Link className="btn sm ghost" href="/ranking" style={{ color: "var(--header-text)", borderColor: "rgba(255,251,232,.35)" }}>
            ← Pelada
          </Link>
          <form action={sair}>
            <button className="btn sm ghost" style={{ color: "var(--header-text)", borderColor: "rgba(255,251,232,.35)" }}>
              Sair
            </button>
          </form>
        </div>
      </header>

      <AbasCopa />

      <main>
        <div className="wrap">{children}</div>
      </main>

      <footer className="site">
        <div className="wrap">
          Copa Fofo · 5 times, todos contra todos, o último cai. Depois 1º×4º e 2º×3º.
          Nada daqui conta no ranking da pelada.
        </div>
      </footer>
    </div>
  );
}
