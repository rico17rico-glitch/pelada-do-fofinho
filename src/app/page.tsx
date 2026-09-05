import { redirect } from "next/navigation";
import { lerConfig, lerJogadores } from "@/lib/db";
import { lerSessao } from "@/lib/session";
import FormularioEntrada from "./FormularioEntrada";

export const dynamic = "force-dynamic";

export default async function PaginaEntrada() {
  if (lerSessao()) redirect("/ranking");

  let nomePelada = "Pelada do Fofinho";
  let regra = "";
  let jogadores: { id: string; nome: string }[] = [];
  let falha: string | null = null;

  try {
    const [cfg, todos] = await Promise.all([lerConfig(), lerJogadores()]);
    nomePelada = cfg.nome_pelada;
    regra = cfg.regra_partida;
    jogadores = todos
      .filter((p) => p.ativo !== false && p.tipo !== "avulso")
      .map((p) => ({ id: p.id, nome: p.nome }));
  } catch (e: any) {
    falha = e?.message || "Não consegui falar com o banco de dados.";
  }

  return (
    <div className="login-page">
      <div className="login-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/escudo.png" alt="Escudo da Pelada do Fofinho" />
        <h1>{nomePelada}</h1>
        {regra ? <p>Futsal · {regra}</p> : null}
      </div>
      <div className="login-form">
        <FormularioEntrada jogadores={jogadores} falha={falha} />
      </div>
    </div>
  );
}
