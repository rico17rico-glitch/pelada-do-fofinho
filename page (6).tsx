import { lerCaixa, lerJogador } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import Caixa from "./Caixa";

export const dynamic = "force-dynamic";

export default async function PaginaCaixa() {
  const sessao = lerSessao();
  const admin = ehAdmin(sessao);
  const eu = !admin && sessao && sessao.tipo === "jogador" ? await lerJogador(sessao.playerId) : null;
  const podeLancar = admin || !!eu?.organizador;

  const lancamentos = await lerCaixa();
  return <Caixa lancamentos={lancamentos} podeLancar={podeLancar} />;
}
