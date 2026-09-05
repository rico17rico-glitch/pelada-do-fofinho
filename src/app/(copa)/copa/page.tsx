import { lerCopas, lerJogador } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import ListaCopas from "./ListaCopas";

export const dynamic = "force-dynamic";

export default async function PaginaCopas() {
  const sessao = lerSessao();
  const admin = ehAdmin(sessao);
  const eu = !admin && sessao && sessao.tipo === "jogador" ? await lerJogador(sessao.playerId) : null;
  const podeCriar = admin || !!eu?.organizador;

  const copas = await lerCopas();
  return <ListaCopas copas={copas} podeCriar={podeCriar} />;
}
