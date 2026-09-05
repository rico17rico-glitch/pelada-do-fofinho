import { lerConfig, lerJogador, lerRodadas } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import ListaRodadas from "./ListaRodadas";

export const dynamic = "force-dynamic";

export default async function PaginaRodadas() {
  const sessao = lerSessao();
  const admin = ehAdmin(sessao);
  const eu = !admin && sessao && sessao.tipo === "jogador" ? await lerJogador(sessao.playerId) : null;
  const podeCriar = admin || !!eu?.organizador;

  const [rodadas, cfg] = await Promise.all([lerRodadas(), lerConfig()]);
  return <ListaRodadas rodadas={rodadas} podeCriar={podeCriar} cfg={cfg} />;
}
