import Link from "next/link";
import { redirect } from "next/navigation";
import { lerConfig, lerJogador } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import { sair } from "@/lib/actions";
import Abas from "@/components/Abas";

export const dynamic = "force-dynamic";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = lerSessao();
  if (!sessao) redirect("/");

  const cfg = await lerConfig();
  const admin = ehAdmin(sessao);
  const eu = !admin && sessao.tipo === "jogador" ? await lerJogador(sessao.playerId) : null;
  if (!admin && !eu) redirect("/");

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="badge-logo" src="/escudo.png" alt="" />
          <div className="brandblock">
            <b>{cfg.nome_pelada}</b>
            <span>Futsal · {cfg.regra_partida}</span>
          </div>
          <div className="grow" />
          {admin ? (
            <div className="who"><span className="dot" />Mestre da pelada</div>
          ) : (
            /* atalho para o próprio perfil, onde dá para trocar o PIN */
            <Link className="who eu" href={`/jogador/${eu!.id}`}>
              <span className="dot" />
              {eu!.nome}
            </Link>
          )}
          <form action={sair}>
            <button
              className="btn sm ghost"
              style={{ color: "var(--header-text)", borderColor: "rgba(255,251,232,.35)" }}
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <Abas admin={admin} />

      <main>
        <div className="wrap">{children}</div>
      </main>

      <footer className="site">
        <div className="wrap">
          {cfg.nome_pelada} · vitória vale {cfg.pontos_vitoria} pts, gol {cfg.pontos_gol}, assistência{" "}
          {cfg.pontos_assist}.
        </div>
      </footer>
    </>
  );
}
